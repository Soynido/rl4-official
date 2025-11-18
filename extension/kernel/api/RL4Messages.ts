/**
 * RL4 Message Generators for Kernel ↔ WebView communication
 * Generates Now, Before, Next, Restore messages from .reasoning_rl4/* sources
 * 
 * Phase E3.1: Uses PromptBridge to generate structured prompts with raw data
 * RL4 collects + structures. Agent LLM reasons. Human validates.
 */

import * as fs from 'fs';
import * as path from 'path';
import { CognitiveIntegrityPass, CognitiveIntegrityReport } from './CognitiveIntegrityPass';
import { PromptBridge } from './PromptBridge';

// Types matching the WebView definitions
// Phase E3.1: Added rawPrompt field for PromptBridge integration
export type RL4Now = {
  cycleId: number;
  timestamp: string;
  rawPrompt?: string; // NEW: Formatted prompt from PromptBridge
  focusedFile?: string;
  recentlyViewed?: string[];
  patterns?: { id: string; confidence: number; trend?: string }[];
  forecasts?: { predicted: string; confidence: number; category?: string }[];
  mood?: string;
  confidence?: number;
  phase?: 'exploration' | 'stabilization' | 'production' | 'unknown';
  criticalModules?: string[];
  constraints?: {
    recentADRs: { id: string; title: string; decision?: string }[];
    techDebt: string[];
  };
  health?: {
    predictiveDrift?: number;
    coherence?: number;
    actionAdoption?: number;
  };
};

export type RL4Before = {
  date: string;
  rawPrompt?: string; // NEW: Formatted prompt from PromptBridge
  points: Array<{
    cycleId: number;
    timestamp: string;
    heat: number;
    summary?: string;
  }>;
};

export type RL4Next = {
  rawPrompt?: string; // NEW: Formatted prompt from PromptBridge
  phase?: RL4Now['phase'];
  patterns?: RL4Now['patterns'];
  correlations?: { id: string; direction?: string; score?: number }[];
  goals?: { id: string; title: string; status: 'active' | 'completed' | 'pending' }[];
  adrs?: { id: string; title: string; decision?: string; timestamp?: string }[];
  risks?: string[];
  integrity?: {
    cycleCoherence: number;
    patternDrift: number;
    forecastAccuracy: number;
    overallHealth: number;
    recommendations: string[];
  };
};

export type RL4RestoreIndex = {
  entries: Array<{
    cycleId: number;
    timestamp: string;
    label?: string;
    artifacts: {
      snapshot: string;
      diffs?: string;
      state?: string;
    };
  }>;
};

/**
 * Load and parse RL4 data files safely
 */
function loadRL4Data<T>(filePath: string): T | null {
  try {
    if (!fs.existsSync(filePath)) return null;
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content) as T;
  } catch (error) {
    return null;
  }
}

/**
 * Get current cycle from context
 */
function getCurrentCycle(rl4Path: string): number {
  try {
    const activePath = path.join(rl4Path, 'active.json');
    const active = loadRL4Data<{ cycle: number }>(activePath);
    return active?.cycle || 1;
  } catch {
    return 1;
  }
}

/**
 * Generate Now message from current RL4 state
 */
export function generateNowMessage(rl4Path: string): RL4Now | null {
  try {
    const cycleId = getCurrentCycle(rl4Path);
    const timestamp = new Date().toISOString();

    // Load patterns (handle both array and object format)
    const patternsData = loadRL4Data<any>(path.join(rl4Path, 'patterns.json'));
    const patternsArray = Array.isArray(patternsData) ? patternsData : (patternsData?.patterns || []);
    const patternList = patternsArray.slice(0, 5).map((p: any) => ({
      id: p.pattern_id || p.id || 'unknown',
      confidence: p.confidence || 0.5,
      trend: p.trend
    }));

    // Load forecasts (handle both array and object format)
    const forecastsData = loadRL4Data<any>(path.join(rl4Path, 'forecasts.json'));
    const forecastsArray = Array.isArray(forecastsData) ? forecastsData : (forecastsData?.forecasts || []);
    const forecastList = forecastsArray.slice(0, 5).map((f: any) => ({
      predicted: f.predicted_decision || f.predicted || 'unknown',
      confidence: f.confidence || 0.5,
      category: f.category
    }));

    // Load ADRs
    const adrsPath = path.join(rl4Path, 'ledger', 'adrs.jsonl');
    let recentADRs: { id: string; title: string; decision?: string }[] = [];
    if (fs.existsSync(adrsPath)) {
      const adrsContent = fs.readFileSync(adrsPath, 'utf8');
      const adrsLines = adrsContent.trim().split('\n').slice(-10); // Last 10 ADRs
      recentADRs = adrsLines
        .filter(line => line.trim())
        .map(line => {
          try {
            const adr = JSON.parse(line);
            return {
              id: adr.id || 'unknown',
              title: adr.title || 'Untitled ADR',
              decision: adr.decision
            };
          } catch {
            return null;
          }
        })
        .filter(Boolean) as typeof recentADRs;
    }

    // Load phase (use PhaseDetector logic inline - read from TASKS_RL4.md)
    let currentPhase: RL4Now['phase'] = 'unknown';
    try {
      const tasksPath = path.join(path.dirname(rl4Path), 'TASKS_RL4.md');
      if (fs.existsSync(tasksPath)) {
        const content = fs.readFileSync(tasksPath, 'utf-8');
        const lines = content.split('\n').slice(0, 30);
        const versionLine = lines.find(line => line.includes('**Version**') && line.includes('Phase E'));
        if (versionLine) {
          if (versionLine.includes('E2.')) currentPhase = 'stabilization';
          else if (versionLine.includes('E1.')) currentPhase = 'exploration';
          else if (versionLine.includes('E3.')) currentPhase = 'production';
        }
      }
    } catch {
      currentPhase = 'unknown';
    }

    // Load health metrics from JSONL (not JSON array)
    let healthMetrics: any = {};
    try {
      const healthPath = path.join(rl4Path, 'diagnostics', 'health.jsonl');
      if (fs.existsSync(healthPath)) {
        const content = fs.readFileSync(healthPath, 'utf8');
        const lines = content.trim().split('\n').filter(Boolean);
        if (lines.length > 0) {
          healthMetrics = JSON.parse(lines[lines.length - 1]); // Last line
        }
      }
    } catch {
      healthMetrics = {};
    }

    // Generate raw prompt using PromptBridge
    const bridge = new PromptBridge(rl4Path);
    const rawPrompt = bridge.formatNowPrompt();

    return {
      cycleId,
      timestamp,
      rawPrompt, // NEW: Add formatted prompt for WebView
      patterns: patternList,
      forecasts: forecastList,
      phase: currentPhase,
      criticalModules: ['CognitiveScheduler', 'PatternLearningEngine', 'CorrelationEngine', 'ForecastEngine'],
      constraints: {
        recentADRs,
        techDebt: [] // TODO: Load from appropriate source
      },
      health: {
        predictiveDrift: healthMetrics?.drift || 0.3,
        coherence: healthMetrics?.coherence || 0.7,
        actionAdoption: healthMetrics?.action_adoption || 0.5
      }
    };
  } catch (error) {
    return null;
  }
}

/**
 * Generate Before message from timeline data
 */
export function generateBeforeMessage(rl4Path: string, date?: string): RL4Before | null {
  try {
    const targetDate = date || new Date().toISOString().split('T')[0];

    // Load context history snapshots
    const historyPath = path.join(rl4Path, 'context_history');
    if (!fs.existsSync(historyPath)) return null;

    const files = fs.readdirSync(historyPath)
      .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
      .map(f => {
        const cycleId = parseInt(f.replace('snapshot-', '').replace('.json', ''));
        return { cycleId, file: f };
      })
      .sort((a, b) => a.cycleId - b.cycleId);

    const points = files.slice(-20).map(({ cycleId, file }) => {
      const snapshot = loadRL4Data<any>(path.join(historyPath, file));
      return {
        cycleId,
        timestamp: snapshot?.timestamp || new Date().toISOString(),
        heat: Math.random() * 0.8 + 0.1, // TODO: Calculate real heat
        summary: snapshot?.focusedFile ? `Focused: ${path.basename(snapshot.focusedFile)}` : undefined
      };
    });

    // Generate raw prompt using PromptBridge (last 24 hours by default)
    const bridge = new PromptBridge(rl4Path);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const now = new Date();
    const rawPrompt = bridge.formatBeforePrompt(oneDayAgo, now);

    return {
      date: targetDate,
      rawPrompt, // NEW: Add formatted prompt for WebView
      points
    };
  } catch (error) {
    return null;
  }
}

/**
 * Generate Next message from current state with cognitive integrity metrics
 */
export async function generateNextMessage(rl4Path: string): Promise<RL4Next | null> {
  try {
    const now = generateNowMessage(rl4Path);
    if (!now) return null;

    // Load correlations
    const correlations = loadRL4Data<any>(path.join(rl4Path, 'correlations.json'));
    const correlationList = correlations?.slice(0, 5).map((c: any) => ({
      id: c.id || 'unknown',
      direction: c.direction,
      score: c.score
    }));

    // Load goals
    const goals = loadRL4Data<any>(path.join(rl4Path, 'forecasts.json')); // Using forecasts as goals proxy
    const goalList = (goals && Array.isArray(goals)) ? goals.slice(0, 3).map((g, index) => ({
      id: `goal-${index}`,
      title: g.predicted || 'Untitled Goal',
      status: 'active' as const
    })) : [];

    // Derive risks from constraints and health
    const risks: string[] = [];
    if (now.health?.predictiveDrift && now.health.predictiveDrift > 0.5) {
      risks.push('High predictive drift affecting forecast accuracy');
    }
    if (now.health?.coherence && now.health.coherence < 0.4) {
      risks.push('Low coherence indicating reasoning inconsistency');
    }

    // Run Cognitive Integrity Pass for factual metrics
    let integrityMetrics = undefined;
    try {
      const integrityPass = new CognitiveIntegrityPass(rl4Path);
      const integrityReport = await integrityPass.runIntegrityPass();

      integrityMetrics = {
        cycleCoherence: integrityReport.cycleCoherence,
        patternDrift: integrityReport.patternDrift,
        forecastAccuracy: integrityReport.forecastAccuracy,
        overallHealth: integrityReport.overallHealth,
        recommendations: integrityReport.recommendations
      };

      console.log(`[Integrity] Health score: ${(integrityReport.overallHealth * 100).toFixed(1)}%`);
    } catch (integrityError) {
      console.warn('[Integrity] Could not run integrity pass:', integrityError);
      // Continue without integrity metrics rather than failing
    }

    // Generate raw prompt using PromptBridge
    const bridge = new PromptBridge(rl4Path);
    const rawPrompt = bridge.formatNextPrompt();

    return {
      rawPrompt, // NEW: Add formatted prompt for WebView
      phase: now.phase,
      patterns: now.patterns,
      correlations: correlationList,
      goals: goalList,
      adrs: now.constraints?.recentADRs,
      risks,
      integrity: integrityMetrics
    };
  } catch (error) {
    return null;
  }
}

/**
 * Generate Restore index from available restore points
 */
export function generateRestoreMessage(rl4Path: string): RL4RestoreIndex | null {
  try {
    const entries: RL4RestoreIndex['entries'] = [];

    // Add context history entries
    const historyPath = path.join(rl4Path, 'context_history');
    if (fs.existsSync(historyPath)) {
      const files = fs.readdirSync(historyPath)
        .filter(f => f.startsWith('snapshot-') && f.endsWith('.json'))
        .map(f => {
          const cycleId = parseInt(f.replace('snapshot-', '').replace('.json', ''));
          const snapshot = loadRL4Data<any>(path.join(historyPath, f));
          return {
            cycleId,
            timestamp: snapshot?.timestamp || new Date().toISOString(),
            label: `Snapshot ${cycleId}`,
            artifacts: {
              snapshot: f,
              state: 'artifacts/state.json.gz' // Example artifact path (unified path)
            }
          };
        })
        .sort((a, b) => b.cycleId - a.cycleId)
        .slice(0, 10); // Last 10 entries

      entries.push(...files);
    }

    return { entries };
  } catch (error) {
    return null;
  }
}
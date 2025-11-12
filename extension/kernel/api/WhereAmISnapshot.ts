/**
 * WhereAmI Snapshot Generator - Real-time Cognitive Context API
 * 
 * Generates dynamic Markdown snapshots reflecting workspace state:
 * - Current focus (open files, recently viewed)
 * - Active patterns and forecasts
 * - Cognitive load and mental state
 * - Temporal anchoring (cycle, timestamp)
 * 
 * Used by:
 * - WebView UI (real-time dashboard)
 * - Chat Agent (context awareness - "Where am I?")
 * - CLI tools (debugging, exploration)
 * 
 * Complements:
 * - ContextSnapshotManager (Level 6 external evidence)
 * - StateReconstructor (historical state reconstruction)
 * 
 * RL4 Kernel API Component
 */

import * as fs from 'fs';
import * as path from 'path';
import { PhaseDetector } from './PhaseDetector';

/**
 * Cognitive snapshot data structure (compatible with RL4 Store)
 * Extended for agent calibration
 */
export interface CognitiveSnapshot {
  cycleId: number;
  timestamp: string;
  focusedFile?: string;
  recentlyViewed?: string[];
  patterns?: { id: string; confidence: number; trend?: string; impact?: string }[];
  forecasts?: { predicted: string; confidence: number; category?: string }[];
  mood?: string;
  confidence?: number;
  
  // Extended data for agent calibration
  architecture?: {
    projectName: string;
    phase: 'exploration' | 'stabilization' | 'production' | 'unknown';
    criticalModules: string[];
  };
  constraints?: {
    recentADRs: Array<{ id: string; title: string; decision: string }>;
    techDebt: string[];
  };
  alerts?: {
    activeBiases: Array<{ type: string; count: number }>;
    healthMetrics: {
      predictiveDrift: number;
      coherence: number;
      actionAdoption: number;
    };
  };
  goals?: {
    active: number;
    completed: number;
    successRate: number;
    list: any[];
  };
  adrs?: {
    total: number;
    recent: any[];
  };
  correlations?: {
    total: number;
    directions: Record<string, number>;
  };
}

/**
 * Generate "Where Am I?" Markdown snapshot
 * 
 * @param root - RL4 data directory (default: .reasoning_rl4)
 * @returns Formatted Markdown string
 */
export async function generateWhereAmI(root?: string): Promise<string> {
  const workspaceRoot = root ? path.dirname(root) : process.cwd();
  const rl4Root = root || path.join(workspaceRoot, '.reasoning_rl4');
  
  const snapshot: CognitiveSnapshot = {
    cycleId: 0,
    timestamp: new Date().toISOString(),
  };

  // 1. Load current cycle
  try {
    const cyclesPath = path.join(rl4Root, 'ledger', 'cycles.jsonl');
    if (fs.existsSync(cyclesPath)) {
      const lines = fs.readFileSync(cyclesPath, 'utf-8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const latestCycle = JSON.parse(lines[lines.length - 1]);
        snapshot.cycleId = latestCycle.cycleId || 0;
        snapshot.timestamp = latestCycle.timestamp || snapshot.timestamp;
      }
    }
  } catch (error) {
    // Silent fail - use defaults
  }

  // 2. Load IDE activity (focused file, recently viewed)
  try {
    const ideActivityPath = path.join(rl4Root, 'traces', 'ide_activity.jsonl');
    if (fs.existsSync(ideActivityPath)) {
      const lines = fs.readFileSync(ideActivityPath, 'utf-8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const latestActivity = JSON.parse(lines[lines.length - 1]);
        const metadata = latestActivity.metadata || {};
        
        if (metadata.focused_file?.path) {
          snapshot.focusedFile = metadata.focused_file.path;
        }
        
        if (Array.isArray(metadata.recently_viewed)) {
          snapshot.recentlyViewed = metadata.recently_viewed
            .slice(0, 5) // Limit to 5 most recent
            .map((item: any) => typeof item === 'string' ? item : item.path)
            .filter(Boolean);
        }
      }
    }
  } catch (error) {
    // Silent fail - no IDE activity
  }

  // 3. Load active patterns
  try {
    const patternsPath = path.join(rl4Root, 'patterns.json');
    if (fs.existsSync(patternsPath)) {
      const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      if (Array.isArray(patternsData.patterns)) {
        snapshot.patterns = patternsData.patterns
          .slice(-3) // Last 3 patterns
          .map((p: any) => ({
            id: p.pattern_id || p.id || 'unknown',
            confidence: p.confidence || 0,
            trend: p.trend || 'stable',
          }));
      }
    }
  } catch (error) {
    // Silent fail - no patterns
  }

  // 4. Load active forecasts
  try {
    const forecastsPath = path.join(rl4Root, 'forecasts.json');
    if (fs.existsSync(forecastsPath)) {
      const forecastsData = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
      // Handle both array format [...] and object format {forecasts: [...]}
      const forecastsArray = Array.isArray(forecastsData) ? forecastsData : (forecastsData.forecasts || []);
      
      if (forecastsArray.length > 0) {
        snapshot.forecasts = forecastsArray
          .slice(-3) // Last 3 forecasts
          .map((f: any) => ({
            predicted: f.predicted_decision || f.predicted || f.description || 'Unknown',
            confidence: f.confidence || 0,
          }));
      }
    }
  } catch (error) {
    // Silent fail - no forecasts
  }

  // 5. Load mental state (if available)
  try {
    const mentalStatePath = path.join(rl4Root, 'mental_state.json');
    if (fs.existsSync(mentalStatePath)) {
      const mentalState = JSON.parse(fs.readFileSync(mentalStatePath, 'utf-8'));
      snapshot.mood = mentalState.mood || undefined;
      snapshot.confidence = mentalState.confidence || undefined;
    }
  } catch (error) {
    // Silent fail - no mental state
  }

  // 6. Detect project phase and populate architecture
  try {
    const phaseDetector = new PhaseDetector(workspaceRoot);
    const detectedPhase = await phaseDetector.detectPhase();
    
    snapshot.architecture = {
      projectName: path.basename(workspaceRoot),
      phase: detectedPhase,
      criticalModules: [
        'CognitiveScheduler',
        'PatternLearningEngine',
        'CorrelationEngine',
        'ForecastEngine',
      ],
    };
  } catch (error) {
    // Fallback if detection fails
    snapshot.architecture = {
      projectName: path.basename(workspaceRoot),
      phase: 'unknown',
      criticalModules: [],
    };
  }

  // --- Generate Markdown ---
  return formatMarkdownSnapshot(snapshot);
}

/**
 * Format cognitive snapshot as Markdown
 */
function formatMarkdownSnapshot(snapshot: CognitiveSnapshot): string {
  const lines: string[] = [];
  
  // Header
  lines.push('# 🧠 Where Am I? — RL4 Cognitive Snapshot');
  lines.push('');
  lines.push(`**Generated at**: ${new Date().toLocaleString('fr-FR', { 
    dateStyle: 'full', 
    timeStyle: 'medium' 
  })}`);
  lines.push(`**Cycle**: ${snapshot.cycleId || 'N/A'}`);
  
  if (snapshot.mood && snapshot.confidence !== undefined) {
    const confidencePercent = Math.round(snapshot.confidence * 100);
    lines.push(`**Mood**: ${snapshot.mood} (${confidencePercent}% confidence)`);
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');

  // Current Context
  lines.push('## 📍 Current Context');
  lines.push('');
  
  if (snapshot.focusedFile) {
    lines.push(`Currently focused on: \`${snapshot.focusedFile}\``);
  } else {
    lines.push('No active file currently focused.');
  }
  
  if (snapshot.recentlyViewed && snapshot.recentlyViewed.length > 0) {
    lines.push('');
    lines.push('**Recently viewed**:');
    snapshot.recentlyViewed.forEach(file => {
      lines.push(`- \`${file}\``);
    });
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');

  // Cognitive Patterns
  lines.push('## 🔍 Cognitive Patterns');
  lines.push('');
  
  if (snapshot.patterns && snapshot.patterns.length > 0) {
    snapshot.patterns.forEach(p => {
      const confidencePercent = Math.round(p.confidence * 100);
      const trendEmoji = p.trend === 'increasing' ? '📈' : p.trend === 'decreasing' ? '📉' : '➡️';
      lines.push(`- **${p.id}** (${confidencePercent}% confidence, ${trendEmoji} ${p.trend})`);
    });
  } else {
    lines.push('No recent patterns detected.');
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');

  // Forecasts
  lines.push('## 📈 Forecasts');
  lines.push('');
  
  if (snapshot.forecasts && snapshot.forecasts.length > 0) {
    snapshot.forecasts.forEach(f => {
      const confidencePercent = Math.round(f.confidence * 100);
      lines.push(`- *${f.predicted}* (${confidencePercent}% confidence)`);
    });
  } else {
    lines.push('No active forecasts.');
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');

  // Recommendations
  lines.push('## 💡 Recommendations');
  lines.push('');
  
  if (snapshot.focusedFile) {
    lines.push(`- Resume editing **${snapshot.focusedFile}** to continue the current reasoning path.`);
    lines.push('- Check recent patterns for alignment with this file.');
  } else {
    lines.push('- No active file. Try reopening your last context or reviewing pending forecasts.');
  }
  
  if (snapshot.patterns && snapshot.patterns.length > 0) {
    const highConfidencePatterns = snapshot.patterns.filter(p => p.confidence > 0.7);
    if (highConfidencePatterns.length > 0) {
      lines.push(`- ${highConfidencePatterns.length} high-confidence pattern(s) detected — leverage these insights.`);
    }
  }
  
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('_Automatically generated by RL4 Cognitive Replay_');

  return lines.join('\n');
}

/**
 * Export snapshot data as JSON (for programmatic access and WebView)
 * Returns clean CognitiveSnapshot compatible with useRL4Store()
 */
export async function generateSnapshotJSON(root?: string): Promise<CognitiveSnapshot> {
  const rl4Root = root || path.join(process.cwd(), '.reasoning_rl4');
  
  const snapshot: CognitiveSnapshot = {
    cycleId: 0,
    timestamp: new Date().toISOString(),
  };

  // 1. Load current cycle
  try {
    const cyclesPath = path.join(rl4Root, 'ledger', 'cycles.jsonl');
    if (fs.existsSync(cyclesPath)) {
      const lines = fs.readFileSync(cyclesPath, 'utf-8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const latestCycle = JSON.parse(lines[lines.length - 1]);
        snapshot.cycleId = latestCycle.cycleId || 0;
        snapshot.timestamp = latestCycle.timestamp || snapshot.timestamp;
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 2. Load IDE activity (focused file, recently viewed)
  try {
    const ideActivityPath = path.join(rl4Root, 'traces', 'ide_activity.jsonl');
    if (fs.existsSync(ideActivityPath)) {
      const lines = fs.readFileSync(ideActivityPath, 'utf-8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const latestActivity = JSON.parse(lines[lines.length - 1]);
        const metadata = latestActivity.metadata || {};
        
        if (metadata.focused_file?.path) {
          snapshot.focusedFile = metadata.focused_file.path;
        }
        
        if (Array.isArray(metadata.recently_viewed)) {
          snapshot.recentlyViewed = metadata.recently_viewed
            .slice(0, 5)
            .map((item: any) => typeof item === 'string' ? item : item.path)
            .filter(Boolean);
        }
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 3. Load active patterns
  try {
    const patternsPath = path.join(rl4Root, 'patterns.json');
    if (fs.existsSync(patternsPath)) {
      const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      if (Array.isArray(patternsData.patterns)) {
        snapshot.patterns = patternsData.patterns
          .slice(-5) // Last 5 patterns
          .map((p: any) => ({
            id: p.pattern_id || p.id || 'unknown',
            confidence: p.confidence || 0,
            trend: p.trend || 'stable',
          }));
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 4. Load active forecasts
  try {
    const forecastsPath = path.join(rl4Root, 'forecasts.json');
    if (fs.existsSync(forecastsPath)) {
      const forecastsData = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
      // Handle both array format [...] and object format {forecasts: [...]}
      const forecastsArray = Array.isArray(forecastsData) ? forecastsData : (forecastsData.forecasts || []);
      
      if (forecastsArray.length > 0) {
        snapshot.forecasts = forecastsArray
          .slice(-5) // Last 5 forecasts
          .map((f: any) => ({
            predicted: f.predicted_decision || f.predicted || f.description || 'Unknown',
            confidence: f.confidence || 0,
          }));
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 5. Load mental state (if available)
  try {
    const mentalStatePath = path.join(rl4Root, 'mental_state.json');
    if (fs.existsSync(mentalStatePath)) {
      const mentalState = JSON.parse(fs.readFileSync(mentalStatePath, 'utf-8'));
      snapshot.mood = mentalState.mood || undefined;
      snapshot.confidence = mentalState.confidence || undefined;
    }
  } catch (error) {
    // Silent fail
  }

  return snapshot;
}

/**
 * Generate complete cognitive state for WebView UI
 * Aggregates all RL4 data sources into a single structured object
 */
export async function generateCognitiveState(root?: string): Promise<any> {
  const rl4Root = root || path.join(process.cwd(), '.reasoning_rl4');
  
  const state: any = {
    timestamp: new Date().toISOString(),
    cycleId: 0,
    adrs: { total: 0, recent: [] },
    patterns: { total: 0, impacts: {}, recent: [] },
    correlations: { total: 0, directions: {}, recent: [] },
    forecasts: { total: 0, recent: [] },
    biases: { total: 0, types: {}, recent: [] },
    goals: { active: 0, completed: 0, list: [] },
    focus: null,
    recentlyViewed: [],
  };

  // 1. Load current cycle
  try {
    const cyclesPath = path.join(rl4Root, 'ledger', 'cycles.jsonl');
    if (fs.existsSync(cyclesPath)) {
      const lines = fs.readFileSync(cyclesPath, 'utf-8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const latestCycle = JSON.parse(lines[lines.length - 1]);
        state.cycleId = latestCycle.cycleId || 0;
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 2. Load patterns
  try {
    const patternsPath = path.join(rl4Root, 'patterns.json');
    if (fs.existsSync(patternsPath)) {
      const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      if (Array.isArray(patternsData.patterns)) {
        state.patterns.total = patternsData.patterns.length;
        // Map patterns with full data
        state.patterns.recent = patternsData.patterns.slice(-5).map((p: any) => ({
          id: p.id || p.pattern_id || 'unknown',
          pattern_id: p.id || p.pattern_id,
          confidence: p.confidence || 0,
          trend: p.trend || 'stable',
          impact: p.impact || 'unknown',
          category: p.category || 'general',
          pattern: p.pattern || '',
          frequency: p.frequency || 0,
        }));
        
        // Count by impact
        patternsData.patterns.forEach((p: any) => {
          const impact = p.impact || 'unknown';
          state.patterns.impacts[impact] = (state.patterns.impacts[impact] || 0) + 1;
        });
      }
    }
  } catch (error) {
    console.error('Failed to load patterns:', error);
  }

  // 3. Load forecasts
  try {
    const forecastsPath = path.join(rl4Root, 'forecasts.json');
    if (fs.existsSync(forecastsPath)) {
      const forecastsData = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
      const forecastsArray = Array.isArray(forecastsData) ? forecastsData : (forecastsData.forecasts || []);
      if (forecastsArray.length > 0) {
        state.forecasts.total = forecastsArray.length;
        // Map forecasts with category detection
        state.forecasts.recent = forecastsArray.slice(-5).map((f: any) => ({
          predicted: f.predicted_decision || f.predicted || f.description || 'Unknown',
          predicted_decision: f.predicted_decision || f.predicted,
          confidence: f.confidence || 0,
          category: f.category || detectForecastCategory(f),
          evidence: f.evidence_count || 0,
        }));
      }
    }
  } catch (error) {
    console.error('Failed to load forecasts:', error);
  }

  // 4. Load correlations
  try {
    const correlationsPath = path.join(rl4Root, 'correlations.json');
    if (fs.existsSync(correlationsPath)) {
      const correlationsData = JSON.parse(fs.readFileSync(correlationsPath, 'utf-8'));
      if (Array.isArray(correlationsData.correlations)) {
        state.correlations.total = correlationsData.correlations.length;
        state.correlations.recent = correlationsData.correlations.slice(-5); // Last 5
        
        // Count by direction
        correlationsData.correlations.forEach((c: any) => {
          const direction = c.direction || 'unknown';
          state.correlations.directions[direction] = (state.correlations.directions[direction] || 0) + 1;
        });
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 5. Load goals
  try {
    const goalsPath = path.join(rl4Root, 'goals.json');
    if (fs.existsSync(goalsPath)) {
      const goalsData = JSON.parse(fs.readFileSync(goalsPath, 'utf-8'));
      const goalsArray = Array.isArray(goalsData) ? goalsData : (goalsData.goals || []);
      if (goalsArray.length > 0) {
        state.goals.list = goalsArray;
        state.goals.active = goalsArray.filter((g: any) => 
          g.status === 'active' || g.status === 'in_progress' || g.status === 'pending'
        ).length;
        state.goals.completed = goalsArray.filter((g: any) => g.status === 'completed').length;
      }
    }
  } catch (error) {
    console.error('Failed to load goals:', error);
  }

  // 6. Load ADRs (from ledger + active.json + auto/ directory)
  try {
    const adrLedgerPath = path.join(rl4Root, 'ledger', 'adrs.jsonl');
    const adrActivePath = path.join(rl4Root, 'adrs', 'active.json');
    const adrAutoDir = path.join(rl4Root, 'adrs', 'auto');
    
    let allADRs: any[] = [];
    
    // Load from ledger
    if (fs.existsSync(adrLedgerPath)) {
      const lines = fs.readFileSync(adrLedgerPath, 'utf-8').trim().split('\n').filter(Boolean);
      allADRs = allADRs.concat(lines.map(line => JSON.parse(line)));
    }
    
    // Load from active.json
    if (fs.existsSync(adrActivePath)) {
      const activeData = JSON.parse(fs.readFileSync(adrActivePath, 'utf-8'));
      if (activeData.accepted && Array.isArray(activeData.accepted)) {
        allADRs = allADRs.concat(activeData.accepted);
      }
    }
    
    // Load from auto/ directory
    if (fs.existsSync(adrAutoDir)) {
      const files = fs.readdirSync(adrAutoDir).filter(f => f.endsWith('.json') && f !== 'proposals.index.json');
      files.forEach(file => {
        try {
          const adr = JSON.parse(fs.readFileSync(path.join(adrAutoDir, file), 'utf-8'));
          allADRs.push(adr);
        } catch (e) {
          // Skip corrupted files
        }
      });
    }
    
    state.adrs.total = allADRs.length;
    state.adrs.recent = allADRs.slice(-5);
  } catch (error) {
    console.error('Failed to load ADRs:', error);
  }

  // 7. Load IDE activity (focused file, recently viewed)
  try {
    const ideActivityPath = path.join(rl4Root, 'traces', 'ide_activity.jsonl');
    if (fs.existsSync(ideActivityPath)) {
      const lines = fs.readFileSync(ideActivityPath, 'utf-8').trim().split('\n').filter(Boolean);
      if (lines.length > 0) {
        const latestActivity = JSON.parse(lines[lines.length - 1]);
        const metadata = latestActivity.metadata || {};
        
        if (metadata.focused_file?.path) {
          state.focus = metadata.focused_file.path;
        }
        
        if (Array.isArray(metadata.recently_viewed)) {
          state.recentlyViewed = metadata.recently_viewed
            .slice(0, 5)
            .map((item: any) => typeof item === 'string' ? item : item.path)
            .filter(Boolean);
        }
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 8. Load biases (if available)
  try {
    const biasesPath = path.join(rl4Root, 'biases.json');
    if (fs.existsSync(biasesPath)) {
      const biasesData = JSON.parse(fs.readFileSync(biasesPath, 'utf-8'));
      if (Array.isArray(biasesData.biases)) {
        state.biases.total = biasesData.biases.length;
        state.biases.recent = biasesData.biases.slice(-5); // Last 5
        
        // Count by type
        biasesData.biases.forEach((b: any) => {
          const type = b.type || 'unknown';
          state.biases.types[type] = (state.biases.types[type] || 0) + 1;
        });
      }
    }
  } catch (error) {
    // Silent fail
  }

  // 9. Architecture context (detect project phase, critical modules)
  state.architecture = {
    projectName: 'RL4 Cognitive OS',
    phase: detectProjectPhase(state),
    criticalModules: detectCriticalModules(rl4Root),
  };
  console.log('[RL4 Snapshot] Architecture:', state.architecture);

  // 10. Constraints (recent ADRs, tech debt)
  state.constraints = {
    recentADRs: extractRecentADRs(state.adrs.recent),
    techDebt: detectTechDebt(state.patterns.recent, state.biases.types),
  };
  console.log('[RL4 Snapshot] Constraints - ADRs:', state.constraints.recentADRs.length, 'Tech Debt:', state.constraints.techDebt.length);

  // 11. Alerts (health metrics always calculated from real data)
  const activeBiases = Object.entries(state.biases.types || {})
    .map(([type, count]) => ({ type, count: count as number }))
    .filter(b => b.count > 0);
  
  state.alerts = {
    activeBiases: activeBiases,
    healthMetrics: calculateHealthMetrics(state),
  };
  console.log('[RL4 Snapshot] Alerts - Biases:', state.alerts.activeBiases.length, 'Health:', state.alerts.healthMetrics);

  // 12. Enrich goals with success rate
  if (state.goals.active + state.goals.completed > 0) {
    state.goals.successRate = state.goals.completed / (state.goals.active + state.goals.completed);
  } else {
    state.goals.successRate = 0;
  }
  console.log('[RL4 Snapshot] Goals - Active:', state.goals.active, 'Completed:', state.goals.completed, 'Success Rate:', Math.round(state.goals.successRate * 100) + '%');

  // 13. Add mood and confidence from mental state
  try {
    const mentalStatePath = path.join(rl4Root, 'mental_state.json');
    if (fs.existsSync(mentalStatePath)) {
      const mentalState = JSON.parse(fs.readFileSync(mentalStatePath, 'utf-8'));
      state.mood = mentalState.mood || 'unknown';
      state.confidence = mentalState.confidence || 0.5;
    }
  } catch (error) {
    state.mood = 'unknown';
    state.confidence = 0.5;
  }
  
  console.log('[RL4 Snapshot] Final state - Cycle:', state.cycleId, 'Mood:', state.mood, 'Confidence:', Math.round((state.confidence || 0) * 100) + '%');
  console.log('[RL4 Snapshot] Totals - Patterns:', state.patterns.total, 'Forecasts:', state.forecasts.total, 'ADRs:', state.adrs.total, 'Goals:', state.goals.list.length);

  return state;
}

/**
 * Detect project phase from patterns and activity
 */
function detectProjectPhase(state: any): 'exploration' | 'stabilization' | 'production' | 'unknown' {
  const patterns = state.patterns.recent || [];
  
  // Check pattern IDs and descriptions
  let fixCount = 0;
  let featureCount = 0;
  let refactorCount = 0;
  
  patterns.forEach((p: any) => {
    const id = (p.pattern_id || p.id || '').toLowerCase();
    const pattern = (p.pattern || '').toLowerCase();
    const combined = `${id} ${pattern}`;
    
    if (combined.includes('fix') || combined.includes('bug') || combined.includes('stability')) {
      fixCount++;
    }
    if (combined.includes('feature') || combined.includes('feat')) {
      featureCount++;
    }
    if (combined.includes('refactor') || combined.includes('evolution') || combined.includes('architecture')) {
      refactorCount++;
    }
  });

  // Heuristic based on pattern ratios
  const total = fixCount + featureCount + refactorCount;
  if (total === 0) {
    // Fallback: check forecasts for clues
    const forecasts = state.forecasts.recent || [];
    const fixForecast = forecasts.some((f: any) => 
      (f.predicted_decision || f.predicted || '').toLowerCase().includes('fix')
    );
    if (fixForecast) return 'stabilization';
    return 'unknown';
  }
  
  const fixRatio = fixCount / total;
  const featureRatio = featureCount / total;
  
  // If >40% fixes → stabilization
  if (fixRatio > 0.4) return 'stabilization';
  
  // If >50% features → exploration
  if (featureRatio > 0.5) return 'exploration';
  
  // If mostly refactors → production
  if (refactorCount > fixCount && refactorCount > featureCount) return 'production';
  
  return 'unknown';
}

/**
 * Detect critical modules from file changes
 */
function detectCriticalModules(rl4Root: string): string[] {
  try {
    const fileChangesPath = path.join(rl4Root, 'traces', 'file_changes.jsonl');
    if (fs.existsSync(fileChangesPath)) {
      const lines = fs.readFileSync(fileChangesPath, 'utf-8').trim().split('\n').filter(Boolean);
      const recentChanges = lines.slice(-50); // Last 50 file changes
      
      const moduleCounts: Record<string, number> = {};
      recentChanges.forEach(line => {
        const change = JSON.parse(line);
        const filePath = change.file_path || change.metadata?.file_path || '';
        if (filePath) {
          // Extract top-level module (e.g. "extension/kernel" from "extension/kernel/api/WhereAmI.ts")
          const parts = filePath.split('/');
          if (parts.length >= 2) {
            const module = `${parts[0]}/${parts[1]}`;
            moduleCounts[module] = (moduleCounts[module] || 0) + 1;
          }
        }
      });
      
      // Return top 3 most active modules
      return Object.entries(moduleCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([module]) => module);
    }
  } catch (error) {
    // Silent fail
  }
  return ['extension/kernel', 'extension/webview', 'extension/core'];
}

/**
 * Extract recent ADRs with key info
 */
function extractRecentADRs(recentADRs: any[]): Array<{ id: string; title: string; decision: string }> {
  if (!recentADRs || recentADRs.length === 0) return [];
  
  return recentADRs.slice(-3).map(adr => ({
    id: adr.id || adr.adr_id || 'unknown',
    title: adr.title || adr.metadata?.title || 'Untitled ADR',
    decision: (adr.decision || adr.metadata?.decision || '').substring(0, 100) || 'No decision recorded',
  })).reverse(); // Most recent first
}

/**
 * Detect tech debt from patterns and biases
 */
function detectTechDebt(patterns: any[], biasTypes: Record<string, number>): string[] {
  const debt: string[] = [];
  
  // Check for patterns indicating debt
  patterns.forEach(p => {
    const patternId = (p.pattern_id || p.id || '').toLowerCase();
    if (patternId.includes('workaround') || patternId.includes('hack') || patternId.includes('temporary')) {
      debt.push(`Pattern detected: ${p.pattern_id || p.id}`);
    }
  });
  
  // Check for bias accumulation
  if (biasTypes['recency-bias'] && biasTypes['recency-bias'] > 2) {
    debt.push('High recency bias (over-focus on recent changes)');
  }
  if (biasTypes['confirmation-bias'] && biasTypes['confirmation-bias'] > 1) {
    debt.push('Confirmation bias detected (pattern over-matching)');
  }
  
  return debt;
}

/**
 * Detect forecast category from content
 */
function detectForecastCategory(forecast: any): string {
  const text = (forecast.predicted_decision || forecast.predicted || '').toLowerCase();
  if (text.includes('architecture') || text.includes('design')) return 'architecture';
  if (text.includes('fix') || text.includes('bug') || text.includes('stability')) return 'quality';
  if (text.includes('feature') || text.includes('capability')) return 'feature';
  if (text.includes('refactor') || text.includes('debt')) return 'maintenance';
  if (text.includes('performance') || text.includes('optimization')) return 'performance';
  return 'general';
}

/**
 * Calculate health metrics from state data
 */
function calculateHealthMetrics(state: any): { predictiveDrift: number; coherence: number; actionAdoption: number } {
  // Predictive Drift: based on correlation divergence
  const divergingCorrelations = state.correlations.directions?.diverging || 0;
  const totalCorrelations = state.correlations.total || 1;
  const predictiveDrift = Math.min(0.9, divergingCorrelations / Math.max(10, totalCorrelations * 0.2));
  
  // Coherence: inverse of bias density (high coherence = low biases)
  const totalBiases = state.biases.total || 0;
  const totalPatterns = state.patterns.total || 1;
  const coherence = Math.max(0.1, 1 - (totalBiases / Math.max(20, totalPatterns)));
  
  // Action Adoption: goal completion rate (with fallback)
  const actionAdoption = state.goals.successRate !== undefined 
    ? state.goals.successRate 
    : (state.goals.completed > 0 ? state.goals.completed / (state.goals.active + state.goals.completed) : 0.5);
  
  return {
    predictiveDrift: Math.round(predictiveDrift * 100) / 100,
    coherence: Math.round(coherence * 100) / 100,
    actionAdoption: Math.round(actionAdoption * 100) / 100,
  };
}


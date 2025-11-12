/**
 * PhaseDetector - Automatic project phase inference
 * 
 * Determines current development phase based on:
 * - Cycle count and stability
 * - ADR generation patterns
 * - Pattern diversity
 * - TASKS_RL4.md markers
 * 
 * Phases:
 * - exploration: Early cycles (< 50), high pattern diversity, few ADRs
 * - stabilization: Mid-range cycles (50-200), ADR generation active
 * - production: High cycles (> 200), stable patterns, low change rate
 * - unknown: Insufficient data or ambiguous metrics
 */

import * as fs from 'fs';
import * as path from 'path';

export type ProjectPhase = 'exploration' | 'stabilization' | 'production' | 'unknown';

export interface PhaseIndicators {
  cycleCount: number;
  adrCount: number;
  patternDiversity: number; // 0-1
  changeRate: number; // commits/day
  confidenceMean: number; // 0-1
}

export class PhaseDetector {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Detect current project phase
   */
  async detectPhase(): Promise<ProjectPhase> {
    const indicators = await this.gatherIndicators();
    
    // Strategy 1: Check TASKS_RL4.md for explicit phase markers
    const explicitPhase = await this.readPhaseFromTasks();
    if (explicitPhase !== 'unknown') {
      return explicitPhase;
    }

    // Strategy 2: Infer from metrics
    return this.inferPhaseFromMetrics(indicators);
  }

  /**
   * Gather all phase indicators from RL4 data
   */
  private async gatherIndicators(): Promise<PhaseIndicators> {
    const rl4Root = path.join(this.workspaceRoot, '.reasoning_rl4');
    
    let cycleCount = 0;
    let adrCount = 0;
    let patternDiversity = 0;
    let changeRate = 0;
    let confidenceMean = 0;

    // 1. Cycle count
    try {
      const cyclesPath = path.join(rl4Root, 'ledger', 'cycles.jsonl');
      if (fs.existsSync(cyclesPath)) {
        const lines = fs.readFileSync(cyclesPath, 'utf-8').trim().split('\n').filter(Boolean);
        cycleCount = lines.length;
      }
    } catch (error) {
      // Silent fail
    }

    // 2. ADR count
    try {
      const adrsDir = path.join(rl4Root, 'adrs', 'auto');
      if (fs.existsSync(adrsDir)) {
        adrCount = fs.readdirSync(adrsDir).filter(f => f.endsWith('.json')).length;
      }
    } catch (error) {
      // Silent fail
    }

    // 3. Pattern diversity (number of unique patterns)
    try {
      const patternsPath = path.join(rl4Root, 'patterns.json');
      if (fs.existsSync(patternsPath)) {
        const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
        const patterns = patternsData.patterns || [];
        patternDiversity = patterns.length / 10; // Normalize to 0-1 (10 patterns = 100%)
        
        // Calculate mean confidence
        if (patterns.length > 0) {
          confidenceMean = patterns.reduce((sum: number, p: any) => sum + (p.confidence || 0), 0) / patterns.length;
        }
      }
    } catch (error) {
      // Silent fail
    }

    // 4. Change rate (git commits in last 7 days)
    try {
      const gitCommitsPath = path.join(rl4Root, 'traces', 'git_commits.jsonl');
      if (fs.existsSync(gitCommitsPath)) {
        const lines = fs.readFileSync(gitCommitsPath, 'utf-8').trim().split('\n').filter(Boolean);
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const recentCommits = lines.filter(line => {
          const event = JSON.parse(line);
          return new Date(event.timestamp).getTime() > sevenDaysAgo;
        });
        changeRate = recentCommits.length / 7; // commits per day
      }
    } catch (error) {
      // Silent fail
    }

    return {
      cycleCount,
      adrCount,
      patternDiversity: Math.min(patternDiversity, 1),
      changeRate,
      confidenceMean,
    };
  }

  /**
   * Read phase from TASKS_RL4.md if explicitly marked
   */
  private async readPhaseFromTasks(): Promise<ProjectPhase> {
    try {
      const tasksPath = path.join(this.workspaceRoot, 'TASKS_RL4.md');
      if (!fs.existsSync(tasksPath)) {
        return 'unknown';
      }

      const content = fs.readFileSync(tasksPath, 'utf-8');
      
      // Look for explicit phase markers in first 30 lines
      const lines = content.split('\n').slice(0, 30);
      
      // Priority 1: Look for **Version** line (most reliable)
      const versionLine = lines.find(line => line.includes('**Version**') && line.includes('Phase E'));
      if (versionLine) {
        if (versionLine.includes('E2.')) {
          return 'stabilization';
        }
        if (versionLine.includes('E1.')) {
          return 'exploration';
        }
        if (versionLine.includes('E3.')) {
          return 'production';
        }
      }
      
      // Priority 2: Look for Status/Phase lines
      const statusLine = lines.find(line => line.includes('Status') || line.includes('Phase'));
      
      if (!statusLine) {
        return 'unknown';
      }

      // Match patterns like "Phase E2.3" or "Status: ✅ STABLE"
      if (statusLine.includes('E1') || statusLine.includes('Phase 1')) {
        return 'exploration';
      }
      if (statusLine.includes('E2') || statusLine.includes('Phase 2')) {
        return 'stabilization';
      }
      if (statusLine.includes('E3') || statusLine.includes('Phase 3')) {
        return 'production';
      }

      return 'unknown';
    } catch (error) {
      return 'unknown';
    }
  }

  /**
   * Infer phase from metrics (fallback strategy)
   */
  private inferPhaseFromMetrics(indicators: PhaseIndicators): ProjectPhase {
    const { cycleCount, adrCount, patternDiversity, confidenceMean } = indicators;

    // Exploration: Early cycles, low ADRs, high diversity
    if (cycleCount < 50 && adrCount < 5 && patternDiversity > 0.5) {
      return 'exploration';
    }

    // Stabilization: Mid-range cycles, active ADR generation
    if (cycleCount >= 50 && cycleCount < 200 && adrCount >= 5 && confidenceMean > 0.6) {
      return 'stabilization';
    }

    // Production: High cycles, stable patterns, high confidence
    if (cycleCount >= 200 && confidenceMean > 0.75) {
      return 'production';
    }

    // Default: Unknown (ambiguous metrics)
    return 'unknown';
  }
}



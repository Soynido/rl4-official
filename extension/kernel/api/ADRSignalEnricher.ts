/**
 * ADRSignalEnricher — Enrich existing RL4 commits for ADR detection
 * 
 * Phase E4: Auto-detect architectural decisions from commit signals
 * 
 * NO NEW DATA CAPTURE - Uses ONLY existing RL4 assets:
 * - traces/git_commits.jsonl (commit metadata)
 * - traces/file_changes.jsonl (burst detection)
 * - ledger/cycles.jsonl (cognitive activity)
 * 
 * ADR Detection Signals:
 * 1. Commit type (feat/refactor = higher score)
 * 2. Files changed (>5 files = architectural)
 * 3. Lines changed (>100 lines = major)
 * 4. Core files (extension/kernel/** = critical)
 * 5. Cognitive pattern (burst → commit → stability)
 * 
 * Scoring:
 * - ADR score >0.7 = potential ADR
 * - Agent LLM receives enriched data in prompt
 * - Agent validates and creates ADR in ADRs.RL4
 */

import * as fs from 'fs';
import * as path from 'path';

export interface EnrichedCommit {
  // Original git commit data
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  files_changed: string[];
  insertions: number;
  deletions: number;
  intent: {
    type: string;  // feat, fix, refactor, etc.
  };

  // Enriched ADR signals
  totalFiles: number;
  linesChanged: number;
  isCoreFile: boolean;
  cyclesBefore: number;  // Activity 30min before commit
  cyclesAfter: number;   // Activity 30min after commit
  adrScore: number;      // 0-1 scale, >0.7 = potential ADR
  adrReason: string;     // Why this might be an ADR
}

export interface CognitivePattern {
  type: 'burst_commit_stability' | 'refactor_spike' | 'architecture_change';
  confidence: number;
  commit: string;
  message: string;
  interpretation: string;
}

export class ADRSignalEnricher {
  private rl4Path: string;

  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
  }

  /**
   * Enrich commits with ADR detection signals
   */
  async enrichCommits(lookbackHours: number = 24): Promise<EnrichedCommit[]> {
    const commits = await this.loadGitCommits(lookbackHours);
    const fileChanges = await this.loadFileChanges(lookbackHours);
    const cycles = await this.loadCycles(lookbackHours);

    return commits.map(commit => {
      const commitTime = new Date(commit.timestamp);
      
      // Find cycles ±30min around commit
      const window = 30 * 60 * 1000; // 30min in ms
      const cyclesBefore = cycles.filter(c => {
        const t = new Date(c.timestamp);
        return t < commitTime && (commitTime.getTime() - t.getTime()) < window;
      });
      const cyclesAfter = cycles.filter(c => {
        const t = new Date(c.timestamp);
        return t > commitTime && (t.getTime() - commitTime.getTime()) < window;
      });

      // Detect if commit touches core files
      const isCoreFile = commit.files_changed.some((f: string) => 
        f.startsWith('extension/kernel/') || 
        f.startsWith('extension/core/') ||
        f.startsWith('extension/api/')
      );

      // Calculate total lines changed
      const linesChanged = commit.insertions + commit.deletions;

      // Calculate ADR score
      const score = this.calculateADRScore({
        type: commit.intent.type,
        totalFiles: commit.files_changed.length,
        isCoreFile,
        linesChanged,
        cyclesBefore: cyclesBefore.length,
        cyclesAfter: cyclesAfter.length
      });

      // Generate reason
      const reason = this.generateADRReason({
        type: commit.intent.type,
        totalFiles: commit.files_changed.length,
        isCoreFile,
        linesChanged,
        cyclesBefore: cyclesBefore.length,
        cyclesAfter: cyclesAfter.length,
        score
      });

      return {
        hash: commit.hash,
        message: commit.message,
        author: commit.author,
        timestamp: commit.timestamp,
        files_changed: commit.files_changed,
        insertions: commit.insertions,
        deletions: commit.deletions,
        intent: commit.intent,
        totalFiles: commit.files_changed.length,
        linesChanged,
        isCoreFile,
        cyclesBefore: cyclesBefore.length,
        cyclesAfter: cyclesAfter.length,
        adrScore: score,
        adrReason: reason
      };
    });
  }

  /**
   * Detect cognitive patterns (burst → commit → stability)
   */
  async detectCognitivePatterns(lookbackHours: number = 24): Promise<CognitivePattern[]> {
    const fileChanges = await this.loadFileChanges(lookbackHours);
    const commits = await this.loadGitCommits(lookbackHours);

    const patterns: CognitivePattern[] = [];

    for (const commit of commits) {
      const commitTime = new Date(commit.timestamp);
      
      // Look for burst 30min before commit
      const burstBefore = fileChanges.find(fc => {
        const fcTime = new Date(fc.timestamp);
        return fc.metadata?.burst && 
               fcTime < commitTime && 
               (commitTime.getTime() - fcTime.getTime()) < 30 * 60 * 1000;
      });

      // Look for stability (no bursts) 30min after commit
      const burstsAfter = fileChanges.filter(fc => {
        const fcTime = new Date(fc.timestamp);
        return fc.metadata?.burst && 
               fcTime > commitTime && 
               (fcTime.getTime() - commitTime.getTime()) < 30 * 60 * 1000;
      });

      if (burstBefore && burstsAfter.length === 0) {
        patterns.push({
          type: 'burst_commit_stability',
          confidence: 0.8,
          commit: commit.hash,
          message: commit.message,
          interpretation: 'Decision validated: High activity (debugging/refactoring) → Commit → Stability'
        });
      }
    }

    return patterns;
  }

  /**
   * Calculate ADR score (0-1 scale)
   */
  private calculateADRScore(params: {
    type: string;
    totalFiles: number;
    isCoreFile: boolean;
    linesChanged: number;
    cyclesBefore: number;
    cyclesAfter: number;
  }): number {
    let score = 0;

    // Type signals
    if (params.type === 'feat') score += 0.3;
    if (params.type === 'refactor') score += 0.5;
    if (params.type === 'breaking') score += 0.8;

    // File count signals
    if (params.totalFiles >= 5) score += 0.3;
    if (params.totalFiles >= 10) score += 0.5;

    // Core file signal
    if (params.isCoreFile) score += 0.4;

    // Lines changed signal
    if (params.linesChanged > 100) score += 0.2;
    if (params.linesChanged > 500) score += 0.4;

    // Cognitive pattern: High activity before, low after = stability
    if (params.cyclesBefore > 20 && params.cyclesAfter < 10) {
      score += 0.3; // Pattern: Burst → Commit → Stability
    }

    return Math.min(score, 1.0);
  }

  /**
   * Generate ADR reason (why this might be an ADR)
   */
  private generateADRReason(params: {
    type: string;
    totalFiles: number;
    isCoreFile: boolean;
    linesChanged: number;
    cyclesBefore: number;
    cyclesAfter: number;
    score: number;
  }): string {
    const reasons: string[] = [];

    if (params.type === 'feat') reasons.push('New feature');
    if (params.type === 'refactor') reasons.push('Refactoring');
    if (params.totalFiles >= 5) reasons.push(`${params.totalFiles} files changed`);
    if (params.isCoreFile) reasons.push('Core architecture modified');
    if (params.linesChanged > 100) reasons.push(`${params.linesChanged} lines changed`);
    if (params.cyclesBefore > 20 && params.cyclesAfter < 10) {
      reasons.push('Cognitive pattern: burst → commit → stability');
    }

    if (params.score > 0.7) {
      return `⚠️ POTENTIAL ADR: ${reasons.join(', ')}`;
    } else if (params.score > 0.5) {
      return `⚡ Significant change: ${reasons.join(', ')}`;
    } else {
      return reasons.join(', ');
    }
  }

  /**
   * Load git commits from traces/git_commits.jsonl
   */
  private async loadGitCommits(lookbackHours: number): Promise<any[]> {
    const filePath = path.join(this.rl4Path, 'traces', 'git_commits.jsonl');
    
    if (!fs.existsSync(filePath)) return [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

      const commits: any[] = [];

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const eventDate = new Date(event.timestamp);

          if (eventDate >= cutoff) {
            commits.push({
              hash: event.metadata?.commit?.hash || '',
              message: event.metadata?.commit?.message || '',
              author: event.metadata?.commit?.author || '',
              timestamp: event.metadata?.commit?.timestamp || event.timestamp,
              files_changed: event.metadata?.commit?.files_changed || [],
              insertions: event.metadata?.commit?.insertions || 0,
              deletions: event.metadata?.commit?.deletions || 0,
              intent: event.metadata?.intent || { type: 'unknown' }
            });
          }
        } catch {
          // Skip malformed lines
        }
      }

      return commits;
    } catch (error) {
      console.error('[ADRSignalEnricher] Error loading git commits:', error);
      return [];
    }
  }

  /**
   * Load file changes from traces/file_changes.jsonl
   */
  private async loadFileChanges(lookbackHours: number): Promise<any[]> {
    const filePath = path.join(this.rl4Path, 'traces', 'file_changes.jsonl');
    
    if (!fs.existsSync(filePath)) return [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

      const changes: any[] = [];

      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const eventDate = new Date(event.timestamp);

          if (eventDate >= cutoff) {
            changes.push(event);
          }
        } catch {
          // Skip malformed lines
        }
      }

      return changes;
    } catch (error) {
      console.error('[ADRSignalEnricher] Error loading file changes:', error);
      return [];
    }
  }

  /**
   * Load cycles from ledger/cycles.jsonl
   */
  private async loadCycles(lookbackHours: number): Promise<any[]> {
    const filePath = path.join(this.rl4Path, 'ledger', 'cycles.jsonl');
    
    if (!fs.existsSync(filePath)) return [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      const cutoff = new Date(Date.now() - lookbackHours * 60 * 60 * 1000);

      const cycles: any[] = [];

      for (const line of lines) {
        try {
          const cycle = JSON.parse(line);
          const cycleDate = new Date(cycle.timestamp);

          if (cycleDate >= cutoff) {
            cycles.push({
              cycleId: cycle.cycleId,
              timestamp: cycle.timestamp
            });
          }
        } catch {
          // Skip malformed lines
        }
      }

      return cycles;
    } catch (error) {
      console.error('[ADRSignalEnricher] Error loading cycles:', error);
      return [];
    }
  }
}


/**
 * BlindSpotDataLoader — Load RL4 data that fills agent LLM blind spots
 * 
 * Phase E3.3: Load only useful data from .reasoning_rl4/
 * 
 * Agent LLM Blind Spots (without RL4):
 * 1. Timeline - When did each change happen?
 * 2. File patterns - Bursts (debugging), gaps (blockers)
 * 3. Intent history - What was the developer trying to do?
 * 4. System health trends - Performance degradation over time
 * 5. Decision trail - What decisions were made historically?
 * 
 * This module loads ONLY data that fills these gaps.
 * Fake/static data (patterns, forecasts, goals) excluded.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface TimelinePeriod {
  from: Date;
  to: Date;
}

export interface CycleData {
  cycleId: number;
  timestamp: string;
}

export interface FileChangeData {
  timestamp: string;
  files: string[];
  type: 'add' | 'change' | 'delete';
}

export interface BurstAnalysis {
  bursts: Array<{
    file: string;
    editCount: number;
    timespan: string; // e.g. "2 min"
    startTime: string;
    endTime: string;
    inference: string; // "Likely debugging" or "Rapid iteration"
  }>;
  gaps: Array<{
    duration: string; // e.g. "1h 05min"
    startTime: string;
    endTime: string;
    inference: string; // "Break" or "Potential blocker"
  }>;
}

export interface CommitData {
  hash: string;
  message: string;
  author: string;
  timestamp: string;
  filesChanged: number;
  insertions?: number;
  deletions?: number;
  intent?: string; // feat, fix, refactor, etc.
}

export interface HealthTrend {
  timestamp: string;
  memoryMB: number;
  eventLoopLagP50: number;
  activeTimers: number;
  queueSize: number;
  uptime: number;
}

export interface ADRData {
  id: string;
  title: string;
  decision: string;
  status: string;
  timestamp: string;
}

export class BlindSpotDataLoader {
  private basePath: string;

  constructor(rl4Path: string) {
    this.basePath = rl4Path;
  }

  /**
   * Load timeline (cycle timestamps) for a period
   * Blind Spot: Agent doesn't know WHEN things happened
   */
  loadTimeline(period: TimelinePeriod): CycleData[] {
    const cyclesPath = path.join(this.basePath, 'ledger', 'cycles.jsonl');
    if (!fs.existsSync(cyclesPath)) return [];

    try {
      const content = fs.readFileSync(cyclesPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const cycles: CycleData[] = [];
      
      for (const line of lines) {
        try {
          const cycle = JSON.parse(line);
          const cycleDate = new Date(cycle.timestamp);
          
          if (cycleDate >= period.from && cycleDate <= period.to) {
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
      console.error('[BlindSpotDataLoader] Error loading timeline:', error);
      return [];
    }
  }

  /**
   * Load file change patterns with burst/gap analysis
   * Blind Spot: Agent doesn't see editing patterns (bursts = debugging, gaps = blockers)
   */
  loadFilePatterns(period: TimelinePeriod): BurstAnalysis {
    const filePath = path.join(this.basePath, 'traces', 'file_changes.jsonl');
    if (!fs.existsSync(filePath)) {
      return { bursts: [], gaps: [] };
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const changes: Array<{ timestamp: Date; files: string[] }> = [];
      
      for (const line of lines) {
        try {
          const event = JSON.parse(line);
          const eventDate = new Date(event.timestamp);
          
          if (eventDate >= period.from && eventDate <= period.to) {
            const files = event.metadata?.changes?.map((c: any) => c.path) || [];
            changes.push({ timestamp: eventDate, files });
          }
        } catch {
          // Skip malformed lines
        }
      }

      // Analyze bursts and gaps
      return this.analyzeBurstsAndGaps(changes);
    } catch (error) {
      console.error('[BlindSpotDataLoader] Error loading file patterns:', error);
      return { bursts: [], gaps: [] };
    }
  }

  /**
   * Analyze bursts (rapid edits) and gaps (breaks/blockers)
   */
  private analyzeBurstsAndGaps(changes: Array<{ timestamp: Date; files: string[] }>): BurstAnalysis {
    const bursts: BurstAnalysis['bursts'] = [];
    const gaps: BurstAnalysis['gaps'] = [];

    if (changes.length < 2) return { bursts, gaps };

    // Sort chronologically
    changes.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Detect bursts (>5 edits to same file in <5 min)
    const fileEditMap: Map<string, Array<{ timestamp: Date; index: number }>> = new Map();
    
    changes.forEach((change, idx) => {
      change.files.forEach(file => {
        if (!fileEditMap.has(file)) {
          fileEditMap.set(file, []);
        }
        fileEditMap.get(file)!.push({ timestamp: change.timestamp, index: idx });
      });
    });

    // Find bursts
    for (const [file, edits] of fileEditMap.entries()) {
      if (edits.length < 5) continue;

      // Check for 5+ edits within 5 minutes
      for (let i = 0; i < edits.length - 4; i++) {
        const windowStart = edits[i].timestamp;
        const windowEnd = edits[i + 4].timestamp;
        const timespanMs = windowEnd.getTime() - windowStart.getTime();
        const timespanMin = Math.round(timespanMs / 60000);

        if (timespanMin <= 5) {
          bursts.push({
            file,
            editCount: 5 + (edits.length - i - 5), // Could be more than 5
            timespan: `${timespanMin} min`,
            startTime: windowStart.toLocaleTimeString(),
            endTime: windowEnd.toLocaleTimeString(),
            inference: timespanMin < 2 ? 'Likely debugging (syntax errors, type issues)' : 'Rapid iteration (feature refinement)'
          });
          break; // Only report first burst per file
        }
      }
    }

    // Detect gaps (>30 min between consecutive edits)
    for (let i = 0; i < changes.length - 1; i++) {
      const gapMs = changes[i + 1].timestamp.getTime() - changes[i].timestamp.getTime();
      const gapMin = Math.round(gapMs / 60000);

      if (gapMin > 30) {
        const gapHours = Math.floor(gapMin / 60);
        const gapMinRemainder = gapMin % 60;
        const durationStr = gapHours > 0 ? `${gapHours}h ${gapMinRemainder}min` : `${gapMin}min`;

        gaps.push({
          duration: durationStr,
          startTime: changes[i].timestamp.toLocaleTimeString(),
          endTime: changes[i + 1].timestamp.toLocaleTimeString(),
          inference: gapMin > 120 ? 'Break or context switch' : 'Potential blocker or meeting'
        });
      }
    }

    return { bursts, gaps };
  }

  /**
   * Load git commit history
   * Blind Spot: Agent doesn't see commit messages (intent history)
   */
  loadGitHistory(limit: number = 10): CommitData[] {
    const commitsPath = path.join(this.basePath, 'traces', 'git_commits.jsonl');
    if (!fs.existsSync(commitsPath)) return [];

    try {
      const content = fs.readFileSync(commitsPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const commits: CommitData[] = [];
      
      // Get last N commits
      for (const line of lines.slice(-limit)) {
        try {
          const event = JSON.parse(line);
          const commit = event.metadata?.commit;
          
          if (commit) {
            commits.push({
              hash: commit.hash?.substring(0, 7) || 'unknown',
              message: commit.message?.split('\n')[0] || 'No message',
              author: commit.author || 'Unknown',
              timestamp: commit.timestamp || event.timestamp,
              filesChanged: commit.files_changed?.length || 0,
              insertions: commit.insertions,
              deletions: commit.deletions,
              intent: event.metadata?.intent?.type
            });
          }
        } catch {
          // Skip malformed lines
        }
      }

      return commits.reverse(); // Most recent first
    } catch (error) {
      console.error('[BlindSpotDataLoader] Error loading git history:', error);
      return [];
    }
  }

  /**
   * Load system health trends over a period
   * Blind Spot: Agent doesn't see performance degradation over time
   */
  loadHealthTrends(period: TimelinePeriod): HealthTrend[] {
    const healthPath = path.join(this.basePath, 'diagnostics', 'health.jsonl');
    if (!fs.existsSync(healthPath)) return [];

    try {
      const content = fs.readFileSync(healthPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const trends: HealthTrend[] = [];
      
      // Sample health metrics (every 100th line to avoid too much data)
      const sampledLines = lines.filter((_, idx) => idx % 100 === 0 || idx === lines.length - 1);
      
      for (const line of sampledLines) {
        try {
          const health = JSON.parse(line);
          const healthDate = new Date(health._timestamp || health.timestamp);
          
          if (healthDate >= period.from && healthDate <= period.to) {
            trends.push({
              timestamp: health._timestamp || health.timestamp,
              memoryMB: Math.round(health.metrics?.memoryMB || 0),
              eventLoopLagP50: health.metrics?.eventLoopLag?.p50 || 0,
              activeTimers: health.metrics?.activeTimers || 0,
              queueSize: health.metrics?.queueSize || 0,
              uptime: health.metrics?.uptime || 0
            });
          }
        } catch {
          // Skip malformed lines
        }
      }

      return trends;
    } catch (error) {
      console.error('[BlindSpotDataLoader] Error loading health trends:', error);
      return [];
    }
  }

  /**
   * Load ADRs from ledger
   * Blind Spot: Agent doesn't see decision history across sessions
   */
  loadADRs(limit: number = 5): ADRData[] {
    const adrsPath = path.join(this.basePath, 'ledger', 'adrs.jsonl');
    if (!fs.existsSync(adrsPath)) return [];

    try {
      const content = fs.readFileSync(adrsPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const adrs: ADRData[] = [];
      
      // Get last N ADRs
      for (const line of lines.slice(-limit)) {
        try {
          const adr = JSON.parse(line);
          adrs.push({
            id: adr.id,
            title: adr.title,
            decision: adr.decision,
            status: adr.status,
            timestamp: adr.timestamp || adr.date
          });
        } catch {
          // Skip malformed lines
        }
      }

      return adrs.reverse(); // Most recent first
    } catch (error) {
      console.error('[BlindSpotDataLoader] Error loading ADRs:', error);
      return [];
    }
  }

  /**
   * Get summary statistics for blind spot data
   */
  getSummaryStats(period: TimelinePeriod): {
    totalCycles: number;
    totalFileChanges: number;
    totalCommits: number;
    avgMemoryMB: number;
    avgEventLoopLag: number;
  } {
    const timeline = this.loadTimeline(period);
    const patterns = this.loadFilePatterns(period);
    const commits = this.loadGitHistory();
    const healthTrends = this.loadHealthTrends(period);

    const totalFileChanges = patterns.bursts.reduce((sum, b) => sum + b.editCount, 0) + patterns.gaps.length;

    const avgMemoryMB = healthTrends.length > 0
      ? Math.round(healthTrends.reduce((sum, h) => sum + h.memoryMB, 0) / healthTrends.length)
      : 0;

    const avgEventLoopLag = healthTrends.length > 0
      ? healthTrends.reduce((sum, h) => sum + h.eventLoopLagP50, 0) / healthTrends.length
      : 0;

    return {
      totalCycles: timeline.length,
      totalFileChanges,
      totalCommits: commits.length,
      avgMemoryMB,
      avgEventLoopLag
    };
  }
}


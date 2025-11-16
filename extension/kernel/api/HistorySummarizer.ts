/**
 * HistorySummarizer — Compress entire RL4 history into JSON stats
 * 
 * Phase E3.3 Optimization: Load 30 days of history in <2KB
 * 
 * Uses existing Kernel compression:
 * - TimelineAggregator (daily summaries)
 * - SnapshotRotation (100-cycle snapshots)
 * - StateReconstructor (time-travel queries)
 * 
 * Output: JSON-formatted statistical summary for LLM consumption
 * 
 * Replaces: Loading raw JSONL cycles (slow, verbose)
 * With: Pre-aggregated stats from Kernel (fast, compact)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface HistorySummary {
  // Temporal scope
  total_cycles: number;
  timespan: string; // "YYYY-MM-DD → YYYY-MM-DD"
  first_cycle: string;
  last_cycle: string;

  // Activity distribution
  activity_distribution: {
    by_day_of_week: Record<string, number>; // % per weekday
    by_hour: Record<string, number>; // % per hour bucket
    busiest_day: string;
    quietest_day: string;
  };

  // Cognitive evolution (trends over time)
  cognitive_evolution: {
    patterns_detected: Record<string, number>; // week_N: count
    forecasts_generated: Record<string, number>;
    adrs_created: Record<string, number>;
    correlation_strength_avg: Record<string, number>; // week_N: avg strength
  };

  // System health trends
  health_trends: {
    memory: {
      min: number;
      max: number;
      avg: number;
      trend: 'increasing' | 'decreasing' | 'stable';
    };
    event_loop_p95: {
      min: number;
      max: number;
      avg: number;
      trend: 'increasing' | 'decreasing' | 'stable'; // Note: "decreasing" is better for event loop
    };
  };

  // Git activity
  git_activity: {
    total_commits: number;
    commit_types: Record<string, number>; // feat/fix/refactor counts
    avg_commits_per_day: number;
    most_active_files: Array<{ file: string; commits: number }>;
  };

  // File patterns
  file_patterns: {
    hotspots: Array<{ file: string; edits: number; burst_count: number }>;
    burst_events: number; // Rapid iterations detected
    gap_events: number; // Inactivity periods
    avg_session_duration: number; // minutes
  };
}

export class HistorySummarizer {
  private rl4Path: string;

  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
  }

  /**
   * Generate compressed historical summary
   * Uses TimelineAggregator + cycles.jsonl
   */
  async summarize(daysBack: number = 30): Promise<HistorySummary> {
    const timelinesPath = path.join(this.rl4Path, 'timelines');
    const cyclesPath = path.join(this.rl4Path, 'ledger', 'cycles.jsonl');

    // Load all timeline files (aggregated by day)
    const timelines = await this.loadTimelines(timelinesPath, daysBack);

    // Load cycles for detailed stats
    const cycles = await this.loadRecentCycles(cyclesPath, 1000);

    return {
      total_cycles: this.calculateTotalCycles(timelines),
      timespan: this.calculateTimespan(timelines),
      first_cycle: cycles[0]?.timestamp || 'N/A',
      last_cycle: cycles[cycles.length - 1]?.timestamp || 'N/A',

      activity_distribution: this.calculateActivityDistribution(timelines),
      cognitive_evolution: this.calculateCognitiveEvolution(timelines),
      health_trends: this.calculateHealthTrends(cycles),
      git_activity: this.calculateGitActivity(cycles),
      file_patterns: this.calculateFilePatterns(cycles)
    };
  }

  /**
   * Load daily timeline files
   */
  private async loadTimelines(timelinesPath: string, daysBack: number): Promise<any[]> {
    if (!fs.existsSync(timelinesPath)) {
      return [];
    }

    const files = fs.readdirSync(timelinesPath)
      .filter(f => f.endsWith('.json'))
      .sort()
      .slice(-daysBack);

    return files.map(f => {
      const content = fs.readFileSync(path.join(timelinesPath, f), 'utf8');
      return JSON.parse(content);
    });
  }

  /**
   * Load recent cycles from JSONL
   */
  private async loadRecentCycles(cyclesPath: string, limit: number): Promise<any[]> {
    if (!fs.existsSync(cyclesPath)) {
      return [];
    }

    // Filter out Git conflict markers
    const isGitConflictMarker = (line: string): boolean => {
      const trimmed = line.trim();
      return trimmed.startsWith('<<<<<<<') || 
             trimmed.startsWith('=======') || 
             trimmed.startsWith('>>>>>>>') ||
             trimmed.includes('<<<<<<< Updated upstream') ||
             trimmed.includes('>>>>>>> Stashed changes');
    };

    const content = fs.readFileSync(cyclesPath, 'utf8');
    const lines = content.trim().split('\n').slice(-limit);
    
    return lines
      .filter(line => !isGitConflictMarker(line)) // Remove Git conflict markers
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          // Skip invalid lines (but don't warn for Git conflict markers as they're already filtered)
          return null;
        }
      })
      .filter((cycle): cycle is any => cycle !== null); // Remove null entries
  }

  /**
   * Calculate total cycles across all timelines
   */
  private calculateTotalCycles(timelines: any[]): number {
    return timelines.reduce((sum, t) => sum + (t.total_cycles || 0), 0);
  }

  /**
   * Calculate timespan (first → last date)
   */
  private calculateTimespan(timelines: any[]): string {
    if (timelines.length === 0) return 'N/A';
    const first = timelines[0].date;
    const last = timelines[timelines.length - 1].date;
    return `${first} → ${last}`;
  }

  /**
   * Calculate activity distribution (by day of week, by hour)
   */
  private calculateActivityDistribution(timelines: any[]): HistorySummary['activity_distribution'] {
    const dayOfWeekCounts: Record<string, number> = {};
    const hourCounts: Record<string, number> = {};
    let maxCycles = 0;
    let busiestDay = '';
    let quietestDay = '';
    let minCycles = Infinity;

    const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

    for (const timeline of timelines) {
      const date = new Date(timeline.date);
      const dayName = days[date.getDay()];
      dayOfWeekCounts[dayName] = (dayOfWeekCounts[dayName] || 0) + timeline.total_cycles;

      if (timeline.total_cycles > maxCycles) {
        maxCycles = timeline.total_cycles;
        busiestDay = timeline.date;
      }
      if (timeline.total_cycles < minCycles) {
        minCycles = timeline.total_cycles;
        quietestDay = timeline.date;
      }

      // Aggregate hourly data
      for (const hour of timeline.hours || []) {
        const bucket = this.getHourBucket(hour.hour);
        hourCounts[bucket] = (hourCounts[bucket] || 0) + hour.cycles;
      }
    }

    // Normalize to percentages
    const totalCycles = Object.values(dayOfWeekCounts).reduce((a, b) => a + b, 0);
    const dayOfWeekPct: Record<string, number> = {};
    for (const [day, count] of Object.entries(dayOfWeekCounts)) {
      dayOfWeekPct[day] = totalCycles > 0 ? Math.round((count / totalCycles) * 100) / 100 : 0;
    }

    const totalHourCycles = Object.values(hourCounts).reduce((a, b) => a + b, 0);
    const hourPct: Record<string, number> = {};
    for (const [bucket, count] of Object.entries(hourCounts)) {
      hourPct[bucket] = totalHourCycles > 0 ? Math.round((count / totalHourCycles) * 100) / 100 : 0;
    }

    return {
      by_day_of_week: dayOfWeekPct,
      by_hour: hourPct,
      busiest_day: busiestDay,
      quietest_day: quietestDay
    };
  }

  /**
   * Get hour bucket (morning, afternoon, evening, night)
   */
  private getHourBucket(hour: number): string {
    if (hour >= 6 && hour < 12) return 'morning (6h-12h)';
    if (hour >= 12 && hour < 18) return 'afternoon (12h-18h)';
    if (hour >= 18 && hour < 24) return 'evening (18h-24h)';
    return 'night (0h-6h)';
  }

  /**
   * Calculate cognitive evolution (patterns, forecasts, ADRs over time)
   */
  private calculateCognitiveEvolution(timelines: any[]): HistorySummary['cognitive_evolution'] {
    const weeksData: Record<string, { patterns: number; forecasts: number; adrs: number; correlations: number }> = {};

    for (let i = 0; i < timelines.length; i++) {
      const weekNum = Math.floor(i / 7) + 1;
      const weekKey = `week_${weekNum}`;

      if (!weeksData[weekKey]) {
        weeksData[weekKey] = { patterns: 0, forecasts: 0, adrs: 0, correlations: 0 };
      }

      // Aggregate cognitive metrics (assuming timelines have these fields)
      const timeline = timelines[i];
      weeksData[weekKey].patterns += timeline.patterns_detected || 0;
      weeksData[weekKey].forecasts += timeline.forecasts_generated || 0;
      weeksData[weekKey].adrs += timeline.adrs_created || 0;
      weeksData[weekKey].correlations += timeline.correlations_found || 0;
    }

    const patterns_detected: Record<string, number> = {};
    const forecasts_generated: Record<string, number> = {};
    const adrs_created: Record<string, number> = {};
    const correlation_strength_avg: Record<string, number> = {};

    for (const [week, data] of Object.entries(weeksData)) {
      patterns_detected[week] = data.patterns;
      forecasts_generated[week] = data.forecasts;
      adrs_created[week] = data.adrs;
      correlation_strength_avg[week] = data.correlations > 0 ? Math.round((data.correlations / data.patterns) * 100) / 100 : 0;
    }

    return {
      patterns_detected,
      forecasts_generated,
      adrs_created,
      correlation_strength_avg
    };
  }

  /**
   * Calculate health trends (memory, event loop)
   */
  private calculateHealthTrends(cycles: any[]): HistorySummary['health_trends'] {
    const memoryValues: number[] = [];
    const eventLoopValues: number[] = [];

    for (const cycle of cycles) {
      if (cycle.health?.memoryMB) memoryValues.push(cycle.health.memoryMB);
      if (cycle.health?.eventLoopP95) eventLoopValues.push(cycle.health.eventLoopP95);
    }

    const memoryTrend = this.detectTrend(memoryValues, false);
    const eventLoopTrend = this.detectTrend(eventLoopValues, true); // inverted (lower is better)

    return {
      memory: {
        min: Math.min(...memoryValues),
        max: Math.max(...memoryValues),
        avg: Math.round(memoryValues.reduce((a, b) => a + b, 0) / memoryValues.length),
        trend: memoryTrend
      },
      event_loop_p95: {
        min: Math.min(...eventLoopValues),
        max: Math.max(...eventLoopValues),
        avg: Math.round((eventLoopValues.reduce((a, b) => a + b, 0) / eventLoopValues.length) * 100) / 100,
        trend: eventLoopTrend
      }
    };
  }

  /**
   * Detect trend in time series (increasing, decreasing, stable)
   * @param inverted - For metrics where lower is better (e.g. event loop lag)
   */
  private detectTrend(values: number[], inverted: boolean = false): 'increasing' | 'decreasing' | 'stable' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const avgFirst = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

    const diff = avgSecond - avgFirst;
    const threshold = avgFirst * 0.1; // 10% change threshold

    if (inverted) {
      // For event loop: decreasing = good, increasing = bad
      if (diff < -threshold) return 'decreasing'; // improving
      if (diff > threshold) return 'increasing'; // degrading
      return 'stable';
    }

    if (diff > threshold) return 'increasing';
    if (diff < -threshold) return 'decreasing';
    return 'stable';
  }

  /**
   * Calculate git activity
   */
  private calculateGitActivity(cycles: any[]): HistorySummary['git_activity'] {
    const commitTypes: Record<string, number> = {};
    const fileCommitCounts: Record<string, number> = {};
    let totalCommits = 0;

    for (const cycle of cycles) {
      if (cycle.git_commits) {
        for (const commit of cycle.git_commits) {
          totalCommits++;
          const type = this.extractCommitType(commit.message);
          commitTypes[type] = (commitTypes[type] || 0) + 1;

          for (const file of commit.files || []) {
            fileCommitCounts[file] = (fileCommitCounts[file] || 0) + 1;
          }
        }
      }
    }

    const mostActiveFiles = Object.entries(fileCommitCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([file, commits]) => ({ file, commits }));

    const uniqueDays = new Set(cycles.map(c => c.timestamp?.split('T')[0])).size;

    return {
      total_commits: totalCommits,
      commit_types: commitTypes,
      avg_commits_per_day: uniqueDays > 0 ? Math.round((totalCommits / uniqueDays) * 10) / 10 : 0,
      most_active_files: mostActiveFiles
    };
  }

  /**
   * Extract commit type from message (feat, fix, refactor, etc.)
   */
  private extractCommitType(message: string): string {
    const match = message.match(/^(feat|fix|refactor|chore|docs|test|style|perf|ci|build):/i);
    return match ? match[1].toLowerCase() : 'other';
  }

  /**
   * Calculate file patterns (hotspots, bursts, gaps)
   */
  private calculateFilePatterns(cycles: any[]): HistorySummary['file_patterns'] {
    const fileEditCounts: Record<string, number> = {};
    const fileBurstCounts: Record<string, number> = {};
    let totalBursts = 0;
    let totalGaps = 0;
    let totalSessionDuration = 0;

    for (const cycle of cycles) {
      if (cycle.file_changes) {
        for (const change of cycle.file_changes) {
          fileEditCounts[change.file] = (fileEditCounts[change.file] || 0) + 1;
          if (change.burst) {
            fileBurstCounts[change.file] = (fileBurstCounts[change.file] || 0) + 1;
            totalBursts++;
          }
          if (change.gap) {
            totalGaps++;
          }
        }
      }
      if (cycle.session_duration_sec) {
        totalSessionDuration += cycle.session_duration_sec;
      }
    }

    const hotspots = Object.entries(fileEditCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([file, edits]) => ({
        file,
        edits,
        burst_count: fileBurstCounts[file] || 0
      }));

    return {
      hotspots,
      burst_events: totalBursts,
      gap_events: totalGaps,
      avg_session_duration: cycles.length > 0 ? Math.round((totalSessionDuration / cycles.length) / 60) : 0
    };
  }
}


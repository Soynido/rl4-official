/**
 * PromptBridge — Manual Cognitive Bridge
 * 
 * Core module for generating structured prompts with raw RL4 data.
 * RL4 collects and structures data. Agent LLM reasons about it. Human validates.
 * 
 * Responsibilities:
 * - Load raw data from RL4 data sources (cycles, traces, health, timelines)
 * - Generate 4 types of prompts: Now, Before, Next, Restore
 * - Format as copyable Markdown for agent consumption
 * 
 * Philosophy:
 * RL4 does NOT reason. It provides perfect structured context.
 * The reasoning happens in the LLM agent (Claude, Cursor, etc.).
 */

import * as fs from 'fs';
import * as path from 'path';

// Types for raw RL4 data
export interface RawCycle {
  cycleId: number;
  timestamp: string;
  phases?: any;
  merkleRoot?: string;
  _timestamp: string;
}

export interface RawFileChange {
  id: string;
  type: 'file_change';
  timestamp: string;
  metadata: {
    changes: Array<{
      type: string;
      path: string;
      extension?: string;
      size?: number;
    }>;
    file_count?: number;
  };
}

export interface RawGitCommit {
  id: string;
  type: 'git_commit';
  timestamp: string;
  metadata: {
    commit: {
      hash: string;
      message: string;
      author: string;
      timestamp: string;
      files_changed?: string[];
      insertions?: number;
      deletions?: number;
    };
    intent?: {
      type: string;
      keywords?: string[];
    };
  };
}

export interface RawHealth {
  type: 'health_check';
  metrics: {
    memoryMB: number;
    activeTimers: number;
    queueSize: number;
    eventLoopLag: {
      p50: number;
      p90: number;
      p95: number;
      p99: number;
    };
    uptime: number;
    lastCheck: string;
  };
  alerts: any[];
  _timestamp: string;
}

export interface TimelinePeriod {
  from: Date;
  to: Date;
}

/**
 * PromptBridge - Generate structured prompts from raw RL4 data
 */
export class PromptBridge {
  private basePath: string;

  constructor(basePath: string) {
    this.basePath = basePath;
  }

  // ============================================================================
  // Data Loading Methods
  // ============================================================================

  /**
   * Load cycles from JSONL within a time period
   */
  private loadCycles(period?: TimelinePeriod): RawCycle[] {
    const cyclesPath = path.join(this.basePath, 'ledger', 'cycles.jsonl');
    if (!fs.existsSync(cyclesPath)) return [];

    try {
      const content = fs.readFileSync(cyclesPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const cycles = lines.map(line => JSON.parse(line) as RawCycle);

      if (!period) return cycles;

      // Filter by timestamp
      return cycles.filter(cycle => {
        const cycleDate = new Date(cycle.timestamp);
        return cycleDate >= period.from && cycleDate <= period.to;
      });
    } catch (error) {
      console.error('[PromptBridge] Error loading cycles:', error);
      return [];
    }
  }

  /**
   * Load file changes from JSONL within a time period
   */
  private loadFileChanges(period?: TimelinePeriod): RawFileChange[] {
    const filePath = path.join(this.basePath, 'traces', 'file_changes.jsonl');
    if (!fs.existsSync(filePath)) return [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const changes = lines.map(line => JSON.parse(line) as RawFileChange);

      if (!period) return changes;

      return changes.filter(change => {
        const changeDate = new Date(change.timestamp);
        return changeDate >= period.from && changeDate <= period.to;
      });
    } catch (error) {
      console.error('[PromptBridge] Error loading file changes:', error);
      return [];
    }
  }

  /**
   * Load git commits from JSONL within a time period
   */
  private loadGitCommits(period?: TimelinePeriod): RawGitCommit[] {
    const filePath = path.join(this.basePath, 'traces', 'git_commits.jsonl');
    if (!fs.existsSync(filePath)) return [];

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      const commits = lines.map(line => JSON.parse(line) as RawGitCommit);

      if (!period) return commits;

      return commits.filter(commit => {
        const commitDate = new Date(commit.timestamp);
        return commitDate >= period.from && commitDate <= period.to;
      });
    } catch (error) {
      console.error('[PromptBridge] Error loading git commits:', error);
      return [];
    }
  }

  /**
   * Load latest health metrics
   */
  private loadLatestHealth(): RawHealth | null {
    const healthPath = path.join(this.basePath, 'diagnostics', 'health.jsonl');
    if (!fs.existsSync(healthPath)) return null;

    try {
      const content = fs.readFileSync(healthPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      if (lines.length === 0) return null;

      // Get last line (most recent)
      return JSON.parse(lines[lines.length - 1]) as RawHealth;
    } catch (error) {
      console.error('[PromptBridge] Error loading health:', error);
      return null;
    }
  }

  /**
   * Load current context snapshot
   */
  private loadContext(): any {
    const contextPath = path.join(this.basePath, 'context.json');
    if (!fs.existsSync(contextPath)) return null;

    try {
      const content = fs.readFileSync(contextPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[PromptBridge] Error loading context:', error);
      return null;
    }
  }

  /**
   * Load phase from TASKS_RL4.md (Phase E3.2 - Fix phase detection)
   */
  private loadPhase(): { phase: string; goal: string } {
    const tasksPath = path.join(path.dirname(this.basePath), 'TASKS_RL4.md');
    
    try {
      if (!fs.existsSync(tasksPath)) {
        return { phase: 'unknown', goal: '' };
      }

      const content = fs.readFileSync(tasksPath, 'utf8');
      const lines = content.split('\n');

      // Look for "**Current** : Phase EX.Y" or "**Version** : ... Phase EX.Y"
      for (const line of lines.slice(0, 100)) {  // Check first 100 lines
        if (line.includes('**Current**') || line.includes('**Version**')) {
          // Extract phase: E1. = exploration, E2. = stabilization, E3. = production
          if (line.match(/E3\./)) {
            const goalMatch = line.match(/—\s*(.+?)(?:\s*→|$)/);
            return { 
              phase: 'production', 
              goal: goalMatch ? goalMatch[1].trim() : 'Production phase'
            };
          } else if (line.match(/E2\./)) {
            const goalMatch = line.match(/—\s*(.+?)(?:\s*→|$)/);
            return { 
              phase: 'stabilization', 
              goal: goalMatch ? goalMatch[1].trim() : 'Stabilization phase'
            };
          } else if (line.match(/E1\./)) {
            const goalMatch = line.match(/—\s*(.+?)(?:\s*→|$)/);
            return { 
              phase: 'exploration', 
              goal: goalMatch ? goalMatch[1].trim() : 'Exploration phase'
            };
          }
        }
      }

      return { phase: 'unknown', goal: '' };
    } catch (error) {
      console.error('[PromptBridge] Error loading phase:', error);
      return { phase: 'unknown', goal: '' };
    }
  }

  /**
   * Load patterns from patterns.json
   */
  private loadPatterns(): any[] {
    const patternsPath = path.join(this.basePath, 'patterns.json');
    if (!fs.existsSync(patternsPath)) return [];

    try {
      const content = fs.readFileSync(patternsPath, 'utf8');
      const data = JSON.parse(content);
      
      // Handle both array and object format
      const patterns = Array.isArray(data) ? data : (data.patterns || []);
      return patterns.slice(0, 8); // Top 8 by confidence
    } catch (error) {
      console.error('[PromptBridge] Error loading patterns:', error);
      return [];
    }
  }

  /**
   * Load forecasts from forecasts.json
   */
  private loadForecasts(): any[] {
    const forecastsPath = path.join(this.basePath, 'forecasts.json');
    if (!fs.existsSync(forecastsPath)) return [];

    try {
      const content = fs.readFileSync(forecastsPath, 'utf8');
      const data = JSON.parse(content);
      
      // Handle both array and object format
      const forecasts = Array.isArray(data) ? data : (data.forecasts || []);
      return forecasts.slice(0, 8); // Top 8 by confidence
    } catch (error) {
      console.error('[PromptBridge] Error loading forecasts:', error);
      return [];
    }
  }

  /**
   * Load ADRs from ledger/adrs.jsonl
   */
  private loadADRs(limit: number = 5): any[] {
    const adrsPath = path.join(this.basePath, 'ledger', 'adrs.jsonl');
    if (!fs.existsSync(adrsPath)) return [];

    try {
      const content = fs.readFileSync(adrsPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      // Get last N ADRs
      const adrs = lines.slice(-limit).map(line => JSON.parse(line));
      return adrs.reverse(); // Most recent first
    } catch (error) {
      console.error('[PromptBridge] Error loading ADRs:', error);
      return [];
    }
  }

  /**
   * Load goals from goals.json
   */
  private loadGoals(): any[] {
    const goalsPath = path.join(this.basePath, 'goals.json');
    if (!fs.existsSync(goalsPath)) return [];

    try {
      const content = fs.readFileSync(goalsPath, 'utf8');
      const data = JSON.parse(content);
      return data.goals || data || [];
    } catch (error) {
      console.error('[PromptBridge] Error loading goals:', error);
      return [];
    }
  }

  /**
   * Load correlations from correlations.json
   */
  private loadCorrelations(limit: number = 5): any[] {
    const correlationsPath = path.join(this.basePath, 'correlations.json');
    if (!fs.existsSync(correlationsPath)) return [];

    try {
      const content = fs.readFileSync(correlationsPath, 'utf8');
      const data = JSON.parse(content);
      const correlations = Array.isArray(data) ? data : (data.correlations || []);
      
      // Sort by score/strength and return top N
      return correlations
        .sort((a: any, b: any) => (b.score || b.strength || 0) - (a.score || a.strength || 0))
        .slice(0, limit);
    } catch (error) {
      console.error('[PromptBridge] Error loading correlations:', error);
      return [];
    }
  }

  /**
   * Load integrity metrics from diagnostics
   */
  private loadIntegrityMetrics(): any {
    const integrityPath = path.join(this.basePath, 'diagnostics', 'integrity.jsonl');
    if (!fs.existsSync(integrityPath)) {
      return {
        cycleCoherence: 0,
        patternDrift: 0,
        forecastAccuracy: 0,
        overallHealth: 0
      };
    }

    try {
      const content = fs.readFileSync(integrityPath, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      
      if (lines.length === 0) return {
        cycleCoherence: 0,
        patternDrift: 0,
        forecastAccuracy: 0,
        overallHealth: 0
      };

      // Get last line (most recent)
      return JSON.parse(lines[lines.length - 1]);
    } catch (error) {
      console.error('[PromptBridge] Error loading integrity metrics:', error);
      return {
        cycleCoherence: 0,
        patternDrift: 0,
        forecastAccuracy: 0,
        overallHealth: 0
      };
    }
  }

  // ============================================================================
  // Prompt Formatting Methods
  // ============================================================================

  /**
   * Generate "Now" prompt — Current snapshot (last 1-2 hours)
   * Phase E3.2: Enhanced with complete cognitive context
   */
  public formatNowPrompt(): string {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const period: TimelinePeriod = { from: twoHoursAgo, to: now };

    // Load all data sources
    const cycles = this.loadCycles(period);
    const fileChanges = this.loadFileChanges(period);
    const commits = this.loadGitCommits(period);
    const health = this.loadLatestHealth();
    const context = this.loadContext();
    const phaseInfo = this.loadPhase();
    const patterns = this.loadPatterns();
    const forecasts = this.loadForecasts();
    const adrs = this.loadADRs(5);
    const goals = this.loadGoals();
    const correlations = this.loadCorrelations(5);
    const integrity = this.loadIntegrityMetrics();

    // Build enriched prompt
    let prompt = `# 🧠 NOW — Complete Cognitive Context v2.0\n\n`;
    
    // Period
    prompt += `## 📅 Period\n`;
    prompt += `- From: ${twoHoursAgo.toISOString().replace('T', ' ').split('.')[0]}\n`;
    prompt += `- To: ${now.toISOString().replace('T', ' ').split('.')[0]}\n`;
    prompt += `- Duration: 2 hours\n`;
    prompt += `- Cycles: ${cycles.length}\n\n`;

    // Phase & Current Context
    prompt += `## 🎯 Current Phase\n`;
    prompt += `- Phase: ${phaseInfo.phase}${phaseInfo.phase !== 'unknown' ? ` (${phaseInfo.phase === 'exploration' ? 'E1' : phaseInfo.phase === 'stabilization' ? 'E2' : 'E3'})` : ''}\n`;
    if (phaseInfo.goal) {
      prompt += `- Goal: "${phaseInfo.goal}"\n`;
    }
    if (context) {
      prompt += `- Cycle: ${context.current_cycle || 'unknown'}\n`;
      prompt += `- Intent: ${context.intent || 'unknown'}\n`;
      if (context.files && context.files.length > 0) {
        prompt += `- Active Files: ${context.files.slice(0, 5).join(', ')}\n`;
      }
    }
    prompt += `\n`;

    // Patterns (RAW DATA)
    prompt += `## 📊 Patterns Detected (${patterns.length})\n`;
    if (patterns.length > 0) {
      patterns.forEach((p: any, idx: number) => {
        const id = p.pattern_id || p.id || `pattern_${idx}`;
        const desc = p.description || p.pattern || 'Unknown pattern';
        const conf = ((p.confidence || 0.5) * 100).toFixed(0);
        const trend = p.trend || 'stable';
        prompt += `${idx + 1}. **${id}** - "${desc}"\n`;
        prompt += `   - Confidence: ${conf}% | Trend: ${trend}\n`;
      });
    } else {
      prompt += `- No patterns detected yet\n`;
    }
    prompt += `\n`;

    // Forecasts (RAW DATA)
    prompt += `## 🔮 Forecasts Generated (${forecasts.length})\n`;
    if (forecasts.length > 0) {
      forecasts.forEach((f: any, idx: number) => {
        const predicted = f.predicted_decision || f.predicted || 'Unknown forecast';
        const conf = ((f.confidence || 0.5) * 100).toFixed(0);
        const category = f.category || 'uncategorized';
        prompt += `${idx + 1}. **${predicted}**\n`;
        prompt += `   - Confidence: ${conf}% | Category: ${category}\n`;
      });
    } else {
      prompt += `- No forecasts generated yet\n`;
    }
    prompt += `\n`;

    // Recent ADRs (with content)
    if (adrs.length > 0) {
      prompt += `## 📜 Recent ADRs (last ${adrs.length})\n`;
      adrs.forEach((adr: any, idx: number) => {
        const id = adr.id || `ADR-${idx + 1}`;
        const title = adr.title || 'Untitled';
        const decision = adr.decision || 'No decision documented';
        const status = adr.status || 'draft';
        const timestamp = adr.timestamp ? new Date(adr.timestamp).toISOString().split('T')[0] : 'unknown';
        
        prompt += `${idx + 1}. **${id}** (${timestamp}) - "${title}"\n`;
        prompt += `   - Decision: ${decision.substring(0, 120)}${decision.length > 120 ? '...' : ''}\n`;
        prompt += `   - Status: ${status}\n`;
      });
      prompt += `\n`;
    }

    // Active Goals
    if (goals.length > 0) {
      prompt += `## 🎯 Active Goals\n`;
      goals.forEach((goal: any, idx: number) => {
        const id = goal.id || goal.goal_id || `G${idx + 1}`;
        const title = goal.title || 'Untitled goal';
        const status = goal.status || 'pending';
        const progress = goal.progress || 0;
        const statusIcon = status === 'completed' ? '[x]' : status === 'in_progress' ? '[ ]' : '[ ]';
        const marker = status === 'in_progress' ? ' ← YOU ARE HERE' : '';
        
        prompt += `${statusIcon} **${id}**: ${title} (${progress}%)${marker}\n`;
      });
      prompt += `\n`;
    }

    // Correlations
    if (correlations.length > 0) {
      prompt += `## 🔗 Active Correlations\n`;
      correlations.forEach((corr: any, idx: number) => {
        const score = (corr.score || corr.strength || 0).toFixed(2);
        const files = corr.files || [corr.file1, corr.file2].filter(Boolean);
        const reason = corr.reason || 'Co-edited frequently';
        
        if (files.length >= 2) {
          prompt += `${idx + 1}. ${files[0]} ↔ ${files[1]} (${score})\n`;
          prompt += `   - ${reason}\n`;
        }
      });
      prompt += `\n`;
    }

    // Cognitive Integrity
    prompt += `## 🧠 Cognitive Integrity\n`;
    const healthStatus = integrity.overallHealth > 0.8 ? '✅ Healthy' : 
                        integrity.overallHealth > 0.6 ? '⚠️ Warning' : '🔴 Critical';
    prompt += `- Cycle Coherence: ${(integrity.cycleCoherence * 100).toFixed(0)}%\n`;
    prompt += `- Pattern Drift: ${(integrity.patternDrift * 100).toFixed(0)}%\n`;
    prompt += `- Forecast Accuracy: ${(integrity.forecastAccuracy * 100).toFixed(0)}%\n`;
    prompt += `- Overall Health: ${(integrity.overallHealth * 100).toFixed(0)}% ${healthStatus}\n`;
    prompt += `\n`;

    // Files Modified (compact)
    prompt += `## 📝 Files Modified (${fileChanges.length} changes)\n`;
    if (fileChanges.length > 0) {
      const recentChanges = fileChanges.slice(-10);
      recentChanges.forEach((change, idx) => {
        const timestamp = new Date(change.timestamp).toLocaleTimeString();
        change.metadata.changes.forEach(c => {
          prompt += `${idx + 1}. ${timestamp} - ${c.path} (${c.type})\n`;
        });
      });
    } else {
      prompt += `- No file changes in this period\n`;
    }
    prompt += `\n`;

    // Git Commits
    prompt += `## 🔧 Git Commits (${commits.length} commits)\n`;
    if (commits.length > 0) {
      commits.forEach((commit, idx) => {
        const timestamp = new Date(commit.metadata.commit.timestamp).toLocaleTimeString();
        const message = commit.metadata.commit.message.split('\n')[0];
        prompt += `${idx + 1}. ${timestamp} - ${message}\n`;
      });
    } else {
      prompt += `- No commits in this period\n`;
    }
    prompt += `\n`;

    // System Health
    if (health) {
      prompt += `## 💻 System Health\n`;
      prompt += `- Memory: ${Math.round(health.metrics.memoryMB)}MB\n`;
      prompt += `- Event Loop (p50): ${health.metrics.eventLoopLag.p50.toFixed(2)}ms\n`;
      prompt += `- Uptime: ${Math.round(health.metrics.uptime / 3600)}h ${Math.round((health.metrics.uptime % 3600) / 60)}m\n`;
      prompt += `\n`;
    }

    // Footer
    prompt += `---\n\n`;
    prompt += `🎯 **Task: Recalibrate Agent Context**\n\n`;
    prompt += `Based on ONLY this raw data, provide:\n\n`;
    prompt += `1. **Summary**: What happened in the last 2 hours?\n`;
    prompt += `2. **Current Focus**: What is the developer currently working on?\n`;
    prompt += `3. **Context**: What context do you need to continue effectively?\n\n`;
    prompt += `Keep your response concise and actionable.\n`;

    return prompt;
  }

  /**
   * Generate "Before" prompt — Historical replay (date range)
   */
  public formatBeforePrompt(from: Date, to: Date): string {
    const period: TimelinePeriod = { from, to };

    const cycles = this.loadCycles(period);
    const fileChanges = this.loadFileChanges(period);
    const commits = this.loadGitCommits(period);

    // Build prompt
    let prompt = `# 🕒 BEFORE — Timeline Replay\n\n`;
    
    // Period
    prompt += `## 📅 Period\n`;
    prompt += `- From: ${from.toISOString().replace('T', ' ').split('.')[0]}\n`;
    prompt += `- To: ${to.toISOString().replace('T', ' ').split('.')[0]}\n`;
    prompt += `- Duration: ${Math.round((to.getTime() - from.getTime()) / (60 * 60 * 1000))} hours\n`;
    prompt += `- Cycles: ${cycles.length}\n\n`;

    // Merge all events chronologically
    const allEvents: Array<{ timestamp: Date; type: string; data: any }> = [];

    commits.forEach(commit => {
      allEvents.push({
        timestamp: new Date(commit.metadata.commit.timestamp),
        type: 'commit',
        data: commit
      });
    });

    fileChanges.forEach(change => {
      allEvents.push({
        timestamp: new Date(change.timestamp),
        type: 'file_change',
        data: change
      });
    });

    // Sort chronologically
    allEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    // Display events
    prompt += `## 📜 Events (${allEvents.length} total)\n\n`;
    
    if (allEvents.length === 0) {
      prompt += `- No events recorded in this period\n\n`;
    } else {
      allEvents.forEach((event, idx) => {
        const time = event.timestamp.toLocaleTimeString();
        
        if (event.type === 'commit') {
          const commit = event.data as RawGitCommit;
          const message = commit.metadata.commit.message.split('\n')[0];
          prompt += `${idx + 1}. ${time} - **Commit**: ${message}\n`;
        } else if (event.type === 'file_change') {
          const change = event.data as RawFileChange;
          const files = change.metadata.changes.map(c => c.path).join(', ');
          prompt += `${idx + 1}. ${time} - **Files changed**: ${files}\n`;
        }
      });
      prompt += `\n`;
    }

    // Footer with reasoning request
    prompt += `---\n\n`;
    prompt += `🎯 **Task: Timeline Analysis**\n\n`;
    prompt += `Based on ONLY this chronological data, provide:\n\n`;
    prompt += `1. **Summary**: What happened during this period?\n`;
    prompt += `2. **Patterns**: Any recurring behaviors or themes?\n`;
    prompt += `3. **Decisions**: What key decisions were made?\n`;
    prompt += `4. **Context**: What was the developer trying to accomplish?\n\n`;
    prompt += `Keep your response analytical and evidence-based.\n`;

    return prompt;
  }

  /**
   * Generate "Next" prompt — Raw data + reasoning request
   * Phase E3.2: Enhanced with detailed patterns/forecasts/goals/risks
   */
  public formatNextPrompt(): string {
    const context = this.loadContext();
    const health = this.loadLatestHealth();
    const phaseInfo = this.loadPhase();
    const patterns = this.loadPatterns();
    const forecasts = this.loadForecasts();
    const goals = this.loadGoals();
    const correlations = this.loadCorrelations(10);
    const integrity = this.loadIntegrityMetrics();

    // Get recent activity (last 24 hours)
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const period: TimelinePeriod = { from: oneDayAgo, to: now };

    const cycles = this.loadCycles(period);
    const commits = this.loadGitCommits(period);

    // Build enriched prompt
    let prompt = `# ➡️ NEXT — Complete Intelligence for Action Planning v2.0\n\n`;
    
    // Current State
    prompt += `## 📊 Current State\n`;
    prompt += `- Cycle: ${context?.current_cycle || 'unknown'}\n`;
    prompt += `- Phase: ${phaseInfo.phase}${phaseInfo.phase !== 'unknown' ? ` (${phaseInfo.phase === 'exploration' ? 'E1' : phaseInfo.phase === 'stabilization' ? 'E2' : 'E3'})` : ''}\n`;
    if (phaseInfo.goal) {
      prompt += `- Phase Goal: "${phaseInfo.goal}"\n`;
    }
    prompt += `- Total Patterns: ${patterns.length}\n`;
    prompt += `- Total Forecasts: ${forecasts.length}\n`;
    prompt += `- Recent Cycles (24h): ${cycles.length}\n`;
    prompt += `- Recent Commits: ${commits.length}\n`;
    prompt += `\n`;

    // Cognitive Health (Integrity Pass)
    prompt += `## 🧠 Cognitive Health\n`;
    const healthStatus = integrity.overallHealth > 0.8 ? '✅ Production-Ready' : 
                        integrity.overallHealth > 0.6 ? '⚠️ Warning' : '🔴 Critical';
    prompt += `- Cycle Coherence: ${(integrity.cycleCoherence * 100).toFixed(0)}%\n`;
    prompt += `- Pattern Drift: ${(integrity.patternDrift * 100).toFixed(0)}% (lower is better)\n`;
    prompt += `- Forecast Accuracy: ${(integrity.forecastAccuracy * 100).toFixed(0)}%\n`;
    prompt += `- Overall Health: ${(integrity.overallHealth * 100).toFixed(0)}% ${healthStatus}\n`;
    prompt += `\n`;

    // Detailed Patterns
    prompt += `## 📊 Patterns Detected (detailed)\n`;
    if (patterns.length > 0) {
      patterns.forEach((p: any, idx: number) => {
        const id = p.pattern_id || p.id || `pattern_${idx}`;
        const desc = p.description || p.pattern || 'Unknown pattern';
        const conf = ((p.confidence || 0.5) * 100).toFixed(0);
        const trend = p.trend || 'stable';
        const evidence = p.evidence || 'Not documented';
        const insight = p.insight || 'Requires analysis';
        
        prompt += `${idx + 1}. **${id}** - "${desc}"\n`;
        prompt += `   - Confidence: ${conf}% | Trend: ${trend}\n`;
        prompt += `   - Evidence: ${evidence.substring(0, 80)}${evidence.length > 80 ? '...' : ''}\n`;
        prompt += `   - Insight: ${insight.substring(0, 80)}${insight.length > 80 ? '...' : ''}\n`;
      });
    } else {
      prompt += `- No patterns detected (system may need recalibration)\n`;
    }
    prompt += `\n`;

    // Detailed Forecasts
    prompt += `## 🔮 Forecasts Generated (detailed)\n`;
    if (forecasts.length > 0) {
      forecasts.forEach((f: any, idx: number) => {
        const predicted = f.predicted_decision || f.predicted || 'Unknown forecast';
        const conf = ((f.confidence || 0.5) * 100).toFixed(0);
        const category = f.category || 'uncategorized';
        const timeline = f.timeline || 'Not specified';
        const evidence = f.evidence || 'Historical trends';
        
        prompt += `${idx + 1}. **${predicted}**\n`;
        prompt += `   - Confidence: ${conf}% | Category: ${category}\n`;
        prompt += `   - Timeline: ${timeline}\n`;
        prompt += `   - Evidence: ${evidence.substring(0, 80)}${evidence.length > 80 ? '...' : ''}\n`;
      });
    } else {
      prompt += `- No forecasts generated (awaiting more data)\n`;
    }
    prompt += `\n`;

    // Goals with Progress
    if (goals.length > 0) {
      prompt += `## 🎯 Active Goals (with progress)\n`;
      goals.forEach((goal: any, idx: number) => {
        const id = goal.id || goal.goal_id || `G${idx + 1}`;
        const title = goal.title || 'Untitled goal';
        const status = goal.status || 'pending';
        const progress = goal.progress || 0;
        const blockers = goal.blockers || [];
        const statusIcon = status === 'completed' ? '[x]' : status === 'in_progress' ? '[ ]' : '[ ]';
        const marker = status === 'in_progress' ? ' ← IN PROGRESS' : '';
        
        prompt += `${statusIcon} **${id}**: ${title}\n`;
        prompt += `   - Progress: ${progress}% | Status: ${status}${marker}\n`;
        if (blockers.length > 0) {
          prompt += `   - Blockers: ${blockers.join(', ')}\n`;
        }
      });
      prompt += `\n`;
    }

    // Correlations with Strength
    if (correlations.length > 0) {
      prompt += `## 🔗 Correlations (strength scores)\n`;
      correlations.slice(0, 10).forEach((corr: any, idx: number) => {
        const score = (corr.score || corr.strength || 0).toFixed(2);
        const files = corr.files || [corr.file1, corr.file2].filter(Boolean);
        const reason = corr.reason || 'Co-edited frequently';
        const coEditCount = corr.co_edit_count || '?';
        
        if (files.length >= 2) {
          prompt += `${idx + 1}. ${files[0]} ↔ ${files[1]} (${score})\n`;
          prompt += `   - Reason: ${reason}\n`;
          prompt += `   - Co-edits: ${coEditCount}\n`;
        }
      });
      prompt += `\n`;
    }

    // Auto-Detected Risks
    prompt += `## ⚠️ Identified Risks\n`;
    const risks: string[] = [];
    
    // Zero-commit risk
    if (commits.length === 0 && cycles.length > 1000) {
      risks.push(`🔴 **HIGH**: Zero-commit risk (${cycles.length} cycles without commit)`);
      risks.push(`   - Impact: Work loss if crash occurs`);
      risks.push(`   - Mitigation: Commit now or enable auto-snapshot`);
    }
    
    // Phase detection broken
    if (phaseInfo.phase === 'unknown') {
      risks.push(`🔴 **HIGH**: Phase detection broken`);
      risks.push(`   - Impact: System cannot adapt behavior to dev stage`);
      risks.push(`   - Mitigation: Fix phase regex in PromptBridge`);
    }
    
    // Pattern stagnation
    if (patterns.length < 3) {
      risks.push(`🟡 **MEDIUM**: Low pattern count (${patterns.length})`);
      risks.push(`   - Impact: Limited cognitive insights`);
      risks.push(`   - Mitigation: Review PatternLearningEngine thresholds`);
    }
    
    // Health warning
    if (integrity.overallHealth < 0.6) {
      risks.push(`🔴 **HIGH**: Cognitive health below threshold (${(integrity.overallHealth * 100).toFixed(0)}%)`);
      risks.push(`   - Impact: System recommendations unreliable`);
      risks.push(`   - Mitigation: Run integrity diagnostics`);
    }
    
    if (risks.length > 0) {
      risks.forEach(risk => prompt += `${risk}\n`);
    } else {
      prompt += `- No critical risks detected ✅\n`;
    }
    prompt += `\n`;

    // System Health
    if (health) {
      prompt += `## 💻 System Health\n`;
      prompt += `- Memory: ${Math.round(health.metrics.memoryMB)}MB\n`;
      prompt += `- Event Loop (p50): ${health.metrics.eventLoopLag.p50.toFixed(2)}ms\n`;
      prompt += `- Uptime: ${Math.round(health.metrics.uptime / 3600)}h\n`;
      prompt += `\n`;
    }

    // Footer with reasoning request
    prompt += `---\n\n`;
    prompt += `🎯 **Task: Generate Prioritized Action Plan**\n\n`;
    prompt += `Based on ONLY this raw data, provide:\n\n`;
    prompt += `1. **Immediate Actions** (High Priority):\n`;
    prompt += `   - What must be done NOW?\n`;
    prompt += `   - Why is it critical?\n`;
    prompt += `   - Specific next step?\n\n`;
    prompt += `2. **Near-term Actions** (Medium Priority):\n`;
    prompt += `   - What should be done soon?\n`;
    prompt += `   - Why is it important?\n`;
    prompt += `   - Dependencies?\n\n`;
    prompt += `3. **Background Actions** (Low Priority):\n`;
    prompt += `   - What can wait?\n`;
    prompt += `   - Why is it lower priority?\n\n`;
    prompt += `Keep your response structured, evidence-based, and actionable.\n`;

    return prompt;
  }

  /**
   * Generate "Restore" prompt — Complete state at cycle N
   */
  public formatRestorePrompt(cycleId: number): string {
    // Load all data up to this cycle
    const cycles = this.loadCycles();
    const targetCycle = cycles.find(c => c.cycleId === cycleId);

    if (!targetCycle) {
      return `# 🧳 RESTORE — Cycle Not Found\n\nCycle ${cycleId} not found in ledger.\n`;
    }

    const cycleDate = new Date(targetCycle.timestamp);

    // Get all data up to this timestamp
    const period: TimelinePeriod = { 
      from: new Date(0), // Beginning of time
      to: cycleDate 
    };

    const fileChanges = this.loadFileChanges(period);
    const commits = this.loadGitCommits(period);

    // Build prompt
    let prompt = `# 🧳 RESTORE — State Export\n\n`;
    
    // Target Cycle
    prompt += `## 🎯 Target Cycle\n`;
    prompt += `- Cycle ID: ${cycleId}\n`;
    prompt += `- Timestamp: ${cycleDate.toISOString().replace('T', ' ').split('.')[0]}\n`;
    prompt += `- Merkle Root: ${targetCycle.merkleRoot || 'N/A'}\n`;
    prompt += `\n`;

    // Cumulative Statistics
    prompt += `## 📊 Cumulative Statistics (up to cycle ${cycleId})\n`;
    prompt += `- Total Cycles: ${cycles.filter(c => c.cycleId <= cycleId).length}\n`;
    prompt += `- Total File Changes: ${fileChanges.length}\n`;
    prompt += `- Total Commits: ${commits.length}\n`;
    prompt += `\n`;

    // Recent commits (last 10 before this cycle)
    const recentCommits = commits.slice(-10);
    if (recentCommits.length > 0) {
      prompt += `## 🔧 Recent Commits (last 10)\n`;
      recentCommits.forEach((commit, idx) => {
        const message = commit.metadata.commit.message.split('\n')[0];
        prompt += `${idx + 1}. ${message}\n`;
      });
      prompt += `\n`;
    }

    // Footer with restoration instructions
    prompt += `---\n\n`;
    prompt += `🎯 **Task: State Restoration Context**\n\n`;
    prompt += `This snapshot represents the exact state at cycle ${cycleId}.\n\n`;
    prompt += `**To restore this state**:\n`;
    prompt += `1. Use the provided workspace ZIP (if available)\n`;
    prompt += `2. Restore the \`.reasoning_rl4/\` folder\n`;
    prompt += `3. Verify the Merkle root matches: \`${targetCycle.merkleRoot}\`\n\n`;
    prompt += `**Context for agent**:\n`;
    prompt += `- You are resuming work from cycle ${cycleId}\n`;
    prompt += `- The above commits show what was done before this point\n`;
    prompt += `- Use this context to calibrate your next actions\n`;

    return prompt;
  }
}


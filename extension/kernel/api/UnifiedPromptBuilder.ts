/**
 * UnifiedPromptBuilder — Single Context Snapshot Generator
 * 
 * Phase E3.3: Combine all data sources into one unified prompt
 * 
 * Data Sources:
 * 1. Plan/Tasks/Context.RL4 (persistent state files)
 * 2. ADRs from ledger/adrs.jsonl (decision history)
 * 3. Blind spot data (timeline, file patterns, git history, health)
 * 4. Confidence/Bias metrics
 * 
 * Output:
 * Single Markdown prompt with complete context for agent LLM
 * 
 * Workflow:
 * User clicks "Generate Snapshot" → Builder combines all sources → Clipboard
 */

import * as fs from 'fs';
import * as path from 'path';
import { PlanTasksContextParser, PlanData, TasksData, ContextData, WorkspaceData } from './PlanTasksContextParser';
import { BlindSpotDataLoader, TimelinePeriod } from './BlindSpotDataLoader';
import { ADRParser } from './ADRParser';
import { HistorySummarizer, HistorySummary } from './HistorySummarizer';
import { BiasCalculator, BiasReport } from './BiasCalculator';
import { ADRSignalEnricher, EnrichedCommit } from './ADRSignalEnricher';

export class UnifiedPromptBuilder {
  private rl4Path: string;
  private planParser: PlanTasksContextParser;
  private blindSpotLoader: BlindSpotDataLoader;
  private adrParser: ADRParser;
  private historySummarizer: HistorySummarizer;
  private biasCalculator: BiasCalculator;
  private adrEnricher: ADRSignalEnricher;

  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
    this.planParser = new PlanTasksContextParser(rl4Path);
    this.blindSpotLoader = new BlindSpotDataLoader(rl4Path);
    this.adrParser = new ADRParser(rl4Path);
    this.historySummarizer = new HistorySummarizer(rl4Path);
    this.biasCalculator = new BiasCalculator(rl4Path);
    this.adrEnricher = new ADRSignalEnricher(rl4Path);
  }

  /**
   * Generate unified context snapshot with user-selected deviation mode
   * @param deviationMode - User's perception angle (strict/flexible/exploratory/free)
   */
  async generate(deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' = 'flexible'): Promise<string> {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const period: TimelinePeriod = { from: twoHoursAgo, to: now };

    // Load persistent state files
    const plan = this.planParser.parsePlan();
    const tasks = this.planParser.parseTasks();
    const context = this.planParser.parseContext();

    // Load compressed historical summary (30 days → 2KB JSON)
    const historySummary = await this.historySummarizer.summarize(30);

    // Calculate bias (deviation from original plan) with user-selected mode
    const biasReport = await this.biasCalculator.calculateBias(deviationMode);

    // Enrich commits with ADR detection signals (last 24h)
    const enrichedCommits = await this.adrEnricher.enrichCommits(24);

    // Load blind spot data (recent activity only)
    const timeline = this.blindSpotLoader.loadTimeline(period);
    const filePatterns = this.blindSpotLoader.loadFilePatterns(period);
    const gitHistory = this.blindSpotLoader.loadGitHistory(10);
    const healthTrends = this.blindSpotLoader.loadHealthTrends(period);
    const adrs = this.blindSpotLoader.loadADRs(5);

    // Get workspace reality for confidence calculation
    const workspaceReality: WorkspaceData = {
      activeFiles: context?.activeFiles || [],
      recentCycles: timeline.length,
      recentCommits: gitHistory.length,
      health: {
        memoryMB: healthTrends[healthTrends.length - 1]?.memoryMB || 0,
        eventLoopLag: healthTrends[healthTrends.length - 1]?.eventLoopLagP50 || 0
      }
    };

    // Calculate metrics
    const confidence = plan ? this.planParser.calculateConfidence(plan, workspaceReality) : 0.5;
    const bias = biasReport.total;

    // Build prompt with user-selected deviation mode
    return this.formatPrompt({
      plan,
      tasks,
      context,
      adrs,
      historySummary,
      biasReport,
      enrichedCommits,
      timeline,
      filePatterns,
      gitHistory,
      healthTrends,
      confidence,
      bias,
      generated: now.toISOString(),
      deviationMode  // User choice from UI
    });
  }

  /**
   * Format unified prompt
   */
  private formatPrompt(data: {
    plan: PlanData | null;
    tasks: TasksData | null;
    context: ContextData | null;
    adrs: any[];
    historySummary: HistorySummary;
    biasReport: BiasReport;
    enrichedCommits: EnrichedCommit[];
    timeline: any[];
    filePatterns: any;
    gitHistory: any[];
    healthTrends: any[];
    confidence: number;
    bias: number;
    generated: string;
    deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free';
  }): string {
    // Map deviation mode to threshold
    const thresholdMap: Record<string, number> = {
      'strict': 0.0,
      'flexible': 0.25,
      'exploratory': 0.50,
      'free': 1.0
    };
    const threshold = thresholdMap[data.deviationMode];
    let prompt = `# 🧠 RL4 Context Snapshot\n`;
    prompt += `Generated: ${data.generated}\n`;
    prompt += `Confidence: ${(data.confidence * 100).toFixed(0)}% | Bias: ${(data.bias * 100).toFixed(0)}%\n\n`;
    
    // Bias alert if exceeds threshold (use user-selected mode, not config)
    const exceedsThreshold = data.bias > threshold;
    if (exceedsThreshold) {
      prompt += `⚠️ **DEVIATION ALERT**: Bias (${(data.bias * 100).toFixed(0)}%) exceeds ${data.deviationMode} threshold (${(threshold * 100).toFixed(0)}%)\n\n`;
    }
    
    prompt += `---\n\n`;

    // Section 1: Plan (Strategic Intent)
    if (data.plan) {
      prompt += `## 📋 Plan (Strategic Intent)\n\n`;
      prompt += `**Phase:** ${data.plan.phase}\n`;
      prompt += `**Goal:** ${data.plan.goal}\n\n`;
      prompt += `**Timeline:**\n`;
      prompt += `- Start: ${data.plan.timeline.start}\n`;
      prompt += `- Target: ${data.plan.timeline.target}\n\n`;
      
      if (data.plan.successCriteria.length > 0) {
        prompt += `**Success Criteria:**\n`;
        data.plan.successCriteria.forEach(c => {
          prompt += `- ${c}\n`;
        });
        prompt += `\n`;
      }

      if (data.plan.constraints.length > 0) {
        prompt += `**Constraints:**\n`;
        data.plan.constraints.forEach(c => {
          prompt += `- ${c}\n`;
        });
        prompt += `\n`;
      }
    } else {
      prompt += `## 📋 Plan (Strategic Intent)\n\n`;
      prompt += `⚠️ Plan.RL4 not found. Create one to define strategic direction.\n\n`;
    }

    // Section 2: Tasks (Tactical TODOs)
    if (data.tasks) {
      prompt += `## ✅ Tasks (Tactical TODOs)\n\n`;
      
      if (data.tasks.active.length > 0) {
        prompt += `**Active:**\n`;
        data.tasks.active.forEach(t => {
          const checkbox = t.completed ? '[x]' : '[ ]';
          const timestamp = t.timestamp ? ` (completed: ${t.timestamp})` : '';
          prompt += `- ${checkbox} ${t.task}${timestamp}\n`;
        });
        prompt += `\n`;
      }

      if (data.tasks.blockers.length > 0) {
        prompt += `**Blockers:**\n`;
        data.tasks.blockers.forEach(b => {
          prompt += `- ${b}\n`;
        });
        prompt += `\n`;
      }

      if (data.tasks.completed.length > 0) {
        prompt += `**Completed (last 24h):**\n`;
        data.tasks.completed.slice(0, 5).forEach(c => {
          prompt += `- ${c.task} (${c.timestamp})\n`;
        });
        prompt += `\n`;
      }
    } else {
      prompt += `## ✅ Tasks (Tactical TODOs)\n\n`;
      prompt += `⚠️ Tasks.RL4 not found. Create one to track active work.\n\n`;
    }

    // Section 2.5: Deviation Guard (CRITICAL FOR AGENT LLM)
    prompt += `## 🛡️ Deviation Guard (Active Constraints)\n\n`;
    prompt += `**Current Phase:** ${data.plan?.phase || 'Unknown'}\n`;
    prompt += `**Deviation Mode:** ${data.deviationMode} (${(threshold * 100).toFixed(0)}% threshold) — User-selected\n`;
    prompt += `**Current Bias:** ${(data.bias * 100).toFixed(0)}%\n\n`;
    
    if (data.tasks) {
      const activeTasks = data.tasks.active.filter(t => !t.completed);
      const p0p1Tasks = activeTasks.filter(t => t.task.includes('[P0]') || t.task.includes('[P1]'));
      const backlogTasks = activeTasks.filter(t => t.task.includes('[P2]') || t.task.includes('[P3]'));
      
      if (p0p1Tasks.length > 0) {
        prompt += `**Active Tasks (P0/P1 - DO THIS NOW):**\n`;
        p0p1Tasks.slice(0, 5).forEach((t, i) => {
          prompt += `${i + 1}. ${t.task}\n`;
        });
        prompt += `\n`;
      }
      
      if (backlogTasks.length > 0) {
        prompt += `**Backlog (P2/P3 - DEFER):**\n`;
        backlogTasks.slice(0, 3).forEach((t, i) => {
          prompt += `${i + 1}. ${t.task}\n`;
        });
        prompt += `\n`;
      }
    }
    
    prompt += `**🚨 RULE FOR LLM AGENT:**\n`;
    prompt += `Before implementing ANY new idea:\n`;
    prompt += `1. Check if it's in Active Tasks (P0/P1)\n`;
    prompt += `   - YES → Proceed immediately\n`;
    prompt += `   - NO → Ask user: "Add to Active (deviation +X%) or Backlog (bias +0%)?"\n\n`;
    
    prompt += `2. Calculate bias impact:\n`;
    prompt += `   - New feature NOT in Plan = +10% bias minimum\n`;
    prompt += `   - New module creation = +15% bias\n`;
    prompt += `   - Architecture change = +25% bias\n\n`;
    
    prompt += `3. If (current_bias + new_bias) > threshold:\n`;
    prompt += `   - STOP\n`;
    prompt += `   - Show options:\n`;
    prompt += `     a) Implement now (accept deviation)\n`;
    prompt += `     b) Add to Phase E4/E5 backlog\n`;
    prompt += `     c) Reject (stay on track)\n\n`;
    
    if (exceedsThreshold) {
      prompt += `⚠️ **DEVIATION ALERT**: You are currently exceeding the ${data.deviationMode} threshold.\n\n`;
      prompt += `**Recommendations:**\n`;
      data.biasReport.recommendations.forEach(rec => {
        prompt += `- ${rec}\n`;
      });
      prompt += `\n`;
    }
    
    prompt += `**Example:**\n`;
    prompt += `User: "Add deviation system"\n`;
    prompt += `Agent checks:\n`;
    prompt += `  - Is "deviation system" in Active Tasks? NO\n`;
    prompt += `  - Bias impact: New module = +15%\n`;
    prompt += `  - Current bias: ${(data.bias * 100).toFixed(0)}%\n`;
    prompt += `  - Total if implemented: ${((data.bias + 0.15) * 100).toFixed(0)}% ${(data.bias + 0.15) > threshold ? '>' : '<'} ${(threshold * 100).toFixed(0)}% threshold\n\n`;
    
    prompt += `Agent response:\n`;
    if ((data.bias + 0.15) > threshold) {
      prompt += `  "⚠️ This idea adds +15% bias (total: ${((data.bias + 0.15) * 100).toFixed(0)}% > ${(threshold * 100).toFixed(0)}% threshold).\n`;
      prompt += `  \n`;
      prompt += `  Options:\n`;
      prompt += `  a) Implement now (Phase E4, accept ${((data.bias + 0.15) * 100).toFixed(0)}% deviation)\n`;
      prompt += `  b) Add to Phase E5 backlog (bias stays ${(data.bias * 100).toFixed(0)}%)\n`;
      prompt += `  c) Reject (focus on P0 tasks)\n`;
      prompt += `  \n`;
      prompt += `  What do you prefer?"\n\n`;
    } else {
      prompt += `  "✅ This idea adds +15% bias (total: ${((data.bias + 0.15) * 100).toFixed(0)}% < ${(threshold * 100).toFixed(0)}% threshold).\n`;
      prompt += `  Proceeding with implementation."\n\n`;
    }

    // Section 3: Context (Workspace State)
    if (data.context) {
      prompt += `## 🔍 Context (Workspace State)\n\n`;
      
      if (data.context.activeFiles.length > 0) {
        prompt += `**Active Files:**\n`;
        data.context.activeFiles.slice(0, 5).forEach(f => {
          prompt += `- ${f}\n`;
        });
        prompt += `\n`;
      }

      prompt += `**Recent Activity (${data.context.recentActivity.duration}):**\n`;
      prompt += `- Cycles: ${data.context.recentActivity.cycles}\n`;
      prompt += `- Commits: ${data.context.recentActivity.commits}\n\n`;

      prompt += `**Health:**\n`;
      prompt += `- Memory: ${data.context.health.memory}\n`;
      prompt += `- Event Loop: ${data.context.health.eventLoop}\n`;
      prompt += `- Uptime: ${data.context.health.uptime}\n\n`;

      if (data.context.observations.length > 0) {
        prompt += `**Observations:**\n`;
        data.context.observations.forEach(o => {
          prompt += `- ${o}\n`;
        });
        prompt += `\n`;
      }
    } else {
      prompt += `## 🔍 Context (Workspace State)\n\n`;
      prompt += `⚠️ Context.RL4 not found. Create one to track workspace state.\n\n`;
    }

    // Section 4: Historical Summary (Compressed - 30 days in JSON)
    prompt += `## 📊 Historical Summary (Compressed)\n\n`;
    prompt += `**Format:** JSON | **Timespan:** ${data.historySummary.timespan} | **Total Cycles:** ${data.historySummary.total_cycles}\n\n`;
    prompt += `\`\`\`json\n`;
    prompt += JSON.stringify(data.historySummary, null, 2);
    prompt += `\n\`\`\`\n\n`;

    // Section 5: Decision History (ADRs)
    if (data.adrs.length > 0) {
      prompt += `## 📜 Decision History (ADRs)\n\n`;
      data.adrs.forEach((adr, idx) => {
        prompt += `${idx + 1}. **${adr.id}** - "${adr.title}"\n`;
        prompt += `   - Decision: ${adr.decision.substring(0, 120)}${adr.decision.length > 120 ? '...' : ''}\n`;
        prompt += `   - Status: ${adr.status} | Date: ${adr.timestamp?.split('T')[0] || 'unknown'}\n`;
      });
      prompt += `\n`;
    } else {
      prompt += `## 📜 Decision History (ADRs)\n\n`;
      prompt += `- No ADRs documented yet\n\n`;
    }

    // Section 5.5: ADR Detection Signals (Auto-detected from commits)
    const potentialADRs = data.enrichedCommits.filter(c => c.adrScore > 0.7);
    const significantChanges = data.enrichedCommits.filter(c => c.adrScore > 0.5 && c.adrScore <= 0.7);
    
    if (potentialADRs.length > 0 || significantChanges.length > 0) {
      prompt += `## 🔍 ADR Detection Signals (Last 24h)\n\n`;
      
      if (potentialADRs.length > 0) {
        prompt += `**⚠️ Potential ADRs Detected (Score >70%):**\n\n`;
        potentialADRs.forEach((commit, idx) => {
          prompt += `${idx + 1}. **${commit.hash.substring(0, 7)}**: ${commit.message}\n`;
          prompt += `   - Score: ${(commit.adrScore * 100).toFixed(0)}%\n`;
          prompt += `   - Reason: ${commit.adrReason}\n`;
          prompt += `   - Files: ${commit.totalFiles}, Lines: ${commit.linesChanged} (+${commit.insertions}/-${commit.deletions})\n`;
          prompt += `   - Core: ${commit.isCoreFile ? 'Yes' : 'No'}, Type: ${commit.intent.type}\n`;
          prompt += `   - Activity: ${commit.cyclesBefore} cycles before → ${commit.cyclesAfter} after\n\n`;
        });
        
        prompt += `**LLM Instructions:**\n`;
        prompt += `Review each potential ADR above. If you confirm it's an architectural decision:\n`;
        prompt += `1. Create ADR-XXX in ADRs.RL4 with:\n`;
        prompt += `   - WHY: What problem triggered this commit?\n`;
        prompt += `   - WHAT: What architectural change was made?\n`;
        prompt += `   - TRADEOFFS: What alternatives were considered?\n`;
        prompt += `   - CONSEQUENCES: Positive/negative impacts?\n\n`;
      }
      
      if (significantChanges.length > 0) {
        prompt += `**⚡ Significant Changes (Score 50-70%):**\n\n`;
        significantChanges.slice(0, 5).forEach((commit, idx) => {
          prompt += `${idx + 1}. **${commit.hash.substring(0, 7)}**: ${commit.message}\n`;
          prompt += `   - Score: ${(commit.adrScore * 100).toFixed(0)}% | ${commit.adrReason}\n`;
        });
        prompt += `\n`;
      }
    } else {
      prompt += `## 🔍 ADR Detection Signals\n\n`;
      prompt += `- No potential ADRs detected in last 24h\n\n`;
    }

    // Section 6: Timeline Analysis (Blind Spot Data)
    prompt += `## 📊 Timeline Analysis (Blind Spot Data)\n\n`;
    prompt += `**Period:** ${data.timeline.length > 0 ? 'Last 2 hours' : 'No data'}\n`;
    prompt += `- Cycles: ${data.timeline.length}\n`;
    prompt += `- Activity Rate: ${data.timeline.length > 0 ? (data.timeline.length / 120).toFixed(1) : '0'} cycles/min\n\n`;

    // File change patterns
    if (data.filePatterns.bursts.length > 0 || data.filePatterns.gaps.length > 0) {
      prompt += `**File Change Patterns:**\n`;
      
      if (data.filePatterns.bursts.length > 0) {
        prompt += `\n*Bursts (rapid iteration):*\n`;
        data.filePatterns.bursts.slice(0, 3).forEach((burst: any) => {
          prompt += `- **${burst.file}**: ${burst.editCount} edits in ${burst.timespan} (${burst.startTime}-${burst.endTime})\n`;
          prompt += `  → ${burst.inference}\n`;
        });
      }

      if (data.filePatterns.gaps.length > 0) {
        prompt += `\n*Gaps (breaks/blockers):*\n`;
        data.filePatterns.gaps.slice(0, 3).forEach((gap: any) => {
          prompt += `- ${gap.duration} gap (${gap.startTime} → ${gap.endTime})\n`;
          prompt += `  → ${gap.inference}\n`;
        });
      }
      prompt += `\n`;
    }

    // Git commit history
    if (data.gitHistory.length > 0) {
      prompt += `**Git Commit History (last 10):**\n`;
      data.gitHistory.forEach((commit, idx) => {
        const date = new Date(commit.timestamp).toLocaleDateString();
        prompt += `${idx + 1}. ${commit.hash} - ${commit.message}\n`;
        prompt += `   ${date} | ${commit.author}`;
        if (commit.intent) {
          prompt += ` | Type: ${commit.intent}`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    } else {
      prompt += `**Git Commit History:**\n`;
      prompt += `- No recent commits (⚠️ Uncommitted work risk)\n\n`;
    }

    // System health trends
    if (data.healthTrends.length > 0) {
      const latestHealth = data.healthTrends[data.healthTrends.length - 1];
      const oldestHealth = data.healthTrends[0];
      
      prompt += `**System Health Trends:**\n`;
      prompt += `- Memory: ${latestHealth.memoryMB}MB`;
      if (data.healthTrends.length > 1) {
        const memoryDelta = latestHealth.memoryMB - oldestHealth.memoryMB;
        prompt += ` (${memoryDelta > 0 ? '+' : ''}${memoryDelta}MB vs 2h ago)`;
      }
      prompt += `\n`;
      
      prompt += `- Event Loop: ${latestHealth.eventLoopLagP50.toFixed(2)}ms p50`;
      if (data.healthTrends.length > 1) {
        const lagDelta = latestHealth.eventLoopLagP50 - oldestHealth.eventLoopLagP50;
        if (Math.abs(lagDelta) > 0.01) {
          prompt += ` (${lagDelta > 0 ? '+' : ''}${lagDelta.toFixed(2)}ms)`;
        }
      }
      prompt += `\n`;
      
      prompt += `- Uptime: ${Math.round(latestHealth.uptime / 3600)}h\n\n`;
    }

    // Footer: Agent Instructions
    prompt += `---\n\n`;
    prompt += `## 🎯 Agent Instructions\n\n`;
    prompt += `Based on this snapshot, you MUST calculate and update these 4 KPIs in Context.RL4:\n\n`;
    
    // KPI 1: Cognitive Load
    prompt += `### 1. Cognitive Load (Factual)\n`;
    prompt += `**Calculate from raw data:**\n`;
    prompt += `- Bursts: Count rapid edit sessions (>30 edits in <2min)\n`;
    prompt += `- Switches: Count file jumps in timeline\n`;
    prompt += `- Parallel Tasks: Count tasks with status "in_progress"\n`;
    prompt += `- Uncommitted: Run \`git status --porcelain | wc -l\` (estimate from timeline)\n\n`;
    prompt += `**Formula:**\n`;
    prompt += `\`\`\`\n`;
    prompt += `load = (bursts/10 * 0.3) + (switches/50 * 0.2) + (parallelTasks/3 * 0.3) + (uncommitted/20 * 0.2)\n`;
    prompt += `level = 'critical' if load > 0.8 else 'high' if load > 0.6 else 'normal'\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `**NO predictions, NO judgments. Just facts.**\n\n`;
    
    // KPI 2: Next Steps (Mode-Driven)
    prompt += `### 2. Next Steps (Mode-Driven: ${data.deviationMode})\n`;
    if (data.deviationMode === 'strict') {
      prompt += `**STRICT MODE (0% threshold):**\n`;
      prompt += `- Focus ONLY on P0 tasks from baseline plan\n`;
      prompt += `- Suggest recalibration if bias > 0%\n`;
      prompt += `- Reject ALL new ideas (add to backlog)\n`;
      prompt += `- Top 3 actions: Commit, Recalibrate, Complete P0\n\n`;
    } else if (data.deviationMode === 'flexible') {
      prompt += `**FLEXIBLE MODE (25% threshold):**\n`;
      prompt += `- Focus on P0+P1 tasks\n`;
      prompt += `- New ideas OK if total bias < 25%\n`;
      prompt += `- Ask user before adding P2 features\n`;
      prompt += `- Top 3 actions: Complete P1, Manage risks, Accept/Reject drift\n\n`;
    } else if (data.deviationMode === 'exploratory') {
      prompt += `**EXPLORATORY MODE (50% threshold):**\n`;
      prompt += `- Encourage exploration of new ideas\n`;
      prompt += `- Suggest improvements and alternatives\n`;
      prompt += `- Creative problem-solving\n`;
      prompt += `- Top 3 actions: Explore alternatives, Identify opportunities, Innovate\n\n`;
    } else {
      prompt += `**FREE MODE (100% threshold):**\n`;
      prompt += `- Full creative freedom\n`;
      prompt += `- Suggest major refactors if beneficial\n`;
      prompt += `- No constraints\n`;
      prompt += `- Top 3 actions: Whatever you think is best\n\n`;
    }
    
    // KPI 3: Plan Drift
    prompt += `### 3. Plan Drift (Factual)\n`;
    prompt += `**Already calculated:** ${(data.bias * 100).toFixed(0)}%\n`;
    prompt += `**What changed (vs baseline):**\n`;
    if (data.biasReport.breakdown) {
      prompt += `- Phase: ${data.biasReport.breakdown.phase > 0.05 ? 'Changed' : 'Unchanged'}\n`;
      prompt += `- Goal: ${(data.biasReport.breakdown.goal * 100).toFixed(0)}% different\n`;
      prompt += `- Timeline: ${(data.biasReport.breakdown.timeline * 100).toFixed(0)}% drift\n`;
      prompt += `- Tasks: Check Tasks.RL4 for additions\n\n`;
    }
    prompt += `**NO judgments. Just state facts and let user decide.**\n\n`;
    
    // KPI 4: Risks
    prompt += `### 4. Risks (Observable Only)\n`;
    prompt += `**Detect from data:**\n`;
    prompt += `- 🔴 Uncommitted files: Count from timeline (if >15 files)\n`;
    prompt += `- 🟡 Burst activity: Files with >30 edits in <2min\n`;
    prompt += `- 🟡 Long gaps: Breaks >30min (potential blocker?)\n`;
    prompt += `- 🟢 System health: Memory >400MB or event loop >1ms p95\n\n`;
    prompt += `**NO speculation. Only observable risks.**\n\n`;
    
    prompt += `---\n\n`;
    prompt += `Based on the above KPIs, provide:\n\n`;
    
    prompt += `1. **Analysis:**\n`;
    prompt += `   - What is the current state vs Plan?\n`;
    prompt += `   - Are we on track? Any blockers?\n`;
    prompt += `   - What patterns do you see in timeline/file changes?\n\n`;
    
    prompt += `2. **Updates Required:**\n`;
    prompt += `   Update these files in \`.reasoning_rl4/\`:\n\n`;
    prompt += `   **Plan.RL4** (if strategic direction changed):\n`;
    prompt += `   \`\`\`markdown\n`;
    prompt += `   ---\n`;
    prompt += `   version: ${(parseFloat(data.plan?.version || '1.0.0') + 0.1).toFixed(1)}\n`;
    prompt += `   updated: ${new Date().toISOString()}\n`;
    prompt += `   confidence: [YOUR_CALCULATED_CONFIDENCE]\n`;
    prompt += `   ---\n`;
    prompt += `   [UPDATED_PLAN_CONTENT]\n`;
    prompt += `   \`\`\`\n\n`;
    
    prompt += `   **Tasks.RL4** (mark completed, add new tasks):\n`;
    prompt += `   \`\`\`markdown\n`;
    prompt += `   ---\n`;
    prompt += `   version: ${(parseFloat(data.tasks?.version || '1.0.0') + 0.1).toFixed(1)}\n`;
    prompt += `   updated: ${new Date().toISOString()}\n`;
    prompt += `   bias: [YOUR_CALCULATED_BIAS]\n`;
    prompt += `   ---\n`;
    prompt += `   [UPDATED_TASKS_CONTENT]\n`;
    prompt += `   \`\`\`\n\n`;
    
    prompt += `   **Context.RL4** (update workspace state + KPIs):\n`;
    prompt += `   \`\`\`markdown\n`;
    prompt += `   ---\n`;
    prompt += `   version: ${(parseFloat(data.context?.version || '1.0.0') + 0.1).toFixed(1)}\n`;
    prompt += `   updated: ${new Date().toISOString()}\n`;
    prompt += `   confidence: [YOUR_CALCULATED_CONFIDENCE]\n`;
    prompt += `   ---\n\n`;
    prompt += `   # RL4 Operational Context\n\n`;
    prompt += `   ## KPIs (LLM-Calculated)\n\n`;
    prompt += `   ### Cognitive Load: [XX]% ([Level])\n`;
    prompt += `   - Bursts: [N]\n`;
    prompt += `   - Switches: [N]\n`;
    prompt += `   - Parallel Tasks: [N]\n`;
    prompt += `   - Uncommitted Files: [N]\n\n`;
    prompt += `   ### Next Steps (${data.deviationMode.charAt(0).toUpperCase() + data.deviationMode.slice(1)} Mode)\n`;
    prompt += `   1. [P0/P1] [Action 1]\n`;
    prompt += `   2. [P0/P1] [Action 2]\n`;
    prompt += `   3. [P0/P1] [Action 3]\n\n`;
    prompt += `   ### Plan Drift: [XX]%\n`;
    prompt += `   - Phase: [Original] → [Current]\n`;
    prompt += `   - Goal: [XX]% different\n`;
    prompt += `   - Tasks: +[N] added\n\n`;
    prompt += `   ### Risks\n`;
    prompt += `   - [Emoji] [Risk description]\n`;
    prompt += `   - [Emoji] [Risk description]\n\n`;
    prompt += `   ## Agent Observations\n`;
    prompt += `   [Your analysis and recommendations]\n`;
    prompt += `   \`\`\`\n\n`;

    prompt += `3. **ADRs (if decisions made):**\n`;
    prompt += `   If any significant decision was made, propose new ADR in \`.reasoning_rl4/ADRs.RL4\`:\n\n`;
    prompt += `   \`\`\`markdown\n`;
    prompt += `   ## ADR-XXX: [DECISION_TITLE]\n`;
    prompt += `   **Status**: proposed\n`;
    prompt += `   **Date**: ${new Date().toISOString().split('T')[0]}\n`;
    prompt += `   **Author**: Agent LLM\n\n`;
    prompt += `   ### Context\n`;
    prompt += `   [WHY_THIS_DECISION]\n\n`;
    prompt += `   ### Decision\n`;
    prompt += `   [WHAT_WAS_DECIDED]\n\n`;
    prompt += `   ### Consequences\n`;
    prompt += `   **Positive:**\n`;
    prompt += `   - [BENEFIT_1]\n\n`;
    prompt += `   **Negative:**\n`;
    prompt += `   - [RISK_1]\n`;
    prompt += `   \`\`\`\n\n`;

    prompt += `4. **Confidence/Bias Calculation:**\n`;
    prompt += `   - **Confidence** = Alignment between Plan and Reality (0.0-1.0)\n`;
    prompt += `     Formula: (tasksCompleted/tasksTotal * 0.4) + (activityLevel * 0.3) + (systemHealth * 0.3)\n`;
    prompt += `   - **Bias** = Drift from original Plan intent (0.0-1.0)\n`;
    prompt += `     Formula: Compare current Plan goal vs original goal (text similarity)\n\n`;

    prompt += `**Important:** Save all updates to \`.reasoning_rl4/\` directory. RL4 will detect changes and update internal state.\n`;

    return prompt;
  }

  /**
   * Initialize default Plan/Tasks/Context.RL4 files if they don't exist
   */
  async initializeDefaults(): Promise<void> {
    const planPath = path.join(this.rl4Path, 'Plan.RL4');
    const tasksPath = path.join(this.rl4Path, 'Tasks.RL4');
    const contextPath = path.join(this.rl4Path, 'Context.RL4');

    // Create Plan.RL4 if missing
    if (!fs.existsSync(planPath)) {
      const defaultPlan = this.planParser['generateDefaultPlan']();
      this.planParser.savePlan(defaultPlan);
      console.log('[UnifiedPromptBuilder] ✅ Created default Plan.RL4');
    }

    // Create Tasks.RL4 if missing
    if (!fs.existsSync(tasksPath)) {
      const defaultTasks = this.planParser['generateDefaultTasks']();
      this.planParser.saveTasks(defaultTasks);
      console.log('[UnifiedPromptBuilder] ✅ Created default Tasks.RL4');
    }

    // Create Context.RL4 if missing
    if (!fs.existsSync(contextPath)) {
      const defaultContext = this.planParser['generateDefaultContext']();
      this.planParser.saveContext(defaultContext);
      console.log('[UnifiedPromptBuilder] ✅ Created default Context.RL4');
    }
  }
}


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
import { ProjectAnalyzer, ProjectContext } from './ProjectAnalyzer';
import { ProjectDetector } from '../detection/ProjectDetector';
import { PromptOptimizer } from './PromptOptimizer';
import { AnomalyDetector, WorkspaceContext } from './AnomalyDetector';
import { CognitiveLogger, SnapshotDataSummary, LLMAnalysisMetrics, Insight } from '../CognitiveLogger';
import { CodeStateAnalyzer, CodeState } from './CodeStateAnalyzer';

export class UnifiedPromptBuilder {
  private rl4Path: string;
  private workspaceRoot: string;
  private planParser: PlanTasksContextParser;
  private blindSpotLoader: BlindSpotDataLoader;
  private adrParser: ADRParser;
  private historySummarizer: HistorySummarizer;
  private biasCalculator: BiasCalculator;
  private adrEnricher: ADRSignalEnricher;
  private projectAnalyzer: ProjectAnalyzer;
  private codeStateAnalyzer: CodeStateAnalyzer;
  private cognitiveLogger: CognitiveLogger | null;
  private promptOptimizer: PromptOptimizer;
  private anomalyDetector: AnomalyDetector;

  constructor(rl4Path: string, cognitiveLogger?: CognitiveLogger) {
    this.rl4Path = rl4Path;
    this.workspaceRoot = path.dirname(rl4Path);
    this.planParser = new PlanTasksContextParser(rl4Path);
    this.blindSpotLoader = new BlindSpotDataLoader(rl4Path);
    this.adrParser = new ADRParser(rl4Path);
    this.historySummarizer = new HistorySummarizer(rl4Path);
    this.biasCalculator = new BiasCalculator(rl4Path);
    this.adrEnricher = new ADRSignalEnricher(rl4Path);
    this.projectAnalyzer = new ProjectAnalyzer(rl4Path);
    this.codeStateAnalyzer = new CodeStateAnalyzer(this.workspaceRoot);
    this.cognitiveLogger = cognitiveLogger || null;
    this.promptOptimizer = new PromptOptimizer(this.workspaceRoot);
    this.anomalyDetector = new AnomalyDetector(this.workspaceRoot);
  }

  /**
   * Generate unified context snapshot with user-selected deviation mode
   * @param deviationMode - User's perception angle (strict/flexible/exploratory/free/firstUse)
   * @returns Prompt with metadata (anomalies, compression metrics)
   */
  async generate(deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse' = 'flexible'): Promise<{
    prompt: string;
    metadata: {
      anomalies: any[];
      compression: {
        originalSize: number;
        optimizedSize: number;
        reductionPercent: number;
        mode: string;
      };
    };
  }> {
    try {
    const now = new Date();
    const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
    const period: TimelinePeriod = { from: twoHoursAgo, to: now };
    
    // Phase 5: Log snapshot generation start
    if (this.cognitiveLogger) {
      const dataSummary: SnapshotDataSummary = {
        mode: deviationMode,
        total_cycles: 0, // Will be updated below
        recent_commits: 0, // Will be updated below
        file_changes: 0, // Will be updated below
        plan_rl4_found: false, // Will be updated below
        tasks_rl4_found: false, // Will be updated below
        context_rl4_found: false, // Will be updated below
        adrs_count: 0 // Will be updated below
      };
      this.cognitiveLogger.logSnapshotStart(deviationMode, dataSummary);
    }

    // Load persistent state files
    const plan = this.planParser.parsePlan();
    const tasks = this.planParser.parseTasks();
    const context = this.planParser.parseContext();

    // Load compressed historical summary (30 days → 2KB JSON)
    const historySummary = await this.historySummarizer.summarize(30);

    // If firstUse mode, run bootstrap first
    if (deviationMode === 'firstUse') {
      const { FirstBootstrapEngine } = await import('../bootstrap/FirstBootstrapEngine');
      const bootstrapEngine = new FirstBootstrapEngine(this.workspaceRoot);
      await bootstrapEngine.bootstrap();
    }

    // Calculate bias (deviation from original plan) with user-selected mode
    const biasMode = deviationMode === 'firstUse' ? 'exploratory' : deviationMode;
    const biasReport = await this.biasCalculator.calculateBias(biasMode);

    // Enrich commits with ADR detection signals (last 24h)
    const enrichedCommits = await this.adrEnricher.enrichCommits(24);

    // Analyze project context (for Exploratory/Free modes)
    const projectContext = await this.projectAnalyzer.analyze();
    
    // Detect project name from workspace (GENERIC, not RL4-specific)
    const projectDetector = new ProjectDetector(this.workspaceRoot);
    const detectedProject = await projectDetector.detect();

    // Analyze actual code state (what's really implemented)
    // Extract goals from plan (goal field) or tasks
    const goalText = plan?.goal || '';
    const taskTexts = tasks?.active.map(t => t.task) || [];
    const goals = goalText ? [goalText, ...taskTexts] : taskTexts;
    const codeState = await this.codeStateAnalyzer.analyze(goals);

    // Load blind spot data (recent activity only)
    const timeline = this.blindSpotLoader.loadTimeline(period);
    const filePatterns = this.blindSpotLoader.loadFilePatterns(period);
    const gitHistory = this.blindSpotLoader.loadGitHistory(10);
    const healthTrends = this.blindSpotLoader.loadHealthTrends(period);
    const adrs = this.blindSpotLoader.loadADRs(5);

    // Load engine-generated data (patterns, correlations, forecasts) for LLM optimization
    const enginePatterns = this.loadEnginePatterns();
    const engineCorrelations = this.loadEngineCorrelations();
    const engineForecasts = this.loadEngineForecasts();

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
    
    // Phase 5: Log data aggregation (after loading all data)
    if (this.cognitiveLogger) {
      const dataSummary: SnapshotDataSummary = {
        mode: deviationMode,
        total_cycles: timeline.length,
        recent_commits: gitHistory.length,
        file_changes: filePatterns ? Object.keys(filePatterns).length : 0, // Count unique file patterns
        plan_rl4_found: plan !== null,
        tasks_rl4_found: tasks !== null,
        context_rl4_found: context !== null,
        adrs_count: adrs.length
      };
      this.cognitiveLogger.logDataAggregation(dataSummary);
    }
    
    // Phase 5: Log insights (after calculating metrics)
    if (this.cognitiveLogger) {
      const insights: Insight[] = [];
      
      // Insight: Confidence level
      if (confidence < 0.5) {
        insights.push({
          type: 'alert',
          message: `Low confidence (${(confidence * 100).toFixed(0)}%) - Consider generating more context or updating Plan.RL4`,
          priority: 'medium'
        });
      } else if (confidence > 0.8) {
        insights.push({
          type: 'inference',
          message: `High confidence (${(confidence * 100).toFixed(0)}%) - System has good understanding of project state`,
          priority: 'low'
        });
      }
      
      // Insight: Bias level
      if (bias > 0.5) {
        insights.push({
          type: 'pattern',
          message: `Significant deviation from plan (bias: ${(bias * 100).toFixed(0)}%) - Project may have evolved beyond original plan`,
          priority: 'medium'
        });
      }
      
      // Insight: Missing RL4 files
      if (!plan || !tasks || !context) {
        insights.push({
          type: 'suggestion',
          message: `Missing RL4 files - Consider initializing Plan.RL4, Tasks.RL4, and Context.RL4 for better context`,
          priority: 'high'
        });
      }
      
      if (insights.length > 0) {
        this.cognitiveLogger.logInsights(insights);
      }
    }

    // Detect anomalies before building prompt
    const workspaceContext: WorkspaceContext = {
      recentCommits: gitHistory.length,
      fileChanges: filePatterns ? Object.keys(filePatterns).length : 0,
      patterns: enginePatterns,
      forecasts: engineForecasts,
      correlations: engineCorrelations,
      adrs: adrs,
      cycles: timeline.length,
      health: {
        memoryMB: healthTrends[healthTrends.length - 1]?.memoryMB || 0,
        eventLoopLag: healthTrends[healthTrends.length - 1]?.eventLoopLagP50 || 0
      },
      bias: bias,
      planDrift: biasReport.total,
      cognitiveLoad: 0 // Will be calculated by LLM
    };
    
    const anomalies = await this.anomalyDetector.detectAnomalies(workspaceContext);

    // Build prompt with user-selected deviation mode
    let prompt = this.formatPrompt({
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
      deviationMode,  // User choice from UI
      projectContext,  // Project analysis for intelligent modes
      detectedProject,  // Detected project name/context
      codeState,  // Actual code implementation state
      enginePatterns,  // Patterns from PatternLearningEngine (preliminary)
      engineCorrelations,  // Correlations from CorrelationEngine (preliminary)
      engineForecasts,  // Forecasts from ForecastEngine (preliminary)
      anomalies  // Anomalies detected
    });
    
    // Store original size before optimization
    const originalSize = prompt.length;
    
    // Optimize prompt (compress intelligently)
    prompt = await this.promptOptimizer.optimize(prompt, deviationMode);
    
    // Calculate compression metrics
    const optimizedSize = prompt.length;
    const reductionPercent = originalSize > 0 
      ? ((originalSize - optimizedSize) / originalSize) * 100 
      : 0;
    
    // Phase 5: Log snapshot generated (after prompt generation and optimization)
    if (this.cognitiveLogger) {
      // Count sections in prompt (approximate: count of ## headers)
      const sections = (prompt.match(/^##\s+/gm) || []).length;
      this.cognitiveLogger.logSnapshotGenerated(prompt.length, sections);
    }
    
    // Return prompt with metadata
    return {
      prompt,
      metadata: {
        anomalies: anomalies || [],
        compression: {
          originalSize,
          optimizedSize,
          reductionPercent,
          mode: deviationMode
        }
      }
    };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : undefined;
      
      console.error('[UnifiedPromptBuilder] Error generating snapshot:', errorMessage);
      if (errorStack) {
        console.error('[UnifiedPromptBuilder] Stack trace:', errorStack.substring(0, 1000));
      }
      
      // Log to cognitive logger if available
      if (this.cognitiveLogger) {
        this.cognitiveLogger.getChannel().appendLine(`❌ Snapshot generation failed: ${errorMessage}`);
        if (errorStack) {
          this.cognitiveLogger.getChannel().appendLine(`Stack: ${errorStack.substring(0, 500)}`);
        }
      }
      
      // Re-throw with more context
      throw new Error(`Failed to generate snapshot (mode: ${deviationMode}): ${errorMessage}`);
    }
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
    deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
    projectContext: ProjectContext;
    detectedProject?: { name: string; description?: string; structure?: string };
    codeState: CodeState;
    enginePatterns: any[];
    engineCorrelations: any[];
    engineForecasts: any[];
    anomalies?: any[];
  }): string {
    // Map deviation mode to threshold
    const thresholdMap: Record<string, number> = {
      'strict': 0.0,
      'flexible': 0.25,
      'exploratory': 0.50,
      'free': 1.0,
      'firstUse': 0.50  // Same as exploratory
    };
    const threshold = thresholdMap[data.deviationMode];
    
    // Get project name from detected project context (GENERIC, not RL4-specific)
    const projectName = data.detectedProject?.name || 
                        data.plan?.phase?.split(' ')[0] || 
                        path.basename(this.rl4Path).replace('.reasoning_rl4', '');
    
    let prompt = `# 🧠 ${projectName} — Development Context Snapshot\n`;
    prompt += `Generated: ${data.generated}\n`;
    prompt += `Confidence: ${(data.confidence * 100).toFixed(0)}% | Bias: ${(data.bias * 100).toFixed(0)}%\n\n`;
    
    // Bias alert if exceeds threshold (use user-selected mode, not config)
    const exceedsThreshold = data.bias > threshold;
    if (exceedsThreshold) {
      prompt += `⚠️ **DEVIATION ALERT**: Bias (${(data.bias * 100).toFixed(0)}%) exceeds ${data.deviationMode} threshold (${(threshold * 100).toFixed(0)}%)\n\n`;
    }
    
    // 🚨 CRITICAL: Add strict mode enforcement at the TOP (most visible)
    prompt += `---\n\n`;
    prompt += `# 🚨 CRITICAL RULES — READ THIS FIRST\n\n`;
    prompt += `**⚠️ BEFORE creating, modifying, or deleting ANY TypeScript file:**\n\n`;
    prompt += `1. **READ \`.reasoning_rl4/Plan.RL4\`** → Check \`deviation_mode: ${data.deviationMode}\`\n`;
    prompt += `2. **READ \`.reasoning_rl4/Tasks.RL4\`** → List active P0 tasks\n`;
    prompt += `3. **READ \`.reasoning_rl4/Context.RL4\`** → Check current bias: ${(data.bias * 100).toFixed(0)}%\n\n`;
    
    // Mode-specific critical rules
    if (data.deviationMode === 'strict') {
      prompt += `## 🚫 STRICT MODE (0% threshold) — ZERO DEVIATION TOLERANCE\n\n`;
      prompt += `**❌ ABSOLUTE PROHIBITIONS:**\n`;
      prompt += `- ❌ **DO NOT create new \`.ts\` files** unless explicitly a P0 task\n`;
      prompt += `- ❌ **DO NOT modify files** unless completing a P0 task\n`;
      prompt += `- ❌ **DO NOT add new features** even if "it's a good idea"\n\n`;
      prompt += `**✅ ONLY ALLOWED:**\n`;
      prompt += `- ✅ Modify files needed to complete P0 tasks\n`;
      prompt += `- ✅ Fix critical bugs (if P0 task)\n`;
      prompt += `- ✅ Answer questions WITHOUT code changes\n\n`;
      prompt += `**📋 MANDATORY PROCESS:**\n`;
      prompt += `\`\`\`\n`;
      prompt += `User proposes ANY idea → Your response:\n`;
      prompt += `1. Check Tasks.RL4 → Is this in P0 tasks? NO\n`;
      prompt += `2. STOP. Reply:\n`;
      prompt += `   "⛔ STRICT MODE: This is not in P0 tasks.\n`;
      prompt += `   \n`;
      prompt += `   Options:\n`;
      prompt += `   a) ❌ Reject (recommended)\n`;
      prompt += `   b) 📋 Add to backlog (bias stays ${(data.bias * 100).toFixed(0)}%)\n`;
      prompt += `   c) 🔄 Switch to Flexible mode (25% threshold)"\n`;
      prompt += `\`\`\`\n\n`;
    } else if (data.deviationMode === 'flexible') {
      prompt += `## ⚖️ FLEXIBLE MODE (25% threshold) — BALANCED APPROACH\n\n`;
      prompt += `**✅ ALLOWED:**\n`;
      prompt += `- ✅ P0 + P1 tasks\n`;
      prompt += `- ✅ Small improvements if bias < 25%\n`;
      prompt += `- ⚠️ Ask before P2/P3 tasks\n\n`;
      prompt += `**Current bias:** ${(data.bias * 100).toFixed(0)}% / 25% threshold\n`;
      if (data.bias > 0.25) {
        prompt += `⚠️ **WARNING:** Bias exceeds threshold! Focus on P0 tasks only.\n\n`;
      } else {
        prompt += `✅ **OK:** Within threshold. Small improvements allowed.\n\n`;
      }
    } else if (data.deviationMode === 'exploratory') {
      prompt += `## 🔍 EXPLORATORY MODE (50% threshold) — PROACTIVE INNOVATION\n\n`;
      prompt += `**✅ ALLOWED:**\n`;
      prompt += `- ✅ Explorations and improvements\n`;
      prompt += `- ✅ Optimization suggestions\n`;
      prompt += `- ⚠️ Calculate bias impact before implementing\n\n`;
      prompt += `**Current bias:** ${(data.bias * 100).toFixed(0)}% / 50% threshold\n\n`;
    } else if (data.deviationMode === 'free') {
      prompt += `## 🔥 FREE MODE (100% threshold) — NO RESTRICTIONS\n\n`;
      prompt += `**✅ ALLOWED:**\n`;
      prompt += `- ✅ Any modification\n`;
      prompt += `- ✅ File creation\n`;
      prompt += `- ⚠️ Always inform user of changes\n\n`;
    }
    
    prompt += `**🎯 CHECKLIST BEFORE ANY CODE CHANGE:**\n`;
    prompt += `\`\`\`\n`;
    prompt += `[ ] 1. Read Plan.RL4 → Mode: ${data.deviationMode}\n`;
    prompt += `[ ] 2. Read Tasks.RL4 → P0 tasks: [list them]\n`;
    prompt += `[ ] 3. Read Context.RL4 → Bias: ${(data.bias * 100).toFixed(0)}%\n`;
    prompt += `[ ] 4. Is this change in P0 tasks? [YES/NO]\n`;
    prompt += `[ ] 5. If NO, asked user confirmation? [YES/NO]\n`;
    prompt += `[ ] 6. Calculated bias impact? [YES/NO]\n`;
    prompt += `[ ] 7. Total bias < threshold? [YES/NO]\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `**If ANY checkbox is NO → STOP. Ask user first.**\n\n`;
    prompt += `---\n\n`;

    // Section 1: Plan (Strategic Intent)
    if (data.plan) {
      prompt += `## 📋 Plan (Strategic Intent)\n\n`;
      // Filter out internal RL4 development references (E3.3, etc.) from user-visible prompt
      const filteredPhase = this.filterInternalReferences(data.plan.phase);
      const filteredGoal = this.filterInternalReferences(data.plan.goal);
      prompt += `**Phase:** ${filteredPhase}\n`;
      prompt += `**Goal:** ${filteredGoal}\n\n`;
      prompt += `**Timeline:**\n`;
      prompt += `- Start: ${data.plan.timeline.start}\n`;
      prompt += `- Target: ${data.plan.timeline.target}\n\n`;
      
      if (data.plan.successCriteria.length > 0) {
        prompt += `**Success Criteria:**\n`;
        data.plan.successCriteria.forEach(c => {
          // Filter out internal RL4 development references
          const filtered = this.filterInternalReferences(c);
          if (filtered && filtered !== 'Initial Setup') { // Skip if filtered to placeholder
            prompt += `- ${filtered}\n`;
          }
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

    // Section 2.5: Deviation Guard (CRITICAL FOR AGENT LLM) — Reinforced reminder
    prompt += `## 🛡️ Deviation Guard (Active Constraints) — REMINDER\n\n`;
    prompt += `**⚠️ REMINDER:** You already read the CRITICAL RULES at the top. This is a reinforcement.\n\n`;
    // Filter out internal RL4 development references (E3.3, etc.) from user-visible prompt
    const filteredPhase = data.plan?.phase ? this.filterInternalReferences(data.plan.phase) : 'Unknown';
    prompt += `**Current Phase:** ${filteredPhase}\n`;
    prompt += `**Deviation Mode:** ${data.deviationMode} (${(threshold * 100).toFixed(0)}% threshold) — User-selected\n`;
    prompt += `**Current Bias:** ${(data.bias * 100).toFixed(0)}%\n\n`;
    
    if (data.deviationMode === 'strict') {
      prompt += `**🚫 STRICT MODE ACTIVE:** Zero deviation tolerance. Only P0 tasks allowed.\n\n`;
    }
    
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

    // Section 3.5: Code Implementation State (REAL CODE ANALYSIS)
    prompt += `## 💻 Code Implementation State (Real Analysis)\n\n`;
    prompt += `**⚠️ CRITICAL:** This section shows what's ACTUALLY implemented in code, not just goals.\n\n`;
    
    if (data.codeState.implementationStatus.length > 0) {
      prompt += `**Implementation Status vs Goals:**\n\n`;
      data.codeState.implementationStatus.forEach((status, idx) => {
        // Filter out internal RL4 development references from feature names
        const filteredFeature = this.filterInternalReferences(status.feature);
        
        // Skip if feature is filtered to placeholder (internal RL4 reference)
        if (filteredFeature === 'Initial Setup' || filteredFeature === 'Project goals to be defined') {
          return; // Skip this status entry
        }
        
        const emoji = status.status === 'implemented' ? '✅' : status.status === 'partial' ? '🟡' : '❌';
        prompt += `${idx + 1}. ${emoji} **${filteredFeature}** — ${status.status.toUpperCase()} (${(status.confidence * 100).toFixed(0)}% confidence)\n`;
        if (status.evidence.length > 0) {
          prompt += `   - Evidence: ${status.evidence.join(', ')}\n`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    if (data.codeState.keyFiles.length > 0) {
      prompt += `**Key Files Analyzed:**\n\n`;
      data.codeState.keyFiles.slice(0, 5).forEach((file, idx) => {
        prompt += `${idx + 1}. **${file.path}** (${(file.size / 1024).toFixed(1)} KB)\n`;
        if (file.functions.length > 0) {
          prompt += `   - Functions: ${file.functions.slice(0, 5).join(', ')}${file.functions.length > 5 ? '...' : ''}\n`;
        }
        if (file.classes.length > 0) {
          prompt += `   - Classes: ${file.classes.slice(0, 3).join(', ')}${file.classes.length > 3 ? '...' : ''}\n`;
        }
        prompt += `\n`;
      });
      prompt += `\n`;
    }

    if (data.codeState.techStack.languages.length > 0 || data.codeState.techStack.frameworks.length > 0) {
      prompt += `**Tech Stack Detected:**\n`;
      if (data.codeState.techStack.languages.length > 0) {
        prompt += `- Languages: ${data.codeState.techStack.languages.join(', ')}\n`;
      }
      if (data.codeState.techStack.frameworks.length > 0) {
        prompt += `- Frameworks: ${data.codeState.techStack.frameworks.join(', ')}\n`;
      }
      prompt += `\n`;
    }

    if (data.codeState.structure.entryPoints.length > 0) {
      prompt += `**Project Structure:**\n`;
      prompt += `- Entry Points: ${data.codeState.structure.entryPoints.join(', ')}\n`;
      if (data.codeState.structure.mainModules.length > 0) {
        prompt += `- Main Modules: ${data.codeState.structure.mainModules.slice(0, 3).join(', ')}${data.codeState.structure.mainModules.length > 3 ? '...' : ''}\n`;
      }
      prompt += `\n`;
    }

    prompt += `**🚨 IMPORTANT FOR LLM AGENT:**\n`;
    prompt += `- **ALWAYS check this section before suggesting implementations**\n`;
    prompt += `- If a feature is marked "implemented", verify by reading the actual files listed\n`;
    prompt += `- If a feature is "missing", you can suggest implementation\n`;
    prompt += `- If a feature is "partial", identify what's missing and complete it\n`;
    prompt += `- **DO NOT suggest features that are already implemented**\n\n`;

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
      prompt += `**💡 Note:** Even without automatic signals, you should consider creating ADRs for:\n`;
      prompt += `- Architectural decisions made during planning/design\n`;
      prompt += `- Technology choices (frameworks, libraries, tools)\n`;
      prompt += `- Design patterns adopted\n`;
      prompt += `- Project structure decisions\n`;
      prompt += `- Any decision that affects future development\n\n`;
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

    // Section: Engine-Generated Data (Preliminary - To Be Optimized by LLM)
    if (data.enginePatterns.length > 0 || data.engineCorrelations.length > 0 || data.engineForecasts.length > 0) {
      prompt += `---\n\n`;
      prompt += `## 🤖 Engine-Generated Data (Preliminary - Optimize via LLM)\n\n`;
      prompt += `**⚠️ IMPORTANT:** The following data was generated by deterministic algorithms (PatternLearningEngine, CorrelationEngine, ForecastEngine).\n`;
      prompt += `These are **preliminary suggestions** based on heuristics and mathematical calculations.\n`;
      prompt += `**Your task:** Analyze this data in the context of the project and improve/enrich it with semantic understanding.\n\n`;
      
      if (data.enginePatterns.length > 0) {
        prompt += `### 📊 Patterns Detected (${data.enginePatterns.length} patterns)\n\n`;
        prompt += `**Preliminary patterns from PatternLearningEngine:**\n\n`;
        data.enginePatterns.slice(0, 5).forEach((pattern, idx) => {
          prompt += `${idx + 1}. **${pattern.pattern_id || pattern.id || `pattern-${idx}`}**\n`;
          prompt += `   - Pattern: "${pattern.pattern || pattern.description || 'N/A'}"\n`;
          prompt += `   - Confidence: ${((pattern.confidence || 0) * 100).toFixed(0)}%\n`;
          prompt += `   - Impact: ${pattern.impact || 'unknown'}\n`;
          prompt += `   - Tags: ${(pattern.tags || []).join(', ') || 'none'}\n`;
          prompt += `   - Frequency: ${pattern.frequency || pattern.occurrences || 0}\n\n`;
        });
        prompt += `**💡 LLM Optimization Task:**\n`;
        prompt += `- Review each pattern in the context of the project (${data.detectedProject?.name || 'this project'})\n`;
        prompt += `- Improve pattern descriptions with semantic understanding\n`;
        prompt += `- Adjust confidence scores based on actual project context\n`;
        prompt += `- Identify missing patterns that algorithms couldn't detect\n`;
        prompt += `- Suggest pattern evolution trends based on project history\n\n`;
      }
      
      if (data.engineCorrelations.length > 0) {
        prompt += `### 🔗 Correlations Found (${data.engineCorrelations.length} correlations)\n\n`;
        prompt += `**Preliminary correlations from CorrelationEngine (cosine similarity):**\n\n`;
        data.engineCorrelations.slice(0, 5).forEach((corr, idx) => {
          prompt += `${idx + 1}. **${corr.id || `corr-${idx}`}**\n`;
          prompt += `   - Pattern: ${corr.pattern_id || 'unknown'}\n`;
          prompt += `   - Event: ${corr.event_id || 'unknown'}\n`;
          prompt += `   - Score: ${((corr.correlation_score || 0) * 100).toFixed(0)}% (mathematical)\n`;
          prompt += `   - Direction: ${corr.direction || 'unknown'}\n`;
          prompt += `   - Tags: ${(corr.tags || []).join(', ') || 'none'}\n\n`;
        });
        prompt += `**💡 LLM Optimization Task:**\n`;
        prompt += `- Validate correlations with semantic understanding (not just tag matching)\n`;
        prompt += `- Identify causal relationships that algorithms missed\n`;
        prompt += `- Adjust correlation scores based on actual project context\n`;
        prompt += `- Discover hidden connections between events and patterns\n\n`;
      }
      
      if (data.engineForecasts.length > 0) {
        prompt += `### 🔮 Forecasts Generated (${data.engineForecasts.length} forecasts)\n\n`;
        prompt += `**Preliminary forecasts from ForecastEngine (extrapolation):**\n\n`;
        data.engineForecasts.slice(0, 5).forEach((forecast, idx) => {
          prompt += `${idx + 1}. **${forecast.id || `forecast-${idx}`}**\n`;
          prompt += `   - Prediction: "${forecast.predicted_decision || forecast.decision || 'N/A'}"\n`;
          prompt += `   - Confidence: ${((forecast.confidence || 0) * 100).toFixed(0)}% (extrapolated)\n`;
          prompt += `   - Type: ${forecast.decision_type || 'unknown'}\n`;
          prompt += `   - Timeframe: ${forecast.timeframe || 'unknown'}\n`;
          prompt += `   - Related Patterns: ${(forecast.related_patterns || []).join(', ') || 'none'}\n\n`;
        });
        prompt += `**💡 LLM Optimization Task:**\n`;
        prompt += `- Improve predictions with contextual understanding\n`;
        prompt += `- Adjust confidence scores based on project reality\n`;
        prompt += `- Identify missing forecasts that algorithms couldn't predict\n`;
        prompt += `- Suggest actionable next steps based on forecasts\n\n`;
      }
      
      prompt += `**🎯 Your Output:**\n`;
      prompt += `In your response, you can:\n`;
      prompt += `1. **Keep** patterns/correlations/forecasts that are accurate\n`;
      prompt += `2. **Improve** them with better descriptions and adjusted confidence scores\n`;
      prompt += `3. **Add** new patterns/correlations/forecasts based on semantic analysis\n`;
      prompt += `4. **Remove** patterns/correlations/forecasts that don't make sense in this project context\n`;
      prompt += `5. **Update** the files \`patterns.json\`, \`correlations.json\`, \`forecasts.json\` if you make improvements\n\n`;
    }

    // Section: Anomalies Detected (Proactive Detection)
    if (data.anomalies && data.anomalies.length > 0) {
      prompt += `---\n\n`;
      prompt += `## 🚨 Anomalies Detected (Proactive Detection)\n\n`;
      prompt += `**⚠️ IMPORTANT:** The following anomalies were detected by analyzing the workspace context.\n`;
      prompt += `These are potential issues that require attention.\n\n`;
      
      data.anomalies.forEach((anomaly, idx) => {
        const severityEmoji = anomaly.severity === 'critical' ? '🔴' : 
                             anomaly.severity === 'high' ? '🟠' : 
                             anomaly.severity === 'medium' ? '🟡' : '🟢';
        
        prompt += `${idx + 1}. ${severityEmoji} **${anomaly.type.replace(/_/g, ' ').toUpperCase()}** (${anomaly.severity})\n`;
        prompt += `   - Description: ${anomaly.description}\n`;
        if (anomaly.context.metric) {
          prompt += `   - Metric: ${anomaly.context.metric} = ${anomaly.context.value}`;
          if (anomaly.context.expected) {
            prompt += ` (expected: ${anomaly.context.expected})`;
          }
          prompt += `\n`;
        }
        prompt += `   - Recommendation: ${anomaly.recommendation}\n\n`;
      });
      
      prompt += `**💡 LLM Analysis Task:**\n`;
      prompt += `- Review each anomaly in the context of the project\n`;
      prompt += `- Determine if these are real issues or false positives\n`;
      prompt += `- Add critical anomalies to Context.RL4 under "Risks" section\n`;
      prompt += `- Suggest actionable steps to address high/critical severity anomalies\n`;
      prompt += `- If false positives, note them for future anomaly detection improvement\n\n`;
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
    
    // KPI 2: Next Steps (Mode-Driven) - ENHANCED with ProjectContext
    prompt += `### 2. Next Steps (Mode-Driven: ${data.deviationMode})\n\n`;
    prompt += this.formatModeInstructions(data.deviationMode, data.projectContext, data.tasks, data.plan, data.detectedProject);
    
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
    // In First Use mode, skip the direct update section and force the REQUIRED OUTPUT format
    if (data.deviationMode !== 'firstUse') {
    prompt += `Based on the above KPIs, provide:\n\n`;
    prompt += `1. **Analysis:**\n`;
    prompt += `   - What is the current state vs Plan?\n`;
    prompt += `   - Are we on track? Any blockers?\n`;
    prompt += `   - What patterns do you see in timeline/file changes?\n\n`;
      prompt += `2. **Updates Required:**\n`;
    } else {
      prompt += `**🚨 CRITICAL FOR FIRST USE MODE:**\n\n`;
      prompt += `**DO NOT update files directly. You MUST follow the "REQUIRED OUTPUT FORMAT" section above first.**\n\n`;
      prompt += `**The format above (Step 1: Plan Files Read, Step 2: Conversation Analysis, Step 3: Merged Goals, Step 4: Proposed RL4 Files) is MANDATORY.**\n\n`;
      prompt += `**🎯 MANDATORY RULE: If existing RL4 files contain "E3.3", "RL4 system", or "Single Context Snapshot System":**\n`;
      prompt += `- These are **WRONG** — they track RL4 internals, not the project\n`;
      prompt += `- You **MUST** replace them with REAL project goals from plan files/conversation\n`;
      prompt += `- **DO NOT** propose keeping the RL4 template — always align on the real project\n\n`;
      prompt += `**Only AFTER providing that analysis should you update the RL4 files.**\n\n`;
      return prompt; // Early return for First Use mode - don't show update templates
    }
    
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

    prompt += `3. **ADRs (Architecture Decision Records):**\n`;
    prompt += `   **CRITICAL:** You MUST evaluate if any architectural decisions were made, even if not detected automatically.\n\n`;
    prompt += `   **When to create an ADR:**\n`;
    prompt += `   - ✅ Technology choices (frameworks, libraries, tools)\n`;
    prompt += `   - ✅ Design patterns adopted\n`;
    prompt += `   - ✅ Project structure decisions\n`;
    prompt += `   - ✅ Architectural changes (even small ones)\n`;
    prompt += `   - ✅ Decisions that affect future development\n`;
    prompt += `   - ✅ Trade-offs made between alternatives\n`;
    prompt += `   - ✅ First-time setup decisions (if this is a new project)\n\n`;
    prompt += `   **If ANY decision was made (even minor), create ADR in \`.reasoning_rl4/ADRs.RL4\`:**\n\n`;
    prompt += `   \`\`\`markdown\n`;
    prompt += `   ## ADR-XXX: [DECISION_TITLE]\n`;
    prompt += `   **Status**: proposed\n`;
    prompt += `   **Date**: ${new Date().toISOString().split('T')[0]}\n`;
    prompt += `   **Author**: Agent LLM\n\n`;
    prompt += `   ### Context\n`;
    prompt += `   [WHY_THIS_DECISION - What problem or need triggered this decision?]\n\n`;
    prompt += `   ### Decision\n`;
    prompt += `   [WHAT_WAS_DECIDED - What was chosen and why?]\n\n`;
    prompt += `   ### Consequences\n`;
    prompt += `   **Positive:**\n`;
    prompt += `   - [BENEFIT_1]\n\n`;
    prompt += `   **Negative:**\n`;
    prompt += `   - [RISK_1]\n\n`;
    prompt += `   **Risks:**\n`;
    prompt += `   - [POTENTIAL_RISK_1]\n\n`;
    prompt += `   **Alternatives Considered:**\n`;
    prompt += `   - [ALTERNATIVE_1 - Why it was rejected]\n`;
    prompt += `   \`\`\`\n\n`;
    prompt += `   **💡 Pro Tip:** Even if no automatic signals were detected, review the current state:\n`;
    prompt += `   - What technologies are being used? (Check Code Implementation State section)\n`;
    prompt += `   - What patterns are visible? (Check Cognitive Patterns section)\n`;
    prompt += `   - What decisions were made in Plan/Tasks? (Check Plan section)\n`;
    prompt += `   - If this is a new project, document initial setup decisions.\n\n`;

    prompt += `4. **Confidence/Bias Calculation:**\n`;
    prompt += `   - **Confidence** = Alignment between Plan and Reality (0.0-1.0)\n`;
    prompt += `     Formula: (tasksCompleted/tasksTotal * 0.4) + (activityLevel * 0.3) + (systemHealth * 0.3)\n`;
    prompt += `   - **Bias** = Drift from original Plan intent (0.0-1.0)\n`;
    prompt += `     Formula: Compare current Plan goal vs original goal (text similarity)\n\n`;

    prompt += `**Important:** Save all updates to \`.reasoning_rl4/\` directory. RL4 will detect changes and update internal state.\n`;

    return prompt;
  }

  /**
   * Format mode-specific instructions
   */
  private formatModeInstructions(
    mode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse',
    projectContext: ProjectContext,
    tasks: TasksData | null,
    plan: PlanData | null,
    detectedProject?: { name: string; description?: string; structure?: string }
  ): string {
    switch (mode) {
      case 'strict':
        return this.formatStrictMode(tasks);
      case 'flexible':
        return this.formatFlexibleMode(tasks);
      case 'exploratory':
        return this.formatExploratoryMode(projectContext, tasks);
      case 'free':
        return this.formatFreeMode(projectContext, plan);
      case 'firstUse':
        return this.formatFirstUseMode(detectedProject, projectContext);
      default:
        return this.formatFlexibleMode(tasks);
    }
  }

  /**
   * STRICT MODE: Zero deviation tolerance
   */
  private formatStrictMode(tasks: TasksData | null): string {
    let section = `**🚫 STRICT MODE (0% threshold) — Zero Deviation**\n\n`;
    
    section += `**Your role:** Execution Guardian — Protect the plan at all costs.\n\n`;
    
    section += `**Rules:**\n`;
    section += `1. ❌ **REJECT all new ideas** (add to backlog)\n`;
    section += `2. ✅ **Execute ONLY P0 tasks**\n`;
    section += `3. ⚠️ **Alert on ANY deviation**\n\n`;
    
    // List P0 tasks
    if (tasks && tasks.active.length > 0) {
      const p0Tasks = tasks.active.filter(t => !t.completed && t.task.includes('[P0]'));
      
      if (p0Tasks.length > 0) {
        section += `**P0 Tasks Remaining:**\n`;
        p0Tasks.forEach((t, idx) => {
          section += `${idx + 1}. ${t.task}\n`;
        });
        section += `\n`;
      } else {
        section += `✅ **All P0 tasks complete.** Phase ready to advance.\n\n`;
      }
    }
    
    section += `**Decision Framework:**\n`;
    section += `User proposes ANY idea → Your response:\n\n`;
    section += `\`\`\`\n`;
    section += `⛔ STRICT MODE: This idea is not in P0 tasks.\n\n`;
    section += `Options:\n`;
    section += `a) ❌ Reject (recommended)\n`;
    section += `b) 📋 Add to Future Backlog (bias stays 0%)\n`;
    section += `c) 🔄 Exit Strict Mode (switch to Flexible)\n`;
    section += `\`\`\`\n\n`;
    
    return section;
  }

  /**
   * FLEXIBLE MODE: Balanced approach
   */
  private formatFlexibleMode(tasks: TasksData | null): string {
    let section = `**⚖️ FLEXIBLE MODE (25% threshold) — Balanced**\n\n`;
    
    section += `**Your role:** Pragmatic Manager — Balance progress with quality.\n\n`;
    
    section += `**Rules:**\n`;
    section += `1. ✅ Focus on P0+P1 tasks\n`;
    section += `2. 🤔 Consider small improvements (bias < 25%)\n`;
    section += `3. ❓ Ask before adding P2/P3\n\n`;
    
    // List P0+P1 tasks
    if (tasks && tasks.active.length > 0) {
      const priorityTasks = tasks.active.filter(t => 
        !t.completed && (t.task.includes('[P0]') || t.task.includes('[P1]'))
      );
      
      if (priorityTasks.length > 0) {
        section += `**Priority Tasks (P0+P1):**\n`;
        priorityTasks.slice(0, 5).forEach((t, idx) => {
          section += `${idx + 1}. ${t.task}\n`;
        });
        section += `\n`;
      }
    }
    
    section += `**Improvement Suggestions:**\n`;
    section += `You may suggest 1-2 small improvements if:\n`;
    section += `- Aligned with current work\n`;
    section += `- Low effort (< 1 hour)\n`;
    section += `- Bias impact < 10%\n\n`;
    
    return section;
  }

  /**
   * EXPLORATORY MODE: Proactive innovation
   */
  private formatExploratoryMode(projectContext: ProjectContext, tasks: TasksData | null): string {
    let section = `**🔍 EXPLORATORY MODE (50% threshold) — Proactive Innovation**\n\n`;
    
    section += `**Your role:** Innovation Consultant — Find opportunities for improvement.\n\n`;
    
    // Project analysis
    section += `**Context Analysis:**\n`;
    section += `- Project maturity: ${projectContext.maturity}\n`;
    section += `- Stack: ${projectContext.stackDetected.join(', ') || 'generic'}\n`;
    section += `- Total cycles: ${projectContext.totalCycles}\n`;
    section += `- Project age: ${projectContext.projectAge} days\n`;
    section += `- Quality score: ${projectContext.qualityScore}/10\n\n`;
    
    section += `**Quality Breakdown:**\n`;
    section += `- Tests: ${projectContext.hasTests ? '✅ Detected' : '❌ Missing'}\n`;
    section += `- Linter: ${projectContext.hasLinter ? '✅ Configured' : '❌ Missing'}\n`;
    section += `- CI/CD: ${projectContext.hasCI ? '✅ Active' : '❌ Missing'}\n`;
    section += `- Hotspots: ${projectContext.hotspotCount} files (>30 edits)\n\n`;
    
    if (projectContext.topHotspots.length > 0) {
      section += `**Top Hotspots:**\n`;
      projectContext.topHotspots.slice(0, 3).forEach((h, idx) => {
        section += `${idx + 1}. ${h.file} — ${h.editCount} edits\n`;
      });
      section += `\n`;
    }
    
    section += `---\n\n`;
    
    section += `**🚀 YOUR MISSION (Proactive Analysis):**\n\n`;
    section += `**Step 1:** Analyze current state comprehensively\n`;
    section += `- What's working well? (strengths)\n`;
    section += `- What's missing? (gaps)\n`;
    section += `- What's inefficient? (bottlenecks)\n\n`;
    
    section += `**Step 2:** Detect 5-10 concrete opportunities\n`;
    section += `Categories:\n`;
    section += `- 🧪 Testing: Missing coverage\n`;
    section += `- 🏗️ Architecture: Hotspots to refactor\n`;
    section += `- ⚡ Performance: Optimization opportunities\n`;
    section += `- 🔧 DX: Tooling improvements\n`;
    section += `- 🛡️ Quality: Linter, formatter\n`;
    section += `- 🚀 CI/CD: Automation\n\n`;
    
    section += `**Step 3:** Provide implementation for EACH\n`;
    section += `- **Why**: Data-driven reason\n`;
    section += `- **What**: Solution + code example\n`;
    section += `- **Effort**: Realistic hours/days\n`;
    section += `- **Impact**: Quantified benefit\n`;
    section += `- **Priority**: 1-10\n`;
    section += `- **Bias**: +X%\n\n`;
    
    // Auto-detected opportunities
    section += `**🔍 Auto-Detected Opportunities:**\n\n`;
    
    if (!projectContext.hasTests) {
      section += `1. ❌ **No tests detected**\n`;
      section += `   → Priority: 9/10 (prevents 60% bugs)\n`;
      section += `   → Suggest: Add testing framework\n\n`;
    }
    
    if (projectContext.hotspotCount > 0) {
      section += `${!projectContext.hasTests ? '2' : '1'}. 🔥 **${projectContext.hotspotCount} hotspot(s) detected**\n`;
      section += `   → Priority: 8/10 (reduces cognitive load)\n`;
      section += `   → Suggest: Refactor ${projectContext.topHotspots[0]?.file || 'top file'}\n\n`;
    }
    
    if (!projectContext.hasCI) {
      section += `${this.getOpportunityNumber(projectContext)}. ⚠️ **No CI/CD detected**\n`;
      section += `   → Priority: 6/10 (automation)\n`;
      section += `   → Suggest: Setup GitHub Actions\n\n`;
    }
    
    if (!projectContext.hasLinter) {
      section += `${this.getOpportunityNumber(projectContext)}. ⚠️ **No linter detected**\n`;
      section += `   → Priority: 6/10 (code quality)\n`;
      section += `   → Suggest: Add ESLint + Prettier\n\n`;
    }
    
    // Strategy based on maturity
    if (projectContext.maturity === 'new') {
      section += `**🌱 New Project Strategy:**\n`;
      section += `Focus on **foundations** before features:\n`;
      section += `- Tests prevent future debt\n`;
      section += `- Linter establishes consistency\n`;
      section += `- CI catches issues early\n`;
      section += `- Good architecture avoids refactors\n\n`;
    } else if (projectContext.maturity === 'growing') {
      section += `**📈 Growing Project Strategy:**\n`;
      section += `Balance **features vs. quality**:\n`;
      section += `- Refactor hotspots before they become debt\n`;
      section += `- Add tests for critical paths\n`;
      section += `- Monitor performance metrics\n\n`;
    } else {
      section += `**🏆 Mature Project Strategy:**\n`;
      section += `Focus on **optimization**:\n`;
      section += `- Identify architectural improvements from patterns\n`;
      section += `- Performance optimizations from metrics\n`;
      section += `- Consider next-gen features\n\n`;
    }
    
    section += `**📋 REQUIRED OUTPUT FORMAT:**\n\n`;
    section += `\`\`\`markdown\n`;
    section += `## 🔍 Exploratory Analysis\n\n`;
    section += `### Project Health: [X/10]\n\n`;
    section += `**Strengths:** [List 2-3]\n`;
    section += `**Gaps:** [List 2-3]\n\n`;
    section += `### 🚀 5 Optimization Opportunities\n\n`;
    section += `#### 1. [IMPACT] [Title]\n`;
    section += `**Why:** [Reason with data]\n`;
    section += `**What:** [Solution]\n`;
    section += `**Implementation:**\n`;
    section += `\\\`\\\`\\\`[language]\n`;
    section += `[Complete code]\n`;
    section += `\\\`\\\`\\\`\n`;
    section += `**Effort:** [X hours] | **Impact:** [Benefit] | **Priority:** [X/10] | **Bias:** +[Y]%\n\n`;
    section += `... (4 more)\n\n`;
    section += `### Summary\n`;
    section += `Total bias if all: [X]% | Recommended: [Which to accept]\n`;
    section += `\`\`\`\n\n`;
    
    // Proposal protocol (non-engageant): ne pas modifier Tasks.RL4 sans validation
    section += `**🧩 RL4 Proposal Protocol (DO NOT edit Tasks.RL4 directly):**\n\n`;
    section += `You MUST output a non-committal proposal block for tasks. Use this exact format:\n\n`;
    section += `\`\`\`json\n`;
    section += `{\n`;
    section += `  "RL4_PROPOSAL": {\n`;
    section += `    "suggestedTasks": [\n`;
    section += `      {\n`;
    section += `        "id": "prop-001",\n`;
    section += `        "title": "Setup CI with GitHub Actions",\n`;
    section += `        "why": "Quality and automation improvement based on hotspots and missing CI",\n`;
    section += `        "what": ["Create workflow file", "Configure node versions", "Cache deps"],\n`;
    section += `        "effort": "6h",\n`;
    section += `        "roi": 8,\n`;
    section += `        "risk": "low",\n`;
    section += `        "bias": 5,\n`;
    section += `        "deps": [],\n`;
    section += `        "scope": "repo",\n`;
    section += `        "possibleDuplicateOf": "external-<taskId-if-any>"\n`;
    section += `      }\n`;
    section += `    ],\n`;
    section += `    "planContextUpdates": "Optional markdown proposed for Plan/Context (safe to apply)"\n`;
    section += `  }\n`;
    section += `}\n`;
    section += `\`\`\`\n\n`;
    section += `After the user validates decisions in the Dev tab, you will receive RL4_DECISION_REQUEST and MUST respond with RL4_TASKS_PATCH (see Free Mode block below for the exact schema).\n\n`;
    
    return section;
  }

  /**
   * FREE MODE: Visionary thinking
   */
  private formatFreeMode(projectContext: ProjectContext, plan: PlanData | null): string {
    let section = `**🔥 FREE MODE (100% threshold) — Visionary**\n\n`;
    
    section += `**Your role:** Technology Visionary — Think 10x, not 10%.\n\n`;
    
    section += `**No constraints. Challenge everything.**\n\n`;
    
    section += `---\n\n`;
    
    // Current state
    const projectName = path.basename(this.rl4Path).replace('.reasoning_rl4', '');
    section += `**Current State:**\n`;
    section += `- Project: ${projectName}\n`;
    section += `- Stack: ${projectContext.stackDetected.join(', ') || 'generic'}\n`;
    section += `- Maturity: ${projectContext.maturity} (${projectContext.totalCycles} cycles, ${projectContext.projectAge} days)\n`;
    section += `- Goal: ${plan?.goal || 'Not defined'}\n\n`;
    
    section += `---\n\n`;
    
    section += `**🎨 YOUR MISSION (Think Big):**\n\n`;
    
    section += `**Step 1:** Envision optimal future\n`;
    section += `- What if rebuilt from scratch?\n`;
    section += `- What architecture?\n`;
    section += `- What technologies?\n\n`;
    
    section += `**Step 2:** Challenge current approach\n`;
    section += `- Is this the right architecture?\n`;
    section += `- Optimal tools being used?\n`;
    section += `- Could we 10x this differently?\n\n`;
    
    section += `**Step 3:** Design transformation path\n`;
    section += `- What needs to change fundamentally?\n`;
    section += `- What's the inflection point?\n`;
    section += `- How to bridge current → future?\n\n`;
    
    section += `---\n\n`;
    
    section += `**🌟 BRAINSTORMING AREAS:**\n\n`;
    
    section += `### 1. 🏗️ Architecture Reimagination\n`;
    section += `- Event-driven vs request-response?\n`;
    section += `- Micro-frontends / microservices?\n`;
    section += `- Serverless / edge computing?\n`;
    section += `- Monorepo vs polyrepo?\n\n`;
    
    section += `### 2. ⚡ Technology Stack 2.0\n\n`;
    
    // Stack-specific suggestions
    if (projectContext.stackDetected.includes('react')) {
      section += `**React Innovations:**\n`;
      section += `- Solid.js (2x faster)\n`;
      section += `- Qwik (instant loading)\n`;
      section += `- Next.js 15 (RSC, Turbopack)\n\n`;
    }
    
    if (projectContext.stackDetected.includes('three') || projectContext.stackDetected.includes('three.js')) {
      section += `**Three.js Enhancements:**\n`;
      section += `- WebGPU (next-gen rendering)\n`;
      section += `- R3F (React Three Fiber)\n`;
      section += `- Babylon.js alternative\n\n`;
    }
    
    if (projectContext.stackDetected.includes('node') || projectContext.projectType === 'node') {
      section += `**Node.js Alternatives:**\n`;
      section += `- Bun (3x faster startup)\n`;
      section += `- Deno 2.0 (TypeScript-native)\n\n`;
    }
    
    section += `**Build Tools:**\n`;
    section += `- Turbopack (10x faster)\n`;
    section += `- Rspack (Rust-based)\n`;
    section += `- Bun (all-in-one)\n\n`;
    
    section += `### 3. 🚀 10x Performance\n`;
    section += `- Edge deployment (<50ms latency)\n`;
    section += `- WebAssembly (2-10x faster)\n`;
    section += `- Code splitting (↓80% bundle)\n`;
    section += `- Service worker (offline-first)\n\n`;
    
    section += `### 4. 🧠 AI Integration\n\n`;
    
    if (projectContext.stackDetected.includes('three') || projectContext.stackDetected.includes('three.js')) {
      section += `**AI for 3D:**\n`;
      section += `- Text → 3D models (Stable Diffusion)\n`;
      section += `- Procedural generation with GPT\n`;
      section += `- AI camera director (cinematic)\n\n`;
    } else {
      section += `**AI Opportunities:**\n`;
      section += `- AI code assistant\n`;
      section += `- Semantic search\n`;
      section += `- Auto test generation\n\n`;
    }
    
    section += `### 5. 🎨 UX Transformation\n`;
    section += `- Voice commands\n`;
    section += `- Multiplayer (WebRTC)\n`;
    section += `- VR/AR support\n`;
    section += `- Real-time collaboration\n\n`;
    
    section += `### 6. 💰 Business Model\n`;
    section += `- Freemium?\n`;
    section += `- Pro features?\n`;
    section += `- API marketplace?\n`;
    section += `- SaaS transformation?\n\n`;
    
    section += `---\n\n`;
    
    section += `**📋 REQUIRED OUTPUT:**\n\n`;
    section += `\`\`\`markdown\n`;
    section += `## 🔥 Vision: ${projectName} 2.0\n\n`;
    section += `### Current Trajectory\n`;
    section += `[Where heading with current approach]\n\n`;
    section += `### Optimal Future State\n`;
    section += `[What it should become]\n\n`;
    section += `### 🚀 10 Disruptive Ideas (ROI Ranked)\n\n`;
    section += `1. [GAME-CHANGER] [Idea]\n`;
    section += `   - Why: [Reason]\n`;
    section += `   - Tech: [Stack]\n`;
    section += `   - Effort: [Weeks]\n`;
    section += `   - ROI: [X/10]\n\n`;
    section += `... (9 more)\n\n`;
    section += `### Decision Matrix\n`;
    section += `| Idea | Effort | Impact | Risk | ROI |\n\n`;
    section += `### Strategic Roadmap\n`;
    section += `- Short (1-2w): Foundation\n`;
    section += `- Medium (1-3m): Differentiation\n`;
    section += `- Long (3-12m): Scale\n\n`;
    section += `### The Big Vision\n`;
    section += `[Inspiring future with market potential]\n`;
    section += `\`\`\`\n\n`;
    
    section += `**⚡ Key Principles:**\n`;
    section += `- Think 10x, not 10%\n`;
    section += `- Challenge assumptions\n`;
    section += `- Be bold but practical\n`;
    section += `- Inspire action\n\n`;
    
    // Proposal-first workflow: tasks are proposed, not applied
    section += `---\n\n`;
    section += `**🧩 RL4 Proposal-First Workflow (DO NOT edit Tasks.RL4 directly):**\n\n`;
    section += `1) Output a proposal block (RL4_PROPOSAL) with suggested tasks and optional Plan/Context markdown updates.\n`;
    section += `2) Wait for user decisions (accept P0/P1, backlog P2+, reject, or link to external task).\n`;
    section += `3) Only after decisions, output RL4_TASKS_PATCH with precise changes to apply to Tasks.RL4.\n\n`;
    
    section += `Use these exact schemas:\n\n`;
    
    // RL4_PROPOSAL (non-engageant)
    section += `\`\`\`json\n`;
    section += `{\n`;
    section += `  "RL4_PROPOSAL": {\n`;
    section += `    "suggestedTasks": [\n`;
    section += `      {\n`;
    section += `        "id": "prop-001",\n`;
    section += `        "title": "Transform mockup to SaaS foundation (Next.js + PostgreSQL)",\n`;
    section += `        "why": "High ROI transformation aligned with vision 2.0",\n`;
    section += `        "what": ["Init Next.js TS", "Design multi-tenant db", "Auth baseline"],\n`;
    section += `        "effort": "2w",\n`;
    section += `        "roi": 10,\n`;
    section += `        "risk": "medium",\n`;
    section += `        "bias": 20,\n`;
    section += `        "deps": [],\n`;
    section += `        "scope": "platform",\n`;
    section += `        "possibleDuplicateOf": null\n`;
    section += `      }\n`;
    section += `    ],\n`;
    section += `    "planContextUpdates": "Optional markdown proposed for Plan/Context (safe to apply)"\n`;
    section += `  }\n`;
    section += `}\n`;
    section += `\`\`\`\n\n`;
    
    // RL4_DECISION_REQUEST (fourni par RL4 après choix utilisateur) → votre réponse doit être un PATCH
    section += `RL4 will send back a decision payload like:\n`;
    section += `\`\`\`json\n`;
    section += `{\n`;
    section += `  "RL4_DECISION_REQUEST": {\n`;
    section += `    "decisions": [\n`;
    section += `      { "id": "prop-001", "action": "accept", "priority": "P0" },\n`;
    section += `      { "id": "prop-002", "action": "backlog", "priority": "P2" },\n`;
    section += `      { "id": "prop-003", "action": "reject" }\n`;
    section += `    ]\n`;
    section += `  }\n`;
    section += `}\n`;
    section += `\`\`\`\n\n`;
    
    // RL4_TASKS_PATCH (engageant) — à produire seulement après décisions
    section += `You MUST then respond with an apply-ready patch block (do not exceed bias threshold without explicit note):\n`;
    section += `\`\`\`json\n`;
    section += `{\n`;
    section += `  "RL4_TASKS_PATCH": {\n`;
    section += `    "applyTo": "Tasks.RL4",\n`;
    section += `    "bias_total": 25,\n`;
    section += `    "changes": [\n`;
    section += `      {\n`;
    section += `        "op": "add",\n`;
    section += `        "origin": "rl4",\n`;
    section += `        "priority": "P0",\n`;
    section += `        "title": "Setup SaaS foundation (Next.js + PostgreSQL)",\n`;
    section += `        "why": "Vision 2.0 — scalable platform",\n`;
    section += `        "steps": ["Init Next.js TS", "DB schema", "Auth baseline"],\n`;
    section += `        "linked_to": null\n`;
    section += `      }\n`;
    section += `    ]\n`;
    section += `  }\n`;
    section += `}\n`;
    section += `\`\`\`\n\n`;
    
    section += `If any suggested task matches an external plan task, set "possibleDuplicateOf" in RL4_PROPOSAL and prefer linking rather than duplicating.\n`;
    
    return section;
  }

  /**
   * FIRST USE MODE: Deep project discovery
   */
  private formatFirstUseMode(
    detectedProject?: { name: string; description?: string; structure?: string },
    projectContext?: ProjectContext
  ): string {
    let section = `**🔍 FIRST USE MODE (Deep Analysis) — Complete Project Discovery**\n\n`;
    
    section += `**🎯 CRITICAL: RL4 is STANDALONE — tracks THIS WORKSPACE's PROJECT independently.**\n`;
    section += `- Each workspace has its own \`.reasoning_rl4/\` directory\n`;
    section += `- RL4 files (Plan.RL4, Tasks.RL4, Context.RL4) track **THIS PROJECT**, not RL4 internals\n`;
    section += `- Ignore any mention of "RL4 system", "E3.3", "Single Context Snapshot System" — these are RL4 internals\n`;
    section += `- Extract goals/tasks from the **PROJECT** (plan files, README, conversation), NOT from RL4 system\n\n`;
    
    section += `**Your role:** Deep Discovery Agent — Understand this project from zero.\n\n`;
    
    section += `**Analysis Complete:**\n`;
    section += `- ✅ Project structure detected\n`;
    section += `- ✅ Tech stack analyzed\n`;
    section += `- ✅ Git history scanned\n`;
    section += `- ✅ Goals inferred\n\n`;
    
    // Detect and list plan files found
    const detectedPlanFiles = this.detectPlanFiles();
    if (detectedPlanFiles.length > 0) {
      section += `**📋 DETECTED PLAN FILES (MUST READ):**\n\n`;
      section += `**⚠️ CRITICAL:** The following plan files were found in this workspace. **YOU MUST READ THEM** before generating RL4 files:\n\n`;
      detectedPlanFiles.forEach((file, idx) => {
        section += `${idx + 1}. **\`${file}\`** — Read this file to extract goals, tasks, and context\n`;
      });
      section += `\n`;
      section += `**Action Required:**\n`;
      section += `1. Read each file listed above\n`;
      section += `2. Extract ALL goals, tasks, and decisions from these files\n`;
      section += `3. Use this content as PRIMARY source for Plan.RL4, Tasks.RL4, and Context.RL4\n`;
      section += `4. **DO NOT** copy the RL4 template — extract REAL project goals from detected files\n\n`;
      section += `---\n\n`;
    }
    
    section += `**🧠 CRITICAL: Conversation Context Analysis**\n\n`;
    section += `**⚠️ MANDATORY STEP — DO NOT SKIP:**\n\n`;
    section += `**You MUST analyze the ENTIRE conversation history in this chat session BEFORE generating any RL4 files.**\n\n`;
    section += `**Step 1: Review Conversation (REQUIRED)**\n`;
    section += `Scroll through the ENTIRE conversation and extract:\n`;
    section += `- **Questions asked:** [List every question the user asked]\n`;
    section += `- **Goals mentioned:** [List every goal/target discussed]\n`;
    section += `- **Tasks discussed:** [List every task/action mentioned]\n`;
    section += `- **Decisions made:** [List every decision taken]\n`;
    section += `- **Problems identified:** [List every blocker/issue mentioned]\n`;
    section += `- **Context shared:** [List any project context, requirements, constraints]\n\n`;
    section += `**Step 2: Extract Actionable Items (REQUIRED)**\n`;
    section += `From the conversation, create structured lists:\n`;
    section += `- **Goals from conversation:** [List them with priority]\n`;
    section += `- **Tasks from conversation:** [List them with [P0]/[P1] priority]\n`;
    section += `- **Decisions from conversation:** [List them for ADRs.RL4]\n`;
    section += `- **Blockers from conversation:** [List them for Context.RL4]\n\n`;
    section += `**Step 3: Merge Sources (REQUIRED)**\n`;
    section += `**🎯 CRITICAL: RL4 tracks THIS WORKSPACE's PROJECT, not the RL4 system itself.**\n\n`;
    section += `Combine information from:\n`;
    section += `1. **Detected plan files** (if any) — PRIMARY source (extract PROJECT goals/tasks)\n`;
    section += `2. **Conversation history** — SECONDARY source (fills gaps with PROJECT context)\n`;
    section += `3. **Project files** (README, package.json) — TERTIARY source (PROJECT documentation)\n`;
    section += `4. **Git history** — CONTEXT source (PROJECT commits, not RL4 internals)\n\n`;
    section += `**⚠️ IGNORE:** Any mention of "RL4 system", "E3.3", "Single Context Snapshot System" — these are RL4 internals, NOT the project.\n\n`;
    section += `**Step 4: Generate REAL RL4 Files (REQUIRED)**\n`;
    section += `**⚠️ CRITICAL:** Do NOT copy the RL4 template. Extract REAL project goals:\n`;
    section += `- If plan file says "Build authentication" → Plan.RL4 goal = "Build authentication"\n`;
    section += `- If conversation says "Add user dashboard" → Tasks.RL4 = "[P0] Add user dashboard"\n`;
    section += `- If README says "React app" → Context.RL4 = "Tech stack: React"\n\n`;
    section += `**Example (Good):**\n`;
    section += `User said: "I want to add authentication to the T7 Rewards System"\n`;
    section += `Plan file says: "Integrate Shotgun billetterie"\n`;
    section += `→ Plan.RL4 goal = "Add authentication to T7 Rewards System and integrate Shotgun billetterie"\n`;
    section += `→ Tasks.RL4 = "[P0] Setup authentication", "[P0] Integrate Shotgun API"\n`;
    section += `→ Context.RL4 = "Project: T7 Rewards System, Tech: HTML/CSS/JS, Status: Mockup complet"\n\n`;
    section += `**Example (Bad — DO NOT DO THIS):**\n`;
    section += `→ Plan.RL4 goal = "Simplify RL4, eliminate fake data" (this is the RL4 template, not the project!)\n`;
    section += `→ Plan.RL4 phase = "E3.3 - Single Context Snapshot System" (this is RL4 internals, not the project!)\n`;
    section += `→ Tasks.RL4 = "[P0] Test agent feedback loop" (this is RL4 system task, not project task!)\n\n`;
    section += `**🎯 REMINDER: RL4 is STANDALONE — each workspace tracks its OWN project independently.**\n\n`;
    
    if (detectedProject) {
      section += `**Project Statistics:**\n`;
      section += `- **Name**: ${detectedProject.name}\n`;
      if (detectedProject.description) {
        section += `- **Description**: ${detectedProject.description}\n`;
      }
      if (detectedProject.structure) {
        section += `- **Structure**: ${detectedProject.structure}\n`;
      }
      if (projectContext) {
        section += `- **Languages**: ${projectContext.stackDetected.join(', ') || 'Unknown'}\n`;
        section += `- **Maturity**: ${projectContext.maturity} (${projectContext.totalCycles} cycles, ${projectContext.projectAge} days)\n`;
      }
      section += `\n`;
    }
    
    section += `---\n\n`;
    
    section += `**🎯 Recommended Initial Actions**\n\n`;
    
    section += `**1. Project Onboarding Checklist:**\n`;
    section += `- [ ] Review project structure\n`;
    section += `- [ ] Understand tech stack choices\n`;
    section += `- [ ] Identify entry points (main files)\n`;
    section += `- [ ] Review recent commits for patterns\n`;
    section += `- [ ] Check for documentation (README, docs/)\n\n`;
    
    section += `**2. Development Environment Setup:**\n`;
    section += `- [ ] Install dependencies (\`npm install\` / \`yarn install\`)\n`;
    section += `- [ ] Check required Node.js version\n`;
    section += `- [ ] Verify build scripts work\n`;
    section += `- [ ] Test dev server startup\n`;
    section += `- [ ] Run existing tests (if any)\n\n`;
    
    section += `**3. Context Understanding:**\n`;
    section += `- [ ] Read through main application files\n`;
    section += `- [ ] Understand data flow\n`;
    section += `- [ ] Identify key modules/components\n`;
    section += `- [ ] Map dependencies between files\n`;
    section += `- [ ] Note architectural patterns\n\n`;
    
    section += `**4. Quick Wins (First Session):**\n`;
    section += `- [ ] Add missing documentation (if needed)\n`;
    section += `- [ ] Setup linter/formatter (if missing)\n`;
    section += `- [ ] Add basic tests (if none exist)\n`;
    section += `- [ ] Improve README with setup instructions\n`;
    section += `- [ ] Add .editorconfig for consistency\n\n`;
    
    section += `---\n\n`;
    
    section += `**💡 Next Steps**\n\n`;
    section += `Based on detected project context AND conversation history:\n`;
    section += `1. **Summarize Conversation**: Create a summary of everything discussed in this chat\n`;
    section += `2. **Extract Goals/Tasks**: Pull out all goals, tasks, and decisions from conversation\n`;
    section += `3. **Generate RL4 Files**: Create/update Plan.RL4, Tasks.RL4, Context.RL4 from:\n`;
    section += `   - Conversation context (primary source)\n`;
    section += `   - Detected project files (Plan.md, Tasks.md, README.md)\n`;
    section += `   - Git history (commits, branches)\n`;
    section += `   - Code structure (files, patterns)\n\n`;
    section += `4. **Propose Initial State**: Show user the generated RL4 files and ask for validation\n\n`;
    section += `**🚨 CRITICAL: REQUIRED OUTPUT FORMAT — DO NOT SKIP THIS SECTION**\n\n`;
    section += `**⚠️ BEFORE updating any RL4 files, you MUST provide this analysis in the EXACT format below:**\n\n`;
    section += `**Step 1: Read Detected Plan Files (MANDATORY)**\n`;
    section += `For each file listed in "DETECTED PLAN FILES" above:\n`;
    section += `- Read the file content\n`;
    section += `- Extract ALL goals, tasks, and decisions\n`;
    section += `- List them in your response\n\n`;
    section += `**Step 2: Analyze Conversation (MANDATORY)**\n`;
    section += `Scroll through the ENTIRE conversation and extract:\n`;
    section += `- Every question asked\n`;
    section += `- Every goal mentioned\n`;
    section += `- Every task discussed\n`;
    section += `- Every decision made\n\n`;
    section += `**Step 3: Provide Analysis in This EXACT Format (MANDATORY):**\n\n`;
    section += `\`\`\`markdown\n`;
    section += `## 🔍 First Use Analysis — REQUIRED FORMAT\n\n`;
    section += `### Step 1: Plan Files Read\n`;
    section += `**Files read:**\n`;
    section += `- [ ] \`.cursor/plans/shotgun-rew-78c1ac21.plan.md\` (or list all detected files)\n\n`;
    section += `**Content extracted from plan files:**\n`;
    section += `- Goal 1: [extract from plan file]\n`;
    section += `- Goal 2: [extract from plan file]\n`;
    section += `- Task 1: [extract from plan file]\n`;
    section += `- Task 2: [extract from plan file]\n`;
    section += `- Decision 1: [extract from plan file]\n\n`;
    section += `### Step 2: Conversation Analysis\n`;
    section += `**Conversation Summary (Last 10-15 minutes):**\n`;
    section += `[Summarize EVERYTHING discussed: questions, goals, tasks, decisions, blockers]\n\n`;
    section += `**Goals Extracted from Conversation:**\n`;
    section += `1. [Goal 1 from conversation]\n`;
    section += `2. [Goal 2 from conversation]\n`;
    section += `...\n\n`;
    section += `**Tasks Extracted from Conversation:**\n`;
    section += `- [P0] [Task 1 from conversation]\n`;
    section += `- [P1] [Task 2 from conversation]\n`;
    section += `...\n\n`;
    section += `**Decisions Extracted from Conversation:**\n`;
    section += `- [Decision 1]\n`;
    section += `- [Decision 2]\n`;
    section += `...\n\n`;
    section += `### Step 3: Merged Goals (Plan Files + Conversation)\n`;
    section += `**Combined goals (PRIMARY = plan files, SECONDARY = conversation):**\n`;
    section += `1. [Goal from plan file OR conversation]\n`;
    section += `2. [Goal from plan file OR conversation]\n`;
    section += `...\n\n`;
    section += `### Step 4: Proposed RL4 Files (REAL PROJECT GOALS, NOT TEMPLATE)\n`;
    section += `**⚠️ CRITICAL: These MUST contain REAL project goals, NOT the RL4 template!**\n\n`;
    section += `**🎯 MANDATORY: RL4 is a STANDALONE tool that tracks THIS WORKSPACE's project independently.**\n`;
    section += `- RL4 files (Plan.RL4, Tasks.RL4, Context.RL4) **MUST** track **THIS WORKSPACE's project**\n`;
    section += `- **NEVER** track the RL4 system itself (E3.3, "Single Context Snapshot System", etc.)\n`;
    section += `- Each workspace has its own independent RL4 tracking\n`;
    section += `- Extract goals/tasks from the **PROJECT** (plan files, conversation, README), not from RL4 internals\n\n`;
    section += `**🚨 IF YOU SEE EXISTING RL4 FILES WITH "E3.3" OR "RL4 system" GOALS:**\n`;
    section += `- These are **WRONG** — they track RL4 internals, not the project\n`;
    section += `- You **MUST** replace them with REAL project goals from plan files/conversation\n`;
    section += `- **DO NOT** propose "Option A: Keep RL4 template" — this is incorrect\n`;
    section += `- **ALWAYS** choose "Option B: Align RL4 on real project" — this is the correct approach\n\n`;
    section += `**Proposed Plan.RL4:**\n`;
    section += `\`\`\`markdown\n`;
    section += `## Phase\n`;
    section += `[Phase from plan file OR conversation, NOT "E3.3 - Single Context Snapshot System"]\n\n`;
    section += `## Goal\n`;
    section += `[REAL project goal from plan file OR conversation, NOT "Simplify RL4, eliminate fake data"]\n`;
    section += `\`\`\`\n\n`;
    section += `**Proposed Tasks.RL4:**\n`;
    section += `\`\`\`markdown\n`;
    section += `## Active (P0)\n`;
    section += `- [ ] [P0] [Task from plan file OR conversation]\n`;
    section += `- [ ] [P0] [Task from plan file OR conversation]\n`;
    section += `\`\`\`\n\n`;
    section += `**Proposed Context.RL4:**\n`;
    section += `[Generate Context.RL4 with initial KPIs based on current state]\n\n`;
    section += `**Validation Required:**\n`;
    section += `Please review the generated RL4 files above. Should I create/update them?\n`;
    section += `\`\`\`\n\n`;
    section += `**🚨 REMINDER: If you skip this format and go directly to updating files, you will copy the RL4 template instead of extracting real project goals!**\n\n`;
    section += `**This snapshot will improve as you:**\n`;
    section += `- Make more commits\n`;
    section += `- Update README/TODO files\n`;
    section += `- Generate more snapshots\n`;
    section += `- Let RL4 learn from your patterns\n`;
    section += `- **Continue conversations (I'll remember and extract context)**\n\n`;
    
    return section;
  }

  /**
   * Helper: Get opportunity number based on detected gaps
   */
  private getOpportunityNumber(context: ProjectContext): number {
    let count = 0;
    if (!context.hasTests) count++;
    if (context.hotspotCount > 0) count++;
    if (!context.hasCI) count++;
    if (!context.hasLinter) count++;
    return count;
  }

  /**
   * Filter out internal RL4 development references (E3.3, etc.) from user-visible content
   * This ensures production-ready prompts without internal development logs
   */
  private filterInternalReferences(text: string): string {
    if (!text) return text;
    
    // Replace internal development phase references with generic placeholder
    let filtered = text
      .replace(/E3\.3\s*-\s*Single Context Snapshot System/gi, 'Initial Setup')
      .replace(/E3\.3/gi, '')
      .replace(/Phase\s+E3\.3/gi, 'Initial Setup')
      .replace(/Simplify RL4, eliminate fake data, create agent feedback loop/gi, 'Project goals to be defined')
      .replace(/Test agent feedback loop/gi, 'Project tasks to be defined')
      .replace(/Create Plan\/Tasks\/Context\.RL4 structure/gi, 'Project setup')
      .replace(/1 button UI/gi, '') // Remove RL4 internal success criteria
      .replace(/Agent feedback loop functional/gi, '') // Remove RL4 internal success criteria
      .replace(/No fake data/gi, '') // Remove RL4 internal success criteria
      .trim();
    
    // If result is empty or only whitespace, return generic placeholder
    if (!filtered || filtered.length === 0) {
      return 'Initial Setup';
    }
    
    return filtered;
  }

  /**
   * Detect plan files in workspace (plan.md, .cursor/plans/*.plan.md, etc.)
   */
  private detectPlanFiles(): string[] {
    const planFiles: string[] = [];
    
    // Check root-level plan files
    const rootPlanFiles = ['plan.md', 'Plan.md', 'TODO.md', 'ROADMAP.md', 'GOALS.md', 'OBJECTIVES.md'];
    for (const file of rootPlanFiles) {
      const filePath = path.join(this.workspaceRoot, file);
      if (fs.existsSync(filePath)) {
        planFiles.push(file);
      }
    }
    
    // Check .cursor/plans/*.plan.md
    const cursorPlansDir = path.join(this.workspaceRoot, '.cursor', 'plans');
    if (fs.existsSync(cursorPlansDir)) {
      try {
        const files = fs.readdirSync(cursorPlansDir)
          .filter(f => f.endsWith('.plan.md'))
          .map(f => `.cursor/plans/${f}`);
        planFiles.push(...files);
      } catch {}
    }
    
    return planFiles;
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

  /**
   * Load patterns generated by PatternLearningEngine
   * These are preliminary patterns based on heuristics - LLM will optimize them
   */
  private loadEnginePatterns(): any[] {
    try {
      const patternsPath = path.join(this.rl4Path, 'patterns.json');
      if (!fs.existsSync(patternsPath)) {
        return [];
      }
      
      const content = fs.readFileSync(patternsPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Handle both array and object with patterns property
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.patterns && Array.isArray(parsed.patterns)) {
        return parsed.patterns;
      }
      
      return [];
    } catch (error) {
      console.warn('[UnifiedPromptBuilder] Failed to load patterns:', error);
      return [];
    }
  }

  /**
   * Load correlations generated by CorrelationEngine
   * These are preliminary correlations based on cosine similarity - LLM will optimize them
   */
  private loadEngineCorrelations(): any[] {
    try {
      const correlationsPath = path.join(this.rl4Path, 'correlations.json');
      if (!fs.existsSync(correlationsPath)) {
        return [];
      }
      
      const content = fs.readFileSync(correlationsPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Handle both array and object with correlations property
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.correlations && Array.isArray(parsed.correlations)) {
        return parsed.correlations;
      }
      
      return [];
    } catch (error) {
      console.warn('[UnifiedPromptBuilder] Failed to load correlations:', error);
      return [];
    }
  }

  /**
   * Load forecasts generated by ForecastEngine
   * These are preliminary forecasts based on extrapolation - LLM will optimize them
   */
  private loadEngineForecasts(): any[] {
    try {
      const forecastsPath = path.join(this.rl4Path, 'forecasts.json');
      if (!fs.existsSync(forecastsPath)) {
        return [];
      }
      
      const content = fs.readFileSync(forecastsPath, 'utf-8');
      const parsed = JSON.parse(content);
      
      // Handle both array and object with forecasts property
      if (Array.isArray(parsed)) {
        return parsed;
      } else if (parsed.forecasts && Array.isArray(parsed.forecasts)) {
        return parsed.forecasts;
      }
      
      return [];
    } catch (error) {
      console.warn('[UnifiedPromptBuilder] Failed to load forecasts:', error);
      return [];
    }
  }
}


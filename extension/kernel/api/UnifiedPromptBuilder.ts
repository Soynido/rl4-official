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
import * as crypto from 'crypto';
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
import { AdHocTracker, AdHocAction } from '../cognitive/AdHocTracker';
import { ActivityReconstructor, ActivitySummary } from './ActivityReconstructor'; // ✅ P2: Activity reconstruction

// ============================================================================
// RL4 SNAPSHOT SYSTEM - Interfaces and Types
// ============================================================================

interface SnapshotData {
  plan: PlanData | null;
  tasks: TasksData | null;
  context: ContextData | null;
  adrs: any[];
  historySummary: HistorySummary | null;
  biasReport: BiasReport;
  confidence: number;
  bias: number;
  timeline: any[];
  filePatterns: any;
  gitHistory: any[];
  healthTrends: any[];
  enrichedCommits: EnrichedCommit[];
  adHocActions: AdHocAction[];
  enginePatterns: any[];
  engineCorrelations: any[];
  engineForecasts: any[];
  anomalies: any[];
  projectContext: ProjectContext;
  detectedProject?: { name: string; description?: string; structure?: string };
  codeState: CodeState;
  bootstrap: any | null;
  generated: string;
  deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  generatedTimestamp: Date;
  metadata: SnapshotMetadata;
}

interface SnapshotMetadata {
  kernelCycle: number;
  merkleRoot: string;
  kernelFlags: { safeMode: boolean; ready: boolean };
  deviationMode: string;
  compressionRatio: number;
  dataHashes: { plan: string | null; tasks: string | null; context: string | null; ledger: string | null };
  anomalies: any[];
  compression: { originalSize: number; optimizedSize: number; reductionPercent: number; mode: string };
}

interface PromptProfile {
  mode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  includeTasks: { P0: boolean; P1: boolean; P2: boolean; completed: boolean };
  sections: {
    plan: boolean;
    tasks: boolean;
    context: 'minimal' | 'rich' | 'complete';
    timeline: false | 'condensed' | 'complete' | 'extended';
    blindSpot: false | 'selective' | 'complete' | 'extended';
    engineData: 'minimal' | 'complete';
    anomalies: 'critical' | 'medium,critical' | 'all';
    historySummary: boolean;
    bootstrap: boolean;
  };
  compression: 'aggressive' | 'moderate' | 'minimal' | 'none';
  rules: { threshold: number; suppressRedundancy: boolean; focusP0: boolean };
}

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
  private adHocTracker: AdHocTracker;

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
    this.adHocTracker = new AdHocTracker(this.workspaceRoot);
  }

  // ============================================================================
  // RL4 SNAPSHOT SYSTEM - Profile Configurations
  // ============================================================================

  private readonly profiles: Record<string, PromptProfile> = {
    strict: {
      mode: 'strict',
      includeTasks: { P0: true, P1: false, P2: false, completed: false },
      sections: {
        plan: true,
        tasks: true,
        context: 'minimal',
        timeline: false,
        blindSpot: false,
        engineData: 'minimal',
        anomalies: 'critical',
        historySummary: false,
        bootstrap: false
      },
      compression: 'aggressive',
      rules: { threshold: 0.0, suppressRedundancy: true, focusP0: true }
    },
    flexible: {
      mode: 'flexible',
      includeTasks: { P0: true, P1: true, P2: false, completed: false },
      sections: {
        plan: true,
        tasks: true,
        context: 'rich',
        timeline: 'condensed',
        blindSpot: 'selective',
        engineData: 'complete',
        anomalies: 'medium,critical',
        historySummary: false,
        bootstrap: false
      },
      compression: 'moderate',
      rules: { threshold: 0.25, suppressRedundancy: true, focusP0: false }
    },
    exploratory: {
      mode: 'exploratory',
      includeTasks: { P0: true, P1: true, P2: true, completed: false },
      sections: {
        plan: true,
        tasks: true,
        context: 'complete',
        timeline: 'complete',
        blindSpot: 'complete',
        engineData: 'complete',
        anomalies: 'all',
        historySummary: false,
        bootstrap: false
      },
      compression: 'minimal',
      rules: { threshold: 0.50, suppressRedundancy: false, focusP0: false }
    },
    free: {
      mode: 'free',
      includeTasks: { P0: true, P1: true, P2: true, completed: true },
      sections: {
        plan: true,
        tasks: true,
        context: 'complete',
        timeline: 'extended',
        blindSpot: 'extended',
        engineData: 'complete',
        anomalies: 'all',
        historySummary: true,
        bootstrap: false
      },
      compression: 'none',
      rules: { threshold: 1.0, suppressRedundancy: false, focusP0: false }
    },
    firstUse: {
      mode: 'firstUse',
      includeTasks: { P0: true, P1: true, P2: true, completed: false },
      sections: {
        plan: true,
        tasks: true,
        context: 'complete',
        timeline: 'complete',
        blindSpot: 'complete',
        engineData: 'complete',
        anomalies: 'all',
        historySummary: false,
        bootstrap: true
      },
      compression: 'minimal',
      rules: { threshold: 0.50, suppressRedundancy: false, focusP0: false }
    }
  };

  /**
   * Generate unified context snapshot with user-selected deviation mode
   * @param deviationMode - User's perception angle (strict/flexible/exploratory/free/firstUse)
   * @returns Prompt with metadata (anomalies, compression metrics)
   */
  async generate(deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse' = 'flexible'): Promise<{
    prompt: string;
    metadata: SnapshotMetadata;
  }> {
    try {
    const now = new Date();
    
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

    // PHASE 0: Build SnapshotData (agrège et normalise toutes les données)
    const snapshotData = await this.buildSnapshotData(deviationMode);
    
    // PHASE 1: Format prompt selon profile
    const profile = this.profiles[deviationMode];
    let prompt = await this.formatPrompt(snapshotData, profile);
    
    // PHASE 2: Optimize/compress selon profile
    const originalSize = prompt.length;
    prompt = await this.promptOptimizer.optimize(prompt, deviationMode);
    const optimizedSize = prompt.length;
    const compressionRatio = originalSize > 0 ? (originalSize - optimizedSize) / originalSize : 0;
    
    // PHASE 3: Update metadata avec compression
    snapshotData.metadata.compressionRatio = compressionRatio;
    snapshotData.metadata.compression = {
      originalSize,
      optimizedSize,
      reductionPercent: compressionRatio * 100,
      mode: deviationMode
    };
    
    // Phase 5: Log snapshot generated (after prompt generation and optimization)
    if (this.cognitiveLogger) {
      // Count sections in prompt (approximate: count of ## headers)
      const sections = (prompt.match(/^##\s+/gm) || []).length;
      this.cognitiveLogger.logSnapshotGenerated(prompt.length, sections);
    }
    
    // Return prompt with enriched metadata
    return {
      prompt,
      metadata: snapshotData.metadata
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
   * Format unified prompt (REFACTORED - RL4 Snapshot System)
   * Order of sections is STRICTLY IMPOSED and IDENTICAL for all 5 modes
   */
  private async formatPrompt(data: SnapshotData, profile: PromptProfile): Promise<string> {
    // BEGIN RL4 SNAPSHOT
    let prompt = `BEGIN RL4 SNAPSHOT\n\n`;
    
    // HEADER (with metadata, minimap, boundaries)
    prompt += this.buildHeader(data, profile);
    
    // CRITICAL RULES (always first)
    prompt += this.buildCriticalRules(data, profile);
    
    // ✅ P0-FIRSTUSE-OPTIMIZATION: PROJECT CONTEXT DISCOVERY for firstUse mode
    if (profile.mode === 'firstUse') {
      prompt += this.buildProjectContextDiscovery(data);
    }
    
    // CHAT MEMORY (always second)
    prompt += this.buildChatMemory(data);
    
    // PLAN (if profile allows)
    if (profile.sections.plan && data.plan) {
      prompt += this.buildPlan(data.plan);
    }
    
    // TASKS (if profile allows, filtered by profile.includeTasks)
    if (profile.sections.tasks && data.tasks) {
      prompt += this.buildTasks(data.tasks, profile);
    }
    
    // CONTEXT (if profile allows, level according to profile.sections.context)
    if (profile.sections.context && data.context) {
      prompt += this.buildContext(data.context, profile.sections.context, data);
    }
    
    // ✅ P2: ACTIVITY RECONSTRUCTION (if not firstUse and last snapshot exists)
    if (profile.mode !== 'firstUse') {
      const activitySection = await this.buildActivityReconstruction(data);
      if (activitySection) {
        prompt += activitySection;
      }
    }
    
    // BOOTSTRAP (firstUse only)
    if (profile.sections.bootstrap && data.bootstrap) {
      prompt += this.buildBootstrapSection(data.bootstrap);
    }
    
    // TIMELINE + BLINDSPOT (if profile allows)
    if (profile.sections.timeline !== false) {
      prompt += this.buildTimelineAndBlindSpot(data, profile);
    }
    
    // HISTORY SUMMARY (free only)
    if (profile.sections.historySummary && data.historySummary) {
      prompt += this.buildHistorySummary(data.historySummary);
    }
    
    // ENGINE DATA (if profile allows)
    if (profile.sections.engineData !== 'minimal' || (data.enginePatterns.length > 0 || data.engineCorrelations.length > 0 || data.engineForecasts.length > 0)) {
      prompt += this.buildEngineData(data, profile.sections.engineData);
    }
    
    // ANOMALIES (if profile allows, filtered by profile.sections.anomalies)
    if (profile.sections.anomalies !== 'critical' || data.anomalies.length > 0) {
      prompt += this.buildAnomalies(data.anomalies, profile.sections.anomalies);
    }
    
    // AGENT INSTRUCTIONS (always last)
    prompt += this.buildAgentInstructions(data, profile);
    
    // END RL4 SNAPSHOT
    prompt += `\nEND RL4 SNAPSHOT\n`;
    
    // Enforce size limits
    prompt = this.enforceSizeLimits(prompt, profile);
    
    return prompt;
  }

  /**
   * OLD formatPrompt - DEPRECATED (kept for reference, will be removed)
   */
  private formatPrompt_OLD(data: {
    plan: PlanData | null;
    tasks: TasksData | null;
    context: ContextData | null;
    adrs: any[];
    historySummary: HistorySummary;
    biasReport: BiasReport;
    enrichedCommits: EnrichedCommit[];
    adHocActions: AdHocAction[];  // Ad-hoc actions (unplanned tasks)
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
    generatedTimestamp: Date;
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

    // NEW SECTION: Chat Conversation Memory
    prompt += `## 💬 Chat Conversation Memory — PRIMARY CONTEXT SOURCE\n\n`;
    prompt += `**🎯 CRITICAL INSTRUCTION FOR LLM:**\n\n`;
    prompt += `Before reading ANY section below, **FIRST consult the chat conversation history** in your current context window.\n\n`;
    prompt += `**Why?** The chat contains:\n`;
    prompt += `- ✅ **Real-time user intent** (what the user wants RIGHT NOW)\n`;
    prompt += `- ✅ **Recent decisions** (what was just discussed and agreed)\n`;
    prompt += `- ✅ **Corrections & clarifications** (user feedback on your proposals)\n`;
    prompt += `- ✅ **Active blockers** (problems the user is currently facing)\n`;
    prompt += `- ✅ **Context updates** (changes since the last snapshot was generated)\n\n`;
    prompt += `**Prioritization Hierarchy:**\n`;
    prompt += `1. 🥇 **Chat conversation** (most recent, highest priority)\n`;
    prompt += `2. 🥈 **Tasks.RL4** (active tasks, tactical TODOs)\n`;
    prompt += `3. 🥉 **Plan.RL4** (strategic vision, long-term)\n`;
    prompt += `4. 📊 **Snapshot data below** (historical context, blind spots)\n\n`;
    prompt += `**Example Workflow:**\n`;
    prompt += `\`\`\`\n`;
    prompt += `User in chat: "Le snapshot est trop générique, enrichis-le"\n`;
    prompt += `\n`;
    prompt += `❌ BAD RESPONSE (ignoring chat):\n`;
    prompt += `  → Read Tasks.RL4 → See "Commit 102 fichiers" as P0\n`;
    prompt += `  → Respond: "I'll commit the files now"\n`;
    prompt += `  → WRONG: User wanted snapshot enrichment, not commit\n`;
    prompt += `\n`;
    prompt += `✅ GOOD RESPONSE (chat-first):\n`;
    prompt += `  → Read chat → User wants snapshot enrichment\n`;
    prompt += `  → Check if enrichment is in Tasks.RL4 (NO)\n`;
    prompt += `  → Check deviation_mode: strict (0% threshold)\n`;
    prompt += `  → Respond: "⛔ STRICT MODE: Enrichment not in P0 tasks.\n`;
    prompt += `               Options: a) Reject b) Add to backlog c) Switch to Flexible"\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `**💡 Key Insight:**\n`;
    prompt += `This snapshot was generated at **${data.generatedTimestamp.toISOString()}**. Any conversation AFTER this timestamp contains MORE RECENT context than the data below. Always prioritize chat over snapshot data when there's a conflict.\n\n`;
    prompt += `---\n\n`;
    
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

    // Section 5.75: Ad-Hoc Actions (Unplanned Tasks Detection)
    if (data.adHocActions && data.adHocActions.length > 0) {
      prompt += `## 🔍 Ad-Hoc Actions (Unplanned Tasks)\n\n`;
      prompt += `**Detected:** ${data.adHocActions.length} unplanned actions in last 2 hours\n\n`;
      
      // Group by confidence
      const highConfidence = data.adHocActions.filter((a: AdHocAction) => a.confidence === 'HIGH');
      const mediumConfidence = data.adHocActions.filter((a: AdHocAction) => a.confidence === 'MEDIUM');
      const lowConfidence = data.adHocActions.filter((a: AdHocAction) => a.confidence === 'LOW');
      
      if (highConfidence.length > 0) {
        prompt += `**🔴 High Confidence (${highConfidence.length}):**\n\n`;
        highConfidence.forEach((action: AdHocAction, idx: number) => {
          const time = new Date(action.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          prompt += `${idx + 1}. **${action.suggestedTask}**\n`;
          prompt += `   - Time: ${time}\n`;
          prompt += `   - Action: ${action.action}\n`;
          if (action.command) prompt += `   - Command: \`${action.command}\`\n`;
          if (action.file) prompt += `   - File: ${action.file}\n`;
          if (action.commitMessage) prompt += `   - Commit: "${action.commitMessage}"\n`;
          prompt += `   - Reason: ${action.reason}\n\n`;
        });
      }
      
      if (mediumConfidence.length > 0) {
        prompt += `**🟡 Medium Confidence (${mediumConfidence.length}):**\n\n`;
        mediumConfidence.slice(0, 5).forEach((action: AdHocAction, idx: number) => {
          const time = new Date(action.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
          prompt += `${idx + 1}. **${action.suggestedTask}** (${time})\n`;
          if (action.command) prompt += `   - \`${action.command.substring(0, 60)}${action.command.length > 60 ? '...' : ''}\`\n`;
        });
        prompt += `\n`;
      }
      
      if (lowConfidence.length > 0) {
        prompt += `**⚪ Low Confidence (${lowConfidence.length}):** Complex commands without clear intent\n\n`;
      }
      
      prompt += `**💡 LLM Instructions:**\n`;
      prompt += `Review the high-confidence ad-hoc actions above. For each:\n`;
      prompt += `1. **Validate** if it should become a formal task in Tasks.RL4\n`;
      prompt += `2. **Suggest** adding it with appropriate priority (P0/P1/P2)\n`;
      prompt += `3. **Link** to existing tasks if it's part of ongoing work\n`;
      prompt += `4. **Ignore** if it's routine maintenance or trivial\n\n`;
      prompt += `**Example suggestion format:**\n`;
      prompt += `"Add task: [P1] Install axios dependency @rl4:id=ad-hoc-001 @rl4:completeWhen='npm success'"\n\n`;
    } else {
      prompt += `## 🔍 Ad-Hoc Actions\n\n`;
      prompt += `- No unplanned actions detected in last 2 hours\n`;
      prompt += `- All terminal activity is linked to formal tasks ✅\n\n`;
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

    // Section 6.5: RL4 Terminal Usage Instructions (CRITICAL for LLM calibration)
    prompt += `## 🖥️ RL4 Terminal — Usage Instructions for LLM Agent\n\n`;
    prompt += `**🚨 CRITICAL: You MUST instruct the user to execute commands in the RL4 Terminal, not regular terminal.**\n\n`;
    prompt += `### Why RL4 Terminal?\n\n`;
    prompt += `- ✅ **Structured Logging**: All commands are automatically logged to \`.reasoning_rl4/terminal-events.jsonl\`\n`;
    prompt += `- ✅ **Task Verification**: The Kernel RL4 can verify task completion based on exit codes and output\n`;
    prompt += `- ✅ **Pattern Learning**: Repeated executions help RL4 learn patterns and auto-suggest completion conditions\n`;
    prompt += `- ✅ **Real-time Tracking**: Your enriched prompts help RL4 parse the right information and stay close to real-time reality\n\n`;
    prompt += `### How to Use (LLM Instructions):\n\n`;
    prompt += `**When suggesting commands to execute:**\n\n`;
    prompt += `1. **ALWAYS instruct the user to open RL4 Terminal first:**\n`;
    prompt += `   \`\`\`\n`;
    prompt += `   "Open RL4 Terminal: Cmd+Shift+P → 'RL4: Open Terminal'\n`;
    prompt += `   \`\`\`\n\n`;
    prompt += `2. **For task execution, use helper functions:**\n`;
    prompt += `   \`\`\`bash\n`;
    prompt += `   # Example: Running a test task\n`;
    prompt += `   rl4_run task-001 "npm test"\n`;
    prompt += `   # This automatically logs: task_start → command → task_result\n`;
    prompt += `   \`\`\`\n\n`;
    prompt += `3. **For manual logging (if needed):**\n`;
    prompt += `   \`\`\`bash\n`;
    prompt += `   rl4_task_start task-001 "npm install axios"\n`;
    prompt += `   npm install axios\n`;
    prompt += `   rl4_task_result task-001 success $?\n`;
    prompt += `   \`\`\`\n\n`;
    prompt += `4. **For ad-hoc actions (unplanned tasks):**\n`;
    prompt += `   \`\`\`bash\n`;
    prompt += `   npm install axios  # RL4_ACTION: Add HTTP client for API calls\n`;
    prompt += `   # Or use helper:\n`;
    prompt += `   rl4_action "Add HTTP client for API calls"\n`;
    prompt += `   \`\`\`\n\n`;
    prompt += `5. **ENRICHIR les commandes avec du contexte (CRITIQUE pour le Kernel):**\n`;
    prompt += `   \`\`\`bash\n`;
    prompt += `   # ❌ MAUVAIS (pas de contexte)\n`;
    prompt += `   rl4_run task-001 "npm test"\n`;
    prompt += `   \n`;
    prompt += `   # ✅ BON (enrichi avec contexte)\n`;
    prompt += `   # Context: Running unit tests for authentication module\n`;
    prompt += `   # Expected: All 42 tests pass, coverage >80%\n`;
    prompt += `   rl4_run task-001 "npm test -- --testPathPattern=auth"\n`;
    prompt += `   \`\`\`\n\n`;
    prompt += `   **Pourquoi enrichir ?**\n`;
    prompt += `   - Le Kernel RL4 parse les logs et extrait les patterns\n`;
    prompt += `   - Tes commentaires contextuels aident le Kernel à comprendre l'intention\n`;
    prompt += `   - Le Kernel peut mieux suggérer des \`@rl4:completeWhen\` conditions\n`;
    prompt += `   - Les patterns appris sont plus précis avec du contexte\n\n`;
    prompt += `### What Happens Next?\n\n`;
    prompt += `1. **You enrich the prompt** → User sees instructions to use RL4 Terminal + contexte enrichi\n`;
    prompt += `2. **User executes in RL4 Terminal** → Commands + commentaires contextuels sont loggés dans \`terminal-events.jsonl\`\n`;
    prompt += `3. **Kernel RL4 parses logs** → Extrait les patterns d'exécution, mais AUSSI le contexte que tu as ajouté\n`;
    prompt += `4. **Kernel apprend mieux** → Grâce à ton enrichissement, le Kernel comprend l'intention et suggère de meilleures conditions\n`;
    prompt += `5. **Next snapshot includes enriched data** → Tu reçois un meilleur contexte sur l'exécution réelle + patterns appris\n\n`;
    prompt += `**💡 Clé du succès :** Ton enrichissement (commentaires, descriptions, métadonnées) optimise le "sniffing" du Kernel et l'aide à parser les bonnes informations, restant proche du temps réel et de la réalité.\n\n`;
    prompt += `### Example Workflow (avec enrichissement):\n\n`;
    prompt += `\`\`\`\n`;
    prompt += `User: "Run the tests"\n`;
    prompt += `\n`;
    prompt += `You (LLM):\n`;
    prompt += `"To track this task execution, please:\n`;
    prompt += `1. Open RL4 Terminal: Cmd+Shift+P → 'RL4: Open Terminal'\n`;
    prompt += `2. Run this enriched command:\n`;
    prompt += `\n`;
    prompt += `   # Context: Running unit tests for authentication module\n`;
    prompt += `   # Expected: All 42 tests pass, coverage >80%\n`;
    prompt += `   # Related files: src/auth/*.test.ts\n`;
    prompt += `   rl4_run test-task-001 'npm test -- --testPathPattern=auth'\n`;
    prompt += `\n`;
    prompt += `This will automatically log the execution with context, helping RL4:\n`;
    prompt += `- Verify task completion\n`;
    prompt += `- Learn patterns (auth tests typically take 5-8s)\n`;
    prompt += `- Suggest better completion conditions for similar tasks"\n`;
    prompt += `\`\`\`\n\n`;
    prompt += `**💡 Remember: Your enriched prompts optimize RL4's ability to parse information and stay close to real-time reality!**\n\n`;

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
    
    prompt += `      **Context.RL4** (update workspace state + KPIs):\n`;
   prompt += `   \`\`\`markdown\n`;
   prompt += `   ---\n`;
   prompt += `   version: ${(parseFloat(data.context?.version || '1.0.0') + 0.1).toFixed(1)}\n`;
   prompt += `   updated: ${new Date().toISOString()}\n`;
   prompt += `   confidence: [YOUR_CALCULATED_CONFIDENCE]\n`;
   prompt += `   kpis_llm:\n`;
   prompt += `     - cycle: [CYCLE_NUMBER]\n`;
   prompt += `       cognitive_load: [XX]\n`;
   prompt += `       risks: [...]\n`;
   prompt += `       next_steps: [...]\n`;
   prompt += `       plan_drift: [XX]\n`;
   prompt += `       opportunities: [...]\n`;
   prompt += `       updated: ${new Date().toISOString()}\n`;
   prompt += `   kpis_kernel: []\n`;
   prompt += `   ---\n\n`;
   prompt += `   # RL4 Operational Context\n\n`;
   prompt += `   ## KPIs LLM (High-Level Cognition)\n\n`;
   prompt += `   **⚠️ IMPORTANT: Write ONLY in kpis_llm section. Kernel manages kpis_kernel automatically.**\n\n`;
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

  // ============================================================================
  // RL4 SNAPSHOT SYSTEM - SnapshotDataAssembler
  // ============================================================================

  /**
   * Build complete SnapshotData by aggregating and normalizing all kernel data
   */
  private async buildSnapshotData(deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse'): Promise<SnapshotData> {
    const profile = this.profiles[deviationMode];
    const now = new Date();
    const safeDefaults = this.getSafeDefaults();

    try {
      // 1. Load persistent state files
      const plan = this.normalizePlan(this.planParser.parsePlan());
      const tasks = this.normalizeTasks(this.planParser.parseTasks());
      const context = this.normalizeContext(this.planParser.parseContext());

      // 2. Load compressed historical summary (if profile allows)
      const historySummary = profile.sections.historySummary
        ? await this.normalizeHistory(await this.historySummarizer.summarize(30))
        : null;

      // 3. Calculate bias and confidence
      const biasMode = deviationMode === 'firstUse' ? 'exploratory' : deviationMode;
      const biasReport = await this.biasCalculator.calculateBias(biasMode);
      
      // Get workspace reality for confidence calculation
      const timelinePeriod = this.getTimelinePeriod(profile.sections.timeline);
      const timeline = this.normalizeTimeline(this.blindSpotLoader.loadTimeline(timelinePeriod));
      const gitHistory = this.normalizeGitHistory(this.blindSpotLoader.loadGitHistory(profile.sections.timeline === 'extended' ? 50 : 10));
      const healthTrends = this.normalizeHealthTrends(this.blindSpotLoader.loadHealthTrends(timelinePeriod));
      
      const workspaceReality: WorkspaceData = {
        activeFiles: context?.activeFiles || [],
        recentCycles: timeline.length,
        recentCommits: gitHistory.length,
        health: {
          memoryMB: healthTrends[healthTrends.length - 1]?.memoryMB || 0,
          eventLoopLag: healthTrends[healthTrends.length - 1]?.eventLoopLagP50 || 0
        }
      };
      
      const confidence = plan ? this.planParser.calculateConfidence(plan, workspaceReality) : 0.5;
      const bias = biasReport.total;

      // 4. Load blind spot data (according to profile)
      const filePatterns = this.normalizeFilePatterns(this.blindSpotLoader.loadFilePatterns(timelinePeriod));
      const adrs = this.normalizeADRs(this.blindSpotLoader.loadADRs(5));

      // 5. Enrich commits with ADR detection signals
      const enrichedCommits = this.normalizeEnrichedCommits(await this.adrEnricher.enrichCommits(24));

      // 6. Detect ad-hoc actions
      const adHocActions = this.normalizeAdHocActions(this.adHocTracker.detectAdHocActions(120));

      // 7. Load engine-generated data
      const enginePatterns = this.normalizePatterns(this.loadEnginePatterns());
      const engineCorrelations = this.normalizeCorrelations(this.loadEngineCorrelations());
      const engineForecasts = this.normalizeForecasts(this.loadEngineForecasts());

      // 8. Analyze project context
      const projectContext = await this.projectAnalyzer.analyze();
      const projectDetector = new ProjectDetector(this.workspaceRoot);
      const detectedProject = await projectDetector.detect();

      // 9. Analyze code state
      const goalText = plan?.goal || '';
      const taskTexts = tasks?.active.map(t => t.task) || [];
      const goals = goalText ? [goalText, ...taskTexts] : taskTexts;
      const codeState = await this.codeStateAnalyzer.analyze(goals);

      // 10. Detect anomalies
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
        cognitiveLoad: 0
      };
      
      const anomalies = this.normalizeAnomalies(
        await this.anomalyDetector.detectAnomalies(workspaceContext),
        profile.sections.anomalies
      );

      // 11. Load bootstrap (firstUse only, READ-ONLY)
      const bootstrap = profile.sections.bootstrap
        ? this.normalizeBootstrap(this.loadBootstrapJSON())
        : null;

      // 12. Build metadata
      const metadata = await this.buildMetadata(deviationMode, plan, tasks, context, anomalies);

      // 13. Assemble SnapshotData
      return {
        plan,
        tasks,
        context,
        adrs,
        historySummary,
        biasReport,
        confidence,
        bias,
        timeline,
        filePatterns,
        gitHistory,
        healthTrends,
        enrichedCommits,
        adHocActions,
        enginePatterns,
        engineCorrelations,
        engineForecasts,
        anomalies,
        projectContext,
        detectedProject,
        codeState,
        bootstrap,
        generated: now.toISOString(),
        deviationMode,
        generatedTimestamp: now,
        metadata
      };

    } catch (error) {
      console.error('[UnifiedPromptBuilder] Error building snapshot data:', error);
      return safeDefaults;
    }
  }

  /**
   * Get safe defaults for SnapshotData in case of errors
   */
  private getSafeDefaults(): SnapshotData {
    const now = new Date();
    return {
      plan: null,
      tasks: null,
      context: null,
      adrs: [],
      historySummary: null,
      biasReport: { total: 0, breakdown: { phase: 0, goal: 0, timeline: 0, criteria: 0 }, exceeds_threshold: false, deviation_mode: 'flexible', threshold: 0.25, recommendations: [], drift_areas: [] },
      confidence: 0.5,
      bias: 0,
      timeline: [],
      filePatterns: {},
      gitHistory: [],
      healthTrends: [],
      enrichedCommits: [],
      adHocActions: [],
      enginePatterns: [],
      engineCorrelations: [],
      engineForecasts: [],
      anomalies: [],
      projectContext: { maturity: 'new', projectType: 'generic', stackDetected: [], totalCycles: 0, projectAge: 0, qualityScore: 0, hasTests: false, hasLinter: false, hasCI: false, topHotspots: [], hotspotCount: 0, burstCount: 0 },
      detectedProject: undefined,
      codeState: { keyFiles: [], implementationStatus: [], techStack: { languages: [], frameworks: [], dependencies: [] }, structure: { entryPoints: [], mainModules: [] } },
      bootstrap: null,
      generated: now.toISOString(),
      deviationMode: 'flexible',
      generatedTimestamp: now,
      metadata: {
        kernelCycle: 0,
        merkleRoot: '',
        kernelFlags: { safeMode: false, ready: false },
        deviationMode: 'flexible',
        compressionRatio: 0,
        dataHashes: { plan: null, tasks: null, context: null, ledger: null },
        anomalies: [],
        compression: { originalSize: 0, optimizedSize: 0, reductionPercent: 0, mode: 'flexible' }
      }
    };
  }

  /**
   * Build enriched metadata for snapshot
   */
  private async buildMetadata(
    deviationMode: string,
    plan: PlanData | null,
    tasks: TasksData | null,
    context: ContextData | null,
    anomalies: any[]
  ): Promise<SnapshotMetadata> {
    // Read kernelCycle from cycles.jsonl
    let kernelCycle = 0;
    try {
      const cyclesPath = path.join(this.rl4Path, 'ledger', 'cycles.jsonl');
      if (fs.existsSync(cyclesPath)) {
        const lines = fs.readFileSync(cyclesPath, 'utf-8').trim().split('\n').filter(Boolean);
        if (lines.length > 0) {
          const latestCycle = JSON.parse(lines[lines.length - 1]);
          kernelCycle = latestCycle.cycleId || 0;
        }
      }
    } catch (error) {
      // Fallback to 0
    }

    // Read merkleRoot from ledger.jsonl
    let merkleRoot = '';
    try {
      const ledgerPath = path.join(this.rl4Path, 'ledger', 'ledger.jsonl');
      if (fs.existsSync(ledgerPath)) {
        const lines = fs.readFileSync(ledgerPath, 'utf-8').trim().split('\n').filter(Boolean);
        if (lines.length > 0) {
          const lastEntry = JSON.parse(lines[lines.length - 1]);
          merkleRoot = lastEntry.merkleRoot || '';
        }
      }
    } catch (error) {
      // Fallback to ''
    }

    // Calculate data hashes
    const dataHashes = {
      plan: plan ? this.calculateHash(JSON.stringify(plan)) : null,
      tasks: tasks ? this.calculateHash(JSON.stringify(tasks)) : null,
      context: context ? this.calculateHash(JSON.stringify(context)) : null,
      ledger: merkleRoot ? this.calculateHash(merkleRoot) : null
    };

    return {
      kernelCycle,
      merkleRoot,
      kernelFlags: { safeMode: false, ready: true }, // TODO: Read from kernel state if available
      deviationMode,
      compressionRatio: 0, // Will be updated after compression
      dataHashes,
      anomalies,
      compression: { originalSize: 0, optimizedSize: 0, reductionPercent: 0, mode: deviationMode }
    };
  }

  /**
   * Get timeline period based on profile section configuration
   */
  private getTimelinePeriod(timelineConfig: false | 'condensed' | 'complete' | 'extended'): TimelinePeriod {
    const now = new Date();
    switch (timelineConfig) {
      case 'extended':
        return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now }; // 24h
      case 'complete':
        return { from: new Date(now.getTime() - 2 * 60 * 60 * 1000), to: now }; // 2h
      case 'condensed':
        return { from: new Date(now.getTime() - 1 * 60 * 60 * 1000), to: now }; // 1h
      case false:
      default:
        return { from: now, to: now }; // Empty
    }
  }

  /**
   * Load bootstrap.json (READ-ONLY, never execute FirstBootstrapEngine)
   */
  private loadBootstrapJSON(): any | null {
    try {
      const bootstrapPath = path.join(this.rl4Path, 'bootstrap.json');
      if (!fs.existsSync(bootstrapPath)) {
        return null;
      }
      const content = fs.readFileSync(bootstrapPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      console.warn('[UnifiedPromptBuilder] Failed to load bootstrap.json:', error);
      return null;
    }
  }

  /**
   * Calculate SHA-256 hash of a string
   */
  private calculateHash(data: string): string {
    return crypto.createHash('sha256').update(data).digest('hex');
  }

  // ============================================================================
  // RL4 SNAPSHOT SYSTEM - Normalization Methods
  // ============================================================================

  private normalizePlan(plan: PlanData | null): PlanData | null {
    if (!plan) return null;
    // Ensure all required fields exist
    return {
      version: plan.version || '1.0.0',
      updated: plan.updated || new Date().toISOString(),
      confidence: plan.confidence || 0.5,
      phase: plan.phase || 'Unknown',
      goal: plan.goal || '',
      timeline: plan.timeline || { start: '', target: '' },
      successCriteria: Array.isArray(plan.successCriteria) ? plan.successCriteria : [],
      constraints: Array.isArray(plan.constraints) ? plan.constraints : []
    };
  }

  private normalizeTasks(tasks: TasksData | null): TasksData | null {
    if (!tasks) return null;
    // Ensure all required fields exist and deduplicate
    const seenIds = new Set<string>();
    const active = Array.isArray(tasks.active) ? tasks.active.filter(t => {
      const idMatch = t.task?.match(/@rl4:id=([^\s]+)/);
      if (idMatch) {
        const id = idMatch[1];
        if (seenIds.has(id)) return false;
        seenIds.add(id);
      }
      return true;
    }) : [];
    
    return {
      version: tasks.version || '1.0.0',
      updated: tasks.updated || new Date().toISOString(),
      bias: tasks.bias || 0,
      active,
      blockers: Array.isArray(tasks.blockers) ? tasks.blockers : [],
      completed: Array.isArray(tasks.completed) ? tasks.completed : []
    };
  }

  private normalizeContext(context: ContextData | null): ContextData | null {
    if (!context) return null;
    // Ensure all required fields exist
    return {
      version: context.version || '1.0.0',
      updated: context.updated || new Date().toISOString(),
      confidence: context.confidence || 0.5,
      activeFiles: Array.isArray(context.activeFiles) ? context.activeFiles : [],
      recentActivity: context.recentActivity || { cycles: 0, commits: 0, duration: '0h' },
      health: context.health || { memory: '0MB', eventLoop: '0ms', uptime: '0h' },
      observations: Array.isArray(context.observations) ? context.observations : []
    };
  }

  private normalizeTimeline(timeline: any[]): any[] {
    if (!Array.isArray(timeline)) return [];
    // Sort by timestamp descending
    return timeline.sort((a, b) => {
      const timeA = new Date(a.timestamp || a.time || 0).getTime();
      const timeB = new Date(b.timestamp || b.time || 0).getTime();
      return timeB - timeA;
    });
  }

  private normalizeFilePatterns(filePatterns: any): any {
    return filePatterns && typeof filePatterns === 'object' ? filePatterns : {};
  }

  private normalizeGitHistory(gitHistory: any[]): any[] {
    if (!Array.isArray(gitHistory)) return [];
    // Ensure each commit has required fields
    return gitHistory.map(c => ({
      hash: c.hash || c.sha || 'unknown',
      message: c.message || c.msg || '',
      timestamp: c.timestamp || c.date || new Date().toISOString()
    }));
  }

  private normalizeHealthTrends(healthTrends: any[]): any[] {
    return Array.isArray(healthTrends) ? healthTrends : [];
  }

  private normalizePatterns(patterns: any[]): any[] {
    if (!Array.isArray(patterns)) return [];
    // Remove invalid patterns
    return patterns.filter(p => p && (p.id || p.pattern || p.description));
  }

  private normalizeCorrelations(correlations: any[]): any[] {
    if (!Array.isArray(correlations)) return [];
    // Remove invalid correlations
    return correlations.filter(c => c && (c.id || c.type || c.description));
  }

  private normalizeForecasts(forecasts: any[]): any[] {
    if (!Array.isArray(forecasts)) return [];
    // Remove invalid forecasts
    return forecasts.filter(f => f && (f.id || f.predicted || f.forecast));
  }

  private normalizeAnomalies(anomalies: any[], filter: 'critical' | 'medium,critical' | 'all'): any[] {
    if (!Array.isArray(anomalies)) return [];
    // Filter by severity
    const filtered = anomalies.filter(a => a && a.type && a.severity);
    if (filter === 'all') return filtered;
    if (filter === 'critical') return filtered.filter(a => a.severity === 'critical');
    return filtered.filter(a => a.severity === 'critical' || a.severity === 'medium');
  }

  private normalizeADRs(adrs: any[]): any[] {
    if (!Array.isArray(adrs)) return [];
    // Ensure each ADR has required fields
    return adrs.filter(a => a && (a.id || a.title));
  }

  private normalizeEnrichedCommits(commits: EnrichedCommit[]): EnrichedCommit[] {
    return Array.isArray(commits) ? commits : [];
  }

  private normalizeAdHocActions(actions: AdHocAction[]): AdHocAction[] {
    return Array.isArray(actions) ? actions : [];
  }

  private normalizeHistory(history: HistorySummary | null): HistorySummary | null {
    return history;
  }

  private normalizeBootstrap(bootstrap: any | null): any | null {
    if (!bootstrap) return null;
    // Ensure bootstrap has expected structure
    return {
      structure: bootstrap.structure || {},
      technologies: Array.isArray(bootstrap.technologies) ? bootstrap.technologies : [],
      entryPoints: Array.isArray(bootstrap.entryPoints) ? bootstrap.entryPoints : [],
      ...bootstrap
    };
  }

  // ============================================================================
  // RL4 SNAPSHOT SYSTEM - Build Methods (Header, Sections, etc.)
  // ============================================================================

  /**
   * Build complete header with metadata, minimap, and boundaries
   */
  private buildHeader(data: SnapshotData, profile: PromptProfile): string {
    const projectName = data.detectedProject?.name || 
                        data.plan?.phase?.split(' ')[0] || 
                        path.basename(this.rl4Path).replace('.reasoning_rl4', '');
    
    const uncommittedFiles = this.getUncommittedFilesCount();
    
    let header = `# 🧠 ${projectName} — RL4 Development Context Snapshot\n\n`;
    header += `**Generated:** ${data.generated}\n`;
    header += `**Mode:** ${profile.mode} (threshold: ${(profile.rules.threshold * 100).toFixed(0)}%)\n`;
    header += `**Confidence:** ${(data.confidence * 100).toFixed(0)}% | **Bias:** ${(data.bias * 100).toFixed(0)}%\n`;
    header += `**Kernel Cycle:** ${data.metadata.kernelCycle} | **Merkle Root:** ${data.metadata.merkleRoot.substring(0, 8)}...\n`;
    header += `**Uncommitted Files:** ${uncommittedFiles}\n\n`;
    
    // Section Minimap
    header += this.buildSectionMinimap(profile);
    
    header += `\n---\n\n`;
    
    return header;
  }

  /**
   * Build section minimap (list of included sections)
   */
  private buildSectionMinimap(profile: PromptProfile): string {
    const sections: string[] = [];
    
    if (profile.sections.plan) sections.push('plan');
    if (profile.sections.tasks) {
      const taskTypes: string[] = [];
      if (profile.includeTasks.P0) taskTypes.push('P0');
      if (profile.includeTasks.P1) taskTypes.push('P1');
      if (profile.includeTasks.P2) taskTypes.push('P2');
      if (profile.includeTasks.completed) taskTypes.push('completed');
      sections.push(`tasks (${taskTypes.join(',')})`);
    }
    if (profile.sections.context) sections.push(`context (${profile.sections.context})`);
    if (profile.sections.bootstrap) sections.push('bootstrap');
    if (profile.sections.timeline !== false) sections.push(`timeline (${profile.sections.timeline})`);
    if (profile.sections.blindSpot !== false) sections.push(`blindspot (${profile.sections.blindSpot})`);
    if (profile.sections.historySummary) sections.push('history');
    if (profile.sections.engineData !== 'minimal') sections.push('engine-data');
    if (profile.sections.anomalies !== 'critical') sections.push(`anomalies (${profile.sections.anomalies})`);
    sections.push('agent-instructions');
    
    return `**Sections included:** ${sections.join(' ✓ ')}\n`;
  }

  /**
   * Get uncommitted files count from git status
   */
  private getUncommittedFilesCount(): number {
    try {
      const { execSync } = require('child_process');
      const result = execSync('git status --porcelain', { cwd: this.workspaceRoot, encoding: 'utf-8' });
      return result.trim().split('\n').filter((line: string) => line.trim().length > 0).length;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Build Critical Rules section
   */
  private buildCriticalRules(data: SnapshotData, profile: PromptProfile): string {
    let rules = `## 🚨 CRITICAL RULES — READ THIS FIRST\n\n`;
    rules += `**⚠️ BEFORE creating, modifying, or deleting ANY file:**\n\n`;
    rules += `1. **READ \`.reasoning_rl4/Plan.RL4\`** → Check \`deviation_mode: ${profile.mode}\`\n`;
    rules += `2. **READ \`.reasoning_rl4/Tasks.RL4\`** → List active P0 tasks\n`;
    rules += `3. **READ \`.reasoning_rl4/Context.RL4\`** → Check current bias: ${(data.bias * 100).toFixed(0)}%\n`;
    if (profile.mode === 'firstUse') {
      rules += `4. **READ \`.reasoning_rl4/ADRs.RL4\`** → Review architectural decisions\n`;
    }
    rules += `\n`;
    
    if (profile.mode === 'strict') {
      rules += `**🚫 STRICT MODE (0% threshold) — ZERO DEVIATION TOLERANCE**\n\n`;
      rules += `- ❌ DO NOT create new files unless P0 task\n`;
      rules += `- ❌ DO NOT modify files unless completing P0 task\n`;
      rules += `- ✅ ONLY execute P0 tasks\n\n`;
    } else if (profile.mode === 'flexible') {
      rules += `**⚖️ FLEXIBLE MODE (25% threshold) — BALANCED APPROACH**\n\n`;
      rules += `- ✅ P0 + P1 tasks allowed\n`;
      rules += `- ⚠️ Small improvements OK if bias < 25%\n\n`;
    } else if (profile.mode === 'exploratory') {
      rules += `**🔍 EXPLORATORY MODE (50% threshold) — PROACTIVE INNOVATION**\n\n`;
      rules += `- ✅ Explorations and improvements allowed\n`;
      rules += `- ⚠️ Calculate bias impact before implementing\n\n`;
    } else if (profile.mode === 'free') {
      rules += `**🔥 FREE MODE (100% threshold) — NO RESTRICTIONS**\n\n`;
      rules += `- ✅ Any modification allowed\n`;
      rules += `- ⚠️ Always inform user of changes\n\n`;
    }
    
    rules += `---\n\n`;
    return rules;
  }

  /**
   * Build Project Context Discovery section (firstUse only)
   * ✅ P0-FIRSTUSE-OPTIMIZATION: Mandatory project context extraction
   */
  private buildProjectContextDiscovery(data: SnapshotData): string {
    let section = `## 📚 PROJECT CONTEXT DISCOVERY — MANDATORY FIRST STEP\n\n`;
    section += `**🎯 BEFORE analyzing RL4 files, YOU MUST extract project context from standard files:**\n\n`;
    
    section += `### Priority 1: Core Documentation (ALWAYS READ)\n`;
    section += `- **\`README.md\`** (root) → Project description, domain, architecture, features\n`;
    section += `- **\`package.json\`** (root + subprojects) → Project name, description, scripts, dependencies\n`;
    section += `- **\`ADRs.RL4\`** → Existing architectural decisions and tech stack\n\n`;
    
    section += `### Priority 2: Configuration Files (READ IF EXISTS)\n`;
    section += `- **\`tsconfig.json\`** / **\`jsconfig.json\`** → TypeScript/JavaScript configuration\n`;
    section += `- **\`.gitignore\`** → Project structure insights\n`;
    section += `- **\`docker-compose.yml\`** / **\`Dockerfile\`** → Deployment architecture\n`;
    section += `- **\`.env.example\`** → Environment variables and services\n\n`;
    
    section += `### Priority 3: Code Structure (SCAN FOR CONTEXT)\n`;
    section += `- **Entry points** (\`src/index.ts\`, \`App.tsx\`, etc.) → Application structure\n`;
    section += `- **Models/Types** (\`models/\`, \`types/\`) → Domain entities and business logic\n`;
    section += `- **Routes/Controllers** (\`routes/\`, \`controllers/\`) → Exposed functionalities\n\n`;
    
    section += `### Extraction Checklist:\n`;
    section += `- [ ] Project name and domain (from README.md or package.json)\n`;
    section += `- [ ] Project description and purpose (from README.md)\n`;
    section += `- [ ] Tech stack (from package.json + ADRs.RL4)\n`;
    section += `- [ ] Architecture (from README.md or structure)\n`;
    section += `- [ ] Current features/status (from README.md or code)\n`;
    section += `- [ ] MVP scope (from README.md or Plan.RL4)\n\n`;
    
    section += `**💡 Why?** RL4 files (Plan.RL4, Tasks.RL4, Context.RL4) are often generic and lack domain context. Standard project files contain the actual business context needed for meaningful updates.\n\n`;
    section += `---\n\n`;
    
    return section;
  }

  /**
   * Build Chat Memory section
   */
  private buildChatMemory(data: SnapshotData): string {
    let memory = `## 💬 Chat Conversation Memory — PRIMARY CONTEXT SOURCE\n\n`;
    memory += `**🎯 CRITICAL INSTRUCTION FOR LLM:**\n\n`;
    memory += `Before reading ANY section below, **FIRST consult the chat conversation history** in your current context window.\n\n`;
    memory += `**Why?** The chat contains:\n`;
    memory += `- ✅ Real-time user intent (what the user wants RIGHT NOW)\n`;
    memory += `- ✅ Recent decisions (what was just discussed and agreed)\n`;
    memory += `- ✅ Corrections & clarifications (user feedback on your proposals)\n\n`;
    memory += `**Prioritization Hierarchy:**\n`;
    memory += `1. 🥇 Chat conversation (most recent, highest priority)\n`;
    memory += `2. 🥈 Project context files (README.md, package.json, ADRs.RL4)\n`;
    memory += `3. 🥉 Tasks.RL4 (active tasks, tactical TODOs)\n`;
    memory += `4. 🥉 Plan.RL4 (strategic vision, long-term)\n`;
    memory += `5. 📊 Snapshot data below (historical context, blind spots)\n\n`;
    memory += `**💡 Key Insight:**\n`;
    memory += `This snapshot was generated at **${data.generatedTimestamp.toISOString()}**. Any conversation AFTER this timestamp contains MORE RECENT context than the data below.\n\n`;
    memory += `---\n\n`;
    return memory;
  }

  /**
   * Build Plan section
   */
  private buildPlan(plan: PlanData): string {
    let section = `## 📋 Plan (Strategic Intent)\n\n`;
    section += `**Phase:** ${plan.phase}\n\n`;
    
    // Format goal as list if it contains multiple lines
    const goalLines = plan.goal.split('\n').filter(l => l.trim());
    if (goalLines.length > 1) {
      section += `**Goal:**\n`;
      goalLines.forEach(g => {
        section += `${g.trim().startsWith('-') ? g.trim() : `- ${g.trim()}`}\n`;
      });
      section += `\n`;
    } else {
      section += `**Goal:** ${plan.goal}\n\n`;
    }
    
    section += `**Timeline:**\n`;
    section += `- Start: ${plan.timeline.start}\n`;
    section += `- Target: ${plan.timeline.target}\n`;
    
    // ✅ P0-FIRSTUSE-OPTIMIZATION: Add Current date and Days Remaining for firstUse
    try {
      const now = new Date();
      const targetDate = new Date(plan.timeline.target);
      const startDate = new Date(plan.timeline.start);
      const currentDate = now.toISOString().split('T')[0];
      const daysRemaining = Math.max(0, Math.ceil((targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      
      section += `- Current: ${currentDate}\n`;
      section += `- Days Remaining: ${daysRemaining}\n`;
    } catch (e) {
      // Fallback if date parsing fails
    }
    section += `\n`;
    
    if (plan.successCriteria.length > 0) {
      section += `**Success Criteria:**\n`;
      plan.successCriteria.forEach(c => {
        section += `- ${c}\n`;
      });
      section += `\n`;
    }
    
    if (plan.constraints.length > 0) {
      section += `**Constraints:**\n`;
      plan.constraints.forEach(c => {
        section += `- ${c}\n`;
      });
      section += `\n`;
    }
    
    section += `---\n\n`;
    return section;
  }

  /**
   * Build Tasks section (filtered by profile)
   */
  private buildTasks(tasks: TasksData, profile: PromptProfile): string {
    const normalized = this.normalizeTasksSection(tasks, profile);
    const grouped = this.groupTasksByPriority(normalized);
    
    let section = `## ✅ Tasks (Tactical TODOs)\n\n`;
    
    if (profile.includeTasks.P0 && grouped.P0.length > 0) {
      section += `**P0 Tasks (Critical):**\n`;
      grouped.P0.forEach(t => {
        const checkbox = t.completed ? '[x]' : '[ ]';
        section += `- ${checkbox} ${t.task}\n`;
      });
      section += `\n`;
    }
    
    if (profile.includeTasks.P1 && grouped.P1.length > 0) {
      section += `**P1 Tasks (Important):**\n`;
      grouped.P1.forEach(t => {
        const checkbox = t.completed ? '[x]' : '[ ]';
        section += `- ${checkbox} ${t.task}\n`;
      });
      section += `\n`;
    }
    
    if (profile.includeTasks.P2 && grouped.P2.length > 0) {
      section += `**P2 Tasks (Nice to have):**\n`;
      grouped.P2.forEach(t => {
        const checkbox = t.completed ? '[x]' : '[ ]';
        section += `- ${checkbox} ${t.task}\n`;
      });
      section += `\n`;
    }
    
    if (profile.includeTasks.completed && grouped.completed.length > 0) {
      section += `**Completed (last 24h):**\n`;
      grouped.completed.slice(0, 5).forEach(c => {
        section += `- ${c.task} (${c.timestamp})\n`;
      });
      section += `\n`;
    }
    
    if (tasks.blockers.length > 0) {
      section += `**Blockers:**\n`;
      tasks.blockers.forEach(b => {
        section += `- ${b}\n`;
      });
      section += `\n`;
    }
    
    section += `---\n\n`;
    return section;
  }

  /**
   * Normalize tasks section (filter, sort, deduplicate)
   */
  private normalizeTasksSection(tasks: TasksData, profile: PromptProfile): Array<{ task: string; completed: boolean; timestamp?: string }> {
    const allTasks: Array<{ task: string; completed: boolean; timestamp?: string }> = [];
    
    // Add active tasks
    tasks.active.forEach(t => {
      allTasks.push({ task: t.task, completed: t.completed, timestamp: t.timestamp });
    });
    
    // Add completed tasks if profile allows
    if (profile.includeTasks.completed) {
      tasks.completed.forEach(c => {
        allTasks.push({ task: c.task, completed: true, timestamp: c.timestamp });
      });
    }
    
    // Remove duplicates by @rl4:id if present
    const seen = new Set<string>();
    return allTasks.filter(t => {
      const idMatch = t.task.match(/@rl4:id=([^\s]+)/);
      if (idMatch) {
        const id = idMatch[1];
        if (seen.has(id)) return false;
        seen.add(id);
      }
      return true;
    });
  }

  /**
   * Group tasks by priority
   */
  private groupTasksByPriority(tasks: Array<{ task: string; completed: boolean; timestamp?: string }>): {
    P0: Array<{ task: string; completed: boolean; timestamp?: string }>;
    P1: Array<{ task: string; completed: boolean; timestamp?: string }>;
    P2: Array<{ task: string; completed: boolean; timestamp?: string }>;
    completed: Array<{ task: string; completed: boolean; timestamp?: string }>;
  } {
    const grouped = { P0: [] as any[], P1: [] as any[], P2: [] as any[], completed: [] as any[] };
    
    tasks.forEach(t => {
      if (t.completed) {
        grouped.completed.push(t);
      } else if (t.task.includes('[P0]')) {
        grouped.P0.push(t);
      } else if (t.task.includes('[P1]')) {
        grouped.P1.push(t);
      } else if (t.task.includes('[P2]')) {
        grouped.P2.push(t);
      }
    });
    
    return grouped;
  }

  /**
   * Build Context section (level: minimal/rich/complete)
   * ✅ P0-KPI-SEPARATION-04: Includes both LLM and Kernel KPIs
   * ✅ P0-FIRSTUSE-OPTIMIZATION: Includes project domain/name/tech stack for firstUse
   */
  private buildContext(context: ContextData, level: 'minimal' | 'rich' | 'complete', data?: SnapshotData): string {
    let section = `## 🔍 Context (Workspace State)\n\n`;
    
    // ✅ P0-FIRSTUSE-OPTIMIZATION: Add project context at the top for firstUse
    if (data && data.deviationMode === 'firstUse' && level === 'complete') {
      const projectName = data.detectedProject?.name || 'Unknown';
      const projectDomain = data.projectContext?.stackDetected?.join(', ') || data.detectedProject?.description || 'Unknown';
      const techStack = data.projectContext?.stackDetected?.join(', ') || 
                       (data.bootstrap?.technologies?.join(', ') || 'Unknown');
      
      section += `**Project Domain:** ${projectDomain} *(extracted from README.md/package.json)*\n`;
      section += `**Project Name:** ${projectName} *(extracted from package.json/README.md)*\n`;
      section += `**Tech Stack:** ${techStack} *(extracted from package.json + ADRs.RL4)*\n\n`;
    }
    
    if (level === 'minimal') {
      section += `**Active Files:** ${context.activeFiles.length}\n`;
      section += `**Recent Activity:** ${context.recentActivity.cycles} cycles, ${context.recentActivity.commits} commits\n\n`;
    } else if (level === 'rich') {
      section += `**Active Files:**\n`;
      context.activeFiles.slice(0, 10).forEach(f => {
        section += `- ${f}\n`;
      });
      section += `\n`;
      section += `**Recent Activity:**\n`;
      section += `- Cycles: ${context.recentActivity.cycles}\n`;
      section += `- Commits: ${context.recentActivity.commits}\n`;
      section += `- Duration: ${context.recentActivity.duration}\n\n`;
      section += `**Health:**\n`;
      section += `- Memory: ${context.health.memory}\n`;
      section += `- Event Loop: ${context.health.eventLoop}\n\n`;
    } else { // complete
      section += `**Active Files:**\n`;
      context.activeFiles.forEach(f => {
        section += `- ${f}\n`;
      });
      section += `\n`;
      section += `**Recent Activity:**\n`;
      section += `- Cycles: ${context.recentActivity.cycles}\n`;
      section += `- Commits: ${context.recentActivity.commits}\n`;
      section += `- Duration: ${context.recentActivity.duration}\n\n`;
      section += `**Health:**\n`;
      section += `- Memory: ${context.health.memory}\n`;
      section += `- Event Loop: ${context.health.eventLoop}\n`;
      section += `- Uptime: ${context.health.uptime}\n\n`;
      
      // ✅ P0-KPI-SEPARATION-04: Include LLM KPIs (high-level cognition)
      if (context.kpis_llm && context.kpis_llm.length > 0) {
        section += `## KPIs LLM (High-Level Cognition)\n\n`;
        section += `**Source:** LLM reasoning, patterns, goals, plan drift analysis\n\n`;
        context.kpis_llm.slice(-3).forEach(kpi => {
          section += `### Cycle ${kpi.cycle}\n`;
          section += `- Cognitive Load: ${kpi.cognitive_load}%\n`;
          section += `- Next Steps: ${kpi.next_steps.join(', ') || 'None'}\n`;
          section += `- Plan Drift: ${kpi.plan_drift}%\n`;
          section += `- Risks: ${kpi.risks.join(', ') || 'None'}\n`;
          if (kpi.opportunities && kpi.opportunities.length > 0) {
            section += `- Opportunities: ${kpi.opportunities.join(', ')}\n`;
          }
          section += `- Updated: ${kpi.updated}\n\n`;
        });
      }
      
      // ✅ P0-KPI-SEPARATION-04: Include Kernel KPIs (mechanical metrics)
      if (context.kpis_kernel && context.kpis_kernel.length > 0) {
        section += `## KPIs Kernel (Mechanical Metrics)\n\n`;
        section += `**Source:** Kernel cycle execution, scheduler state, queue management\n\n`;
        context.kpis_kernel.slice(-3).forEach(kpi => {
          section += `### Cycle ${kpi.cycle}\n`;
          section += `- Cognitive Load: ${kpi.cognitive_load}%\n`;
          section += `- Drift: ${kpi.drift}%\n`;
          section += `- Patterns Detected: ${kpi.patterns_detected}\n`;
          section += `- Tasks Active: ${kpi.tasks_active}\n`;
          if (kpi.queue_length !== undefined) {
            section += `- Queue Length: ${kpi.queue_length}\n`;
          }
          if (kpi.scheduler_state) {
            section += `- Scheduler State: ${kpi.scheduler_state}\n`;
          }
          section += `- Updated: ${kpi.updated}\n\n`;
        });
      }
      
      if (context.observations.length > 0) {
        section += `**Observations:**\n`;
        context.observations.forEach(o => {
          section += `- ${o}\n`;
        });
        section += `\n`;
      }
    }
    
    section += `---\n\n`;
    return section;
  }

  /**
   * Build Activity Reconstruction section (since last snapshot)
   * ✅ P2: Shows what happened between snapshots
   */
  private async buildActivityReconstruction(data: SnapshotData): Promise<string | null> {
    try {
      // Read last snapshot time from reminder_state.json
      const reminderStatePath = path.join(this.rl4Path, 'reminder_state.json');
      if (!fs.existsSync(reminderStatePath)) {
        return null; // No previous snapshot
      }
      
      const reminderState = JSON.parse(fs.readFileSync(reminderStatePath, 'utf-8'));
      const lastSnapshotTime = reminderState.lastSnapshotTime;
      
      if (!lastSnapshotTime) {
        return null; // No previous snapshot
      }
      
      // Get workspace root from rl4Path
      const workspaceRoot = path.dirname(this.rl4Path);
      
      // Reconstruct activity
      const reconstructor = new ActivityReconstructor(workspaceRoot);
      const activity = await reconstructor.reconstruct(
        new Date(lastSnapshotTime).toISOString(),
        new Date().toISOString()
      );
      
      // Build section
      let section = `## 📊 Activity Since Last Snapshot\n\n`;
      section += `**Duration:** ${this.formatDuration(activity.durationMs)}\n`;
      section += `**Summary:** ${activity.summary}\n\n`;
      
      // File changes
      if (activity.fileChanges.total > 0) {
        section += `### File Changes (${activity.fileChanges.total})\n`;
        const topPatterns = Object.entries(activity.fileChanges.byPattern)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 5);
        if (topPatterns.length > 0) {
          section += `**By Pattern:** ${topPatterns.map(([p, c]) => `${p} (${c})`).join(', ')}\n`;
        }
        section += `\n`;
      }
      
      // Terminal events
      if (activity.terminalEvents.total > 0) {
        section += `### Terminal Activity (${activity.terminalEvents.total} commands)\n`;
        section += `**Success Rate:** ${activity.terminalEvents.successRate}%\n`;
        const taskIds = Object.keys(activity.terminalEvents.byTask);
        if (taskIds.length > 0) {
          section += `**Tasks Involved:** ${taskIds.slice(0, 5).join(', ')}${taskIds.length > 5 ? ` (+${taskIds.length - 5} more)` : ''}\n`;
        }
        section += `\n`;
      }
      
      // Correlations
      if (activity.correlations.length > 0) {
        section += `### Key Observations\n`;
        activity.correlations.slice(0, 5).forEach(c => {
          section += `- ${c.description}\n`;
        });
        section += `\n`;
      }
      
      section += `---\n\n`;
      return section;
      
    } catch (error) {
      console.error('[UnifiedPromptBuilder] Failed to reconstruct activity:', error);
      return null; // Silent fail
    }
  }
  
  /**
   * Format duration in human-readable format
   */
  private formatDuration(ms: number): string {
    const hours = Math.floor(ms / 3600000);
    const minutes = Math.floor((ms % 3600000) / 60000);
    
    if (hours > 0) {
      return `${hours}h ${minutes}min`;
    } else {
      return `${minutes}min`;
    }
  }

  /**
   * Build Bootstrap section (firstUse only)
   */
  private buildBootstrapSection(bootstrap: any): string {
    let section = `## 🚀 First Use Deep Analysis\n\n`;
    
    if (!bootstrap) {
      section += `⚠️ Bootstrap data unavailable (bootstrap.json not found)\n\n`;
      section += `---\n\n`;
      return section;
    }
    
    section += `**Project Structure:**\n`;
    if (bootstrap.structure) {
      section += `${JSON.stringify(bootstrap.structure, null, 2)}\n\n`;
    }
    
    section += `**Detected Technologies:**\n`;
    if (bootstrap.technologies) {
      bootstrap.technologies.forEach((tech: string) => {
        section += `- ${tech}\n`;
      });
      section += `\n`;
    }
    
    section += `---\n\n`;
    return section;
  }

  /**
   * Build Timeline and BlindSpot section
   */
  private buildTimelineAndBlindSpot(data: SnapshotData, profile: PromptProfile): string {
    let section = `## 📊 Timeline & Blind Spot Analysis\n\n`;
    
    if (profile.sections.timeline === 'condensed') {
      section += `**Recent Timeline (condensed):**\n`;
      data.timeline.slice(-10).forEach((entry: any) => {
        section += `- ${entry.timestamp || entry.time}: ${entry.type || 'event'}\n`;
      });
      section += `\n`;
    } else if (profile.sections.timeline === 'complete' || profile.sections.timeline === 'extended') {
      section += `**Timeline:**\n`;
      data.timeline.forEach((entry: any) => {
        section += `- ${entry.timestamp || entry.time}: ${entry.type || 'event'}\n`;
      });
      section += `\n`;
    }
    
    if (profile.sections.blindSpot === 'selective' || profile.sections.blindSpot === 'complete' || profile.sections.blindSpot === 'extended') {
      section += `**File Patterns:**\n`;
      const fileKeys = Object.keys(data.filePatterns).slice(0, 10);
      fileKeys.forEach(key => {
        section += `- ${key}: ${data.filePatterns[key]}\n`;
      });
      section += `\n`;
      
      section += `**Git History:**\n`;
      data.gitHistory.slice(0, 10).forEach((commit: any) => {
        section += `- ${commit.hash?.substring(0, 7) || 'unknown'}: ${commit.message || commit.msg || 'no message'}\n`;
      });
      section += `\n`;
    }
    
    section += `---\n\n`;
    return section;
  }

  /**
   * Build History Summary section (free only)
   */
  private buildHistorySummary(history: HistorySummary): string {
    let section = `## 📜 History Summary (30 days)\n\n`;
    section += `**Summary:** ${JSON.stringify(history, null, 2)}\n\n`;
    section += `---\n\n`;
    return section;
  }

  /**
   * Build Engine Data section
   */
  private buildEngineData(data: SnapshotData, level: 'minimal' | 'complete'): string {
    let section = `## ⚙️ Engine-Generated Data\n\n`;
    
    if (level === 'minimal') {
      section += `**Patterns:** ${data.enginePatterns.length}\n`;
      section += `**Correlations:** ${data.engineCorrelations.length}\n`;
      section += `**Forecasts:** ${data.engineForecasts.length}\n\n`;
    } else {
      section += `**Patterns:**\n`;
      data.enginePatterns.forEach((p: any) => {
        section += `- ${p.id || 'unknown'}: ${p.description || JSON.stringify(p)}\n`;
      });
      section += `\n`;
      
      section += `**Correlations:**\n`;
      data.engineCorrelations.forEach((c: any) => {
        section += `- ${c.type || 'unknown'}: ${c.description || JSON.stringify(c)}\n`;
      });
      section += `\n`;
      
      section += `**Forecasts:**\n`;
      data.engineForecasts.forEach((f: any) => {
        section += `- ${f.predicted || 'unknown'}: ${f.confidence || 0}\n`;
      });
      section += `\n`;
    }
    
    section += `---\n\n`;
    return section;
  }

  /**
   * Build Anomalies section
   */
  private buildAnomalies(anomalies: any[], filter: 'critical' | 'medium,critical' | 'all'): string {
    if (anomalies.length === 0) return '';
    
    let section = `## 🚨 Anomalies Detected\n\n`;
    
    anomalies.forEach((anomaly: any) => {
      const severityEmoji = anomaly.severity === 'critical' ? '🔴' : 
                           anomaly.severity === 'high' ? '🟠' : 
                           anomaly.severity === 'medium' ? '🟡' : '🟢';
      section += `${severityEmoji} **${anomaly.type || 'unknown'}** (${anomaly.severity || 'unknown'})\n`;
      section += `- ${anomaly.description || 'No description'}\n`;
      if (anomaly.recommendation) {
        section += `- Recommendation: ${anomaly.recommendation}\n`;
      }
      section += `\n`;
    });
    
    section += `---\n\n`;
    return section;
  }

  /**
   * Build Agent Instructions section (strict formal rules)
   */
  private buildAgentInstructions(data: SnapshotData, profile: PromptProfile): string {
    let instructions = `## 🎯 Agent Instructions\n\n`;
    
    instructions += `**MODE:** ${profile.mode.toUpperCase()}\n\n`;
    instructions += `**YOUR MISSION:**\n\n`;
    instructions += `You are a reasoning agent that updates RL4 workspace state by **writing directly to .RL4 files**.\n`;
    instructions += `The Kernel will detect your changes and trigger a cognitive cycle automatically.\n\n`;
    
    instructions += `**WORKFLOW:**\n\n`;
    if (profile.mode === 'firstUse') {
      instructions += `1. **Extract project context** from README.md, package.json, ADRs.RL4 (see Project Context Discovery section)\n`;
      instructions += `2. **Analyze the snapshot context** (Plan, Tasks, Context sections)\n`;
      instructions += `3. **Calculate KPIs** (Cognitive Load, Next Steps, Plan Drift, Risks) **WITH project domain context**\n`;
      instructions += `4. **Generate RL4 file patches** (see format below)\n`;
      instructions += `5. Cursor applies your patches → Kernel detects → Cycle triggers → New snapshot generated\n\n`;
    } else {
      instructions += `1. Analyze the snapshot context\n`;
      instructions += `2. Calculate KPIs (Cognitive Load, Next Steps, Plan Drift, Risks)\n`;
      instructions += `3. Generate RL4 file patches (see format below)\n`;
      instructions += `4. Cursor applies your patches → Kernel detects → Cycle triggers → New snapshot generated\n\n`;
    }
    
    instructions += `**STRICT RULES:**\n\n`;
    instructions += `1. **YOU MUST write valid Markdown with YAML frontmatter**\n`;
    instructions += `2. **YOU MUST preserve all @rl4:id= tags** (never modify, never delete)\n`;
    instructions += `3. **YOU MUST preserve YAML frontmatter** (version, updated, confidence, bias)\n`;
    instructions += `4. **YOU MUST respect section structure** (## Phase, ## Active (P0), ## KPIs, etc.)\n`;
    instructions += `5. **YOU MUST NOT invent files** (only Plan.RL4, Tasks.RL4, Context.RL4, ADRs.RL4)\n`;
    instructions += `6. **YOU MUST NOT write code** (only Markdown content)\n`;
    instructions += `7. **YOU MUST NOT modify UnifiedPromptBuilder.ts or PromptOptimizer.ts**\n`;
    instructions += `8. **YOU MUST NOT hallucinate metadata** (kernel cycle, merkle root, etc.)\n`;
    instructions += `9. **YOU MUST use tools to write files** (search_replace, write, etc.)\n\n`;
    
    instructions += `**RL4 FILE STRUCTURE:**\n\n`;
    instructions += `Every .RL4 file has this format:\n`;
    instructions += `\`\`\`markdown\n`;
    instructions += `---\n`;
    instructions += `version: 1.0.0\n`;
    instructions += `updated: 2025-11-18T16:00:00Z\n`;
    instructions += `confidence: 0.85\n`;
    instructions += `bias: 5\n`;
    instructions += `---\n\n`;
    instructions += `# Title\n\n`;
    instructions += `## Section 1\n`;
    instructions += `Content...\n`;
    instructions += `\`\`\`\n\n`;
    
    instructions += `**ALLOWED MODIFICATIONS:**\n\n`;
    instructions += `**Plan.RL4:**\n`;
    instructions += `- Update ## Phase (if project phase changed)\n`;
    instructions += `- Update ## Goal (if strategic goal evolved)\n`;
    instructions += `- Update ## Timeline (if dates shifted)\n`;
    instructions += `- Update ## Success Criteria (if criteria changed)\n`;
    if (profile.mode === 'firstUse') {
      instructions += `- **Add ## Project Overview** (extracted from README.md) if missing\n`;
    }
    instructions += `\n`;
    
    instructions += `**Tasks.RL4:**\n`;
    instructions += `- Add new tasks to ## Active (P0), ## Active (P1), ## Active (P2)\n`;
    instructions += `- Move completed tasks to ## Completed\n`;
    instructions += `- Update ## Blockers\n`;
    instructions += `- NEVER remove @rl4:id= tags\n`;
    instructions += `- NEVER modify @rl4:completeWhen conditions without explicit request\n\n`;
    
   instructions += `**Context.RL4:**\n`;
   instructions += `- Update kpis_llm in YAML frontmatter (Cognitive Load, Next Steps, Plan Drift, Risks, Opportunities)\n`;
   instructions += `- ⚠️ NEVER modify kpis_kernel (Kernel manages this automatically)\n`;
    instructions += `- Update ## Active Files\n`;
    instructions += `- Update ## Recent Activity\n`;
    instructions += `- Update ## Health (Memory, Event Loop, Uptime)\n`;
    if (profile.mode === 'firstUse') {
      instructions += `- **Update ## Agent Observations** with project domain context (name, domain, tech stack from README.md/package.json)\n`;
      instructions += `- **Add ## Project Context** section if missing (project name, domain, description, architecture)\n`;
    } else {
      instructions += `- Update ## Observations\n`;
    }
    instructions += `\n`;
    
    instructions += `**ADRs.RL4:**\n`;
    instructions += `- Add new ADRs to ## Active ADRs\n`;
    instructions += `- Move accepted ADRs to ## Accepted\n`;
    instructions += `- Move rejected ADRs to ## Rejected\n\n`;
    
    instructions += `**FORBIDDEN ACTIONS:**\n\n`;
    instructions += `- ❌ Do NOT delete @rl4:id= tags\n`;
    instructions += `- ❌ Do NOT modify version/updated/confidence/bias without recalculating\n`;
    instructions += `- ❌ Do NOT rewrite entire files (use surgical edits)\n`;
    if (profile.mode === 'firstUse') {
      instructions += `- ❌ Do NOT invent new sections (except Project Overview/Project Context if missing)\n`;
    } else {
      instructions += `- ❌ Do NOT invent new sections\n`;
    }
    instructions += `- ❌ Do NOT write JSON (write Markdown)\n`;
    instructions += `- ❌ Do NOT modify files outside .reasoning_rl4/\n`;
    if (profile.mode === 'firstUse') {
      instructions += `- ❌ Do NOT update Context.RL4 without enriching it with project domain context\n`;
    }
    instructions += `\n`;
    
    // STRICT MODE ONLY: Add dual-message UX rule
    if (profile.mode === 'strict') {
      instructions += `**STRICT MODE UX:**\n\n`;
      instructions += `After applying your file modifications, you MUST produce a second message (in the chat language) that contains:\n`;
      instructions += `- A clear explanation of what you just did\n`;
      instructions += `- Your recommendations based on the changes\n`;
      instructions += `- The next steps the user should take\n\n`;
      instructions += `This message must never contain code, must never modify files, and must remain aligned with your changes.\n\n`;
    }
    
    instructions += `**Current State:**\n`;
    instructions += `- Bias: ${(data.bias * 100).toFixed(0)}% / ${(profile.rules.threshold * 100).toFixed(0)}% threshold\n`;
    instructions += `- Confidence: ${(data.confidence * 100).toFixed(0)}%\n`;
    instructions += `- Kernel Cycle: ${data.metadata.kernelCycle}\n`;
    instructions += `- Mode: ${profile.mode}\n\n`;
    
    instructions += `**REMEMBER:**\n`;
    if (profile.mode === 'firstUse') {
      instructions += `1. Always extract project context FIRST from README.md and package.json\n`;
      instructions += `2. Enrich Context.RL4 with project domain information in ## Agent Observations\n`;
      instructions += `3. The Kernel will automatically detect your changes and trigger a new cognitive cycle\n`;
      instructions += `4. No manual intervention required. Just write clean, valid Markdown to .RL4 files.\n\n`;
    } else {
      instructions += `The Kernel will automatically detect your changes and trigger a new cognitive cycle.\n`;
      instructions += `No manual intervention required. Just write clean, valid Markdown to .RL4 files.\n\n`;
    }
    
    return instructions;
  }

  /**
   * Enforce size limits on prompt
   */
  private enforceSizeLimits(prompt: string, profile: PromptProfile): string {
    const limits = this.getSizeLimits(profile.mode);
    
    if (prompt.length > limits.maxChars) {
      // Truncate from middle sections (keep header and agent instructions)
      const headerEnd = prompt.indexOf('---\n\n', prompt.indexOf('CRITICAL RULES'));
      const agentStart = prompt.lastIndexOf('## 🎯 Agent Instructions');
      
      if (headerEnd > 0 && agentStart > headerEnd) {
        const header = prompt.substring(0, headerEnd);
        const agent = prompt.substring(agentStart);
        const available = limits.maxChars - header.length - agent.length - 100; // 100 for separator
        
        const middle = prompt.substring(headerEnd, agentStart);
        const truncated = middle.length > available 
          ? middle.substring(0, available) + '\n\n[... truncated for size ...]\n\n'
          : middle;
        
        return header + truncated + agent;
      }
    }
    
    return prompt;
  }

  /**
   * Get size limits per mode
   */
  private getSizeLimits(mode: string): { maxChars: number; maxTokens: number } {
    switch (mode) {
      case 'strict':
        return { maxChars: 5000, maxTokens: 1250 };
      case 'flexible':
        return { maxChars: 10000, maxTokens: 2500 };
      case 'exploratory':
        return { maxChars: 20000, maxTokens: 5000 };
      case 'free':
        return { maxChars: 50000, maxTokens: 12500 };
      case 'firstUse':
        return { maxChars: 30000, maxTokens: 7500 };
      default:
        return { maxChars: 10000, maxTokens: 2500 };
    }
  }
}


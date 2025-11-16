/**
 * CognitiveLogger - Normalized semantic logging for RL4 Kernel
 * 
 * Transforms raw technical logs into hierarchical cognitive state flow
 * 
 * Features:
 * - 4-level hierarchy: [CYCLE] → [SYSTEM] → [COGNITION] → [OUTPUT]
 * - Automatic cycle summaries (every minute)
 * - Context snapshots (every 10 minutes)
 * - Dual output: console + structured JSONL
 * - Minimal/Verbose modes
 * 
 * RL4 Kernel Component #10
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export type LogLevel = 'CYCLE' | 'SYSTEM' | 'COGNITION' | 'OUTPUT' | 'HEALTH' | 'WARNING' | 'ERROR';

export interface StructuredLogEntry {
    timestamp: string;
    level: LogLevel;
    cycle_id?: number;
    phase?: string;
    message: string;
    metrics?: {
        patterns?: number;
        correlations?: number;
        forecasts?: number;
        adrs?: number;
        duration_ms?: number;
        health?: {
            drift?: number;
            coherence?: number;
            status?: string;
        };
    };
}

export interface CycleSummary {
    cycle_id: number;
    patterns: number;
    correlations: number;
    forecasts: number;
    adrs: number;
    duration_ms: number;
    health: {
        drift: number;
        coherence: number;
        status: string;
    };
}

// === NEW INTERFACES FOR TRANSPARENCY LOGGING ===

export interface FileChangeSummary {
    period_seconds: number;
    files_modified: number;
    total_edits: number;
    files: string[];
    hotspot?: {
        file: string;
        edits: number;
    };
}

export interface CommitEvent {
    hash: string;
    message: string;
    author: string;
    files_changed: number;
    insertions: number;
    deletions: number;
    intent?: {
        type: string;
        keywords?: string[];
    };
    timestamp: string;
}

export interface HourlySummary {
    cycles_captured: number;
    file_changes: number;
    git_commits: number;
    health_checks: number;
    gaps_detected: number;
    health_status: string;
    data_integrity: 'valid' | 'warning' | 'error';
}

export interface SessionSummary {
    workspace: string;
    total_events: number;
    last_activity: Date;
    listeners_active: boolean;
    data_integrity: 'valid' | 'warning' | 'error';
}

export interface PatternChange {
    cycle_id: number;
    patterns: Array<{
        id: string;
        type: string;
        confidence: number;
    }>;
    change_type: 'new' | 'evolved' | 'removed';
}

export interface HealthMetrics {
    memory_mb: number;
    event_loop_p50_ms: number;
    uptime_hours: number;
    status: 'healthy' | 'warning' | 'error';
}

export interface SnapshotDataSummary {
    mode: string;
    total_cycles: number;
    recent_commits: number;
    file_changes: number;
    plan_rl4_found: boolean;
    tasks_rl4_found: boolean;
    context_rl4_found: boolean;
    adrs_count: number;
}

export interface LLMAnalysisMetrics {
    confidence: number;
    bias: number;
    cognitive_load: number;
    plan_drift: number;
}

export interface Insight {
    type: 'inference' | 'suggestion' | 'alert' | 'pattern';
    message: string;
    priority?: 'high' | 'medium' | 'low';
}

export interface RL4FileChanges {
    file: 'Plan' | 'Tasks' | 'Context' | 'ADR';
    updated_by: string;
    changes: string;
    version_old: string;
    version_new: string;
    timestamp: string;
}

export class CognitiveLogger {
    private channel: vscode.OutputChannel;
    private workspaceRoot: string;
    private structuredLogPath: string;
    private useMinimalLogs: boolean = true;
    private useVerboseLogs: boolean = false;
    
    // Cycle tracking
    private cycleSummaries: CycleSummary[] = [];
    private lastHourlySummaryTime: number = Date.now(); // Changed from lastMinuteSummaryTime
    private lastContextSnapshotTime: number = Date.now();
    private currentCycleStartTime: number = 0;
    private currentCycleBuffer: string[] = [];
    
    // Emoji mapping
    private readonly emojis = {
        CYCLE: '🧠',
        SYSTEM: '⚙️',
        COGNITION: '🔍',
        OUTPUT: '📤',
        HEALTH_LEVEL: '🛡️',
        WARNING: '⚠️',
        ERROR: '❌',
        SUCCESS: '✅',
        PATTERN: '🔍',
        CORRELATION: '🔗',
        FORECAST: '🔮',
        ADR: '📝',
        PERSISTENCE: '💾',
        TIMER: '⏱️',
        WATCHDOG: '🐕',
        CACHE: '📇',
        SNAPSHOT: '📋',
        TIMELINE: '📅',
        FILE_CHANGE: '📝',
        COMMIT: '🔀',
        HEALTH: '💚',
        GAP: '⏸️',
        INSIGHT: '💡',
        UPDATE: '🔄'
    };
    
    constructor(workspaceRoot: string, channel: vscode.OutputChannel) {
        this.workspaceRoot = workspaceRoot;
        this.channel = channel;
        
        // Create structured logs directory
        const logsDir = path.join(workspaceRoot, '.reasoning_rl4', 'logs');
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
        
        this.structuredLogPath = path.join(logsDir, 'structured.jsonl');
        
        // Load config
        this.loadConfig();
    }
    
    /**
     * Load logging config from kernel_config.json
     */
    private loadConfig(): void {
        try {
            const configPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'kernel_config.json');
            if (fs.existsSync(configPath)) {
                const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
                this.useMinimalLogs = config.USE_MINIMAL_LOGS ?? true;
                this.useVerboseLogs = config.USE_VERBOSE_LOGS ?? false;
            }
        } catch (error) {
            // Fallback to defaults
            this.useMinimalLogs = true;
            this.useVerboseLogs = false;
        }
    }
    
    /**
     * Format timestamp (HH:MM:SS.mmm)
     */
    private formatTimestamp(): string {
        const now = new Date();
        return now.toISOString().substring(11, 23);
    }
    
    /**
     * Log a message with level and optional cycle context
     */
    log(level: LogLevel, message: string, cycleId?: number, metrics?: any): void {
        const timestamp = this.formatTimestamp();
        const fullTimestamp = new Date().toISOString();
        const emoji = this.emojis[level] || '•';
        
        // Structured log entry
        const entry: StructuredLogEntry = {
            timestamp: fullTimestamp,
            level,
            cycle_id: cycleId,
            message,
            metrics
        };
        
        // Append to structured log file
        this.appendStructuredLog(entry);
        
        // Console output (minimal or verbose)
        if (this.useMinimalLogs) {
            this.logMinimal(timestamp, emoji, level, message, cycleId, metrics);
        } else if (this.useVerboseLogs) {
            this.logVerbose(timestamp, emoji, level, message, cycleId, metrics);
        }
        
        // Check for periodic summaries
        this.checkPeriodicSummaries();
    }
    
    /**
     * Minimal console output (default)
     */
    private logMinimal(timestamp: string, emoji: string, level: LogLevel, message: string, cycleId?: number, metrics?: any): void {
        if (level === 'CYCLE') {
            // Cycle-level logs are always shown
            this.channel.appendLine(`[${timestamp}] ${emoji} [${level}${cycleId ? `#${cycleId}` : ''}] ${message}`);
        } else if (level === 'WARNING' || level === 'ERROR') {
            // Warnings and errors always shown
            this.channel.appendLine(`[${timestamp}] ${emoji} ${message}`);
        } else {
            // Other logs shown as indented sub-items
            this.channel.appendLine(`[${timestamp}]   ↳ ${message}`);
        }
    }
    
    /**
     * Verbose console output (debug mode)
     */
    private logVerbose(timestamp: string, emoji: string, level: LogLevel, message: string, cycleId?: number, metrics?: any): void {
        const prefix = cycleId ? `[CYCLE#${cycleId}]` : '';
        this.channel.appendLine(`[${timestamp}] ${emoji} [${level}] ${prefix} ${message}`);
        
        if (metrics && Object.keys(metrics).length > 0) {
            this.channel.appendLine(`[${timestamp}]     Metrics: ${JSON.stringify(metrics)}`);
        }
    }
    
    /**
     * Log cycle start
     * MODIFIED (Phase 4): Silent by default - cycles are accumulated for hourly summaries
     */
    cycleStart(cycleId: number): void {
        this.currentCycleStartTime = Date.now();
        this.currentCycleBuffer = [];
        
        // Silent by default - cycles are accumulated and shown only in hourly summaries
        // Structured log is still written for debugging/audit trail
        this.appendStructuredLog({
            timestamp: new Date().toISOString(),
            level: 'CYCLE',
            cycle_id: cycleId,
            message: 'Cycle started (silent)',
            metrics: { phase: 'cognitive-cycle' } as any // Custom metrics structure for audit trail
        });
    }
    
    /**
     * Log cycle end with summary
     * MODIFIED (Phase 4): Silent by default - cycles are accumulated for hourly summaries
     */
    cycleEnd(cycleId: number, phases: { patterns: number; correlations: number; forecasts: number; adrs: number }, health: { drift: number; coherence: number; status: string }): void {
        const duration = Date.now() - this.currentCycleStartTime;
        
        // Create summary (always accumulated for hourly summaries)
        const summary: CycleSummary = {
            cycle_id: cycleId,
            patterns: phases.patterns,
            correlations: phases.correlations,
            forecasts: phases.forecasts,
            adrs: phases.adrs,
            duration_ms: duration,
            health
        };
        
        this.cycleSummaries.push(summary);
        
        // Silent by default - cycles are accumulated and shown only in hourly summaries
        // Only log errors if health status indicates a problem
        if (health.status === 'error' || health.status === 'critical') {
            const timestamp = this.formatTimestamp();
            this.channel.appendLine(`[${timestamp}] ${this.emojis.ERROR} [CYCLE#${cycleId}] Error detected — health: ${health.status} (drift = ${health.drift.toFixed(2)}, coherence = ${health.coherence.toFixed(2)})`);
        }
        
        // Structured log (always written for audit trail)
        this.appendStructuredLog({
            timestamp: new Date().toISOString(),
            level: 'CYCLE',
            cycle_id: cycleId,
            phase: 'complete',
            message: `Cycle #${cycleId} completed (silent)`,
            metrics: { ...phases, duration_ms: duration, health }
        });
    }
    
    /**
     * Log phase execution
     * MODIFIED (Phase 4): Silent by default - phases are accumulated for hourly summaries
     */
    phase(phaseName: string, cycleId: number, count: number, durationMs?: number): void {
        // Silent by default - phases are accumulated and shown only in hourly summaries
        // Structured log is still written for debugging/audit trail
        this.appendStructuredLog({
            timestamp: new Date().toISOString(),
            level: 'COGNITION',
            cycle_id: cycleId,
            phase: phaseName,
            message: `${phaseName} phase completed (silent)`,
            metrics: { count, duration_ms: durationMs } as any // Custom metrics structure for audit trail
        });
    }
    
    /**
     * Log system event
     */
    system(message: string, emoji?: string): void {
        const timestamp = this.formatTimestamp();
        const icon = emoji || this.emojis.SYSTEM;
        
        if (this.useMinimalLogs) {
            this.channel.appendLine(`[${timestamp}] ${icon} ${message}`);
        } else {
            this.log('SYSTEM', message);
        }
    }
    
    /**
     * Log narrative message (storytelling, user-facing)
     * 
     * Used for onboarding, insights, and emotional intelligence reactions.
     * Designed to be engaging and human-readable.
     */
    narrative(message: string): void {
        // Detect special formatting
        if (message.startsWith('═══')) {
            // Full-width separator
            this.channel.appendLine(message);
        } else if (message === '') {
            // Empty line
            this.channel.appendLine('');
        } else {
            // Standard narrative with timestamp
            const timestamp = this.formatTimestamp();
            this.channel.appendLine(`[${timestamp}] ${message}`);
        }
    }
    
    /**
     * Log warning
     */
    warning(message: string): void {
        this.log('WARNING', message);
    }
    
    /**
     * Log error
     */
    error(message: string): void {
        this.log('ERROR', message);
    }
    
    /**
     * Append structured log to JSONL file
     */
    private appendStructuredLog(entry: StructuredLogEntry): void {
        try {
            const line = JSON.stringify(entry) + '\n';
            fs.appendFileSync(this.structuredLogPath, line, 'utf-8');
        } catch (error) {
            // Fail silently to avoid infinite loop
        }
    }
    
    /**
     * Check if periodic summaries should be generated
     * MODIFIED: Hourly summaries instead of minute summaries
     */
    private checkPeriodicSummaries(): void {
        const now = Date.now();
        
        // Hourly summary (every 1 hour = 3600000ms)
        if (now - this.lastHourlySummaryTime >= 3600000 && this.cycleSummaries.length > 0) {
            // Note: logHourlySummary() is called from CognitiveScheduler, not here
            // This method is kept for backward compatibility but doesn't auto-generate summaries
            this.lastHourlySummaryTime = now;
        }
        
        // Context snapshot (every 1 hour)
        if (now - this.lastContextSnapshotTime >= 3600000 && this.cycleSummaries.length > 0) {
            this.generateContextSnapshot();
            this.lastContextSnapshotTime = now;
        }
    }
    
    /**
     * Generate context snapshot (every 1 hour)
     * MODIFIED: Changed from 10 minutes to 1 hour
     */
    private generateContextSnapshot(): void {
        if (this.cycleSummaries.length === 0) return;
        
        const lastCycle = this.cycleSummaries[this.cycleSummaries.length - 1];
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine('');
        this.channel.appendLine(`[${timestamp}] ═══════════════════════════════════════════════`);
        this.channel.appendLine(`[${timestamp}] 🧭 CONTEXT SNAPSHOT — ${new Date().toLocaleTimeString()}`);
        this.channel.appendLine(`[${timestamp}] `);
        this.channel.appendLine(`[${timestamp}]   Phase: cognitive-cycle | Drift: ${lastCycle.health.drift.toFixed(2)} | Coherence: ${lastCycle.health.coherence.toFixed(2)}`);
        this.channel.appendLine(`[${timestamp}]   Active Module: RL4 Kernel | Status: ${lastCycle.health.status}`);
        this.channel.appendLine(`[${timestamp}]   Total Cycles: ${this.cycleSummaries.length}`);
        this.channel.appendLine(`[${timestamp}] ═══════════════════════════════════════════════`);
        this.channel.appendLine('');
    }
    
    /**
     * Get health status icon
     */
    private getHealthIcon(status: string): string {
        switch (status) {
            case 'stable':
            case 'healthy':
                return '🟢';
            case 'degraded':
            case 'warning':
                return '🟡';
            case 'critical':
            case 'error':
                return '🔴';
            default:
                return '⚪';
        }
    }
    
    /**
     * Get channel instance
     */
    getChannel(): vscode.OutputChannel {
        return this.channel;
    }
    
    /**
     * Clear all logs
     */
    clear(): void {
        this.channel.clear();
        this.cycleSummaries = [];
    }
    
    /**
     * Get accumulated cycle summaries (for hourly summary generation)
     * Phase 4: Used by CognitiveScheduler to generate hourly summaries
     */
    getCycleSummaries(): CycleSummary[] {
        return [...this.cycleSummaries]; // Return a copy
    }
    
    /**
     * Clear cycle summaries (after generating hourly summary)
     * Phase 4: Used by CognitiveScheduler after hourly summary generation
     */
    clearCycleSummaries(): void {
        this.cycleSummaries = [];
    }
    
    // ===== NEW METHODS: TRANSPARENCY LOGGING =====
    
    /**
     * Log file change aggregate (every 30 seconds)
     */
    logFileChangeAggregate(period: number, changes: FileChangeSummary): void {
        const timestamp = this.formatTimestamp();
        
        if (changes.files_modified === 0) {
            // No changes, silent (don't log)
            return;
        }
        
        this.channel.appendLine(`[${timestamp}] ${this.emojis.FILE_CHANGE} **File Changes (Last ${period}s)**`);
        this.channel.appendLine(`           └─ Files Modified: ${changes.files_modified} (${changes.files.slice(0, 3).join(', ')}${changes.files.length > 3 ? '...' : ''})`);
        this.channel.appendLine(`           └─ Total Edits: ${changes.total_edits} edits`);
        
        if (changes.hotspot) {
            this.channel.appendLine(`           └─ Hotspot: ${changes.hotspot.file} (${changes.hotspot.edits} edits in ${period}s)`);
        }
        
        this.channel.appendLine(`           └─ Status: ✅ Captured`);
    }
    
    /**
     * Log commit capture (ALL commits, they're rare)
     */
    logCommitCapture(commit: CommitEvent): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] ${this.emojis.COMMIT} **Git Commit Captured**`);
        this.channel.appendLine(`           └─ Hash: ${commit.hash.substring(0, 7)}`);
        this.channel.appendLine(`           └─ Message: ${commit.message.substring(0, 60)}${commit.message.length > 60 ? '...' : ''}`);
        this.channel.appendLine(`           └─ Author: ${commit.author}`);
        this.channel.appendLine(`           └─ Files: ${commit.files_changed} changed (+${commit.insertions}/-${commit.deletions})`);
        
        if (commit.intent) {
            this.channel.appendLine(`           └─ Intent: ${commit.intent.type}${commit.intent.keywords && commit.intent.keywords.length > 0 ? ` (keywords: ${commit.intent.keywords.join(', ')})` : ''}`);
        }
        
        this.channel.appendLine(`           └─ Timestamp: ${commit.timestamp}`);
    }
    
    /**
     * Log cycle error (only when error occurs)
     */
    logCycleError(cycleId: number, error: string): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] ${this.emojis.ERROR} **Cycle #${cycleId} Error**`);
        this.channel.appendLine(`           └─ Error: ${error}`);
        this.channel.appendLine(`           └─ Status: ⚠️ Retrying...`);
        
        this.log('ERROR', `Cycle #${cycleId} failed: ${error}`, cycleId);
    }
    
    /**
     * Log pattern change (only when significant change detected)
     */
    logPatternChange(cycleId: number, patternChange: PatternChange): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] ${this.emojis.PATTERN} **Pattern Change Detected** (Cycle #${cycleId})`);
        this.channel.appendLine(`           └─ Change Type: ${patternChange.change_type}`);
        this.channel.appendLine(`           └─ Patterns: ${patternChange.patterns.length} patterns`);
        
        patternChange.patterns.slice(0, 3).forEach((pattern, idx) => {
            this.channel.appendLine(`           └─ Pattern ${idx + 1}: ${pattern.type} (confidence: ${pattern.confidence.toFixed(2)})`);
        });
        
        if (patternChange.patterns.length > 3) {
            this.channel.appendLine(`           └─ ... and ${patternChange.patterns.length - 3} more`);
        }
    }
    
    /**
     * Log health issue (only when problem detected)
     */
    logHealthIssue(health: HealthMetrics, issue: string): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] ${this.emojis.HEALTH} **Health Issue Detected**`);
        this.channel.appendLine(`           └─ Memory: ${health.memory_mb}MB`);
        this.channel.appendLine(`           └─ Event Loop: ${health.event_loop_p50_ms.toFixed(2)}ms p50`);
        this.channel.appendLine(`           └─ Issue: ${issue}`);
        this.channel.appendLine(`           └─ Status: ${health.status === 'error' ? '🔴' : '🟡'}`);
        
        this.log('HEALTH', `Health issue: ${issue}`, undefined, {
            memory_mb: health.memory_mb,
            event_loop_p50_ms: health.event_loop_p50_ms,
            status: health.status
        });
    }
    
    /**
     * Log welcome back (after >1h absence)
     */
    logWelcomeBack(lastActivity: Date, summary: SessionSummary): void {
        const timestamp = this.formatTimestamp();
        const hoursAgo = Math.round((Date.now() - lastActivity.getTime()) / 3600000);
        
        this.channel.appendLine('');
        this.channel.appendLine(`[${timestamp}] ⏸️ **Welcome Back** — Retour après ${hoursAgo}h`);
        this.channel.appendLine(`           └─ Last Activity: ${lastActivity.toLocaleString()}`);
        this.channel.appendLine(`           └─ Workspace: ${summary.workspace}`);
        this.channel.appendLine(`           └─ Total Events: ${summary.total_events}`);
        this.channel.appendLine(`           └─ Listeners: ${summary.listeners_active ? '✅ Active' : '⚠️ Inactive'}`);
        this.channel.appendLine(`           └─ Data Integrity: ${summary.data_integrity === 'valid' ? '✅ Valid' : '⚠️ Warning'}`);
        this.channel.appendLine(`           └─ Status: ✅ Capturing continues in background`);
    }
    
    /**
     * Log hourly summary (every 1 hour)
     * REPLACES generateMinuteSummary()
     */
    logHourlySummary(summary: HourlySummary): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine('');
        this.channel.appendLine(`[${timestamp}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.channel.appendLine(`[${timestamp}] 📊 **Hourly Summary (Last Hour)**`);
        this.channel.appendLine(`[${timestamp}]   └─ Cycles: ${summary.cycles_captured} captured (silent)`);
        this.channel.appendLine(`[${timestamp}]   └─ File Changes: ${summary.file_changes} events aggregated`);
        this.channel.appendLine(`[${timestamp}]   └─ Git Commits: ${summary.git_commits} commits`);
        this.channel.appendLine(`[${timestamp}]   └─ Health Checks: ${summary.health_checks} checks`);
        if (summary.gaps_detected > 0) {
            this.channel.appendLine(`[${timestamp}]   └─ Gaps Detected: ${summary.gaps_detected} gaps (>15 min, normal)`);
        }
        this.channel.appendLine(`[${timestamp}]   └─ Health: ${summary.health_status === 'healthy' ? '✅' : '⚠️'} ${summary.health_status}`);
        this.channel.appendLine(`[${timestamp}]   └─ Status: ✅ All systems capturing`);
        this.channel.appendLine(`[${timestamp}]   └─ Data Integrity: ${summary.data_integrity === 'valid' ? '✅ Valid' : '⚠️ Warning'}`);
        this.channel.appendLine(`[${timestamp}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.channel.appendLine('');
        
        // Structured log (use any for custom metrics structure)
        this.appendStructuredLog({
            timestamp: new Date().toISOString(),
            level: 'SYSTEM',
            message: `Hourly summary: ${summary.cycles_captured} cycles, ${summary.file_changes} file changes, ${summary.git_commits} commits`,
            metrics: summary as any // HourlySummary doesn't match StructuredLogEntry.metrics type
        });
    }
    
    // ===== NEW METHODS: SNAPSHOT LOGGING =====
    
    /**
     * Log snapshot generation started
     */
    logSnapshotStart(mode: string, dataSummary: SnapshotDataSummary): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine('');
        this.channel.appendLine(`[${timestamp}] ${this.emojis.SNAPSHOT} **Snapshot Generation Started**`);
        this.channel.appendLine(`           └─ Mode: ${mode}`);
        this.channel.appendLine(`           └─ User Request: reasoning.kernel.whereami`);
    }
    
    /**
     * Log data aggregation for snapshot
     */
    logDataAggregation(summary: SnapshotDataSummary): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] 📊 **Data Aggregated for Snapshot**`);
        this.channel.appendLine(`           └─ Cycles: ${summary.total_cycles} total`);
        this.channel.appendLine(`           └─ Commits: ${summary.recent_commits} recent (last 2h)`);
        this.channel.appendLine(`           └─ File Changes: ${summary.file_changes} events (last 2h)`);
        this.channel.appendLine(`           └─ Plan.RL4: ${summary.plan_rl4_found ? '✅ Found' : '⚠️ Not found'}`);
        this.channel.appendLine(`           └─ Tasks.RL4: ${summary.tasks_rl4_found ? '✅ Found' : '⚠️ Not found'}`);
        this.channel.appendLine(`           └─ Context.RL4: ${summary.context_rl4_found ? '✅ Found' : '⚠️ Not found'}`);
        this.channel.appendLine(`           └─ ADRs: ${summary.adrs_count} documented`);
    }
    
    /**
     * Log LLM analysis (via prompt generated)
     */
    logLLMAnalysis(confidence: number, bias: number, metrics: LLMAnalysisMetrics): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] 🧠 **LLM Analysis (via Prompt)**`);
        this.channel.appendLine(`           └─ Confidence: ${(confidence * 100).toFixed(0)}%`);
        this.channel.appendLine(`           └─ Bias: ${(bias * 100).toFixed(0)}% (vs baseline)`);
        this.channel.appendLine(`           └─ Cognitive Load: ${metrics.cognitive_load.toFixed(2)} (${metrics.cognitive_load < 0.5 ? 'Normal' : metrics.cognitive_load < 0.7 ? 'High' : 'Very High'})`);
        this.channel.appendLine(`           └─ Plan Drift: ${(metrics.plan_drift * 100).toFixed(0)}% (Phase changed, Goal modified)`);
    }
    
    /**
     * Log insights generated (from LLM via prompt)
     */
    logInsights(insights: Insight[]): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] ${this.emojis.INSIGHT} **Insights Generated (from LLM via Prompt)**`);
        
        insights.forEach((insight, idx) => {
            const emoji = insight.type === 'inference' ? '🔍' : insight.type === 'suggestion' ? '💡' : insight.type === 'alert' ? '⚠️' : '🔗';
            this.channel.appendLine(`           └─ ${emoji} ${insight.type.charAt(0).toUpperCase() + insight.type.slice(1)}: ${insight.message}`);
        });
    }
    
    /**
     * Log snapshot generated
     */
    logSnapshotGenerated(size: number, sections: number): void {
        const timestamp = this.formatTimestamp();
        const sizeKB = (size / 1024).toFixed(1);
        
        this.channel.appendLine(`[${timestamp}] ✅ **Snapshot Generated**`);
        this.channel.appendLine(`           └─ Size: ${sizeKB} KB`);
        this.channel.appendLine(`           └─ Sections: ${sections} sections`);
        this.channel.appendLine(`           └─ Status: ✅ Copied to clipboard`);
        this.channel.appendLine(`           └─ Next: Paste in AI agent (Cursor/Claude)`);
        this.channel.appendLine('');
    }
    
    /**
     * Log RL4 file update (when LLM modifies Plan/Tasks/Context/ADR)
     */
    logRL4FileUpdate(file: 'Plan' | 'Tasks' | 'Context' | 'ADR', changes: RL4FileChanges): void {
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine(`[${timestamp}] ${this.emojis.UPDATE} **${file}.RL4 Updated** (via LLM agent)`);
        this.channel.appendLine(`           └─ Updated By: ${changes.updated_by}`);
        this.channel.appendLine(`           └─ Changes: ${changes.changes}`);
        this.channel.appendLine(`           └─ Version: ${changes.version_old} → ${changes.version_new}`);
        this.channel.appendLine(`           └─ Timestamp: ${changes.timestamp}`);
    }
}


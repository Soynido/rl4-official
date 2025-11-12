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

export class CognitiveLogger {
    private channel: vscode.OutputChannel;
    private workspaceRoot: string;
    private structuredLogPath: string;
    private useMinimalLogs: boolean = true;
    private useVerboseLogs: boolean = false;
    
    // Cycle tracking
    private cycleSummaries: CycleSummary[] = [];
    private lastMinuteSummaryTime: number = Date.now();
    private lastContextSnapshotTime: number = Date.now();
    private currentCycleStartTime: number = 0;
    private currentCycleBuffer: string[] = [];
    
    // Emoji mapping
    private readonly emojis = {
        CYCLE: '🧠',
        SYSTEM: '⚙️',
        COGNITION: '🔍',
        OUTPUT: '📤',
        HEALTH: '🛡️',
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
        SNAPSHOT: '📸',
        TIMELINE: '📅'
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
     */
    cycleStart(cycleId: number): void {
        this.currentCycleStartTime = Date.now();
        this.currentCycleBuffer = [];
        
        if (this.useMinimalLogs) {
            this.channel.appendLine('');
        }
        
        this.log('CYCLE', `START — Phase: cognitive-cycle`, cycleId);
    }
    
    /**
     * Log cycle end with summary
     */
    cycleEnd(cycleId: number, phases: { patterns: number; correlations: number; forecasts: number; adrs: number }, health: { drift: number; coherence: number; status: string }): void {
        const duration = Date.now() - this.currentCycleStartTime;
        const timestamp = this.formatTimestamp();
        
        // Create summary
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
        
        // Log cycle end
        if (this.useMinimalLogs) {
            this.channel.appendLine(`[${timestamp}]   ↳ ${phases.patterns} patterns | ${phases.correlations} correlations | ${phases.forecasts} forecasts | ${phases.adrs} ADRs`);
            this.channel.appendLine(`[${timestamp}] ${this.emojis.SUCCESS} [CYCLE#${cycleId}] END — health: ${health.status} (drift = ${health.drift.toFixed(2)}, coherence = ${health.coherence.toFixed(2)}) — ${duration}ms`);
        } else {
            this.log('CYCLE', `END — Duration: ${duration}ms`, cycleId, { ...phases, duration_ms: duration, health });
        }
        
        // Structured log
        this.appendStructuredLog({
            timestamp: new Date().toISOString(),
            level: 'CYCLE',
            cycle_id: cycleId,
            phase: 'complete',
            message: `Cycle #${cycleId} completed`,
            metrics: { ...phases, duration_ms: duration, health }
        });
    }
    
    /**
     * Log phase execution
     */
    phase(phaseName: string, cycleId: number, count: number, durationMs?: number): void {
        let emoji = '•';
        
        switch (phaseName) {
            case 'pattern-learning':
                emoji = this.emojis.PATTERN;
                break;
            case 'correlation':
                emoji = this.emojis.CORRELATION;
                break;
            case 'forecasting':
                emoji = this.emojis.FORECAST;
                break;
            case 'adr-synthesis':
                emoji = this.emojis.ADR;
                break;
        }
        
        const message = `${count} ${phaseName.replace('-', ' ')} items${durationMs ? ` (${durationMs}ms)` : ''}`;
        
        if (this.useMinimalLogs) {
            const timestamp = this.formatTimestamp();
            this.channel.appendLine(`[${timestamp}]   ↳ ${emoji} ${message}`);
        } else {
            this.log('COGNITION', message, cycleId, { phase: phaseName, count, duration_ms: durationMs });
        }
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
     */
    private checkPeriodicSummaries(): void {
        const now = Date.now();
        
        // Minute summary (every 60s)
        if (now - this.lastMinuteSummaryTime >= 60000 && this.cycleSummaries.length > 0) {
            this.generateMinuteSummary();
            this.lastMinuteSummaryTime = now;
        }
        
        // Context snapshot (every 10 minutes)
        if (now - this.lastContextSnapshotTime >= 600000 && this.cycleSummaries.length > 0) {
            this.generateContextSnapshot();
            this.lastContextSnapshotTime = now;
        }
    }
    
    /**
     * Generate cycle summary (every minute)
     */
    private generateMinuteSummary(): void {
        if (this.cycleSummaries.length === 0) return;
        
        const recentCycles = this.cycleSummaries.slice(-5); // Last 5 cycles
        const avgDuration = recentCycles.reduce((sum, c) => sum + c.duration_ms, 0) / recentCycles.length;
        const avgPatterns = Math.round(recentCycles.reduce((sum, c) => sum + c.patterns, 0) / recentCycles.length);
        const avgCorrelations = Math.round(recentCycles.reduce((sum, c) => sum + c.correlations, 0) / recentCycles.length);
        const avgForecasts = Math.round(recentCycles.reduce((sum, c) => sum + c.forecasts, 0) / recentCycles.length);
        const lastHealth = recentCycles[recentCycles.length - 1].health;
        
        const timestamp = this.formatTimestamp();
        
        this.channel.appendLine('');
        this.channel.appendLine(`[${timestamp}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.channel.appendLine(`[${timestamp}] 📊 CYCLE SUMMARY — Last ${recentCycles.length} cycles`);
        this.channel.appendLine(`[${timestamp}]   • Avg duration: ${Math.round(avgDuration)}ms`);
        this.channel.appendLine(`[${timestamp}]   • Patterns: ${avgPatterns} stable`);
        this.channel.appendLine(`[${timestamp}]   • Correlations: ${avgCorrelations} consistent`);
        this.channel.appendLine(`[${timestamp}]   • Forecasts: ${avgForecasts} active`);
        this.channel.appendLine(`[${timestamp}]   • Health: ${this.getHealthIcon(lastHealth.status)} ${lastHealth.status} (drift: ${lastHealth.drift.toFixed(2)}, coherence: ${lastHealth.coherence.toFixed(2)})`);
        this.channel.appendLine(`[${timestamp}] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
        this.channel.appendLine('');
    }
    
    /**
     * Generate context snapshot (every 10 minutes)
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
}


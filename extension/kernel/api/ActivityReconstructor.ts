/**
 * ActivityReconstructor — Reconstructs activity between two snapshots
 * 
 * Reads file_changes.jsonl and terminal-events.jsonl between two timestamps
 * Correlates events and generates a summary "What was done between snapshot X and Y"
 * 
 * Purpose: Help LLM understand EXACTLY what happened between snapshots
 * 
 * ✅ P2: Phase 2 Integration
 */

import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

export interface ActivitySummary {
    fromTimestamp: string;
    toTimestamp: string;
    durationMs: number;
    fileChanges: {
        total: number;
        byPattern: Record<string, number>; // 'feature', 'fix', 'refactor', etc.
        files: Array<{ path: string; pattern: string; timestamp: string }>;
    };
    terminalEvents: {
        total: number;
        byTask: Record<string, number>; // taskId -> count
        commands: Array<{ command: string; taskId?: string; timestamp: string; exitCode?: number }>;
        successRate: number; // % of commands with exitCode 0
    };
    correlations: Array<{
        type: 'file_terminal' | 'task_completion' | 'burst_activity';
        description: string;
        confidence: number;
    }>;
    summary: string; // Human-readable summary
}

interface FileChangeEvent {
    timestamp: string;
    id: string;
    type: string;
    metadata?: {
        file?: string;
        changes?: Array<{ path: string }>;
        pattern?: string;
        changeType?: string;
    };
}

interface TerminalEvent {
    timestamp: string;
    type: 'command_start' | 'command_end' | 'output' | 'file_created' | 'git_commit' | 'custom';
    taskId?: string;
    command?: string;
    exitCode?: number;
    output?: string;
    file?: string;
    metadata?: any;
}

export class ActivityReconstructor {
    private workspaceRoot: string;
    private rl4Path: string;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.rl4Path = path.join(workspaceRoot, '.reasoning_rl4');
    }
    
    /**
     * Reconstruct activity between two timestamps
     */
    async reconstruct(fromTimestamp: string, toTimestamp: string): Promise<ActivitySummary> {
        const from = new Date(fromTimestamp).getTime();
        const to = new Date(toTimestamp).getTime();
        const durationMs = to - from;
        
        // 1. Read file_changes.jsonl between timestamps
        const fileChanges = await this.readFileChanges(fromTimestamp, toTimestamp);
        
        // 2. Read terminal-events.jsonl between timestamps
        const terminalEvents = await this.readTerminalEvents(fromTimestamp, toTimestamp);
        
        // 3. Correlate events
        const correlations = this.correlateEvents(fileChanges, terminalEvents, durationMs);
        
        // 4. Generate summary
        const summary = this.generateSummary(fileChanges, terminalEvents, correlations, durationMs);
        
        return {
            fromTimestamp,
            toTimestamp,
            durationMs,
            fileChanges: {
                total: fileChanges.length,
                byPattern: this.groupByPattern(fileChanges),
                files: fileChanges.slice(0, 20).map(f => ({ // Limit to 20 most recent
                    path: f.metadata?.file || f.metadata?.changes?.[0]?.path || f.id,
                    pattern: f.metadata?.pattern || 'unknown',
                    timestamp: f.timestamp
                }))
            },
            terminalEvents: {
                total: terminalEvents.length,
                byTask: this.groupByTask(terminalEvents),
                commands: terminalEvents.slice(0, 20).map(e => ({ // Limit to 20 most recent
                    command: e.command || '',
                    taskId: e.taskId,
                    timestamp: e.timestamp,
                    exitCode: e.exitCode
                })),
                successRate: this.calculateSuccessRate(terminalEvents)
            },
            correlations,
            summary
        };
    }
    
    /**
     * Read file changes between timestamps
     * Reuses logic from StateReconstructor
     */
    private async readFileChanges(fromTimestamp: string, toTimestamp: string): Promise<FileChangeEvent[]> {
        const changesPath = path.join(this.rl4Path, 'traces', 'file_changes.jsonl');
        
        if (!fs.existsSync(changesPath)) {
            return [];
        }
        
        const events: FileChangeEvent[] = [];
        const fromTime = new Date(fromTimestamp).getTime();
        const toTime = new Date(toTimestamp).getTime();
        
        const lines = fs.readFileSync(changesPath, 'utf-8').split('\n').filter(Boolean);
        
        for (const line of lines) {
            try {
                const event = JSON.parse(line) as FileChangeEvent;
                const eventTime = new Date(event.timestamp).getTime();
                
                if (eventTime >= fromTime && eventTime <= toTime) {
                    events.push(event);
                }
            } catch (e) {
                // Skip invalid lines
            }
        }
        
        return events;
    }
    
    /**
     * Read terminal events between timestamps
     * Reuses logic from TaskVerificationEngine
     */
    private async readTerminalEvents(fromTimestamp: string, toTimestamp: string): Promise<TerminalEvent[]> {
        const eventsPath = path.join(this.rl4Path, 'terminal-events.jsonl');
        
        if (!fs.existsSync(eventsPath)) {
            return [];
        }
        
        const events: TerminalEvent[] = [];
        const fromTime = new Date(fromTimestamp).getTime();
        const toTime = new Date(toTimestamp).getTime();
        
        const fileStream = fs.createReadStream(eventsPath);
        const rl = readline.createInterface({
            input: fileStream,
            crlfDelay: Infinity
        });
        
        for await (const line of rl) {
            if (!line.trim()) continue;
            
            try {
                const event = JSON.parse(line) as TerminalEvent;
                const eventTime = new Date(event.timestamp).getTime();
                
                if (eventTime >= fromTime && eventTime <= toTime) {
                    events.push(event);
                }
            } catch (e) {
                // Skip invalid lines
            }
        }
        
        return events;
    }
    
    /**
     * Group file changes by pattern
     */
    private groupByPattern(fileChanges: FileChangeEvent[]): Record<string, number> {
        const byPattern: Record<string, number> = {};
        
        for (const change of fileChanges) {
            const pattern = change.metadata?.pattern || 'unknown';
            byPattern[pattern] = (byPattern[pattern] || 0) + 1;
        }
        
        return byPattern;
    }
    
    /**
     * Group terminal events by task
     */
    private groupByTask(terminalEvents: TerminalEvent[]): Record<string, number> {
        const byTask: Record<string, number> = {};
        
        for (const event of terminalEvents) {
            if (event.taskId) {
                byTask[event.taskId] = (byTask[event.taskId] || 0) + 1;
            }
        }
        
        return byTask;
    }
    
    /**
     * Calculate success rate of terminal commands
     */
    private calculateSuccessRate(terminalEvents: TerminalEvent[]): number {
        const commandEnds = terminalEvents.filter(e => e.type === 'command_end' && e.exitCode !== undefined);
        
        if (commandEnds.length === 0) {
            return 0;
        }
        
        const successful = commandEnds.filter(e => e.exitCode === 0).length;
        return Math.round((successful / commandEnds.length) * 100);
    }
    
    /**
     * Correlate file changes and terminal events
     */
    private correlateEvents(
        fileChanges: FileChangeEvent[],
        terminalEvents: TerminalEvent[],
        durationMs: number
    ): Array<{ type: 'file_terminal' | 'task_completion' | 'burst_activity'; description: string; confidence: number }> {
        const correlations: Array<{ type: 'file_terminal' | 'task_completion' | 'burst_activity'; description: string; confidence: number }> = [];
        
        // Detect burst activity (many changes in short time)
        if (fileChanges.length > 10 && durationMs < 3600000) {
            correlations.push({
                type: 'burst_activity',
                description: `High activity burst: ${fileChanges.length} file changes in ${Math.round(durationMs / 60000)} minutes`,
                confidence: 0.9
            });
        }
        
        // Correlate file changes with terminal commands
        for (const termEvent of terminalEvents) {
            if (termEvent.type === 'command_end' && termEvent.exitCode === 0) {
                const termTime = new Date(termEvent.timestamp).getTime();
                
                // Find file changes within 60s after command
                const relatedChanges = fileChanges.filter(fc => {
                    const changeTime = new Date(fc.timestamp).getTime();
                    return changeTime >= termTime && (changeTime - termTime) < 60000;
                });
                
                if (relatedChanges.length > 0) {
                    correlations.push({
                        type: 'file_terminal',
                        description: `Command "${termEvent.command}" likely caused ${relatedChanges.length} file change(s)`,
                        confidence: 0.7
                    });
                }
            }
        }
        
        // Detect task completion patterns
        const taskIds = new Set(terminalEvents.filter(e => e.taskId).map(e => e.taskId!));
        for (const taskId of taskIds) {
            const taskEvents = terminalEvents.filter(e => e.taskId === taskId);
            const successfulEnds = taskEvents.filter(e => e.type === 'command_end' && e.exitCode === 0).length;
            
            if (successfulEnds > 0) {
                correlations.push({
                    type: 'task_completion',
                    description: `Task ${taskId}: ${successfulEnds} successful command(s)`,
                    confidence: 0.8
                });
            }
        }
        
        return correlations.slice(0, 10); // Limit to 10 most relevant
    }
    
    /**
     * Generate human-readable summary
     */
    private generateSummary(
        fileChanges: FileChangeEvent[],
        terminalEvents: TerminalEvent[],
        correlations: Array<{ type: 'file_terminal' | 'task_completion' | 'burst_activity'; description: string; confidence: number }>,
        durationMs: number
    ): string {
        const parts: string[] = [];
        
        // Duration
        const hours = Math.floor(durationMs / 3600000);
        const minutes = Math.floor((durationMs % 3600000) / 60000);
        if (hours > 0) {
            parts.push(`${hours}h ${minutes}min`);
        } else {
            parts.push(`${minutes}min`);
        }
        
        // File changes summary
        if (fileChanges.length > 0) {
            const byPattern = this.groupByPattern(fileChanges);
            const topPattern = Object.entries(byPattern).sort((a, b) => b[1] - a[1])[0];
            parts.push(`${fileChanges.length} file change(s)`);
            if (topPattern) {
                parts.push(`mostly ${topPattern[0]} (${topPattern[1]})`);
            }
        } else {
            parts.push('no file changes');
        }
        
        // Terminal events summary
        if (terminalEvents.length > 0) {
            const successRate = this.calculateSuccessRate(terminalEvents);
            parts.push(`${terminalEvents.length} terminal command(s) (${successRate}% success)`);
        } else {
            parts.push('no terminal activity');
        }
        
        // Key correlation
        if (correlations.length > 0) {
            const topCorrelation = correlations.sort((a, b) => b.confidence - a.confidence)[0];
            parts.push(`— ${topCorrelation.description}`);
        }
        
        return parts.join(', ');
    }
}


/**
 * PersistenceManagerProxy - Redirect RL3 Persistence to Kernel
 * 
 * Replaces synchronous fs.writeFileSync with AppendOnlyWriter
 * Used via TypeScript path alias (no code changes)
 * 
 * RL4 Adapter #2
 */

import { AppendOnlyWriter } from '../AppendOnlyWriter';
import { UnifiedLogger } from '../../core/UnifiedLogger';
import * as path from 'path';

export class PersistenceManagerProxy {
    private writer: AppendOnlyWriter;
    private logger: UnifiedLogger;
    private workspaceRoot: string;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.logger = UnifiedLogger.getInstance();
        
        const tracesPath = path.join(
            workspaceRoot,
            '.reasoning_rl4',
            'traces',
            `${new Date().toISOString().split('T')[0]}.jsonl`
        );
        
        this.writer = new AppendOnlyWriter(tracesPath);
    }
    
    /**
     * Save event (async append-only)
     */
    async saveEvent(event: any): Promise<void> {
        await this.writer.append(event);
    }
    
    /**
     * RL3-compatible sync methods (delegated to logger)
     */
    logWithEmoji(emoji: string, message: string): void {
        this.logger.logWithEmoji(emoji, message);
    }
    
    show(): void {
        this.logger.show();
    }
    
    appendLine(message: string): void {
        this.logger.log(message);
    }
    
    getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }
    
    /**
     * Flush writer (force write)
     */
    async flush(): Promise<void> {
        await this.writer.flush(true);
    }
    
    /**
     * Dispose (cleanup)
     */
    async dispose(): Promise<void> {
        await this.flush();
    }
}


/**
 * RL3Bridge - Adaptateur RL3 → RL4 Kernel
 * 
 * Permet aux engines RL3 de fonctionner sur l'infrastructure RL4
 * sans modifier leur code source.
 * 
 * Conversions principales:
 * - PersistenceManager → AppendOnlyWriter
 * - Paths .reasoning/ → .reasoning_rl4/
 * - Sync writes → Async writes
 * - JSON → JSONL
 * 
 * RL4 Adapter #3
 */

import { AppendOnlyWriter } from '../AppendOnlyWriter';
import { UnifiedLogger } from '../../core/UnifiedLogger';
import * as path from 'path';

export class RL3Bridge {
    private static writers = new Map<string, AppendOnlyWriter>();
    private static logger = UnifiedLogger.getInstance();
    
    /**
     * Get or create AppendOnlyWriter for a given path
     */
    private static getWriter(filePath: string): AppendOnlyWriter {
        if (!this.writers.has(filePath)) {
            this.writers.set(filePath, new AppendOnlyWriter(filePath));
        }
        return this.writers.get(filePath)!;
    }
    
    /**
     * Save pattern to RL4 storage
     * @param pattern - Pattern object from PatternLearningEngine
     */
    static async savePattern(pattern: any): Promise<void> {
        const writer = this.getWriter('.reasoning_rl4/patterns.jsonl');
        await writer.append({ type: 'pattern', ...pattern });
    }
    
    /**
     * Save correlation to RL4 storage
     * @param correlation - Correlation object from CorrelationEngine
     */
    static async saveCorrelation(correlation: any): Promise<void> {
        const writer = this.getWriter('.reasoning_rl4/correlations.jsonl');
        await writer.append({ type: 'correlation', ...correlation });
    }
    
    /**
     * Save forecast to RL4 storage
     * @param forecast - Forecast object from ForecastEngine
     */
    static async saveForecast(forecast: any): Promise<void> {
        const writer = this.getWriter('.reasoning_rl4/forecasts.jsonl');
        await writer.append({ type: 'forecast', ...forecast });
    }
    
    /**
     * Save ADR to RL4 storage
     * @param adr - ADR markdown content
     * @param filename - ADR filename
     */
    static async saveADR(adr: string, filename: string): Promise<void> {
        const fs = await import('fs/promises');
        const adrDir = '.reasoning_rl4/ADRs/auto';
        
        // Ensure directory exists
        const fsSync = await import('fs');
        if (!fsSync.existsSync(adrDir)) {
            await fs.mkdir(adrDir, { recursive: true });
        }
        
        const adrPath = path.join(adrDir, filename);
        await fs.writeFile(adrPath, adr, 'utf-8');
        
        // Log to ledger
        const writer = this.getWriter('.reasoning_rl4/ledger/adrs.jsonl');
        await writer.append({
            type: 'adr',
            filename,
            generatedAt: new Date().toISOString()
        });
    }
    
    /**
     * Convert RL3 path to RL4 path
     * @param rl3Path - Original RL3 path
     * @returns RL4 path
     */
    static resolvePath(rl3Path: string): string {
        return rl3Path.replace('.reasoning/', '.reasoning_rl4/');
    }
    
    /**
     * Log message via UnifiedLogger
     * @param message - Log message
     */
    static log(message: string): void {
        this.logger.log(message);
    }
    
    /**
     * Log with emoji via UnifiedLogger
     * @param emoji - Emoji character
     * @param message - Log message
     */
    static logWithEmoji(emoji: string, message: string): void {
        this.logger.logWithEmoji(emoji, message);
    }
    
    /**
     * Read all entries from a JSONL file
     * @param filePath - File path (RL4 format)
     * @returns Array of parsed entries
     */
    static async readAll(filePath: string): Promise<any[]> {
        const writer = this.getWriter(filePath);
        return await writer.readAll();
    }
    
    /**
     * Flush all writers (force write to disk)
     */
    static async flushAll(): Promise<void> {
        for (const [path, writer] of this.writers.entries()) {
            await writer.flush(true);
            this.log(`✅ Flushed: ${path}`);
        }
    }
    
    /**
     * Get workspace root (RL4 compatible)
     */
    static getWorkspaceRoot(): string {
        return process.cwd();
    }
}


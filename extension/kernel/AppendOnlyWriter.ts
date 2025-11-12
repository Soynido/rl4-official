/**
 * AppendOnlyWriter - JSONL Append-Only Writer with Rotation
 * 
 * Replaces array-based JSON writes with append-only JSONL.
 * Features:
 * - Append-only (no array rewrite)
 * - Automatic rotation (50MB limit)
 * - fsync on flush (durability)
 * - Per-file writer instances
 * 
 * RL4 Kernel Component #2
 */

import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';

export interface AppendOptions {
    fsync?: boolean;      // Force fsync (default: false, enabled on flush)
    timestamp?: boolean;  // Add timestamp field (default: true)
}

export class AppendOnlyWriter {
    private filePath: string;
    private maxSizeMB: number = 50;
    private buffer: string[] = [];
    private bufferSize: number = 0;
    private maxBufferSize: number = 1000; // Lines before auto-flush
    
    constructor(filePath: string, maxSizeMB: number = 50) {
        this.filePath = filePath;
        this.maxSizeMB = maxSizeMB;
    }
    
    /**
     * Append a single entry (buffered)
     * @param data - JSON-serializable object
     * @param options - Append options
     */
    async append(data: any, options: AppendOptions = {}): Promise<void> {
        const entry = this.serializeEntry(data, options);
        
        this.buffer.push(entry);
        this.bufferSize += entry.length;
        
        // Auto-flush if buffer full OR every 10 lines (for low-frequency writes)
        if (this.buffer.length >= this.maxBufferSize || this.buffer.length >= 10) {
            await this.flush();
        }
    }
    
    /**
     * Flush buffer to disk
     * @param withFsync - Force fsync for durability
     */
    async flush(withFsync: boolean = false): Promise<void> {
        if (this.buffer.length === 0) {
            return;
        }
        
        // Check if rotation needed
        await this.rotateIfNeeded();
        
        // Ensure directory exists
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Append to file
        const content = this.buffer.join('');
        await fs.appendFile(this.filePath, content, 'utf-8');
        
        // fsync if requested (durability guarantee)
        if (withFsync) {
            const fd = await fs.open(this.filePath, 'r+');
            try {
                await fd.sync();
            } finally {
                await fd.close();
            }
        }
        
        // Clear buffer
        this.buffer = [];
        this.bufferSize = 0;
    }
    
    /**
     * Rotate file if size exceeds limit
     */
    private async rotateIfNeeded(): Promise<void> {
        if (!fsSync.existsSync(this.filePath)) {
            return;
        }
        
        const stats = await fs.stat(this.filePath);
        const sizeMB = stats.size / 1024 / 1024;
        
        if (sizeMB >= this.maxSizeMB) {
            // Rotate: file.jsonl -> file.YYYY-MM-DD-HHmmss.jsonl
            const timestamp = new Date().toISOString().replace(/:/g, '-').split('.')[0];
            const ext = path.extname(this.filePath);
            const base = this.filePath.slice(0, -ext.length);
            const rotatedPath = `${base}.${timestamp}${ext}`;
            
            await fs.rename(this.filePath, rotatedPath);
            console.log(`📦 Rotated ${path.basename(this.filePath)} -> ${path.basename(rotatedPath)} (${sizeMB.toFixed(1)}MB)`);
        }
    }
    
    /**
     * Serialize entry to JSONL line
     */
    private serializeEntry(data: any, options: AppendOptions): string {
        const entry = options.timestamp !== false
            ? { ...data, _timestamp: new Date().toISOString() }
            : data;
        
        return JSON.stringify(entry) + '\n';
    }
    
    /**
     * Read all entries from file
     * @returns Array of parsed entries
     */
    async readAll(): Promise<any[]> {
        if (!fsSync.existsSync(this.filePath)) {
            return [];
        }
        
        const content = await fs.readFile(this.filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);
        
        return lines.map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                console.warn(`⚠️ Invalid JSONL line: ${line.substring(0, 50)}...`);
                return null;
            }
        }).filter(e => e !== null);
    }
    
    /**
     * Get file size in MB
     */
    async getSize(): Promise<number> {
        if (!fsSync.existsSync(this.filePath)) {
            return 0;
        }
        
        const stats = await fs.stat(this.filePath);
        return stats.size / 1024 / 1024;
    }
    
    /**
     * Get buffer status
     */
    getBufferStatus(): { lines: number; bytes: number } {
        return {
            lines: this.buffer.length,
            bytes: this.bufferSize
        };
    }
}


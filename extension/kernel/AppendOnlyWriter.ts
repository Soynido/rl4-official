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
    private maxLines: number = 10000; // ✅ NEW: Max lines before rotation
    private buffer: string[] = [];
    private bufferSize: number = 0;
    private maxBufferSize: number = 1000; // Lines before auto-flush
    
    constructor(filePath: string, maxSizeMB: number = 50, maxLines: number = 10000) {
        this.filePath = filePath;
        this.maxSizeMB = maxSizeMB;
        this.maxLines = maxLines; // ✅ NEW: Configure max lines
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
     * ✅ P1-INTEGRITY-02 PATCH 5: Validate last line is complete JSON
     */
    private async validateLastLine(): Promise<void> {
        if (!fsSync.existsSync(this.filePath)) {
            return;
        }
        
        const stats = await fs.stat(this.filePath);
        if (stats.size === 0) {
            return;
        }
        
        // Read last 1KB (enough for typical JSONL line)
        const fd = await fs.open(this.filePath, 'r');
        try {
            const bufferSize = Math.min(1024, stats.size);
            const buffer = Buffer.alloc(bufferSize);
            await fd.read(buffer, 0, bufferSize, stats.size - bufferSize);
            
            const tail = buffer.toString('utf-8');
            const lastNewlineIndex = tail.lastIndexOf('\n');
            
            if (lastNewlineIndex === -1) {
                // No newline found → file might be corrupted
                console.warn('⚠️ AppendOnlyWriter: No newline in tail, file might be empty or corrupted');
                return;
            }
            
            // Get last line (after last newline)
            const lastLine = tail.substring(lastNewlineIndex + 1).trim();
            
            if (lastLine.length === 0) {
                // File ends with newline (valid)
                return;
            }
            
            // Try to parse last line
            try {
                JSON.parse(lastLine);
                // Valid JSON, all good
            } catch (error) {
                // Invalid JSON → truncate to last valid newline
                const truncatePosition = stats.size - (tail.length - lastNewlineIndex);
                console.warn(`⚠️ AppendOnlyWriter: Invalid last line detected, truncating to ${truncatePosition} bytes`);
                console.warn(`   Invalid content: ${lastLine.substring(0, 100)}...`);
                
                await fd.close();
                await fs.truncate(this.filePath, truncatePosition);
                
                // Re-open for verification
                const fdVerify = await fs.open(this.filePath, 'r');
                try {
                    const statsVerify = await fdVerify.stat();
                    console.log(`✅ Truncated ${path.basename(this.filePath)} from ${stats.size} to ${statsVerify.size} bytes`);
                } finally {
                    await fdVerify.close();
                }
                return;
            }
        } finally {
            await fd.close();
        }
    }
    
    /**
     * Rotate file if size OR line count exceeds limit (✅ ENHANCED)
     */
    private async rotateIfNeeded(): Promise<void> {
        if (!fsSync.existsSync(this.filePath)) {
            return;
        }
        
        // ✅ P1-INTEGRITY-02 PATCH 5: Validate before rotation
        await this.validateLastLine();
        
        const stats = await fs.stat(this.filePath);
        const sizeMB = stats.size / 1024 / 1024;
        
        // ✅ NEW: Check line count
        const content = await fs.readFile(this.filePath, 'utf-8');
        const lineCount = content.split('\n').filter(l => l.trim()).length;
        
        // Rotate if size OR line count exceeds threshold
        if (sizeMB >= this.maxSizeMB || lineCount >= this.maxLines) {
            const timestamp = Date.now();
            const ext = path.extname(this.filePath);
            const base = this.filePath.slice(0, -ext.length);
            const rotatedPath = `${base}-${timestamp}${ext}`;
            
            await fs.rename(this.filePath, rotatedPath);
            
            // ✅ NEW: Compress in background (non-blocking)
            const { exec } = require('child_process');
            exec(`gzip "${rotatedPath}"`, (err: any) => {
                if (err) console.warn('AppendOnlyWriter: Failed to compress archive:', err);
                else console.log(`✅ Compressed ${path.basename(rotatedPath)} → ${path.basename(rotatedPath)}.gz`);
            });
            
            const reason = sizeMB >= this.maxSizeMB 
                ? `size ${sizeMB.toFixed(1)}MB` 
                : `${lineCount} lines`;
            console.log(`📦 Rotated ${path.basename(this.filePath)} (${reason}) → ${path.basename(rotatedPath)}.gz`);
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
        
        // ✅ P1-INTEGRITY-02 PATCH 5: Validate before reading
        await this.validateLastLine();
        
        const content = await fs.readFile(this.filePath, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l);
        
        // Filter out Git conflict markers
        const isGitConflictMarker = (line: string): boolean => {
            const trimmed = line.trim();
            return trimmed.startsWith('<<<<<<<') || 
                   trimmed.startsWith('=======') || 
                   trimmed.startsWith('>>>>>>>') ||
                   trimmed.includes('<<<<<<< Updated upstream') ||
                   trimmed.includes('>>>>>>> Stashed changes');
        };
        
        return lines
            .filter(line => !isGitConflictMarker(line)) // Remove Git conflict markers
            .map(line => {
            try {
                return JSON.parse(line);
            } catch (error) {
                    // Only warn if it's not a Git conflict marker (already filtered)
                    if (!isGitConflictMarker(line)) {
                console.warn(`⚠️ Invalid JSONL line: ${line.substring(0, 50)}...`);
                    }
                return null;
            }
            })
            .filter(e => e !== null);
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


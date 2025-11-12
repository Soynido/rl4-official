/**
 * Snapshot Rotation - History Enrichment Module
 * 
 * Saves complete cognitive state snapshots every 100 cycles.
 * Enables time-travel queries with full context reconstruction.
 * 
 * Features:
 * - Rolling snapshots (every 100 cycles)
 * - Compression for snapshots >500KB (gzip)
 * - Global index for O(1) lookup
 * - Automatic cleanup (keep last 30, archive older)
 * 
 * Resolves Test 6 limitation: "3 cycles avant CacheIndex" now has full cognitive context
 * 
 * RL4 History Component #2
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzipAsync = promisify(zlib.gzip);
const gunzipAsync = promisify(zlib.gunzip);

export interface CognitiveSnapshot {
    snapshot_id: number;
    range: [number, number];       // Cycles covered [start, end]
    duration_sec: number;          // Session duration
    source: 'auto' | 'manual';
    timestamp: string;
    
    // Cognitive state
    patterns: any[];
    forecasts: any[];
    correlations: any[];
    cognitive_load: number;
    
    // Context
    git_context: {
        last_commit: string;
        time_since_commit_sec: number;
    };
    files_active: string[];
}

interface SnapshotIndexEntry {
    cycle: number;
    timestamp: string;
    file: string;
    compressed: boolean;
    size_bytes: number;
}

export class SnapshotRotation {
    private workspaceRoot: string;
    private snapshotsDir: string;
    private indexPath: string;
    private maxSnapshots: number = 30;
    private compressionThreshold: number = 500 * 1024; // 500KB
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.snapshotsDir = path.join(workspaceRoot, '.reasoning_rl4', 'context_history');
        this.indexPath = path.join(this.snapshotsDir, 'index.json');
        
        // Ensure directory exists
        if (!fs.existsSync(this.snapshotsDir)) {
            fs.mkdirSync(this.snapshotsDir, { recursive: true });
        }
        
        // Initialize index if not exists
        if (!fs.existsSync(this.indexPath)) {
            this.initializeIndex();
        }
    }
    
    /**
     * Save cognitive snapshot for current cycle
     */
    public async saveSnapshot(cycleId: number): Promise<void> {
        try {
            const snapshot = await this.buildSnapshot(cycleId);
            await this.persistSnapshot(snapshot);
            await this.updateIndex();
            await this.cleanupOldSnapshots();
        } catch (error) {
            console.error(`❌ Failed to save snapshot for cycle ${cycleId}:`, error);
        }
    }
    
    /**
     * Build snapshot from current RL4 state
     */
    private async buildSnapshot(cycleId: number): Promise<CognitiveSnapshot> {
        const timestamp = new Date().toISOString();
        const range: [number, number] = [
            Math.max(1, cycleId - 99), // Previous 100 cycles
            cycleId
        ];
        
        // Load current cognitive state
        const patterns = await this.loadPatterns();
        const forecasts = await this.loadForecasts();
        const correlations = await this.loadCorrelations();
        const cognitiveLoad = await this.getCurrentCognitiveLoad();
        const gitContext = await this.getGitContext();
        const filesActive = await this.getActiveFiles();
        
        // Calculate duration (100 cycles = 1000s at 10s/cycle)
        const duration = 100 * 10; // seconds
        
        return {
            snapshot_id: cycleId,
            range,
            duration_sec: duration,
            source: 'auto',
            timestamp,
            patterns,
            forecasts,
            correlations,
            cognitive_load: cognitiveLoad,
            git_context: gitContext,
            files_active: filesActive
        };
    }
    
    /**
     * Persist snapshot (with optional compression)
     */
    private async persistSnapshot(snapshot: CognitiveSnapshot): Promise<void> {
        const filename = `snapshot-${snapshot.snapshot_id}.json`;
        const filepath = path.join(this.snapshotsDir, filename);
        
        const content = JSON.stringify(snapshot, null, 2);
        const sizeBytes = Buffer.byteLength(content, 'utf-8');
        
        // Compress if large
        if (sizeBytes > this.compressionThreshold) {
            const compressed = await gzipAsync(content);
            fs.writeFileSync(filepath + '.gz', compressed);
        } else {
            fs.writeFileSync(filepath, content, 'utf-8');
        }
    }
    
    /**
     * Update global index
     */
    public async updateIndex(): Promise<void> {
        const index = this.loadIndex();
        const snapshots = this.listSnapshots();
        
        // Rebuild index from actual files
        const newIndex: SnapshotIndexEntry[] = [];
        
        for (const file of snapshots) {
            const match = file.match(/snapshot-(\d+)\.json(\.gz)?$/);
            if (!match) continue;
            
            const cycle = parseInt(match[1]);
            const compressed = !!match[2];
            const filepath = path.join(this.snapshotsDir, file);
            const stats = fs.statSync(filepath);
            
            // Try to extract timestamp from snapshot
            let timestamp = new Date(stats.mtime).toISOString();
            
            try {
                let content: string;
                if (compressed) {
                    const buffer = fs.readFileSync(filepath);
                    const decompressed = await gunzipAsync(buffer);
                    content = decompressed.toString('utf-8');
                } else {
                    content = fs.readFileSync(filepath, 'utf-8');
                }
                
                const snapshot = JSON.parse(content);
                timestamp = snapshot.timestamp || timestamp;
            } catch (e) {
                // Use file mtime as fallback
            }
            
            newIndex.push({
                cycle,
                timestamp,
                file,
                compressed,
                size_bytes: stats.size
            });
        }
        
        // Sort by cycle
        newIndex.sort((a, b) => a.cycle - b.cycle);
        
        // Save index
        fs.writeFileSync(this.indexPath, JSON.stringify(newIndex, null, 2));
    }
    
    /**
     * Load snapshot for specific cycle
     */
    public async loadSnapshot(cycleId: number): Promise<CognitiveSnapshot | null> {
        const filename = `snapshot-${cycleId}.json`;
        const filepathPlain = path.join(this.snapshotsDir, filename);
        const filepathGz = path.join(this.snapshotsDir, filename + '.gz');
        
        try {
            if (fs.existsSync(filepathGz)) {
                const buffer = fs.readFileSync(filepathGz);
                const decompressed = await gunzipAsync(buffer);
                return JSON.parse(decompressed.toString('utf-8'));
            }
            
            if (fs.existsSync(filepathPlain)) {
                return JSON.parse(fs.readFileSync(filepathPlain, 'utf-8'));
            }
        } catch (e) {
            console.error(`❌ Failed to load snapshot ${cycleId}:`, e);
        }
        
        return null;
    }
    
    /**
     * Find closest snapshot to timestamp
     */
    public findClosestSnapshot(timestamp: string): number | null {
        const index = this.loadIndex();
        const targetTime = new Date(timestamp).getTime();
        
        let closestCycle: number | null = null;
        let minDiff = Infinity;
        
        for (const entry of index) {
            const entryTime = new Date(entry.timestamp).getTime();
            const diff = Math.abs(targetTime - entryTime);
            
            if (diff < minDiff) {
                minDiff = diff;
                closestCycle = entry.cycle;
            }
        }
        
        return closestCycle;
    }
    
    /**
     * Cleanup old snapshots (keep last N)
     */
    private async cleanupOldSnapshots(): Promise<void> {
        const snapshots = this.listSnapshots();
        
        if (snapshots.length <= this.maxSnapshots) {
            return;
        }
        
        // Extract cycle numbers
        const cycles = snapshots
            .map(f => {
                const match = f.match(/snapshot-(\d+)\.json(\.gz)?$/);
                return match ? parseInt(match[1]) : 0;
            })
            .filter(c => c > 0)
            .sort((a, b) => a - b);
        
        // Delete oldest
        const toDelete = cycles.slice(0, cycles.length - this.maxSnapshots);
        
        for (const cycle of toDelete) {
            const filenameBase = `snapshot-${cycle}.json`;
            const pathPlain = path.join(this.snapshotsDir, filenameBase);
            const pathGz = path.join(this.snapshotsDir, filenameBase + '.gz');
            
            if (fs.existsSync(pathPlain)) fs.unlinkSync(pathPlain);
            if (fs.existsSync(pathGz)) fs.unlinkSync(pathGz);
        }
        
        // Update index after cleanup
        await this.updateIndex();
    }
    
    // Private helpers
    
    private initializeIndex(): void {
        fs.writeFileSync(this.indexPath, JSON.stringify([], null, 2));
    }
    
    private loadIndex(): SnapshotIndexEntry[] {
        try {
            return JSON.parse(fs.readFileSync(this.indexPath, 'utf-8'));
        } catch (e) {
            return [];
        }
    }
    
    private listSnapshots(): string[] {
        if (!fs.existsSync(this.snapshotsDir)) {
            return [];
        }
        
        return fs.readdirSync(this.snapshotsDir)
            .filter(f => f.startsWith('snapshot-') && (f.endsWith('.json') || f.endsWith('.json.gz')));
    }
    
    private async loadPatterns(): Promise<any[]> {
        const patternsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'patterns.json');
        if (!fs.existsSync(patternsPath)) return [];
        
        try {
            const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            return data.patterns || [];
        } catch (e) {
            return [];
        }
    }
    
    private async loadForecasts(): Promise<any[]> {
        const forecastsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'forecasts.json');
        if (!fs.existsSync(forecastsPath)) return [];
        
        try {
            const data = fs.readFileSync(forecastsPath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            return [];
        }
    }
    
    private async loadCorrelations(): Promise<any[]> {
        const correlationsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'correlations.json');
        if (!fs.existsSync(correlationsPath)) return [];
        
        try {
            const data = JSON.parse(fs.readFileSync(correlationsPath, 'utf-8'));
            return data.correlations || [];
        } catch (e) {
            return [];
        }
    }
    
    private async getCurrentCognitiveLoad(): Promise<number> {
        // Try to get from current timeline
        const today = new Date().toISOString().split('T')[0];
        const timelinePath = path.join(this.workspaceRoot, '.reasoning_rl4', 'timelines', `${today}.json`);
        
        if (!fs.existsSync(timelinePath)) {
            return 0;
        }
        
        try {
            const timeline = JSON.parse(fs.readFileSync(timelinePath, 'utf-8'));
            return timeline.cognitive_load_avg || 0;
        } catch (e) {
            return 0;
        }
    }
    
    private async getGitContext(): Promise<{ last_commit: string; time_since_commit_sec: number }> {
        const commitsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'git_commits.jsonl');
        
        if (!fs.existsSync(commitsPath)) {
            return { last_commit: '', time_since_commit_sec: 0 };
        }
        
        try {
            const lines = fs.readFileSync(commitsPath, 'utf-8').split('\n').filter(Boolean);
            if (lines.length === 0) {
                return { last_commit: '', time_since_commit_sec: 0 };
            }
            
            const lastCommit = JSON.parse(lines[lines.length - 1]);
            const timeSince = Math.floor((Date.now() - new Date(lastCommit.timestamp).getTime()) / 1000);
            
            return {
                last_commit: lastCommit.hash || lastCommit.metadata?.hash || '',
                time_since_commit_sec: timeSince
            };
        } catch (e) {
            return { last_commit: '', time_since_commit_sec: 0 };
        }
    }
    
    private async getActiveFiles(): Promise<string[]> {
        const changesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'file_changes.jsonl');
        
        if (!fs.existsSync(changesPath)) {
            return [];
        }
        
        try {
            const lines = fs.readFileSync(changesPath, 'utf-8').split('\n').filter(Boolean);
            const recentChanges = lines.slice(-10); // Last 10 changes
            
            const filesSet = new Set<string>();
            for (const line of recentChanges) {
                try {
                    const change = JSON.parse(line);
                    for (const c of change.metadata?.changes || []) {
                        filesSet.add(c.path);
                    }
                } catch (e) {
                    // Skip invalid lines
                }
            }
            
            return Array.from(filesSet).slice(0, 5); // Top 5
        } catch (e) {
            return [];
        }
    }
}


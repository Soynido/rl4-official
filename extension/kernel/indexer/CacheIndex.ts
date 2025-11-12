/**
 * RL4 Cache Index
 * 
 * Optimise l'accès aux données RL4 en maintenant un index en cache
 * plutôt que de reparser les fichiers JSONL à chaque requête.
 * 
 * Problème résolu:
 * - Lecture de 5,863 cycles = 2.6 MB à parser = 200-500ms
 * - Avec index: <50ms pour n'importe quelle requête temporelle
 * 
 * Mise à jour: Automatique à chaque nouveau cycle (incrémental)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface IndexEntry {
    cycleId: number;
    timestamp: string;
    day: string; // "YYYY-MM-DD"
    hour: number; // 0-23
    patterns_count: number;
    forecasts_count: number;
    files: string[]; // Top 3 files pour recherche rapide
}

export interface CacheIndex {
    version: string;
    generated_at: string;
    total_cycles: number;
    date_range: {
        first: string;
        last: string;
    };
    // Indexes
    by_day: Record<string, number[]>; // "2025-11-10" -> [442, 443, 444...]
    by_file: Record<string, number[]>; // "AuthService.ts" -> [100, 200, 300...]
    by_hour: Record<string, number[]>; // "2025-11-10T14" -> [442, 443]
    // Metadata
    entries: IndexEntry[];
}

export class RL4CacheIndexer {
    private workspaceRoot: string;
    private indexPath: string;
    private cyclesPath: string;
    private fileChangesPath: string;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.indexPath = path.join(workspaceRoot, '.reasoning_rl4', 'cache', 'index.json');
        this.cyclesPath = path.join(workspaceRoot, '.reasoning_rl4', 'ledger', 'cycles.jsonl');
        this.fileChangesPath = path.join(workspaceRoot, '.reasoning_rl4', 'traces', 'file_changes.jsonl');
    }
    
    /**
     * Rebuild complete index from scratch
     * Utiliser uniquement au premier démarrage ou en cas de corruption
     */
    async rebuild(): Promise<CacheIndex> {
        console.log('🔧 Rebuilding RL4 cache index...');
        const startTime = Date.now();
        
        const index: CacheIndex = {
            version: '1.0.0',
            generated_at: new Date().toISOString(),
            total_cycles: 0,
            date_range: { first: '', last: '' },
            by_day: {},
            by_file: {},
            by_hour: {},
            entries: []
        };
        
        // 1. Index cycles
        if (fs.existsSync(this.cyclesPath)) {
            const lines = fs.readFileSync(this.cyclesPath, 'utf-8')
                .split('\n')
                .filter(l => l.trim());
            
            index.total_cycles = lines.length;
            
            for (const line of lines) {
                try {
                    const cycle = JSON.parse(line);
                    const timestamp = cycle.timestamp || cycle._timestamp;
                    const date = new Date(timestamp);
                    const day = timestamp.substring(0, 10); // "YYYY-MM-DD"
                    const hour = date.getHours();
                    const hourKey = `${day}T${hour.toString().padStart(2, '0')}`; // "2025-11-10T14"
                    
                    // Index by day
                    if (!index.by_day[day]) index.by_day[day] = [];
                    index.by_day[day].push(cycle.cycleId);
                    
                    // Index by hour
                    if (!index.by_hour[hourKey]) index.by_hour[hourKey] = [];
                    index.by_hour[hourKey].push(cycle.cycleId);
                    
                    // Create entry
                    const entry: IndexEntry = {
                        cycleId: cycle.cycleId,
                        timestamp,
                        day,
                        hour,
                        patterns_count: cycle.phases?.patterns?.count || 0,
                        forecasts_count: cycle.phases?.forecasts?.count || 0,
                        files: [] // À remplir depuis file_changes
                    };
                    
                    index.entries.push(entry);
                    
                } catch (e) {
                    console.warn(`⚠️  Skipping invalid cycle line: ${line.substring(0, 50)}`);
                }
            }
            
            // Date range
            if (index.entries.length > 0) {
                index.date_range.first = index.entries[0].timestamp;
                index.date_range.last = index.entries[index.entries.length - 1].timestamp;
            }
        }
        
        // 2. Index files
        if (fs.existsSync(this.fileChangesPath)) {
            const lines = fs.readFileSync(this.fileChangesPath, 'utf-8')
                .split('\n')
                .filter(l => l.trim());
            
            for (const line of lines) {
                try {
                    const change = JSON.parse(line);
                    const timestamp = change.timestamp || change._timestamp;
                    const files = change.metadata?.changes?.map((c: any) => c.path) || [];
                    
                    // Trouver le cycle le plus proche
                    const cycleId = this.findClosestCycle(timestamp, index.entries);
                    
                    if (cycleId !== null) {
                        // Ajouter files à l'entry
                        const entry = index.entries.find(e => e.cycleId === cycleId);
                        if (entry) {
                            entry.files = [...new Set([...entry.files, ...files])].slice(0, 3);
                        }
                        
                        // Index by file
                        for (const file of files) {
                            const fileName = path.basename(file);
                            if (!index.by_file[fileName]) index.by_file[fileName] = [];
                            if (!index.by_file[fileName].includes(cycleId)) {
                                index.by_file[fileName].push(cycleId);
                            }
                        }
                    }
                    
                } catch (e) {
                    // Skip invalid lines
                }
            }
        }
        
        // 3. Save index
        this.saveIndex(index);
        
        const duration = Date.now() - startTime;
        console.log(`✅ Index rebuilt: ${index.total_cycles} cycles, ${Object.keys(index.by_day).length} days, ${duration}ms`);
        
        return index;
    }
    
    /**
     * Update index incrementally (ajouter uniquement les nouveaux cycles)
     * Utiliser à chaque nouveau cycle (performant)
     */
    async updateIncremental(newCycle: any, newFiles?: string[]): Promise<void> {
        let index = this.loadIndex();
        
        // Si pas d'index, rebuild
        if (!index) {
            await this.rebuild();
            return;
        }
        
        const timestamp = newCycle.timestamp || newCycle._timestamp;
        const date = new Date(timestamp);
        const day = timestamp.substring(0, 10);
        const hour = date.getHours();
        const hourKey = `${day}T${hour.toString().padStart(2, '0')}`;
        
        // Index by day
        if (!index.by_day[day]) index.by_day[day] = [];
        if (!index.by_day[day].includes(newCycle.cycleId)) {
            index.by_day[day].push(newCycle.cycleId);
        }
        
        // Index by hour
        if (!index.by_hour[hourKey]) index.by_hour[hourKey] = [];
        if (!index.by_hour[hourKey].includes(newCycle.cycleId)) {
            index.by_hour[hourKey].push(newCycle.cycleId);
        }
        
        // Create entry
        const entry: IndexEntry = {
            cycleId: newCycle.cycleId,
            timestamp,
            day,
            hour,
            patterns_count: newCycle.phases?.patterns?.count || 0,
            forecasts_count: newCycle.phases?.forecasts?.count || 0,
            files: newFiles ? newFiles.slice(0, 3) : []
        };
        
        index.entries.push(entry);
        
        // Index by file
        if (newFiles) {
            for (const file of newFiles) {
                const fileName = path.basename(file);
                if (!index.by_file[fileName]) index.by_file[fileName] = [];
                if (!index.by_file[fileName].includes(newCycle.cycleId)) {
                    index.by_file[fileName].push(newCycle.cycleId);
                }
            }
        }
        
        // Update metadata
        index.total_cycles = index.entries.length;
        index.date_range.last = timestamp;
        index.generated_at = new Date().toISOString();
        
        // Save
        this.saveIndex(index);
    }
    
    /**
     * Query: Get cycles for a specific day
     */
    getCyclesForDay(date: string): number[] {
        const index = this.loadIndex();
        if (!index) return [];
        return index.by_day[date] || [];
    }
    
    /**
     * Query: Get cycles for a specific hour
     */
    getCyclesForHour(date: string, hour: number): number[] {
        const index = this.loadIndex();
        if (!index) return [];
        const hourKey = `${date}T${hour.toString().padStart(2, '0')}`;
        return index.by_hour[hourKey] || [];
    }
    
    /**
     * Query: Get cycles that modified a specific file
     */
    getCyclesForFile(fileName: string): number[] {
        const index = this.loadIndex();
        if (!index) return [];
        return index.by_file[fileName] || [];
    }
    
    /**
     * Query: Get entry for a specific cycle
     */
    getEntry(cycleId: number): IndexEntry | null {
        const index = this.loadIndex();
        if (!index) return null;
        return index.entries.find(e => e.cycleId === cycleId) || null;
    }
    
    /**
     * Query: Get all days with cycles
     */
    getAllDays(): string[] {
        const index = this.loadIndex();
        if (!index) return [];
        return Object.keys(index.by_day).sort();
    }
    
    /**
     * Query: Get statistics
     */
    getStats() {
        const index = this.loadIndex();
        if (!index) return null;
        
        return {
            total_cycles: index.total_cycles,
            total_days: Object.keys(index.by_day).length,
            total_files_tracked: Object.keys(index.by_file).length,
            date_range: index.date_range,
            generated_at: index.generated_at
        };
    }
    
    // Private helpers
    
    private loadIndex(): CacheIndex | null {
        if (!fs.existsSync(this.indexPath)) {
            return null;
        }
        
        try {
            const data = fs.readFileSync(this.indexPath, 'utf-8');
            return JSON.parse(data);
        } catch (e) {
            console.error('❌ Failed to load index:', e);
            return null;
        }
    }
    
    private saveIndex(index: CacheIndex): void {
        const dir = path.dirname(this.indexPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(this.indexPath, JSON.stringify(index, null, 2));
    }
    
    private findClosestCycle(timestamp: string, entries: IndexEntry[]): number | null {
        if (entries.length === 0) return null;
        
        const target = new Date(timestamp).getTime();
        let closest = entries[0];
        let minDiff = Math.abs(new Date(entries[0].timestamp).getTime() - target);
        
        for (const entry of entries) {
            const diff = Math.abs(new Date(entry.timestamp).getTime() - target);
            if (diff < minDiff) {
                minDiff = diff;
                closest = entry;
            }
        }
        
        // Only return if within 60 seconds
        return minDiff < 60000 ? closest.cycleId : null;
    }
}


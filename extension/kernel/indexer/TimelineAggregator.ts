/**
 * RL4 Timeline Aggregator
 * 
 * Génère des timelines quotidiennes pré-agrégées pour affichage WebView.
 * Au lieu de forcer la WebView à reparser tous les cycles, on pré-calcule
 * l'état cognitif par heure pour chaque jour.
 * 
 * Fichiers générés: .reasoning_rl4/timelines/YYYY-MM-DD.json
 * 
 * Mise à jour: Toutes les 10 cycles (ou sur demande)
 */

import * as fs from 'fs';
import * as path from 'path';
import { RL4CacheIndexer } from './CacheIndex';

export interface HourlySnapshot {
    hour: number; // 0-23
    timestamp: string; // ISO 8601
    
    // Cognitive state
    pattern: string;
    pattern_confidence: number;
    forecast: string;
    forecast_confidence: number;
    intent: string;
    
    // Activity metrics
    cycles_count: number; // Nombre de cycles dans cette heure
    events_count: number; // Total events (patterns + forecasts)
    cognitive_load: number; // 0.0 - 1.0 (normalized)
    
    // Files context
    files: string[]; // Top 3 files modifiés dans cette heure
}

export interface DailyTimeline {
    date: string; // "YYYY-MM-DD"
    generated_at: string; // ISO timestamp
    total_cycles: number;
    total_events: number;
    cognitive_load_avg: number;
    
    // Hourly snapshots (0-23)
    hours: HourlySnapshot[];
    
    // Daily summary
    top_pattern: string;
    top_forecast: string;
    dominant_intent: string;
    most_active_hour: number;
}

export class TimelineAggregator {
    private workspaceRoot: string;
    private timelinesDir: string;
    private indexer: RL4CacheIndexer;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.timelinesDir = path.join(workspaceRoot, '.reasoning_rl4', 'timelines');
        this.indexer = new RL4CacheIndexer(workspaceRoot);
        
        // Ensure timelines directory exists
        if (!fs.existsSync(this.timelinesDir)) {
            fs.mkdirSync(this.timelinesDir, { recursive: true });
        }
    }
    
    /**
     * Generate timeline for a specific day
     * À appeler toutes les 10 cycles ou sur demande
     */
    async generateTimeline(date: string): Promise<DailyTimeline> {
        const timeline: DailyTimeline = {
            date,
            generated_at: new Date().toISOString(),
            total_cycles: 0,
            total_events: 0,
            cognitive_load_avg: 0,
            hours: [],
            top_pattern: '',
            top_forecast: '',
            dominant_intent: 'unknown',
            most_active_hour: 0
        };
        
        // Get all cycles for this day from cache index
        const cycleIds = this.indexer.getCyclesForDay(date);
        timeline.total_cycles = cycleIds.length;
        
        if (cycleIds.length === 0) {
            // No cycles for this day, return empty timeline
            this.save(timeline);
            return timeline;
        }
        
        // Load cycles from cycles.jsonl
        const cycles = await this.loadCycles(cycleIds);
        
        // Aggregate by hour
        const hourlyMap = new Map<number, any[]>();
        for (let h = 0; h < 24; h++) {
            hourlyMap.set(h, []);
        }
        
        for (const cycle of cycles) {
            const hour = new Date(cycle.timestamp).getHours();
            hourlyMap.get(hour)!.push(cycle);
        }
        
        // Generate hourly snapshots
        const patternCounts = new Map<string, number>();
        const forecastCounts = new Map<string, number>();
        const intentCounts = new Map<string, number>();
        let maxCyclesInHour = 0;
        let mostActiveHour = 0;
        
        for (let h = 0; h < 24; h++) {
            const hourCycles = hourlyMap.get(h)!;
            
            if (hourCycles.length === 0) {
                // No activity in this hour
                timeline.hours.push({
                    hour: h,
                    timestamp: `${date}T${h.toString().padStart(2, '0')}:00:00Z`,
                    pattern: '',
                    pattern_confidence: 0,
                    forecast: '',
                    forecast_confidence: 0,
                    intent: 'none',
                    cycles_count: 0,
                    events_count: 0,
                    cognitive_load: 0,
                    files: []
                });
                continue;
            }
            
            // Track most active hour
            if (hourCycles.length > maxCyclesInHour) {
                maxCyclesInHour = hourCycles.length;
                mostActiveHour = h;
            }
            
            // Aggregate metrics for this hour
            const eventsCount = hourCycles.reduce((sum, c) => 
                sum + (c.phases?.patterns?.count || 0) + (c.phases?.forecasts?.count || 0), 0
            );
            
            timeline.total_events += eventsCount;
            
            // Calculate cognitive load (normalized by max expected cycles/hour)
            const cognitiveLoad = Math.min(hourCycles.length / 360, 1.0); // Max 360 cycles/hour = 1 cycle/10s
            
            // Load pattern/forecast for this hour (from last cycle of hour)
            const lastCycle = hourCycles[hourCycles.length - 1];
            const hourTimestamp = lastCycle.timestamp;
            
            const pattern = await this.loadPatternAt(hourTimestamp);
            const forecast = await this.loadForecastAt(hourTimestamp);
            const intent = await this.loadIntentAt(hourTimestamp);
            const files = await this.loadFilesAt(hourTimestamp);
            
            // Track for daily summary
            if (pattern.text) {
                patternCounts.set(pattern.text, (patternCounts.get(pattern.text) || 0) + 1);
            }
            if (forecast.text) {
                forecastCounts.set(forecast.text, (forecastCounts.get(forecast.text) || 0) + 1);
            }
            if (intent) {
                intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
            }
            
            timeline.hours.push({
                hour: h,
                timestamp: hourTimestamp,
                pattern: pattern.text,
                pattern_confidence: pattern.confidence,
                forecast: forecast.text,
                forecast_confidence: forecast.confidence,
                intent,
                cycles_count: hourCycles.length,
                events_count: eventsCount,
                cognitive_load: cognitiveLoad,
                files: files.slice(0, 3) // Top 3
            });
        }
        
        // Calculate daily summary
        timeline.cognitive_load_avg = timeline.hours.reduce((sum, h) => sum + h.cognitive_load, 0) / 24;
        timeline.most_active_hour = mostActiveHour;
        
        // Top pattern/forecast/intent (most frequent)
        timeline.top_pattern = this.getMostFrequent(patternCounts);
        timeline.top_forecast = this.getMostFrequent(forecastCounts);
        timeline.dominant_intent = this.getMostFrequent(intentCounts);
        
        // Save timeline
        this.save(timeline);
        
        return timeline;
    }
    
    /**
     * Generate timeline for today
     */
    async generateToday(): Promise<DailyTimeline> {
        const today = new Date().toISOString().split('T')[0];
        return this.generateTimeline(today);
    }
    
    /**
     * Load existing timeline
     */
    load(date: string): DailyTimeline | null {
        const filePath = path.join(this.timelinesDir, `${date}.json`);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        try {
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            console.error(`❌ Failed to load timeline for ${date}:`, e);
            return null;
        }
    }
    
    /**
     * List all available timelines
     */
    listTimelines(): string[] {
        if (!fs.existsSync(this.timelinesDir)) {
            return [];
        }
        
        return fs.readdirSync(this.timelinesDir)
            .filter(f => f.endsWith('.json'))
            .map(f => f.replace('.json', ''))
            .sort();
    }
    
    // Private helpers
    
    private async loadCycles(cycleIds: number[]): Promise<any[]> {
        const cyclesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'ledger', 'cycles.jsonl');
        
        if (!fs.existsSync(cyclesPath)) {
            return [];
        }
        
        const lines = fs.readFileSync(cyclesPath, 'utf-8').split('\n').filter(Boolean);
        const cycles: any[] = [];
        
        for (const line of lines) {
            try {
                const cycle = JSON.parse(line);
                if (cycleIds.includes(cycle.cycleId)) {
                    cycles.push(cycle);
                }
            } catch (e) {
                // Skip invalid lines
            }
        }
        
        return cycles.sort((a, b) => a.cycleId - b.cycleId);
    }
    
    private async loadPatternAt(timestamp: string): Promise<{ text: string; confidence: number }> {
        const patternsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'patterns.json');
        
        if (!fs.existsSync(patternsPath)) {
            return { text: '', confidence: 0 };
        }
        
        try {
            const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            if (patternsData.patterns && patternsData.patterns.length > 0) {
                const topPattern = patternsData.patterns.reduce((max: any, p: any) => 
                    p.confidence > max.confidence ? p : max
                , patternsData.patterns[0]);
                
                return {
                    text: topPattern.pattern,
                    confidence: topPattern.confidence
                };
            }
        } catch (e) {
            // Ignore errors
        }
        
        return { text: '', confidence: 0 };
    }
    
    private async loadForecastAt(timestamp: string): Promise<{ text: string; confidence: number }> {
        const forecastsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'forecasts.json');
        
        if (!fs.existsSync(forecastsPath)) {
            return { text: '', confidence: 0 };
        }
        
        try {
            const forecasts = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
            if (Array.isArray(forecasts) && forecasts.length > 0) {
                const topForecast = forecasts.reduce((max: any, f: any) => 
                    f.confidence > max.confidence ? f : max
                , forecasts[0]);
                
                return {
                    text: topForecast.predicted_decision,
                    confidence: topForecast.confidence
                };
            }
        } catch (e) {
            // Ignore errors
        }
        
        return { text: '', confidence: 0 };
    }
    
    private async loadIntentAt(timestamp: string): Promise<string> {
        const commitsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'git_commits.jsonl');
        
        if (!fs.existsSync(commitsPath)) {
            return 'unknown';
        }
        
        try {
            const lines = fs.readFileSync(commitsPath, 'utf-8').split('\n').filter(Boolean);
            const target = new Date(timestamp).getTime();
            
            // Find closest commit before timestamp
            let closestIntent = 'unknown';
            let minDiff = Infinity;
            
            for (const line of lines) {
                try {
                    const commit = JSON.parse(line);
                    const commitTime = new Date(commit.timestamp).getTime();
                    const diff = target - commitTime;
                    
                    if (diff >= 0 && diff < minDiff) {
                        minDiff = diff;
                        closestIntent = commit.metadata?.intent?.type || 'unknown';
                    }
                } catch (e) {
                    // Skip invalid lines
                }
            }
            
            return closestIntent;
        } catch (e) {
            return 'unknown';
        }
    }
    
    private async loadFilesAt(timestamp: string): Promise<string[]> {
        const changesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'file_changes.jsonl');
        
        if (!fs.existsSync(changesPath)) {
            return [];
        }
        
        try {
            const lines = fs.readFileSync(changesPath, 'utf-8').split('\n').filter(Boolean);
            const target = new Date(timestamp).getTime();
            const hourWindow = 3600000; // 1 hour in ms
            
            const filesSet = new Set<string>();
            
            for (const line of lines) {
                try {
                    const change = JSON.parse(line);
                    const changeTime = new Date(change.timestamp).getTime();
                    const diff = Math.abs(target - changeTime);
                    
                    if (diff < hourWindow) {
                        for (const c of change.metadata?.changes || []) {
                            filesSet.add(c.path);
                        }
                    }
                } catch (e) {
                    // Skip invalid lines
                }
            }
            
            return Array.from(filesSet);
        } catch (e) {
            return [];
        }
    }
    
    private getMostFrequent(map: Map<string, number>): string {
        if (map.size === 0) return '';
        
        let maxKey = '';
        let maxCount = 0;
        
        for (const [key, count] of map.entries()) {
            if (count > maxCount) {
                maxCount = count;
                maxKey = key;
            }
        }
        
        return maxKey;
    }
    
    private save(timeline: DailyTimeline): void {
        const filePath = path.join(this.timelinesDir, `${timeline.date}.json`);
        fs.writeFileSync(filePath, JSON.stringify(timeline, null, 2));
    }
}


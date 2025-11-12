/**
 * RL4 Hooks - Standardized API for WebView
 * 
 * Provides a clean, standardized interface for WebView to query RL4 data.
 * All hooks cache their responses for instant repeat queries.
 * 
 * Cache location: .reasoning_rl4/cache/hooks/
 * 
 * Hooks available:
 * 1. getContextAt(timestamp) → ReasoningContext
 * 2. getDayEvents(date) → CognitiveEvent[]
 * 3. exportState(timestamp) → RestorePoint
 * 4. getForecasts(timestamp) → Forecast[]
 */

import * as fs from 'fs';
import * as path from 'path';
import { RL4CacheIndexer } from '../../indexer/CacheIndex';
import { ContextSnapshotGenerator, ContextSnapshot } from '../../indexer/ContextSnapshot';
import { TimelineAggregator } from '../../indexer/TimelineAggregator';

// Types

export interface ReasoningContext {
    hour: number;
    files: string[];
    pattern: string;
    forecast: string;
    confidence: number;
    intent: string;
    adr?: string;
}

export interface CognitiveEvent {
    timestamp: string;
    pattern: string;
    intent: string;
    forecast: string;
    confidence: number;
    files: string[];
    adr?: string;
}

export interface RestorePoint {
    timestamp: string;
    workspace: string;
    files: string[];
    cursor_positions: Record<string, number> | null;
    pattern: string;
    forecast: string;
    intent: string;
    adr?: string;
    commit_hash?: string;
    environment: {
        node: string;
        rl4_version: string;
        vscode: string;
    };
}

export interface Forecast {
    forecast_id: string;
    predicted_decision: string;
    decision_type: string;
    confidence: number;
    suggested_timeframe: string;
    urgency: string;
    estimated_effort: string;
    related_patterns: string[];
}

/**
 * Main RL4Hooks class
 */
export class RL4Hooks {
    private workspaceRoot: string;
    private cacheDir: string;
    private indexer: RL4CacheIndexer;
    private contextSnapshot: ContextSnapshotGenerator;
    private timelineAggregator: TimelineAggregator;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.cacheDir = path.join(workspaceRoot, '.reasoning_rl4', 'cache', 'hooks');
        this.indexer = new RL4CacheIndexer(workspaceRoot);
        this.contextSnapshot = new ContextSnapshotGenerator(workspaceRoot);
        this.timelineAggregator = new TimelineAggregator(workspaceRoot);
        
        // Ensure cache directory exists
        if (!fs.existsSync(this.cacheDir)) {
            fs.mkdirSync(this.cacheDir, { recursive: true });
        }
    }
    
    /**
     * Hook 1: getContextAt
     * Récupère le contexte cognitif à un timestamp donné
     */
    async getContextAt(timestamp: string): Promise<ReasoningContext> {
        const cacheKey = `getContextAt-${timestamp}`;
        const cached = this.loadFromCache<ReasoningContext>(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        // Generate context
        const context: ReasoningContext = {
            hour: new Date(timestamp).getHours(),
            files: [],
            pattern: '',
            forecast: '',
            confidence: 0,
            intent: 'unknown',
            adr: undefined
        };
        
        // Find closest cycle
        const cycle = await this.findClosestCycle(timestamp);
        if (!cycle) {
            this.saveToCache(cacheKey, context);
            return context;
        }
        
        // Load pattern
        const pattern = await this.loadTopPattern();
        if (pattern) {
            context.pattern = pattern.pattern;
            context.confidence = pattern.confidence;
        }
        
        // Load forecast
        const forecast = await this.loadTopForecast();
        if (forecast) {
            context.forecast = forecast.predicted_decision;
        }
        
        // Load intent
        context.intent = await this.loadIntentAt(timestamp);
        
        // Load ADR
        const adr = await this.loadActiveADR();
        if (adr) {
            context.adr = adr.title;
        }
        
        // Load files
        context.files = await this.loadFilesAt(timestamp);
        
        // Cache and return
        this.saveToCache(cacheKey, context);
        return context;
    }
    
    /**
     * Hook 2: getDayEvents
     * Récupère tous les événements cognitifs d'un jour
     */
    async getDayEvents(date: string): Promise<CognitiveEvent[]> {
        const cacheKey = `getDayEvents-${date}`;
        const cached = this.loadFromCache<CognitiveEvent[]>(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        // Check if timeline exists (pre-aggregated)
        const timeline = this.timelineAggregator.load(date);
        if (timeline) {
            // Convert timeline to CognitiveEvent[]
            const events: CognitiveEvent[] = timeline.hours
                .filter(h => h.cycles_count > 0)
                .map(h => ({
                    timestamp: h.timestamp,
                    pattern: h.pattern,
                    intent: h.intent,
                    forecast: h.forecast,
                    confidence: h.pattern_confidence,
                    files: h.files,
                    adr: undefined // TODO: load per hour if needed
                }));
            
            this.saveToCache(cacheKey, events);
            return events;
        }
        
        // Fallback: Generate from cycles
        const cycleIds = this.indexer.getCyclesForDay(date);
        const cycles = await this.loadCyclesByIds(cycleIds);
        
        const events: CognitiveEvent[] = [];
        for (const cycle of cycles) {
            const context = await this.getContextAt(cycle.timestamp);
            events.push({
                timestamp: cycle.timestamp,
                pattern: context.pattern,
                intent: context.intent,
                forecast: context.forecast,
                confidence: context.confidence,
                files: context.files,
                adr: context.adr
            });
        }
        
        this.saveToCache(cacheKey, events);
        return events;
    }
    
    /**
     * Hook 3: exportState
     * Génère un RestorePoint pour un timestamp donné
     */
    async exportState(timestamp: string): Promise<RestorePoint> {
        const cacheKey = `exportState-${timestamp}`;
        const cached = this.loadFromCache<RestorePoint>(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        // Get context at timestamp
        const context = await this.getContextAt(timestamp);
        
        // Find closest commit
        const commit = await this.findClosestCommit(timestamp);
        
        // Determine environment
        const nodeVersion = process.version;
        const rl4Version = await this.getRL4Version();
        const vscodeVersion = 'unknown'; // TODO: get from vscode.version if available
        
        const restorePoint: RestorePoint = {
            timestamp,
            workspace: path.basename(this.workspaceRoot),
            files: context.files,
            cursor_positions: null, // Not captured yet
            pattern: context.pattern,
            forecast: context.forecast,
            intent: context.intent,
            adr: context.adr,
            commit_hash: commit?.hash,
            environment: {
                node: nodeVersion,
                rl4_version: rl4Version,
                vscode: vscodeVersion
            }
        };
        
        this.saveToCache(cacheKey, restorePoint);
        return restorePoint;
    }
    
    /**
     * Hook 4: getForecasts
     * Récupère tous les forecasts actifs à un timestamp
     */
    async getForecasts(timestamp?: string): Promise<Forecast[]> {
        const cacheKey = timestamp ? `getForecasts-${timestamp}` : 'getForecasts-current';
        const cached = this.loadFromCache<Forecast[]>(cacheKey);
        
        if (cached) {
            return cached;
        }
        
        // Load forecasts.json
        const forecastsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'forecasts.json');
        
        if (!fs.existsSync(forecastsPath)) {
            return [];
        }
        
        try {
            const forecasts = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
            this.saveToCache(cacheKey, forecasts);
            return forecasts;
        } catch (e) {
            console.error('❌ Failed to load forecasts:', e);
            return [];
        }
    }
    
    /**
     * Clear all cached hooks
     * Utiliser après une mise à jour majeure des données
     */
    clearCache(): void {
        if (!fs.existsSync(this.cacheDir)) {
            return;
        }
        
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
            fs.unlinkSync(path.join(this.cacheDir, file));
        }
        
        console.log(`🗑️  Cleared ${files.length} cached hook responses`);
    }
    
    /**
     * Get cache statistics
     */
    getCacheStats() {
        if (!fs.existsSync(this.cacheDir)) {
            return { count: 0, size: 0 };
        }
        
        const files = fs.readdirSync(this.cacheDir);
        let totalSize = 0;
        
        for (const file of files) {
            const stats = fs.statSync(path.join(this.cacheDir, file));
            totalSize += stats.size;
        }
        
        return {
            count: files.length,
            size: totalSize,
            size_mb: (totalSize / 1024 / 1024).toFixed(2)
        };
    }
    
    // Private helpers
    
    private async findClosestCycle(timestamp: string): Promise<any | null> {
        const cyclesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'ledger', 'cycles.jsonl');
        
        if (!fs.existsSync(cyclesPath)) {
            return null;
        }
        
        const lines = fs.readFileSync(cyclesPath, 'utf-8').split('\n').filter(Boolean);
        const target = new Date(timestamp).getTime();
        
        let closestCycle = null;
        let minDiff = Infinity;
        
        for (const line of lines) {
            try {
                const cycle = JSON.parse(line);
                const cycleTime = new Date(cycle.timestamp).getTime();
                const diff = Math.abs(target - cycleTime);
                
                if (diff < minDiff) {
                    minDiff = diff;
                    closestCycle = cycle;
                }
            } catch (e) {
                // Skip invalid lines
            }
        }
        
        return closestCycle;
    }
    
    private async loadCyclesByIds(cycleIds: number[]): Promise<any[]> {
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
    
    private async loadTopPattern(): Promise<any | null> {
        const patternsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'patterns.json');
        
        if (!fs.existsSync(patternsPath)) {
            return null;
        }
        
        try {
            const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            if (patternsData.patterns && patternsData.patterns.length > 0) {
                return patternsData.patterns.reduce((max: any, p: any) => 
                    p.confidence > max.confidence ? p : max
                , patternsData.patterns[0]);
            }
        } catch (e) {
            // Ignore errors
        }
        
        return null;
    }
    
    private async loadTopForecast(): Promise<any | null> {
        const forecastsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'forecasts.json');
        
        if (!fs.existsSync(forecastsPath)) {
            return null;
        }
        
        try {
            const forecasts = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
            if (Array.isArray(forecasts) && forecasts.length > 0) {
                return forecasts.reduce((max: any, f: any) => 
                    f.confidence > max.confidence ? f : max
                , forecasts[0]);
            }
        } catch (e) {
            // Ignore errors
        }
        
        return null;
    }
    
    private async loadIntentAt(timestamp: string): Promise<string> {
        const commitsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'git_commits.jsonl');
        
        if (!fs.existsSync(commitsPath)) {
            return 'unknown';
        }
        
        try {
            const lines = fs.readFileSync(commitsPath, 'utf-8').split('\n').filter(Boolean);
            const target = new Date(timestamp).getTime();
            
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
            const lookback = 10 * 60 * 1000; // 10 minutes
            
            const filesSet = new Set<string>();
            
            for (const line of lines) {
                try {
                    const change = JSON.parse(line);
                    const changeTime = new Date(change.timestamp).getTime();
                    const diff = target - changeTime;
                    
                    if (diff >= 0 && diff < lookback) {
                        for (const c of change.metadata?.changes || []) {
                            filesSet.add(c.path);
                        }
                    }
                } catch (e) {
                    // Skip invalid lines
                }
            }
            
            return Array.from(filesSet).slice(0, 5);
        } catch (e) {
            return [];
        }
    }
    
    private async loadActiveADR(): Promise<any | null> {
        const adrsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'adrs', 'auto');
        
        if (!fs.existsSync(adrsPath)) {
            return null;
        }
        
        try {
            const adrFiles = fs.readdirSync(adrsPath).filter(f => f.startsWith('adr-'));
            
            let latestADR: any = null;
            let latestTime = 0;
            
            for (const file of adrFiles) {
                try {
                    const adr = JSON.parse(fs.readFileSync(path.join(adrsPath, file), 'utf-8'));
                    const modTime = new Date(adr.modifiedAt || adr.createdAt).getTime();
                    
                    if (adr.status === 'accepted' && modTime > latestTime) {
                        latestADR = adr;
                        latestTime = modTime;
                    }
                } catch (e) {
                    // Skip invalid ADRs
                }
            }
            
            return latestADR;
        } catch (e) {
            return null;
        }
    }
    
    private async findClosestCommit(timestamp: string): Promise<any | null> {
        const commitsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'git_commits.jsonl');
        
        if (!fs.existsSync(commitsPath)) {
            return null;
        }
        
        try {
            const lines = fs.readFileSync(commitsPath, 'utf-8').split('\n').filter(Boolean);
            const target = new Date(timestamp).getTime();
            
            let closestCommit = null;
            let minDiff = Infinity;
            
            for (const line of lines) {
                try {
                    const commit = JSON.parse(line);
                    const commitTime = new Date(commit.timestamp).getTime();
                    const diff = Math.abs(target - commitTime);
                    
                    if (diff < minDiff) {
                        minDiff = diff;
                        closestCommit = commit;
                    }
                } catch (e) {
                    // Skip invalid lines
                }
            }
            
            return closestCommit;
        } catch (e) {
            return null;
        }
    }
    
    private async getRL4Version(): Promise<string> {
        const packagePath = path.join(this.workspaceRoot, 'package.json');
        
        if (!fs.existsSync(packagePath)) {
            return 'unknown';
        }
        
        try {
            const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
            return pkg.version || 'unknown';
        } catch (e) {
            return 'unknown';
        }
    }
    
    // Cache management
    
    private loadFromCache<T>(key: string): T | null {
        const filePath = path.join(this.cacheDir, `${key}.json`);
        
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        try {
            // Check cache age (invalidate after 1 hour)
            const stats = fs.statSync(filePath);
            const age = Date.now() - stats.mtimeMs;
            if (age > 3600000) { // 1 hour
                fs.unlinkSync(filePath);
                return null;
            }
            
            return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
        } catch (e) {
            return null;
        }
    }
    
    private saveToCache<T>(key: string, data: T): void {
        const filePath = path.join(this.cacheDir, `${key}.json`);
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    }
}


/**
 * Pattern Evolution Tracker - History Enrichment Module
 * 
 * Tracks pattern confidence and frequency changes over time to enable:
 * - Trend analysis (rising/stable/declining patterns)
 * - Volatility detection (stable vs. chaotic patterns)
 * - Causal analysis (what triggers pattern changes)
 * 
 * Resolves Test 3 limitation: "Pattern réapparition" now has full evolution curve
 * Resolves Test 7 limitation: "Profil cognitif" now shows trajectory over time
 * 
 * RL4 History Component #1
 */

import * as fs from 'fs';
import * as path from 'path';
import { AppendOnlyWriter } from '../AppendOnlyWriter';

export interface PatternEvolution {
    timestamp: string;
    cycle_id: number;
    pattern_id: string;
    confidence: number;
    frequency: number;
    delta_confidence: number;      // vs. previous snapshot
    delta_confidence_pct: number;  // ((new - old) / old) * 100
    delta_frequency: number;
    moving_average_3: number;      // smooth short oscillations
    trend: 'rising' | 'stable' | 'declining';
}

interface Pattern {
    id: string;
    pattern: string;
    confidence: number;
    frequency: number;
}

export class PatternEvolutionTracker {
    private workspaceRoot: string;
    private evolutionPath: string;
    private appendWriter: AppendOnlyWriter;
    private lastPatterns: Map<string, Pattern> = new Map(); // Cache internal
    private confidenceHistory: Map<string, number[]> = new Map(); // For moving average
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        
        // Ensure history directory exists
        const historyDir = path.join(workspaceRoot, '.reasoning_rl4', 'history');
        if (!fs.existsSync(historyDir)) {
            fs.mkdirSync(historyDir, { recursive: true });
        }
        
        this.evolutionPath = path.join(historyDir, 'patterns_evolution.jsonl');
        this.appendWriter = new AppendOnlyWriter(this.evolutionPath);
        
        // Initialize cache from current patterns if exists
        this.initializeCache();
    }
    
    /**
     * Initialize cache from current patterns.json
     */
    private initializeCache(): void {
        const patternsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'patterns.json');
        
        if (!fs.existsSync(patternsPath)) {
            return;
        }
        
        try {
            const data = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            const patterns = data.patterns || [];
            
            for (const pattern of patterns) {
                this.lastPatterns.set(pattern.id, {
                    id: pattern.id,
                    pattern: pattern.pattern,
                    confidence: pattern.confidence,
                    frequency: pattern.frequency
                });
                
                // Initialize history for moving average
                this.confidenceHistory.set(pattern.id, [pattern.confidence]);
            }
        } catch (e) {
            // Ignore initialization errors
        }
    }
    
    /**
     * Track changes in patterns and persist evolution
     */
    public async trackChanges(currentPatterns: Pattern[], cycleId: number): Promise<void> {
        const timestamp = new Date().toISOString();
        
        for (const current of currentPatterns) {
            const previous = this.lastPatterns.get(current.id);
            
            // Calculate deltas
            const deltaConfidence = previous 
                ? current.confidence - previous.confidence 
                : 0;
            
            const deltaConfidencePct = previous && previous.confidence > 0
                ? ((current.confidence - previous.confidence) / previous.confidence) * 100
                : 0;
            
            const deltaFrequency = previous
                ? current.frequency - previous.frequency
                : current.frequency;
            
            // Update confidence history for moving average
            let history = this.confidenceHistory.get(current.id) || [];
            history.push(current.confidence);
            
            // Keep only last 3 for moving average
            if (history.length > 3) {
                history = history.slice(-3);
            }
            this.confidenceHistory.set(current.id, history);
            
            // Calculate moving average
            const movingAverage = history.reduce((sum, val) => sum + val, 0) / history.length;
            
            // Determine trend
            const trend = this.determineTrend(deltaConfidence, deltaConfidencePct);
            
            // Create evolution entry
            const evolution: PatternEvolution = {
                timestamp,
                cycle_id: cycleId,
                pattern_id: current.id,
                confidence: current.confidence,
                frequency: current.frequency,
                delta_confidence: parseFloat(deltaConfidence.toFixed(4)),
                delta_confidence_pct: parseFloat(deltaConfidencePct.toFixed(2)),
                delta_frequency: deltaFrequency,
                moving_average_3: parseFloat(movingAverage.toFixed(4)),
                trend
            };
            
            // Persist evolution
            await this.appendWriter.append(evolution);
            
            // Update cache
            this.lastPatterns.set(current.id, {
                id: current.id,
                pattern: current.pattern,
                confidence: current.confidence,
                frequency: current.frequency
            });
        }
        
        // Detect disappeared patterns
        for (const [patternId, previous] of this.lastPatterns.entries()) {
            const stillExists = currentPatterns.some(p => p.id === patternId);
            
            if (!stillExists) {
                // Pattern disappeared
                const evolution: PatternEvolution = {
                    timestamp,
                    cycle_id: cycleId,
                    pattern_id: patternId,
                    confidence: 0,
                    frequency: 0,
                    delta_confidence: -previous.confidence,
                    delta_confidence_pct: -100,
                    delta_frequency: -previous.frequency,
                    moving_average_3: 0,
                    trend: 'declining'
                };
                
                await this.appendWriter.append(evolution);
                
                // Remove from cache
                this.lastPatterns.delete(patternId);
                this.confidenceHistory.delete(patternId);
            }
        }
        
        // Flush every 10 patterns
        if (cycleId % 10 === 0) {
            await this.appendWriter.flush();
        }
    }
    
    /**
     * Determine trend from delta
     */
    private determineTrend(deltaConfidence: number, deltaPct: number): 'rising' | 'stable' | 'declining' {
        const threshold = 0.02; // 2% change threshold
        
        if (Math.abs(deltaPct) < threshold) {
            return 'stable';
        }
        
        return deltaConfidence > 0 ? 'rising' : 'declining';
    }
    
    /**
     * Get evolution for specific pattern
     */
    public async getPatternEvolution(patternId: string): Promise<PatternEvolution[]> {
        if (!fs.existsSync(this.evolutionPath)) {
            return [];
        }
        
        const lines = fs.readFileSync(this.evolutionPath, 'utf-8').split('\n').filter(Boolean);
        const evolutions: PatternEvolution[] = [];
        
        for (const line of lines) {
            try {
                const entry = JSON.parse(line);
                if (entry.metadata?.pattern_id === patternId || entry.pattern_id === patternId) {
                    evolutions.push(entry.metadata || entry);
                }
            } catch (e) {
                // Skip invalid lines
            }
        }
        
        return evolutions;
    }
    
    /**
     * Get current cache status
     */
    public getCacheStatus(): { patterns_tracked: number; history_depth: number } {
        const avgDepth = Array.from(this.confidenceHistory.values())
            .reduce((sum, arr) => sum + arr.length, 0) / this.confidenceHistory.size || 0;
        
        return {
            patterns_tracked: this.lastPatterns.size,
            history_depth: Math.round(avgDepth)
        };
    }
    
    /**
     * Flush any pending writes
     */
    public async flush(): Promise<void> {
        await this.appendWriter.flush(true); // With fsync
    }
}



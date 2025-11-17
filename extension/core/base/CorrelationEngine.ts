/**
 * Correlation Engine - Level 7
 * 
 * Detects correlations between recent events and learned patterns
 * Types: confirming, diverging, emerging
 */

import * as fs from 'fs';
import * as path from 'path';
import { Correlation, DecisionPattern } from './types';

interface LedgerEntry {
    entry_id: string;
    type: string;
    target_id: string;
    timestamp: string;
    data?: any;
}

interface CorrelationEvent {
    id: string;
    pattern_id: string;
    event_id: string;
    correlation_score: number;
    direction: 'confirming' | 'diverging' | 'emerging';
    tags: string[];
    impact: string;
    timestamp: string;
}

export class CorrelationEngine {
    private workspaceRoot: string;
    private correlationsPath: string;
    private patternsPath: string;
    private ledgerPath: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.correlationsPath = path.join(workspaceRoot, '.reasoning_rl4', 'correlations.json');
        this.patternsPath = path.join(workspaceRoot, '.reasoning_rl4', 'patterns.json');
        this.ledgerPath = path.join(workspaceRoot, '.reasoning_rl4', 'external', 'ledger.jsonl');
    }

    /**
     * Analyze recent events for correlations with learned patterns
     */
    public async analyze(): Promise<Correlation[]> {
        // Load patterns
        const patterns = await this.loadPatterns();
        if (!patterns || patterns.length === 0) {
            console.log('🔗 No patterns available for correlation analysis');
            return [];
        }

        // Load recent events from ledger
        const recentEvents = await this.loadRecentEvents();
        if (!recentEvents || recentEvents.length === 0) {
            console.log('🔗 No recent events available for correlation analysis');
            return [];
        }

        console.log(`🧩 Analyzing ${recentEvents.length} recent events against ${patterns.length} patterns`);

        // Find correlations
        const correlations: Correlation[] = [];
        const seenCorrelations = new Map<string, boolean>();

        for (const event of recentEvents) {
            for (const pattern of patterns) {
                const score = this.computeCorrelation(event, pattern);
                
                // Log for debugging
                if (score > 0) {
                    const eventTags = this.extractEventTags(event);
                    console.log(`🔍 Pattern "${pattern.pattern}" vs Event "${event.type}": score=${score.toFixed(2)} (eventTags: ${eventTags.join(',')})`);
                }
                
                if (score >= 0.55) { // OPTIMIZED: Lowered from 0.6 to 0.55 for more diversity
                    const correlation = this.createCorrelation(event, pattern, score);
                    
                    // Deduplication: Check if we've already seen this correlation
                    const correlationKey = `${pattern.id}:${event.entry_id}:${score.toFixed(2)}`;
                    if (seenCorrelations.has(correlationKey)) {
                        console.log(`⚠️ Duplicate correlation detected: ${pattern.pattern} ↔ ${event.type}`);
                        continue;
                    }
                    
                    seenCorrelations.set(correlationKey, true);
                    correlations.push(correlation);
                }
            }
        }

        // Group by direction
        const confirming = correlations.filter(c => c.direction === 'confirming').length;
        const diverging = correlations.filter(c => c.direction === 'diverging').length;
        const emerging = correlations.filter(c => c.direction === 'emerging').length;

        console.log(`🎯 ${correlations.length} correlations detected (${confirming} confirming, ${diverging} diverging, ${emerging} emerging)`);

        // Save correlations
        await this.saveCorrelations(correlations);
        
        console.log(`✅ Correlation deduplication complete`);

        // Append to ledger
        for (const correlation of correlations) {
            await this.appendToLedger(correlation);
        }

        return correlations;
    }

    /**
     * Compute correlation score between event and pattern
     * score = (semantic_similarity × 0.6) + (temporal_proximity × 0.3) + (impact_match × 0.1)
     */
    private computeCorrelation(event: LedgerEntry, pattern: DecisionPattern): number {
        // Extract tags from event based on type
        const eventTags = this.extractEventTags(event);
        const patternTags = pattern.tags || [];
        
        const semanticScore = this.cosineSimilarity(eventTags, patternTags);

        // Temporal proximity (exponential decay over 7 days)
        const daysDiff = this.daysDiff(event.timestamp, pattern.lastSeen || new Date().toISOString());
        const temporalScore = Math.exp(-daysDiff / 7);

        // Impact match (boolean)
        const impactScore = (event.data?.impact === pattern.impact) ? 1 : 0;

        // Weighted combination
        const score = (semanticScore * 0.6) + (temporalScore * 0.3) + (impactScore * 0.1);
        
        return Math.min(1, Math.max(0, score)); // Clamp to [0, 1]
    }

    /**
     * Extract tags from a ledger entry based on its structure
     */
    private extractEventTags(event: LedgerEntry): string[] {
        const tags: string[] = [];
        
        // For external evidence with nested data array
        if (event.type === 'EXTERNAL_EVIDENCE' && Array.isArray(event.data?.data)) {
            for (const item of event.data.data) {
                if (Array.isArray(item.tags)) {
                    tags.push(...item.tags);
                }
            }
        }
        // For direct tags property
        else if (Array.isArray(event.data?.tags)) {
            tags.push(...event.data.tags);
        }
        
        // Add type as tag
        if (event.data?.type) {
            tags.push(event.data.type);
        }
        
        return tags;
    }

    /**
     * Calculate cosine similarity between two tag arrays
     */
    private cosineSimilarity(tagsA: string[], tagsB: string[]): number {
        if (!tagsA || !tagsB || tagsA.length === 0 || tagsB.length === 0) return 0;

        const setA = new Set(tagsA.map(t => String(t).toLowerCase()));
        const setB = new Set(tagsB.map(t => String(t).toLowerCase()));

        const intersection = new Set([...setA].filter(t => setB.has(t)));
        const union = new Set([...setA, ...setB]);

        return union.size > 0 ? intersection.size / union.size : 0; // Jaccard similarity (simplified)
    }

    /**
     * Calculate days difference between two timestamps
     */
    private daysDiff(timestampA: string, timestampB: string): number {
        const dateA = new Date(timestampA);
        const dateB = new Date(timestampB);
        const diffMs = Math.abs(dateA.getTime() - dateB.getTime());
        return diffMs / (1000 * 60 * 60 * 24); // Convert to days
    }

    /**
     * Create correlation event
     */
    private createCorrelation(event: LedgerEntry, pattern: DecisionPattern, score: number): Correlation {
        // Determine direction
        let direction: 'confirming' | 'diverging' | 'emerging';
        if (score >= 0.85) {
            direction = 'confirming';
        } else if (score >= 0.75) {
            direction = 'diverging';
        } else {
            direction = 'emerging';
        }

        // Merge tags
        const tags = [...new Set([
            ...(event.data?.tags || []),
            ...(pattern.tags || [])
        ])];

        return {
            id: `corr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            pattern_id: pattern.id,
            event_id: event.entry_id,
            correlation_score: Math.round(score * 100) / 100,
            direction,
            tags,
            impact: pattern.impact,
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Load patterns from patterns.json
     */
    private async loadPatterns(): Promise<DecisionPattern[]> {
        try {
            if (!fs.existsSync(this.patternsPath)) {
                return [];
            }

            const data = fs.readFileSync(this.patternsPath, 'utf-8');
            const parsed = JSON.parse(data);
            
            // Handle both direct array and object with patterns property
            if (Array.isArray(parsed)) {
                return parsed;
            } else if (parsed.patterns && Array.isArray(parsed.patterns)) {
                return parsed.patterns;
            }
            
            return [];
        } catch (error) {
            console.error('Failed to load patterns:', error);
            return [];
        }
    }

    /**
     * Load recent events from ledger (last 100 entries)
     */
    private async loadRecentEvents(): Promise<LedgerEntry[]> {
        try {
            if (!fs.existsSync(this.ledgerPath)) {
                return [];
            }

            const data = fs.readFileSync(this.ledgerPath, 'utf-8');
            const lines = data.trim().split('\n').filter(line => line.trim());
            
            // Parse JSONL and take last 100 entries
            const entries: LedgerEntry[] = [];
            for (const line of lines.slice(-100)) {
                try {
                    entries.push(JSON.parse(line));
                } catch (e) {
                    // Skip invalid lines
                }
            }

            return entries;
        } catch (error) {
            console.error('Failed to load recent events:', error);
            return [];
        }
    }

    /**
     * Save correlations to correlations.json with deduplication
     */
    private async saveCorrelations(newCorrelations: Correlation[]): Promise<void> {
        try {
            // Load existing correlations
            let existingCorrelations: Correlation[] = [];
            if (fs.existsSync(this.correlationsPath)) {
                const existing = JSON.parse(fs.readFileSync(this.correlationsPath, 'utf-8'));
                existingCorrelations = Array.isArray(existing) ? existing : [];
            }

            // Deduplicate against existing correlations
            const seen = new Map<string, boolean>();
            for (const corr of existingCorrelations) {
                const key = `${corr.pattern_id}:${corr.event_id}:${corr.correlation_score}`;
                seen.set(key, true);
            }

            // Add new correlations only if not duplicates
            const uniqueNewCorrelations: Correlation[] = [];
            for (const corr of newCorrelations) {
                const key = `${corr.pattern_id}:${corr.event_id}:${corr.correlation_score}`;
                if (!seen.has(key)) {
                    seen.set(key, true);
                    uniqueNewCorrelations.push(corr);
                }
            }

            // OPTIMIZATION: Load current patterns to filter obsolete correlations
            const currentPatterns = await this.loadPatterns();
            const currentPatternIds = new Set(currentPatterns.map(p => p.id));
            
            // Filter existing correlations to keep only those with current pattern_ids
            const validExistingCorrelations = existingCorrelations.filter(c => 
                currentPatternIds.has(c.pattern_id)
            );
            
            // Combine valid existing + new correlations
            const allCorrelations = [...validExistingCorrelations, ...uniqueNewCorrelations];
            
            console.log(`💾 Saving ${allCorrelations.length} correlations (${uniqueNewCorrelations.length} new, ${validExistingCorrelations.length} valid existing, ${existingCorrelations.length - validExistingCorrelations.length} obsolete removed)`);

            fs.writeFileSync(
                this.correlationsPath,
                JSON.stringify(allCorrelations, null, 2),
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to save correlations:', error);
        }
    }

    /**
     * Append correlation to ledger
     */
    private async appendToLedger(correlation: Correlation): Promise<void> {
        try {
            const entry = {
                entry_id: correlation.id,
                type: 'correlation_event',
                target_id: correlation.event_id,
                timestamp: correlation.timestamp,
                data: correlation
            };

            fs.appendFileSync(
                this.ledgerPath,
                JSON.stringify(entry) + '\n',
                'utf-8'
            );
        } catch (error) {
            console.error('Failed to append correlation to ledger:', error);
        }
    }
}


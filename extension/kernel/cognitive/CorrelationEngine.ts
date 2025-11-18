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
        console.log(`[P0-CORE-00] CorrelationEngine.analyze() started`);
        
        // Load patterns
        const patterns = await this.loadPatterns();
        console.log(`[P0-CORE-00] CorrelationEngine: Loaded ${patterns?.length || 0} patterns`);
        
        if (!patterns || patterns.length === 0) {
            console.log(`[P0-CORE-00] CorrelationEngine: No patterns available for correlation analysis - returning []`);
            console.log('🔗 No patterns available for correlation analysis');
            return [];
        }

        // Load recent events from traces (primary source for RL4)
        const recentEvents = await this.loadFromTraces();
        console.log(`[P0-CORE-00] CorrelationEngine: Loaded ${recentEvents?.length || 0} events from traces`);
        
        if (!recentEvents || recentEvents.length === 0) {
            console.log(`[P0-CORE-00] CorrelationEngine: No events available for correlation analysis - returning []`);
            console.log('🔗 No events available for correlation analysis');
            return [];
        }

        console.log(`[P0-CORE-00] CorrelationEngine: Analyzing ${recentEvents.length} events against ${patterns.length} patterns`);
        console.log(`🧩 Analyzing ${recentEvents.length} recent events against ${patterns.length} patterns`);
        
        // Additional debug - write to file for inspection
        const debugPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'correlation_debug.json');
        try {
            fs.writeFileSync(debugPath, JSON.stringify({
                patterns_count: patterns.length,
                events_count: recentEvents.length,
                patterns_sample: patterns.slice(0, 2),
                events_sample: recentEvents.slice(0, 5)
            }, null, 2));
        } catch {}

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
                
                if (score >= 0.15) { // OPTIMIZED: Lowered to 0.15 for RL4 traces (very sparse tags)
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
        
        // Add event type
        tags.push(event.type);
        
        if (!event.data) return tags;
        
        // Git commit specific (RL4 traces format)
        if (event.data.commit) {
            const msg = event.data.commit.message || '';
            
            // Extract conventional commit type: fix:, feat:, test:, etc.
            const match = msg.match(/^(fix|feat|refactor|test|chore|docs|style|perf)(\([^)]+\))?:/);
            if (match) {
                tags.push(match[1]); // fix, feat, etc.
                if (match[2]) {
                    const scope = match[2].replace(/[()]/g, '');
                    tags.push(scope); // kernel, core, etc.
                }
            }
            
            // Extract keywords from message
            const keywords = msg.toLowerCase().match(/\b(kernel|architecture|fix|feature|refactor|test|cycle|timer|scheduler|pattern|correlation|forecast|adr)\b/g);
            if (keywords) tags.push(...keywords);
        }
        
        // Intent specific (RL4 traces format)
        if (event.data.intent?.type) {
            tags.push(event.data.intent.type);
        }
        if (event.data.intent?.keywords && Array.isArray(event.data.intent.keywords)) {
            tags.push(...event.data.intent.keywords);
        }
        
        // External evidence (legacy RL3 format)
        if (event.type === 'EXTERNAL_EVIDENCE' && Array.isArray(event.data?.data)) {
            for (const item of event.data.data) {
                if (Array.isArray(item.tags)) {
                    tags.push(...item.tags);
                }
            }
        }
        
        // Direct tags (legacy)
        if (Array.isArray(event.data.tags)) {
            tags.push(...event.data.tags);
        }
        if (event.data.type) {
            tags.push(event.data.type);
        }
        
        return [...new Set(tags.map(t => String(t).toLowerCase()))]; // Dedupe
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
     * Load events from traces (primary source for RL4)
     * ✅ P0-CORE-00: Enhanced logging for diagnostic
     */
    private async loadFromTraces(): Promise<LedgerEntry[]> {
        const tracesDir = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces');
        const events: LedgerEntry[] = [];
        
        console.log(`[P0-CORE-00] CorrelationEngine: Loading events from traces directory: ${tracesDir}`);
        console.log(`[P0-CORE-00] CorrelationEngine: Traces directory exists: ${fs.existsSync(tracesDir)}`);
        
        try {
            // Load git commits
            const gitPath = path.join(tracesDir, 'git_commits.jsonl');
            console.log(`[P0-CORE-00] CorrelationEngine: Checking git_commits.jsonl: ${gitPath}`);
            console.log(`[P0-CORE-00] CorrelationEngine: Git commits file exists: ${fs.existsSync(gitPath)}`);
            
            if (fs.existsSync(gitPath)) {
                const content = fs.readFileSync(gitPath, 'utf-8');
                const lines = content.trim().split('\n').filter(l => l);
                console.log(`[P0-CORE-00] CorrelationEngine: Git commits file has ${lines.length} lines`);
                
                let parsedCount = 0;
                let errorCount = 0;
                
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        // 🔧 Rebuild structure expected by extractEventTags()
                        const commitData = event.metadata?.commit || {};
                        const intentData = event.metadata?.intent || {};
                        events.push({
                            entry_id: event.id,
                            type: 'git_commit',
                            target_id: commitData.hash || event.id,
                            timestamp: event.timestamp,
                            data: {
                                commit: {
                                    hash: commitData.hash,
                                    message: commitData.message || '',
                                    files_changed: commitData.files_changed || []
                                },
                                intent: {
                                    type: intentData.type || 'commit',
                                    keywords: intentData.keywords || []
                                },
                                tags: [],
                                impact: 'neutral'
                            }
                        });
                        parsedCount++;
                    } catch (err) {
                        errorCount++;
                        console.warn(`[P0-CORE-00] CorrelationEngine: Failed to parse git commit trace: ${err}`);
                    }
                }
                console.log(`[P0-CORE-00] CorrelationEngine: Parsed ${parsedCount} git commits, ${errorCount} errors`);
            } else {
                console.log(`[P0-CORE-00] CorrelationEngine: Git commits file does not exist - this is normal for new workspaces`);
            }
            
            // Load file changes
            const filesPath = path.join(tracesDir, 'file_changes.jsonl');
            console.log(`[P0-CORE-00] CorrelationEngine: Checking file_changes.jsonl: ${filesPath}`);
            console.log(`[P0-CORE-00] CorrelationEngine: File changes file exists: ${fs.existsSync(filesPath)}`);
            
            if (fs.existsSync(filesPath)) {
                const content = fs.readFileSync(filesPath, 'utf-8');
                const lines = content.trim().split('\n').filter(l => l);
                console.log(`[P0-CORE-00] CorrelationEngine: File changes file has ${lines.length} lines`);
                
                let parsedCount = 0;
                let errorCount = 0;
                
                for (const line of lines) {
                    try {
                        const raw = JSON.parse(line);
                        // Map RL4 trace format to internal LedgerEntry format
                        events.push({
                            entry_id: raw.id,
                            type: 'file_change',
                            target_id: raw.metadata?.file || raw.id,
                            timestamp: raw.timestamp,
                            data: {
                                file: raw.metadata?.file,
                                changeType: raw.metadata?.changeType,
                                pattern: raw.metadata?.pattern,
                                intent: { type: raw.metadata?.pattern || 'change' }
                            }
                        });
                        parsedCount++;
                    } catch (err) {
                        errorCount++;
                        console.warn(`[P0-CORE-00] CorrelationEngine: Failed to parse file change trace: ${err}`);
                    }
                }
                console.log(`[P0-CORE-00] CorrelationEngine: Parsed ${parsedCount} file changes, ${errorCount} errors`);
            } else {
                console.log(`[P0-CORE-00] CorrelationEngine: File changes file does not exist - this is normal`);
            }
            
            // Load IDE activity
            const idePath = path.join(tracesDir, 'ide_activity.jsonl');
            console.log(`[P0-CORE-00] CorrelationEngine: Checking ide_activity.jsonl: ${idePath}`);
            console.log(`[P0-CORE-00] CorrelationEngine: IDE activity file exists: ${fs.existsSync(idePath)}`);
            
            if (fs.existsSync(idePath)) {
                const content = fs.readFileSync(idePath, 'utf-8');
                const lines = content.trim().split('\n').filter(l => l);
                console.log(`[P0-CORE-00] CorrelationEngine: IDE activity file has ${lines.length} lines`);
                
                let parsedCount = 0;
                let errorCount = 0;
                
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        events.push({
                            entry_id: event.id || `ide-${Date.now()}`,
                            type: 'ide_activity',
                            target_id: event.file || '',
                            timestamp: event.timestamp,
                            data: event
                        });
                        parsedCount++;
                    } catch (err) {
                        errorCount++;
                        console.warn(`[P0-CORE-00] CorrelationEngine: Failed to parse IDE activity trace: ${err}`);
                    }
                }
                console.log(`[P0-CORE-00] CorrelationEngine: Parsed ${parsedCount} IDE activities, ${errorCount} errors`);
            } else {
                console.log(`[P0-CORE-00] CorrelationEngine: IDE activity file does not exist - this is normal`);
            }
            
            console.log(`[P0-CORE-00] CorrelationEngine: Total events loaded from traces: ${events.length}`);
            console.log(`✅ Loaded ${events.length} events from traces`);
        } catch (error) {
            console.error('Failed to load traces:', error);
        }
        
        return events;
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
            
            // Filter out Git conflict markers
            const isGitConflictMarker = (line: string): boolean => {
                const trimmed = line.trim();
                return trimmed.startsWith('<<<<<<<') || 
                       trimmed.startsWith('=======') || 
                       trimmed.startsWith('>>>>>>>') ||
                       trimmed.includes('<<<<<<< Updated upstream') ||
                       trimmed.includes('>>>>>>> Stashed changes');
            };
            
            // Parse JSONL and take last 100 entries
            const entries: LedgerEntry[] = [];
            for (const line of lines.slice(-100)) {
                if (isGitConflictMarker(line)) {
                    continue; // Skip Git conflict markers
                }
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


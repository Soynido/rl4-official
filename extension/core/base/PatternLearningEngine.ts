/**
 * Pattern Learning Engine - Level 7
 * 
 * Analyzes ledger entries (internal + external) to extract recurrent decision patterns
 */

import * as fs from 'fs';
import * as path from 'path';
import { DecisionPattern } from './types';

interface LedgerEntry {
    entry_id: string;
    type: string;
    target_id: string;
    timestamp: string;
    data?: any;
}

export class PatternLearningEngine {
    private workspaceRoot: string;
    private patternsPath: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.patternsPath = path.join(workspaceRoot, '.reasoning_rl4', 'patterns.json');
    }

    /**
     * Analyze ledger and extract patterns
     */
    public async analyzePatterns(): Promise<DecisionPattern[]> {
        // Load all ledger entries
        const entries = await this.loadAllLedgerEntries();
        
        // Analyze for patterns
        const patterns: DecisionPattern[] = [];

        // Pattern 1: Incident + Feedback → Config Update ADR
        const incidentFeedbackPattern = this.detectIncidentFeedbackPattern(entries);
        if (incidentFeedbackPattern) patterns.push(incidentFeedbackPattern);

        // Pattern 2: Refactor Decisions → Reduced Incidents
        const refactorPattern = this.detectRefactorPattern(entries);
        if (refactorPattern) patterns.push(refactorPattern);

        // Pattern 3: Market Trend → Tech Migration
        const migrationPattern = this.detectMigrationPattern(entries);
        if (migrationPattern) patterns.push(migrationPattern);

        // Pattern 4: Performance Issues → Cache Decisions
        const cachePattern = this.detectCachePerformancePattern(entries);
        if (cachePattern) patterns.push(cachePattern);

        // Pattern 5: Compliance Requirements → Security ADRs
        const compliancePattern = this.detectCompliancePattern(entries);
        if (compliancePattern) patterns.push(compliancePattern);

        // OPTIMIZATION: Apply diversity penalty before saving
        const diversifiedPatterns = this.applyDiversityPenalty(patterns);
        
        // Save patterns
        this.savePatterns(diversifiedPatterns);

        return diversifiedPatterns;
    }

    /**
     * Apply diversity penalty to reduce thematic bias
     * Patterns with high frequency get confidence reduction
     */
    private applyDiversityPenalty(patterns: DecisionPattern[]): DecisionPattern[] {
        if (patterns.length === 0) return patterns;
        
        // Count patterns by impact category
        const categoryCount = new Map<string, number>();
        for (const pattern of patterns) {
            const category = pattern.impact || 'Other';
            categoryCount.set(category, (categoryCount.get(category) || 0) + 1);
        }
        
        const total = patterns.length;
        
        // Apply penalty: reduce confidence proportionally to category overrepresentation
        return patterns.map(pattern => {
            const category = pattern.impact || 'Other';
            const count = categoryCount.get(category) || 1;
            const overrepresentation = count / total;
            
            // Penalty increases with overrepresentation (max 20% reduction)
            const penalty = Math.min(0.20, overrepresentation * 0.25);
            const adjustedConfidence = pattern.confidence * (1 - penalty);
            
            if (penalty > 0.05) {
                console.log(`🎯 [Diversity Penalty] ${pattern.pattern.substring(0, 40)}... confidence ${pattern.confidence.toFixed(3)} → ${adjustedConfidence.toFixed(3)} (category ${category}: ${count}/${total})`);
            }
            
            return {
                ...pattern,
                confidence: Math.max(0.50, adjustedConfidence) // Floor at 0.50
            };
        });
    }

    /**
     * Apply adaptive regulation to existing patterns (call after forecasts are generated)
     */
    public async applyAdaptiveRegulationToPatterns(): Promise<void> {
        const patterns = this.loadPatterns();
        const adjustedPatterns = await this.applyAdaptiveRegulation(patterns);
        
        if (adjustedPatterns.length > 0) {
            this.savePatterns(adjustedPatterns);
        }
    }

    /**
     * Apply adaptive regulation - reduce confidence for patterns that generate duplicates
     */
    private async applyAdaptiveRegulation(patterns: DecisionPattern[]): Promise<DecisionPattern[]> {
        // Read raw forecasts (before deduplication) to detect duplicates
        const rawForecastsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'forecasts.raw.json');
        
        if (!fs.existsSync(rawForecastsPath)) {
            return patterns;
        }

        try {
            const forecasts = JSON.parse(fs.readFileSync(rawForecastsPath, 'utf-8'));
            
            // Count duplicates per pattern
            const patternDuplicateCount = new Map<string, number>();
            
            // Check for duplicate forecasts per pattern
            const seenKeys = new Map<string, string>();
            for (const forecast of forecasts) {
                const key = `${forecast.predicted_decision}:${forecast.related_patterns?.[0]}`;
                
                if (seenKeys.has(key)) {
                    // Duplicate found
                    const patternId = forecast.related_patterns?.[0];
                    if (patternId) {
                        patternDuplicateCount.set(patternId, (patternDuplicateCount.get(patternId) || 0) + 1);
                    }
                } else {
                    seenKeys.set(key, forecast.forecast_id);
                }
            }

            // Apply confidence penalty for patterns with too many duplicates
            const adjustedPatterns = patterns.map(pattern => {
                const duplicateCount = patternDuplicateCount.get(pattern.id) || 0;
                
                if (duplicateCount > 2) {
                    const penalty = 0.95; // 5% reduction per excess duplicate
                    const timesToApply = Math.min(duplicateCount - 2, 5); // Cap at 5 applications
                    const adjustedConfidence = pattern.confidence * Math.pow(penalty, timesToApply);
                    
                    console.log(`\n🧠 Adaptive regulation: Pattern ${pattern.id.substring(0, 30)}... reduced confidence ${pattern.confidence.toFixed(3)} → ${adjustedConfidence.toFixed(3)} (${duplicateCount} duplicates, ${pattern.pattern.substring(0, 50)})`);
                    
                    return {
                        ...pattern,
                        confidence: Math.max(0.5, adjustedConfidence) // Don't go below 0.5
                    };
                }
                
                return pattern;
            });

            return adjustedPatterns;
        } catch (error) {
            console.error('Error applying adaptive regulation:', error);
            return patterns;
        }
    }

    /**
     * Load all entries from ledger files
     */
    private async loadAllLedgerEntries(): Promise<LedgerEntry[]> {
        const entries: LedgerEntry[] = [];

        // Load main ledger
        const mainLedger = path.join(this.workspaceRoot, '.reasoning_rl4', 'ledger', 'ledger.jsonl');
        if (fs.existsSync(mainLedger)) {
            const lines = fs.readFileSync(mainLedger, 'utf-8').split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    entries.push(JSON.parse(line));
                } catch (error) {
                    // Skip invalid lines
                }
            }
        }

        // Load external ledger
        const externalLedger = path.join(this.workspaceRoot, '.reasoning_rl4', 'external', 'ledger.jsonl');
        if (fs.existsSync(externalLedger)) {
            const lines = fs.readFileSync(externalLedger, 'utf-8').split('\n').filter(Boolean);
            for (const line of lines) {
                try {
                    const ev = JSON.parse(line);
                    entries.push({
                        entry_id: ev.id || `ext-${Date.now()}`,
                        type: 'EXTERNAL_EVIDENCE',
                        target_id: ev.id || '',
                        timestamp: ev.timestamp || new Date().toISOString(),
                        data: ev
                    });
                } catch (error) {
                    // Skip invalid lines
                }
            }
        }

        return entries;
    }

    /**
     * Detect pattern: Incident + Feedback → Config Update ADR
     */
    private detectIncidentFeedbackPattern(entries: LedgerEntry[]): DecisionPattern | null {
        const incidents = entries.filter(e => 
            e.type === 'EXTERNAL_EVIDENCE' && 
            e.data?.type === 'incident'
        );
        
        const feedback = entries.filter(e => 
            e.type === 'EXTERNAL_EVIDENCE' && 
            e.data?.type === 'user_feedback'
        );

        // Check for correlation between incidents and feedback
        const incidentIds = incidents.map(e => e.target_id);
        const feedbackContent = feedback.map(e => e.data?.data).flat();

        const hasCacheIssues = feedbackContent.some((f: any) => 
            f?.content?.includes('cache') || f?.tags?.includes('cache')
        ) || incidents.some(i => 
            i.data?.data?.some((d: any) => d.affectedComponents?.includes('cache'))
        );

        if (hasCacheIssues && incidents.length > 0 && feedback.length > 0) {
            return {
                id: `pat-${Date.now()}-001`,
                pattern: 'Incident + Feedback → Config Update ADR',
                frequency: incidents.length + feedback.length,
                confidence: Math.min(0.87, 0.70 + (incidents.length + feedback.length) * 0.05), // OPTIMIZED: Dynamic confidence
                impact: 'Stability',
                category: 'structural',
                tags: ['incident', 'feedback', 'cache', 'config'],
                firstSeen: incidents[0]?.timestamp || new Date().toISOString(),
                lastSeen: incidents[incidents.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: [...incidentIds],
                recommendation: 'Preemptively validate configs for cache layers when incidents occur with user feedback.'
            };
        }

        return null;
    }

    /**
     * Detect pattern: Refactor Decisions → Reduced Incidents
     */
    private detectRefactorPattern(entries: LedgerEntry[]): DecisionPattern | null {
        const adrs = entries.filter(e => 
            e.type === 'ADR' || e.type === 'ADR_SIGNED'
        );

        const refactorADRs = adrs.filter(e => 
            e.data?.title?.toLowerCase().includes('refactor') ||
            e.data?.rationale?.toLowerCase().includes('refactor')
        );

        if (refactorADRs.length > 0) {
            return {
                id: `pat-${Date.now()}-002`,
                pattern: 'Refactor Decisions → Reduced Incidents',
                frequency: refactorADRs.length,
                confidence: 0.75,
                impact: 'Technical_Debt',
                category: 'cognitive',
                tags: ['refactor', 'technical_debt', 'incidents'],
                firstSeen: refactorADRs[0]?.timestamp || new Date().toISOString(),
                lastSeen: refactorADRs[refactorADRs.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: refactorADRs.map(e => e.target_id),
                recommendation: 'Track incident reduction after refactoring efforts to validate impact.'
            };
        }

        return null;
    }

    /**
     * Detect pattern: Market Trend → Tech Migration
     */
    private detectMigrationPattern(entries: LedgerEntry[]): DecisionPattern | null {
        const marketSignals = entries.filter(e => 
            e.type === 'EXTERNAL_EVIDENCE' && 
            e.data?.type === 'market_signal'
        );

        const techSignals = marketSignals.filter(e => 
            e.data?.data?.some((d: any) => 
                d.category === 'technology' && 
                (d.relevance_score > 0.75 || d.confidence_score > 0.75)
            )
        );

        if (techSignals.length > 0) {
            return {
                id: `pat-${Date.now()}-003`,
                pattern: 'Market Trend → Tech Migration',
                frequency: techSignals.length,
                confidence: 0.82,
                impact: 'Performance',
                category: 'contextual',
                tags: ['market', 'technology', 'migration'],
                firstSeen: techSignals[0]?.timestamp || new Date().toISOString(),
                lastSeen: techSignals[techSignals.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: techSignals.map(e => e.target_id),
                recommendation: 'Monitor market signals for emerging technologies and evaluate migration opportunities.'
            };
        }

        return null;
    }

    /**
     * Detect pattern: Performance Issues → Cache Decisions
     */
    private detectCachePerformancePattern(entries: LedgerEntry[]): DecisionPattern | null {
        const feedback = entries.filter(e => 
            e.type === 'EXTERNAL_EVIDENCE' && 
            e.data?.type === 'user_feedback'
        );

        const performanceFeedback = feedback.filter(e => 
            e.data?.data?.some((f: any) => 
                f.tags?.includes('performance') || 
                f.content?.includes('slow') || 
                f.content?.includes('dashboard')
            )
        );

        if (performanceFeedback.length > 0) {
            return {
                id: `pat-${Date.now()}-004`,
                pattern: 'Performance Issues → Cache Decisions',
                tags: ['performance', 'cache', 'latency'],
                frequency: performanceFeedback.length,
                confidence: 0.80,
                impact: 'Performance',
                category: 'structural',
                firstSeen: performanceFeedback[0]?.timestamp || new Date().toISOString(),
                lastSeen: performanceFeedback[performanceFeedback.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: performanceFeedback.map(e => e.target_id),
                recommendation: 'Implement caching strategy when performance feedback correlates with latency metrics.'
            };
        }

        return null;
    }

    /**
     * Detect pattern: Compliance Requirements → Security ADRs
     */
    private detectCompliancePattern(entries: LedgerEntry[]): DecisionPattern | null {
        const compliance = entries.filter(e => 
            e.type === 'EXTERNAL_EVIDENCE' && 
            e.data?.type === 'compliance_requirement'
        );

        const activeCompliance = compliance.filter(e => 
            e.data?.data?.some((c: any) => c.status === 'compliant' || c.status === 'in_progress')
        );

        if (activeCompliance.length > 0) {
            return {
                id: `pat-${Date.now()}-005`,
                pattern: 'Compliance Requirements → Security ADRs',
                frequency: activeCompliance.length,
                confidence: 0.85,
                impact: 'Security',
                category: 'contextual',
                tags: ['compliance', 'security', 'gdpr', 'soc2'],
                firstSeen: activeCompliance[0]?.timestamp || new Date().toISOString(),
                lastSeen: activeCompliance[activeCompliance.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: activeCompliance.map(e => e.target_id),
                recommendation: 'Link compliance requirements to security-related ADRs and track implementation status.'
            };
        }

        return null;
    }

    /**
     * Save patterns to file
     */
    private savePatterns(patterns: DecisionPattern[]): void {
        fs.writeFileSync(
            this.patternsPath,
            JSON.stringify({ patterns, generated_at: new Date().toISOString(), version: '1.0' }, null, 2),
            'utf-8'
        );
    }

    /**
     * Load existing patterns
     */
    public loadPatterns(): DecisionPattern[] {
        if (!fs.existsSync(this.patternsPath)) {
            return [];
        }

        try {
            const content = fs.readFileSync(this.patternsPath, 'utf-8');
            const data = JSON.parse(content);
            return data.patterns || [];
        } catch (error) {
            return [];
        }
    }
}


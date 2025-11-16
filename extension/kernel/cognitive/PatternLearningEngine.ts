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
        this.patternsPath = path.join(workspaceRoot, '.reasoning_rl4', 'patterns.jsonl');
    }

    /**
     * Analyze ledger and extract patterns
     * AUTO-LEARNING: Loads existing patterns (potentially improved by LLM) and builds upon them
     */
    public async analyzePatterns(): Promise<DecisionPattern[]> {
        // AUTO-LEARNING: Load existing patterns (may have been improved by LLM)
        const existingPatterns = this.loadPatterns();
        const existingPatternIds = new Set(existingPatterns.map(p => p.id));
        
        // Load all ledger entries
        const entries = await this.loadAllLedgerEntries();
        
        // Analyze for NEW patterns (only detect patterns not already in existingPatterns)
        const newPatterns: DecisionPattern[] = [];

        // Pattern 1: Incident + Feedback → Config Update ADR
        const incidentFeedbackPattern = this.detectIncidentFeedbackPattern(entries);
        if (incidentFeedbackPattern && !existingPatternIds.has(incidentFeedbackPattern.id)) {
            newPatterns.push(incidentFeedbackPattern);
        }

        // Pattern 2: Refactor Decisions → Reduced Incidents
        const refactorPattern = this.detectRefactorPattern(entries);
        if (refactorPattern && !existingPatternIds.has(refactorPattern.id)) {
            newPatterns.push(refactorPattern);
        }

        // Pattern 3: Market Trend → Tech Migration
        const migrationPattern = this.detectMigrationPattern(entries);
        if (migrationPattern && !existingPatternIds.has(migrationPattern.id)) {
            newPatterns.push(migrationPattern);
        }

        // Pattern 4: Performance Issues → Cache Decisions
        const cachePattern = this.detectCachePerformancePattern(entries);
        if (cachePattern && !existingPatternIds.has(cachePattern.id)) {
            newPatterns.push(cachePattern);
        }

        // Pattern 5: Compliance Requirements → Security ADRs
        const compliancePattern = this.detectCompliancePattern(entries);
        if (compliancePattern && !existingPatternIds.has(compliancePattern.id)) {
            newPatterns.push(compliancePattern);
        }

        // === GIT-BASED PATTERNS (from commit history) ===
        
        // Pattern 6: Kernel Evolution (frequent kernel commits)
        const kernelPattern = this.detectKernelEvolutionPattern(entries);
        if (kernelPattern && !existingPatternIds.has(kernelPattern.id)) {
            newPatterns.push(kernelPattern);
        }

        // Pattern 7: Fix Cycles (repeated fixes)
        const fixCyclePattern = this.detectFixCyclePattern(entries);
        if (fixCyclePattern && !existingPatternIds.has(fixCyclePattern.id)) {
            newPatterns.push(fixCyclePattern);
        }

        // Pattern 8: Feature Development Velocity
        const featureVelocityPattern = this.detectFeatureVelocityPattern(entries);
        if (featureVelocityPattern && !existingPatternIds.has(featureVelocityPattern.id)) {
            newPatterns.push(featureVelocityPattern);
        }

        // Pattern 9: Refactor Decisions
        const refactorDecisionPattern = this.detectRefactorDecisionPattern(entries);
        if (refactorDecisionPattern && !existingPatternIds.has(refactorDecisionPattern.id)) {
            newPatterns.push(refactorDecisionPattern);
        }

        // AUTO-LEARNING: Merge existing patterns (potentially improved by LLM) with new patterns
        const allPatterns = [...existingPatterns, ...newPatterns];

        // OPTIMIZATION: Apply diversity penalty before saving
        const diversifiedPatterns = this.applyDiversityPenalty(allPatterns);
        
        // Save patterns (preserving LLM improvements)
        await this.savePatterns(diversifiedPatterns);

        console.log(`🧠 PatternLearningEngine: ${existingPatterns.length} existing patterns (preserved) + ${newPatterns.length} new patterns = ${diversifiedPatterns.length} total`);

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
            await this.savePatterns(adjustedPatterns);
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

        // Filter out Git conflict markers
        const isGitConflictMarker = (line: string): boolean => {
            const trimmed = line.trim();
            return trimmed.startsWith('<<<<<<<') || 
                   trimmed.startsWith('=======') || 
                   trimmed.startsWith('>>>>>>>') ||
                   trimmed.includes('<<<<<<< Updated upstream') ||
                   trimmed.includes('>>>>>>> Stashed changes');
        };

        // Load main ledger
        const mainLedger = path.join(this.workspaceRoot, '.reasoning_rl4', 'ledger', 'rbom_ledger.jsonl');
        if (fs.existsSync(mainLedger)) {
            const lines = fs.readFileSync(mainLedger, 'utf-8').split('\n').filter(Boolean);
            for (const line of lines) {
                if (isGitConflictMarker(line)) {
                    continue; // Skip Git conflict markers
                }
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
                if (isGitConflictMarker(line)) {
                    continue; // Skip Git conflict markers
                }
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
     * === GIT-BASED PATTERN DETECTORS ===
     */

    /**
     * Pattern 6: Kernel Evolution (frequent kernel commits)
     */
    private detectKernelEvolutionPattern(entries: LedgerEntry[]): DecisionPattern | null {
        const kernelCommits = entries.filter(e => {
            // RL4 traces format
            if (e.type === 'git_commit' && e.data?.commit?.message) {
                const msg = e.data.commit.message.toLowerCase();
                return msg.includes('kernel') || msg.includes('scheduler') || msg.includes('ledger') || msg.includes('merkle');
            }
            // Legacy format
            if (e.type === 'decision' && e.data?.message) {
                const msg = e.data.message.toLowerCase();
                return msg.includes('kernel') || msg.includes('scheduler') || msg.includes('ledger') || msg.includes('merkle');
            }
            return false;
        });

        if (kernelCommits.length >= 5) {
            return {
                id: `pattern-kernel-evolution-${Date.now()}`,
                pattern: `Frequent kernel architecture commits (${kernelCommits.length} commits) indicate active evolution of core reasoning infrastructure`,
                frequency: kernelCommits.length,
                confidence: Math.min(0.95, 0.60 + (kernelCommits.length * 0.05)),
                impact: 'Stability',
                category: 'structural',
                tags: ['kernel', 'architecture', 'infrastructure'],
                firstSeen: kernelCommits[0]?.timestamp || new Date().toISOString(),
                lastSeen: kernelCommits[kernelCommits.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: kernelCommits.map(e => e.entry_id),
                recommendation: 'Continue kernel stabilization efforts. Consider documenting architectural decisions and creating stability metrics.'
            };
        }

        return null;
    }

    /**
     * Pattern 7: Fix Cycles (repeated fixes indicate stability issues)
     */
    private detectFixCyclePattern(entries: LedgerEntry[]): DecisionPattern | null {
        const fixCommits = entries.filter(e => {
            // RL4 traces format
            if (e.type === 'git_commit' && e.data?.commit?.message) {
                const msg = e.data.commit.message.toLowerCase();
                return msg.startsWith('fix') || msg.includes('bugfix') || msg.includes('hotfix');
            }
            // Legacy format  
            if (e.type === 'decision' && e.data?.message) {
                const msg = e.data.message.toLowerCase();
                return msg.startsWith('fix') || msg.includes('bugfix') || msg.includes('hotfix');
            }
            return false;
        });

        if (fixCommits.length >= 10) {
            return {
                id: `pattern-fix-cycle-${Date.now()}`,
                pattern: `High frequency of fix commits (${fixCommits.length} fixes) suggests areas requiring stability improvements`,
                frequency: fixCommits.length,
                confidence: Math.min(0.90, 0.65 + (fixCommits.length * 0.02)),
                impact: 'Stability',
                category: 'structural',
                tags: ['fixes', 'stability', 'quality'],
                firstSeen: fixCommits[0]?.timestamp || new Date().toISOString(),
                lastSeen: fixCommits[fixCommits.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: fixCommits.map(e => e.entry_id),
                recommendation: 'Investigate root causes of frequent fixes. Consider adding integration tests and improving error handling.'
            };
        }

        return null;
    }

    /**
     * Pattern 8: Feature Development Velocity
     */
    private detectFeatureVelocityPattern(entries: LedgerEntry[]): DecisionPattern | null {
        const featureCommits = entries.filter(e => {
            // RL4 traces format
            if (e.type === 'git_commit' && e.data?.commit?.message) {
                const msg = e.data.commit.message.toLowerCase();
                return msg.startsWith('feat') || msg.includes('feature');
            }
            // Legacy format
            if (e.type === 'decision' && e.data?.message) {
                const msg = e.data.message.toLowerCase();
                return msg.startsWith('feat') || msg.includes('feature');
            }
            return false;
        });

        if (featureCommits.length >= 15) {
            return {
                id: `pattern-feature-velocity-${Date.now()}`,
                pattern: `Consistent feature development (${featureCommits.length} features) indicates healthy product iteration and experimentation`,
                frequency: featureCommits.length,
                confidence: Math.min(0.92, 0.70 + (featureCommits.length * 0.01)),
                impact: 'User_Experience',
                category: 'cognitive',
                tags: ['features', 'development', 'velocity'],
                firstSeen: featureCommits[0]?.timestamp || new Date().toISOString(),
                lastSeen: featureCommits[featureCommits.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: featureCommits.map(e => e.entry_id),
                recommendation: 'Maintain current development velocity. Consider documenting feature decisions and user impact.'
            };
        }

        return null;
    }

    /**
     * Pattern 9: Refactor Decisions (large-scale code improvements)
     */
    private detectRefactorDecisionPattern(entries: LedgerEntry[]): DecisionPattern | null {
        const refactorCommits = entries.filter(e => {
            // RL4 traces format
            if (e.type === 'git_commit' && e.data?.commit?.message) {
                const msg = e.data.commit.message.toLowerCase();
                return msg.startsWith('refactor') || msg.includes('refactor');
            }
            // Legacy format
            if (e.type === 'decision' && e.data?.message) {
                const msg = e.data.message.toLowerCase();
                return msg.startsWith('refactor') || msg.includes('refactor');
            }
            return false;
        });

        if (refactorCommits.length >= 5) {
            return {
                id: `pattern-refactor-decision-${Date.now()}`,
                pattern: `Regular refactoring commits (${refactorCommits.length} refactors) indicate proactive technical debt management`,
                frequency: refactorCommits.length,
                confidence: Math.min(0.88, 0.70 + (refactorCommits.length * 0.03)),
                impact: 'Technical_Debt',
                category: 'structural',
                tags: ['refactor', 'technical-debt', 'quality'],
                firstSeen: refactorCommits[0]?.timestamp || new Date().toISOString(),
                lastSeen: refactorCommits[refactorCommits.length - 1]?.timestamp || new Date().toISOString(),
                evidenceIds: refactorCommits.map(e => e.entry_id),
                recommendation: 'Continue refactoring efforts. Document architectural improvements and measure code quality metrics.'
            };
        }

        return null;
    }

    /**
     * Save patterns to file
     */
    private async savePatterns(patterns: DecisionPattern[]): Promise<void> {
        // Ensure directory exists
        const dir = path.dirname(this.patternsPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        // Write patterns as JSON (for now, will migrate to JSONL later)
        fs.writeFileSync(
            this.patternsPath.replace('.jsonl', '.json'), // Temp: use .json
            JSON.stringify({ patterns, generated_at: new Date().toISOString(), version: '1.0' }, null, 2),
            'utf-8'
        );
    }

    /**
     * Load existing patterns
     */
    public loadPatterns(): DecisionPattern[] {
        const jsonPath = this.patternsPath.replace('.jsonl', '.json');
        
        if (!fs.existsSync(jsonPath)) {
            return [];
        }

        try {
            const content = fs.readFileSync(jsonPath, 'utf-8');
            const data = JSON.parse(content);
            return data.patterns || [];
        } catch (error) {
            return [];
        }
    }
}


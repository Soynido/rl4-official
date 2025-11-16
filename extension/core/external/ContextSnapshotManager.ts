/**
 * ContextSnapshotManager - Level 6.5
 * 
 * Consolidates external evidence, insights, and correlations into a unified snapshot
 * that serves as input for the Level 7 Reasoning & Forecast Layer
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExternalIntegrator } from './ExternalIntegrator';
import { ExternalSyncStatus } from './ExternalIntegrator';
import { ExternalEvidence } from './types';

export interface ConsolidatedInsight {
    id: string;
    title: string;
    description: string;
    category: 'performance' | 'scaling' | 'migration' | 'risk' | 'opportunity';
    confidence: number;
    evidenceIds: string[];
    adrCorrelations?: string[];
    recommendation?: string;
    priority: 'low' | 'medium' | 'high' | 'critical';
}

export interface ContextSnapshot {
    snapshot_id: string;
    generated_at: string;
    version: string;
    
    summary: {
        total_evidences: number;
        sources_synced: string[];
        sync_count: number;
        average_confidence: number;
        date_range: {
            earliest: string;
            latest: string;
        };
    };
    
    evidences: {
        product_metrics: ExternalEvidence[];
        user_feedback: ExternalEvidence[];
        compliance: ExternalEvidence[];
        market_signals: ExternalEvidence[];
        incidents: ExternalEvidence[];
    };
    
    insights: ConsolidatedInsight[];
    
    metadata: {
        workspace_root: string;
        report_path: string;
        ledger_path: string;
    };
}

export class ContextSnapshotManager {
    private workspaceRoot: string;
    private snapshotPath: string;
    private externalIntegrator: ExternalIntegrator;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.snapshotPath = path.join(workspaceRoot, '.reasoning', 'context_snapshot.json');
        this.externalIntegrator = new ExternalIntegrator(workspaceRoot);
    }

    /**
     * Generate a consolidated context snapshot
     */
    public async generateSnapshot(): Promise<ContextSnapshot> {
        // Sync all sources first
        const syncResults = await this.externalIntegrator.syncAll();
        const allEvidences = this.externalIntegrator.getAllExternalEvidence();

        // Group evidences by type
        const evidences = {
            product_metrics: allEvidences.filter(e => e.type === 'product_metric'),
            user_feedback: allEvidences.filter(e => e.type === 'user_feedback'),
            compliance: allEvidences.filter(e => e.type === 'compliance_requirement'),
            market_signals: allEvidences.filter(e => e.type === 'market_signal'),
            incidents: allEvidences.filter(e => e.type === 'incident')
        };

        // Calculate summary statistics
        const avgConfidence = allEvidences.length > 0
            ? allEvidences.reduce((sum, e) => sum + (e.confidence || 0), 0) / allEvidences.length
            : 0;

        const timestamps = allEvidences.map(e => e.timestamp).sort();
        const sourcesSynced = syncResults
            .filter(r => r.status === 'success')
            .map(r => r.source);

        // Generate consolidated insights based on the report analysis
        const insights = this.generateInsights(allEvidences, evidences);

        const snapshot: ContextSnapshot = {
            snapshot_id: `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            generated_at: new Date().toISOString(),
            version: '1.0',

            summary: {
                total_evidences: allEvidences.length,
                sources_synced: sourcesSynced,
                sync_count: syncResults.length,
                average_confidence: Math.round(avgConfidence * 100) / 100,
                date_range: {
                    earliest: timestamps[0] || new Date().toISOString(),
                    latest: timestamps[timestamps.length - 1] || new Date().toISOString()
                }
            },

            evidences,

            insights,

            metadata: {
                workspace_root: this.workspaceRoot,
                report_path: path.join(this.workspaceRoot, 'LEVEL_6_REPORT.md'),
                ledger_path: path.join(this.workspaceRoot, '.reasoning', 'external', 'ledger.jsonl')
            }
        };

        // Save snapshot
        fs.writeFileSync(this.snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');

        return snapshot;
    }

    /**
     * Generate consolidated insights from evidences
     */
    private generateInsights(
        allEvidences: ExternalEvidence[],
        evidences: any
    ): ConsolidatedInsight[] {
        const insights: ConsolidatedInsight[] = [];

        // Insight 1: Performance Feedback Loop
        const feedbackIssues = evidences.user_feedback.flatMap((e: any) => 
            Array.isArray(e.data) ? e.data : []
        ).filter((f: any) => 
            (f.type === 'bug' || f.type === 'complaint') && 
            (f.tags?.includes('performance') || f.content?.includes('slow') || f.content?.includes('cache'))
        );

        const incidents = evidences.incidents.flatMap((e: any) => 
            Array.isArray(e.data) ? e.data : []
        ).filter((i: any) => i.affectedComponents?.includes('cache') || i.rootCause?.includes('cache'));

        if (feedbackIssues.length > 0 || incidents.length > 0) {
            insights.push({
                id: `insight-${Date.now()}-1`,
                title: 'Performance Feedback Loop Detected',
                description: 'Users report performance issues (slow loading, cache problems) that correlate with active incidents involving cache invalidation failures. This suggests technical decisions around caching infrastructure should be prioritized.',
                category: 'performance',
                confidence: 0.85,
                evidenceIds: [
                    ...feedbackIssues.map((f: any) => f.id).filter(Boolean),
                    ...incidents.map((i: any) => i.id).filter(Boolean)
                ],
                recommendation: 'Accelerate resolution of cache-related incidents and implement proactive cache warming strategies.',
                priority: 'high'
            });
        }

        // Insight 2: Infrastructure Scaling Readiness
        const metrics = evidences.product_metrics.flatMap((e: any) => 
            Array.isArray(e.data) ? e.data : [e.data]
        );

        const hasGoodUptime = metrics.some((m: any) => m.KPIs?.uptime && m.KPIs.uptime >= 99.9);
        const hasReasonableCosts = metrics.some((m: any) => m.costs?.total && m.costs.total < 5000);

        if (hasGoodUptime && hasReasonableCosts) {
            insights.push({
                id: `insight-${Date.now()}-2`,
                title: 'Infrastructure Scaling Readiness',
                description: 'Current infrastructure metrics indicate healthy operations (99.9% uptime, optimized costs). As SOC2 certification progresses and market trends point to AI observability adoption, the system is well-positioned for scaling.',
                category: 'scaling',
                confidence: 0.75,
                evidenceIds: evidences.product_metrics.map((e: any) => e.id),
                recommendation: 'Evaluate AI observability platforms to support SOC2 audit while maintaining competitive positioning.',
                priority: 'medium'
            });
        }

        // Insight 3: Technology Migration Opportunity
        const marketSignals = evidences.market_signals.flatMap((e: any) => 
            Array.isArray(e.data) ? e.data : []
        ).filter((m: any) => 
            m.category === 'technology' && 
            (m.confidence_score || m.relevance_score) > 0.8
        );

        if (marketSignals.length > 0) {
            insights.push({
                id: `insight-${Date.now()}-3`,
                title: 'Technology Migration Opportunity',
                description: 'Market trends indicate migration opportunities (e.g., Node.js to Bun for serverless). Current performance metrics are strong, suggesting any migration should focus on optimization.',
                category: 'migration',
                confidence: 0.80,
                evidenceIds: [
                    ...evidences.market_signals.map((e: any) => e.id),
                    ...evidences.product_metrics.map((e: any) => e.id)
                ],
                recommendation: 'Conduct feasibility study for emerging technologies with focus on performance optimization.',
                priority: 'medium'
            });
        }

        return insights;
    }

    /**
     * Load existing snapshot
     */
    public loadSnapshot(): ContextSnapshot | null {
        if (!fs.existsSync(this.snapshotPath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(this.snapshotPath, 'utf-8');
            return JSON.parse(content) as ContextSnapshot;
        } catch (error) {
            return null;
        }
    }

    /**
     * Get snapshot file path
     */
    public getSnapshotPath(): string {
        return this.snapshotPath;
    }
}

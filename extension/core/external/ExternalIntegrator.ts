/**
 * ExternalIntegrator - Level 6
 * 
 * Collects, normalizes, and injects external evidence into RBOM
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExternalEvidence, ExternalEvidenceType, ProductMetrics, UserFeedback, ComplianceRequirement, MarketSignal, Incident } from './types';

export interface ExternalSyncStatus {
    source: string;
    lastSync: string | null;
    evidenceCount: number;
    status: 'success' | 'error' | 'not_configured';
    error?: string;
}

export class ExternalIntegrator {
    private workspaceRoot: string;
    private externalDir: string;
    private ledgerPath: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.externalDir = path.join(workspaceRoot, '.reasoning', 'external');
        this.ledgerPath = path.join(this.externalDir, 'ledger.jsonl');
        
        if (!fs.existsSync(this.externalDir)) {
            fs.mkdirSync(this.externalDir, { recursive: true });
        }
    }

    /**
     * Sync all external sources
     */
    public async syncAll(): Promise<ExternalSyncStatus[]> {
        const results: ExternalSyncStatus[] = [];
        
        // Sync each source
        results.push(await this.syncMetrics());
        results.push(await this.syncFeedback());
        results.push(await this.syncCompliance());
        results.push(await this.syncMarketSignals());
        results.push(await this.syncIncidents());
        
        return results;
    }

    /**
     * Sync product metrics
     */
    public async syncMetrics(): Promise<ExternalSyncStatus> {
        try {
            const metricsFile = path.join(this.externalDir, 'metrics.json');
            
            if (!fs.existsSync(metricsFile)) {
                return {
                    source: 'metrics',
                    lastSync: null,
                    evidenceCount: 0,
                    status: 'not_configured'
                };
            }
            
            const data = JSON.parse(fs.readFileSync(metricsFile, 'utf-8'));
            const evidence = this.createEvidence('product_metric', 'metrics.json', data);
            
            await this.appendToLedger(evidence);
            
            return {
                source: 'metrics',
                lastSync: new Date().toISOString(),
                evidenceCount: 1,
                status: 'success'
            };
        } catch (error) {
            return {
                source: 'metrics',
                lastSync: null,
                evidenceCount: 0,
                status: 'error',
                error: String(error)
            };
        }
    }

    /**
     * Sync user feedback
     */
    public async syncFeedback(): Promise<ExternalSyncStatus> {
        try {
            const feedbackFile = path.join(this.externalDir, 'feedback.json');
            
            if (!fs.existsSync(feedbackFile)) {
                return {
                    source: 'feedback',
                    lastSync: null,
                    evidenceCount: 0,
                    status: 'not_configured'
                };
            }
            
            const feedbacks = JSON.parse(fs.readFileSync(feedbackFile, 'utf-8'));
            const count = Array.isArray(feedbacks) ? feedbacks.length : 1;
            
            const evidence = this.createEvidence('user_feedback', 'feedback.json', feedbacks);
            await this.appendToLedger(evidence);
            
            return {
                source: 'feedback',
                lastSync: new Date().toISOString(),
                evidenceCount: count,
                status: 'success'
            };
        } catch (error) {
            return {
                source: 'feedback',
                lastSync: null,
                evidenceCount: 0,
                status: 'error',
                error: String(error)
            };
        }
    }

    /**
     * Sync compliance requirements
     */
    public async syncCompliance(): Promise<ExternalSyncStatus> {
        try {
            const complianceFile = path.join(this.externalDir, 'compliance.json');
            
            if (!fs.existsSync(complianceFile)) {
                return {
                    source: 'compliance',
                    lastSync: null,
                    evidenceCount: 0,
                    status: 'not_configured'
                };
            }
            
            const requirements = JSON.parse(fs.readFileSync(complianceFile, 'utf-8'));
            const count = Array.isArray(requirements) ? requirements.length : 1;
            
            const evidence = this.createEvidence('compliance_requirement', 'compliance.json', requirements);
            await this.appendToLedger(evidence);
            
            return {
                source: 'compliance',
                lastSync: new Date().toISOString(),
                evidenceCount: count,
                status: 'success'
            };
        } catch (error) {
            return {
                source: 'compliance',
                lastSync: null,
                evidenceCount: 0,
                status: 'error',
                error: String(error)
            };
        }
    }

    /**
     * Sync market signals
     */
    public async syncMarketSignals(): Promise<ExternalSyncStatus> {
        try {
            const marketFile = path.join(this.externalDir, 'market_signals.json');
            
            if (!fs.existsSync(marketFile)) {
                return {
                    source: 'market',
                    lastSync: null,
                    evidenceCount: 0,
                    status: 'not_configured'
                };
            }
            
            const signals = JSON.parse(fs.readFileSync(marketFile, 'utf-8'));
            const count = Array.isArray(signals) ? signals.length : 1;
            
            const evidence = this.createEvidence('market_signal', 'market_signals.json', signals);
            await this.appendToLedger(evidence);
            
            return {
                source: 'market',
                lastSync: new Date().toISOString(),
                evidenceCount: count,
                status: 'success'
            };
        } catch (error) {
            return {
                source: 'market',
                lastSync: null,
                evidenceCount: 0,
                status: 'error',
                error: String(error)
            };
        }
    }

    /**
     * Sync incidents & post-mortems
     */
    public async syncIncidents(): Promise<ExternalSyncStatus> {
        try {
            const incidentsFile = path.join(this.externalDir, 'incidents.json');
            
            if (!fs.existsSync(incidentsFile)) {
                return {
                    source: 'incidents',
                    lastSync: null,
                    evidenceCount: 0,
                    status: 'not_configured'
                };
            }
            
            const incidents = JSON.parse(fs.readFileSync(incidentsFile, 'utf-8'));
            const count = Array.isArray(incidents) ? incidents.length : 1;
            
            const evidence = this.createEvidence('incident', 'incidents.json', incidents);
            await this.appendToLedger(evidence);
            
            return {
                source: 'incidents',
                lastSync: new Date().toISOString(),
                evidenceCount: count,
                status: 'success'
            };
        } catch (error) {
            return {
                source: 'incidents',
                lastSync: null,
                evidenceCount: 0,
                status: 'error',
                error: String(error)
            };
        }
    }

    /**
     * Create evidence from external data
     */
    private createEvidence(type: ExternalEvidenceType, source: string, data: any): ExternalEvidence {
        return {
            id: `ext-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type,
            source,
            timestamp: new Date().toISOString(),
            data,
            confidence: 0.8,
            version: '1.0'
        };
    }

    /**
     * Append evidence to ledger
     */
    private async appendToLedger(evidence: ExternalEvidence): Promise<void> {
        fs.appendFileSync(this.ledgerPath, JSON.stringify(evidence) + '\n');
    }

    /**
     * Get all external evidence from ledger
     */
    public getAllExternalEvidence(): ExternalEvidence[] {
        if (!fs.existsSync(this.ledgerPath)) {
            return [];
        }
        
        const lines = fs.readFileSync(this.ledgerPath, 'utf-8').split('\n').filter(l => l.trim());
        const evidences: ExternalEvidence[] = [];
        
        for (const line of lines) {
            try {
                const evidence = JSON.parse(line);
                evidences.push(evidence);
            } catch (error) {
                // Skip corrupted lines
            }
        }
        
        return evidences;
    }

    /**
     * Link external evidence to an ADR
     */
    public async linkToADR(adrId: string, evidenceIds: string[]): Promise<void> {
        const linkData = {
            adrId,
            evidenceIds,
            linkedAt: new Date().toISOString()
        };
        
        const linksFile = path.join(this.externalDir, 'adr_links.json');
        let links: any[] = [];
        
        if (fs.existsSync(linksFile)) {
            links = JSON.parse(fs.readFileSync(linksFile, 'utf-8'));
        }
        
        links.push(linkData);
        fs.writeFileSync(linksFile, JSON.stringify(links, null, 2));
    }
}


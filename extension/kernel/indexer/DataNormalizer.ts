/**
 * RL4 Data Normalizer
 * 
 * Assure la cohérence et la normalisation des données RL4:
 * 1. Timestamps ISO 8601 stricts
 * 2. Pattern IDs stables (SHA1 hash)
 * 3. Cycle IDs indexés dans forecasts
 * 4. ADRs active.json maintenu
 * 5. Log rotation quotidienne (optionnel)
 * 
 * À exécuter:
 * - Au démarrage (vérification)
 * - Après chaque cycle (maintenance)
 * - Sur demande (migration/cleanup)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';

export interface NormalizationReport {
    timestamp: string;
    actions_performed: string[];
    issues_found: number;
    issues_fixed: number;
    warnings: string[];
}

export class DataNormalizer {
    private workspaceRoot: string;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }
    
    /**
     * Run full normalization check and fix
     * À utiliser au démarrage ou sur demande
     */
    async normalize(): Promise<NormalizationReport> {
        const report: NormalizationReport = {
            timestamp: new Date().toISOString(),
            actions_performed: [],
            issues_found: 0,
            issues_fixed: 0,
            warnings: []
        };
        
        // 1. Normalize timestamps in patterns.json
        await this.normalizePatternTimestamps(report);
        
        // 2. Add stable pattern_id to patterns
        await this.addStablePatternIds(report);
        
        // 3. Index cycle_id in forecasts
        await this.indexCycleIdInForecasts(report);
        
        // 4. Maintain adrs/active.json
        await this.updateActiveADRs(report);
        
        // 5. Check log rotation (optional, just warn if needed)
        await this.checkLogRotation(report);
        
        return report;
    }
    
    /**
     * Task 1: Normalize timestamps to ISO 8601
     */
    private async normalizePatternTimestamps(report: NormalizationReport): Promise<void> {
        const patternsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'patterns.json');
        
        if (!fs.existsSync(patternsPath)) {
            return;
        }
        
        try {
            const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            let modified = false;
            
            if (patternsData.patterns) {
                for (const pattern of patternsData.patterns) {
                    // Check firstSeen and lastSeen timestamps
                    if (pattern.firstSeen && !this.isISO8601(pattern.firstSeen)) {
                        pattern.firstSeen = this.toISO8601(pattern.firstSeen);
                        modified = true;
                        report.issues_found++;
                        report.issues_fixed++;
                    }
                    
                    if (pattern.lastSeen && !this.isISO8601(pattern.lastSeen)) {
                        pattern.lastSeen = this.toISO8601(pattern.lastSeen);
                        modified = true;
                        report.issues_found++;
                        report.issues_fixed++;
                    }
                }
            }
            
            if (modified) {
                fs.writeFileSync(patternsPath, JSON.stringify(patternsData, null, 2));
                report.actions_performed.push('Normalized timestamps in patterns.json');
            }
        } catch (e) {
            report.warnings.push(`Failed to normalize pattern timestamps: ${e}`);
        }
    }
    
    /**
     * Task 2: Add stable pattern_id (SHA1 hash)
     */
    private async addStablePatternIds(report: NormalizationReport): Promise<void> {
        const patternsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'patterns.json');
        
        if (!fs.existsSync(patternsPath)) {
            return;
        }
        
        try {
            const patternsData = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            let modified = false;
            
            if (patternsData.patterns) {
                for (const pattern of patternsData.patterns) {
                    // If no stable pattern_id, or if using old format
                    if (!pattern.pattern_id || !pattern.pattern_id.startsWith('pattern-')) {
                        // Generate stable ID from pattern text
                        const hash = crypto.createHash('sha1')
                            .update(pattern.pattern)
                            .digest('hex')
                            .substring(0, 8);
                        
                        pattern.pattern_id = `pattern-${hash}`;
                        modified = true;
                        report.issues_found++;
                        report.issues_fixed++;
                    }
                }
            }
            
            if (modified) {
                fs.writeFileSync(patternsPath, JSON.stringify(patternsData, null, 2));
                report.actions_performed.push('Added stable pattern_id to patterns.json');
            }
        } catch (e) {
            report.warnings.push(`Failed to add stable pattern IDs: ${e}`);
        }
    }
    
    /**
     * Task 3: Index cycle_id in forecasts
     */
    private async indexCycleIdInForecasts(report: NormalizationReport): Promise<void> {
        const forecastsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'forecasts.json');
        const cyclesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'ledger', 'cycles.jsonl');
        
        if (!fs.existsSync(forecastsPath) || !fs.existsSync(cyclesPath)) {
            return;
        }
        
        try {
            const forecasts = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
            
            // Get last cycle ID
            const lines = fs.readFileSync(cyclesPath, 'utf-8').split('\n').filter(Boolean);
            const lastCycle = lines.length > 0 ? JSON.parse(lines[lines.length - 1]) : null;
            const cycleId = lastCycle?.cycleId || 0;
            
            let modified = false;
            
            if (Array.isArray(forecasts)) {
                for (const forecast of forecasts) {
                    if (!forecast.cycle_id) {
                        forecast.cycle_id = cycleId;
                        modified = true;
                        report.issues_found++;
                        report.issues_fixed++;
                    }
                }
            }
            
            if (modified) {
                fs.writeFileSync(forecastsPath, JSON.stringify(forecasts, null, 2));
                report.actions_performed.push(`Indexed cycle_id in forecasts.json (${cycleId})`);
            }
        } catch (e) {
            report.warnings.push(`Failed to index cycle_id in forecasts: ${e}`);
        }
    }
    
    /**
     * Task 4: Maintain adrs/active.json
     */
    private async updateActiveADRs(report: NormalizationReport): Promise<void> {
        const adrsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'adrs', 'auto');
        const activePath = path.join(this.workspaceRoot, '.reasoning_rl4', 'adrs', 'active.json');
        
        if (!fs.existsSync(adrsPath)) {
            return;
        }
        
        try {
            const adrFiles = fs.readdirSync(adrsPath).filter(f => f.startsWith('adr-'));
            
            const activeADRs = {
                generated_at: new Date().toISOString(),
                total: adrFiles.length,
                accepted: [] as any[],
                pending: [] as any[],
                rejected: [] as any[]
            };
            
            for (const file of adrFiles) {
                try {
                    const adr = JSON.parse(fs.readFileSync(path.join(adrsPath, file), 'utf-8'));
                    
                    const summary = {
                        id: adr.id,
                        title: adr.title,
                        status: adr.status,
                        confidence: adr.confidence,
                        createdAt: adr.createdAt,
                        modifiedAt: adr.modifiedAt
                    };
                    
                    if (adr.status === 'accepted') {
                        activeADRs.accepted.push(summary);
                    } else if (adr.status === 'rejected') {
                        activeADRs.rejected.push(summary);
                    } else {
                        activeADRs.pending.push(summary);
                    }
                } catch (e) {
                    report.warnings.push(`Failed to parse ADR ${file}: ${e}`);
                }
            }
            
            // Sort by modifiedAt (most recent first)
            const sortFn = (a: any, b: any) => 
                new Date(b.modifiedAt || b.createdAt).getTime() - 
                new Date(a.modifiedAt || a.createdAt).getTime();
            
            activeADRs.accepted.sort(sortFn);
            activeADRs.pending.sort(sortFn);
            activeADRs.rejected.sort(sortFn);
            
            fs.writeFileSync(activePath, JSON.stringify(activeADRs, null, 2));
            report.actions_performed.push(`Updated active.json (${activeADRs.total} ADRs tracked)`);
            
        } catch (e) {
            report.warnings.push(`Failed to update active ADRs: ${e}`);
        }
    }
    
    /**
     * Task 5: Check if log rotation is needed
     */
    private async checkLogRotation(report: NormalizationReport): Promise<void> {
        const cyclesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'ledger', 'cycles.jsonl');
        
        if (!fs.existsSync(cyclesPath)) {
            return;
        }
        
        try {
            const stats = fs.statSync(cyclesPath);
            const sizeMB = stats.size / 1024 / 1024;
            
            // Warn if > 10 MB
            if (sizeMB > 10) {
                report.warnings.push(
                    `cycles.jsonl is ${sizeMB.toFixed(1)} MB. Consider log rotation (run 'RL4: Archive Old Cycles')`
                );
            }
            
            report.actions_performed.push(`Checked log rotation (cycles.jsonl: ${sizeMB.toFixed(1)} MB)`);
        } catch (e) {
            report.warnings.push(`Failed to check log rotation: ${e}`);
        }
    }
    
    // Helpers
    
    private isISO8601(timestamp: string): boolean {
        // Check if matches ISO 8601 format (YYYY-MM-DDTHH:mm:ss.sssZ or +HH:MM)
        const iso8601Regex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?(Z|[+-]\d{2}:\d{2})$/;
        return iso8601Regex.test(timestamp);
    }
    
    private toISO8601(timestamp: string): string {
        try {
            const date = new Date(timestamp);
            if (isNaN(date.getTime())) {
                // Invalid date, return current time
                return new Date().toISOString();
            }
            return date.toISOString();
        } catch (e) {
            return new Date().toISOString();
        }
    }
}


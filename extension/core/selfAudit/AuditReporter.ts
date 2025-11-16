import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { TelemetryData } from './AuditDataCollector';
import * as vscode from 'vscode';

export interface AuditResult {
    convergenceStatus: 'converged' | 'in-progress' | 'early';
    confidence: number;
    biasIndex: number;
    recommendation: string;
}

/**
 * Generates ADR and markdown reports for self-audit results
 */
export class AuditReporter {
    constructor(private workspaceRoot: string) {}

    /**
     * Generate ADR-SELF for self-audit results
     */
    public async generateADR(telemetry: TelemetryData, audit: AuditResult): Promise<string> {
        try {
            // ⊘ Safety check: ensure workspaceRoot is defined
            if (!this.workspaceRoot) {
                throw new Error('workspaceRoot is undefined');
            }

            const adrDir = path.join(this.workspaceRoot, '.reasoning', 'adrs');
            if (!fs.existsSync(adrDir)) {
                fs.mkdirSync(adrDir, { recursive: true });
            }

            const adrId = uuidv4().substring(0, 8).toUpperCase();
            const adrPath = path.join(adrDir, `ADR-SELF-${adrId}.json`);

            // ⊘ Safety check: ensure adrPath is valid
            if (!adrPath) {
                throw new Error('adrPath is undefined');
            }

            const adr = {
                id: `ADR-SELF-${adrId}`,
                title: `Self-Audit Cycle – ${audit.convergenceStatus === 'converged' ? 'Migration Convergence Achieved' : 'Ongoing Analysis'}`,
                created: new Date().toISOString(),
                context: {
                    total_commands: telemetry.totalCommands,
                    legacy_redirects: telemetry.legacyRedirects,
                    redirect_percentage: telemetry.redirectPercentage.toFixed(2),
                    confidence_avg: audit.confidence.toFixed(2),
                    bias_index: audit.biasIndex.toFixed(2),
                    cycles_completed: telemetry.totalCycles,
                    patterns_detected: telemetry.patternsDetected,
                    correlations_detected: telemetry.correlationsDetected
                },
                decision: this.generateDecision(audit, telemetry),
                consequences: audit.recommendation,
                confidence: audit.confidence,
                status: 'proposed',
                tags: ['self-audit', 'meta-cognition', 'architecture-evolution']
            };

            fs.writeFileSync(adrPath, JSON.stringify(adr, null, 2));
            return adrPath;
        } catch (error) {
            console.error(`❌ AuditReporter.generateADR failed: ${error}`);
            throw error;
        }
    }

    /**
     * Generate markdown report
     */
    public async generateReport(telemetry: TelemetryData, audit: AuditResult): Promise<string> {
        try {
            // ⊘ Safety check: ensure workspaceRoot is defined
            if (!this.workspaceRoot) {
                throw new Error('workspaceRoot is undefined');
            }

            const reportsDir = path.join(this.workspaceRoot, '.reasoning', 'reports');
            if (!fs.existsSync(reportsDir)) {
                fs.mkdirSync(reportsDir, { recursive: true });
            }

            const reportPath = path.join(reportsDir, 'self-audit.md');

            // ⊘ Safety check: ensure reportPath is valid
            if (!reportPath) {
                throw new Error('reportPath is undefined');
            }
        
        const avgConfidence = telemetry.confidenceHistory.length > 0
            ? (telemetry.confidenceHistory.reduce((a, b) => a + b, 0) / telemetry.confidenceHistory.length)
            : 0;

        const md = `# 🧠 Reasoning Layer – Self-Audit Summary
**Date:** ${new Date().toISOString()}  
**Version:** 1.0.49  
**Cycle:** ${telemetry.totalCycles}

---

## 📊 Metrics

- **Total Commands Used:** ${telemetry.totalCommands}  
- **Legacy Redirects:** ${telemetry.legacyRedirects} (${telemetry.redirectPercentage.toFixed(1)}%)  
- **Average Confidence:** ${avgConfidence.toFixed(2)}  
- **Reasoning Bias Index:** ${audit.biasIndex.toFixed(2)}  
- **Average Cycle Duration:** ${telemetry.avgCycleDuration.toFixed(1)}s  
- **Patterns Detected:** ${telemetry.patternsDetected}  
- **Correlations Detected:** ${telemetry.correlationsDetected}  
- **Forecasts Generated:** ${telemetry.forecastsGenerated}  

---

## 🧭 Analysis

${this.generateAnalysis(audit, telemetry)}

---

## 🔮 Forecast

${audit.recommendation}

---

## 🧾 Summary

→ ADR-SELF generated  
→ Status: **${audit.convergenceStatus}**  
→ Confidence: **${audit.confidence.toFixed(2)}**
`;

            fs.writeFileSync(reportPath, md);
            return reportPath;
        } catch (error) {
            console.error(`❌ AuditReporter.generateReport failed: ${error}`);
            throw error;
        }
    }

    /**
     * Generate decision text
     */
    private generateDecision(audit: AuditResult, telemetry: TelemetryData): string {
        if (audit.convergenceStatus === 'converged') {
            return 'Legacy migration marked as converged. Maintain redirect system in passive mode.';
        } else if (audit.convergenceStatus === 'in-progress') {
            return `Ongoing migration detected. ${telemetry.legacyRedirects} legacy redirects active.`;
        } else {
            return 'Early stage detected. Insufficient data for convergence assessment.';
        }
    }

    /**
     * Generate analysis text
     */
    private generateAnalysis(audit: AuditResult, telemetry: TelemetryData): string {
        let analysis = '';
        
        if (audit.convergenceStatus === 'converged') {
            analysis += '✅ Migration convergence detected\n';
        } else if (telemetry.legacyRedirects < 5) {
            analysis += '✅ Low legacy usage - migration successful\n';
        }
        
        analysis += `⚙️ Stability across cognitive groups\n`;
        analysis += `🔄 Autopilot cycles: ${telemetry.totalCycles}\n`;
        
        return analysis;
    }
}


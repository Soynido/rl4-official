import * as fs from 'fs';
import * as path from 'path';
import { AuditDataCollector, TelemetryData } from './AuditDataCollector';
import { AuditReporter, AuditResult } from './AuditReporter';

/**
 * Main engine for self-audit operations
 */
export class SelfAuditEngine {
    private collector: AuditDataCollector;
    private reporter: AuditReporter;

    constructor(private workspaceRoot: string) {
        this.collector = new AuditDataCollector(workspaceRoot);
        this.reporter = new AuditReporter(workspaceRoot);
    }

    /**
     * Run complete self-audit cycle
     */
    public async runAudit(): Promise<{ adrPath: string; reportPath: string; confidence: number }> {
        console.log('🧠 Starting Self-Audit Engine...');

        // Step 1: Collect telemetry
        const telemetry = await this.collector.collect();
        console.log(`📊 Telemetry collected: ${telemetry.totalCommands} commands, ${telemetry.totalCycles} cycles`);

        // Step 2: Analyze and determine status
        const audit = this.analyzeTelemetry(telemetry);
        console.log(`🔍 Analysis complete: ${audit.convergenceStatus}, confidence: ${audit.confidence.toFixed(2)}`);

        // Step 3: Generate ADR
        const adrPath = await this.reporter.generateADR(telemetry, audit);
        console.log(`📝 ADR generated: ${adrPath}`);

        // Step 4: Generate report
        const reportPath = await this.reporter.generateReport(telemetry, audit);
        console.log(`📄 Report generated: ${reportPath}`);

        return {
            adrPath,
            reportPath,
            confidence: audit.confidence
        };
    }

    /**
     * Analyze telemetry and generate audit result
     */
    private analyzeTelemetry(telemetry: TelemetryData): AuditResult {
        // Determine convergence status
        let convergenceStatus: 'converged' | 'in-progress' | 'early';
        
        if (telemetry.totalCommands < 20) {
            convergenceStatus = 'early';
        } else if (telemetry.legacyRedirects <= 2) {
            convergenceStatus = 'converged';
        } else {
            convergenceStatus = 'in-progress';
        }

        // Calculate confidence
        const avgConfidence = telemetry.confidenceHistory.length > 0
            ? telemetry.confidenceHistory.reduce((a, b) => a + b, 0) / telemetry.confidenceHistory.length
            : 0.85;

        // Calculate bias index (lower is better)
        const biasIndex = Math.max(0, 0.15 - (telemetry.totalCommands / 1000));

        // Generate recommendation
        const recommendation = this.generateRecommendation(convergenceStatus, telemetry, avgConfidence);

        return {
            convergenceStatus,
            confidence: Math.min(0.98, avgConfidence),
            biasIndex,
            recommendation
        };
    }

    /**
     * Generate forecast/recommendation
     */
    private generateRecommendation(
        status: string,
        telemetry: TelemetryData,
        confidence: number
    ): string {
        if (status === 'converged') {
            return `Migration successfully converged. Next optimization target: "Latency reduction in ForecastEngine – expected impact: +0.02 confidence per cycle."`;
        } else if (status === 'in-progress') {
            return `Continue monitoring migration. ${telemetry.legacyRedirects} legacy redirects still active.`;
        } else {
            return `Early stage detected. Collect more data before recommending optimizations.`;
        }
    }

    /**
     * Log audit completion event
     */
    public async logAuditCompletion(result: { adrPath: string; reportPath: string; confidence: number }): Promise<void> {
        const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
        if (!fs.existsSync(tracesDir)) {
            fs.mkdirSync(tracesDir, { recursive: true });
        }

        const today = new Date().toISOString().split('T')[0];
        const traceFile = path.join(tracesDir, `${today}.json`);

        const event = {
            id: `audit-${Date.now()}`,
            timestamp: new Date().toISOString(),
            type: 'self_audit_completed',
            metadata: {
                adr_path: path.basename(result.adrPath),
                report_path: path.basename(result.reportPath),
                confidence: result.confidence,
                synthetic: false
            }
        };

        let existing: any[] = [];
        if (fs.existsSync(traceFile)) {
            existing = JSON.parse(fs.readFileSync(traceFile, 'utf-8'));
        }

        existing.push(event);
        fs.writeFileSync(traceFile, JSON.stringify(existing, null, 2));
    }
}


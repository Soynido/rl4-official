import * as fs from 'fs';
import * as path from 'path';

export interface TelemetryData {
    totalCommands: number;
    legacyRedirects: number;
    redirectPercentage: number;
    confidenceHistory: number[];
    biasDetectionCount: number;
    patternsDetected: number;
    correlationsDetected: number;
    forecastsGenerated: number;
    avgCycleDuration: number;
    totalCycles: number;
}

/**
 * Collects telemetry data from reasoning traces and memory
 */
export class AuditDataCollector {
    constructor(private workspaceRoot: string) {}

    /**
     * Collect all telemetry from .reasoning/ directory
     */
    public async collect(): Promise<TelemetryData> {
        const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
        const patternsPath = path.join(this.workspaceRoot, '.reasoning', 'patterns.json');
        const correlationsPath = path.join(this.workspaceRoot, '.reasoning', 'correlations.json');
        const forecastsPath = path.join(this.workspaceRoot, '.reasoning', 'forecasts.json');

        // Collect events from traces
        const allEvents = this.collectTraceEvents(tracesDir);
        
        // Count command types
        const totalCommands = allEvents.filter(e => e.type === 'command_triggered' || e.type === 'command_redirected').length;
        const legacyRedirects = allEvents.filter(e => e.type === 'command_redirected').length;
        
        // Extract confidence history
        const confidenceHistory = allEvents
            .filter(e => e.metadata?.confidence)
            .map(e => e.metadata.confidence as number)
            .slice(-10); // Last 10 confidence values
        
        // Count biases detected
        const biasDetectionCount = allEvents.filter(e => e.type === 'bias_detected').length;

        // Load pattern/correlation/forecast counts
        let patternsDetected = 0;
        let correlationsDetected = 0;
        let forecastsGenerated = 0;

        if (fs.existsSync(patternsPath)) {
            const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            patternsDetected = patterns.patterns?.length || 0;
        }

        if (fs.existsSync(correlationsPath)) {
            const correlations = JSON.parse(fs.readFileSync(correlationsPath, 'utf-8'));
            correlationsDetected = correlations.correlations?.length || 0;
        }

        if (fs.existsSync(forecastsPath)) {
            const forecasts = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
            forecastsGenerated = forecasts.forecasts?.length || 0;
        }

        // Calculate cycle metrics
        const cycleEvents = allEvents.filter(e => e.type === 'autopilot_completed');
        const totalCycles = cycleEvents.length;
        const avgCycleDuration = this.calculateAvgCycleDuration(cycleEvents);

        return {
            totalCommands,
            legacyRedirects,
            redirectPercentage: totalCommands > 0 ? (legacyRedirects / totalCommands) * 100 : 0,
            confidenceHistory,
            biasDetectionCount,
            patternsDetected,
            correlationsDetected,
            forecastsGenerated,
            avgCycleDuration,
            totalCycles
        };
    }

    /**
     * Collect all events from trace files
     */
    private collectTraceEvents(tracesDir: string): any[] {
        if (!fs.existsSync(tracesDir)) {
            return [];
        }

        const files = fs.readdirSync(tracesDir).filter(f => f.endsWith('.json'));
        const allEvents: any[] = [];

        for (const file of files) {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(tracesDir, file), 'utf-8'));
                if (Array.isArray(content)) {
                    allEvents.push(...content);
                }
            } catch (error) {
                console.warn(`Failed to read trace file ${file}:`, error);
            }
        }

        return allEvents;
    }

    /**
     * Calculate average cycle duration
     */
    private calculateAvgCycleDuration(cycleEvents: any[]): number {
        if (cycleEvents.length === 0) return 0;

        const durations = cycleEvents
            .map(e => parseFloat(e.metadata?.duration || 0))
            .filter(d => d > 0);

        if (durations.length === 0) return 0;
        
        return durations.reduce((a, b) => a + b, 0) / durations.length;
    }
}


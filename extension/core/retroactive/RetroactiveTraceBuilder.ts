import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { GitHistoryScanner, GitCommit } from './scanners/GitHistoryScanner';
import { DiffAnalyzer } from './scanners/DiffAnalyzer';
import { EventSynthesizer, SyntheticEvent } from './synthesizers/EventSynthesizer';
import { PatternInferencer, RetroactivePattern } from './synthesizers/PatternInferencer';

export interface RetroactiveConfig {
    maxCommits: number;
    minLinesChanged: number;
    confidenceBaseline: number;
    generateADRs: boolean;
}

export interface ReconstructionResult {
    commitsAnalyzed: number;
    eventsGenerated: number;
    patternsDetected: number;
    adrsCreated: number;
    averageConfidence: number;
    summary: string;
}

/**
 * RetroactiveTraceBuilder - Reconstructs historical memory from Git
 */
export class RetroactiveTraceBuilder {
    private config: RetroactiveConfig;

    constructor(
        private workspaceRoot: string,
        config?: Partial<RetroactiveConfig>
    ) {
        this.config = {
            maxCommits: 1000,
            minLinesChanged: 5,
            confidenceBaseline: 0.7,
            generateADRs: true,
            ...config
        };
    }

    /**
     * Check if reconstruction is needed (no existing traces)
     */
    public async shouldReconstruct(): Promise<boolean> {
        const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
        
        if (!fs.existsSync(tracesDir)) {
            return true;
        }
        
        const files = fs.readdirSync(tracesDir);
        const traceFiles = files.filter(f => f.endsWith('.json'));
        
        // Check if any trace file has events
        for (const file of traceFiles) {
            const filePath = path.join(tracesDir, file);
            const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
            
            if (Array.isArray(content) && content.length > 0) {
                // Has real events, no need to reconstruct
                return false;
            }
        }
        
        // No real events found, reconstruction needed
        return true;
    }

    /**
     * Reconstruct historical memory from Git
     */
    public async reconstruct(): Promise<ReconstructionResult> {
        console.log('🧠 Starting retroactive trace reconstruction...');

        // Step 1: Scan Git history
        const scanner = new GitHistoryScanner(this.workspaceRoot, {
            maxCommits: this.config.maxCommits,
            skipMerges: true,
            minLinesChanged: this.config.minLinesChanged
        });

        const commits = await scanner.scanHistory();
        console.log(`📊 Scanned ${commits.length} commits from Git history`);

        // Step 2: Synthesize events
        const eventSynthesizer = new EventSynthesizer();
        const events = eventSynthesizer.synthesizeEvents(commits);
        console.log(`🎭 Generated ${events.length} synthetic events`);

        // Step 3: Infer patterns
        const patternInferencer = new PatternInferencer();
        const patterns = patternInferencer.inferPatterns(events);
        console.log(`🔍 Detected ${patterns.length} patterns`);

        // Step 4: Save synthetic events
        const eventsByDate = eventSynthesizer.groupEventsByDate(events);
        await this.saveEvents(eventsByDate);

        // Step 5: Save patterns
        await this.savePatterns(patterns);

        // Step 6: Calculate average confidence
        const avgConfidence = events.reduce((sum, e) => sum + e.metadata.confidence, 0) / events.length;

        const result: ReconstructionResult = {
            commitsAnalyzed: commits.length,
            eventsGenerated: events.length,
            patternsDetected: patterns.length,
            adrsCreated: 0, // TODO: Implement ADR generation
            averageConfidence: avgConfidence,
            summary: this.generateSummary(commits.length, events.length, patterns.length, avgConfidence)
        };

        console.log('✅ Retroactive reconstruction complete');
        console.log(result.summary);

        return result;
    }

    /**
     * Save synthetic events to traces directory
     */
    private async saveEvents(eventsByDate: Map<string, SyntheticEvent[]>): Promise<void> {
        const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
        
        if (!fs.existsSync(tracesDir)) {
            fs.mkdirSync(tracesDir, { recursive: true });
        }

        for (const [date, events] of eventsByDate.entries()) {
            const filePath = path.join(tracesDir, `${date}.json`);
            
            // If file exists, merge (but mark existing as real)
            if (fs.existsSync(filePath)) {
                const existing = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                events.push(...existing); // Prepend synthetic events
            }
            
            fs.writeFileSync(filePath, JSON.stringify(events, null, 2));
        }
    }

    /**
     * Save retroactive patterns
     */
    private async savePatterns(patterns: RetroactivePattern[]): Promise<void> {
        const patternsFile = path.join(this.workspaceRoot, '.reasoning', 'patterns.json');
        
        let existingPatterns: any[] = [];
        if (fs.existsSync(patternsFile)) {
            const content = JSON.parse(fs.readFileSync(patternsFile, 'utf-8'));
            existingPatterns = content.patterns || [];
        }

        // Merge retroactive patterns with existing
        const allPatterns = [...existingPatterns, ...patterns];
        
        fs.writeFileSync(patternsFile, JSON.stringify({
            patterns: allPatterns,
            generated_at: new Date().toISOString(),
            version: "1.0",
            synthetic: patterns.length > 0
        }, null, 2));
    }

    /**
     * Generate summary message
     */
    private generateSummary(
        commits: number,
        events: number,
        patterns: number,
        confidence: number
    ): string {
        return `🧠 RetroactiveTraceBuilder Summary
Commits analysés: ${commits}
Événements générés: ${events}
Patterns détectés: ${patterns}
Confiance moyenne: ${(confidence * 100).toFixed(1)}%`;
    }
}


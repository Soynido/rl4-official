import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';
import { RetroactiveTraceBuilder } from '../retroactive/RetroactiveTraceBuilder';
import { UnifiedLogger } from '../UnifiedLogger';

/**
 * CognitiveRebuilder - Full autonomous cognitive reconstruction
 * Orchestrates complete memory rebuild, reanalysis, and repository documentation
 */
export class CognitiveRebuilder {
    private workspaceRoot: string;
    private logger: UnifiedLogger;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.logger = UnifiedLogger.getInstance();
    }

    /**
     * Execute full cognitive reconstruction sequence
     */
    public async executeFullRebuild(): Promise<void> {
        this.log('🔄 Starting full cognitive reconstruction...');
        this.log('');

        try {
            // STEP 1: Retroactive Memory Reconstruction
            const retroResult = await this.reconstructMemory();

            // STEP 2: Reanalyze & Synthesize
            const analysisResult = await this.reanalyze();

            // STEP 3: Update README
            await this.updateReadme(retroResult, analysisResult);

            // STEP 4: Finalize & Persist
            await this.finalize(retroResult, analysisResult);

            this.log('');
            this.log('✅ Full cognitive reconstruction complete!');
            vscode.window.showInformationMessage(
                `✅ Cognitive reconstruction complete: ${retroResult.commitsAnalyzed} commits, ${retroResult.patternsDetected} patterns`
            );

        } catch (error) {
            this.log(`❌ Reconstruction failed: ${error}`);
            vscode.window.showErrorMessage(`Cognitive reconstruction failed: ${error}`);
            throw error;
        }
    }

    /**
     * STEP 1: Retroactive Memory Reconstruction
     */
    private async reconstructMemory() {
        this.log('🔁 STEP 1: Retroactive Memory Reconstruction');
        this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const builder = new RetroactiveTraceBuilder(this.workspaceRoot, {
            maxCommits: 2000,
            minLinesChanged: 5,
            confidenceBaseline: 0.7,
            generateADRs: true
        });

        const result = await builder.reconstruct();

        this.log(`✅ Commits analyzed: ${result.commitsAnalyzed}`);
        this.log(`✅ Events generated: ${result.eventsGenerated}`);
        this.log(`✅ Patterns detected: ${result.patternsDetected}`);
        this.log(`✅ Average confidence: ${(result.averageConfidence * 100).toFixed(1)}%`);
        this.log('');

        return result;
    }

    /**
     * STEP 2: Reanalyze & Synthesize
     */
    private async reanalyze() {
        this.log('🧠 STEP 2: Reanalyze & Synthesize');
        this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Load patterns
        const patternsPath = path.join(this.workspaceRoot, '.reasoning', 'patterns.json');
        let patterns = [];
        
        if (fs.existsSync(patternsPath)) {
            const content = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
            patterns = content.patterns || [];
        }

        // Load correlations
        const correlationsPath = path.join(this.workspaceRoot, '.reasoning', 'correlations.json');
        let correlations = [];
        
        if (fs.existsSync(correlationsPath)) {
            const content = JSON.parse(fs.readFileSync(correlationsPath, 'utf-8'));
            correlations = content.correlations || [];
        }

        // Generate forecasts
        const forecastsPath = path.join(this.workspaceRoot, '.reasoning', 'forecasts.json');
        let forecasts = [];
        
        if (fs.existsSync(forecastsPath)) {
            const content = JSON.parse(fs.readFileSync(forecastsPath, 'utf-8'));
            forecasts = content.forecasts || [];
        }

        // Calculate confidence
        const confidence = this.calculateConfidence(patterns, correlations, forecasts);

        this.log(`✅ Patterns loaded: ${patterns.length}`);
        this.log(`✅ Correlations loaded: ${correlations.length}`);
        this.log(`✅ Forecasts loaded: ${forecasts.length}`);
        this.log(`✅ Confidence: ${(confidence * 100).toFixed(1)}%`);
        this.log('');

        return {
            patterns: patterns.length,
            correlations: correlations.length,
            forecasts: forecasts.length,
            confidence
        };
    }

    /**
     * STEP 3: Update README
     */
    private async updateReadme(retroResult: any, analysisResult: any) {
        this.log('📖 STEP 3: Update README.md');
        this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        const readmePath = path.join(this.workspaceRoot, 'README.md');
        
        let content = '';
        if (fs.existsSync(readmePath)) {
            content = fs.readFileSync(readmePath, 'utf-8');
            // Remove existing cognitive summary if present
            content = content.replace(/## 🧠 Reasoning Layer — Cognitive Summary[\s\S]*?(?=##|$)/, '');
        } else {
            content = '# ' + path.basename(this.workspaceRoot) + '\n\n';
        }

        // Add cognitive summary
        const summary = this.generateCognitiveSummary(retroResult, analysisResult);
        content = content.trim() + '\n\n' + summary;

        fs.writeFileSync(readmePath, content);
        this.log('✅ README.md updated');
        this.log('');

        // Auto-commit if GitHub integration is active
        await this.autoCommitReadme();
    }

    /**
     * STEP 4: Finalize & Persist
     */
    private async finalize(retroResult: any, analysisResult: any) {
        this.log('🔐 STEP 4: Finalize & Persist');
        this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Update current-context.json
        const contextPath = path.join(this.workspaceRoot, '.reasoning', 'current-context.json');
        const context = {
            confidence: analysisResult.confidence,
            summary: `Reconstructed: ${retroResult.commitsAnalyzed} commits, ${retroResult.patternsDetected} patterns`,
            last_reconstruction: new Date().toISOString(),
            cycles: retroResult.commitsAnalyzed
        };
        fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

        // Update manifest
        const manifestPath = path.join(this.workspaceRoot, '.reasoning', 'manifest.json');
        if (fs.existsSync(manifestPath)) {
            const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf-8'));
            manifest.history_policy = 'reconstructed';
            manifest.last_reconstruction = new Date().toISOString();
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
        }

        this.log('✅ Context updated');
        this.log('✅ Manifest updated');
        this.log('');
        this.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    }

    /**
     * Generate cognitive summary for README
     */
    private generateCognitiveSummary(retroResult: any, analysisResult: any): string {
        const today = new Date().toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });

        return `## 🧠 Reasoning Layer — Cognitive Summary

**Last update:** ${today}  
**Total commits analyzed:** ${retroResult.commitsAnalyzed}  
**Patterns detected:** ${analysisResult.patterns}  
**Correlations detected:** ${analysisResult.correlations}  
**Forecasts generated:** ${analysisResult.forecasts}  
**Forecast confidence:** ${(analysisResult.confidence * 100).toFixed(1)}%

---

This repository is actively monitored by **Reasoning Layer V3** — a cognitive system that learns from its own history through autonomous pattern detection, correlation analysis, and forecast generation.

**Key Capabilities:**
- 🔄 **Retroactive Memory**: Reconstructs historical context from Git commits
- 🧩 **Pattern Learning**: Detects recurring architectural and development patterns
- 🔗 **Correlation Analysis**: Identifies relationships between events and decisions
- 🔮 **Predictive Forecasting**: Anticipates future architectural evolution
- 🤖 **Autonomous Evolution**: Continuously improves through self-analysis

The Reasoning Layer operates transparently in the background, creating a cognitive memory of your project's evolution.`;
    }

    /**
     * Calculate overall confidence
     */
    private calculateConfidence(patterns: any[], correlations: any[], forecasts: any[]): number {
        // Base confidence from data volume
        let confidence = 0.5;
        
        if (patterns.length > 0) confidence += 0.1;
        if (correlations.length > 0) confidence += 0.1;
        if (forecasts.length > 0) confidence += 0.1;
        
        // Boost from pattern diversity
        if (patterns.length > 5) confidence += 0.1;
        if (correlations.length > 10) confidence += 0.1;
        
        return Math.min(0.95, confidence);
    }

    /**
     * Auto-commit README update
     */
    private async autoCommitReadme(): Promise<void> {
        try {
            const tokenPath = path.join(this.workspaceRoot, '.reasoning', 'security', 'github.json');
            if (!fs.existsSync(tokenPath)) {
                this.log('ℹ️  GitHub integration not active, skipping auto-commit');
                return;
            }

            // Check git status
            const gitStatus = execSync('git status --porcelain README.md', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            }).trim();

            if (gitStatus.includes('README.md')) {
                execSync('git add README.md', { cwd: this.workspaceRoot });
                execSync('git commit -m "🤖 Update cognitive summary (Reasoning Layer V3)"', {
                    cwd: this.workspaceRoot
                });
                this.log('✅ README.md auto-committed');
            } else {
                this.log('ℹ️  README.md unchanged, no commit needed');
            }
        } catch (error) {
            this.log(`⚠️  Auto-commit failed: ${error}`);
        }
    }

    /**
     * Log message to output
     */
    private log(message: string): void {
        console.log(message);
        this.logger.log(message);
    }
}


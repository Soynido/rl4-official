/**
 * Feature Mapper - Level 10.1: System Documentation
 * 
 * Scans all reasoning layer modules and generates feature map
 * Documents purpose, usage, and cognitive level of each component
 */

import * as fs from 'fs';
import * as path from 'path';

interface Feature {
    file: string;
    level: string;
    purpose: string;
    when_to_use: string;
    how_to_use: string;
    status: string;
    functions?: string[];
}

const FEATURE_DATABASE: Record<string, Partial<Feature>> = {
    'PatternLearningEngine.ts': {
        level: '7.0',
        purpose: 'Learn decision patterns from historical events',
        when_to_use: 'At the start of each reasoning cycle',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'CorrelationEngine.ts': {
        level: '7.0',
        purpose: 'Detect correlations between patterns and events',
        when_to_use: 'After PatternLearningEngine',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'ForecastEngine.ts': {
        level: '7.0',
        purpose: 'Generate forecasts from patterns and correlations',
        when_to_use: 'After CorrelationEngine',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'ADRGeneratorV2.ts': {
        level: '7.5',
        purpose: 'Synthesize ADR proposals from forecasts',
        when_to_use: 'After ForecastEngine',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'BiasMonitor.ts': {
        level: '7.5',
        purpose: 'Detect cognitive biases in reasoning',
        when_to_use: 'After ADRGenerator',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'GoalSynthesizer.ts': {
        level: '8.0',
        purpose: 'Generate internal goals from reasoning state',
        when_to_use: 'After BiasMonitor',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'ReflectionManager.ts': {
        level: '8.5',
        purpose: 'Execute or defer goals based on priority',
        when_to_use: 'After GoalSynthesizer',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'TaskSynthesizer.ts': {
        level: '8.75',
        purpose: 'Translate goals into concrete actionable tasks',
        when_to_use: 'After GoalSynthesizer',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'SelfReviewEngine.ts': {
        level: '9.0',
        purpose: 'Analyze execution cycles and generate insights',
        when_to_use: 'End of each reasoning cycle',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'HistoryManager.ts': {
        level: '9.0',
        purpose: 'Track execution history and evolution',
        when_to_use: 'Continuously during pipeline',
        how_to_use: 'Auto-run by HistoryManager',
        status: 'operational'
    },
    'AutoTaskSynthesizer.ts': {
        level: '9.5',
        purpose: 'Generate tasks from global cognitive state',
        when_to_use: 'After SelfReviewEngine',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'GoalToActionCompiler.ts': {
        level: '10.0',
        purpose: 'Transform goals into file-level actions',
        when_to_use: 'After TaskSynthesizer',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'TaskMemoryManager.ts': {
        level: '10.1',
        purpose: 'Persist task execution in immutable ledger',
        when_to_use: 'End of each reasoning cycle',
        how_to_use: 'Auto-run by ReasoningPipeline',
        status: 'operational'
    },
    'FeatureMapper.ts': {
        level: '10.1',
        purpose: 'Generate feature documentation map',
        when_to_use: 'To audit and document system',
        how_to_use: 'Run manually: node FeatureMapper.ts',
        status: 'operational'
    }
};

export class FeatureMapper {
    private workspacePath: string;
    private reasoningPath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
        this.reasoningPath = path.join(workspacePath, 'extension', 'core', 'reasoning');
    }

    /**
     * Scan reasoning directory for TypeScript files
     */
    private scanReasoningFiles(): string[] {
        if (!fs.existsSync(this.reasoningPath)) {
            console.log('⚠️  Reasoning directory not found');
            return [];
        }

        const files = fs.readdirSync(this.reasoningPath)
            .filter(f => f.endsWith('.ts') && !f.endsWith('.d.ts'))
            .sort();

        return files;
    }

    /**
     * Extract functions from a TypeScript file
     */
    private extractFunctions(filePath: string): string[] {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            const functions: string[] = [];
            
            // Match method definitions
            const methodRegex = /(?:public|private|protected)?\s+(\w+)\s*[=:]?\s*\(/g;
            let match;
            
            while ((match = methodRegex.exec(content)) !== null) {
                const funcName = match[1];
                if (!['constructor', 'if', 'for', 'while', 'async'].includes(funcName)) {
                    functions.push(funcName);
                }
            }
            
            return [...new Set(functions)].slice(0, 10); // Limit to 10
        } catch (error) {
            return [];
        }
    }

    /**
     * Generate feature map
     */
    public generate(): Feature[] {
        console.log('🗺️  FeatureMapper: Scanning reasoning modules...');

        const files = this.scanReasoningFiles();
        const features: Feature[] = [];

        for (const file of files) {
            const feature: Feature = {
                file,
                level: FEATURE_DATABASE[file]?.level || 'Unknown',
                purpose: FEATURE_DATABASE[file]?.purpose || 'See source code',
                when_to_use: FEATURE_DATABASE[file]?.when_to_use || 'Manual inspection required',
                how_to_use: FEATURE_DATABASE[file]?.how_to_use || 'Run manually',
                status: FEATURE_DATABASE[file]?.status || 'unknown',
                functions: []
            };

            // Extract functions
            const filePath = path.join(this.reasoningPath, file);
            if (fs.existsSync(filePath)) {
                feature.functions = this.extractFunctions(filePath);
            }

            features.push(feature);
        }

        console.log(`✅ Found ${features.length} reasoning modules`);
        return features;
    }

    /**
     * Save feature map as JSON
     */
    private saveJSON(features: Feature[]): void {
        const output = {
            generated_at: new Date().toISOString(),
            total_features: features.length,
            features
        };

        const jsonPath = path.join(this.workspacePath, '.reasoning', 'FeatureMap.json');
        fs.writeFileSync(jsonPath, JSON.stringify(output, null, 2));
        console.log(`✅ Feature map JSON saved: ${jsonPath}`);
    }

    /**
     * Save feature map as Markdown
     */
    private saveMarkdown(features: Feature[]): void {
        const md = [
            '# 🧩 Reasoning Layer Feature Map',
            '',
            `**Generated:** ${new Date().toISOString()}`,
            `**Total Features:** ${features.length}`,
            `**Version:** v1.0.35-STABLE`,
            '',
            '---',
            ''
        ];

        // Group by level
        const byLevel: Record<string, Feature[]> = {};
        for (const feature of features) {
            const level = feature.level.split('.')[0]; // Major version
            if (!byLevel[level]) {
                byLevel[level] = [];
            }
            byLevel[level].push(feature);
        }

        // Generate sections by level
        const levelMap: Record<string, string> = {
            '7': '## 🧠 Level 7 → Base Engines',
            '8': '## 🎯 Level 8 → Cognitive Goals',
            '9': '## 🔄 Level 9 → Self-Review & Memory',
            '10': '## 🛠️ Level 10 → Operational Intelligence'
        };

        for (const [major, levelLabel] of Object.entries(levelMap)) {
            if (!byLevel[major]) continue;

            md.push(levelLabel);
            md.push('');
            md.push('| File | Purpose | When to Use | How to Use |');
            md.push('|------|---------|-------------|------------|');

            for (const feature of byLevel[major]) {
                md.push(`| \`${feature.file}\` | ${feature.purpose} | ${feature.when_to_use} | ${feature.how_to_use} |`);
            }

            md.push('');
        }

        // Add unknown level
        if (byLevel['Unknown']) {
            md.push('## ❓ Unknown Level');
            md.push('');
            for (const feature of byLevel['Unknown']) {
                md.push(`- **${feature.file}**: ${feature.purpose}`);
            }
            md.push('');
        }

        const mdPath = path.join(this.workspacePath, '.reasoning', 'FeatureMap.md');
        fs.writeFileSync(mdPath, md.join('\n'));
        console.log(`✅ Feature map Markdown saved: ${mdPath}`);
    }

    /**
     * Main entry point
     */
    public async map(): Promise<void> {
        console.log('🧩 FeatureMapper: Generating feature map...');

        const features = this.generate();
        
        this.saveJSON(features);
        this.saveMarkdown(features);

        console.log(`✅ Feature map complete (${features.length} features)`);
    }
}

/**
 * Standalone runner
 */
export async function runFeatureMapper(workspacePath: string): Promise<void> {
    const mapper = new FeatureMapper(workspacePath);
    await mapper.map();
}

// If run directly
if (require.main === module) {
    runFeatureMapper(process.cwd());
}

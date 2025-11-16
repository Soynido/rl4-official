/**
 * Goal-to-Action Compiler - Level 10: Operational Intelligence
 * 
 * Reads goals and transforms them into detailed action plans with file-level instructions
 * Adapts to any workspace structure (TypeScript, Python, Angular, etc.)
 */

import * as fs from 'fs';
import * as path from 'path';

interface ActionRule {
    action: 'create' | 'modify' | 'extend' | 'patch' | 'update';
    file: string;
    purpose: string;
    dependencies?: string[];
    methods?: string[];
}

interface ActionPlan {
    goal: string;
    file: string;
    action: string;
    description: string;
    priority: string;
    confidence: number | string;
    dependencies?: string[];
}

const ACTION_MAP: Record<string, ActionRule[]> = {
    'Reduce correlation duplication': [
        { 
            action: 'modify', 
            file: 'extension/core/reasoning/CorrelationEngine.ts', 
            purpose: 'Add deduplication logic to prevent duplicate correlations',
            dependencies: ['patterns.json', 'correlations.json'],
            methods: ['deduplicateCorrelations()', 'mergeSimilarCorrelations()']
        },
        { 
            action: 'create', 
            file: 'extension/core/reasoning/CorrelationDeduplicator.ts', 
            purpose: 'New deduplication module for correlation management',
            dependencies: ['CorrelationEngine.ts'],
            methods: ['applyDeduplication()', 'findDuplicates()']
        }
    ],
    'Reduce thematic bias': [
        { 
            action: 'modify', 
            file: 'extension/core/reasoning/ForecastEngine.ts', 
            purpose: 'Add category diversity limiter (max 3 forecasts per category)',
            dependencies: ['patterns.json', 'forecasts.json'],
            methods: ['limitCategoryDiversity()', 'balanceForecasts()']
        },
        { 
            action: 'create', 
            file: 'extension/core/reasoning/HistoricalBalancer.ts', 
            purpose: 'Balance historical data across time periods and categories',
            dependencies: ['patterns.json', 'correlations.json'],
            methods: ['rebalanceHistoricalData()', 'calculateTemporalBalance()']
        }
    ],
    'Improve pattern diversity': [
        { 
            action: 'create', 
            file: 'extension/core/reasoning/PatternMutationEngine.ts', 
            purpose: 'Generate new pattern mutations from existing patterns (target: 5+ patterns with novelty >0.6)',
            dependencies: ['patterns.json', 'ForecastEngine.ts'],
            methods: ['mutatePattern(pattern, seedContext)', 'calculateNoveltyScore(newPattern, existingPatterns)']
        },
        { 
            action: 'create', 
            file: 'extension/core/reasoning/PatternEvaluator.ts', 
            purpose: 'Evaluate pattern novelty and quality metrics',
            dependencies: ['patterns.json', 'PatternMutationEngine.ts'],
            methods: ['evaluateNovelty(pattern)', 'scorePatternQuality(pattern)']
        },
        { 
            action: 'create', 
            file: 'extension/core/reasoning/PatternPruner.ts', 
            purpose: 'Remove redundant patterns using similarity metrics (cosine similarity <0.4)',
            dependencies: ['patterns.json', 'PatternEvaluator.ts'],
            methods: ['pruneRedundantPatterns()', 'calculateSimilarity(pattern1, pattern2)']
        },
        { 
            action: 'create', 
            file: 'tests/PatternMutationEngine.test.ts', 
            purpose: 'Test pattern mutation generation (5+ patterns, novelty >0.6)',
            dependencies: ['PatternMutationEngine.ts'],
            methods: []
        }
    ],
    'Build visual dashboard (Perceptual Layer)': [
        { 
            action: 'create', 
            file: 'extension/webview/PerceptualLayer.html', 
            purpose: 'Visual reasoning UI with timeline and pattern graphs',
            dependencies: ['patterns.json', 'correlations.json', 'forecasts.json'],
            methods: []
        },
        { 
            action: 'create', 
            file: 'extension/webview/PerceptualLayer.ts', 
            purpose: 'VS Code WebView panel controller for Perceptual Layer',
            dependencies: ['PerceptualLayer.html'],
            methods: ['renderTimeline()', 'renderPatternGraph()']
        }
    ]
};

export class GoalToActionCompiler {
    private workspacePath: string;

    constructor(workspacePath: string) {
        this.workspacePath = workspacePath;
    }

    /**
     * Read all JSON files from .reasoning/ directory
     */
    private readReasoningData(): Record<string, any> {
        const reasoningDir = path.join(this.workspacePath, '.reasoning');
        
        if (!fs.existsSync(reasoningDir)) {
            console.log('⚠️  .reasoning/ directory not found');
            return {};
        }

        const files = fs.readdirSync(reasoningDir);
        const data: Record<string, any> = {};

        for (const f of files) {
            if (f.endsWith('.json')) {
                try {
                    const content = fs.readFileSync(path.join(reasoningDir, f), 'utf-8');
                    data[f] = JSON.parse(content);
                } catch (error) {
                    console.warn(`⚠️  Could not parse ${f}`);
                }
            }
        }
        return data;
    }

    /**
     * Scan workspace for existing engines and files
     */
    private scanWorkspace(): string[] {
        const engines: string[] = [];
        const extensions = ['.ts', '.js', '.py'];

        const walk = (dir: string) => {
            try {
                const entries = fs.readdirSync(dir, { withFileTypes: true });
                
                for (const e of entries) {
                    const full = path.join(dir, e.name);
                    
                    if (e.isDirectory()) {
                        // Skip node_modules, .git, etc.
                        if (['node_modules', '.git', 'dist', 'out'].includes(e.name)) {
                            continue;
                        }
                        walk(full);
                    } else if (extensions.some(ext => e.name.endsWith(ext))) {
                        engines.push(full.replace(this.workspacePath + path.sep, ''));
                    }
                }
            } catch (error) {
                // Silently skip inaccessible directories
            }
        };

        walk(this.workspacePath);
        return engines;
    }

    /**
     * Generate action plan from goals
     */
    private generateActionPlan(goals: any[], engines: string[]): ActionPlan[] {
        const plan: ActionPlan[] = [];

        for (const goal of goals) {
            const rules = ACTION_MAP[goal.objective];
            
            if (!rules) {
                console.log(`⚠️  No action mapping for goal: ${goal.objective}`);
                continue;
            }

            for (const rule of rules) {
                // Check if file exists
                const exists = engines.some(e => e.includes(rule.file));
                const status = exists ? 'update' : rule.action;

                plan.push({
                    goal: goal.objective,
                    file: rule.file,
                    action: status,
                    description: rule.purpose,
                    priority: goal.priority || 'medium',
                    confidence: goal.confidence || 'N/A',
                    dependencies: rule.dependencies
                });
            }
        }

        return plan;
    }

    /**
     * Export action plan to JSON and Markdown
     */
    private exportActionPlan(plan: ActionPlan[]): void {
        const outDir = path.join(this.workspacePath, '.reasoning');

        // Save JSON
        fs.writeFileSync(
            path.join(outDir, 'action_plan.json'),
            JSON.stringify({ generated_at: new Date().toISOString(), plan }, null, 2)
        );

        // Generate Markdown
        const md = [
            '# 🧩 Action Plan - Goal-to-Action Compiler',
            '',
            `**Generated:** ${new Date().toISOString()}`,
            '',
            `**Total Actions:** ${plan.length}`,
            '',
            '## 📋 Action Summary',
            ''
        ];

        for (const action of plan) {
            const emoji = action.action === 'create' ? '🆕' : action.action === 'modify' ? '📝' : action.action === 'update' ? '🔄' : '⚙️';
            md.push(`### ${emoji} ${action.action.toUpperCase()}: \`${action.file}\``);
            md.push(`**Goal:** ${action.goal}`);
            md.push(`**Description:** ${action.description}`);
            md.push(`**Priority:** ${action.priority.toUpperCase()} | **Confidence:** ${action.confidence}`);
            if (action.dependencies && action.dependencies.length > 0) {
                md.push(`**Dependencies:** ${action.dependencies.join(', ')}`);
            }
            md.push('');
        }

        fs.writeFileSync(path.join(outDir, 'ActionPlan.md'), md.join('\n'));
        console.log(`✅ Action plan generated → .reasoning/ActionPlan.md (${plan.length} actions)`);
    }

    /**
     * Main entry point
     */
    public async compile(): Promise<ActionPlan[]> {
        console.log('🧠 GoalToActionCompiler: Reading context...');

        // Step 1: Read reasoning data
        const data = this.readReasoningData();
        console.log(`📊 Loaded ${Object.keys(data).length} reasoning files`);

        // Step 2: Scan workspace
        const engines = this.scanWorkspace();
        console.log(`🔍 Found ${engines.length} code files in workspace`);

        // Step 3: Extract goals
        let goals: any[] = [];
        if (data['tasks.json'] && data['tasks.json'].goals) {
            goals = data['tasks.json'].goals.map((g: any) => g.objective ? { ...g, objective: g.objective } : g);
        } else if (data['goals.json'] && data['goals.json'].active_goals) {
            goals = data['goals.json'].active_goals;
        }

        if (goals.length === 0) {
            console.log('⚠️  No goals found in reasoning data');
            return [];
        }

        console.log(`🎯 Found ${goals.length} active goals`);

        // Step 4: Generate action plan
        const plan = this.generateActionPlan(goals, engines);
        console.log(`📋 Generated ${plan.length} actions`);

        // Step 5: Export
        this.exportActionPlan(plan);

        return plan;
    }
}

/**
 * Standalone runner for testing
 */
export async function runGoalToActionCompiler(workspacePath: string): Promise<ActionPlan[]> {
    const compiler = new GoalToActionCompiler(workspacePath);
    return await compiler.compile();
}

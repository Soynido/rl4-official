/**
 * Repository Orchestrator - Cognitive Structure Manager
 * 
 * Analyzes repository structure and organizes it according to
 * cognitive hierarchy: base -> cognition -> memory -> operational
 */

import * as fs from 'fs';
import * as path from 'path';

interface ModuleLocation {
    file: string;
    currentPath: string;
    targetPath: string;
    level: string;
}

interface StructureAnalysis {
    totalFiles: number;
    misplacedFiles: number;
    missingDirectories: number;
    reorganizationPlan: ModuleLocation[];
}

export class RepositoryOrchestrator {
    private workspaceRoot: string;
    private currentStructure: Map<string, string[]> = new Map();
    private targetStructure: Map<string, string[]> = new Map();

    // Cognitive hierarchy mapping
    private COGNITIVE_MAPPING: Record<string, { level: string; category: string }> = {
        // Level 7: Base Engines
        'PatternLearningEngine.ts': { level: 'base', category: 'learning' },
        'CorrelationEngine.ts': { level: 'base', category: 'correlation' },
        'CorrelationDeduplicator.ts': { level: 'base', category: 'correlation' },
        'ForecastEngine.ts': { level: 'base', category: 'forecasting' },
        'ADRGeneratorV2.ts': { level: 'base', category: 'decision' },
        'BiasMonitor.ts': { level: 'base', category: 'monitoring' },
        'HistoricalBalancer.ts': { level: 'base', category: 'balancing' },
        'PatternMutationEngine.ts': { level: 'base', category: 'mutation' },
        'PatternEvaluator.ts': { level: 'base', category: 'evaluation' },
        'PatternPruner.ts': { level: 'base', category: 'pruning' },

        // Level 8: Cognition
        'GoalSynthesizer.ts': { level: 'cognition', category: 'goal_synthesis' },
        'ReflectionManager.ts': { level: 'cognition', category: 'reflection' },
        'TaskSynthesizer.ts': { level: 'cognition', category: 'task_synthesis' },

        // Level 9: Memory
        'SelfReviewEngine.ts': { level: 'memory', category: 'self_review' },
        'HistoryManager.ts': { level: 'memory', category: 'history' },
        'AutoTaskSynthesizer.ts': { level: 'memory', category: 'auto_synthesis' },
        'TaskMemoryManager.ts': { level: 'memory', category: 'task_memory' },

        // Level 10: Operational
        'GoalToActionCompiler.ts': { level: 'operational', category: 'compilation' },
        'FeatureMapper.ts': { level: 'operational', category: 'mapping' }
    };

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Analyze current repository structure
     */
    public analyze(): StructureAnalysis {
        console.log('🧩 Repository Orchestrator: Analyzing structure...\n');

        const reasoningPath = path.join(this.workspaceRoot, 'extension', 'core', 'reasoning');
        const currentFiles = fs.readdirSync(reasoningPath).filter(f => f.endsWith('.ts'));

        const reorganizationPlan: ModuleLocation[] = [];
        let misplacedFiles = 0;

        // Analyze each file
        for (const file of currentFiles) {
            const currentPath = path.join('extension', 'core', 'reasoning', file);
            const mapping = this.COGNITIVE_MAPPING[file];

            if (mapping) {
                const targetPath = `extension/core/${mapping.level}/${file}`;
                
                if (currentPath !== targetPath) {
                    reorganizationPlan.push({
                        file,
                        currentPath,
                        targetPath,
                        level: mapping.level
                    });
                    misplacedFiles++;
                }
            }
        }

        console.log(`📊 Analysis complete:`);
        console.log(`  Total files: ${currentFiles.length}`);
        console.log(`  Misplaced files: ${misplacedFiles}`);
        console.log(`  Reorganization needed: ${misplacedFiles > 0}\n`);

        return {
            totalFiles: currentFiles.length,
            misplacedFiles,
            missingDirectories: 0,
            reorganizationPlan
        };
    }

    /**
     * Generate reorganization plan
     */
    public generatePlan(): string {
        const analysis = this.analyze();

        if (analysis.reorganizationPlan.length === 0) {
            return '✅ Repository structure is already optimal!';
        }

        let plan = '# 🧩 Repository Reorganization Plan\n\n';
        plan += `**Generated:** ${new Date().toISOString()}\n\n`;
        plan += `## 📊 Summary\n\n`;
        plan += `- Files to reorganize: ${analysis.misplacedFiles}\n`;
        plan += `- Missing directories: ${analysis.missingDirectories}\n\n`;
        plan += `## 🔄 Planned Moves\n\n`;

        // Group by level
        const byLevel: Record<string, ModuleLocation[]> = {};
        analysis.reorganizationPlan.forEach(item => {
            if (!byLevel[item.level]) byLevel[item.level] = [];
            byLevel[item.level].push(item);
        });

        for (const [level, items] of Object.entries(byLevel)) {
            plan += `### 📁 Level: ${level}\n\n`;
            items.forEach(item => {
                plan += `- \`${item.file}\`\n`;
                plan += `  - From: \`${item.currentPath}\`\n`;
                plan += `  - To: \`${item.targetPath}\`\n\n`;
            });
        }

        plan += `## 🎯 Cognitive Hierarchy\n\n`;
        plan += `\`\`\`\n`;
        plan += `extension/core/\n`;
        plan += `├── base/       # Level 7: Fundamental engines\n`;
        plan += `├── cognition/  # Level 8: Directed thinking\n`;
        plan += `├── memory/     # Level 9: Auto-evaluation + memory\n`;
        plan += `└── operational/ # Level 10: Operational intelligence\n`;
        plan += `\`\`\`\n\n`;

        return plan;
    }

    /**
     * Execute reorganization (dry-run or actual move)
     */
    public async reorganize(dryRun: boolean = true): Promise<void> {
        const analysis = this.analyze();

        if (analysis.reorganizationPlan.length === 0) {
            console.log('✅ Repository structure is already optimal!');
            return;
        }

        console.log(dryRun ? '🔍 DRY RUN - No files will be moved\n' : '⚠️  EXECUTING REORGANIZATION - Files will be moved\n');

        // Create target directories
        const directories = new Set(analysis.reorganizationPlan.map(item => path.dirname(item.targetPath)));

        for (const dir of directories) {
            const fullPath = path.join(this.workspaceRoot, dir);
            if (!fs.existsSync(fullPath)) {
                console.log(`📁 Create directory: ${dir}`);
                if (!dryRun) {
                    fs.mkdirSync(fullPath, { recursive: true });
                }
            }
        }

        // Move files
        for (const item of analysis.reorganizationPlan) {
            const sourcePath = path.join(this.workspaceRoot, item.currentPath);
            const targetPath = path.join(this.workspaceRoot, item.targetPath);

            console.log(`📦 Move: ${item.file}`);
            console.log(`   From: ${item.currentPath}`);
            console.log(`   To: ${item.targetPath}`);

            if (!dryRun && fs.existsSync(sourcePath)) {
                fs.renameSync(sourcePath, targetPath);
                console.log(`   ✅ Moved`);
            } else if (!dryRun) {
                console.log(`   ⚠️  Source file not found`);
            }
        }

        console.log(`\n${dryRun ? '🔍' : '✅'} Reorganization ${dryRun ? 'plan' : 'complete'}!`);
    }

    /**
     * Generate architecture documentation
     */
    public generateArchitectureDoc(): string {
        let doc = '# 🧠 Reasoning Layer V3 - Architecture\n\n';
        doc += `**Version:** 1.0\n`;
        doc += `**Generated:** ${new Date().toISOString()}\n\n`;
        doc += `## 📁 Cognitive Hierarchy\n\n`;
        doc += `The Reasoning Layer is organized in 4 cognitive levels:\n\n`;
        doc += `### Level 7: Base Engines (Core Reasoning)\n`;
        doc += `Fundamental cognitive engines that learn patterns and generate forecasts.\n\n`;
        doc += `**Modules:**\n`;
        doc += `- PatternLearningEngine - Learns decision patterns from history\n`;
        doc += `- CorrelationEngine - Detects correlations between events and patterns\n`;
        doc += `- ForecastEngine - Generates future predictions\n`;
        doc += `- ADRGeneratorV2 - Synthesizes ADR proposals\n`;
        doc += `- BiasMonitor - Detects cognitive biases\n\n`;
        doc += `### Level 8: Cognition (Directed Thinking)\n`;
        doc += `Goal-oriented thinking and task synthesis.\n\n`;
        doc += `**Modules:**\n`;
        doc += `- GoalSynthesizer - Generates internal goals\n`;
        doc += `- ReflectionManager - Executes goals and decisions\n`;
        doc += `- TaskSynthesizer - Converts goals to tasks\n\n`;
        doc += `### Level 9: Memory (Auto-Evaluation)\n`;
        doc += `Self-review, historical tracking, and autonomous task generation.\n\n`;
        doc += `**Modules:**\n`;
        doc += `- SelfReviewEngine - Evaluates cognitive performance\n`;
        doc += `- HistoryManager - Tracks execution cycles\n`;
        doc += `- AutoTaskSynthesizer - Generates tasks from global state\n`;
        doc += `- TaskMemoryManager - Persists task history\n\n`;
        doc += `### Level 10: Operational Intelligence\n`;
        doc += `Action compilation and system documentation.\n\n`;
        doc += `**Modules:**\n`;
        doc += `- GoalToActionCompiler - Compiles goals to file-level actions\n`;
        doc += `- FeatureMapper - Maps system capabilities\n\n`;

        return doc;
    }

    /**
     * Save reorganization plan
     */
    public savePlan(plan: string): void {
        const planPath = path.join(this.workspaceRoot, '.reasoning', 'REORGANIZATION_PLAN.md');
        fs.writeFileSync(planPath, plan);
        console.log(`📄 Plan saved to: ${planPath}`);
    }

    /**
     * Save architecture documentation
     */
    public saveArchitectureDoc(doc: string): void {
        const docsDir = path.join(this.workspaceRoot, 'docs');
        if (!fs.existsSync(docsDir)) {
            fs.mkdirSync(docsDir, { recursive: true });
        }

        const docPath = path.join(docsDir, 'README_ARCHITECTURE.md');
        fs.writeFileSync(docPath, doc);
        console.log(`📄 Architecture doc saved to: ${docPath}`);
    }

    /**
     * Main execution
     */
    public async run(): Promise<void> {
        console.log('='.repeat(80));
        console.log('🧩 Repository Orchestrator - Cognitive Structure Manager');
        console.log('='.repeat(80));
        console.log(`📂 Workspace: ${this.workspaceRoot}\n`);

        // Analyze
        const analysis = this.analyze();

        // Generate plan
        const plan = this.generatePlan();
        this.savePlan(plan);

        // Generate architecture doc
        const archDoc = this.generateArchitectureDoc();
        this.saveArchitectureDoc(archDoc);

        // Show reorganization plan
        if (analysis.reorganizationPlan.length > 0) {
            console.log('\n📋 Reorganization Plan:');
            console.log(plan);
            console.log('\n💡 To execute reorganization:');
            console.log('   await orchestrator.reorganize(false);');
        } else {
            console.log('\n✅ Repository structure is optimal!');
        }

        console.log('\n✅ Repository Orchestrator complete!');
    }
}

/**
 * Standalone runner
 */
if (require.main === module) {
    const orchestrator = new RepositoryOrchestrator(process.cwd());
    orchestrator.run();
}

export async function runRepositoryOrchestrator(workspacePath: string): Promise<void> {
    const orchestrator = new RepositoryOrchestrator(workspacePath);
    await orchestrator.run();
}

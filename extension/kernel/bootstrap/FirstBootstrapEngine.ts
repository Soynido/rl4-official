import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { ProjectDetector, ProjectContext } from '../detection/ProjectDetector';
import { PlanTasksContextParser, PlanData, TasksData, ContextData } from '../api/PlanTasksContextParser';
import { ResponseContractValidator } from '../validation/ResponseContractValidator';
import { PipelineValidator } from '../validation/PipelineValidator';
import { RL4RollbackSystem } from '../rollback/RL4RollbackSystem';
import { GroundTruthSystem } from '../ground_truth/GroundTruthSystem';
import { YAMLCanonicalizer } from '../canonicalization/YAMLCanonicalizer';

/**
 * FirstBootstrapEngine — MVP-1: First Use mode complete
 * 
 * Workflow (mode firstUse):
 * 1. Scanner workspace (README, package.json, structure)
 * 2. Générer project_metadata.json
 * 3. Construire prompt firstUse enrichi
 * 4. Écrire fichiers RL4 INITIAUX (placeholders avec key ordering fixé)
 * 5. Appeler LLM (via UnifiedPromptBuilder)
 * 6. Valider Response Contract (V17) AVANT parsing
 * 7. Parser réponse LLM
 * 8. Exécuter pipeline S/P/L (V1, V2, V3, V16, V17)
 * 9. Si valide → écrire Plan/Tasks/Context.RL4
 * 10. Établir Ground Truth (immutable)
 * 11. Écrire first_use_lock: true dans Context.RL4
 * 
 * Verrous appliqués :
 * - V1: YAML structure valid
 * - V2: Key ordering preserved
 * - V3: LLM ne modifie pas kpis_kernel
 * - V13: Volume limits (max 10 tasks, 5 criteria)
 * - V16: Required keys présents
 * - V17: Response contract respecté
 * 
 * Si rollback :
 * - Quarantine log écrit
 * - Rollback HEAD atomique
 * - Mode revient à flexible
 */

export interface BootstrapResult {
    success: boolean;
    projectContext: ProjectContext;
    rl4FilesCreated: string[];
    groundTruthEstablished: boolean;
    validationErrors: string[];
    error?: string;
}

export class FirstBootstrapEngine {
    private workspaceRoot: string;
    private rl4Root: string;
    private parser: PlanTasksContextParser;
    private rollbackSystem: RL4RollbackSystem;
    private groundTruthSystem: GroundTruthSystem;
    private pipelineValidator: PipelineValidator;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.rl4Root = path.join(workspaceRoot, '.reasoning_rl4');
        this.parser = new PlanTasksContextParser(this.rl4Root);
        this.rollbackSystem = new RL4RollbackSystem(this.rl4Root);
        this.groundTruthSystem = new GroundTruthSystem(this.rl4Root);
        this.pipelineValidator = new PipelineValidator(this.rl4Root);
    }

    /**
     * Run first-time bootstrap (MVP-1)
     * 
     * CRITICAL: This is the ONLY time RL4 files are generated from scratch.
     * After first use, all modifications go through modes (strict/flexible/etc.)
     */
    async bootstrap(llmResponse?: string): Promise<BootstrapResult> {
        const validationErrors: string[] = [];
        
        try {
            console.log('[FirstBootstrapEngine] 🚀 Starting first use bootstrap...');
            
            // STEP 1: Detect project context
            const detector = new ProjectDetector(this.workspaceRoot);
            const projectContext = await detector.detect();
            
            console.log(`[FirstBootstrapEngine] ✅ Project detected: ${projectContext.name}`);
            
            // STEP 2: Create project metadata
            await this.createProjectMetadata(projectContext);
            
            // STEP 3: Generate initial RL4 files (placeholders with fixed key ordering)
            await this.generateInitialRL4Files(projectContext);
            
            console.log('[FirstBootstrapEngine] ✅ Initial RL4 files created (placeholders)');
            
            // STEP 4: If LLM response provided, validate and apply
            if (llmResponse) {
                console.log('[FirstBootstrapEngine] 📝 Processing LLM response...');
                
                // V17: Validate response contract BEFORE parsing
                const contractValidation = ResponseContractValidator.validateFirstUse(llmResponse);
                
                if (!contractValidation.valid) {
                    validationErrors.push(...contractValidation.errors);
                    throw new Error(`Response contract validation failed: ${contractValidation.errors.join(', ')}`);
                }
                
                if (contractValidation.warnings.length > 0) {
                    console.warn('[FirstBootstrapEngine] ⚠️ Response contract warnings:');
                    contractValidation.warnings.forEach(w => console.warn(`  - ${w}`));
                }
                
                // STEP 5: Extract RL4 blocks from LLM response
                const { plan, tasks, context } = this.extractRL4Blocks(llmResponse);
                
                // STEP 6: Create backups before applying
                this.rollbackSystem.createBackup('Plan.RL4');
                this.rollbackSystem.createBackup('Tasks.RL4');
                this.rollbackSystem.createBackup('Context.RL4');
                
                // STEP 7: Write LLM-generated content
                fs.writeFileSync(path.join(this.rl4Root, 'Plan.RL4'), plan, 'utf8');
                fs.writeFileSync(path.join(this.rl4Root, 'Tasks.RL4'), tasks, 'utf8');
                fs.writeFileSync(path.join(this.rl4Root, 'Context.RL4'), context, 'utf8');
                
                // STEP 8: Run pipeline validation (S/P/L)
                console.log('[FirstBootstrapEngine] 🔍 Running pipeline validation (S/P/L)...');
                
                const pipelineResult = await this.pipelineValidator.validate(plan, tasks, context, 'firstUse');
                
                if (!pipelineResult.valid) {
                    validationErrors.push(...pipelineResult.blocking_errors);
                    
                    // Rollback on validation failure
                    console.error('[FirstBootstrapEngine] ❌ Validation failed, rolling back...');
                    this.rollbackSystem.rollbackAll();
                    
                    // Write quarantine log
                    this.rollbackSystem.writeQuarantineLog({
                        timestamp: new Date().toISOString(),
                        file: 'All RL4 files',
                        error: pipelineResult.blocking_errors.join('; '),
                        violation: 'Pipeline validation failed',
                        mode: 'firstUse',
                        content_before: '',
                        content_after: llmResponse,
                        prompt_hash: this.rollbackSystem['simpleHash'](llmResponse),
                        llm_response_hash: this.rollbackSystem['simpleHash'](llmResponse)
                    });
                    
                    throw new Error(`Pipeline validation failed: ${pipelineResult.blocking_errors.join(', ')}`);
                }
                
                // Log soft warnings
                if (pipelineResult.soft_warnings.length > 0) {
                    console.warn('[FirstBootstrapEngine] ⚠️ Soft warnings (non-blocking):');
                    pipelineResult.soft_warnings.forEach(w => console.warn(`  - ${w}`));
                }
                
                console.log('[FirstBootstrapEngine] ✅ Pipeline validation passed');
            }
            
            // STEP 9: Establish Ground Truth (immutable)
            const planData = this.parser.parsePlan();
            const tasksData = this.parser.parseTasks();
            const contextData = this.parser.parseContext();
            
            if (!planData || !tasksData || !contextData) {
                throw new Error('Failed to parse RL4 files after writing');
            }
            
            await this.groundTruthSystem.establish(
                planData,
                tasksData,
                contextData,
                {
                    workspace_root: this.workspaceRoot,
                    project_name: projectContext.name,
                    project_description: projectContext.description,
                    tech_stack: projectContext.techStack,
                    files_scanned: await this.countTotalFiles()
                }
            );
            
            console.log('[FirstBootstrapEngine] ✅ Ground truth established (immutable)');
            
            // STEP 10: Write first_use_lock in Context.RL4
            await this.writeFirstUseLock();
            
            console.log('[FirstBootstrapEngine] 🔒 First use lock activated');
            
            // Clear backups (success)
            this.rollbackSystem.clearBackups();
            
            return {
                success: true,
                projectContext,
                rl4FilesCreated: ['Plan.RL4', 'Tasks.RL4', 'Context.RL4'],
                groundTruthEstablished: true,
                validationErrors: []
            };
            
        } catch (error) {
            return {
                success: false,
                projectContext: {} as ProjectContext,
                rl4FilesCreated: [],
                groundTruthEstablished: false,
                validationErrors,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Generate initial RL4 files (placeholders with fixed key ordering)
     * MVP-1: These are minimal placeholders to establish file structure
     */
    private async generateInitialRL4Files(projectContext: ProjectContext): Promise<void> {
        // Ensure .reasoning_rl4 exists
        if (!fs.existsSync(this.rl4Root)) {
            fs.mkdirSync(this.rl4Root, { recursive: true });
        }
        
        const now = new Date().toISOString();
        const targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]; // +7 days
        
        // Generate Plan.RL4 (minimal placeholder)
        const planContent = `---
version: 1.0.0
updated: ${now}
confidence: 0.5
---

# Plan — Strategic Vision

## Phase
Initial Setup (awaiting firstUse mode LLM enrichment)

## Goal
Project goals will be extracted from README.md, package.json, and code structure

## Timeline
Start: ${now.split('T')[0]}
Target: ${targetDate}

## Success Criteria
- [ ] Project context extracted
- [ ] Initial tasks generated
- [ ] Ground truth established
`;
        
        // Generate Tasks.RL4 (minimal placeholder)
        const tasksContent = `---
version: 1.0.0
updated: ${now}
bias: 0.0
---

# Tasks — Tactical TODOs

## Active
- [ ] [P0] Extract project goals from documentation @rl4:id=bootstrap-001
- [ ] [P0] Generate initial task list @rl4:id=bootstrap-002
`;
        
        // Generate Context.RL4 (minimal placeholder)
        const contextContent = `---
version: 1.0.0
updated: ${now}
confidence: 0.5
kpis_llm: []
kpis_kernel: []
first_use_lock: false
ground_truth_established: false
---

# Context — Workspace State

## Active Files
- README.md
- package.json

## Recent Activity (0h)
- Cycles: 0
- Commits: 0

## Health
- Memory: Unknown
- Event Loop: Unknown
- Uptime: 0s

## Observations
- First use mode: awaiting LLM enrichment
`;
        
        fs.writeFileSync(path.join(this.rl4Root, 'Plan.RL4'), planContent, 'utf8');
        fs.writeFileSync(path.join(this.rl4Root, 'Tasks.RL4'), tasksContent, 'utf8');
        fs.writeFileSync(path.join(this.rl4Root, 'Context.RL4'), contextContent, 'utf8');
    }
    
    /**
     * Extract RL4 blocks from LLM response
     */
    private extractRL4Blocks(llmResponse: string): { plan: string; tasks: string; context: string } {
        const rl4BlockRegex = /```(?:yaml|rl4)?\s*(Plan\.RL4|Tasks\.RL4|Context\.RL4)\s*([\s\S]*?)```/gi;
        const matches = Array.from(llmResponse.matchAll(rl4BlockRegex));
        
        let plan = '';
        let tasks = '';
        let context = '';
        
        for (const match of matches) {
            const fileName = match[1];
            const content = match[2].trim();
            
            if (fileName === 'Plan.RL4') {
                plan = content;
            } else if (fileName === 'Tasks.RL4') {
                tasks = content;
            } else if (fileName === 'Context.RL4') {
                context = content;
            }
        }
        
        return { plan, tasks, context };
    }
    
    /**
     * Write first_use_lock in Context.RL4 frontmatter
     */
    private async writeFirstUseLock(): Promise<void> {
        const contextData = this.parser.parseContext();
        
        if (!contextData) {
            throw new Error('Failed to parse Context.RL4 for lock write');
        }
        
        // Add lock and ground truth flag
        const updatedContext: ContextData = {
            ...contextData,
            updated: new Date().toISOString()
        };
        
        // Manually add lock fields (they're not in ContextData type yet)
        const contextPath = path.join(this.rl4Root, 'Context.RL4');
        const content = fs.readFileSync(contextPath, 'utf8');
        
        // Insert lock fields in frontmatter
        const updatedContent = content.replace(
            /^(---\n[\s\S]*?)(---\n)/,
            (match, frontmatter, closing) => {
                return frontmatter + 
                    'first_use_lock: true\n' +
                    'ground_truth_established: true\n' +
                    closing;
            }
        );
        
        fs.writeFileSync(contextPath, updatedContent, 'utf8');
    }
    
    /**
     * Count total files in workspace
     */
    private async countTotalFiles(): Promise<number> {
        const srcDirs = ['src', 'lib', 'app', 'pages', 'components', 'extension'];
        let total = 0;
        
        for (const dir of srcDirs) {
            const dirPath = path.join(this.workspaceRoot, dir);
            if (fs.existsSync(dirPath)) {
                total += this.countFiles(dirPath);
            }
        }
        
        return total;
    }

    /**
     * Create project metadata file for adaptive prompt generation
     */
    private async createProjectMetadata(context: ProjectContext): Promise<void> {
        const metadataPath = path.join(this.rl4Root, 'project_metadata.json');

        const metadata = {
            version: '1.0',
            detectedAt: new Date().toISOString(),
            project: {
                name: context.name,
                description: context.description,
                structure: context.structure,
                gitRemote: context.gitRemote
            },
            techStack: {
                languages: context.languages,
                frameworks: context.frameworks,
                tools: context.techStack
            },
            goals: context.goals,
            inferredTasks: this.generateInferredTasks(context),
            readmeSummary: context.readme ? context.readme.substring(0, 500) : null
        };

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    /**
     * Generate inferred tasks based on project analysis
     * Returns array of task suggestions for internal RL4 use
     */
    private generateInferredTasks(context: ProjectContext): string[] {
        const tasks: string[] = [];

        // Generic tasks based on structure
        if (context.structure === 'frontend' || context.structure === 'fullstack') {
            tasks.push('Build UI components');
            tasks.push('Set up routing');
            tasks.push('Implement state management');
        }

        if (context.structure === 'backend' || context.structure === 'fullstack') {
            tasks.push('Design API endpoints');
            tasks.push('Set up database schema');
            tasks.push('Implement authentication');
        }

        if (context.structure === 'mobile') {
            tasks.push('Set up navigation');
            tasks.push('Implement core screens');
            tasks.push('Test on devices');
        }

        // Testing tasks
        if (context.techStack.some(t => t.includes('Testing'))) {
            tasks.push('Write unit tests');
            tasks.push('Set up CI/CD');
        }

        // Default if no tasks generated
        if (tasks.length === 0) {
            tasks.push('Define project requirements');
            tasks.push('Set up development environment');
            tasks.push('Implement core features');
        }

        return tasks;
    }

    /**
     * Count files in directory recursively
     */
    private countFiles(dir: string): number {
        let count = 0;
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                
                if (entry.isDirectory()) {
                    count += this.countFiles(path.join(dir, entry.name));
                } else {
                    count++;
                }
            }
        } catch {}
        return count;
    }
}


import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';
import { ProjectDetector, ProjectContext } from '../detection/ProjectDetector';

/**
 * FirstBootstrapEngine — Smart initialization for new workspaces
 * 
 * When RL4 is installed on an existing project (or after initial dev without RL4):
 * 1. Scans Git history (if present)
 * 2. Analyzes current files and structure
 * 3. Enriches internal RL4 data:
 *    - .reasoning_rl4/context.json (with detected project context)
 *    - .reasoning_rl4/project_metadata.json (for adaptive prompts)
 * 
 * IMPORTANT: Does NOT create files in workspace root (plan.md, tasks.md)
 * RL4 manages these internally. Bootstrap only enriches existing structures.
 * 
 * Purpose: Eliminate disconnect between RL4 and real project context
 */

export interface BootstrapResult {
    success: boolean;
    projectContext: ProjectContext;
    enrichedFiles: string[];
    eventsDetected: number;
    error?: string;
}

export class FirstBootstrapEngine {
    private workspaceRoot: string;
    private rl4Root: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.rl4Root = path.join(workspaceRoot, '.reasoning_rl4');
    }

    /**
     * Run first-time bootstrap
     * 
     * IMPORTANT: Does NOT create plan.md/tasks.md in workspace root
     * Only enriches internal RL4 data structures with detected project context
     */
    async bootstrap(): Promise<BootstrapResult> {
        try {
            // Step 1: Detect project context
            const detector = new ProjectDetector(this.workspaceRoot);
            const projectContext = await detector.detect();

            // Step 2: Scan Git history (if present)
            const gitEvents = await this.scanGitHistory();

            // Step 3: Analyze current files
            const fileAnalysis = await this.analyzeCurrentFiles();

            // Step 4: Enrich RL4 internal context.json (not workspace root)
            await this.enrichContextJson(projectContext, fileAnalysis, gitEvents);

            // Step 5: Create project metadata for adaptive prompts
            await this.createProjectMetadata(projectContext);

            return {
                success: true,
                projectContext,
                enrichedFiles: [
                    '.reasoning_rl4/context.json',
                    '.reasoning_rl4/project_metadata.json'
                ],
                eventsDetected: gitEvents.length + fileAnalysis.length
            };
        } catch (error) {
            return {
                success: false,
                projectContext: {} as ProjectContext,
                enrichedFiles: [],
                eventsDetected: 0,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }

    /**
     * Scan Git history to understand project evolution
     */
    private async scanGitHistory(): Promise<any[]> {
        try {
            const git = simpleGit(this.workspaceRoot);
            const log = await git.log({ maxCount: 100 }); // Last 100 commits
            return Array.from(log.all);
        } catch {
            return [];
        }
    }

    /**
     * Analyze current files to infer project state
     */
    private async analyzeCurrentFiles(): Promise<any[]> {
        const analysis: any[] = [];
        
        // Check package.json for dependencies
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                analysis.push({
                    type: 'dependencies',
                    count: Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).length
                });
            } catch {}
        }

        // Count source files
        const srcDirs = ['src', 'lib', 'app', 'pages', 'components'];
        for (const dir of srcDirs) {
            const dirPath = path.join(this.workspaceRoot, dir);
            if (fs.existsSync(dirPath)) {
                const files = this.countFiles(dirPath);
                analysis.push({ type: 'source_files', dir, count: files });
            }
        }

        return analysis;
    }

    /**
     * Enrich existing RL4 context.json with detected project data
     */
    private async enrichContextJson(
        context: ProjectContext, 
        analysis: any[], 
        gitEvents: any[]
    ): Promise<void> {
        const contextPath = path.join(this.rl4Root, 'context.json');
        
        // Ensure .reasoning_rl4 exists
        if (!fs.existsSync(this.rl4Root)) {
            fs.mkdirSync(this.rl4Root, { recursive: true });
        }

        // Load existing context if present
        let existingContext: any = {};
        if (fs.existsSync(contextPath)) {
            try {
                existingContext = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
            } catch {}
        }

        // Merge with detected context (detected data takes priority)
        const enrichedContext = {
            ...existingContext,
            project: {
                name: context.name,
                description: context.description,
                type: context.structure,
                techStack: context.techStack,
                languages: context.languages,
                frameworks: context.frameworks,
                gitRemote: context.gitRemote
            },
            goals: context.goals.length > 0 ? context.goals : existingContext.goals || [],
            bootstrap: {
                timestamp: new Date().toISOString(),
                method: 'auto-detection',
                eventsAnalyzed: gitEvents.length,
                filesAnalyzed: analysis.length
            },
            readme: context.readme ? context.readme.substring(0, 1000) : undefined
        };

        fs.writeFileSync(contextPath, JSON.stringify(enrichedContext, null, 2), 'utf-8');
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
            inferredTasks: this.generateInferredTasks(context, []),
            readmeSummary: context.readme ? context.readme.substring(0, 500) : null
        };

        fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');
    }

    /**
     * Generate inferred tasks based on project analysis
     * Returns array of task suggestions for internal RL4 use
     */
    private generateInferredTasks(context: ProjectContext, analysis: any[]): string[] {
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


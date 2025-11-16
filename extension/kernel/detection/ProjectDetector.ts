import * as fs from 'fs';
import * as path from 'path';
import simpleGit from 'simple-git';

/**
 * ProjectDetector — Adaptive workspace context detection
 * 
 * Automatically detects:
 * - Project name (from package.json, git remote, folder name)
 * - Tech stack (languages, frameworks, tools)
 * - Project structure (frontend, backend, fullstack, etc.)
 * - Apparent goals (from README, comments, issues)
 * 
 * Purpose: Make RL4 prompts workspace-agnostic
 */

export interface ProjectContext {
    name: string;
    description: string;
    techStack: string[];
    structure: 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'library' | 'cli' | 'unknown';
    languages: string[];
    frameworks: string[];
    goals: string[];
    readme?: string;
    gitRemote?: string;
}

export class ProjectDetector {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Detect full project context
     */
    async detect(): Promise<ProjectContext> {
        const name = await this.detectProjectName();
        const description = await this.detectDescription();
        const techStack = await this.detectTechStack();
        const structure = this.detectStructure();
        const languages = this.detectLanguages();
        const frameworks = this.detectFrameworks();
        const goals = await this.detectGoals();
        const readme = await this.readReadme();
        const gitRemote = await this.detectGitRemote();

        return {
            name,
            description,
            techStack,
            structure,
            languages,
            frameworks,
            goals,
            readme,
            gitRemote
        };
    }

    /**
     * Detect project name from multiple sources
     * Priority: package.json > git remote > folder name
     */
    private async detectProjectName(): Promise<string> {
        // Try package.json
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (pkg.name) {
                    return pkg.name;
                }
            } catch {}
        }

        // Try git remote
        try {
            const git = simpleGit(this.workspaceRoot);
            const remotes = await git.getRemotes(true);
            if (remotes.length > 0 && remotes[0].refs.fetch) {
                const match = remotes[0].refs.fetch.match(/\/([^\/]+)\.git$/);
                if (match) {
                    return match[1];
                }
            }
        } catch {}

        // Fallback: folder name
        return path.basename(this.workspaceRoot);
    }

    /**
     * Detect project description from README or package.json
     */
    private async detectDescription(): Promise<string> {
        // Try package.json description
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (pkg.description) {
                    return pkg.description;
                }
            } catch {}
        }

        // Try README first line
        const readme = await this.readReadme();
        if (readme) {
            const firstLine = readme.split('\n').find(line => line.trim() && !line.startsWith('#'));
            if (firstLine) {
                return firstLine.trim();
            }
        }

        return 'No description available';
    }

    /**
     * Detect tech stack (languages + frameworks + tools)
     */
    private async detectTechStack(): Promise<string[]> {
        const stack = new Set<string>();

        // Languages
        const languages = this.detectLanguages();
        languages.forEach(lang => stack.add(lang));

        // Frameworks
        const frameworks = this.detectFrameworks();
        frameworks.forEach(fw => stack.add(fw));

        // Tools from package.json
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };
                
                // Detect common tools
                if (deps.webpack) stack.add('Webpack');
                if (deps.vite) stack.add('Vite');
                if (deps.typescript) stack.add('TypeScript');
                if (deps.eslint) stack.add('ESLint');
                if (deps.jest || deps.vitest) stack.add('Testing');
            } catch {}
        }

        return Array.from(stack);
    }

    /**
     * Detect programming languages from file extensions
     */
    private detectLanguages(): string[] {
        const languages = new Set<string>();
        const files = this.getAllFiles(this.workspaceRoot, 3); // 3 levels deep

        const extMap: Record<string, string> = {
            '.ts': 'TypeScript',
            '.tsx': 'TypeScript',
            '.js': 'JavaScript',
            '.jsx': 'JavaScript',
            '.py': 'Python',
            '.go': 'Go',
            '.rs': 'Rust',
            '.java': 'Java',
            '.rb': 'Ruby',
            '.php': 'PHP',
            '.swift': 'Swift',
            '.kt': 'Kotlin',
            '.cs': 'C#',
            '.cpp': 'C++',
            '.c': 'C'
        };

        files.forEach(file => {
            const ext = path.extname(file);
            if (extMap[ext]) {
                languages.add(extMap[ext]);
            }
        });

        return Array.from(languages);
    }

    /**
     * Detect frameworks from package.json dependencies
     */
    private detectFrameworks(): string[] {
        const frameworks = new Set<string>();
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');

        if (fs.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                const deps = { ...pkg.dependencies, ...pkg.devDependencies };

                // Frontend frameworks
                if (deps.react || deps['react-dom']) frameworks.add('React');
                if (deps.vue) frameworks.add('Vue');
                if (deps.svelte) frameworks.add('Svelte');
                if (deps.next) frameworks.add('Next.js');
                if (deps.nuxt) frameworks.add('Nuxt.js');
                if (deps.angular) frameworks.add('Angular');

                // Backend frameworks
                if (deps.express) frameworks.add('Express');
                if (deps.fastify) frameworks.add('Fastify');
                if (deps.koa) frameworks.add('Koa');
                if (deps.nestjs) frameworks.add('NestJS');

                // Fullstack
                if (deps.remix) frameworks.add('Remix');
                if (deps.astro) frameworks.add('Astro');

                // Mobile
                if (deps['react-native']) frameworks.add('React Native');
                if (deps.expo) frameworks.add('Expo');

                // CSS frameworks
                if (deps.tailwindcss) frameworks.add('Tailwind CSS');
                if (deps.bootstrap) frameworks.add('Bootstrap');
            } catch {}
        }

        return Array.from(frameworks);
    }

    /**
     * Detect project structure (frontend, backend, fullstack, etc.)
     */
    private detectStructure(): 'frontend' | 'backend' | 'fullstack' | 'mobile' | 'library' | 'cli' | 'unknown' {
        const files = this.getAllFiles(this.workspaceRoot, 2);
        const hasReact = files.some(f => f.includes('react') || f.endsWith('.jsx') || f.endsWith('.tsx'));
        const hasAPI = files.some(f => f.includes('/api/') || f.includes('/routes/') || f.includes('server'));
        const hasMobile = files.some(f => f.includes('react-native') || f.includes('expo'));
        const hasCLI = files.some(f => f.includes('/bin/') || f.includes('/cli/'));

        if (hasMobile) return 'mobile';
        if (hasCLI) return 'cli';
        if (hasReact && hasAPI) return 'fullstack';
        if (hasReact) return 'frontend';
        if (hasAPI) return 'backend';

        // Check package.json
        const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
        if (fs.existsSync(packageJsonPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
                if (pkg.main && !pkg.scripts?.start) return 'library';
            } catch {}
        }

        return 'unknown';
    }

    /**
     * Detect project goals from README, comments, TODO, issues
     * Prioritizes ACTIVE goals (not completed, not abandoned)
     */
    private async detectGoals(): Promise<string[]> {
        const goals = new Set<string>();
        const abandonedKeywords = ['abandon', 'deprecat', 'remov', 'cancel', 'skip', 'later', 'future', 'oublions'];

        // Get recent commits to understand what's actually being worked on
        const recentCommits = await this.getRecentCommitMessages(20);

        // From README - filter out abandoned/deprecated sections
        const readme = await this.readReadme();
        if (readme) {
            const goalKeywords = ['goal', 'objective', 'purpose', 'mission', 'aim'];
            const lines = readme.split('\n');
            let inAbandonedSection = false;
            
            lines.forEach(line => {
                const lower = line.toLowerCase();
                
                // Check if we're entering an abandoned section
                if (abandonedKeywords.some(kw => lower.includes(kw)) && 
                    (lower.includes('section') || lower.includes('##') || lower.includes('###'))) {
                    inAbandonedSection = true;
                }
                
                // Reset if new major section starts
                if (line.match(/^##\s+/) && !abandonedKeywords.some(kw => lower.includes(kw))) {
                    inAbandonedSection = false;
                }
                
                // Skip abandoned sections
                if (inAbandonedSection) return;
                
                // Look for goals
                if (goalKeywords.some(kw => lower.includes(kw))) {
                    // Skip if line contains abandoned keywords
                    if (!abandonedKeywords.some(kw => lower.includes(kw))) {
                        const cleaned = line.replace(/^[#\-*>\s]+/, '').trim();
                        // Filter out completed goals (checkboxes checked)
                        if (!cleaned.match(/^\s*[-*]\s*\[[xX]\]/) && 
                            cleaned.length > 10 && cleaned.length < 200) {
                            goals.add(cleaned);
                        }
                    }
                }
            });
        }

        // From plan.md (LLM-generated), TODO.md, ROADMAP.md - prioritize ACTIVE tasks
        const todoFiles = ['plan.md', 'Plan.md', 'TODO.md', 'ROADMAP.md', 'GOALS.md', 'OBJECTIVES.md'];
        for (const file of todoFiles) {
            const filePath = path.join(this.workspaceRoot, file);
            if (fs.existsSync(filePath)) {
                try {
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const lines = content.split('\n');
                    
                    lines.forEach(line => {
                        const lower = line.toLowerCase();
                        
                        // Skip abandoned/completed tasks
                        if (abandonedKeywords.some(kw => lower.includes(kw))) return;
                        if (line.match(/^\s*[-*]\s*\[[xX]\]/)) return; // Completed checkbox
                        if (lower.includes('✅') && lower.includes('complete')) return;
                        
                        const cleaned = line.replace(/^[#\-*>\[\]✓✅❌\s]+/, '').trim();
                        if (cleaned.length > 10 && cleaned.length < 200) {
                            // Prioritize if mentioned in recent commits
                            const isActive = recentCommits.some(msg => 
                                msg.toLowerCase().includes(cleaned.substring(0, 20).toLowerCase())
                            );
                            if (isActive) {
                                goals.add(`🔵 ${cleaned}`); // Mark as active
                            } else {
                                goals.add(cleaned);
                            }
                        }
                    });
                } catch {}
            }
        }

        // Scan .cursor/plans/*.plan.md files (Cursor-generated plans)
        const cursorPlansDir = path.join(this.workspaceRoot, '.cursor', 'plans');
        if (fs.existsSync(cursorPlansDir)) {
            try {
                const planFiles = fs.readdirSync(cursorPlansDir)
                    .filter(f => f.endsWith('.plan.md'))
                    .map(f => path.join(cursorPlansDir, f));
                
                for (const planPath of planFiles) {
                    try {
                        const content = fs.readFileSync(planPath, 'utf-8');
                        const lines = content.split('\n');
                        
                        lines.forEach(line => {
                            const lower = line.toLowerCase();
                            
                            // Skip abandoned/completed tasks
                            if (abandonedKeywords.some(kw => lower.includes(kw))) return;
                            if (line.match(/^\s*[-*]\s*\[[xX]\]/)) return;
                            if (lower.includes('✅') && lower.includes('complete')) return;
                            
                            // Extract goals/tasks from plan files (usually have clear structure)
                            const cleaned = line.replace(/^[#\-*>\[\]✓✅❌\s]+/, '').trim();
                            if (cleaned.length > 10 && cleaned.length < 200) {
                                // Plans from Cursor are usually active, mark them
                                goals.add(`📋 ${cleaned}`); // Mark as from plan file
                            }
                        });
                    } catch {}
                }
            } catch {}
        }

        // Infer goals from recent commits if not enough found
        if (goals.size < 3 && recentCommits.length > 0) {
            const commitKeywords = ['add', 'implement', 'create', 'build', 'develop', 'feat'];
            recentCommits.slice(0, 5).forEach(msg => {
                const lower = msg.toLowerCase();
                if (commitKeywords.some(kw => lower.startsWith(kw))) {
                    const cleaned = msg.split(':')[1] || msg;
                    if (cleaned.trim().length > 15 && cleaned.trim().length < 150) {
                        goals.add(`📝 ${cleaned.trim()}`);
                    }
                }
            });
        }

        // Sort: active goals first, then others
        const sortedGoals = Array.from(goals).sort((a, b) => {
            if (a.startsWith('🔵')) return -1;
            if (b.startsWith('🔵')) return 1;
            if (a.startsWith('📝')) return -1;
            if (b.startsWith('📝')) return 1;
            return 0;
        });

        return sortedGoals.slice(0, 5); // Top 5 goals
    }

    /**
     * Get recent commit messages to understand active work
     */
    private async getRecentCommitMessages(maxCount: number = 20): Promise<string[]> {
        try {
            const git = simpleGit(this.workspaceRoot);
            const log = await git.log({ maxCount });
            return log.all.map((commit: any) => commit.message);
        } catch {
            return [];
        }
    }

    /**
     * Read README.md content
     */
    private async readReadme(): Promise<string | undefined> {
        const readmePath = path.join(this.workspaceRoot, 'README.md');
        if (fs.existsSync(readmePath)) {
            try {
                return fs.readFileSync(readmePath, 'utf-8');
            } catch {}
        }
        return undefined;
    }

    /**
     * Detect Git remote URL
     */
    private async detectGitRemote(): Promise<string | undefined> {
        try {
            const git = simpleGit(this.workspaceRoot);
            const remotes = await git.getRemotes(true);
            if (remotes.length > 0) {
                return remotes[0].refs.fetch;
            }
        } catch {}
        return undefined;
    }

    /**
     * Get all files recursively (up to maxDepth)
     */
    private getAllFiles(dir: string, maxDepth: number, currentDepth = 0): string[] {
        if (currentDepth >= maxDepth) return [];
        
        const files: string[] = [];
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                // Skip node_modules, .git, etc.
                if (entry.name.startsWith('.') || entry.name === 'node_modules') continue;
                
                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    files.push(...this.getAllFiles(fullPath, maxDepth, currentDepth + 1));
                } else {
                    files.push(fullPath);
                }
            }
        } catch {}
        
        return files;
    }
}


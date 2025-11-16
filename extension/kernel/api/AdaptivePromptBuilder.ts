import * as fs from 'fs';
import * as path from 'path';
import { ProjectDetector, ProjectContext } from '../detection/ProjectDetector';
import { UnifiedPromptBuilder } from './UnifiedPromptBuilder';
import { CognitiveLogger } from '../CognitiveLogger';

/**
 * AdaptivePromptBuilder — Workspace-agnostic prompt generation
 * 
 * Replaces UnifiedPromptBuilder with adaptive context detection.
 * 
 * Key improvements:
 * - No hard-coded project names (no more "RL4", "E3.3" in prompts)
 * - Dynamic variables: {{PROJECT_NAME}}, {{TECH_STACK}}, {{GOALS}}
 * - Adapts to ANY workspace automatically
 * - Context generated from REAL project data
 * 
 * Purpose: Make RL4 prompts universally applicable
 */

export interface AdaptivePromptOptions {
    mode?: 'standard' | 'focused' | 'exploratory' | 'free' | 'firstUse' | 'strict' | 'flexible';
    includeHistory?: boolean;
    includeGoals?: boolean;
    includeTechStack?: boolean;
    maxContextLength?: number;
}

export class AdaptivePromptBuilder {
    private workspaceRoot: string;
    private rl4Root: string;
    private projectContext?: ProjectContext;
    private cognitiveLogger?: CognitiveLogger;

    constructor(workspaceRoot: string, cognitiveLogger?: CognitiveLogger) {
        this.workspaceRoot = workspaceRoot;
        this.rl4Root = path.join(workspaceRoot, '.reasoning_rl4');
        this.cognitiveLogger = cognitiveLogger;
    }

    /**
     * Build adaptive prompt for AI agents
     * 
     * Mode-specific logic (based on PROMPTS_4_MODES.md):
     * - strict (0%): Execution Guardian — Reject all new ideas, P0 only, 3 commits max
     * - flexible (25%): Pragmatic Manager — P0+P1, small improvements OK, 5 commits
     * - exploratory (50%): Innovation Consultant — 5-10 optimizations with code, 20 commits
     * - free (100%): Visionary Disruptor — 10+ transformative ideas, roadmap, 100 commits
     * - firstUse: Deep Discovery — Complete bootstrap, full detection, 50 commits
     */
    async buildPrompt(options: AdaptivePromptOptions = {}): Promise<string> {
        const mode = options.mode || 'flexible';
        
        // If firstUse mode, run bootstrap first
        if (mode === 'firstUse') {
            const { FirstBootstrapEngine } = await import('../bootstrap/FirstBootstrapEngine');
            const bootstrapEngine = new FirstBootstrapEngine(this.workspaceRoot);
            const result = await bootstrapEngine.bootstrap();
            if (result.success) {
                // Bootstrap complete, context enriched
            }
        }
        
        // Load or detect project context
        await this.ensureProjectContext();

        if (!this.projectContext) {
            return this.buildFallbackPrompt();
        }

        // Use UnifiedPromptBuilder (which now adapts to workspace and supports firstUse)
        const unifiedBuilder = new UnifiedPromptBuilder(this.rl4Root, this.cognitiveLogger);
        
        // Map mode names if needed
        let mappedMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse' = 'flexible';
        if (mode === 'strict' || mode === 'flexible' || mode === 'exploratory' || mode === 'free' || mode === 'firstUse') {
            mappedMode = mode;
        } else if (mode === 'standard' || mode === 'focused') {
            mappedMode = 'flexible'; // Map standard/focused to flexible
        }

        // UnifiedPromptBuilder.generate() now returns { prompt, metadata }
        const result = await unifiedBuilder.generate(mappedMode);
        return result.prompt; // Extract prompt string for compatibility
    }

    /**
     * Ensure project context is loaded or detected
     * Priority: project_metadata.json > context.json > fresh detection
     */
    private async ensureProjectContext(): Promise<void> {
        // Try project_metadata.json first (most complete)
        const metadataPath = path.join(this.rl4Root, 'project_metadata.json');
        if (fs.existsSync(metadataPath)) {
            try {
                const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf-8'));
                this.projectContext = {
                    name: metadata.project.name,
                    description: metadata.project.description,
                    structure: metadata.project.structure,
                    languages: metadata.techStack.languages,
                    frameworks: metadata.techStack.frameworks,
                    techStack: metadata.techStack.tools,
                    goals: metadata.goals,
                    gitRemote: metadata.project.gitRemote,
                    readme: metadata.readmeSummary
                };
                return;
            } catch {}
        }

        // Fallback: Try context.json
        const contextPath = path.join(this.rl4Root, 'context.json');
        if (fs.existsSync(contextPath)) {
            try {
                const data = JSON.parse(fs.readFileSync(contextPath, 'utf-8'));
                if (data.project) {
                    this.projectContext = data.project;
                    return;
                }
            } catch {}
        }

        // Last resort: Detect fresh
        const detector = new ProjectDetector(this.workspaceRoot);
        this.projectContext = await detector.detect();
    }

    /**
     * Build header section
     */
    private buildHeader(): string {
        return `# 🧠 Development Context Snapshot

**Project**: ${this.projectContext!.name}  
**Generated**: ${new Date().toISOString()}  
**Purpose**: Provide full context to AI coding assistant`;
    }

    /**
     * Build project overview
     */
    private buildProjectOverview(): string {
        return `## 📋 Project Overview

**Name**: ${this.projectContext!.name}  
**Type**: ${this.projectContext!.structure}  
**Description**: ${this.projectContext!.description}

${this.projectContext!.gitRemote ? `**Repository**: ${this.projectContext!.gitRemote}` : ''}`;
    }

    /**
     * Build tech stack section
     */
    private buildTechStack(): string {
        const { languages, frameworks, techStack } = this.projectContext!;

        return `## 🛠️ Tech Stack

### Languages
${languages.map(lang => `- ${lang}`).join('\n')}

${frameworks.length > 0 ? `### Frameworks\n${frameworks.map(fw => `- ${fw}`).join('\n')}` : ''}

### Tools
${techStack.filter(t => !languages.includes(t) && !frameworks.includes(t)).map(t => `- ${t}`).join('\n')}`;
    }

    /**
     * Build current state section
     */
    private async buildCurrentState(): Promise<string> {
        const sections: string[] = ['## 📊 Current State'];

        // Recent commits
        try {
            const simpleGit = require('simple-git');
            const git = simpleGit(this.workspaceRoot);
            const log = await git.log({ maxCount: 5 });
            
            if (log.all.length > 0) {
                sections.push('### Recent Commits (Last 5)');
                log.all.forEach((commit: any) => {
                    sections.push(`- \`${commit.hash.substring(0, 7)}\` ${commit.message} (${commit.author_name})`);
                });
            }
        } catch {}

        // Modified files
        try {
            const simpleGit = require('simple-git');
            const git = simpleGit(this.workspaceRoot);
            const status = await git.status();
            
            if (status.modified.length > 0 || status.created.length > 0) {
                sections.push('### Modified Files');
                status.modified.slice(0, 10).forEach((file: string) => {
                    sections.push(`- 🔸 ${file}`);
                });
                status.created.slice(0, 5).forEach((file: string) => {
                    sections.push(`- ✨ ${file} (new)`);
                });
            }
        } catch {}

        return sections.join('\n');
    }

    /**
     * Build goals section
     */
    private async buildGoals(): Promise<string> {
        const goals = this.projectContext!.goals;

        if (goals.length === 0) {
            return `## 🎯 Current Goals

(No explicit goals detected yet. They will be inferred as development progresses.)`;
        }

        // Get recent commits to check if goals are active
        let recentCommits: string[] = [];
        try {
            const simpleGit = require('simple-git');
            const git = simpleGit(this.workspaceRoot);
            const log = await git.log({ maxCount: 20 });
            recentCommits = log.all.map((commit: any) => commit.message.toLowerCase());
        } catch {}

        // Filter out abandoned/deprecated goals based on recent commits
        const activeGoals = goals.filter(goal => {
            const lower = goal.toLowerCase();
            const abandonedKeywords = [
                'abandon', 'deprecat', 'remov', 'cancel', 'skip', 'later', 'future', 
                'oublions', 'forget', 'postpone', 'maybe', 'later', 'future'
            ];
            
            // Filter out if contains abandoned keywords
            if (abandonedKeywords.some(kw => lower.includes(kw))) {
                return false;
            }
            
            // Special handling for "gamification" - filter if NOT in recent commits
            if (lower.includes('gamification') || lower.includes('gamif')) {
                const isInRecentCommits = recentCommits.some(msg => 
                    msg.includes('gamif') || msg.includes('mission') || msg.includes('badge') || 
                    msg.includes('streak') || msg.includes('leaderboard')
                );
                // If gamification is not mentioned in recent commits, it's likely abandoned
                if (!isInRecentCommits && recentCommits.length > 0) {
                    return false; // Filter out abandoned gamification goals
                }
            }
            
            // Filter out goals starting with "2. " (duplicate numbering) - often stale TODOs
            if (goal.match(/^\d+\.\s+/)) {
                // This is a numbered goal - might be stale
                // Keep it for now, but could be improved
            }
            
            return true;
        });

        if (activeGoals.length === 0) {
            return `## 🎯 Current Goals

⚠️ All detected goals appear to be deprecated/abandoned.  
Please update your README/TODO to reflect current priorities, or goals will be inferred from recent commits.`;
        }

        // Mark active goals (from recent commits)
        const formattedGoals = activeGoals.map((goal, i) => {
            const isActive = goal.startsWith('🔵') || goal.startsWith('📝');
            const cleaned = goal.replace(/^[🔵📝]\s*/, '');
            return `${i + 1}. ${cleaned}${isActive ? ' *(active)*' : ''}`;
        });

        return `## 🎯 Current Goals

${formattedGoals.join('\n')}

*Note: Goals marked as "active" are mentioned in recent commits. Update README/TODO to reflect current priorities if needed.*`;
    }

    /**
     * Build recent history section
     */
    private async buildRecentHistory(): Promise<string> {
        try {
            const simpleGit = require('simple-git');
            const git = simpleGit(this.workspaceRoot);
            const log = await git.log({ maxCount: 20 });

            const sections: string[] = ['## 📜 Recent History (Last 20 commits)'];
            
            log.all.forEach((commit: any) => {
                const date = new Date(commit.date).toLocaleDateString();
                sections.push(`- **${date}** — ${commit.message} (\`${commit.hash.substring(0, 7)}\`)`);
            });

            return sections.join('\n');
        } catch {
            return '';
        }
    }

    /**
     * Build footer section
     */
    private buildFooter(): string {
        return `## 💡 How to Use This Context

1. **Copy this entire snapshot**
2. **Paste it in your AI assistant** (Cursor, Claude, ChatGPT, etc.)
3. **Ask your question** with full project awareness

Example:
\`\`\`
[Paste snapshot above]

Question: Based on this project context, help me implement [feature X].
\`\`\`

---

*Generated by RL4 — Dev Continuity System*  
*Context is always adapted to YOUR project, not hard-coded*`;
    }

    /**
     * Build fallback prompt if detection fails
     */
    private buildFallbackPrompt(): string {
        return `# 🧠 Development Context Snapshot

**Project**: ${path.basename(this.workspaceRoot)}  
**Generated**: ${new Date().toISOString()}

## ⚠️ Limited Context

RL4 couldn't detect full project context yet. This might be because:
- Project is very new (no commits, no package.json)
- RL4 just installed (needs time to scan)

**What you can do:**
1. Make a few commits
2. Add a README.md with project description
3. Run \`RL4 › 🧠 Where Am I?\` again

---

*Generated by RL4 — Dev Continuity System*`;
    }

    /**
     * Build quick summary (for status bar)
     */
    async buildQuickSummary(): Promise<string> {
        await this.ensureProjectContext();
        
        if (!this.projectContext) {
            return 'RL4: Context not ready';
        }

        return `${this.projectContext.name} | ${this.projectContext.structure} | ${this.projectContext.languages.join(', ')}`;
    }

    /**
     * Compatibility method: initializeDefaults()
     * (Empty - AdaptivePromptBuilder doesn't need initialization)
     */
    async initializeDefaults(): Promise<void> {
        // No-op: AdaptivePromptBuilder detects context on-the-fly
        return;
    }

    /**
     * Compatibility method: generate()
     * Wrapper around buildPrompt() for backward compatibility
     * 
     * Note: This is called from WebView - uses Quick mode by default (no bootstrap)
     * Use buildPrompt() directly from commands for more control
     */
    async generate(deviationMode?: string): Promise<string> {
        // Quick mode by default (no bootstrap, no deep history)
        // Only include history in exploratory/free/firstUse modes
        const includeHistory = deviationMode === 'exploratory' || deviationMode === 'free' || deviationMode === 'firstUse';
        
        return await this.buildPrompt({
            mode: deviationMode as any,
            includeHistory: includeHistory, // False by default = Quick mode
            includeGoals: true,
            includeTechStack: true
        });
    }
}


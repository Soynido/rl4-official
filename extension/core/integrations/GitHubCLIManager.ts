import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { UnifiedLogger } from '../UnifiedLogger';
import { ExecPool } from '../../kernel/ExecPool';

/**
 * GitHub CLI Manager - Local Cognitive Agent
 * 
 * Interacts with GitHub entirely via `gh` CLI, no server required.
 * Uses `gh auth login` for authentication (token stored in ~/.config/gh/hosts.yml).
 * 
 * Advantages:
 * - 100% local (no Vercel server needed)
 * - Direct GitHub integration via CLI
 * - Portable (works in any IDE/CI)
 * - Composable (integrates with Cursor, Neovim, etc.)
 */
export class GitHubCLIManager {
    private workspaceRoot: string;
    private logger: UnifiedLogger;
    private repoSlug: string | null = null;
    private repoOwner: string | null = null;
    private repoName: string | null = null;
    private execPool: ExecPool;

    constructor(workspaceRoot: string, execPool?: ExecPool) {
        this.workspaceRoot = workspaceRoot || process.cwd();
        this.logger = UnifiedLogger.getInstance();
        this.execPool = execPool || new ExecPool(2, 2000);
        this.detectRepository();
    }

    /**
     * Detect GitHub repository from local git config
     */
    private detectRepository(): void {
        try {
            const remoteUrl = execSync('git config --get remote.origin.url', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            }).trim();

            // Match both HTTPS and SSH formats
            const match = remoteUrl.match(/(?:https:\/\/github\.com\/|git@github\.com:)([^\/]+)\/([^\/]+)(?:\.git)?$/);
            if (match && match[1] && match[2]) {
                this.repoOwner = match[1];
                this.repoName = match[2].replace('.git', '');
                this.repoSlug = `${this.repoOwner}/${this.repoName}`;
                this.logger.log(`🔗 Detected repository: ${this.repoSlug}`);
            }
        } catch (error) {
            this.logger.warn(`Failed to detect repository: ${error}`);
        }
    }

    /**
     * Check if GitHub CLI is installed
     */
    public async checkGHInstalled(): Promise<boolean> {
        try {
            execSync('gh --version', { stdio: 'ignore' });
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Check if user is authenticated with gh
     */
    public async checkGHAuth(): Promise<boolean> {
        try {
            const result = await this.execPool.run('gh auth status', { cwd: this.workspaceRoot });
            return result.stdout.includes('Logged in');
        } catch (error) {
            return false;
        }
    }

    /**
     * Get GitHub username (from gh auth status)
     */
    public async getGitHubUser(): Promise<string | null> {
        try {
            const result = await this.execPool.run('gh auth status', { cwd: this.workspaceRoot });
            const match = result.stdout.match(/Logged in to github.com as ([^\s]+)/);
            return match ? match[1] : null;
        } catch (error) {
            return null;
        }
    }

    /**
     * Prompt user to authenticate if not logged in
     */
    public async ensureAuthenticated(): Promise<boolean> {
        if (!await this.checkGHInstalled()) {
            const installUrl = 'https://cli.github.com/';
            const action = await vscode.window.showErrorMessage(
                'GitHub CLI (gh) is not installed. Install it to enable GitHub integration.',
                'Open Installation Page',
                'Cancel'
            );

            if (action === 'Open Installation Page') {
                await vscode.env.openExternal(vscode.Uri.parse(installUrl));
            }
            return false;
        }

        if (!await this.checkGHAuth()) {
            const action = await vscode.window.showWarningMessage(
                'Not authenticated with GitHub CLI. Authenticate to enable GitHub integration.',
                'Authenticate',
                'Cancel'
            );

            if (action === 'Authenticate') {
                // Open gh auth login in terminal
                const terminal = vscode.window.createTerminal('GitHub CLI Auth');
                terminal.sendText('gh auth login --web --scopes "repo, read:org, workflow, write:discussion"');
                terminal.show();
                
                await vscode.window.showInformationMessage(
                    'Follow the authentication flow in the terminal. Once complete, retry the GitHub operation.'
                );
            }
            return false;
        }

        return true;
    }

    /**
     * List issues from repository
     */
    public async listIssues(state: 'open' | 'closed' | 'all' = 'open'): Promise<any[]> {
        if (!this.repoSlug) {
            throw new Error('No repository detected');
        }

        if (!await this.ensureAuthenticated()) {
            return [];
        }

        try {
            const result = await this.execPool.run(
                `gh issue list --repo ${this.repoSlug} --state ${state} --json number,title,body,state,createdAt,updatedAt`,
                { cwd: this.workspaceRoot }
            );
            const issues = JSON.parse(result.stdout);
            this.logger.log(`📋 Listed ${issues.length} ${state} issues`);
            return issues;
        } catch (error) {
            this.logger.warn(`Failed to list issues: ${error}`);
            throw error;
        }
    }

    /**
     * Create a new issue
     */
    public async createIssue(title: string, body: string, labels: string[] = []): Promise<any> {
        if (!this.repoSlug) {
            throw new Error('No repository detected');
        }

        if (!await this.ensureAuthenticated()) {
            throw new Error('Not authenticated with GitHub CLI');
        }

        try {
            const labelFlag = labels.length > 0 ? `--label "${labels.join(',')}"` : '';
            const result = await this.execPool.run(
                `gh issue create --repo ${this.repoSlug} --title "${title}" --body "${body}" ${labelFlag}`.trim(),
                { cwd: this.workspaceRoot }
            );
            
            // Extract issue number from output (e.g., "https://github.com/owner/repo/issues/42")
            const match = result.stdout.match(/issues\/(\d+)/);
            const issueNumber = match ? parseInt(match[1]) : null;

            this.logger.log(`✅ Issue created: #${issueNumber} - ${title}`);
            
            // Log to traces
            this.logGitHubAction('create_issue', { issueNumber, title });

            return { number: issueNumber, url: result.stdout.trim() };
        } catch (error) {
            this.logger.warn(`Failed to create issue: ${error}`);
            throw error;
        }
    }

    /**
     * Comment on a PR
     */
    public async commentPR(prNumber: number, body: string): Promise<void> {
        if (!this.repoSlug) {
            throw new Error('No repository detected');
        }

        if (!await this.ensureAuthenticated()) {
            throw new Error('Not authenticated with GitHub CLI');
        }

        try {
            await this.execPool.run(
                `gh pr comment ${prNumber} --repo ${this.repoSlug} --body "${body}"`,
                { cwd: this.workspaceRoot }
            );

            this.logger.log(`💬 Commented on PR #${prNumber}`);
            
            // Log to traces
            this.logGitHubAction('comment_pr', { prNumber, commentLength: body.length });
        } catch (error) {
            this.logger.warn(`Failed to comment on PR: ${error}`);
            throw error;
        }
    }

    /**
     * Create a discussion
     */
    public async publishDiscussion(title: string, body: string, category: string = 'General'): Promise<any> {
        if (!this.repoSlug) {
            throw new Error('No repository detected');
        }

        if (!await this.ensureAuthenticated()) {
            throw new Error('Not authenticated with GitHub CLI');
        }

        try {
            // Create discussion file temporarily
            const tempFile = path.join(this.workspaceRoot, '.reasoning', 'temp_discussion.md');
            fs.writeFileSync(tempFile, body, 'utf-8');

            const result = await this.execPool.run(
                `gh discussion create --repo ${this.repoSlug} --title "${title}" --body-file "${tempFile}" --category "${category}"`,
                { cwd: this.workspaceRoot }
            );

            // Clean up temp file
            if (fs.existsSync(tempFile)) {
                fs.unlinkSync(tempFile);
            }

            this.logger.log(`📝 Discussion created: ${title}`);
            
            // Log to traces
            this.logGitHubAction('publish_discussion', { title, category });

            return { url: result.stdout.trim() };
        } catch (error) {
            this.logger.warn(`Failed to publish discussion: ${error}`);
            throw error;
        }
    }

    /**
     * Push commit (wrapper around git push)
     */
    public async pushCommit(message: string, files: string[] = []): Promise<void> {
        if (!await this.ensureAuthenticated()) {
            throw new Error('Not authenticated with GitHub CLI');
        }

        try {
            // Add files if specified
            if (files.length > 0) {
                execSync(`git add ${files.join(' ')}`, { cwd: this.workspaceRoot });
            } else {
                execSync('git add -A', { cwd: this.workspaceRoot });
            }

            // Commit
            execSync(`git commit -m "${message}"`, { cwd: this.workspaceRoot });

            // Push
            execSync('git push', { cwd: this.workspaceRoot });

            this.logger.log(`📤 Pushed commit: ${message}`);
            
            // Log to traces
            this.logGitHubAction('push_commit', { message, filesCount: files.length });
        } catch (error) {
            this.logger.warn(`Failed to push commit: ${error}`);
            throw error;
        }
    }

    /**
     * Run GitHub workflow
     */
    public async runWorkflow(workflowId: string, inputs: Record<string, string> = {}): Promise<void> {
        if (!this.repoSlug) {
            throw new Error('No repository detected');
        }

        if (!await this.ensureAuthenticated()) {
            throw new Error('Not authenticated with GitHub CLI');
        }

        try {
            const inputFlags = Object.entries(inputs)
                .map(([key, value]) => `-f ${key}="${value}"`)
                .join(' ');

            await this.execPool.run(
                `gh workflow run ${workflowId} --repo ${this.repoSlug} ${inputFlags}`.trim(),
                { cwd: this.workspaceRoot }
            );

            this.logger.log(`⚙️  Workflow triggered: ${workflowId}`);
            
            // Log to traces
            this.logGitHubAction('run_workflow', { workflowId, inputs });
        } catch (error) {
            this.logger.warn(`Failed to run workflow: ${error}`);
            throw error;
        }
    }

    /**
     * Publish forecast as discussion
     */
    public async publishForecast(forecast: any): Promise<void> {
        const title = `🔮 RL3 Forecast: ${forecast.predicted_decision || 'Decision Prediction'}`;
        
        let body = `## Reasoning Layer V3 — Forecast Prediction\n\n`;
        body += `**Decision**: ${forecast.predicted_decision}\n\n`;
        body += `**Confidence**: ${((forecast.confidence || 0) * 100).toFixed(0)}%\n\n`;
        body += `**Timeframe**: ${forecast.suggested_timeframe || 'TBD'}\n\n`;
        
        if (forecast.rationale && Array.isArray(forecast.rationale)) {
            body += `### Rationale\n\n`;
            forecast.rationale.forEach((r: string) => {
                body += `- ${r}\n`;
            });
        }

        if (forecast.related_patterns && forecast.related_patterns.length > 0) {
            body += `\n### Related Patterns\n\n`;
            forecast.related_patterns.forEach((p: string) => {
                body += `- ${p}\n`;
            });
        }

        body += `\n---\n\n*Generated by Reasoning Layer V3 Cognitive Engine*`;

        await this.publishDiscussion(title, body, 'Ideas');
    }

    /**
     * Comment PR with ADR inconsistency detection
     */
    public async commentADRInconsistency(prNumber: number, adrId: string, issue: string): Promise<void> {
        const body = `⚠️ **RL3 Cognitive Analysis**: ADR inconsistency detected\n\n` +
            `**ADR**: ${adrId}\n\n` +
            `**Issue**: ${issue}\n\n` +
            `---\n\n*Automatic detection by Reasoning Layer V3*`;

        await this.commentPR(prNumber, body);
    }

    /**
     * Create issue for ADR proposal
     */
    public async createADRIssue(adr: any): Promise<any> {
        const title = `ADR: ${adr.title || 'Untitled ADR'}`;
        
        let body = `## Architectural Decision Record\n\n`;
        body += `**Status**: ${adr.status || 'proposed'}\n\n`;
        body += `**Context**: ${adr.context || 'N/A'}\n\n`;
        body += `**Decision**: ${adr.decision || 'N/A'}\n\n`;
        body += `**Consequences**: ${adr.consequences || 'N/A'}\n\n`;

        if (adr.components && adr.components.length > 0) {
            body += `\n### Components\n\n`;
            adr.components.forEach((c: string) => {
                body += `- ${c}\n`;
            });
        }

        body += `\n---\n\n*Generated by Reasoning Layer V3*`;

        return await this.createIssue(title, body, ['adr', 'architecture']);
    }

    /**
     * Log GitHub action to traces
     */
    private logGitHubAction(action: string, metadata: any): void {
        try {
            const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
            if (!fs.existsSync(tracesDir)) {
                fs.mkdirSync(tracesDir, { recursive: true });
            }

            const today = new Date().toISOString().split('T')[0];
            const traceFile = path.join(tracesDir, `${today}.json`);

            const event = {
                id: `gh-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date().toISOString(),
                type: 'github_cli_action',
                action,
                metadata: {
                    ...metadata,
                    repo: this.repoSlug,
                    result: 'success'
                }
            };

            let existing: any[] = [];
            if (fs.existsSync(traceFile)) {
                existing = JSON.parse(fs.readFileSync(traceFile, 'utf-8'));
            }

            existing.push(event);
            fs.writeFileSync(traceFile, JSON.stringify(existing, null, 2));
        } catch (error) {
            this.logger.warn(`Failed to log GitHub action: ${error}`);
        }
    }

    /**
     * Get repository slug
     */
    public getRepoSlug(): string | null {
        return this.repoSlug;
    }
}


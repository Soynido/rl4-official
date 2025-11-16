import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

/**
 * GitHub Fine-Grained Token Manager
 * Modern integration using repository-scoped tokens instead of global tokens
 */
export class GitHubFineGrainedManager {
    private workspaceRoot: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }

    /**
     * Public health check: determines if repo + valid fine-grained token are configured
     */
    public async checkConnection(): Promise<{ ok: boolean; reason?: string; repo?: string }> {
        const repoSlug = this.getRepositorySlug();
        if (!repoSlug) {
            return { ok: false, reason: 'no_repo' };
        }
        const token = this.getToken();
        if (!token) {
            return { ok: false, reason: 'missing_token', repo: repoSlug };
        }
        const result = await this.verifyToken(token, repoSlug);
        return { ok: result.ok, reason: result.reason, repo: repoSlug };
    }

    /**
     * Detect repository from local git config
     */
    private getRepositorySlug(): string | null {
        try {
            const remoteUrl = execSync('git config --get remote.origin.url', {
                cwd: this.workspaceRoot,
                encoding: 'utf-8'
            }).trim();

            // Match both HTTPS and SSH formats
            const match = remoteUrl.match(/(?:https:\/\/github\.com\/|git@github\.com:)([^\/]+\/[^\/]+)(?:\.git)?$/);
            if (match && match[1]) {
                return this.normalizeRepoSlug(match[1]);
            }

            return null;
        } catch (error) {
            console.error('Failed to detect repository:', error);
            return null;
        }
    }

    /**
     * Ensure repo slug is in the form owner/repo (strip trailing .git, trim spaces)
     */
    private normalizeRepoSlug(slug: string): string {
        return slug.trim().replace(/\.git$/i, '');
    }

    /**
     * Generate fine-grained token creation URL
     */
    private generateTokenUrl(repoSlug: string): string {
        const normalized = this.normalizeRepoSlug(repoSlug);
        return `https://github.com/settings/personal-access-tokens/new?scopes=repo&repository=${normalized}`;
    }

    /**
     * Verify token with GitHub API
     */
    private async verifyToken(token: string, repoSlug: string): Promise<{ ok: boolean; reason?: string }> {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28'
        } as const;

        try {
            // 1) Validate token syntactically and account identity
            const userRes = await fetch('https://api.github.com/user', { headers });
            if (userRes.status === 401) {
                return { ok: false, reason: 'unauthorized' };
            }
            if (userRes.status !== 200) {
                return { ok: false, reason: `unexpected_user_status_${userRes.status}` };
            }

            // 2) Check repository visibility with this token (private requires explicit permission)
            const repoRes = await fetch(`https://api.github.com/repos/${this.normalizeRepoSlug(repoSlug)}`, { headers });
            if (repoRes.status === 200) {
                return { ok: true };
            }
            if (repoRes.status === 404 || repoRes.status === 403) {
                // Token valid, but missing repository access/permissions
                return { ok: false, reason: 'missing_repo_access' };
            }
            return { ok: false, reason: `unexpected_repo_status_${repoRes.status}` };
        } catch (error) {
            console.error('Token verification failed:', error);
            return { ok: false, reason: 'network_error' };
        }
    }

    /**
     * Save token securely
     */
    private saveToken(token: string, repoSlug: string): void {
        const securityDir = path.join(this.workspaceRoot, '.reasoning', 'security');
        if (!fs.existsSync(securityDir)) {
            fs.mkdirSync(securityDir, { recursive: true });
        }

        const tokenData = {
            repo: this.normalizeRepoSlug(repoSlug),
            token_type: 'fine-grained',
            created_at: new Date().toISOString(),
            scopes: ['repo'],
            token: token
        };

        const tokenPath = path.join(securityDir, 'github.json');
        fs.writeFileSync(tokenPath, JSON.stringify(tokenData, null, 2));
        
        console.log(`✅ GitHub token saved to ${tokenPath}`);
    }

    /**
     * Main setup flow
     */
    public async setupIntegration(): Promise<void> {
        // Step 1: Detect repository
        const repoSlug = this.getRepositorySlug();
        if (!repoSlug) {
            vscode.window.showErrorMessage(
                '❌ No GitHub repository detected. Please initialize a Git repository first.'
            );
            return;
        }

        console.log(`📁 Detected repository: ${repoSlug}`);

        // Step 1.1: Check existing token and prompt for overwrite
        try {
            const tokenPath = path.join(this.workspaceRoot, '.reasoning', 'security', 'github.json');
            if (fs.existsSync(tokenPath)) {
                const existing = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
                const existingRepo = existing?.repo || 'unknown';
                const createdAt = existing?.created_at || 'unknown';
                const choice = await vscode.window.showInformationMessage(
                    `A fine-grained token is already configured for ${existingRepo} (created: ${createdAt}).`,
                    'Replace token',
                    'Keep existing',
                    'Cancel'
                );
                if (choice === 'Keep existing' || choice === 'Cancel') {
                    vscode.window.showInformationMessage('ℹ️ Keeping existing GitHub token.');
                    return;
                }
                // If 'Replace token', continue flow
            }
        } catch (e) {
            console.warn('Token overwrite check failed:', e);
        }

        // Step 2: Open fine-grained token creation URL
        const tokenUrl = this.generateTokenUrl(repoSlug);
        console.log(`🔗 Opening: ${tokenUrl}`);
        
        await vscode.env.openExternal(vscode.Uri.parse(tokenUrl));

        // Step 3: Prompt user for token
        const token = await vscode.window.showInputBox({
            prompt: `Paste your fine-grained token for ${repoSlug}`,
            placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
            password: true,
            ignoreFocusOut: true
        });

        if (!token) {
            vscode.window.showWarningMessage('GitHub integration cancelled.');
            return;
        }

        // Step 4: Verify token
        vscode.window.showInformationMessage('🔍 Verifying token...');
        
        const check = await this.verifyToken(token, repoSlug);
        if (!check.ok) {
            if (check.reason === 'unauthorized') {
                vscode.window.showErrorMessage('⚠️ Token unauthorized. Ensure you pasted it correctly and it is active.');
                return;
            }
            if (check.reason === 'missing_repo_access') {
                // Save token so user can adjust permissions on GitHub without re-pasting
                this.saveToken(token, repoSlug);
                this.logEvent(repoSlug);
                vscode.window.showWarningMessage(
                    '⚠️ Token is valid but lacks access to this repository. Grant Repository access to this repo and permissions (Contents: Read, Issues: Read, Pull requests: Read, Discussions: Read), then retry.'
                );
                return;
            }
            vscode.window.showErrorMessage(`⚠️ Token validation failed (${check.reason}). Please try again.`);
            return;
        }

        // Step 5: Save token
        this.saveToken(token, repoSlug);

        // Step 6: Log event
        this.logEvent(repoSlug);

        // Step 7: Success notification
        vscode.window.showInformationMessage(
            `✅ Fine-grained GitHub token connected to ${repoSlug}`
        );
    }

    /**
     * Log the integration event
     */
    private logEvent(repoSlug: string): void {
        try {
            const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
            if (!fs.existsSync(tracesDir)) {
                fs.mkdirSync(tracesDir, { recursive: true });
            }

            const today = new Date().toISOString().split('T')[0];
            const traceFile = path.join(tracesDir, `${today}.json`);

            const event = {
                id: `github-${Date.now()}`,
                timestamp: new Date().toISOString(),
                type: 'github_token_linked',
                metadata: {
                    repo: repoSlug,
                    token_type: 'fine-grained'
                }
            };

            let existing: any[] = [];
            if (fs.existsSync(traceFile)) {
                existing = JSON.parse(fs.readFileSync(traceFile, 'utf-8'));
            }

            existing.push(event);
            fs.writeFileSync(traceFile, JSON.stringify(existing, null, 2));

            console.log('✅ GitHub integration event logged');
        } catch (error) {
            console.error('Failed to log event:', error);
        }
    }

    /**
     * Get stored token
     */
    public getToken(): string | null {
        try {
            const tokenPath = path.join(this.workspaceRoot, '.reasoning', 'security', 'github.json');
            if (!fs.existsSync(tokenPath)) {
                return null;
            }

            const tokenData = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            return tokenData.token || null;
        } catch (error) {
            console.error('Failed to read token:', error);
            return null;
        }
    }
}


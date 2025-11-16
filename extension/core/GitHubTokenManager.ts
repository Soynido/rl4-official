import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export class GitHubTokenManager {
    private static readonly TOKEN_KEY = 'reasoningLayer.githubToken';

    /**
     * Get stored GitHub token from VS Code settings
     */
    public static getToken(): string | null {
        // DEPRECATED: Legacy settings token is no longer used.
        // New source of truth: .reasoning/security/github.json (fine-grained only)
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return null;
        const tokenPath = path.join(workspaceRoot, '.reasoning', 'security', 'github.json');
        try {
            if (!fs.existsSync(tokenPath)) return null;
            const data = JSON.parse(fs.readFileSync(tokenPath, 'utf-8'));
            if (data && data.token && data.token_type === 'fine-grained') {
                return data.token as string;
            }
            return null;
        } catch {
            return null;
        }
    }

    /**
     * Store GitHub token in VS Code settings
     */
    public static async storeToken(token: string): Promise<void> {
        // No-op: we only store fine-grained tokens on disk via GitHubFineGrainedManager
        void token;
    }

    /**
     * Clear stored GitHub token
     */
    public static async clearToken(): Promise<void> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) return;
        const tokenPath = path.join(workspaceRoot, '.reasoning', 'security', 'github.json');
        try { if (fs.existsSync(tokenPath)) fs.unlinkSync(tokenPath); } catch {}
    }

    /**
     * Check if GitHub token is configured
     */
    public static hasToken(): boolean {
        return this.getToken() !== null && this.getToken() !== '';
    }

    /**
     * Show setup dialog with button
     */
    public static async showSetupDialog(): Promise<string | null> {
        const action = await vscode.window.showWarningMessage(
            'GitHub integration requires a personal access token',
            'Setup Token',
            'Get Token',
            'Skip'
        );

        if (action === 'Setup Token') {
            // Show input box for token
            const token = await vscode.window.showInputBox({
                prompt: 'Enter your GitHub Personal Access Token',
                placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                password: true,
                ignoreFocusOut: true
            });

            if (token) {
                await this.storeToken(token);
                vscode.window.showInformationMessage('✅ GitHub token configured successfully!');
                return token;
            }
        } else if (action === 'Get Token') {
            // Open GitHub token creation page
            vscode.env.openExternal(vscode.Uri.parse('https://github.com/settings/tokens/new?scopes=repo&description=Reasoning%20Layer%20V3'));
            
            // After opening, ask for token again
            const token = await vscode.window.showInputBox({
                prompt: 'Paste your GitHub Personal Access Token here',
                placeHolder: 'ghp_xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
                password: true,
                ignoreFocusOut: true
            });

            if (token) {
                await this.storeToken(token);
                vscode.window.showInformationMessage('✅ GitHub token configured successfully!');
                return token;
            }
        }

        return null;
    }
}


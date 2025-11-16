import * as vscode from 'vscode';
import { ExecPool } from '../../../kernel/ExecPool';

export interface GitCommit {
    hash: string;
    author: string;
    timestamp: string;
    message: string;
    files: string[];
    insertions: number;
    deletions: number;
}

export interface ScanConfig {
    maxCommits: number;
    skipMerges: boolean;
    minLinesChanged: number;
}

export class GitHistoryScanner {
    private execPool: ExecPool;
    
    constructor(
        private workspaceRoot: string,
        private config: ScanConfig,
        execPool?: ExecPool
    ) {
        this.execPool = execPool || new ExecPool(2, 2000); // Default pool
    }

    /**
     * Scan Git history and extract commits
     */
    public async scanHistory(): Promise<GitCommit[]> {
        const output = await vscode.window.withProgress(
            {
                location: vscode.ProgressLocation.Notification,
                title: 'Scanning Git history...',
                cancellable: false
            },
            async () => {
                const command = this.buildGitCommand();
                const result = await this.execPool.run(command, { cwd: this.workspaceRoot });
                return result.stdout;
            }
        );

        return this.parseCommits(output);
    }

    /**
     * Build Git log command
     */
    private buildGitCommand(): string {
        const format = '--format=%H|%an|%ai|%s';
        let command = `git log ${format}`;

        if (this.config.skipMerges) {
            command += ' --no-merges';
        }

        command += ` -n ${this.config.maxCommits}`;

        return command;
    }

    /**
     * Parse commit output into structured data
     */
    private async parseCommits(output: string): Promise<GitCommit[]> {
        const commits: GitCommit[] = [];
        const lines = output.trim().split('\n');

        for (const line of lines) {
            if (!line) continue;

            const [hash, author, timestamp, ...messageParts] = line.split('|');
            const message = messageParts.join('|');

            // Get file changes for this commit
            const files = await this.getCommitFiles(hash);

            commits.push({
                hash,
                author: author || 'unknown',
                timestamp: this.parseTimestamp(timestamp),
                message,
                files: files.filePaths,
                insertions: files.insertions,
                deletions: files.deletions
            });
        }

        return commits;
    }

    /**
     * Get files changed in a commit
     */
    private async getCommitFiles(hash: string): Promise<{ filePaths: string[]; insertions: number; deletions: number }> {
        try {
            const result = await this.execPool.run(
                `git show --stat --format="" ${hash}`,
                { cwd: this.workspaceRoot }
            );
            const stdout = result.stdout;

            let insertions = 0;
            let deletions = 0;
            const filePaths: string[] = [];

            for (const line of stdout.split('\n')) {
                // Parse lines like: "src/file.ts | 15 +++++---"
                const match = line.match(/^(.+?)\s+\|\s+(\d+)\s+([+-]+)$/);
                if (match) {
                    const [, filePath, changes, symbols] = match;
                    filePaths.push(filePath.trim());
                    const pluses = (symbols.match(/\+/g) || []).length;
                    const minuses = (symbols.match(/-/g) || []).length;
                    insertions += parseInt(changes, 10) * (pluses / (pluses + minuses));
                    deletions += parseInt(changes, 10) * (minuses / (pluses + minuses));
                }
            }

            return { filePaths, insertions: Math.round(insertions), deletions: Math.round(deletions) };
        } catch (error) {
            console.warn(`Failed to get files for commit ${hash}:`, error);
            return { filePaths: [], insertions: 0, deletions: 0 };
        }
    }

    /**
     * Parse timestamp and convert to ISO string
     */
    private parseTimestamp(timestamp: string): string {
        // Git format: 2025-10-27 21:54:04 +0000
        return new Date(timestamp).toISOString();
    }

    /**
     * Group commits by time period
     */
    public groupCommitsByPeriod(commits: GitCommit[], daysPerPeriod: number = 30): Map<string, GitCommit[]> {
        const groups = new Map<string, GitCommit[]>();

        for (const commit of commits) {
            const date = new Date(commit.timestamp);
            const periodStart = new Date(date.getFullYear(), date.getMonth(), 1);
            const periodKey = periodStart.toISOString().split('T')[0];

            if (!groups.has(periodKey)) {
                groups.set(periodKey, []);
            }
            groups.get(periodKey)!.push(commit);
        }

        return groups;
    }
}


import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import { PersistenceManager } from './PersistenceManager';
import { EventAggregator } from './EventAggregator';
import { CaptureEvent, GitCommitData, DiffSummary } from './types';

export class GitCaptureEngine {
    private git: any = null;
    private lastCommitHash: string | null = null;
    private gitPollingInterval: NodeJS.Timeout | null = null;

    constructor(
        private workspaceRoot: string,
        private persistence: PersistenceManager,
        private eventAggregator: EventAggregator
    ) {
        // Initialisation Git sécurisée
        try {
            this.git = simpleGit(workspaceRoot);
            this.persistence.logWithEmoji('🐙', 'Git integration initialized');
        } catch (error) {
            this.persistence.logWithEmoji('⚠️', 'Git integration failed - file capture only');
        }
    }

    public start(): void {
        if (!this.git) {
            this.persistence.logWithEmoji('⚠️', 'Git watcher disabled - no Git integration');
            return;
        }

        this.startGitWatcher();
        this.persistence.logWithEmoji('🚀', 'GitCaptureEngine started');
    }

    // ✅ NOUVEAU - Niveau 1: Commit Data capture (sécurisé)
    private startGitWatcher(): void {
        this.gitPollingInterval = setInterval(async () => {
            try {
                // Test simple pour éviter les erreurs
                const status = await this.git.status();
                if (status && status.current) {
                    // Git fonctionne, on peut continuer
                }
            } catch (error) {
                // Git not initialized or error - silent fail
                return;
            }
            
            try {
                const log = await this.git.log({ n: 1 });
                const latestCommit = log.latest;

                if (latestCommit && latestCommit.hash !== this.lastCommitHash) {
                    await this.captureGitCommit(latestCommit);
                    this.lastCommitHash = latestCommit.hash;
                }
            } catch (error) {
                // Git log error - silent fail
            }
        }, 10000); // Poll every 10 seconds (plus conservateur)
        
        this.persistence.logWithEmoji('🐙', 'Git watcher started');
    }

    private async captureGitCommit(commit: any): Promise<void> {
        try {
            // ✅ Niveau 1: Commit Data
            const commitData: GitCommitData = {
                hash: commit.hash,
                author_name: commit.author_name,
                author_email: commit.author_email,
                date: commit.date,
                message: commit.message,
                files_changed: [], // Will be populated below
                insertions: 0,
                deletions: 0
            };

            // Get detailed commit info
            const commitDetails = await this.git.show([commit.hash, '--stat']);
            const filesChanged = this.parseFilesChanged(commitDetails);
            const stats = this.parseCommitStats(commitDetails);

            commitData.files_changed = filesChanged;
            commitData.insertions = stats.insertions;
            commitData.deletions = stats.deletions;

            // Create capture event via EventAggregator
            this.eventAggregator.captureEvent(
                'git_commit',
                commit.hash,
                {
                    commit_data: commitData,
                    level: '1 - Code & Structure Technique',
                    category: 'Commit Data'
                }
            );

            this.persistence.logWithEmoji('📝', `Git commit captured: ${commit.message.substring(0, 50)}`);

            // ✅ Niveau 1: Diff Summary (for each file)
            for (const filePath of filesChanged) {
                await this.captureDiffSummary(commit.hash, filePath);
            }

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to capture commit details: ${error}`);
        }
    }

    // ✅ NOUVEAU - Niveau 1: Diff Summary
    private async captureDiffSummary(commitHash: string, filePath: string): Promise<void> {
        try {
            const diff = await this.git.show([commitHash, '--', filePath]);
            const diffSummary: DiffSummary = {
                file_path: filePath,
                change_type: this.determineChangeType(diff),
                lines_added: this.countLinesAdded(diff),
                lines_deleted: this.countLinesDeleted(diff),
                functions_impacted: this.extractFunctionsImpacted(diff),
                dependencies_modified: this.extractDependenciesModified(diff)
            };

            this.eventAggregator.captureEvent(
                'git_commit',
                `${commitHash}:${filePath}`,
                {
                    diff_summary: diffSummary,
                    level: '1 - Code & Structure Technique',
                    category: 'Diff Summary'
                }
            );

            this.persistence.logWithEmoji('📊', `Diff summary captured: ${filePath}`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to capture diff for ${filePath}: ${error}`);
        }
    }

    // Helper methods
    private parseFilesChanged(commitDetails: string): string[] {
        const lines = commitDetails.split('\n');
        const filesChanged: string[] = [];
        
        for (const line of lines) {
            if (line.includes('|')) {
                const filePath = line.split('|')[0].trim();
                if (filePath) {
                    filesChanged.push(filePath);
                }
            }
        }
        
        return filesChanged;
    }

    private parseCommitStats(commitDetails: string): { insertions: number; deletions: number } {
        const lines = commitDetails.split('\n');
        let insertions = 0;
        let deletions = 0;
        
        for (const line of lines) {
            if (line.includes('insertion') || line.includes('deletion')) {
                const match = line.match(/(\d+) insertion|(\d+) deletion/g);
                if (match) {
                    match.forEach(m => {
                        if (m.includes('insertion')) {
                            insertions += parseInt(m.split(' ')[0]);
                        }
                        if (m.includes('deletion')) {
                            deletions += parseInt(m.split(' ')[0]);
                        }
                    });
                }
            }
        }
        
        return { insertions, deletions };
    }

    private determineChangeType(diff: string): 'added' | 'modified' | 'deleted' | 'renamed' {
        if (diff.includes('new file mode')) return 'added';
        if (diff.includes('deleted file mode')) return 'deleted';
        if (diff.includes('rename from') || diff.includes('rename to')) return 'renamed';
        return 'modified';
    }

    private countLinesAdded(diff: string): number {
        return (diff.match(/^\+/gm) || []).length;
    }

    private countLinesDeleted(diff: string): number {
        return (diff.match(/^-/gm) || []).length;
    }

    private extractFunctionsImpacted(diff: string): string[] {
        const functions: string[] = [];
        const lines = diff.split('\n');
        
        for (const line of lines) {
            // Simple function detection (can be enhanced with AST)
            if (line.includes('function ') || line.includes('def ') || line.includes('class ')) {
                const match = line.match(/(?:function|def|class)\s+(\w+)/);
                if (match) {
                    functions.push(match[1]);
                }
            }
        }
        
        return functions;
    }

    private extractDependenciesModified(diff: string): string[] {
        const dependencies: string[] = [];
        const lines = diff.split('\n');
        
        for (const line of lines) {
            // Detect dependency changes
            if (line.includes('package.json') || line.includes('requirements.txt') || line.includes('Cargo.toml')) {
                dependencies.push(line.trim());
            }
        }
        
        return dependencies;
    }


    public stop(): void {
        if (this.gitPollingInterval) {
            clearInterval(this.gitPollingInterval);
        }
        this.persistence.logWithEmoji('🛑', 'GitCaptureEngine stopped');
    }
}

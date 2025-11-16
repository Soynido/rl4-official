import * as vscode from 'vscode';
import simpleGit from 'simple-git';
import { PersistenceManager } from './PersistenceManager';
import { CaptureEvent } from './types';

export class CaptureEngine {
    private git: any = null;
    private lastCommitHash: string | null = null;
    private gitPollingInterval: NodeJS.Timeout | null = null;

    constructor(
        private workspaceRoot: string,
        private persistence: PersistenceManager
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
        this.startVSCodeWatchers();
        this.startGitWatcher();
        this.persistence.logWithEmoji('🚀', 'CaptureEngine started');
    }

    // ✅ NOUVEAU - VS Code native watchers (comme V2)
    private startVSCodeWatchers(): void {
        // 1. Text document changes
        vscode.workspace.onDidChangeTextDocument(textDocEvent => {
            if (textDocEvent.document.isUntitled || textDocEvent.document.uri.scheme !== 'file') {
                return;
            }

            if (this.shouldIgnoreFile(textDocEvent.document.uri.fsPath)) {
                return;
            }

            const change = textDocEvent.contentChanges[0];
            if (change) {
                const event: CaptureEvent = {
                    id: this.generateId(),
                    timestamp: new Date().toISOString(),
                    type: 'file_change',
                    source: textDocEvent.document.uri.fsPath,
                    metadata: {
                        language: textDocEvent.document.languageId,
                        lineCount: textDocEvent.document.lineCount,
                        range: { 
                            start: change.range.start, 
                            end: change.range.end 
                        }
                    }
                };

                this.persistence.saveEvent(event);
                this.persistence.logWithEmoji('📝', `File modified: ${textDocEvent.document.fileName}`);
            }
        });

        // 2. File saves
        vscode.workspace.onDidSaveTextDocument(document => {
            if (document.uri.scheme !== 'file' || this.shouldIgnoreFile(document.uri.fsPath)) {
                return;
            }

            const event: CaptureEvent = {
                id: this.generateId(),
                timestamp: new Date().toISOString(),
                type: 'file_change',
                source: document.uri.fsPath,
                metadata: {
                    action: 'save',
                    language: document.languageId,
                    lineCount: document.lineCount
                }
            };

            this.persistence.saveEvent(event);
            this.persistence.logWithEmoji('💾', `File saved: ${document.fileName}`);
        });

        this.persistence.logWithEmoji('👀', 'VS Code native watchers started');
    }

    // ✅ COPIÉ V2 - Filtrage robuste
    private shouldIgnoreFile(filePath: string): boolean {
        const ignoredPatterns = [
            /node_modules\//,
            /\.git\//,
            /\.vscode\//,
            /out\//,
            /dist\//,
            /build\//,
            /\.reasoning\//,
            /\.cache\//,
            /coverage\//,
            /\.map$/,
            /\.tmp$/,
            /\.log$/
        ];

        return ignoredPatterns.some(pattern => pattern.test(filePath));
    }

    // ✅ NOUVEAU - Git watcher avec polling (5s)
    private startGitWatcher(): void {
        if (!this.git) {
            this.persistence.logWithEmoji('⚠️', 'Git watcher disabled - no Git integration');
            return;
        }

        this.gitPollingInterval = setInterval(async () => {
            try {
                const log = await this.git!.log({ n: 1 });
                const latestCommit = log.latest;

                if (latestCommit && latestCommit.hash !== this.lastCommitHash) {
                    this.captureGitCommit(latestCommit);
                    this.lastCommitHash = latestCommit.hash;
                }
            } catch (error) {
                // Git not initialized or error - silent fail
            }
        }, 5000); // Poll every 5 seconds
        
        this.persistence.logWithEmoji('🐙', 'Git watcher started');
    }

    private captureGitCommit(commit: any): void {
        const event: CaptureEvent = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            type: 'git_commit',
            source: commit.hash,
            metadata: {
                author: commit.author_name,
                message: commit.message,
                date: commit.date
            }
        };

        this.persistence.saveEvent(event);
        this.persistence.logWithEmoji('📝', `Git commit captured: ${commit.message.substring(0, 50)}`);
    }

    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    public stop(): void {
        if (this.gitPollingInterval) {
            clearInterval(this.gitPollingInterval);
        }
        this.persistence.logWithEmoji('🛑', 'CaptureEngine stopped');
    }
}

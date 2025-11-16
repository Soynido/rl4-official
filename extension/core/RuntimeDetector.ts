import { UnifiedLogger } from './UnifiedLogger';

/**
 * Runtime detection for multi-environment support
 * Detects VS Code, Cursor, Claude Code and adapts capture strategy
 */

export type RuntimeEnvironment = 'vscode' | 'cursor' | 'claude' | 'unknown';

export interface RuntimeCapabilities {
    hasWorkspace: boolean;
    hasOnDidSaveTextDocument: boolean;
    hasOnDidChangeTextDocument: boolean;
    hasFileSystemWatcher: boolean;
    supportsCommands: boolean;
    name: string;
}

export class RuntimeDetector {
    private logger: UnifiedLogger;
    private runtime: RuntimeEnvironment;
    private capabilities: RuntimeCapabilities;

    constructor(workspaceRoot: string) {
        this.logger = UnifiedLogger.getInstance();
        this.runtime = this.detectRuntime();
        this.capabilities = this.getRuntimeCapabilities();

        this.logger.log(`🔍 Runtime detected: ${this.runtime} (${this.capabilities.name})`);
    }

    /**
     * Detect current runtime environment
     */
    private detectRuntime(): RuntimeEnvironment {
        // Check if we're in VS Code extension context
        try {
            // Check for VS Code extension context indicators
            if (process?.env?.VSCODE_PID || process?.env?.VSCODE_IPC_HOOK) {
                // Additional check for Cursor-specific environment
                if (this.isCursorEnvironment()) {
                    return 'cursor';
                }
                return 'vscode';
            }
        } catch (error) {
            // Environment variables not available
        }

        // Check for Claude Code environment
        if (this.isClaudeEnvironment()) {
            return 'claude';
        }

        return 'unknown';
    }

    /**
     * Detect Cursor-specific environment indicators
     */
    private isCursorEnvironment(): boolean {
        try {
            // Cursor-specific environment variables or patterns
            return !!(
                process?.env?.CURSOR_WORKSPACE ||
                process?.env?.CURSOR_VERSION ||
                (process?.env?.VSCODE_IPC_HOOK && process?.env?.VSCODE_IPC_HOOK.includes('cursor'))
            );
        } catch {
            return false;
        }
    }

    /**
     * Detect Claude Code environment
     */
    private isClaudeEnvironment(): boolean {
        try {
            return !!(
                process?.env?.CLAUDE_CODE ||
                process?.env?.CLAUDE_SESSION ||
                process?.env?.CLAUDE_API_KEY ||
                process?.cwd()?.includes('claude')
            );
        } catch {
            return false;
        }
    }

    /**
     * Get capabilities for current runtime
     */
    private getRuntimeCapabilities(): RuntimeCapabilities {
        switch (this.runtime) {
            case 'vscode':
                return {
                    hasWorkspace: true,
                    hasOnDidSaveTextDocument: true,
                    hasOnDidChangeTextDocument: true,
                    hasFileSystemWatcher: true,
                    supportsCommands: true,
                    name: 'Visual Studio Code'
                };

            case 'cursor':
                return {
                    hasWorkspace: true,
                    hasOnDidSaveTextDocument: true,
                    hasOnDidChangeTextDocument: true,
                    hasFileSystemWatcher: true,
                    supportsCommands: true,
                    name: 'Cursor Editor'
                };

            case 'claude':
                return {
                    hasWorkspace: false, // Claude Code works differently
                    hasOnDidSaveTextDocument: false,
                    hasOnDidChangeTextDocument: false,
                    hasFileSystemWatcher: false,
                    supportsCommands: false,
                    name: 'Claude Code'
                };

            default:
                return {
                    hasWorkspace: false,
                    hasOnDidSaveTextDocument: false,
                    hasOnDidChangeTextDocument: false,
                    hasFileSystemWatcher: false,
                    supportsCommands: false,
                    name: 'Unknown Environment'
                };
        }
    }

    /**
     * Get current runtime
     */
    public getRuntime(): RuntimeEnvironment {
        return this.runtime;
    }

    /**
     * Get current runtime capabilities
     */
    public getCapabilities(): RuntimeCapabilities {
        return this.capabilities;
    }

    /**
     * Check if runtime supports VS Code API
     */
    public supportsVSCodeAPI(): boolean {
        return this.runtime === 'vscode' || this.runtime === 'cursor';
    }

    /**
     * Check if runtime requires FileSystemPoller
     */
    public requiresFileSystemPoller(): boolean {
        return this.runtime === 'claude' || this.runtime === 'unknown';
    }

    /**
     * Check if runtime supports commands
     */
    public supportsCommands(): boolean {
        return this.capabilities.supportsCommands;
    }

    /**
     * Get optimal capture strategy for this runtime
     */
    public getOptimalCaptureStrategy(): {
        useOnDidSaveTextDocument: boolean;
        useOnDidChangeTextDocument: boolean;
        useFileSystemWatcher: boolean;
        useFileSystemPoller: boolean;
        pollInterval?: number;
    } {
        if (this.requiresFileSystemPoller()) {
            return {
                useOnDidSaveTextDocument: false,
                useOnDidChangeTextDocument: false,
                useFileSystemWatcher: false,
                useFileSystemPoller: true,
                pollInterval: 3000 // 3 seconds for Claude compatibility
            };
        }

        return {
            useOnDidSaveTextDocument: this.capabilities.hasOnDidSaveTextDocument,
            useOnDidChangeTextDocument: this.capabilities.hasOnDidChangeTextDocument,
            useFileSystemWatcher: this.capabilities.hasFileSystemWatcher,
            useFileSystemPoller: false
        };
    }

    /**
     * Log runtime information for debugging
     */
    public logRuntimeInfo(): void {
        this.logger.log('=== Runtime Detection Complete ===');
        this.logger.log(`Runtime: ${this.runtime}`);
        this.logger.log(`Name: ${this.capabilities.name}`);
        this.logger.log(`VS Code API: ${this.supportsVSCodeAPI()}`);
        this.logger.log(`Commands: ${this.supportsCommands()}`);
        this.logger.log(`FileSystem Poller: ${this.requiresFileSystemPoller()}`);

        const strategy = this.getOptimalCaptureStrategy();
        this.logger.log('Optimal Capture Strategy:');
        this.logger.log(`  - OnDidSave: ${strategy.useOnDidSaveTextDocument}`);
        this.logger.log(`  - OnDidChange: ${strategy.useOnDidChangeTextDocument}`);
        this.logger.log(`  - FileSystemWatcher: ${strategy.useFileSystemWatcher}`);
        this.logger.log(`  - FileSystemPoller: ${strategy.useFileSystemPoller}`);
        if (strategy.pollInterval) {
            this.logger.log(`  - Poll Interval: ${strategy.pollInterval}ms`);
        }
        this.logger.log('================================');
    }
}
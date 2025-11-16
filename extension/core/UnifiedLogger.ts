import * as vscode from 'vscode';

/**
 * UnifiedLogger - Single source of truth for all Reasoning Layer output
 * Ensures all cognitive logs, onboarding, and feedback are streamed
 * through the "RL3" Output Channel
 */
export class UnifiedLogger {
    private static instance: UnifiedLogger;
    private channel: vscode.OutputChannel;

    private constructor() {
        // RL4 Kernel - Isolated output channel (avoids conflict with RL3 legacy)
        this.channel = vscode.window.createOutputChannel('RL4 Kernel');
    }

    /**
     * Get singleton instance
     */
    public static getInstance(): UnifiedLogger {
        if (!UnifiedLogger.instance) {
            UnifiedLogger.instance = new UnifiedLogger();
        }
        return UnifiedLogger.instance;
    }

    /**
     * Show and focus the channel
     */
    public show(): void {
        this.channel.show(true);
        
        // Force focus with double toggle hack
        setTimeout(() => {
            vscode.commands.executeCommand('workbench.action.output.toggleOutput');
            vscode.commands.executeCommand('workbench.action.output.toggleOutput');
        }, 100);
    }

    /**
     * Log startup header
     */
    public logStartup(workspaceName: string, totalEvents: number, githubConnected: boolean): void {
        this.channel.clear();
        this.channel.appendLine('');
        this.channel.appendLine('=== RL4 KERNEL — Session Start ===');
        this.channel.appendLine(`Workspace: ${workspaceName}`);
        this.channel.appendLine(`Total Events: ${totalEvents}`);
        this.channel.appendLine(`GitHub Status: ${githubConnected ? '✅ Connected' : '⚠️ Not linked'}`);
        this.channel.appendLine('==========================================');
        this.channel.appendLine('');
        this.show();
    }

    /**
     * Log minimalist onboarding for first run
     */
    public logOnboarding(): void {
        this.channel.appendLine('');
        this.channel.appendLine('Welcome 👋 This is your Reasoning Layer V3.');
        this.channel.appendLine('I will observe your workspace, learn its patterns, and guide your next steps.');
        this.channel.appendLine('Type "Reasoning › Execute › Run Autopilot" to begin.');
        this.channel.appendLine('');
    }

    /**
     * Log message
     */
    public log(message: string): void {
        this.channel.appendLine(message);
    }

    /**
     * Log with emoji
     */
    public logWithEmoji(emoji: string, message: string): void {
        this.channel.appendLine(`${emoji} ${message}`);
    }

    /**
     * Log a warning message
     */
    public warn(message: string): void {
        this.channel.appendLine(`⚠️ WARNING: ${message}`);
        console.warn(`RL3 WARN: ${message}`);
    }

    /**
     * Get the channel instance (for subsystems)
     */
    public getChannel(): vscode.OutputChannel {
        return this.channel;
    }

    /**
     * Dispose (cleanup)
     */
    public dispose(): void {
        this.channel.dispose();
    }
}


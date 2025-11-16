import * as fs from 'fs';
import * as path from 'path';
import { CommandEntry } from './CodeScanner';
import { UnifiedLogger } from '../UnifiedLogger';

/**
 * RL3Executor - Execute commands/functions based on intents
 * 
 * Purpose: Execute TypeScript functions or VS Code commands based on intent matches
 */
export class RL3Executor {
    private workspaceRoot: string;
    private logger: UnifiedLogger;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.logger = UnifiedLogger.getInstance();
    }

    /**
     * Execute a command entry (function or method)
     * 
     * Note: This executes Node.js modules, not VS Code extension code directly
     * For VS Code commands, use executeVSCodeCommand() instead
     */
    public async executeCommand(entry: CommandEntry, args?: any[]): Promise<any> {
        try {
            const fullPath = path.join(this.workspaceRoot, 'extension', entry.file);

            // Check if file exists
            if (!fs.existsSync(fullPath)) {
                return {
                    success: false,
                    error: `File not found: ${entry.file}`,
                    message: `⚠️ Cannot execute: file ${entry.file} does not exist`
                };
            }

            // For now, we'll log the execution intent
            // Actual execution requires dynamic import which is complex for compiled TS
            this.logger.log(`⚙️ Intent d'exécution: ${entry.function} dans ${entry.file}`);

            return {
                success: true,
                function: entry.function,
                file: entry.file,
                message: `✅ Commande trouvée: ${entry.function} (${entry.file})`,
                note: 'Exécution directe disponible uniquement pour modules Node.js standalone'
            };

        } catch (error: any) {
            return {
                success: false,
                error: error.message,
                message: `❌ Erreur lors de l'exécution: ${error.message}`
            };
        }
    }

    /**
     * Map intent to VS Code command
     * 
     * Many RL3 functions are exposed as VS Code commands
     */
    public mapIntentToVSCodeCommand(intent: string): string | null {
        const intentToCommand: Record<string, string> = {
            analyze: 'reasoning.captureNow',
            status: 'reasoning.showOutput',
            context: 'reasoning.showOutput',
            reflect: 'reasoning.showOutput', // Will use custom logic
            synthesize: 'reasoning.showOutput',
            go: 'reasoning.showOutput',
            help: 'reasoning.showOutput'
        };

        return intentToCommand[intent] || null;
    }

    /**
     * Format execution result for display
     */
    public formatResult(result: any): string {
        if (result.success) {
            return `${result.message}`;
        } else {
            return `${result.message}`;
        }
    }
}


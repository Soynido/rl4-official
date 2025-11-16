import * as fs from 'fs';
import * as path from 'path';
import { CodeScanner, CommandEntry, CommandRegistry } from './CodeScanner';

/**
 * IntentRouter - Map intents to executable functions
 * 
 * Purpose: Connect natural language intents to actual TypeScript functions
 */
export class IntentRouter {
    private workspaceRoot: string;
    private registryPath: string;
    private registry: CommandRegistry | null = null;
    private codeScanner: CodeScanner;

    // Intent to keyword mapping (for matching function names)
    private readonly intentKeywords: Record<string, string[]> = {
        analyze: ['analyze', 'analysis', 'examine', 'inspect', 'check', 'scan', 'audit'],
        status: ['status', 'state', 'health', 'info', 'report', 'summary', 'overview'],
        reflect: ['reflect', 'review', 'summary', 'recap', 'daily', 'report'],
        synthesize: ['synthesize', 'generate', 'create', 'build', 'make', 'produce'],
        go: ['go', 'execute', 'run', 'launch', 'start', 'perform', 'do'],
        help: ['help', 'assist', 'guide', 'support', 'documentation'],
        context: ['context', 'contexte', 'background', 'history'],
        patterns: ['pattern', 'motif', 'recurring', 'repeat'],
        correlations: ['correlation', 'relation', 'link', 'connection'],
        adrs: ['adr', 'decision', 'architecture', 'choice'],
        task: ['task', 'todo', 'plan', 'action', 'work'],
        commit: ['commit', 'commits', 'git', 'push'],
        file: ['file', 'files', 'document', 'code'],
        test: ['test', 'testing', 'spec', 'verify']
    };

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.registryPath = path.join(workspaceRoot, '.reasoning', 'commands.json');
        this.codeScanner = new CodeScanner(workspaceRoot);
    }

    /**
     * Initialize router (load or generate registry)
     */
    public async initialize(): Promise<void> {
        // Try to load existing registry
        this.registry = this.codeScanner.loadRegistry(this.registryPath);

        // If not found or stale, regenerate
        if (!this.registry || this.isRegistryStale(this.registry)) {
            await this.generateRegistry();
        }
    }

    /**
     * Check if registry is stale (older than 24 hours or missing entries)
     */
    private isRegistryStale(registry: CommandRegistry): boolean {
        const generatedAt = new Date(registry.generatedAt);
        const now = new Date();
        const hoursDiff = (now.getTime() - generatedAt.getTime()) / (1000 * 60 * 60);
        
        return hoursDiff > 24 || registry.commands.length === 0;
    }

    /**
     * Generate command registry by scanning code
     */
    private async generateRegistry(): Promise<void> {
        const entries = await this.codeScanner.scan();
        const registry: CommandRegistry = {
            generatedAt: new Date().toISOString(),
            totalCommands: entries.length,
            commands: entries
        };

        await this.codeScanner.saveRegistry(entries, this.registryPath);
        this.registry = registry;
    }

    /**
     * Find commands matching an intent
     */
    public findCommands(intent: string, inputText?: string): CommandEntry[] {
        if (!this.registry) {
            return [];
        }

        const keywords = this.intentKeywords[intent] || [intent];
        const candidates: Array<{ entry: CommandEntry; score: number }> = [];

        for (const entry of this.registry.commands) {
            let score = 0;

            // Check function name against intent keywords
            const functionLower = entry.function.toLowerCase();
            for (const keyword of keywords) {
                if (functionLower.includes(keyword.toLowerCase())) {
                    score += 10;
                }
            }

            // Check description against intent keywords
            if (entry.description) {
                const descLower = entry.description.toLowerCase();
                for (const keyword of keywords) {
                    if (descLower.includes(keyword.toLowerCase())) {
                        score += 5;
                    }
                }
            }

            // Check input text for additional context
            if (inputText) {
                const inputLower = inputText.toLowerCase();
                const functionWords = functionLower.split(/[._-]/);
                for (const word of functionWords) {
                    if (inputLower.includes(word)) {
                        score += 3;
                    }
                }
            }

            if (score > 0) {
                candidates.push({ entry, score });
            }
        }

        // Sort by score (highest first)
        candidates.sort((a, b) => b.score - a.score);

        return candidates.map(c => c.entry);
    }

    /**
     * Get all available commands (for help/debugging)
     */
    public getAllCommands(): CommandEntry[] {
        return this.registry?.commands || [];
    }
}


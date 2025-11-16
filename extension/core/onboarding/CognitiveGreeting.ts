import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedLogger } from '../UnifiedLogger';

/**
 * Show cognitive greeting on workspace activation
 * Dynamic message based on confidence, last event, and time elapsed
 */
export async function showCognitiveGreeting(workspaceRoot: string): Promise<void> {
    const reasoningDir = path.join(workspaceRoot, '.reasoning');
    const ctxPath = path.join(reasoningDir, 'current-context.json');

    if (!fs.existsSync(ctxPath)) {
        return; // no reasoning state yet
    }

    const context = JSON.parse(fs.readFileSync(ctxPath, 'utf8'));
    const logger = UnifiedLogger.getInstance();

    // Small randomization to make it feel alive
    const greetings = [
        `Good morning, confidence ${format(context.confidence)} — ready to learn again.`,
        `Back online. Confidence ${format(context.confidence)}.`,
        `I kept thinking while you were gone. Confidence ${format(context.confidence)}.`,
        `Welcome back. ${context.repo ? `Tracking ${context.repo}` : 'Local memory active.'}`,
        `Reasoning resumed — pulse stable at ${format(context.confidence)}.`,
    ];
    
    const message = greetings[Math.floor(Math.random() * greetings.length)];

    logger.log('');
    logger.log(`🧠 ${message}`);
    logger.log('→ Observing workspace...');
    logger.log('→ Run "Reasoning › Execute › Run Autopilot" to begin your next cycle.');
    logger.log('');
}

/**
 * Format confidence as percentage
 */
function format(v: number): string {
    return (v * 100).toFixed(1) + '%';
}


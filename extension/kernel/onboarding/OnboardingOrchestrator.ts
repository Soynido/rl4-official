/**
 * OnboardingOrchestrator - Routes to appropriate first-time experience
 * 
 * Main entry point for RL4 onboarding system.
 * Detects workspace state and shows appropriate experience:
 * - Existing project → ExistingWorkspaceOnboarding
 * - New project → NewWorkspaceOnboarding
 * - Ambiguous → Ask user to clarify
 * 
 * Part of Phase E6 - Dual-Mode Onboarding
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CognitiveLogger } from '../CognitiveLogger';
import { detectWorkspaceState, formatWorkspaceState, WorkspaceState } from './OnboardingDetector';
import { runExistingWorkspaceOnboarding } from './ExistingWorkspaceOnboarding';
import { runNewWorkspaceOnboarding } from './NewWorkspaceOnboarding';

export interface OnboardingResult {
    completed: boolean;
    mode: 'existing' | 'new' | 'ambiguous';
    action: string;
    skipped: boolean;
}

/**
 * Run onboarding flow (main entry point)
 * 
 * @param workspaceRoot - Path to workspace root
 * @param logger - Cognitive logger instance
 * @returns Onboarding result with completion status
 */
export async function runOnboarding(
    workspaceRoot: string,
    logger: CognitiveLogger
): Promise<OnboardingResult> {
    
    try {
        // Step 1: Detect workspace state
        logger.narrative('🔍 Analyzing workspace...');
        
        const state = await detectWorkspaceState(workspaceRoot);
        
        logger.narrative(`   • Git commits: ${state.evidence.git_commits}`);
        logger.narrative(`   • Files: ${state.evidence.files_count}`);
        logger.narrative(`   • Detected mode: ${state.mode} (confidence: ${Math.round(state.confidence * 100)}%)`);
        logger.narrative('');
        
        // Step 2: Route to appropriate onboarding experience
        if (state.mode === 'existing') {
            // Existing project with history
            const result = await runExistingWorkspaceOnboarding(workspaceRoot, state, logger);
            return {
                completed: result.completed,
                mode: 'existing',
                action: result.action,
                skipped: !result.completed
            };
            
        } else if (state.mode === 'new') {
            // New project from scratch
            const result = await runNewWorkspaceOnboarding(workspaceRoot, state, logger);
            return {
                completed: result.completed,
                mode: 'new',
                action: result.action,
                skipped: !result.completed
            };
            
        } else {
            // Ambiguous state - ask user
            const result = await runAmbiguousWorkspaceOnboarding(workspaceRoot, state, logger);
            return {
                completed: result.completed,
                mode: 'ambiguous',
                action: result.action,
                skipped: !result.completed
            };
        }
        
    } catch (error) {
        logger.error(`Onboarding failed: ${error}`);
        
        // Fallback: skip onboarding and start normally
        logger.narrative('⚠️ Onboarding encountered an error. Starting with defaults.');
        logger.narrative('');
        
        return {
            completed: false,
            mode: 'new',
            action: 'error_fallback',
            skipped: true
        };
    }
}

/**
 * Handle ambiguous workspace (unclear if existing or new)
 */
async function runAmbiguousWorkspaceOnboarding(
    workspaceRoot: string,
    state: WorkspaceState,
    logger: CognitiveLogger
): Promise<{ completed: boolean; action: string }> {
    
    logger.narrative('');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('🧠 RL4 — First Awakening');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('');
    
    logger.narrative('I detect an ambiguous workspace state:');
    logger.narrative(`  • ${state.evidence.git_commits} commits`);
    logger.narrative(`  • ${state.evidence.files_count} files`);
    logger.narrative('');
    logger.narrative('This could be either:');
    logger.narrative('  • An existing project (analyze history)');
    logger.narrative('  • A new project (start fresh)');
    logger.narrative('');
    
    // Ask user to clarify
    const choice = await vscode.window.showQuickPick([
        {
            label: '$(history) Treat as Existing Project',
            description: 'Analyze Git history and build cognitive context',
            detail: `Reconstruct from ${state.evidence.git_commits} commits`,
            mode: 'existing'
        },
        {
            label: '$(play) Treat as New Project',
            description: 'Start fresh, ignore history',
            detail: 'Begin observing from now',
            mode: 'new'
        }
    ], {
        placeHolder: 'How should I treat this workspace?',
        ignoreFocusOut: true,
        title: 'RL4 Onboarding — Ambiguous Workspace'
    });
    
    if (!choice) {
        // User cancelled - skip onboarding
        logger.narrative('⏭️ Onboarding skipped.');
        logger.narrative('');
        logger.narrative('═══════════════════════════════════════════════');
        logger.narrative('');
        return { completed: false, action: 'cancelled' };
    }
    
    // Route to appropriate flow based on user choice
    if (choice.mode === 'existing') {
        const result = await runExistingWorkspaceOnboarding(workspaceRoot, state, logger);
        return { completed: result.completed, action: result.action };
    } else {
        const result = await runNewWorkspaceOnboarding(workspaceRoot, state, logger);
        return { completed: result.completed, action: result.action };
    }
}

/**
 * Check if onboarding has been completed before
 * 
 * @param workspaceRoot - Path to workspace root
 * @returns true if onboarding was already completed
 */
export function isOnboardingComplete(workspaceRoot: string): boolean {
    const markerPath = path.join(workspaceRoot, '.reasoning_rl4', '.onboarding_complete');
    return fs.existsSync(markerPath);
}

/**
 * Mark onboarding as complete
 * 
 * @param workspaceRoot - Path to workspace root
 * @param result - Onboarding result to store
 */
export function markOnboardingComplete(workspaceRoot: string, result: OnboardingResult): void {
    const rl4Dir = path.join(workspaceRoot, '.reasoning_rl4');
    
    // Ensure directory exists
    if (!fs.existsSync(rl4Dir)) {
        fs.mkdirSync(rl4Dir, { recursive: true });
    }
    
    // Write marker file with metadata
    const markerPath = path.join(rl4Dir, '.onboarding_complete');
    const metadata = {
        completed_at: new Date().toISOString(),
        mode: result.mode,
        action: result.action,
        version: '1.0'
    };
    
    fs.writeFileSync(markerPath, JSON.stringify(metadata, null, 2), 'utf-8');
}

/**
 * Reset onboarding (for testing or user request)
 * 
 * @param workspaceRoot - Path to workspace root
 */
export function resetOnboarding(workspaceRoot: string): void {
    const markerPath = path.join(workspaceRoot, '.reasoning_rl4', '.onboarding_complete');
    
    if (fs.existsSync(markerPath)) {
        fs.unlinkSync(markerPath);
    }
}


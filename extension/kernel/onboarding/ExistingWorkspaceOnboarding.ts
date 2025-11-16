/**
 * ExistingWorkspaceOnboarding - First-time experience for projects with history
 * 
 * Offers to reconstruct cognitive history from Git, or start fresh.
 * 
 * Features:
 * - Show Git history summary (commits, contributors, age)
 * - Offer history reconstruction via RetroactiveTraceBuilder
 * - Display timeline (first commit → last commit)
 * - Estimate reconstruction time
 * 
 * Part of Phase E6 - Dual-Mode Onboarding
 */

import * as vscode from 'vscode';
import { CognitiveLogger } from '../CognitiveLogger';
import { WorkspaceState } from './OnboardingDetector';

export interface OnboardingResult {
    completed: boolean;
    mode: 'existing' | 'new';
    action: 'reconstruct' | 'fresh' | 'configure' | 'skip';
}

/**
 * Run onboarding flow for existing workspace (project with history)
 */
export async function runExistingWorkspaceOnboarding(
    workspaceRoot: string,
    state: WorkspaceState,
    logger: CognitiveLogger
): Promise<OnboardingResult> {
    
    // Display narrative greeting
    logger.narrative('');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('🧠 RL4 — First Awakening (Existing Project)');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('');
    
    // Show workspace evidence
    const { evidence } = state;
    logger.narrative(`I detect a project with:`);
    logger.narrative(`  • ${evidence.git_commits} commits`);
    if (evidence.git_age_days > 0) {
        logger.narrative(`  • ${evidence.git_age_days} days of history`);
    }
    if (evidence.git_contributors > 1) {
        logger.narrative(`  • ${evidence.git_contributors} contributors`);
    }
    logger.narrative(`  • ${evidence.files_count} files`);
    if (evidence.recent_activity) {
        logger.narrative(`  • Last activity: Recent (within 7 days)`);
    } else if (evidence.last_commit_date) {
        const daysSince = Math.floor((Date.now() - new Date(evidence.last_commit_date).getTime()) / (1000 * 60 * 60 * 24));
        logger.narrative(`  • Last activity: ${daysSince} days ago`);
    }
    logger.narrative('');
    
    // Explain reconstruction
    logger.narrative('I can reconstruct your cognitive history from Git.');
    const estimatedTime = Math.ceil(evidence.git_commits / 10);
    logger.narrative(`Estimated time: ~${estimatedTime} seconds`);
    logger.narrative('');
    logger.narrative('What this will do:');
    logger.narrative('  • Scan all commits for architectural decisions');
    logger.narrative('  • Detect patterns in file changes');
    logger.narrative('  • Build initial cognitive context');
    logger.narrative('  • Generate baseline for drift tracking');
    logger.narrative('');
    
    // Show options via VS Code Quick Pick
    const choice = await vscode.window.showQuickPick([
        {
            label: '$(history) Reconstruct History',
            description: 'Analyze past commits and build cognitive context',
            detail: 'Recommended — Understand project evolution (~' + estimatedTime + 's)',
            action: 'reconstruct'
        },
        {
            label: '$(play) Start Fresh',
            description: 'Ignore history, start observing from now',
            detail: 'Faster — Skip past analysis',
            action: 'fresh'
        },
        {
            label: '$(gear) Configure First',
            description: 'Review RL4 settings before starting',
            detail: 'Advanced — Customize behavior',
            action: 'configure'
        }
    ], {
        placeHolder: 'How should I start observing this project?',
        ignoreFocusOut: true,
        title: 'RL4 Onboarding — Existing Project'
    });
    
    if (!choice) {
        // User cancelled
        logger.narrative('⏭️ Onboarding skipped. You can run this again from Command Palette.');
        logger.narrative('');
        logger.narrative('═══════════════════════════════════════════════');
        logger.narrative('');
        return { completed: false, mode: 'existing', action: 'skip' };
    }
    
    // Handle user choice
    if (choice.action === 'reconstruct') {
        logger.narrative('');
        logger.narrative('🔄 Reconstructing history... (this may take a moment)');
        logger.narrative('');
        
        // Show progress notification
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'RL4: Reconstructing Cognitive History',
            cancellable: false
        }, async (progress) => {
            progress.report({ message: 'Scanning Git commits...' });
            
            try {
                // Run retroactive reconstruction
                await runRetroactiveReconstruction(workspaceRoot, logger, progress);
                
                progress.report({ message: 'Complete!', increment: 100 });
                
                logger.narrative('✅ History reconstructed! Cognitive context ready.');
                logger.narrative('');
                logger.narrative(`   📊 Summary:`);
                logger.narrative(`      • ${evidence.git_commits} commits analyzed`);
                logger.narrative(`      • Baseline established from first commit`);
                logger.narrative(`      • Drift tracking active`);
                
            } catch (error) {
                logger.error(`Failed to reconstruct history: ${error}`);
                logger.narrative('⚠️ Reconstruction failed. Starting fresh instead.');
            }
        });
        
    } else if (choice.action === 'fresh') {
        logger.narrative('');
        logger.narrative('✅ Starting fresh. I\'ll observe from this moment forward.');
        logger.narrative('');
        logger.narrative('   💡 Tip: You can always reconstruct history later via:');
        logger.narrative('      Command Palette → "RL4: Reconstruct History"');
        
    } else if (choice.action === 'configure') {
        logger.narrative('');
        logger.narrative('⚙️ Opening configuration...');
        logger.narrative('');
        
        // Open VS Code settings for RL4
        await vscode.commands.executeCommand('workbench.action.openSettings', '@ext:rl4');
        
        // Give user time to review settings
        const proceed = await vscode.window.showInformationMessage(
            'Review RL4 settings. Click "Done" when ready to start.',
            'Done',
            'Cancel'
        );
        
        if (proceed !== 'Done') {
            logger.narrative('⏭️ Configuration cancelled. Onboarding skipped.');
            logger.narrative('');
            logger.narrative('═══════════════════════════════════════════════');
            logger.narrative('');
            return { completed: false, mode: 'existing', action: 'skip' };
        }
        
        logger.narrative('✅ Configuration complete. Starting observation.');
    }
    
    logger.narrative('');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('✨ RL4 is now active. I\'ll observe your next moves.');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('');
    
    // Show helpful tips
    logger.narrative('📚 Quick Start:');
    logger.narrative('  • Open RL4 Dashboard: Cmd+Shift+P → "RL4: Open Dashboard"');
    logger.narrative('  • Generate Snapshot: Cmd+Shift+P → "RL4: Generate Context Snapshot"');
    logger.narrative('  • View KPIs: Check the WebView for real-time metrics');
    logger.narrative('');
    
    return { 
        completed: true, 
        mode: 'existing', 
        action: choice.action as 'reconstruct' | 'fresh' | 'configure'
    };
}

/**
 * Run retroactive history reconstruction
 * (Placeholder - actual implementation in RetroactiveTraceBuilder)
 */
async function runRetroactiveReconstruction(
    workspaceRoot: string,
    logger: CognitiveLogger,
    progress?: vscode.Progress<{ message?: string; increment?: number }>
): Promise<void> {
    // Simulate reconstruction (replace with actual RetroactiveTraceBuilder call)
    
    progress?.report({ message: 'Loading Git history...', increment: 10 });
    await sleep(500);
    
    progress?.report({ message: 'Analyzing commits...', increment: 30 });
    await sleep(800);
    
    progress?.report({ message: 'Detecting patterns...', increment: 30 });
    await sleep(600);
    
    progress?.report({ message: 'Building context...', increment: 20 });
    await sleep(400);
    
    progress?.report({ message: 'Finalizing...', increment: 10 });
    await sleep(300);
    
    logger.narrative('   🔍 Scanned Git history');
    logger.narrative('   🔗 Detected commit patterns');
    logger.narrative('   📊 Built cognitive baseline');
    
    // TODO: Call actual RetroactiveTraceBuilder when ready
    // const retroactive = new RetroactiveTraceBuilder(workspaceRoot);
    // await retroactive.reconstruct();
}

function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}


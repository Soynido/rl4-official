/**
 * NewWorkspaceOnboarding - First-time experience for new projects
 * 
 * Provides welcoming introduction and optional quick setup wizard.
 * 
 * Features:
 * - Welcome message (clean slate narrative)
 * - Explain what RL4 observes (and what it doesn't)
 * - Optional Quick Setup: 3 questions (2 minutes)
 *   1. Deviation Mode (Strict/Flexible/Exploratory/Free)
 *   2. Snapshot Frequency (5min/10min/30min)
 *   3. LLM Integration (Enable/Disable)
 * 
 * Part of Phase E6 - Dual-Mode Onboarding
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CognitiveLogger } from '../CognitiveLogger';
import { WorkspaceState } from './OnboardingDetector';

export interface OnboardingResult {
    completed: boolean;
    mode: 'existing' | 'new';
    action: 'setup' | 'skip';
}

/**
 * Run onboarding flow for new workspace (fresh project)
 */
export async function runNewWorkspaceOnboarding(
    workspaceRoot: string,
    state: WorkspaceState,
    logger: CognitiveLogger
): Promise<OnboardingResult> {
    
    // Display narrative greeting
    logger.narrative('');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('🧠 RL4 — Welcome to Your New Project');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('');
    
    logger.narrative('I\'ll accompany you from the very first commit.');
    logger.narrative('');
    
    // Explain what RL4 observes
    logger.narrative('📊 What I\'ll observe:');
    logger.narrative('  • Files you edit (frequency, bursts, patterns)');
    logger.narrative('  • Commits you make (decisions, refactors)');
    logger.narrative('  • Cognitive load (parallel tasks, context switches)');
    logger.narrative('  • Plan drift (goals vs reality over time)');
    logger.narrative('');
    
    // Explain what RL4 doesn't do
    logger.narrative('🔒 What I WON\'T do:');
    logger.narrative('  • Read your source code (only metadata: filenames, timestamps)');
    logger.narrative('  • Send data to servers (everything stays local in .reasoning_rl4/)');
    logger.narrative('  • Interrupt your workflow (passive observation mode)');
    logger.narrative('  • Make changes to your code (read-only watcher)');
    logger.narrative('');
    
    // Show setup options
    const choice = await vscode.window.showQuickPick([
        {
            label: '$(rocket) Quick Setup',
            description: '3 questions to personalize your experience',
            detail: 'Recommended — Takes 2 minutes',
            action: 'setup'
        },
        {
            label: '$(play) Skip Setup',
            description: 'Use defaults, start observing immediately',
            detail: 'Faster — You can configure later in Settings',
            action: 'skip'
        }
    ], {
        placeHolder: 'How would you like to start?',
        ignoreFocusOut: true,
        title: 'RL4 Onboarding — New Project'
    });
    
    if (!choice) {
        // User cancelled
        logger.narrative('⏭️ Onboarding skipped. You can run this again from Command Palette.');
        logger.narrative('');
        logger.narrative('═══════════════════════════════════════════════');
        logger.narrative('');
        return { completed: false, mode: 'new', action: 'skip' };
    }
    
    // Handle user choice
    if (choice.action === 'setup') {
        logger.narrative('');
        logger.narrative('📝 Quick Setup — 3 questions...');
        logger.narrative('');
        
        try {
            await runQuickSetup(workspaceRoot, logger);
            logger.narrative('');
            logger.narrative('✅ Configuration saved successfully!');
        } catch (error) {
            logger.error(`Quick Setup failed: ${error}`);
            logger.narrative('⚠️ Setup failed. Using default configuration.');
        }
    } else {
        logger.narrative('');
        logger.narrative('✅ Using default configuration.');
        logger.narrative('');
        logger.narrative('   💡 You can customize settings anytime:');
        logger.narrative('      Settings → Extensions → RL4');
    }
    
    logger.narrative('');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('✨ RL4 is now active. Make your first edit!');
    logger.narrative('═══════════════════════════════════════════════');
    logger.narrative('');
    
    // Show helpful tips
    logger.narrative('📚 Getting Started:');
    logger.narrative('  • RL4 observes in the background — no action needed');
    logger.narrative('  • First snapshot will generate after 10 minutes of activity');
    logger.narrative('  • View real-time KPIs: Cmd+Shift+P → "RL4: Open Dashboard"');
    logger.narrative('  • Generate snapshot manually: Cmd+Shift+P → "RL4: Generate Context Snapshot"');
    logger.narrative('');
    
    return { 
        completed: true, 
        mode: 'new', 
        action: choice.action as 'setup' | 'skip'
    };
}

/**
 * Run Quick Setup wizard (3 questions)
 */
async function runQuickSetup(
    workspaceRoot: string,
    logger: CognitiveLogger
): Promise<void> {
    
    // Question 1: Deviation Mode
    logger.narrative('1/3: How strict should I be about plan adherence?');
    
    const modeChoice = await vscode.window.showQuickPick([
        { 
            label: 'Strict', 
            description: 'Follow plan exactly (0% deviation allowed)', 
            detail: 'Best for: Production projects, critical systems',
            value: 'strict' 
        },
        { 
            label: 'Flexible', 
            description: 'Allow minor deviations (25% threshold)', 
            detail: 'Recommended for most projects — Balance between rigor and creativity',
            value: 'flexible' 
        },
        { 
            label: 'Exploratory', 
            description: 'Encourage experimentation (50% threshold)', 
            detail: 'Best for: Research, prototyping, learning',
            value: 'exploratory' 
        },
        { 
            label: 'Free', 
            description: 'No constraints (100% — disable drift tracking)', 
            detail: 'Best for: Personal experiments, hackathons',
            value: 'free' 
        }
    ], { 
        placeHolder: 'Choose deviation mode',
        ignoreFocusOut: true 
    });
    
    const deviationMode = modeChoice?.value || 'flexible';
    logger.narrative(`   ✓ Selected: ${modeChoice?.label || 'Flexible (default)'}`);
    logger.narrative('');
    
    // Question 2: Snapshot Frequency
    logger.narrative('2/3: How often should I take context snapshots?');
    
    const freqChoice = await vscode.window.showQuickPick([
        { 
            label: 'Every 5 minutes', 
            description: 'High frequency (more insights, more disk)', 
            detail: 'Best for: Rapid iteration, real-time feedback',
            value: 5 
        },
        { 
            label: 'Every 10 minutes', 
            description: 'Balanced (recommended)', 
            detail: 'Good balance between insights and performance',
            value: 10 
        },
        { 
            label: 'Every 30 minutes', 
            description: 'Low frequency (less data, lighter)', 
            detail: 'Best for: Large projects, slow-paced work',
            value: 30 
        }
    ], { 
        placeHolder: 'Choose snapshot frequency',
        ignoreFocusOut: true 
    });
    
    const snapshotInterval = freqChoice?.value || 10;
    logger.narrative(`   ✓ Selected: ${freqChoice?.label || 'Every 10 minutes (default)'}`);
    logger.narrative('');
    
    // Question 3: LLM Integration
    logger.narrative('3/3: Enable LLM integration for smart KPIs?');
    
    const llmChoice = await vscode.window.showQuickPick([
        { 
            label: 'Enable LLM Analysis', 
            description: 'Use GPT-4/Claude for KPI validation and insights', 
            detail: 'Recommended — Requires API key, enhances accuracy',
            value: true 
        },
        { 
            label: 'Disable LLM (Local-only)', 
            description: 'Calculate KPIs locally without API calls', 
            detail: 'Privacy-first — No external requests, basic metrics only',
            value: false 
        }
    ], { 
        placeHolder: 'Enable LLM integration?',
        ignoreFocusOut: true 
    });
    
    const llmEnabled = llmChoice?.value ?? true;
    logger.narrative(`   ✓ Selected: ${llmChoice?.label || 'Enable LLM Analysis (default)'}`);
    logger.narrative('');
    
    // Save configuration
    const configPath = path.join(workspaceRoot, '.reasoning_rl4', 'kernel_config.json');
    
    try {
        let config: any = {};
        
        // Load existing config if present
        if (fs.existsSync(configPath)) {
            config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        }
        
        // Update with user preferences
        config.deviation_mode = deviationMode;
        config.snapshot_interval_minutes = snapshotInterval;
        config.llm_enabled = llmEnabled;
        config.onboarding_completed_at = new Date().toISOString();
        
        // Ensure directory exists
        const rl4Dir = path.join(workspaceRoot, '.reasoning_rl4');
        if (!fs.existsSync(rl4Dir)) {
            fs.mkdirSync(rl4Dir, { recursive: true });
        }
        
        // Write config
        fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
        
        logger.narrative('   📝 Configuration saved:');
        logger.narrative(`      • Mode: ${deviationMode}`);
        logger.narrative(`      • Snapshots: Every ${snapshotInterval} minutes`);
        logger.narrative(`      • LLM: ${llmEnabled ? 'Enabled' : 'Disabled (local-only)'}`);
        
    } catch (error) {
        logger.error(`Failed to save configuration: ${error}`);
        throw error;
    }
}


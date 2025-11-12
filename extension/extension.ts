/**
 * RL4 Kernel - Ultra Minimal (Zero RL3 Dependencies)
 */

import * as vscode from 'vscode';
import { TimerRegistry } from './kernel/TimerRegistry';
import { StateRegistry } from './kernel/StateRegistry';
import { HealthMonitor } from './kernel/HealthMonitor';
import { CognitiveScheduler } from './kernel/CognitiveScheduler';
import { KernelAPI } from './kernel/KernelAPI';
import { ExecPool } from './kernel/ExecPool';
import { loadKernelConfig } from './kernel/config';
import { GitCommitListener } from './kernel/inputs/GitCommitListener';
import { FileChangeWatcher } from './kernel/inputs/FileChangeWatcher';
import { AppendOnlyWriter } from './kernel/AppendOnlyWriter';
import { KernelBootstrap } from './kernel/KernelBootstrap';
import { CognitiveLogger } from './kernel/CognitiveLogger';
import { ADRValidationCommands } from './commands/adr-validation';
import { UnifiedPromptBuilder } from './kernel/api/UnifiedPromptBuilder';
import { ADRParser } from './kernel/api/ADRParser';
import { PlanTasksContextParser } from './kernel/api/PlanTasksContextParser';
import * as path from 'path';

// Cognitive Logger
let logger: CognitiveLogger | null = null;

// RL4 Kernel
let kernel: {
    timerRegistry: TimerRegistry;
    stateRegistry: StateRegistry;
    healthMonitor: HealthMonitor;
    scheduler: CognitiveScheduler;
    execPool: ExecPool;
    api: KernelAPI;
} | null = null;

// WebView Panel
let webviewPanel: vscode.WebviewPanel | null = null;

// Status Bar Item
let statusBarItem: vscode.StatusBarItem | null = null;

export async function activate(context: vscode.ExtensionContext) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    if (!workspaceRoot) {
        vscode.window.showErrorMessage('RL4 Kernel requires a workspace folder');
        return;
    }
    
    // Create Cognitive Logger
    const outputChannel = vscode.window.createOutputChannel('RL4 Kernel');
    logger = new CognitiveLogger(workspaceRoot, outputChannel);
    outputChannel.show();
    
    logger.system('=== RL4 KERNEL — Cognitive Console ===', '🧠');
    logger.system(`Workspace: ${workspaceRoot}`, '📁');
    logger.system('=====================================', '═');
    
    // Load kernel configuration
    const kernelConfig = loadKernelConfig(workspaceRoot);
    
    // Initialize RL4 Kernel
    if (kernelConfig.USE_TIMER_REGISTRY) {
        logger.system('🔧 Initializing RL4 Kernel...', '🔧');
        
        // Create components
        const timerRegistry = new TimerRegistry();
        const stateRegistry = new StateRegistry(workspaceRoot);
        const healthMonitor = new HealthMonitor(workspaceRoot, timerRegistry);
        
        // Load bootstrap artifacts first (for ForecastEngine metrics)
        const bootstrap = KernelBootstrap.initialize(workspaceRoot);
        const forecastMetrics = bootstrap.metrics;
        
        const scheduler = new CognitiveScheduler(workspaceRoot, timerRegistry, logger, forecastMetrics);
        const execPool = new ExecPool(2, 2000, workspaceRoot);
        const api = new KernelAPI(
            timerRegistry,
            stateRegistry,
            healthMonitor,
            scheduler,
            new Map(),
            execPool
        );
        
        kernel = {
            timerRegistry,
            stateRegistry,
            healthMonitor,
            scheduler,
            execPool,
            api
        };
        
        logger.system('✅ RL4 Kernel components created', '✅');
        
        // Bootstrap already loaded above (before scheduler creation)
        if (bootstrap.initialized) {
            logger.system(`✅ Bootstrap complete: ${bootstrap.universals ? Object.keys(bootstrap.universals).length : 0} universals loaded`, '✅');
            
            // Load state into StateRegistry if available
            if (bootstrap.state) {
                // StateRegistry can be extended to accept loaded state
                logger.system('📦 Kernel state restored from artifacts', '📦');
            }
            
            // Log forecast baseline (now integrated into ForecastEngine)
            if (bootstrap.metrics?.forecast_precision) {
                logger.system(`📊 Forecast precision baseline: ${bootstrap.metrics.forecast_precision.toFixed(3)} (Phase E1 active)`, '📊');
            }
        } else {
            logger.warning('No kernel artifacts found, starting with default baseline (0.73)');
        }
        
        // Start health monitoring
        if (kernelConfig.USE_HEALTH_MONITOR) {
            healthMonitor.start(timerRegistry);
            logger.system('❤️ Health Monitor started', '❤️');
        }
        
        // Start CognitiveScheduler (double-delay for Extension Host stability)
        logger.system('🧠 Starting CognitiveScheduler (delayed start in 3s)...', '🧠');
        
        // External delay: Ensure kernel is fully initialized before scheduler starts
        const channel = outputChannel; // Capture for setTimeout callback
        setTimeout(async () => {
            channel.appendLine(`[${new Date().toISOString().substring(11, 23)}] ⏳ Scheduler: Starting delayed initialization...`);
            await scheduler.start(kernelConfig.cognitive_cycle_interval_ms);
            channel.appendLine(`[${new Date().toISOString().substring(11, 23)}] ✅ Scheduler started successfully`);
            channel.appendLine(`[${new Date().toISOString().substring(11, 23)}] 🛡️ Watchdog active (${kernelConfig.cognitive_cycle_interval_ms}ms cycles)`);
            
            // Start Input Layer: GitCommitListener + FileChangeWatcher
            channel.appendLine(`[${new Date().toISOString().substring(11, 23)}] 📥 Starting Input Layer...`);
            
            // 1. GitCommitListener
            const gitTracesWriter = new AppendOnlyWriter(path.join(workspaceRoot, '.reasoning_rl4', 'traces', 'git_commits.jsonl'));
            const gitListener = new GitCommitListener(workspaceRoot, execPool, gitTracesWriter, channel);
            
            if (gitListener.isGitRepository()) {
                await gitListener.startWatching();
                channel.appendLine(`[${new Date().toISOString().substring(11, 23)}] ✅ GitCommitListener active`);
            } else {
                channel.appendLine(`[${new Date().toISOString().substring(11, 23)}] ⚠️ Not a Git repository, GitCommitListener disabled`);
            }
            
            // 2. FileChangeWatcher
            const fileTracesWriter = new AppendOnlyWriter(path.join(workspaceRoot, '.reasoning_rl4', 'traces', 'file_changes.jsonl'));
            const fileWatcher = new FileChangeWatcher(workspaceRoot, fileTracesWriter, channel);
            await fileWatcher.startWatching();
            channel.appendLine(`[${new Date().toISOString().substring(11, 23)}] ✅ FileChangeWatcher active`);
        }, 3000);
        
        // Register minimal commands
            context.subscriptions.push(
                vscode.commands.registerCommand('reasoning.kernel.status', () => {
                const timers = kernel!.timerRegistry.getActiveCount();
                const memUsage = process.memoryUsage();
                const uptime = process.uptime();
                
                const message = 
                        `🧠 RL4 Kernel Status:\n` +
                    `Memory: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB\n` +
                    `Timers: ${timers.total}\n` +
                    `Uptime: ${Math.floor(uptime / 60)}min`;
                
                vscode.window.showInformationMessage(message);
                logger!.system(message);
            }),
            
                vscode.commands.registerCommand('reasoning.kernel.reflect', async () => {
                logger!.system('🧠 Running manual cycle...', '🧠');
                const result = await kernel!.scheduler.runCycle();
                const message = `✅ Cycle ${result.cycleId}: ${result.duration}ms, ${result.phases.length} phases`;
                vscode.window.showInformationMessage(message);
                logger!.system(message);
            }),
            
                vscode.commands.registerCommand('reasoning.kernel.flush', async () => {
                    await kernel!.api.flush();
                vscode.window.showInformationMessage('✅ Flushed');
                logger!.system('💾 All queues flushed', '💾');
            })
        );
        
        // Phase E2 Final: Register ADR Validation Commands
        ADRValidationCommands.registerCommands(context, workspaceRoot);
        
        // Phase E2.7: Create Status Bar Item for WebView
        statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
        statusBarItem.text = '$(brain) RL4 Dashboard';
        statusBarItem.tooltip = 'Click to open/close RL4 Cognitive Dashboard';
        statusBarItem.command = 'rl4.toggleWebview';
        statusBarItem.show();
        context.subscriptions.push(statusBarItem);
        logger.system('✅ Status Bar item created', '✅');
        
        // Phase E2.7: Create WebView Dashboard with auto-push snapshots
        logger.system('🖥️ Creating RL4 Dashboard WebView...', '🖥️');
        
        webviewPanel = vscode.window.createWebviewPanel(
            'rl4Webview',
            '🧠 RL4 Dashboard',
            { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(context.extensionUri, 'extension', 'webview', 'ui', 'dist')
                ]
            }
        );
        
        // Load WebView HTML
        webviewPanel.webview.html = getWebviewHtml(context, webviewPanel);
        logger.system('✅ WebView HTML loaded', '✅');
        
        // Phase E3.3: Handle messages from WebView
        const rl4Path = path.join(workspaceRoot, '.reasoning_rl4');
        const promptBuilder = new UnifiedPromptBuilder(rl4Path);
        const adrParser = new ADRParser(rl4Path);
        const planParser = new PlanTasksContextParser(rl4Path);
        
        // Helper: Send Context.RL4 to WebView for initial KPI load
        const sendContextToWebView = async () => {
            if (webviewPanel) {
                try {
                    const fs = await import('fs/promises');
                    const contextPath = path.join(rl4Path, 'Context.RL4');
                    const contextContent = await fs.readFile(contextPath, 'utf-8');
                    
                    webviewPanel.webview.postMessage({
                        type: 'kpisUpdated',
                        payload: contextContent
                    });
                    
                    logger!.system('✅ Initial Context.RL4 sent to WebView', '✅');
                } catch (error) {
                    logger!.system(`⚠️ Context.RL4 not found yet (will use mock data)`, '⚠️');
                }
            }
        };
        
        // Wait 500ms for WebView to be ready, then send initial Context.RL4
        setTimeout(sendContextToWebView, 500);

        // Initialize default Plan/Tasks/Context files if needed
        await promptBuilder.initializeDefaults();

        webviewPanel.webview.onDidReceiveMessage(
            async (message) => {
                console.log('[RL4 Extension] Received message from WebView:', message.type);
                
                switch (message.type) {
                    case 'generateSnapshot':
                        try {
                            const deviationMode = message.deviationMode || 'flexible';
                            logger!.system(`📋 Generating snapshot (mode: ${deviationMode})...`, '📋');
                            const snapshot = await promptBuilder.generate(deviationMode);
                            
                            webviewPanel!.webview.postMessage({
                                type: 'snapshotGenerated',
                                payload: snapshot
                            });
                            
                            logger!.system(`✅ Snapshot generated (${snapshot.length} chars)`, '✅');
                        } catch (error) {
                            logger!.error(`Failed to generate snapshot: ${error}`);
                            webviewPanel!.webview.postMessage({
                                type: 'error',
                                payload: 'Failed to generate snapshot'
                            });
                        }
                        break;
                }
            },
            undefined,
            context.subscriptions
        );
        
        // Phase E3.3: Setup FileWatchers for Plan/Tasks/Context/ADRs.RL4
        const planWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(rl4Path, 'Plan.RL4')
        );
        const tasksWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(rl4Path, 'Tasks.RL4')
        );
        const contextWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(rl4Path, 'Context.RL4')
        );
        const adrWatcher = vscode.workspace.createFileSystemWatcher(
            new vscode.RelativePattern(rl4Path, 'ADRs.RL4')
        );

        // Handle Plan.RL4 changes
        planWatcher.onDidChange(async () => {
            logger!.system('📋 Plan.RL4 changed, recalculating metrics...', '📋');
            // Confidence/bias will be recalculated on next snapshot generation
        });

        // Handle Tasks.RL4 changes
        tasksWatcher.onDidChange(async () => {
            logger!.system('✅ Tasks.RL4 changed, updating state...', '✅');
        });

        // Handle Context.RL4 changes → Send to WebView for KPI update
        contextWatcher.onDidChange(async () => {
            logger!.system('🔍 Context.RL4 changed, refreshing...', '🔍');
            
            // Read Context.RL4 and send to WebView for KPI parsing
            if (webviewPanel) {
                try {
                    const fs = await import('fs/promises');
                    const contextPath = path.join(rl4Path, 'Context.RL4');
                    const contextContent = await fs.readFile(contextPath, 'utf-8');
                    
                    webviewPanel.webview.postMessage({
                        type: 'kpisUpdated',
                        payload: contextContent
                    });
                    
                    logger!.system('✅ Context.RL4 sent to WebView for KPI update', '✅');
                } catch (error) {
                    logger!.error(`Failed to read Context.RL4: ${error}`);
                }
            }
        });

        // Handle ADRs.RL4 changes (parse and append to ledger)
        adrWatcher.onDidChange(async () => {
            logger!.system('📜 ADRs.RL4 changed, processing...', '📜');
            const result = adrParser.processADRsFile();
            
            if (result.added > 0) {
                vscode.window.showInformationMessage(
                    `✅ RL4: ${result.added} new ADR(s) added to ledger`
                );
                logger!.system(`✅ ${result.added} ADR(s) appended to ledger`, '✅');
            }
        });

        adrWatcher.onDidCreate(async () => {
            logger!.system('📜 ADRs.RL4 created, processing...', '📜');
            const result = adrParser.processADRsFile();
            
            if (result.added > 0) {
                vscode.window.showInformationMessage(
                    `✅ RL4: Processed ${result.added} ADR(s)`
                );
            }
        });

        context.subscriptions.push(planWatcher, tasksWatcher, contextWatcher, adrWatcher);
        logger.system('✅ FileWatchers registered for Plan/Tasks/Context/ADRs.RL4', '✅');
        
        // Phase E3.3: No auto-push, WebView requests snapshot on demand via 'generateSnapshot' message
        
        // Clean up on panel dispose
        webviewPanel.onDidDispose(() => {
            webviewPanel = null;
            if (statusBarItem) {
                statusBarItem.text = '$(brain) RL4 Dashboard';
                statusBarItem.tooltip = 'Click to open RL4 Cognitive Dashboard';
            }
            logger!.system('🖥️ WebView disposed', '🖥️');
        }, null, context.subscriptions);
        
        // Add command to toggle WebView
        context.subscriptions.push(
            vscode.commands.registerCommand('rl4.toggleWebview', () => {
                if (webviewPanel) {
                    webviewPanel.reveal(vscode.ViewColumn.Two);
                    if (statusBarItem) {
                        statusBarItem.text = '$(brain) RL4 Dashboard $(check)';
                        statusBarItem.tooltip = 'RL4 Dashboard is open';
                    }
                    logger!.system('🖥️ WebView revealed', '🖥️');
                } else {
                    // Recreate WebView if disposed
                    webviewPanel = vscode.window.createWebviewPanel(
                        'rl4Webview',
                        '🧠 RL4 Dashboard',
                        { viewColumn: vscode.ViewColumn.Two, preserveFocus: true },
                        {
                            enableScripts: true,
                            retainContextWhenHidden: true,
                            localResourceRoots: [
                                vscode.Uri.joinPath(context.extensionUri, 'extension', 'webview', 'ui', 'dist')
                            ]
                        }
                    );
                    
                    webviewPanel.webview.html = getWebviewHtml(context, webviewPanel);
                    
                    // Send initial Context.RL4 to WebView after a delay
                    setTimeout(sendContextToWebView, 500);
                    
                    // Phase E3.3: WebView requests snapshot on demand, no auto-push
                    webviewPanel.webview.onDidReceiveMessage(
                        async (message) => {
                            console.log('[RL4 Extension] Received message from WebView:', message.type);
                            
                            switch (message.type) {
                                case 'generateSnapshot':
                                    try {
                                        logger!.system('📋 Generating unified context snapshot...', '📋');
                                        const snapshot = await promptBuilder.generate();
                                        
                                        webviewPanel!.webview.postMessage({
                                            type: 'snapshotGenerated',
                                            payload: snapshot
                                        });
                                        
                                        logger!.system(`✅ Snapshot generated (${snapshot.length} chars)`, '✅');
                                    } catch (error) {
                                        logger!.error(`Failed to generate snapshot: ${error}`);
                                        webviewPanel!.webview.postMessage({
                                            type: 'error',
                                            payload: 'Failed to generate snapshot'
                                        });
                                    }
                                    break;
                            }
                        },
                        null,
                        context.subscriptions
                    );
                    
                    webviewPanel.onDidDispose(() => {
                        webviewPanel = null;
                        if (statusBarItem) {
                            statusBarItem.text = '$(brain) RL4 Dashboard';
                            statusBarItem.tooltip = 'Click to open RL4 Cognitive Dashboard';
                        }
                        logger!.system('🖥️ WebView disposed', '🖥️');
                    }, null, context.subscriptions);
                    
                    if (statusBarItem) {
                        statusBarItem.text = '$(brain) RL4 Dashboard $(check)';
                        statusBarItem.tooltip = 'RL4 Dashboard is open';
                    }
                    
                    logger!.system('🖥️ WebView recreated', '🖥️');
                }
            })
        );
        
        logger.system('✅ RL4 Kernel activated', '✅');
        logger.system('🎯 8 commands registered (4 kernel + 3 ADR validation + 1 webview)', '🎯');
        logger.system('🖥️ Dashboard auto-opened in column 2', '🖥️');
            
        } else {
        logger.warning('TimerRegistry disabled');
    }
}

/**
 * Generate WebView HTML with Vite build assets
 */
function getWebviewHtml(context: vscode.ExtensionContext, panel: vscode.WebviewPanel): string {
    // Read index.html to extract actual Vite asset filenames (they change on each build)
    const indexHtmlPath = vscode.Uri.joinPath(context.extensionUri, 'extension', 'webview', 'ui', 'dist', 'index.html');
    const indexHtml = require('fs').readFileSync(indexHtmlPath.fsPath, 'utf-8');
    
    // Extract script and style paths from index.html
    const scriptMatch = indexHtml.match(/src="\.\/assets\/(index-[^"]+\.js)"/);
    const styleMatch = indexHtml.match(/href="\.\/assets\/(index-[^"]+\.css)"/);
    
    if (!scriptMatch || !styleMatch) {
        throw new Error('Failed to parse Vite build assets from index.html');
    }
    
    // Resolve webview-safe URIs for Vite assets
    const distPath = vscode.Uri.joinPath(context.extensionUri, 'extension', 'webview', 'ui', 'dist', 'assets');
    const scriptUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(distPath, scriptMatch[1]));
    const styleUri = panel.webview.asWebviewUri(vscode.Uri.joinPath(distPath, styleMatch[1]));
    
    return /* html */ `
        <!doctype html>
        <html>
            <head>
                <meta charset="utf-8" />
                <meta
                    http-equiv="Content-Security-Policy"
                    content="default-src 'none'; img-src ${panel.webview.cspSource} blob: data:;
                             script-src ${panel.webview.cspSource} 'unsafe-inline'; style-src ${panel.webview.cspSource} 'unsafe-inline';
                             font-src ${panel.webview.cspSource}; connect-src ${panel.webview.cspSource};"
                />
                <meta name="viewport" content="width=device-width,initial-scale=1" />
                <link rel="stylesheet" href="${styleUri}">
                <title>RL4 Dashboard</title>
            </head>
            <body>
                <div id="root"></div>
                <script>
                    // Acquire VS Code API BEFORE React loads
                    // This can only be called once per webview lifetime
                    (function() {
                        if (typeof acquireVsCodeApi === 'function') {
                            try {
                                window.vscode = acquireVsCodeApi();
                                console.log('[RL4 WebView] VS Code API acquired in inline script');
                            } catch (e) {
                                console.warn('[RL4 WebView] Could not acquire API (may already be acquired):', e.message);
                                // API already acquired somewhere else - try to find it
                                if (!window.vscode) {
                                    console.error('[RL4 WebView] CRITICAL: API acquired elsewhere but not available in window.vscode');
                                }
                            }
                        } else {
                            console.error('[RL4 WebView] acquireVsCodeApi function not found');
                        }
                    })();
                </script>
                <script type="module" src="${scriptUri}"></script>
            </body>
        </html>
    `;
}

export async function deactivate() {
    logger?.system('🛑 RL4 Kernel deactivating...', '🛑');
    
    // Dispose Status Bar Item
    if (statusBarItem) {
        statusBarItem.dispose();
        statusBarItem = null;
        logger?.system('✅ Status Bar disposed', '✅');
    }
    
    // Dispose WebView
    if (webviewPanel) {
        webviewPanel.dispose();
        webviewPanel = null;
        logger?.system('✅ WebView disposed', '✅');
    }
    
    // Flush ledger
    try {
        const ledger = (globalThis as any).RBOM_LEDGER;
        if (ledger?.flush) {
                    await ledger.flush();
            logger?.system('✅ Ledger flushed', '✅');
        }
    } catch (error) {
        logger?.error(`Flush error: ${error}`);
    }
    
    // Clear timers
    if (kernel?.timerRegistry) {
        kernel.timerRegistry.clear('kernel:cognitive-cycle');
        kernel.timerRegistry.clear('kernel:cognitive-watchdog');
        logger?.system('✅ Timers cleared', '✅');
    }
    
    // Shutdown kernel
    if (kernel?.api) {
        try {
            await kernel.api.shutdown();
            logger?.system('✅ Kernel shutdown complete', '✅');
        } catch (error) {
            logger?.error(`Shutdown error: ${error}`);
        }
    }
    
    logger?.system('🧠 RL4 Kernel deactivated cleanly', '🧠');
}
// test flush fix
// test flush fix

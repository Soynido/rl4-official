#!/usr/bin/env node
/**
 * RL4 Kernel CLI - Standalone Execution
 * 
 * Usage:
 *   node extension/kernel/cli.ts status
 *   node extension/kernel/cli.ts reflect
 *   node extension/kernel/cli.ts flush
 *   node extension/kernel/cli.ts rbom verify
 */

import { TimerRegistry } from './TimerRegistry';
import { StateRegistry } from './StateRegistry';
import { HealthMonitor } from './HealthMonitor';
import { CognitiveScheduler } from './CognitiveScheduler';
import { RBOMLedger } from './RBOMLedger';
import { AppendOnlyWriter } from './AppendOnlyWriter';
import { ExecPool } from './ExecPool';
import { KernelAPI } from './KernelAPI';
import { loadKernelConfig } from './config';
import * as path from 'path';

const workspaceRoot = process.cwd();

async function main() {
    const command = process.argv[2];
    
    // Initialize kernel components
    const config = loadKernelConfig(workspaceRoot);
    const timerRegistry = new TimerRegistry();
    const stateRegistry = new StateRegistry(workspaceRoot);
    const healthMonitor = new HealthMonitor(workspaceRoot, timerRegistry);
    
    // Create dummy logger for CLI (no VS Code OutputChannel available)
    const dummyLogger: any = {
        system: (msg: string) => console.log(`[RL4] ${msg}`),
        warning: (msg: string) => console.warn(`[RL4 WARNING] ${msg}`),
        error: (msg: string) => console.error(`[RL4 ERROR] ${msg}`),
        log: () => {},
        cycleStart: () => {},
        cycleEnd: () => {},
        phase: () => {},
        getChannel: () => null,
        clear: () => {},
    };
    
    const scheduler = new CognitiveScheduler(workspaceRoot, timerRegistry, dummyLogger);
    const execPool = new ExecPool(config.exec_pool_size, config.exec_timeout_ms);
    const writers = new Map<string, AppendOnlyWriter>();
    
    const api = new KernelAPI(
        timerRegistry,
        stateRegistry,
        healthMonitor,
        scheduler,
        writers,
        execPool
    );
    
    switch (command) {
        case 'status':
            const status = api.status();
            console.log(JSON.stringify(status, null, 2));
            break;
            
        case 'reflect':
            console.log('🧠 Running cognitive reflection...');
            const result = await api.reflect();
            console.log(`✅ Cycle ${result.cycleId} complete in ${result.duration}ms`);
            console.log(JSON.stringify(result, null, 2));
            break;
            
        case 'flush':
            console.log('💾 Flushing all queues...');
            await api.flush();
            console.log('✅ Flush complete');
            break;
            
        case 'rbom':
            const subcommand = process.argv[3];
            if (subcommand === 'verify') {
                const ledger = new RBOMLedger(workspaceRoot);
                const verification = await ledger.verify();
                
                if (verification.valid) {
                    console.log('✅ RBOM Ledger: VALID');
                } else {
                    console.error('❌ RBOM Ledger: INVALID');
                    verification.errors.forEach(err => console.error(`  - ${err}`));
                    process.exit(1);
                }
            }
            break;
            
        case 'shutdown':
            await api.shutdown();
            break;
            
        default:
            console.log(`
RL4 Kernel CLI

Usage:
  cli.ts status          - Show kernel status
  cli.ts reflect         - Run cognitive cycle
  cli.ts flush           - Flush all queues
  cli.ts rbom verify     - Verify RBOM integrity
  cli.ts shutdown        - Shutdown kernel
            `);
    }
    
    process.exit(0);
}

main().catch(error => {
    console.error('❌ CLI error:', error);
    process.exit(1);
});


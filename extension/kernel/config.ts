/**
 * Kernel Configuration
 * 
 * Loads from .reasoning_rl4/kernel_config.json
 * Feature flags for gradual rollout
 */

import * as fs from 'fs';
import * as path from 'path';

export interface KernelConfig {
    USE_TIMER_REGISTRY: boolean;
    USE_APPEND_ONLY_IO: boolean;
    USE_EXEC_POOL: boolean;
    USE_STATE_REGISTRY: boolean;
    USE_HEALTH_MONITOR: boolean;
    
    exec_pool_size: number;
    exec_timeout_ms: number;
    health_check_interval_ms: number;
    state_snapshot_interval_ms: number;
    cognitive_cycle_interval_ms: number;
}

export function loadKernelConfig(workspaceRoot: string): KernelConfig {
    const configPath = path.join(workspaceRoot, '.reasoning_rl4', 'kernel_config.json');
    
    const defaults: KernelConfig = {
        USE_TIMER_REGISTRY: true,
        USE_APPEND_ONLY_IO: true,
        USE_EXEC_POOL: true,
        USE_STATE_REGISTRY: true,
        USE_HEALTH_MONITOR: true,
        
        exec_pool_size: 2,
        exec_timeout_ms: 2000,
        health_check_interval_ms: 10000,
        state_snapshot_interval_ms: 600000,
        cognitive_cycle_interval_ms: 10000 // 10s for testing, 7200000 for production (2h)
    };
    
    if (!fs.existsSync(configPath)) {
        // Create default config
        fs.mkdirSync(path.dirname(configPath), { recursive: true });
        fs.writeFileSync(configPath, JSON.stringify(defaults, null, 2));
        return defaults;
    }
    
    try {
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        return { ...defaults, ...config };
    } catch (error) {
        console.warn('⚠️ Failed to load kernel config, using defaults:', error);
        return defaults;
    }
}


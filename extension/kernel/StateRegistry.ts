/**
 * StateRegistry - Centralized State Management
 * 
 * Periodic snapshot of kernel state to .reasoning_rl4/state/kernel.json
 * 
 * RL4 Kernel Component #4
 */

import { AppendOnlyWriter } from './AppendOnlyWriter';
import * as path from 'path';
import * as fs from 'fs';

export interface KernelState {
    version: string;
    uptime: number;
    totalEvents: number;
    health: {
        memoryMB: number;
        activeTimers: number;
        queueSize: number;
    };
    lastSnapshot: string;
}

export class StateRegistry {
    private state: KernelState;
    private stateDir: string;
    private snapshotInterval: number = 600000; // 10 min
    private writer: AppendOnlyWriter;
    
    constructor(workspaceRoot: string) {
        this.stateDir = path.join(workspaceRoot, '.reasoning_rl4', 'state');
        this.writer = new AppendOnlyWriter(
            path.join(this.stateDir, 'kernel_snapshots.jsonl')
        );
        
        this.state = this.loadState();
    }
    
    /**
     * Get current state (immutable)
     */
    getState(): Readonly<KernelState> {
        return Object.freeze({ ...this.state });
    }
    
    /**
     * Update state atomically
     */
    async updateState(updates: Partial<KernelState>): Promise<void> {
        this.state = { ...this.state, ...updates };
        await this.snapshot();
    }
    
    /**
     * Snapshot state to disk
     */
    async snapshot(): Promise<void> {
        const snapshotPath = path.join(this.stateDir, 'kernel.json');
        
        // Ensure directory
        if (!fs.existsSync(this.stateDir)) {
            fs.mkdirSync(this.stateDir, { recursive: true });
        }
        
        // Write current state
        fs.writeFileSync(snapshotPath, JSON.stringify(this.state, null, 2));
        
        // Append to history (JSONL)
        await this.writer.append(this.state);
        
        this.state.lastSnapshot = new Date().toISOString();
    }
    
    /**
     * Load state from disk
     */
    private loadState(): KernelState {
        const statePath = path.join(this.stateDir, 'kernel.json');
        
        if (fs.existsSync(statePath)) {
            try {
                return JSON.parse(fs.readFileSync(statePath, 'utf-8'));
            } catch (error) {
                console.warn('⚠️ Failed to load state:', error);
            }
        }
        
        return this.createDefaultState();
    }
    
    /**
     * Create default state
     */
    private createDefaultState(): KernelState {
        return {
            version: '2.0.0',
            uptime: 0,
            totalEvents: 0,
            health: {
                memoryMB: 0,
                activeTimers: 0,
                queueSize: 0
            },
            lastSnapshot: new Date().toISOString()
        };
    }
}


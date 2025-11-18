/**
 * KernelAPI - Public API for RL4 Kernel
 * 
 * Exposes 4 endpoints: status, reflect, flush, shutdown
 * 
 * RL4 Kernel Component #8
 */

import { TimerRegistry } from './TimerRegistry';
import { StateRegistry } from './StateRegistry';
import { HealthMonitor, HealthMetrics } from './HealthMonitor';
import { CognitiveScheduler, CycleResult } from './CognitiveScheduler';
import { AppendOnlyWriter } from './AppendOnlyWriter';
import { ExecPool } from './ExecPool';

export interface KernelStatus {
    running: boolean;
    uptime: number;
    health: HealthMetrics;
    timers: number;
    queueSize: number;
    version: string;
}

export class KernelAPI {
    constructor(
        private timerRegistry: TimerRegistry,
        private stateRegistry: StateRegistry,
        private healthMonitor: HealthMonitor,
        private scheduler: CognitiveScheduler,
        private writers: Map<string, AppendOnlyWriter>,
        private execPool: ExecPool
    ) {}
    
    /**
     * Get kernel status
     */
    status(): KernelStatus {
        const health = this.healthMonitor.getMetrics();
        const timerCount = this.timerRegistry.getActiveCount();
        const state = this.stateRegistry.getState();
        
        return {
            running: true,
            uptime: health.uptime,
            health,
            timers: timerCount.total,
            queueSize: health.queueSize,
            version: state.version
        };
    }
    
    /**
     * ✅ P0-CORE-03: Get last cycle health (for kernel status API)
     * @returns Last cycle health information
     */
    getLastCycleHealth(): {
        cycleId: number;
        success: boolean;
        phases: any[];
        duration: number;
        error: string | null;
    } {
        return this.scheduler.getLastCycleHealth();
    }
    
    /**
     * Run cognitive reflection (manual cycle trigger)
     */
    async reflect(): Promise<CycleResult> {
        return await this.scheduler.runCycle();
    }
    
    /**
     * Flush all queues (force write)
     */
    async flush(): Promise<void> {
        const flushPromises: Promise<void>[] = [];
        
        // Flush all writers
        for (const writer of this.writers.values()) {
            flushPromises.push(writer.flush(true)); // with fsync
        }
        
        await Promise.all(flushPromises);
        
        // Snapshot state
        await this.stateRegistry.snapshot();
    }
    
    /**
     * Shutdown kernel (cleanup)
     */
    async shutdown(): Promise<void> {
        console.log('🧠 Kernel shutting down...');
        
        // Stop all timers
        this.timerRegistry.clearAll();
        
        // Flush all writes
        await this.flush();
        
        // Final health check
        await this.healthMonitor.stop();
        
        console.log('✅ Kernel shutdown complete');
    }
}


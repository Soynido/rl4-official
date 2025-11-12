/**
 * TimerRegistry - Centralized Timer Management
 * 
 * Prevents memory leaks by tracking all setInterval/setTimeout calls
 * and ensuring proper cleanup on shutdown.
 * 
 * RL4 Kernel Component #1
 */

export interface TimerHandle {
    id: string;
    type: 'timeout' | 'interval';
    createdAt: number;
    interval: number;
    callback: string; // Function name for debugging
}

export class TimerRegistry {
    private timers: Map<string, NodeJS.Timeout> = new Map();
    private intervals: Map<string, NodeJS.Timeout> = new Map();
    private metadata: Map<string, TimerHandle> = new Map();
    
    /**
     * Register a timeout with automatic cleanup tracking
     * @param id - Unique identifier (format: "module:purpose")
     * @param callback - Function to execute
     * @param delay - Delay in milliseconds
     * @throws Error if ID already registered
     */
    registerTimeout(id: string, callback: () => void, delay: number): void {
        if (this.timers.has(id)) {
            throw new Error(`Timer ID already registered: ${id}`);
        }
        
        const timer = setTimeout(() => {
            callback();
            // Auto-cleanup after execution
            this.timers.delete(id);
            this.metadata.delete(id);
        }, delay);
        
        this.timers.set(id, timer);
        this.metadata.set(id, {
            id,
            type: 'timeout',
            createdAt: Date.now(),
            interval: delay,
            callback: callback.name || 'anonymous'
        });
    }
    
    /**
     * Register an interval with automatic cleanup tracking
     * @param id - Unique identifier (format: "module:purpose")
     * @param callback - Function to execute repeatedly
     * @param interval - Interval in milliseconds
     * @throws Error if ID already registered
     */
    registerInterval(id: string, callback: () => void, interval: number): void {
        // Auto-clear if already exists (idempotent registration)
        if (this.intervals.has(id)) {
            console.warn(`⚠️ [TimerRegistry] Timer ID already registered: ${id} - auto-clearing`);
            this.clear(id);
        }
        
        console.log(`🧪 [TimerRegistry] Creating setInterval for ${id}...`);
        const timer = setInterval(callback, interval);
        console.log(`✅ [TimerRegistry] setInterval created: ${id}, handle type: ${typeof timer}`);
        
        this.intervals.set(id, timer);
        this.metadata.set(id, {
            id,
            type: 'interval',
            createdAt: Date.now(),
            interval,
            callback: callback.name || 'anonymous'
        });
        
        console.log(`✅ [TimerRegistry] Interval registered: ${id} (${interval}ms, callback: ${callback.name || 'anonymous'})`);
    }
    
    /**
     * Clear a specific timer by ID
     * @param id - Timer ID to clear
     */
    clear(id: string): void {
        if (this.timers.has(id)) {
            clearTimeout(this.timers.get(id)!);
            this.timers.delete(id);
            this.metadata.delete(id);
        }
        
        if (this.intervals.has(id)) {
            clearInterval(this.intervals.get(id)!);
            this.intervals.delete(id);
            this.metadata.delete(id);
        }
    }
    
    /**
     * Clear all timers (critical for shutdown)
     */
    clearAll(): void {
        this.timers.forEach(t => clearTimeout(t));
        this.intervals.forEach(t => clearInterval(t));
        this.timers.clear();
        this.intervals.clear();
        this.metadata.clear();
    }
    
    /**
     * Get active timer count (for health monitoring)
     */
    getActiveCount(): { timeouts: number; intervals: number; total: number } {
        return {
            timeouts: this.timers.size,
            intervals: this.intervals.size,
            total: this.timers.size + this.intervals.size
        };
    }
    
    /**
     * Get all timer metadata (for diagnostics)
     */
    getTimers(): TimerHandle[] {
        return Array.from(this.metadata.values());
    }
    
    /**
     * Check if timer exists
     */
    has(id: string): boolean {
        return this.timers.has(id) || this.intervals.has(id);
    }
}


/**
 * TimerProxy - Global setInterval/setTimeout Redirection
 * 
 * Wraps global timer functions to redirect to TimerRegistry
 * Used via TypeScript path aliases (no code changes in 107 modules)
 * 
 * RL4 Adapter #1
 */

import { TimerRegistry } from '../TimerRegistry';

let _timerRegistry: TimerRegistry | null = null;

/**
 * Initialize proxy with timer registry
 */
export function initTimerProxy(registry: TimerRegistry): void {
    _timerRegistry = registry;
}

/**
 * Proxy setInterval (if registry available)
 */
export function proxySetInterval(
    callback: () => void,
    interval: number,
    id?: string
): NodeJS.Timeout {
    if (_timerRegistry && id) {
        _timerRegistry.registerInterval(id, callback, interval);
        // Return dummy (actual timer managed by registry)
        return {} as NodeJS.Timeout;
    }
    
    // Fallback to native
    return setInterval(callback, interval);
}

/**
 * Proxy setTimeout (if registry available)
 */
export function proxySetTimeout(
    callback: () => void,
    delay: number,
    id?: string
): NodeJS.Timeout {
    if (_timerRegistry && id) {
        _timerRegistry.registerTimeout(id, callback, delay);
        // Return dummy
        return {} as NodeJS.Timeout;
    }
    
    // Fallback to native
    return setTimeout(callback, delay);
}


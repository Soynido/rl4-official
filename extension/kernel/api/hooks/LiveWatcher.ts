/**
 * RL4 Live Watcher
 * 
 * Surveille les modifications des fichiers RL4 et notifie la WebView
 * pour mise à jour en temps réel sans refresh manuel.
 * 
 * Utilise chokidar pour détecter:
 * - patterns.json updated → Refresh patterns view
 * - forecasts.json updated → Refresh forecasts view
 * - cycles.jsonl appended → Refresh cycle count
 * - timelines/*.json updated → Refresh timeline
 * 
 * Exclusions: .reasoning_rl4/cache/ (éviter boucles infinies)
 */

import * as chokidar from 'chokidar';
import * as path from 'path';

export type RL4UpdateType = 
    | 'patterns'
    | 'correlations'
    | 'forecasts'
    | 'cycles'
    | 'timeline'
    | 'adrs'
    | 'context'
    | 'unknown';

export interface RL4UpdateEvent {
    type: RL4UpdateType;
    file: string;
    timestamp: string;
}

export type RL4UpdateCallback = (event: RL4UpdateEvent) => void;

export class LiveWatcher {
    private workspaceRoot: string;
    private watcher: chokidar.FSWatcher | null = null;
    private callbacks: RL4UpdateCallback[] = [];
    private isWatching: boolean = false;
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
    }
    
    /**
     * Start watching .reasoning_rl4/ for changes
     */
    start(): void {
        if (this.isWatching) {
            console.warn('⚠️  Watcher already running');
            return;
        }
        
        const watchPath = path.join(this.workspaceRoot, '.reasoning_rl4');
        
        this.watcher = chokidar.watch(watchPath, {
            ignored: [
                '**/cache/**',          // Ignore cache directory (avoid loops)
                '**/node_modules/**',
                '**/.git/**'
            ],
            persistent: true,
            ignoreInitial: true,        // Don't trigger on initial scan
            awaitWriteFinish: {         // Wait for writes to complete
                stabilityThreshold: 500, // File must be stable for 500ms
                pollInterval: 100
            }
        });
        
        this.watcher
            .on('change', (filePath: string) => {
                this.handleFileChange(filePath);
            })
            .on('add', (filePath: string) => {
                this.handleFileChange(filePath);
            })
            .on('error', (error: Error) => {
                console.error('❌ Watcher error:', error);
            });
        
        this.isWatching = true;
        console.log(`👁️  LiveWatcher started on ${watchPath}`);
    }
    
    /**
     * Stop watching
     */
    async stop(): Promise<void> {
        if (this.watcher) {
            await this.watcher.close();
            this.watcher = null;
        }
        
        this.isWatching = false;
        console.log('👁️  LiveWatcher stopped');
    }
    
    /**
     * Register callback to receive update events
     */
    onUpdate(callback: RL4UpdateCallback): void {
        this.callbacks.push(callback);
    }
    
    /**
     * Remove callback
     */
    offUpdate(callback: RL4UpdateCallback): void {
        this.callbacks = this.callbacks.filter(cb => cb !== callback);
    }
    
    /**
     * Get watcher status
     */
    getStatus(): { watching: boolean; callbacks: number } {
        return {
            watching: this.isWatching,
            callbacks: this.callbacks.length
        };
    }
    
    // Private helpers
    
    private handleFileChange(filePath: string): void {
        const relativePath = path.relative(this.workspaceRoot, filePath);
        const updateType = this.detectUpdateType(relativePath);
        
        const event: RL4UpdateEvent = {
            type: updateType,
            file: relativePath,
            timestamp: new Date().toISOString()
        };
        
        // Notify all callbacks
        for (const callback of this.callbacks) {
            try {
                callback(event);
            } catch (error) {
                console.error('❌ Callback error:', error);
            }
        }
        
        console.log(`👁️  Update detected: ${updateType} (${relativePath})`);
    }
    
    private detectUpdateType(relativePath: string): RL4UpdateType {
        if (relativePath.includes('patterns.json')) {
            return 'patterns';
        }
        if (relativePath.includes('correlations.json')) {
            return 'correlations';
        }
        if (relativePath.includes('forecasts.json')) {
            return 'forecasts';
        }
        if (relativePath.includes('cycles.jsonl')) {
            return 'cycles';
        }
        if (relativePath.includes('timelines/')) {
            return 'timeline';
        }
        if (relativePath.includes('adrs/')) {
            return 'adrs';
        }
        if (relativePath.includes('context.json')) {
            return 'context';
        }
        
        return 'unknown';
    }
}

/**
 * Global singleton instance
 * Utiliser pour éviter les duplications de watchers
 */
let globalWatcher: LiveWatcher | null = null;

export function getGlobalWatcher(workspaceRoot: string): LiveWatcher {
    if (!globalWatcher) {
        globalWatcher = new LiveWatcher(workspaceRoot);
    }
    return globalWatcher;
}

export function stopGlobalWatcher(): Promise<void> | undefined {
    if (globalWatcher) {
        const promise = globalWatcher.stop();
        globalWatcher = null;
        return promise;
    }
}


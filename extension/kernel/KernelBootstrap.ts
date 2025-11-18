/**
 * RL4 Kernel Bootstrap
 * 
 * Loads compressed kernel artifacts (state, universals, forecast metrics)
 * from .reasoning_rl4/artifacts/ directory at initialization.
 * 
 * Artifacts Format:
 * - state.json.gz: Current kernel state snapshot
 * - universals.json.gz: Universal patterns and cognitive rules
 * - forecast_metrics.json.gz: Forecast accuracy baseline
 * - universals_analysis.json.gz: Analysis of universal patterns
 * 
 * NOTE: Unified with CognitiveScheduler artifact path (.reasoning_rl4/artifacts/)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface KernelArtifacts {
    state: any | null;
    universals: any | null;
    metrics: any | null;
    analysis: any | null;
    initialized: boolean;
}

export class KernelBootstrap {
    private static kernelDir: string;

    /**
     * Initialize the kernel directory path
     * @param workspaceRoot - Root path of the workspace
     */
    static init(workspaceRoot: string): void {
        // FIX: Unified artifact path (was: '.reasoning_rl4/kernel', now: '.reasoning_rl4/artifacts')
        this.kernelDir = path.join(workspaceRoot, '.reasoning_rl4', 'artifacts');
    }

    /**
     * Load a compressed JSON file
     * @param file - Filename (e.g., "state.json.gz")
     * @returns Parsed JSON object or null if file doesn't exist
     */
    static loadJSONGz(file: string): any | null {
        if (!this.kernelDir) {
            console.warn('⚠️  KernelBootstrap not initialized. Call init(workspaceRoot) first.');
            return null;
        }

        const fullPath = path.join(this.kernelDir, file);
        
        if (!fs.existsSync(fullPath)) {
            return null;
        }

        try {
            const data = fs.readFileSync(fullPath);
            const decompressed = zlib.gunzipSync(data).toString();
            return JSON.parse(decompressed);
        } catch (error) {
            console.error(`❌ Failed to load ${file}:`, error);
            return null;
        }
    }

    /**
     * Initialize kernel with all artifacts
     * @param workspaceRoot - Root path of the workspace
     * @returns Loaded artifacts and initialization status
     */
    static initialize(workspaceRoot: string): KernelArtifacts {
        this.init(workspaceRoot);

        console.log('🧠 Loading RL4 kernel artifacts...');

        const state = this.loadJSONGz('state.json.gz');
        const universals = this.loadJSONGz('universals.json.gz');
        const metrics = this.loadJSONGz('forecast_metrics.json.gz');
        const analysis = this.loadJSONGz('universals_analysis.json.gz');

        if (!state || !universals) {
            console.warn('⚠️  Missing essential kernel artifacts. Booting in fallback mode.');
            return { 
                state: null, 
                universals: null, 
                metrics: null, 
                analysis: null, 
                initialized: false 
            };
        }

        const universalCount = universals && typeof universals === 'object' 
            ? Object.keys(universals).length 
            : 0;

        console.log(`✅ Loaded ${universalCount} universals`);
        console.log(`📊 Forecast precision baseline: ${metrics?.forecast_precision ?? 'N/A'}`);

        return { 
            state, 
            universals, 
            metrics, 
            analysis, 
            initialized: true 
        };
    }

    /**
     * Save state to compressed file with fail-safe mechanism
     * 
     * Phase E2: Added atomic write with lock file to prevent corruption
     * 
     * @param state - State object to save
     * @param workspaceRoot - Root path of the workspace
     */
    static async saveState(state: any, workspaceRoot: string): Promise<void> {
        this.init(workspaceRoot);

        // Ensure kernel directory exists
        if (!fs.existsSync(this.kernelDir)) {
            fs.mkdirSync(this.kernelDir, { recursive: true });
        }

        const fullPath = path.join(this.kernelDir, 'state.json.gz');
        const tmpPath = path.join(this.kernelDir, 'state.json.gz.tmp');
        const lockPath = path.join(this.kernelDir, 'state.lock');

        try {
            // Phase E2 Fail-safe #1: Check for existing lock
            if (fs.existsSync(lockPath)) {
                const lockAge = Date.now() - fs.statSync(lockPath).mtimeMs;
                if (lockAge < 5000) {
                    // Lock younger than 5s, another process is writing
                    console.warn('⚠️ State save skipped: write in progress');
                    return;
                }
                // Stale lock, remove it
                fs.unlinkSync(lockPath);
            }

            // Phase E2 Fail-safe #2: Create lock file
            fs.writeFileSync(lockPath, Date.now().toString());

            // Phase E2 Fail-safe #3: Write to temp file first
            const json = JSON.stringify(state, null, 2);
            const compressed = zlib.gzipSync(json);
            fs.writeFileSync(tmpPath, compressed);

            // Phase E2 Fail-safe #4: Atomic rename (POSIX operation)
            fs.renameSync(tmpPath, fullPath);

            console.log('💾 Kernel state saved to state.json.gz');

        } catch (error) {
            console.error('❌ Failed to save state:', error);
            // Cleanup temp file if exists
            if (fs.existsSync(tmpPath)) {
                fs.unlinkSync(tmpPath);
            }
        } finally {
            // Phase E2 Fail-safe #5: Always remove lock
            if (fs.existsSync(lockPath)) {
                fs.unlinkSync(lockPath);
            }
        }
    }

    /**
     * Save universals to compressed file
     * @param universals - Universals object to save
     * @param workspaceRoot - Root path of the workspace
     */
    static async saveUniversals(universals: any, workspaceRoot: string): Promise<void> {
        this.init(workspaceRoot);

        // Ensure kernel directory exists
        if (!fs.existsSync(this.kernelDir)) {
            fs.mkdirSync(this.kernelDir, { recursive: true });
        }

        const fullPath = path.join(this.kernelDir, 'universals.json.gz');
        const json = JSON.stringify(universals, null, 2);
        const compressed = zlib.gzipSync(json);

        fs.writeFileSync(fullPath, compressed);
        console.log('💾 Universals saved to universals.json.gz');
    }
}


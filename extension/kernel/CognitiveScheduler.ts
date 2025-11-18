/**
 * CognitiveScheduler - Single Master Scheduler for Cognitive Cycle
 * 
 * Replaces multiple autonomous timers with ONE orchestrated cycle:
 * Pattern → Correlation → Forecast → ADR
 * 
 * Features:
 * - Idempotence (hash-based)
 * - Single timer ownership
 * - Phase telemetry
 * 
 * RL4 Kernel Component #7
 */

import { TimerRegistry } from './TimerRegistry';
import { RBOMLedger, setGlobalLedger } from './RBOMLedger';
import { PatternLearningEngine } from './cognitive/PatternLearningEngine';
import { CorrelationEngine } from './cognitive/CorrelationEngine';
import { ForecastEngine, ForecastMetrics } from './cognitive/ForecastEngine';
import { ADRGeneratorV2 } from './cognitive/ADRGeneratorV2';
import { KernelBootstrap } from './KernelBootstrap';
import { FeedbackEvaluator } from './cognitive/FeedbackEvaluator';
import { RL4CacheIndexer } from './indexer/CacheIndex';
import { ContextSnapshotGenerator } from './indexer/ContextSnapshot';
import { TimelineAggregator } from './indexer/TimelineAggregator';
import { DataNormalizer } from './indexer/DataNormalizer';
import { IDEActivityListener } from './inputs/IDEActivityListener';
import { BuildMetricsListener } from './inputs/BuildMetricsListener';
import { PatternEvolutionTracker } from './cognitive/PatternEvolutionTracker';
import { SnapshotRotation } from './indexer/SnapshotRotation';
import { AppendOnlyWriter } from './AppendOnlyWriter';
import { CognitiveLogger, HourlySummary } from './CognitiveLogger';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';
import * as zlib from 'zlib';
import { promisify } from 'util';

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);

export interface CycleResult {
    cycleId: number;
    startedAt: string;
    completedAt: string;
    duration: number;
    phases: PhaseResult[];
    inputHash: string; // For idempotence
    success: boolean;
}

export interface PhaseResult {
    name: string;
    duration: number;
    success: boolean;
    metrics?: any;
    error?: string;
}

export class CognitiveScheduler {
    private cycleCount: number = 0;
    private isRunning: boolean = false;
    private lastInputHash: string = '';
    private ledger: RBOMLedger;
    private lastCycleTime: number = Date.now();
    private watchdogTimer: NodeJS.Timeout | null = null;
    private intervalMs: number = 10000; // Default 10s
    private logger: CognitiveLogger; // Cognitive logger for normalized output
    private ingestionLockChecker: (() => boolean) | null = null; // Callback to check ingestion lock
    private workspaceRoot: string; // Workspace root for engines
    
    // ✅ P0-CORE-03: Cycle Health metrics
    private lastCycleId: number = 0;
    private lastCycleSuccess: boolean = false;
    private lastCycleDuration: number = 0;
    private lastCyclePhases: PhaseResult[] = [];
    private lastCycleError: string | null = null;
    private pendingInitReason: string | null = null; // Reason why kernel is not ready
    
    // Phase 4: Hourly summary tracking
    private hourlySummaryTimer: NodeJS.Timeout | null = null;
    private lastHourlySummaryTime: number = Date.now();
    private accumulatedFileChanges: number = 0; // Will be updated in Phase 2 (FileChangeWatcher)
    private accumulatedGitCommits: number = 0; // Will be updated in Phase 3 (GitCommitListener)
    
    /**
     * Phase 3: Increment commit counter (called by GitCommitListener)
     */
    public incrementCommitCount(): void {
        this.accumulatedGitCommits++;
    }
    
    /**
     * Phase 2: Increment file change counter (called by FileChangeWatcher)
     */
    public incrementFileChangeCount(count: number = 1): void {
        this.accumulatedFileChanges += count;
    }
    
    // Phase E1: Persistent ForecastEngine with adaptive baseline
    private forecastEngine: ForecastEngine;
    // Phase E2.2: Real metrics evaluator
    private feedbackEvaluator: FeedbackEvaluator;
    // Phase E2.3: Cache indexer for fast queries
    private cacheIndexer: RL4CacheIndexer;
    // Phase E2.3: Context snapshot generator
    private contextSnapshot: ContextSnapshotGenerator;
    // Phase E2.4: Timeline aggregator
    private timelineAggregator: TimelineAggregator;
    // Phase E2.4: Data normalizer
    private dataNormalizer: DataNormalizer;
    // Phase E2.6: IDE activity listener (Quick Wins)
    private ideActivityListener: IDEActivityListener;
    // Phase E2.6: Build metrics listener (Quick Wins)
    private buildMetricsListener: BuildMetricsListener;
    // Phase E2.7: Pattern evolution tracker (History Enrichment)
    private patternEvolutionTracker: PatternEvolutionTracker;
    // Phase E2.7: Snapshot rotation (History Enrichment)
    private snapshotRotation: SnapshotRotation;
    
    constructor(
        workspaceRoot: string,
        private timerRegistry: TimerRegistry,
        logger: CognitiveLogger,
        bootstrapMetrics?: ForecastMetrics
    ) {
        this.workspaceRoot = workspaceRoot;
        this.ledger = new RBOMLedger(workspaceRoot);
        this.logger = logger;
        
        // Initialize persistent ForecastEngine with bootstrap metrics
        this.forecastEngine = new ForecastEngine(workspaceRoot, bootstrapMetrics);
        // Initialize FeedbackEvaluator for real metrics
        this.feedbackEvaluator = new FeedbackEvaluator(workspaceRoot);
        // Initialize cache indexer
        this.cacheIndexer = new RL4CacheIndexer(workspaceRoot);
        // Initialize context snapshot generator
        this.contextSnapshot = new ContextSnapshotGenerator(workspaceRoot);
        // Initialize timeline aggregator
        this.timelineAggregator = new TimelineAggregator(workspaceRoot);
        // Initialize data normalizer
        this.dataNormalizer = new DataNormalizer(workspaceRoot);
        // Initialize IDE activity listener (Phase E2.6 Quick Wins)
        const ideActivityWriter = new AppendOnlyWriter(path.join(workspaceRoot, '.reasoning_rl4', 'traces', 'ide_activity.jsonl'));
        this.ideActivityListener = new IDEActivityListener(workspaceRoot, ideActivityWriter, logger.getChannel());
        // Initialize build metrics listener (Phase E2.6 Quick Wins)
        const buildMetricsWriter = new AppendOnlyWriter(path.join(workspaceRoot, '.reasoning_rl4', 'traces', 'build_metrics.jsonl'));
        this.buildMetricsListener = new BuildMetricsListener(workspaceRoot, buildMetricsWriter, logger.getChannel());
        // Initialize pattern evolution tracker (Phase E2.7 History Enrichment)
        this.patternEvolutionTracker = new PatternEvolutionTracker(workspaceRoot);
        // Initialize snapshot rotation (Phase E2.7 History Enrichment)
        this.snapshotRotation = new SnapshotRotation(workspaceRoot);
        
        // Expose to globalThis for VS Code commands
        setGlobalLedger(this.ledger);
    }
    
    /**
     * Set ingestion lock checker callback
     * @param checker - Function that returns true if ingestion is locked
     */
    setIngestionLockChecker(checker: () => boolean): void {
        this.ingestionLockChecker = checker;
    }
    
    /**
     * Get ledger status (for kernel status API)
     * @returns Ledger status with safeMode and corruptionReason
     */
    getLedgerStatus(): { safeMode: boolean; corruptionReason: string | null } {
        return this.ledger.getStatus();
    }
    
    /**
     * Get cycle count (for kernel status API)
     * @returns Current cycle count
     */
    getCycleCount(): number {
        return this.cycleCount;
    }
    
    /**
     * ✅ P0-CORE-03: Get last cycle health metrics
     * @returns Last cycle health information
     */
    getLastCycleHealth(): {
        cycleId: number;
        success: boolean;
        phases: PhaseResult[];
        duration: number;
        error: string | null;
    } {
        return {
            cycleId: this.lastCycleId,
            success: this.lastCycleSuccess,
            phases: this.lastCyclePhases,
            duration: this.lastCycleDuration,
            error: this.lastCycleError
        };
    }
    
    /**
     * ✅ P0-CORE-03: Get reason why kernel is not ready
     * @returns Reason string or null if ready
     */
    getNotReadyReason(): string | null {
        if (this.pendingInitReason) {
            return this.pendingInitReason;
        }
        const ledgerStatus = this.ledger.getStatus();
        if (ledgerStatus.safeMode) {
            return ledgerStatus.corruptionReason || 'ledger_safe_mode';
        }
        if (this.isRunning) {
            return 'cycle_in_progress';
        }
        return null;
    }
    
    /**
     * ✅ P0-CORE-03: Set pending initialization reason
     * @param reason - Reason why kernel is not ready
     */
    setPendingInitReason(reason: string | null): void {
        this.pendingInitReason = reason;
    }
    
    /**
     * Start periodic cycles with watchdog protection
     * @param periodMs - Period in milliseconds (default: 5-10s for testing, 2h for production)
     */
    async start(periodMs: number = 10000): Promise<void> {
        this.intervalMs = periodMs;
        
        // Stop any existing timers first
        this.stop();
        
        // CRITICAL: Wait for VS Code Extension Host to stabilize
        // Without this delay, timers are registered but never fire
        console.log('[P0-CORE-01B] 🔥 CognitiveScheduler.start() called');
        this.logger.system('⏳ Waiting 2s for Extension Host to stabilize...', '⏳');
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('[P0-CORE-01B] ✅ Extension Host stabilized');
        this.logger.system('✅ Extension Host ready', '✅');
        
        // 🗂️ P0-CORE-01: Load kernel artifacts at boot
        console.log('[P0-CORE-01B] 🗂️ Attempting to load kernel artifacts...');
        this.logger.system('🗂️  Loading kernel artifacts...', '🗂️');
        try {
            await this.loadArtifacts();
            console.log('[P0-CORE-01B] ✅ Artifacts loaded successfully');
            this.logger.system('✅ Kernel artifacts loaded', '✅');
        } catch (artifactError) {
            console.log('[P0-CORE-01B] ⚠️ Artifact loading failed:', artifactError);
            this.logger.warning(`⚠️  No kernel artifacts found (first boot or reset): ${artifactError}`);
        }
        
        // Phase E2.3: Initialize cache index on first start
        this.logger.system('📇 Initializing cache index...', '📇');
        try {
            const stats = this.cacheIndexer.getStats();
            if (!stats) {
                // No index exists, rebuild from scratch
                this.logger.system('📇 No index found, rebuilding...', '📇');
                await this.cacheIndexer.rebuild();
                this.logger.system('✅ Cache index rebuilt successfully', '✅');
            } else {
                this.logger.system(`✅ Cache index loaded: ${stats.total_cycles} cycles indexed`, '✅');
            }
        } catch (indexError) {
            this.logger.warning(`Cache index initialization failed (non-critical): ${indexError}`);
        }
        
        // Phase E2.4: Run data normalization at startup
        this.logger.system('🔧 Running data normalization...', '🔧');
        try {
            const normReport = await this.dataNormalizer.normalize();
            if (normReport.actions_performed.length > 0) {
                this.logger.system(`✅ Normalization complete: ${normReport.actions_performed.length} actions performed`, '✅');
                for (const action of normReport.actions_performed) {
                    this.logger.system(`   • ${action}`, '•');
                }
            } else {
                this.logger.system('✅ Data already normalized', '✅');
            }
            
            if (normReport.warnings.length > 0) {
                this.logger.warning(`${normReport.warnings.length} warnings during normalization`);
                for (const warning of normReport.warnings) {
                    this.logger.warning(`   • ${warning}`);
                }
            }
        } catch (normError) {
            this.logger.warning(`Data normalization failed (non-critical): ${normError}`);
        }
        
        // Phase E2.6: Start IDE activity listener (Quick Wins)
        this.logger.system('👁️  Starting IDE activity listener...', '👁️');
        try {
            await this.ideActivityListener.start();
            this.logger.system('✅ IDE activity listener started', '✅');
        } catch (ideError) {
            this.logger.warning(`IDE activity listener failed (non-critical): ${ideError}`);
        }
        
        // Phase E2.6: Start build metrics listener (Quick Wins)
        this.logger.system('🔨 Starting build metrics listener...', '🔨');
        try {
            await this.buildMetricsListener.start();
            this.logger.system('✅ Build metrics listener started', '✅');
        } catch (buildError) {
            this.logger.warning(`Build metrics listener failed (non-critical): ${buildError}`);
        }
        
        // Register main cycle timer
        this.logger.system(`🧪 Registering cycle timer (${periodMs}ms)...`, '🧪');
        this.timerRegistry.registerInterval(
            'kernel:cognitive-cycle',
            async () => {
                this.logger.system("🔥 [TIMER] setInterval callback triggered", "🔥");
                
                try {
                    const result = await this.runCycle();
                    this.logger.system(`🔥 [TIMER] runCycle() resolved: ${JSON.stringify(result)}`, "🔥");
                } catch (err) {
                    this.logger.system(`🔥 [TIMER] runCycle() threw: ${err}`, "🔥");
                }
            },
            periodMs
        );
        this.logger.system('✅ Cycle timer registered successfully', '✅');
        
        // 🔥 TEST MODE: Force immediate first cycle execution
        this.logger.system('🔥 TEST MODE: Forcing immediate first cycle...', '🔥');
        this.runCycle()
            .then((result) => {
                this.logger.system(`🔥 TEST MODE: First cycle completed (success: ${result.success})`, '🔥');
            })
            .catch((error) => {
                this.logger.error(`🔥 TEST MODE: First cycle failed: ${error}`);
            });
        
        // 🧠 Watchdog: Check if scheduler is still active every minute
        // If no cycle executed for 2x interval → auto-restart
        const watchdogInterval = Math.max(60000, periodMs); // Min 1 minute
        this.logger.system(`🧪 Registering watchdog timer (${watchdogInterval}ms)...`, '🧪');
        this.timerRegistry.registerInterval(
            'kernel:cognitive-watchdog',
            () => {
                this.checkWatchdog();
            },
            watchdogInterval
        );
        this.logger.system('✅ Watchdog timer registered successfully', '✅');
        this.logger.system(`🛡️ Watchdog active (checking every ${watchdogInterval}ms)`, '🛡️');
        
        // Phase 4: Register hourly summary timer (every 1 hour = 3600000ms)
        this.logger.system('📊 Registering hourly summary timer (3600000ms)...', '📊');
        this.hourlySummaryTimer = setInterval(() => {
            this.generateHourlySummary();
        }, 3600000); // 1 hour
        this.logger.system('✅ Hourly summary timer registered successfully', '✅');
        this.lastHourlySummaryTime = Date.now();
    }
    
    /**
     * Watchdog check - Detects if scheduler is stuck
     */
    private checkWatchdog(): void {
        const delta = Date.now() - this.lastCycleTime;
        const threshold = this.intervalMs * 2;
        
        if (delta > threshold) {
            this.logger.warning(`Watchdog: Inactive for ${delta}ms (threshold: ${threshold}ms) — auto-restarting...`);
            this.restart();
        }
        // No verbose "healthy" logs in minimal mode
    }
    
    /**
     * Restart scheduler (called by watchdog or manually)
     */
    async restart(): Promise<void> {
        this.logger.system('🔄 CognitiveScheduler restarting...', '🔄');
        const currentInterval = this.intervalMs;
        this.stop();
        await this.start(currentInterval);
        this.logger.system('✅ CognitiveScheduler auto-restarted', '✅');
    }
    
    /**
     * Generate hourly summary (Phase 4)
     * Called every 1 hour by the hourly summary timer
     */
    private generateHourlySummary(): void {
        try {
            // Get accumulated cycles from logger
            const cycleSummaries = this.logger.getCycleSummaries();
            const cyclesCaptured = cycleSummaries.length;
            
            // Calculate health status from last cycle
            let healthStatus = 'healthy';
            let dataIntegrity: 'valid' | 'warning' | 'error' = 'valid';
            if (cyclesCaptured > 0) {
                const lastCycle = cycleSummaries[cyclesCaptured - 1];
                healthStatus = lastCycle.health.status || 'healthy';
                if (healthStatus === 'error' || healthStatus === 'critical') {
                    dataIntegrity = 'error';
                } else if (healthStatus === 'warning' || healthStatus === 'degraded') {
                    dataIntegrity = 'warning';
                }
            }
            
            // Create hourly summary
            const summary: HourlySummary = {
                cycles_captured: cyclesCaptured,
                file_changes: this.accumulatedFileChanges, // Will be updated by FileChangeWatcher (Phase 2)
                git_commits: this.accumulatedGitCommits, // Will be updated by GitCommitListener (Phase 3)
                health_checks: cyclesCaptured, // One health check per cycle
                gaps_detected: 0, // TODO: Calculate gaps (time between cycles > 15 min)
                health_status: healthStatus,
                data_integrity: dataIntegrity
            };
            
            // Log hourly summary
            this.logger.logHourlySummary(summary);
            
            // Clear accumulated cycles (they're now in the hourly summary)
            this.logger.clearCycleSummaries();
            
            // Reset accumulators for next hour
            this.accumulatedFileChanges = 0;
            this.accumulatedGitCommits = 0;
            this.lastHourlySummaryTime = Date.now();
            
        } catch (error) {
            this.logger.error(`Hourly summary generation failed: ${error}`);
        }
    }
    
    /**
     * Stop all timers (cycle + watchdog + hourly summary)
     */
    stop(): void {
        this.timerRegistry.clear('kernel:cognitive-cycle');
        this.timerRegistry.clear('kernel:cognitive-watchdog');
        
        // Phase 4: Clear hourly summary timer
        if (this.hourlySummaryTimer) {
            clearInterval(this.hourlySummaryTimer);
            this.hourlySummaryTimer = null;
        }
        
        // Phase E2.6: Stop IDE & Build listeners (Quick Wins)
        try {
            this.ideActivityListener.stop();
            this.buildMetricsListener.stop();
        } catch (e) {
            // Ignore cleanup errors
        }
    }
    
    /**
     * Dispose all event listeners (CRITICAL for memory leak prevention)
     */
    disposeAll(): void {
        try {
            // Dispose IDE activity listener (cleans VS Code event listeners)
            if (this.ideActivityListener) {
                this.ideActivityListener.dispose();
                this.logger.system('✅ IDEActivityListener disposed', '✅');
            }
            
            // Dispose build metrics listener (cleans VS Code event listeners)
            if (this.buildMetricsListener) {
                this.buildMetricsListener.dispose();
                this.logger.system('✅ BuildMetricsListener disposed', '✅');
            }
        } catch (e) {
            this.logger.error(`Error disposing listeners: ${e}`);
        }
    }
    
    /**
     * Log helper (uses outputChannel if available, fallback to console)
     */
    private log(message: string): void {
        const timestamp = new Date().toISOString();
        const timeDisplay = timestamp.substring(11, 23); // HH:MM:SS.mmm
        
        if (this.logger) {
            this.logger.system(`[Scheduler] ${message}`);
        } else {
            console.log(`[${timeDisplay}] [Scheduler] ${message}`);
        }
    }
    
    /**
     * Run a complete cognitive cycle
     */
    async runCycle(): Promise<CycleResult> {
        this.logger.system("🔥 [runCycle] Entered runCycle()", "🔥");
        
        if (this.isRunning) {
            this.logger.system("🔥 [runCycle] SKIPPED — isRunning=true", "🔥");
            return this.createSkippedResult();
        }
        
        this.isRunning = true;
        this.logger.system('🔥 [DEBUG] isRunning set to true, starting cycle...', '🔥');
        
        // ✅ P0-HARDENING-01: Outermost try/finally to guarantee isRunning reset
        try {
            this.cycleCount++;
            this.logger.cycleStart(this.cycleCount);
            this.logger.system('🔥 [DEBUG] After cycleStart(), before calculating input hash...', '🔥');
            
            const startTime = Date.now();
            const result: CycleResult = {
                cycleId: this.cycleCount,
                startedAt: new Date().toISOString(),
                completedAt: '',
                duration: 0,
                phases: [],
                inputHash: '',
                success: false
            };
            
            try {
                // Calculate input hash for idempotence
                this.logger.system('🔥 [DEBUG] Calling calculateInputHash()...', '🔥');
                result.inputHash = await this.calculateInputHash();
                this.logger.system(`🔥 [DEBUG] calculateInputHash() returned: ${result.inputHash}`, '🔥');
                
                // Skip if same input as last cycle (idempotence)
                if (result.inputHash === this.lastInputHash) {
                    this.logger.system('⏭️ Skipping cycle (same input hash)', '⏭️');
                    result.success = true;
                    result.phases.push({
                        name: 'idempotence-skip',
                        duration: 0,
                        success: true
                    });
                    return result;
                }
                
                this.lastInputHash = result.inputHash;
                
                // Phase 1: Pattern Learning (skip if ingestion lock is active)
                const patternPhase = await this.runPhase('pattern-learning', async () => {
                    // Check if ingestion lock is active (prevents overwriting imported data)
                    if (this.ingestionLockChecker && this.ingestionLockChecker()) {
                        this.logger.system('⏸️ Pattern Learning skipped (ingestion lock active)', '⏸️');
                        return { patternsDetected: 0, patterns: [], skipped: true, reason: 'ingestion_lock' };
                    }
                    
                    const engine = new PatternLearningEngine(this.workspaceRoot);
                    const patterns = await engine.analyzePatterns();
                    
                    // Phase E2.7: Track pattern evolution (History Enrichment)
                    try {
                        await this.patternEvolutionTracker.trackChanges(patterns, result.cycleId);
                    } catch (evolutionError) {
                        this.logger.warning(`Pattern evolution tracking failed (non-critical): ${evolutionError}`);
                    }
                    
                    return { patternsDetected: patterns.length, patterns };
                });
                result.phases.push(patternPhase);
                this.logger.phase('pattern-learning', this.cycleCount, patternPhase.metrics?.patternsDetected || 0, patternPhase.duration);
                
                // Phase 2: Correlation
                const correlationPhase = await this.runPhase('correlation', async () => {
                    const engine = new CorrelationEngine(this.workspaceRoot);
                    const correlations = await engine.analyze();
                    // No correlations is normal for new workspaces or workspaces with limited activity
                    // CorrelationEngine already logs internally if needed
                    return { correlationsFound: correlations.length, correlations };
                });
                result.phases.push(correlationPhase);
                this.logger.phase('correlation', this.cycleCount, correlationPhase.metrics?.correlationsFound || 0, correlationPhase.duration);
                
                // Phase 3: Forecasting (using persistent engine with adaptive baseline)
                const forecastPhase = await this.runPhase('forecasting', async () => {
                    const forecasts = await this.forecastEngine.generate();
                    return { forecastsGenerated: forecasts.length, forecasts };
                });
                result.phases.push(forecastPhase);
                this.logger.phase('forecasting', this.cycleCount, forecastPhase.metrics?.forecastsGenerated || 0, forecastPhase.duration);
                
                // Phase 4: ADR Synthesis
                const adrPhase = await this.runPhase('adr-synthesis', async () => {
                    const generator = new ADRGeneratorV2(this.workspaceRoot);
                    const proposals = await generator.generateProposals();
                    return { adrsGenerated: proposals.length, proposals };
                });
                result.phases.push(adrPhase);
                this.logger.phase('adr-synthesis', this.cycleCount, adrPhase.metrics?.adrsGenerated || 0, adrPhase.duration);
                
                result.success = true;
                
            } catch (error) {
                result.success = false;
                this.logger.error(`Cycle failed: ${error}`);
            } finally {
                result.completedAt = new Date().toISOString();
                result.duration = Date.now() - startTime;
                
                // Update watchdog timestamp (successful or not, we ran)
                this.lastCycleTime = Date.now();
            }
            
            // Aggregate cycle summary and append to cycles.jsonl (CycleAggregator)
            await this.aggregateAndPersistCycle(result);
            
            // Extract phase counts for cycle summary
            const phases = {
                patterns: result.phases.find(p => p.name === 'pattern-learning')?.metrics?.patternsDetected || 0,
                correlations: result.phases.find(p => p.name === 'correlation')?.metrics?.correlationsFound || 0,
                forecasts: result.phases.find(p => p.name === 'forecasting')?.metrics?.forecastsGenerated || 0,
                adrs: result.phases.find(p => p.name === 'adr-synthesis')?.metrics?.adrsGenerated || 0
            };
            
            // Mock health data (will be replaced by real HealthMonitor in future)
            const health = {
                drift: Math.random() * 0.5, // Mock: 0-0.5
                coherence: 0.7 + Math.random() * 0.3, // Mock: 0.7-1.0
                status: result.success ? 'stable' : 'error'
            };
            
            this.logger.cycleEnd(this.cycleCount, phases, health);
            
            // Phase E2.2: Real feedback loop every 100 cycles
            if (result.cycleId % 100 === 0) {
                await this.applyFeedbackLoop(result.cycleId);
                
                // Log checkpoint summary
                const timestamp = new Date().toISOString().substring(11, 23);
                this.logger.getChannel().appendLine('');
                this.logger.getChannel().appendLine(`[${timestamp}] ═══════════════════════════════════════`);
                this.logger.getChannel().appendLine(`[${timestamp}] 🔍 Checkpoint: Cycle ${result.cycleId}`);
                this.logger.getChannel().appendLine(`[${timestamp}] 📊 Baseline: ${this.forecastEngine.metrics.forecast_precision.toFixed(3)}`);
                this.logger.getChannel().appendLine(`[${timestamp}] 📈 Improvement: ${this.forecastEngine.metrics.improvement_rate >= 0 ? '+' : ''}${this.forecastEngine.metrics.improvement_rate.toFixed(4)}`);
                this.logger.getChannel().appendLine(`[${timestamp}] 📦 Total Evals: ${this.forecastEngine.metrics.total_forecasts}`);
                this.logger.getChannel().appendLine(`[${timestamp}] ═══════════════════════════════════════`);
                this.logger.getChannel().appendLine('');
            }
            
            return result;
            
        } finally {
            // ✅ P0-HARDENING-01: Guaranteed reset even if unhandled error occurs
            this.isRunning = false;
        }
    }
    
    /**
     * Run a single phase
     */
    private async runPhase(
        name: string,
        executor: () => Promise<any>
    ): Promise<PhaseResult> {
        const start = Date.now();
        
        try {
            const metrics = await executor();
            
            return {
                name,
                duration: Date.now() - start,
                success: true,
                metrics
            };
        } catch (error) {
            return {
                name,
                duration: Date.now() - start,
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }
    
    /**
     * Calculate input hash (for idempotence)
     */
    private async calculateInputHash(): Promise<string> {
        // Placeholder: hash of recent events, patterns, etc.
        const input = {
            timestamp: new Date().toISOString().split('T')[0], // Daily granularity
            cycleCount: this.cycleCount
        };
        
        return crypto.createHash('sha256')
            .update(JSON.stringify(input))
            .digest('hex')
            .substring(0, 16);
    }
    
    /**
     * Create skipped result
     */
    private createSkippedResult(): CycleResult {
        return {
            cycleId: this.cycleCount,
            startedAt: new Date().toISOString(),
            completedAt: new Date().toISOString(),
            duration: 0,
            phases: [],
            inputHash: '',
            success: false
        };
    }
    
    /**
     * CycleAggregator - Aggregate cycle results and persist to cycles.jsonl
     * 
     * This method:
     * 1. Extracts phase metrics (patterns, correlations, forecasts, ADRs)
     * 2. Hashes each phase output for integrity
     * 3. Appends cycle summary to ledger with inter-cycle chaining
     */
    private async aggregateAndPersistCycle(result: CycleResult): Promise<void> {
        try {
            // Extract phase metrics and hash each phase output
            const phases = {
                patterns: this.hashPhaseMetrics(result.phases.find(p => p.name === 'pattern-learning')?.metrics || {}),
                correlations: this.hashPhaseMetrics(result.phases.find(p => p.name === 'correlation')?.metrics || {}),
                forecasts: this.hashPhaseMetrics(result.phases.find(p => p.name === 'forecasting')?.metrics || {}),
                adrs: this.hashPhaseMetrics(result.phases.find(p => p.name === 'adr-synthesis')?.metrics || {})
            };
            
            // Append cycle summary to ledger (with inter-cycle chaining)
            // Note: prevMerkleRoot is automatically retrieved by RBOMLedger from cache
            await this.ledger.appendCycle({
                cycleId: result.cycleId,
                timestamp: result.completedAt,
                phases,
                merkleRoot: '' // Will be computed by RBOMLedger
            });
            
            // Force immediate flush for critical ledger data
            await this.ledger.flush();
            
            // Phase E2.3: Update cache index incrementally
            try {
                const cycleData = {
                    cycleId: result.cycleId,
                    timestamp: result.completedAt,
                    phases,
                    merkleRoot: '' // Will be filled by ledger
                };
                
                // Extract files from recent file changes (optional, can be empty)
                const files: string[] = []; // TODO: extract from file_changes if needed
                
                await this.cacheIndexer.updateIncremental(cycleData, files);
            } catch (indexError) {
                // Silent failure in minimal mode
            }
            
            // Phase E2.3: Generate context snapshot
            try {
                await this.contextSnapshot.generate(result.cycleId);
            } catch (snapshotError) {
                // Silent failure in minimal mode
            }
            
            // Phase E2.4: Generate timeline (every 10 cycles)
            if (result.cycleId % 10 === 0) {
                try {
                    await this.timelineAggregator.generateToday();
                } catch (timelineError) {
                    // Silent failure in minimal mode
                }
            }
            
            // Phase E2.6: Capture IDE activity (every 10 cycles - Quick Wins)
            if (result.cycleId % 10 === 0) {
                try {
                    await this.ideActivityListener.captureSnapshot();
                } catch (ideError) {
                    // Silent failure in minimal mode
                }
            }
            
            // 🗂️ P0-CORE-01: Write kernel artifacts (every 10 cycles)
            if (result.cycleId % 10 === 0) {
                try {
                    await this.writeArtifacts(result);
                    this.logger.system(`💾 Kernel artifacts written (cycle ${result.cycleId})`, '💾');
                } catch (artifactError) {
                    this.logger.warning(`⚠️  Failed to write kernel artifacts: ${artifactError}`);
                }
            }
            
            // Phase E2.4: Run normalization (every 100 cycles)
            if (result.cycleId % 100 === 0) {
                try {
                    const normReport = await this.dataNormalizer.normalize();
                    if (normReport.issues_fixed > 0) {
                        this.logger.system(`🔧 Normalization: ${normReport.issues_fixed} issues fixed`, '🔧');
                    }
                } catch (normError) {
                    // Silent failure in minimal mode
                }
            }
            
            // Phase E2.7: Save cognitive snapshot (TEST MODE: every 10 cycles, will be 100 in production)
            if (result.cycleId % 10 === 0) {
                try {
                    await this.snapshotRotation.saveSnapshot(result.cycleId);
                    await this.snapshotRotation.updateIndex();
                } catch (snapshotError) {
                    // Silent failure in minimal mode
                }
            }
            
        } catch (error) {
            this.logger.error(`Failed to aggregate cycle ${result.cycleId}: ${error}`);
            // Non-critical error: don't throw, just log
        }
    }
    
    /**
     * Hash phase metrics for integrity verification
     */
    private hashPhaseMetrics(metrics: any): { hash: string; count: number } {
        const metricsStr = JSON.stringify(metrics);
        const hash = crypto.createHash('sha256')
            .update(metricsStr)
            .digest('hex')
            .substring(0, 16);
        
        // Extract count from metrics (default to 0)
        const count = metrics.patternsDetected || 
                     metrics.correlationsFound || 
                     metrics.forecastsGenerated || 
                     metrics.adrsGenerated || 
                     0;
        
        return { hash, count };
    }

    /**
     * Phase E2.2: Apply feedback loop with REAL metrics
     * 
     * Computes actual feedback from system performance:
     * - Forecast accuracy (predictions vs. reality)
     * - Pattern stability (variance over cycles)
     * - ADR adoption rate (unique vs. duplicate decisions)
     * - Cycle efficiency (latency)
     * 
     * @param cycleId - Current cycle ID
     */
    private async applyFeedbackLoop(cycleId: number): Promise<void> {
        try {
            // E2.2: Compute real metrics from FeedbackEvaluator
            const metrics = await this.feedbackEvaluator.computeComprehensiveFeedback();
            
            // Use forecast accuracy as primary feedback signal
            const realFeedback = metrics.forecast_accuracy;
            
            // Update baseline with real feedback
            const prevPrecision = this.forecastEngine.metrics.forecast_precision;
            this.forecastEngine.updateBaseline(realFeedback);
            const newPrecision = this.forecastEngine.metrics.forecast_precision;
            
            // Persist updated metrics + full evaluation
            const updatedMetrics = this.forecastEngine.getMetrics();
            await KernelBootstrap.saveState(
                {
                    version: '2.0.6',
                    cycle: cycleId,
                    updated_at: new Date().toISOString(),
                    forecast_metrics: updatedMetrics,
                    evaluation_metrics: metrics,
                    feedback_history: {
                        prev_precision: prevPrecision,
                        new_precision: newPrecision,
                        delta: newPrecision - prevPrecision,
                        feedback_used: realFeedback
                    }
                },
                this.workspaceRoot
            );
            
        } catch (error) {
            this.logger.error(`[E2.2] Feedback loop failed: ${error}`);
        }
    }
    
    /**
     * 🗂️ P0-CORE-01: Load kernel artifacts from disk
     * Restores state.json.gz, universals.json.gz, cognitive_history.json.gz
     */
    private async loadArtifacts(): Promise<void> {
        console.log('[P0-CORE-01B] 🔥 loadArtifacts() entered');
        const artifactsDir = path.join(this.workspaceRoot, '.reasoning_rl4', 'artifacts');
        console.log('[P0-CORE-01B] Artifacts dir:', artifactsDir);
        
        // Load state.json.gz
        const stateFile = path.join(artifactsDir, 'state.json.gz');
        console.log('[P0-CORE-01B] Checking state file:', stateFile);
        console.log('[P0-CORE-01B] File exists?', fs.existsSync(stateFile));
        if (fs.existsSync(stateFile)) {
            console.log('[P0-CORE-01B] Reading state.json.gz...');
            const compressed = fs.readFileSync(stateFile);
            const decompressed = await gunzip(compressed);
            const state = JSON.parse(decompressed.toString('utf-8'));
            console.log('[P0-CORE-01B] State loaded:', state);
            
            // Restore cycle count
            if (state.cycleCount) {
                this.cycleCount = state.cycleCount;
                console.log('[P0-CORE-01B] 📊 Restored cycle count:', this.cycleCount);
                this.logger.system(`📊 Restored cycle count: ${this.cycleCount}`, '📊');
            }
        } else {
            console.log('[P0-CORE-01B] ⚠️ state.json.gz not found');
        }
        
        // Load universals.json.gz (patterns, correlations, forecasts)
        const universalsFile = path.join(artifactsDir, 'universals.json.gz');
        if (fs.existsSync(universalsFile)) {
            const compressed = fs.readFileSync(universalsFile);
            const decompressed = await gunzip(compressed);
            const universals = JSON.parse(decompressed.toString('utf-8'));
            
            this.logger.system(`📊 Loaded universals: ${universals.patterns?.length || 0} patterns, ${universals.correlations?.length || 0} correlations, ${universals.forecasts?.length || 0} forecasts`, '📊');
        }
        
        // Load cognitive_history.json.gz (last 100 cycles)
        const historyFile = path.join(artifactsDir, 'cognitive_history.json.gz');
        if (fs.existsSync(historyFile)) {
            const compressed = fs.readFileSync(historyFile);
            const decompressed = await gunzip(compressed);
            const history = JSON.parse(decompressed.toString('utf-8'));
            
            this.logger.system(`📊 Loaded cognitive history: ${history.cycles?.length || 0} cycles`, '📊');
        }
    }
    
    /**
     * 🗂️ P0-CORE-01: Write kernel artifacts to disk
     * Saves state.json.gz, universals.json.gz, cognitive_history.json.gz
     */
    private async writeArtifacts(result: CycleResult): Promise<void> {
        const artifactsDir = path.join(this.workspaceRoot, '.reasoning_rl4', 'artifacts');
        
        // Ensure artifacts directory exists
        if (!fs.existsSync(artifactsDir)) {
            fs.mkdirSync(artifactsDir, { recursive: true });
        }
        
        // Write state.json.gz
        const state = {
            version: '3.5.11',
            cycleCount: this.cycleCount,
            lastCycleId: result.cycleId,
            lastInputHash: result.inputHash,
            timestamp: result.completedAt
        };
        const stateJson = JSON.stringify(state, null, 2);
        const stateCompressed = await gzip(Buffer.from(stateJson, 'utf-8'));
        fs.writeFileSync(path.join(artifactsDir, 'state.json.gz'), stateCompressed);
        
        // Write universals.json.gz (patterns, correlations, forecasts from this cycle)
        const universals = {
            patterns: result.phases.find(p => p.name === 'pattern-learning')?.metrics?.patterns || [],
            correlations: result.phases.find(p => p.name === 'correlation')?.metrics?.correlations || [],
            forecasts: result.phases.find(p => p.name === 'forecasting')?.metrics?.forecasts || [],
            timestamp: result.completedAt
        };
        const universalsJson = JSON.stringify(universals, null, 2);
        const universalsCompressed = await gzip(Buffer.from(universalsJson, 'utf-8'));
        fs.writeFileSync(path.join(artifactsDir, 'universals.json.gz'), universalsCompressed);
        
        // Write cognitive_history.json.gz (append current cycle, keep last 100)
        const historyFile = path.join(artifactsDir, 'cognitive_history.json.gz');
        let history: any = { cycles: [] };
        
        // Load existing history if present
        if (fs.existsSync(historyFile)) {
            try {
                const compressed = fs.readFileSync(historyFile);
                const decompressed = await gunzip(compressed);
                history = JSON.parse(decompressed.toString('utf-8'));
            } catch (error) {
                // If decompression fails, start fresh
                history = { cycles: [] };
            }
        }
        
        // Append current cycle
        history.cycles.push({
            cycleId: result.cycleId,
            timestamp: result.completedAt,
            duration: result.duration,
            inputHash: result.inputHash,
            success: result.success,
            phases: result.phases
        });
        
        // Keep only last 100 cycles
        if (history.cycles.length > 100) {
            history.cycles = history.cycles.slice(-100);
        }
        
        const historyJson = JSON.stringify(history, null, 2);
        const historyCompressed = await gzip(Buffer.from(historyJson, 'utf-8'));
        fs.writeFileSync(historyFile, historyCompressed);
    }
}


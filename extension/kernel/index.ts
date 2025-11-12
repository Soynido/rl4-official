/**
 * RL4 Kernel - Main Entry Point
 * 
 * Exports all kernel components
 */

export { TimerRegistry, TimerHandle } from './TimerRegistry';
export { AppendOnlyWriter, AppendOptions } from './AppendOnlyWriter';
export { ExecPool, ExecOptions, ExecResult, ExecMetrics } from './ExecPool';
export { StateRegistry, KernelState } from './StateRegistry';
export { HealthMonitor, HealthMetrics, HealthAlert } from './HealthMonitor';
export { KernelAPI, KernelStatus } from './KernelAPI';
export { CognitiveScheduler, CycleResult, PhaseResult } from './CognitiveScheduler';
export { RBOMLedger, RBOMEntry, MerkleRoot } from './RBOMLedger';
export { EvidenceGraph } from './EvidenceGraph';
export { loadKernelConfig, KernelConfig } from './config';
export { KernelBootstrap, KernelArtifacts } from './KernelBootstrap';

// Adapters
export { initTimerProxy, proxySetInterval, proxySetTimeout } from './adapters/TimerProxy';
export { PersistenceManagerProxy } from './adapters/PersistenceManagerProxy';


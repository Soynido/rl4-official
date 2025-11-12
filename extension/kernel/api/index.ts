/**
 * RL4 Kernel API - Public Exports
 * 
 * Central export point for all RL4 API modules:
 * - StateReconstructor: Historical state reconstruction
 * - WhereAmISnapshot: Real-time cognitive context
 * - Hooks: Event-driven API for external integration
 */

export { StateReconstructor } from './StateReconstructor';
export type { CognitiveState, TimeSeriesData } from './StateReconstructor';

export { generateWhereAmI, generateSnapshotJSON } from './WhereAmISnapshot';
export type { CognitiveSnapshot } from './WhereAmISnapshot';

export { RL4Hooks } from './hooks/RL4Hooks';
export type { ReasoningContext, CognitiveEvent, RestorePoint, Forecast } from './hooks/RL4Hooks';


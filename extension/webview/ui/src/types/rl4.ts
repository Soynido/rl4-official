/**
 * RL4 Message Types for Kernel ↔ WebView communication
 * No-mock data contract - only real data from .reasoning_rl4/* sources
 */

export type RL4Now = {
  cycleId: number;
  timestamp: string;
  focusedFile?: string;
  recentlyViewed?: string[];
  patterns?: { id: string; confidence: number; trend?: string }[];
  forecasts?: { predicted: string; confidence: number; category?: string }[];
  mood?: string;
  confidence?: number;
  phase?: 'exploration' | 'stabilization' | 'production' | 'unknown';
  criticalModules?: string[];
  constraints?: {
    recentADRs: { id: string; title: string; decision?: string }[];
    techDebt: string[];
  };
  health?: {
    predictiveDrift?: number;
    coherence?: number;
    actionAdoption?: number;
  };
};

export type RL4Before = {
  date: string;
  points: Array<{
    cycleId: number;
    timestamp: string;
    heat: number;
    summary?: string;
  }>;
};

export type RL4Next = {
  phase?: RL4Now['phase'];
  patterns?: RL4Now['patterns'];
  correlations?: { id: string; direction?: string; score?: number }[];
  goals?: { id: string; title: string; status: 'active' | 'completed' | 'pending' }[];
  adrs?: { id: string; title: string; decision?: string; timestamp?: string }[];
  risks?: string[];
  integrity?: {
    cycleCoherence: number;
    patternDrift: number;
    forecastAccuracy: number;
    overallHealth: number;
    recommendations: string[];
  };
};

export type RL4RestoreIndex = {
  entries: Array<{
    cycleId: number;
    timestamp: string;
    label?: string;
    artifacts: {
      snapshot: string;
      diffs?: string;
      state?: string;
    };
  }>;
};

export type RL4Message =
  | { type: 'updateNow'; payload: RL4Now }
  | { type: 'updateBefore'; payload: RL4Before }
  | { type: 'updateNext'; payload: RL4Next }
  | { type: 'updateRestore'; payload: RL4RestoreIndex };
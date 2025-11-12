import { create } from 'zustand';
import type { RL4Now, RL4Before, RL4Next, RL4RestoreIndex } from '@/types/rl4';

// Legacy interface for backward compatibility
interface RL4Snapshot {
  cycleId?: number;
  timestamp?: string;
  focusedFile?: string;
  focus?: string;
  recentlyViewed?: string[];
  patterns?: Array<{
    id: string;
    confidence: number;
    trend?: string;
    impact?: string;
    [key: string]: any;
  }>;
  forecasts?: Array<{
    predicted: string;
    confidence: number;
    category?: string;
    [key: string]: any;
  }>;
  mood?: string;
  confidence?: number;

  // Extended data for agent calibration
  architecture?: {
    projectName: string;
    phase: 'exploration' | 'stabilization' | 'production' | 'unknown';
    criticalModules: string[];
  };
  constraints?: {
    recentADRs: Array<{ id: string; title: string; decision: string }>;
    techDebt: string[];
  };
  alerts?: {
    activeBiases: Array<{ type: string; count: number }>;
    healthMetrics: {
      predictiveDrift: number;
      coherence: number;
      actionAdoption: number;
    };
  };
  goals?: {
    active: number;
    completed: number;
    successRate: number;
    list: any[];
  };
  adrs?: {
    total: number;
    recent: any[];
  };
  correlations?: {
    total: number;
    directions: Record<string, number>;
  };
  biases?: {
    total: number;
    types: Record<string, number>;
  };
  [key: string]: any;
}

interface RL4Store {
  // Legacy support
  snapshot: RL4Snapshot | null;
  updateSnapshot: (snapshot: RL4Snapshot) => void;
  getFocusedFile: () => string | undefined;
  getPatterns: () => Array<{ id: string; confidence: number; [key: string]: any }>;
  getForecasts: () => Array<{ predicted: string; confidence: number; [key: string]: any }>;
  getMood: () => string;

  // New RL4 message types
  now: RL4Now | null;
  before: RL4Before | null;
  next: RL4Next | null;
  restore: RL4RestoreIndex | null;

  updateNow: (now: RL4Now) => void;
  updateBefore: (before: RL4Before) => void;
  updateNext: (next: RL4Next) => void;
  updateRestore: (restore: RL4RestoreIndex) => void;
}

export const useRL4Store = create<RL4Store>((set, get) => ({
  // Legacy support
  snapshot: null,

  updateSnapshot: (snapshot: RL4Snapshot) => set({ snapshot }),

  getFocusedFile: () => get().snapshot?.focusedFile || get().snapshot?.focus,

  getPatterns: () => get().snapshot?.patterns || [],

  getForecasts: () => get().snapshot?.forecasts || [],

  getMood: () => get().snapshot?.mood || 'Unknown',

  // New RL4 message types
  now: null,
  before: null,
  next: null,
  restore: null,

  updateNow: (now: RL4Now) => set({ now }),
  updateBefore: (before: RL4Before) => set({ before }),
  updateNext: (next: RL4Next) => set({ next }),
  updateRestore: (restore: RL4RestoreIndex) => set({ restore }),
}));


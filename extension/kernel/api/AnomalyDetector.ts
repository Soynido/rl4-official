/**
 * AnomalyDetector — Détection proactive d'anomalies via LLM
 * 
 * Détecte des anomalies sémantiques que les règles mathématiques ne peuvent pas voir:
 * - Changements soudains de patterns
 * - Régressions potentielles
 * - Activité inhabituelle
 * - Patterns manquants attendus
 * - Forecasts qui semblent incorrects
 * 
 * Utilise le LLM pour l'analyse sémantique (pas de règles hardcodées)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface Anomaly {
  id: string;
  type: 'sudden_change' | 'regression' | 'missing_pattern' | 'unusual_activity' | 'forecast_inaccuracy' | 'bias_spike';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  detected_at: string;
  context: {
    metric?: string;
    value?: number;
    expected?: number;
    timeframe?: string;
  };
  recommendation: string;
  related_items?: string[]; // IDs de patterns/forecasts/ADRs concernés
}

export interface WorkspaceContext {
  recentCommits: number;
  fileChanges: number;
  patterns: any[];
  forecasts: any[];
  correlations: any[];
  adrs: any[];
  cycles: number;
  health: {
    memoryMB: number;
    eventLoopLag: number;
  };
  bias: number;
  planDrift: number;
  cognitiveLoad: number;
}

export class AnomalyDetector {
  private workspaceRoot: string;
  private rl4Path: string;
  private anomaliesPath: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.rl4Path = path.join(workspaceRoot, '.reasoning_rl4');
    this.anomaliesPath = path.join(this.rl4Path, 'anomalies.jsonl');
  }

  /**
   * Détecter les anomalies dans le contexte actuel
   * Le LLM analysera et détectera les anomalies sémantiques
   */
  async detectAnomalies(context: WorkspaceContext): Promise<Anomaly[]> {
    // Pour l'instant, détection basique (règles simples)
    // TODO: Intégrer dans UnifiedPromptBuilder pour analyse LLM complète
    
    const anomalies: Anomaly[] = [];

    // 1. Détecter changements soudains
    const suddenChange = this.detectSuddenChange(context);
    if (suddenChange) anomalies.push(suddenChange);

    // 2. Détecter régressions
    const regression = this.detectRegression(context);
    if (regression) anomalies.push(regression);

    // 3. Détecter activité inhabituelle
    const unusualActivity = this.detectUnusualActivity(context);
    if (unusualActivity) anomalies.push(unusualActivity);

    // 4. Détecter bias spike
    const biasSpike = this.detectBiasSpike(context);
    if (biasSpike) anomalies.push(biasSpike);

    // 5. Détecter plan drift critique
    const planDrift = this.detectPlanDrift(context);
    if (planDrift) anomalies.push(planDrift);

    // Sauvegarder les anomalies
    if (anomalies.length > 0) {
      await this.saveAnomalies(anomalies);
    }

    return anomalies;
  }

  /**
   * Détecter changements soudains (via historique)
   */
  private detectSuddenChange(context: WorkspaceContext): Anomaly | null {
    // Comparer avec historique récent
    const recentHistory = this.loadRecentHistory();
    
    if (recentHistory.length < 2) return null;

    const last = recentHistory[recentHistory.length - 1];
    const previous = recentHistory[recentHistory.length - 2];

    // Changement soudain de patterns
    if (context.patterns.length > 0 && last.patternsCount > 0) {
      const patternChange = Math.abs(context.patterns.length - last.patternsCount) / last.patternsCount;
      if (patternChange > 0.5) { // +50% changement
        return {
          id: `sudden-change-${Date.now()}`,
          type: 'sudden_change',
          severity: 'medium',
          description: `Sudden change in patterns detected: ${last.patternsCount} → ${context.patterns.length} (${(patternChange * 100).toFixed(0)}% change)`,
          detected_at: new Date().toISOString(),
          context: {
            metric: 'patterns_count',
            value: context.patterns.length,
            expected: last.patternsCount,
            timeframe: 'last cycle'
          },
          recommendation: 'Review recent changes to understand if this is intentional or a sign of instability.'
        };
      }
    }

    // Changement soudain de commits
    if (context.recentCommits > 0 && last.commitsCount > 0) {
      const commitChange = Math.abs(context.recentCommits - last.commitsCount) / last.commitsCount;
      if (commitChange > 2.0) { // 2x changement
        return {
          id: `sudden-commits-${Date.now()}`,
          type: 'unusual_activity',
          severity: 'low',
          description: `Unusual commit activity: ${last.commitsCount} → ${context.recentCommits} commits`,
          detected_at: new Date().toISOString(),
          context: {
            metric: 'commits',
            value: context.recentCommits,
            expected: last.commitsCount,
            timeframe: 'last 24h'
          },
          recommendation: 'This might indicate a sprint, bug fix session, or merge activity.'
        };
      }
    }

    return null;
  }

  /**
   * Détecter régressions potentielles
   */
  private detectRegression(context: WorkspaceContext): Anomaly | null {
    // Régression de santé système
    if (context.health.memoryMB > 500) { // >500MB = potentiel problème
      return {
        id: `regression-memory-${Date.now()}`,
        type: 'regression',
        severity: 'high',
        description: `High memory usage detected: ${context.health.memoryMB.toFixed(0)}MB`,
        detected_at: new Date().toISOString(),
        context: {
          metric: 'memory_mb',
          value: context.health.memoryMB,
          expected: 300,
          timeframe: 'current'
        },
        recommendation: 'Investigate memory leaks or optimize resource usage.'
      };
    }

    // Régression event loop
    if (context.health.eventLoopLag > 100) { // >100ms = problème
      return {
        id: `regression-eventloop-${Date.now()}`,
        type: 'regression',
        severity: 'high',
        description: `High event loop lag: ${context.health.eventLoopLag.toFixed(2)}ms`,
        detected_at: new Date().toISOString(),
        context: {
          metric: 'event_loop_lag',
          value: context.health.eventLoopLag,
          expected: 50,
          timeframe: 'current'
        },
        recommendation: 'Check for blocking operations or CPU-intensive tasks.'
      };
    }

    return null;
  }

  /**
   * Détecter activité inhabituelle
   */
  private detectUnusualActivity(context: WorkspaceContext): Anomaly | null {
    // Trop de cycles sans activité réelle
    if (context.cycles > 100 && context.recentCommits === 0 && context.fileChanges === 0) {
      return {
        id: `unusual-inactivity-${Date.now()}`,
        type: 'unusual_activity',
        severity: 'low',
        description: `High cycle count (${context.cycles}) but no commits or file changes detected`,
        detected_at: new Date().toISOString(),
        context: {
          metric: 'cycles_vs_activity',
          value: context.cycles,
          expected: context.recentCommits + context.fileChanges,
          timeframe: 'recent'
        },
        recommendation: 'System is running but no development activity detected. This might be normal for inactive periods.'
      };
    }

    return null;
  }

  /**
   * Détecter spike de bias
   */
  private detectBiasSpike(context: WorkspaceContext): Anomaly | null {
    if (context.bias > 0.5) { // >50% drift
      return {
        id: `bias-spike-${Date.now()}`,
        type: 'bias_spike',
        severity: 'high',
        description: `High plan drift detected: ${(context.bias * 100).toFixed(0)}%`,
        detected_at: new Date().toISOString(),
        context: {
          metric: 'bias',
          value: context.bias,
          expected: 0.25,
          timeframe: 'current'
        },
        recommendation: 'Project has significantly deviated from original plan. Consider recalibrating or updating the baseline plan.'
      };
    }

    return null;
  }

  /**
   * Détecter plan drift critique
   */
  private detectPlanDrift(context: WorkspaceContext): Anomaly | null {
    if (context.planDrift > 0.3) { // >30% drift
      return {
        id: `plan-drift-${Date.now()}`,
        type: 'regression',
        severity: 'medium',
        description: `Significant plan drift: ${(context.planDrift * 100).toFixed(0)}%`,
        detected_at: new Date().toISOString(),
        context: {
          metric: 'plan_drift',
          value: context.planDrift,
          expected: 0.1,
          timeframe: 'current'
        },
        recommendation: 'Review if the plan needs to be updated to reflect current reality, or if scope creep needs to be addressed.'
      };
    }

    return null;
  }

  /**
   * Charger l'historique récent pour comparaison
   */
  private loadRecentHistory(): Array<{ patternsCount: number; commitsCount: number; timestamp: string }> {
    try {
      const cyclesPath = path.join(this.rl4Path, 'ledger', 'cycles.jsonl');
      if (!fs.existsSync(cyclesPath)) {
        return [];
      }

      const content = fs.readFileSync(cyclesPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      
      // Prendre les 10 derniers cycles
      return lines.slice(-10).map(line => {
        try {
          const cycle = JSON.parse(line);
          return {
            patternsCount: cycle.phases?.patterns?.count || 0,
            commitsCount: cycle.git_commits?.length || 0,
            timestamp: cycle.timestamp || cycle._timestamp
          };
        } catch {
          return { patternsCount: 0, commitsCount: 0, timestamp: '' };
        }
      }).filter(h => h.timestamp);
    } catch {
      return [];
    }
  }

  /**
   * Sauvegarder les anomalies
   */
  private async saveAnomalies(anomalies: Anomaly[]): Promise<void> {
    try {
      const dir = path.dirname(this.anomaliesPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      const content = anomalies.map(a => JSON.stringify(a)).join('\n') + '\n';
      fs.appendFileSync(this.anomaliesPath, content, 'utf-8');
    } catch (error) {
      console.error('[AnomalyDetector] Failed to save anomalies:', error);
    }
  }

  /**
   * Charger les anomalies récentes
   */
  loadRecentAnomalies(limit: number = 10): Anomaly[] {
    try {
      if (!fs.existsSync(this.anomaliesPath)) {
        return [];
      }

      const content = fs.readFileSync(this.anomaliesPath, 'utf-8');
      const lines = content.trim().split('\n').filter(l => l.trim());
      
      return lines.slice(-limit).map(line => {
        try {
          return JSON.parse(line) as Anomaly;
        } catch {
          return null;
        }
      }).filter((a): a is Anomaly => a !== null);
    } catch {
      return [];
    }
  }
}


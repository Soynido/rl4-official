/**
 * RL4 Cognitive Integrity Pass
 *
 * Audit system for measuring cognitive coherence and predictive accuracy
 * Bridges the gap between raw data and meaningful insights
 *
 * Metrics calculated:
 * - Cycle Coherence: Pattern stability across cycles
 * - Pattern Drift: Evolution direction and magnitude
 * - Forecast Accuracy: Prediction vs outcome alignment
 * - ADR Impact: Decision consequence measurement
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CognitiveIntegrityReport {
  timestamp: string;
  cycleId: number;

  // Core metrics
  cycleCoherence: number;        // 0-1, higher = more consistent reasoning
  patternDrift: number;          // 0-1, higher = more change detected
  forecastAccuracy: number;      // 0-1, higher = better predictions
  adrImpact: number;             // 0-1, higher = more impactful decisions

  // Detailed breakdowns
  patternEvolution: PatternEvolutionReport[];
  forecastValidation: ForecastValidationReport[];
  adrConsequences: ADRConsequenceReport[];

  // Summary
  overallHealth: number;         // Aggregate cognitive health score
  recommendations: string[];     // Actionable insights
}

interface PatternEvolutionReport {
  id: string;
  confidence: number;
  trend: 'stable' | 'rising' | 'falling' | 'volatile';
  changeMagnitude: number;       // 0-1, how much the pattern changed
  cycleSpan: number;            // How many cycles analyzed
}

interface ForecastValidationReport {
  predicted: string;
  actual: string;
  confidence: number;
  accuracy: number;             // 0-1, how close prediction was to reality
  timeToRealization: number;    // cycles until forecast materialized
}

interface ADRConsequenceReport {
  adrId: string;
  title: string;
  impactScore: number;          // 0-1, magnitude of change
  affectedPatterns: string[];   // Patterns that changed after ADR
  healthDelta: number;          // Change in overall health metrics
}

export class CognitiveIntegrityPass {
  private rl4Path: string;

  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
  }

  /**
   * Run complete integrity audit
   */
  async runIntegrityPass(): Promise<CognitiveIntegrityReport> {
    console.log('[CognitiveIntegrity] Starting audit...');

    const currentCycle = this.getCurrentCycle();
    const timestamp = new Date().toISOString();

    // Run individual audits
    const patternEvolution = await this.analyzePatternEvolution();
    const forecastValidation = await this.validateForecasts();
    const adrConsequences = await this.analyzeADRImpact();

    // Calculate core metrics
    const cycleCoherence = this.calculateCycleCoherence(patternEvolution);
    const patternDrift = this.calculatePatternDrift(patternEvolution);
    const forecastAccuracy = this.calculateForecastAccuracy(forecastValidation);
    const adrImpact = this.calculateADRImpact(adrConsequences);

    // Generate recommendations
    const recommendations = this.generateRecommendations({
      cycleCoherence,
      patternDrift,
      forecastAccuracy,
      adrImpact
    });

    // Calculate overall health
    const overallHealth = (cycleCoherence + (1 - patternDrift) + forecastAccuracy + (1 - adrImpact)) / 4;

    const report: CognitiveIntegrityReport = {
      timestamp,
      cycleId: currentCycle,
      cycleCoherence,
      patternDrift,
      forecastAccuracy,
      adrImpact,
      patternEvolution,
      forecastValidation,
      adrConsequences,
      overallHealth,
      recommendations
    };

    console.log(`[CognitiveIntegrity] Audit complete. Health: ${(overallHealth * 100).toFixed(1)}%`);
    return report;
  }

  /**
   * Analyze how patterns evolve over time
   */
  private async analyzePatternEvolution(): Promise<PatternEvolutionReport[]> {
    const patternsPath = path.join(this.rl4Path, 'patterns.json');
    const historyPath = path.join(this.rl4Path, 'history', 'patterns_evolution.jsonl');

    if (!fs.existsSync(patternsPath) || !fs.existsSync(historyPath)) {
      return [];
    }

    const currentPatterns = JSON.parse(fs.readFileSync(patternsPath, 'utf8'));
    const historyLines = fs.readFileSync(historyPath, 'utf8').trim().split('\n');

    const reports: PatternEvolutionReport[] = [];

    for (const pattern of currentPatterns) {
      const patternHistory = historyLines
        .map(line => JSON.parse(line))
        .filter(entry => entry.patterns?.some((p: any) => p.id === pattern.id))
        .slice(-10); // Last 10 entries

      if (patternHistory.length < 2) continue;

      const confidences = patternHistory.map((h: any) =>
        h.patterns.find((p: any) => p.id === pattern.id)?.confidence || 0
      );

      const trend = this.calculateTrend(confidences);
      const changeMagnitude = this.calculateChangeMagnitude(confidences);

      reports.push({
        id: pattern.id,
        confidence: pattern.confidence,
        trend,
        changeMagnitude,
        cycleSpan: patternHistory.length
      });
    }

    return reports;
  }

  /**
   * Validate forecasts against actual outcomes
   */
  private async validateForecasts(): Promise<ForecastValidationReport[]> {
    const forecastsPath = path.join(this.rl4Path, 'forecasts.json');
    const outcomesPath = path.join(this.rl4Path, 'forecasts.raw.json');

    if (!fs.existsSync(forecastsPath)) return [];

    const forecasts = JSON.parse(fs.readFileSync(forecastsPath, 'utf8'));
    const outcomes = fs.existsSync(outcomesPath)
      ? JSON.parse(fs.readFileSync(outcomesPath, 'utf8'))
      : [];

    const reports: ForecastValidationReport[] = [];

    for (const forecast of forecasts.slice(-5)) { // Last 5 forecasts
      const actual = outcomes.find((o: any) =>
        o.predicted === forecast.predicted ||
        this.isSemanticMatch(forecast.predicted, o.actual)
      );

      if (actual) {
        const accuracy = this.calculateSemanticAccuracy(forecast.predicted, actual.actual);
        const timeToRealization = this.calculateTimeToRealization(forecast.timestamp, actual.timestamp);

        reports.push({
          predicted: forecast.predicted,
          actual: actual.actual,
          confidence: forecast.confidence,
          accuracy,
          timeToRealization
        });
      }
    }

    return reports;
  }

  /**
   * Analyze impact of Architectural Decisions
   */
  private async analyzeADRImpact(): Promise<ADRConsequenceReport[]> {
    const adrsPath = path.join(this.rl4Path, 'ledger', 'adrs.jsonl');
    const healthPath = path.join(this.rl4Path, 'diagnostics', 'health.jsonl');

    if (!fs.existsSync(adrsPath) || !fs.existsSync(healthPath)) {
      return [];
    }

    const adrs = fs.readFileSync(adrsPath, 'utf8')
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line))
      .slice(-10); // Last 10 ADRs

    const healthEntries = fs.readFileSync(healthPath, 'utf8')
      .trim()
      .split('\n')
      .filter(line => line.trim())
      .map(line => JSON.parse(line));

    const reports: ADRConsequenceReport[] = [];

    for (const adr of adrs) {
      const adrTime = new Date(adr.timestamp);

      // Find health entries before and after ADR
      const beforeHealth = healthEntries
        .filter((h: any) => new Date(h.timestamp) < adrTime)
        .slice(-1)[0];

      const afterHealth = healthEntries
        .filter((h: any) => new Date(h.timestamp) > adrTime)
        .slice(3)[0]; // 3 entries after

      if (beforeHealth && afterHealth) {
        const healthDelta = Math.abs(
          (afterHealth.coherence || 0) - (beforeHealth.coherence || 0)
        );

        reports.push({
          adrId: adr.id,
          title: adr.title,
          impactScore: Math.min(healthDelta * 2, 1), // Scale to 0-1
          affectedPatterns: [], // TODO: Cross-reference with pattern changes
          healthDelta
        });
      }
    }

    return reports;
  }

  // Helper methods for trend and magnitude calculations
  private calculateTrend(values: number[]): 'stable' | 'rising' | 'falling' | 'volatile' {
    if (values.length < 2) return 'stable';

    const firstHalf = values.slice(0, Math.floor(values.length / 2));
    const secondHalf = values.slice(Math.floor(values.length / 2));

    const firstAvg = firstHalf.reduce((a, b) => a + b) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b) / secondHalf.length;

    const variance = this.calculateVariance(values);

    if (variance > 0.3) return 'volatile';
    if (secondAvg > firstAvg + 0.1) return 'rising';
    if (secondAvg < firstAvg - 0.1) return 'falling';
    return 'stable';
  }

  private calculateChangeMagnitude(values: number[]): number {
    if (values.length < 2) return 0;
    return Math.abs(values[values.length - 1] - values[0]);
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b) / values.length;
    const variance = values.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private isSemanticMatch(predicted: string, actual: string): boolean {
    const predWords = predicted.toLowerCase().split(' ');
    const actWords = actual.toLowerCase().split(' ');
    const intersection = predWords.filter(word => actWords.includes(word));
    return intersection.length / Math.max(predWords.length, actWords.length) > 0.3;
  }

  private calculateSemanticAccuracy(predicted: string, actual: string): number {
    return this.isSemanticMatch(predicted, actual) ? 0.8 : 0.2;
  }

  private calculateTimeToRealization(predTime: string, actualTime: string): number {
    const pred = new Date(predTime);
    const act = new Date(actualTime);
    const diffHours = (act.getTime() - pred.getTime()) / (1000 * 60 * 60);
    return Math.max(0, Math.min(1, diffHours / 72)); // Normalize to 0-1 (72 hours = full score)
  }

  private getCurrentCycle(): number {
    try {
      const activePath = path.join(this.rl4Path, 'active.json');
      const active = JSON.parse(fs.readFileSync(activePath, 'utf8'));
      return active.cycle || 1;
    } catch {
      return 1;
    }
  }

  private calculateCycleCoherence(patternReports: PatternEvolutionReport[]): number {
    if (patternReports.length === 0) return 0.5;

    const stablePatterns = patternReports.filter(p => p.trend === 'stable').length;
    const totalPatterns = patternReports.length;

    return stablePatterns / totalPatterns;
  }

  private calculatePatternDrift(patternReports: PatternEvolutionReport[]): number {
    if (patternReports.length === 0) return 0;

    const avgChange = patternReports.reduce((sum, p) => sum + p.changeMagnitude, 0) / patternReports.length;
    return Math.min(1, avgChange * 2); // Scale to 0-1
  }

  private calculateForecastAccuracy(forecastReports: ForecastValidationReport[]): number {
    if (forecastReports.length === 0) return 0.5;

    const avgAccuracy = forecastReports.reduce((sum, f) => sum + f.accuracy, 0) / forecastReports.length;
    return avgAccuracy;
  }

  private calculateADRImpact(adrReports: ADRConsequenceReport[]): number {
    if (adrReports.length === 0) return 0;

    const avgImpact = adrReports.reduce((sum, a) => sum + a.impactScore, 0) / adrReports.length;
    return avgImpact;
  }

  private generateRecommendations(metrics: {
    cycleCoherence: number;
    patternDrift: number;
    forecastAccuracy: number;
    adrImpact: number;
  }): string[] {
    const recommendations: string[] = [];

    if (metrics.cycleCoherence < 0.6) {
      recommendations.push('Low coherence detected - consider reviewing pattern stability');
    }

    if (metrics.patternDrift > 0.7) {
      recommendations.push('High pattern drift - analyze volatile patterns for better forecasting');
    }

    if (metrics.forecastAccuracy < 0.5) {
      recommendations.push('Poor forecast accuracy - recalibrate prediction models');
    }

    if (metrics.adrImpact > 0.8) {
      recommendations.push('High ADR impact - recent decisions significantly affecting system health');
    }

    if (recommendations.length === 0) {
      recommendations.push('System operating within normal parameters');
    }

    return recommendations;
  }
}
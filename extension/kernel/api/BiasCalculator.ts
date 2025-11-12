/**
 * BiasCalculator — Calculate drift between original Plan and current Plan
 * 
 * Phase E4: Deviation Detection System
 * 
 * Concept:
 * - Bias = Distance between Plan v1.0 (baseline) and Plan vX.Y (current)
 * - User configures deviation tolerance (strict/flexible/exploratoire/free)
 * - LLM adapts recommendations based on deviation mode
 * 
 * Workflow:
 * 1. Load original Plan (v1.0 immutable baseline)
 * 2. Load current Plan (vX.Y evolving state)
 * 3. Calculate bias per dimension (phase, goal, timeline, criteria)
 * 4. Compare bias vs threshold (kernel_config.json)
 * 5. Generate recalibration prompt if exceeds threshold
 * 
 * Deviation Modes:
 * - strict (0%): No deviation tolerated
 * - flexible (25%): Light deviation OK
 * - exploratoire (50%): Experimentation encouraged
 * - free (100%): No constraints
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export interface BiasBreakdown {
  phase: number;        // 0-1 scale
  goal: number;         // 0-1 scale
  timeline: number;     // 0-1 scale
  criteria: number;     // 0-1 scale
}

export interface BiasReport {
  total: number;                    // Weighted average (0-1)
  breakdown: BiasBreakdown;
  exceeds_threshold: boolean;
  deviation_mode: string;           // strict/flexible/exploratoire/free
  threshold: number;                // Configured threshold
  recommendations: string[];        // How to recalibrate
  drift_areas: string[];            // Which areas drifted
}

export interface PlanSnapshot {
  version: string;
  phase: string;
  goal: string;
  timeline: {
    start: string;
    target: string;
  };
  successCriteria: string[];
}

export type DeviationMode = 'strict' | 'flexible' | 'exploratoire' | 'free';

export class BiasCalculator {
  private rl4Path: string;
  private baselinePath: string;

  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
    this.baselinePath = path.join(rl4Path, '.baseline');
  }

  /**
   * Calculate bias between original and current Plan
   * @param userMode Optional user-selected deviation mode (overrides config)
   */
  async calculateBias(userMode?: string): Promise<BiasReport> {
    // Load config
    const config = this.loadConfig();
    const deviationMode = userMode || config.deviation_mode || 'flexible';
    const threshold = config.deviation_threshold || 0.25;

    // Load Plans
    const original = this.loadOriginalPlan();
    const current = this.loadCurrentPlan();

    if (!original || !current) {
      return this.createEmptyReport(deviationMode, threshold);
    }

    // Calculate bias per dimension
    const breakdown: BiasBreakdown = {
      phase: this.calculatePhaseBias(original.phase, current.phase),
      goal: this.calculateGoalBias(original.goal, current.goal),
      timeline: this.calculateTimelineBias(original.timeline, current.timeline),
      criteria: this.calculateCriteriaBias(original.successCriteria, current.successCriteria)
    };

    // Weighted total (goal is most important)
    const total = (
      breakdown.phase * 0.15 +
      breakdown.goal * 0.40 +
      breakdown.timeline * 0.25 +
      breakdown.criteria * 0.20
    );

    // Detect drift areas
    const driftAreas: string[] = [];
    if (breakdown.phase > 0.05) driftAreas.push('phase');
    if (breakdown.goal > 0.05) driftAreas.push('goal');
    if (breakdown.timeline > 0.05) driftAreas.push('timeline');
    if (breakdown.criteria > 0.05) driftAreas.push('criteria');

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      original,
      current,
      breakdown,
      deviationMode,
      threshold
    );

    return {
      total,
      breakdown,
      exceeds_threshold: total > threshold,
      deviation_mode: deviationMode,
      threshold,
      recommendations,
      drift_areas: driftAreas
    };
  }

  /**
   * Calculate phase bias (exact match or changed)
   */
  private calculatePhaseBias(original: string, current: string): number {
    // Simple: if phase changed = 100% bias, else 0%
    return original.toLowerCase() === current.toLowerCase() ? 0.0 : 1.0;
  }

  /**
   * Calculate goal bias (text similarity)
   */
  private calculateGoalBias(original: string, current: string): number {
    // Use Levenshtein distance ratio
    const distance = this.levenshteinDistance(
      original.toLowerCase(),
      current.toLowerCase()
    );
    const maxLen = Math.max(original.length, current.length);
    return maxLen > 0 ? distance / maxLen : 0.0;
  }

  /**
   * Calculate timeline bias (days drifted)
   */
  private calculateTimelineBias(
    original: { start: string; target: string },
    current: { start: string; target: string }
  ): number {
    try {
      const originalDuration = this.daysBetween(original.start, original.target);
      const currentDuration = this.daysBetween(current.start, current.target);

      if (originalDuration === 0) return 0.0;

      const durationDrift = Math.abs(currentDuration - originalDuration);
      return Math.min(durationDrift / originalDuration, 1.0);
    } catch {
      return 0.0;
    }
  }

  /**
   * Calculate criteria bias (added/removed criteria)
   */
  private calculateCriteriaBias(original: string[], current: string[]): number {
    if (original.length === 0 && current.length === 0) return 0.0;

    const originalSet = new Set(original.map(c => c.toLowerCase()));
    const currentSet = new Set(current.map(c => c.toLowerCase()));

    const added = [...currentSet].filter(c => !originalSet.has(c)).length;
    const removed = [...originalSet].filter(c => !currentSet.has(c)).length;
    const total = Math.max(original.length, current.length);

    return total > 0 ? (added + removed) / (total * 2) : 0.0;
  }

  /**
   * Generate recalibration recommendations
   */
  private generateRecommendations(
    original: PlanSnapshot,
    current: PlanSnapshot,
    breakdown: BiasBreakdown,
    mode: string,
    threshold: number
  ): string[] {
    const recs: string[] = [];
    const total = (breakdown.phase * 0.15 + breakdown.goal * 0.40 + breakdown.timeline * 0.25 + breakdown.criteria * 0.20);

    // Mode-specific messaging
    if (mode === 'strict' && total > 0.05) {
      recs.push(`⚠️ STRICT MODE: Any deviation detected (${(total * 100).toFixed(0)}%). Recalibrate immediately.`);
    } else if (mode === 'flexible' && total > threshold) {
      recs.push(`⚠️ FLEXIBLE MODE: Deviation exceeds threshold (${(total * 100).toFixed(0)}% > ${(threshold * 100).toFixed(0)}%). Focus on P0+P1.`);
    } else if (mode === 'exploratory' && total > threshold) {
      recs.push(`ℹ️ EXPLORATORY MODE: Exploration drift detected (${(total * 100).toFixed(0)}% > ${(threshold * 100).toFixed(0)}%). Monitor progress.`);
    } else if (mode === 'free') {
      recs.push(`✅ FREE MODE: No constraints. Current drift: ${(total * 100).toFixed(0)}%. Creativity encouraged.`);
      return recs;
    }

    // Dimension-specific recommendations
    if (breakdown.phase > 0.05) {
      recs.push(`📌 Phase changed: "${original.phase}" → "${current.phase}". Consider updating ADRs.`);
    }

    if (breakdown.goal > 0.05) {
      recs.push(`🎯 Goal drifted ${(breakdown.goal * 100).toFixed(0)}%:`);
      recs.push(`   Original: "${original.goal}"`);
      recs.push(`   Current:  "${current.goal}"`);
      recs.push(`   → Clarify if this is intentional pivot or scope creep.`);
    }

    if (breakdown.timeline > 0.05) {
      const originalDays = this.daysBetween(original.timeline.start, original.timeline.target);
      const currentDays = this.daysBetween(current.timeline.start, current.timeline.target);
      recs.push(`📅 Timeline drifted: ${originalDays} days → ${currentDays} days (${(breakdown.timeline * 100).toFixed(0)}% change)`);
      recs.push(`   → Re-estimate completion date or adjust scope.`);
    }

    if (breakdown.criteria > 0.05) {
      recs.push(`✅ Success criteria changed (${(breakdown.criteria * 100).toFixed(0)}% difference)`);
      recs.push(`   → Review if new criteria align with original goal.`);
    }

    // Recalibration instructions
    if (total > threshold && mode !== 'free') {
      recs.push(``);
      recs.push(`🔧 Recalibration Options:`);
      recs.push(`   1. Update Plan.RL4 to match original intent`);
      recs.push(`   2. Create ADR documenting intentional pivot`);
      recs.push(`   3. Adjust deviation_mode in kernel_config.json`);
    }

    return recs;
  }

  /**
   * Load original Plan (baseline)
   */
  private loadOriginalPlan(): PlanSnapshot | null {
    const baselinePath = path.join(this.baselinePath, 'Plan.RL4.v1.0');
    
    if (!fs.existsSync(baselinePath)) {
      // If no baseline, use current as baseline
      return this.loadCurrentPlan();
    }

    return this.parsePlan(baselinePath);
  }

  /**
   * Load current Plan
   */
  private loadCurrentPlan(): PlanSnapshot | null {
    const currentPath = path.join(this.rl4Path, 'Plan.RL4');
    return this.parsePlan(currentPath);
  }

  /**
   * Parse Plan.RL4 file
   */
  private parsePlan(filePath: string): PlanSnapshot | null {
    if (!fs.existsSync(filePath)) return null;

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const lines = content.split('\n');

      // Extract frontmatter
      let version = '1.0';
      if (lines[0] === '---') {
        const frontmatterEnd = lines.indexOf('---', 1);
        const frontmatterLines = lines.slice(1, frontmatterEnd);
        for (const line of frontmatterLines) {
          if (line.startsWith('version:')) {
            version = line.split(':')[1].trim();
          }
        }
      }

      // Extract sections
      const phase = this.extractSection(content, '## Phase');
      const goal = this.extractSection(content, '## Goal');
      const timelineText = this.extractSection(content, '## Timeline');
      const criteriaText = this.extractSection(content, '**Success Criteria:**');

      // Parse timeline
      const timelineMatch = timelineText.match(/Start: ([\d-]+).*Target: ([\d-]+)/s);
      const timeline = timelineMatch ? {
        start: timelineMatch[1],
        target: timelineMatch[2]
      } : { start: '', target: '' };

      // Parse criteria
      const successCriteria = criteriaText
        .split('\n')
        .filter(l => l.trim().startsWith('-'))
        .map(l => l.replace(/^-\s*\[.\]\s*/, '').trim());

      return {
        version,
        phase: phase.split('\n')[0].trim(),
        goal: goal.split('\n')[0].trim(),
        timeline,
        successCriteria
      };
    } catch (error) {
      console.error('[BiasCalculator] Error parsing Plan:', error);
      return null;
    }
  }

  /**
   * Extract section from markdown
   */
  private extractSection(content: string, header: string): string {
    const lines = content.split('\n');
    const startIdx = lines.findIndex(l => l.includes(header));
    
    if (startIdx === -1) return '';

    let endIdx = lines.findIndex((l, i) => i > startIdx && l.startsWith('##'));
    if (endIdx === -1) endIdx = lines.length;

    return lines.slice(startIdx + 1, endIdx).join('\n').trim();
  }

  /**
   * Load kernel config
   */
  private loadConfig(): any {
    const configPath = path.join(this.rl4Path, 'kernel_config.json');
    
    if (!fs.existsSync(configPath)) {
      return { deviation_mode: 'flexible', deviation_threshold: 0.25 };
    }

    try {
      const content = fs.readFileSync(configPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return { deviation_mode: 'flexible', deviation_threshold: 0.25 };
    }
  }

  /**
   * Create empty report
   */
  private createEmptyReport(mode: string, threshold: number): BiasReport {
    return {
      total: 0.0,
      breakdown: { phase: 0, goal: 0, timeline: 0, criteria: 0 },
      exceeds_threshold: false,
      deviation_mode: mode,
      threshold,
      recommendations: ['No baseline Plan found. Current Plan will be used as baseline.'],
      drift_areas: []
    };
  }

  /**
   * Levenshtein distance (string similarity)
   */
  private levenshteinDistance(a: string, b: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= b.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= a.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[b.length][a.length];
  }

  /**
   * Calculate days between two dates
   */
  private daysBetween(start: string, end: string): number {
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);
      const diffTime = Math.abs(endDate.getTime() - startDate.getTime());
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  }

  /**
   * Save current Plan as baseline (call once at project start)
   */
  async saveBaseline(): Promise<void> {
    const currentPlan = this.loadCurrentPlan();
    if (!currentPlan) return;

    // Create .baseline directory
    if (!fs.existsSync(this.baselinePath)) {
      fs.mkdirSync(this.baselinePath, { recursive: true });
    }

    // Copy current Plan to baseline
    const currentPath = path.join(this.rl4Path, 'Plan.RL4');
    const baselinePath = path.join(this.baselinePath, 'Plan.RL4.v1.0');

    if (!fs.existsSync(baselinePath)) {
      fs.copyFileSync(currentPath, baselinePath);
      console.log('[BiasCalculator] Baseline saved:', baselinePath);
    }
  }
}


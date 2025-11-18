/**
 * PromptOptimizer — Compression intelligente des prompts
 * 
 * Réduit la taille des prompts tout en préservant l'information essentielle.
 * Utilise des stratégies de compression adaptatives selon le mode.
 * 
 * Objectifs:
 * - Réduire les coûts LLM (tokens)
 * - Améliorer la qualité (prompts plus ciblés)
 * - Adapter la compression selon le mode (strict/flexible/exploratory/free)
 */

import * as fs from 'fs';
import * as path from 'path';

export interface PromptAnalysis {
  totalSize: number;
  sections: SectionInfo[];
  redundancy: number; // 0-1, higher = more redundant
  relevance: number; // 0-1, higher = more relevant
  compressionPotential: number; // Estimated compression ratio (0-1)
}

export interface SectionInfo {
  name: string;
  startLine: number;
  endLine: number;
  size: number;
  age?: number; // Days since last update
  relevance: 'high' | 'medium' | 'low';
}

export type CompressionMode = 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';

export class PromptOptimizer {
  private workspaceRoot: string;
  private rl4Path: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
    this.rl4Path = path.join(workspaceRoot, '.reasoning_rl4');
  }

  /**
   * Analyser le prompt pour identifier les opportunités de compression
   */
  analyzePrompt(prompt: string): PromptAnalysis {
    const lines = prompt.split('\n');
    const sections: SectionInfo[] = [];
    let currentSection: SectionInfo | null = null;

    // Identifier les sections (## headers)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (line.match(/^##\s+/)) {
        // Save previous section
        if (currentSection) {
          currentSection.endLine = i - 1;
          currentSection.size = this.calculateSectionSize(lines, currentSection.startLine, currentSection.endLine);
          sections.push(currentSection);
        }

        // Start new section
        const sectionName = line.replace(/^##\s+/, '').trim();
        currentSection = {
          name: sectionName,
          startLine: i,
          endLine: lines.length - 1,
          size: 0,
          relevance: this.estimateRelevance(sectionName)
        };
      }
    }

    // Save last section
    if (currentSection) {
      currentSection.endLine = lines.length - 1;
      currentSection.size = this.calculateSectionSize(lines, currentSection.startLine, currentSection.endLine);
      sections.push(currentSection);
    }

    // Calculate metrics
    const totalSize = prompt.length;
    const redundancy = this.estimateRedundancy(prompt, sections);
    const relevance = this.calculateAverageRelevance(sections);
    const compressionPotential = this.estimateCompressionPotential(sections, redundancy);

    return {
      totalSize,
      sections,
      redundancy,
      relevance,
      compressionPotential
    };
  }

  /**
   * Optimiser le prompt selon le mode (REFACTORED - Strategies Pattern)
   */
  async optimize(prompt: string, mode: CompressionMode): Promise<string> {
    const strategy = this.strategies[mode];
    return strategy(prompt);
  }

  /**
   * Compression strategies (RL4 Snapshot System)
   */
  private strategies: Record<CompressionMode, (prompt: string) => string> = {
    strict: this.compressAggressive.bind(this),
    flexible: this.compressModerate.bind(this),
    exploratory: this.compressMinimal.bind(this),
    free: this.compressNone.bind(this),
    firstUse: this.compressMinimal.bind(this)
  };

  /**
   * Aggressive compression (strict mode)
   */
  private compressAggressive(prompt: string): string {
    return this.optimizeStrict(prompt, this.analyzePrompt(prompt));
  }

  /**
   * Moderate compression (flexible mode)
   */
  private compressModerate(prompt: string): string {
    return this.optimizeFlexible(prompt, this.analyzePrompt(prompt));
  }

  /**
   * Minimal compression (exploratory/firstUse mode)
   */
  private compressMinimal(prompt: string): string {
    return this.optimizeExploratory(prompt, this.analyzePrompt(prompt));
  }

  /**
   * No compression (free mode)
   */
  private compressNone(prompt: string): string {
    // Just remove obvious redundancy, no section removal
    return this.removeObviousRedundancy(prompt);
  }

  /**
   * Mode strict: Garder seulement Plan/Tasks/Context (pas d'historique)
   */
  private optimizeStrict(prompt: string, analysis: PromptAnalysis): string {
    const lines = prompt.split('\n');
    const optimized: string[] = [];
    let skipSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Détecter début de section
      if (line.match(/^##\s+/)) {
        const sectionName = line.replace(/^##\s+/, '').trim();
        
        // Garder seulement les sections essentielles
        const essentialSections = [
          'Plan',
          'Tasks',
          'Context',
          'KPIs',
          'Agent Instructions',
          'Engine-Generated Data'
        ];
        
        skipSection = !essentialSections.some(essential => 
          sectionName.toLowerCase().includes(essential.toLowerCase())
        );
      }

      if (!skipSection) {
        optimized.push(line);
      }
    }

    const optimizedPrompt = optimized.join('\n');
    const compressionRatio = (1 - optimizedPrompt.length / prompt.length) * 100;
    console.log(`[PromptOptimizer] Strict mode: ${prompt.length} → ${optimizedPrompt.length} chars (${compressionRatio.toFixed(1)}% reduction)`);
    
    return optimizedPrompt;
  }

  /**
   * Mode flexible: Garder Plan/Tasks/Context + historique récent (2h)
   */
  private optimizeFlexible(prompt: string, analysis: PromptAnalysis): string {
    const lines = prompt.split('\n');
    const optimized: string[] = [];
    let skipSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.match(/^##\s+/)) {
        const sectionName = line.replace(/^##\s+/, '').trim();
        
        // Garder sections essentielles + historique récent
        const keepSections = [
          'Plan',
          'Tasks',
          'Context',
          'KPIs',
          'Recent Activity',
          'Timeline',
          'Agent Instructions',
          'Engine-Generated Data'
        ];
        
        skipSection = !keepSections.some(keep => 
          sectionName.toLowerCase().includes(keep.toLowerCase())
        );
      }

      if (!skipSection) {
        optimized.push(line);
      }
    }

    const optimizedPrompt = optimized.join('\n');
    const compressionRatio = (1 - optimizedPrompt.length / prompt.length) * 100;
    console.log(`[PromptOptimizer] Flexible mode: ${prompt.length} → ${optimizedPrompt.length} chars (${compressionRatio.toFixed(1)}% reduction)`);
    
    return optimizedPrompt;
  }

  /**
   * Mode exploratory: Tout mais résumé
   */
  private optimizeExploratory(prompt: string, analysis: PromptAnalysis): string {
    // Pour exploratory, on garde tout mais on résume les sections anciennes
    return this.summarizeOldSections(prompt, analysis, 7); // Résumer sections >7 jours
  }

  /**
   * Mode free: Compression minimale (garder presque tout)
   */
  private optimizeFree(prompt: string, analysis: PromptAnalysis): string {
    // Pour free, compression minimale (juste supprimer redondances évidentes)
    return this.removeObviousRedundancy(prompt);
  }

  /**
   * Résumer les sections anciennes
   */
  private summarizeOldSections(prompt: string, analysis: PromptAnalysis, daysThreshold: number): string {
    // Pour l'instant, on garde tout (résumé via LLM serait trop complexe)
    // TODO: Implémenter résumé intelligent via LLM si nécessaire
    return prompt;
  }

  /**
   * Supprimer redondances évidentes
   */
  private removeObviousRedundancy(prompt: string): string {
    const lines = prompt.split('\n');
    const optimized: string[] = [];
    const seenLines = new Set<string>();

    for (const line of lines) {
      const normalized = line.trim().toLowerCase();
      
      // Skip lignes vides répétées
      if (normalized === '' && optimized[optimized.length - 1] === '') {
        continue;
      }
      
      // Skip lignes identiques répétées (avec tolérance)
      if (seenLines.has(normalized) && normalized.length > 50) {
        continue;
      }
      
      seenLines.add(normalized);
      optimized.push(line);
    }

    return optimized.join('\n');
  }

  /**
   * Mode "focused" - Garder seulement ce qui est nécessaire pour la tâche
   */
  async focus(prompt: string, task: 'update-plan' | 'generate-adr' | 'update-context' | 'analyze-code'): Promise<string> {
    const lines = prompt.split('\n');
    const optimized: string[] = [];
    let skipSection = false;

    // Sections pertinentes par tâche
    const relevantSections: Record<string, string[]> = {
      'update-plan': ['Plan', 'Tasks', 'Context', 'KPIs', 'Recent Activity'],
      'generate-adr': ['Plan', 'Tasks', 'ADRs', 'Patterns', 'Forecasts', 'Recent Activity'],
      'update-context': ['Context', 'KPIs', 'Recent Activity', 'Health'],
      'analyze-code': ['Code Implementation State', 'Project Context', 'Patterns', 'Recent Activity']
    };

    const sectionsToKeep = relevantSections[task] || [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.match(/^##\s+/)) {
        const sectionName = line.replace(/^##\s+/, '').trim();
        skipSection = !sectionsToKeep.some(keep => 
          sectionName.toLowerCase().includes(keep.toLowerCase())
        );
      }

      if (!skipSection) {
        optimized.push(line);
      }
    }

    const optimizedPrompt = optimized.join('\n');
    console.log(`[PromptOptimizer] Focused mode (${task}): ${prompt.length} → ${optimizedPrompt.length} chars`);
    
    return optimizedPrompt;
  }

  // Helpers

  private calculateSectionSize(lines: string[], start: number, end: number): number {
    return lines.slice(start, end + 1).join('\n').length;
  }

  private estimateRelevance(sectionName: string): 'high' | 'medium' | 'low' {
    const highRelevance = ['Plan', 'Tasks', 'Context', 'KPIs', 'Agent Instructions'];
    const mediumRelevance = ['Recent Activity', 'Timeline', 'Patterns', 'Forecasts'];
    
    const lowerName = sectionName.toLowerCase();
    if (highRelevance.some(h => lowerName.includes(h.toLowerCase()))) {
      return 'high';
    }
    if (mediumRelevance.some(m => lowerName.includes(m.toLowerCase()))) {
      return 'medium';
    }
    return 'low';
  }

  private estimateRedundancy(prompt: string, sections: SectionInfo[]): number {
    // Simple heuristic: count repeated phrases
    const words = prompt.toLowerCase().split(/\s+/);
    const wordCounts = new Map<string, number>();
    
    for (const word of words) {
      if (word.length > 4) { // Ignore short words
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }
    
    let redundancy = 0;
    for (const count of wordCounts.values()) {
      if (count > 10) { // Word appears more than 10 times
        redundancy += (count - 10) / words.length;
      }
    }
    
    return Math.min(1, redundancy);
  }

  private calculateAverageRelevance(sections: SectionInfo[]): number {
    if (sections.length === 0) return 0;
    
    const scores = sections.map(s => {
      if (s.relevance === 'high') return 1;
      if (s.relevance === 'medium') return 0.5;
      return 0.2;
    });
    
    return scores.reduce((a, b) => a + b, 0) / scores.length;
  }

  private estimateCompressionPotential(sections: SectionInfo[], redundancy: number): number {
    // Sections low relevance + high redundancy = high compression potential
    const lowRelevanceRatio = sections.filter(s => s.relevance === 'low').length / sections.length;
    return (lowRelevanceRatio * 0.6) + (redundancy * 0.4);
  }
}


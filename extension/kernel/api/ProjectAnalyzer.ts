/**
 * ProjectAnalyzer — Context-Aware Project Analysis
 * 
 * Detects project characteristics to provide intelligent mode-specific instructions:
 * - Maturity (new/growing/mature based on cycle count)
 * - Stack (React, Vue, Three.js, Node, etc.)
 * - Quality (tests, linter, CI/CD)
 * - Hotspots (files edited frequently)
 * - Opportunities (missing tools, refactor candidates)
 * 
 * Used by: UnifiedPromptBuilder for Exploratory/Free modes
 * 
 * Phase: E4 Enhancement
 */

import * as fs from 'fs';
import * as path from 'path';

export interface ProjectContext {
  // Maturity
  maturity: 'new' | 'growing' | 'mature';
  totalCycles: number;
  projectAge: number; // days since first cycle
  
  // Stack
  projectType: 'react' | 'vue' | 'angular' | 'svelte' | 'node' | 'python' | 'go' | 'three.js' | 'generic';
  stackDetected: string[]; // ['typescript', 'vite', 'three']
  
  // Quality
  hasTests: boolean;
  hasLinter: boolean;
  hasCI: boolean;
  
  // Development patterns
  topHotspots: Array<{ file: string; editCount: number }>;
  hotspotCount: number; // Files with >30 edits
  burstCount: number; // Rapid iteration sessions
  
  // Calculated
  qualityScore: number; // 0-10
}

export class ProjectAnalyzer {
  private rl4Path: string;
  private workspaceRoot: string;

  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
    this.workspaceRoot = path.dirname(rl4Path); // Parent of .reasoning_rl4/
  }

  /**
   * Analyze project comprehensively
   */
  async analyze(): Promise<ProjectContext> {
    const maturityData = await this.detectMaturity();
    const stackData = await this.detectStack();
    const qualityData = await this.analyzeQuality();
    const hotspots = await this.detectHotspots();
    
    const qualityScore = this.calculateQualityScore({
      hasTests: qualityData.hasTests,
      hasLinter: qualityData.hasLinter,
      hasCI: qualityData.hasCI,
      hotspotCount: hotspots.hotspotCount
    });

    return {
      maturity: maturityData.maturity,
      totalCycles: maturityData.totalCycles,
      projectAge: maturityData.projectAge,
      projectType: stackData.projectType,
      stackDetected: stackData.stackDetected,
      hasTests: qualityData.hasTests,
      hasLinter: qualityData.hasLinter,
      hasCI: qualityData.hasCI,
      topHotspots: hotspots.topHotspots,
      hotspotCount: hotspots.hotspotCount,
      burstCount: hotspots.burstCount,
      qualityScore
    };
  }

  /**
   * Detect project maturity based on cycle count
   */
  private async detectMaturity(): Promise<{
    maturity: 'new' | 'growing' | 'mature';
    totalCycles: number;
    projectAge: number;
  }> {
    const cyclesPath = path.join(this.rl4Path, 'ledger', 'cycles.jsonl');
    let totalCycles = 0;
    let firstCycleDate: Date | null = null;

    if (fs.existsSync(cyclesPath)) {
      try {
        const lines = fs.readFileSync(cyclesPath, 'utf-8').trim().split('\n').filter(Boolean);
        totalCycles = lines.length;

        if (lines.length > 0) {
          const firstCycle = JSON.parse(lines[0]);
          firstCycleDate = new Date(firstCycle._timestamp || firstCycle.timestamp);
        }
      } catch (error) {
        // Silent fail
      }
    }

    const projectAge = firstCycleDate
      ? Math.floor((Date.now() - firstCycleDate.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Determine maturity
    let maturity: 'new' | 'growing' | 'mature';
    if (totalCycles < 200) {
      maturity = 'new';
    } else if (totalCycles < 2000) {
      maturity = 'growing';
    } else {
      maturity = 'mature';
    }

    return { maturity, totalCycles, projectAge };
  }

  /**
   * Detect project stack from package.json and file patterns
   */
  private async detectStack(): Promise<{
    projectType: ProjectContext['projectType'];
    stackDetected: string[];
  }> {
    const stackDetected: string[] = [];
    let projectType: ProjectContext['projectType'] = 'generic';

    const packageJsonPath = path.join(this.workspaceRoot, 'package.json');

    if (fs.existsSync(packageJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };

        // Detect frameworks
        if (deps['react']) {
          stackDetected.push('react');
          projectType = 'react';
        }
        if (deps['vue']) {
          stackDetected.push('vue');
          projectType = 'vue';
        }
        if (deps['@angular/core']) {
          stackDetected.push('angular');
          projectType = 'angular';
        }
        if (deps['svelte']) {
          stackDetected.push('svelte');
          projectType = 'svelte';
        }
        if (deps['three']) {
          stackDetected.push('three.js');
          projectType = 'three.js';
        }
        if (deps['express'] || deps['fastify'] || deps['koa']) {
          stackDetected.push('node.js');
          if (projectType === 'generic') projectType = 'node';
        }

        // Detect build tools
        if (deps['typescript']) stackDetected.push('typescript');
        if (deps['vite']) stackDetected.push('vite');
        if (deps['webpack']) stackDetected.push('webpack');
        if (deps['next']) stackDetected.push('next.js');
        if (deps['nuxt']) stackDetected.push('nuxt');

      } catch (error) {
        // Silent fail
      }
    }

    // Detect Python
    if (fs.existsSync(path.join(this.workspaceRoot, 'requirements.txt')) ||
        fs.existsSync(path.join(this.workspaceRoot, 'pyproject.toml'))) {
      projectType = 'python';
      stackDetected.push('python');
    }

    // Detect Go
    if (fs.existsSync(path.join(this.workspaceRoot, 'go.mod'))) {
      projectType = 'go';
      stackDetected.push('go');
    }

    return { projectType, stackDetected };
  }

  /**
   * Analyze project quality (tests, linter, CI/CD)
   */
  private async analyzeQuality(): Promise<{
    hasTests: boolean;
    hasLinter: boolean;
    hasCI: boolean;
  }> {
    // Check for test framework
    const hasTests =
      fs.existsSync(path.join(this.workspaceRoot, 'jest.config.js')) ||
      fs.existsSync(path.join(this.workspaceRoot, 'jest.config.ts')) ||
      fs.existsSync(path.join(this.workspaceRoot, 'vitest.config.ts')) ||
      fs.existsSync(path.join(this.workspaceRoot, 'vitest.config.js')) ||
      fs.existsSync(path.join(this.workspaceRoot, 'playwright.config.ts')) ||
      this.hasTestFiles();

    // Check for linter
    const hasLinter =
      fs.existsSync(path.join(this.workspaceRoot, '.eslintrc.js')) ||
      fs.existsSync(path.join(this.workspaceRoot, '.eslintrc.json')) ||
      fs.existsSync(path.join(this.workspaceRoot, '.eslintrc.cjs')) ||
      fs.existsSync(path.join(this.workspaceRoot, 'eslint.config.js')) ||
      fs.existsSync(path.join(this.workspaceRoot, '.prettierrc'));

    // Check for CI/CD
    const hasCI =
      fs.existsSync(path.join(this.workspaceRoot, '.github', 'workflows')) ||
      fs.existsSync(path.join(this.workspaceRoot, '.gitlab-ci.yml')) ||
      fs.existsSync(path.join(this.workspaceRoot, '.circleci'));

    return { hasTests, hasLinter, hasCI };
  }

  /**
   * Check if project has test files
   */
  private hasTestFiles(): boolean {
    try {
      const srcPath = path.join(this.workspaceRoot, 'src');
      if (!fs.existsSync(srcPath)) return false;

      const findTestFiles = (dir: string): boolean => {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          
          if (entry.isDirectory() && !entry.name.startsWith('.')) {
            if (findTestFiles(fullPath)) return true;
          } else if (entry.isFile()) {
            if (entry.name.match(/\.(test|spec)\.(ts|tsx|js|jsx)$/)) {
              return true;
            }
          }
        }
        return false;
      };

      return findTestFiles(srcPath);
    } catch (error) {
      return false;
    }
  }

  /**
   * Detect hotspots and burst patterns
   */
  private async detectHotspots(): Promise<{
    topHotspots: Array<{ file: string; editCount: number }>;
    hotspotCount: number;
    burstCount: number;
  }> {
    const fileChangesPath = path.join(this.rl4Path, 'traces', 'file_changes.jsonl');
    const hotspots: Record<string, number> = {};
    const bursts: Record<string, number[]> = {}; // file -> timestamps

    if (fs.existsSync(fileChangesPath)) {
      try {
        const lines = fs.readFileSync(fileChangesPath, 'utf-8').trim().split('\n').filter(Boolean);

        lines.forEach(line => {
          const event = JSON.parse(line);
          const file = event.metadata?.file_path || event.file_path || '';
          
          if (file && !file.includes('node_modules') && !file.includes('.reasoning_rl4')) {
            // Count edits
            hotspots[file] = (hotspots[file] || 0) + 1;
            
            // Track timestamps for burst detection
            const timestamp = new Date(event._timestamp || event.timestamp).getTime();
            if (!bursts[file]) bursts[file] = [];
            bursts[file].push(timestamp);
          }
        });
      } catch (error) {
        // Silent fail
      }
    }

    // Top hotspots
    const topHotspots = Object.entries(hotspots)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([file, editCount]) => ({ file, editCount }));

    // Count files with >30 edits
    const hotspotCount = Object.values(hotspots).filter(count => count > 30).length;

    // Count bursts (>10 edits in <5 min)
    let burstCount = 0;
    Object.values(bursts).forEach(timestamps => {
      for (let i = 0; i < timestamps.length - 10; i++) {
        const window = timestamps.slice(i, i + 10);
        const duration = window[window.length - 1] - window[0];
        if (duration < 5 * 60 * 1000) { // 5 minutes
          burstCount++;
          break; // Count each file once
        }
      }
    });

    return { topHotspots, hotspotCount, burstCount };
  }

  /**
   * Calculate overall quality score (0-10)
   */
  private calculateQualityScore(data: {
    hasTests: boolean;
    hasLinter: boolean;
    hasCI: boolean;
    hotspotCount: number;
  }): number {
    let score = 5; // Base score

    if (data.hasTests) score += 2;
    if (data.hasLinter) score += 1;
    if (data.hasCI) score += 1;
    if (data.hotspotCount === 0) score += 1;

    return Math.min(10, score);
  }
}


/**
 * PlanTasksContextParser — Parse Plan/Tasks/Context.RL4 with validation
 * 
 * Phase E3.3: Parse persistent state files (Markdown + YAML frontmatter)
 * 
 * File Format:
 * ---
 * version: 1.0.0
 * updated: 2025-11-12T13:00:00Z
 * confidence: 0.85
 * ---
 * 
 * # Plan — Strategic Vision
 * 
 * ## Phase
 * E3.3 - Single Context Snapshot System
 * ...
 * 
 * Responsibilities:
 * - Parse YAML frontmatter (version, updated, confidence, bias)
 * - Parse Markdown content
 * - Validate structure (basic checks)
 * - Calculate confidence (Plan vs Reality alignment)
 * - Calculate bias (drift from original intent)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

// Types for parsed data
export interface PlanData {
  version: string;
  updated: string;
  confidence?: number;
  
  // Content
  phase: string;
  goal: string;
  timeline: { start: string; target: string };
  successCriteria: string[];
  constraints: string[];
}

export interface TasksData {
  version: string;
  updated: string;
  bias?: number;
  
  // Content
  active: Array<{ completed: boolean; task: string; timestamp?: string }>;
  blockers: string[];
  completed: Array<{ task: string; timestamp: string }>;
}

export interface ContextData {
  version: string;
  updated: string;
  confidence?: number;
  
  // Content
  activeFiles: string[];
  recentActivity: {
    cycles: number;
    commits: number;
    duration: string;
  };
  health: {
    memory: string;
    eventLoop: string;
    uptime: string;
  };
  observations: string[];
}

export interface WorkspaceData {
  activeFiles: string[];
  recentCycles: number;
  recentCommits: number;
  health: {
    memoryMB: number;
    eventLoopLag: number;
  };
}

export class PlanTasksContextParser {
  private rl4Path: string;

  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
  }

  /**
   * Parse Plan.RL4
   */
  parsePlan(): PlanData | null {
    const planPath = path.join(this.rl4Path, 'Plan.RL4');
    
    if (!fs.existsSync(planPath)) {
      return this.generateDefaultPlan();
    }

    try {
      const content = fs.readFileSync(planPath, 'utf8');
      const { frontmatter, markdown } = this.parseFrontmatter(content);

      return {
        version: frontmatter.version || '1.0.0',
        updated: frontmatter.updated || new Date().toISOString(),
        confidence: frontmatter.confidence,
        
        phase: this.extractSection(markdown, '## Phase') || 'Unknown',
        goal: this.extractSection(markdown, '## Goal') || 'Not defined',
        timeline: this.parseTimeline(markdown),
        successCriteria: this.extractListItems(markdown, '## Success Criteria'),
        constraints: this.extractListItems(markdown, '## Constraints')
      };
    } catch (error) {
      console.error('[PlanTasksContextParser] Error parsing Plan.RL4:', error);
      return this.generateDefaultPlan();
    }
  }

  /**
   * Parse Tasks.RL4
   */
  parseTasks(): TasksData | null {
    const tasksPath = path.join(this.rl4Path, 'Tasks.RL4');
    
    if (!fs.existsSync(tasksPath)) {
      return this.generateDefaultTasks();
    }

    try {
      const content = fs.readFileSync(tasksPath, 'utf8');
      const { frontmatter, markdown } = this.parseFrontmatter(content);

      return {
        version: frontmatter.version || '1.0.0',
        updated: frontmatter.updated || new Date().toISOString(),
        bias: frontmatter.bias,
        
        active: this.parseTaskList(markdown, '## Active'),
        blockers: this.extractListItems(markdown, '## Blockers'),
        completed: this.parseTaskList(markdown, '## Completed').map(t => ({
          task: t.task,
          timestamp: t.timestamp || 'unknown'
        }))
      };
    } catch (error) {
      console.error('[PlanTasksContextParser] Error parsing Tasks.RL4:', error);
      return this.generateDefaultTasks();
    }
  }

  /**
   * Parse Context.RL4
   */
  parseContext(): ContextData | null {
    const contextPath = path.join(this.rl4Path, 'Context.RL4');
    
    if (!fs.existsSync(contextPath)) {
      return this.generateDefaultContext();
    }

    try {
      const content = fs.readFileSync(contextPath, 'utf8');
      const { frontmatter, markdown } = this.parseFrontmatter(content);

      return {
        version: frontmatter.version || '1.0.0',
        updated: frontmatter.updated || new Date().toISOString(),
        confidence: frontmatter.confidence,
        
        activeFiles: this.extractListItems(markdown, '## Active Files'),
        recentActivity: this.parseRecentActivity(markdown),
        health: this.parseHealth(markdown),
        observations: this.extractListItems(markdown, '## Observations')
      };
    } catch (error) {
      console.error('[PlanTasksContextParser] Error parsing Context.RL4:', error);
      return this.generateDefaultContext();
    }
  }

  /**
   * Parse YAML frontmatter from Markdown
   */
  private parseFrontmatter(content: string): { frontmatter: any; markdown: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { frontmatter: {}, markdown: content };
    }

    try {
      const frontmatter = yaml.load(match[1]) || {};
      const markdown = match[2];
      return { frontmatter, markdown };
    } catch (error) {
      console.error('[PlanTasksContextParser] Failed to parse frontmatter:', error);
      return { frontmatter: {}, markdown: content };
    }
  }

  /**
   * Extract section content from Markdown
   */
  private extractSection(content: string, sectionTitle: string): string {
    const regex = new RegExp(`${sectionTitle}\\n([^#]+)`, 'm');
    const match = content.match(regex);
    return match ? match[1].trim() : '';
  }

  /**
   * Extract list items from Markdown section
   */
  private extractListItems(content: string, sectionTitle: string): string[] {
    const sectionContent = this.extractSection(content, sectionTitle);
    
    return sectionContent
      .split('\n')
      .filter(line => line.trim().startsWith('-') || line.trim().startsWith('*'))
      .map(line => line.replace(/^[-*]\s*/, '').trim())
      .map(line => line.replace(/^\[[ x]\]\s*/, '')) // Remove checkbox
      .filter(Boolean);
  }

  /**
   * Parse task list with checkboxes
   */
  private parseTaskList(content: string, sectionTitle: string): Array<{ completed: boolean; task: string; timestamp?: string }> {
    const sectionContent = this.extractSection(content, sectionTitle);
    
    const tasks: Array<{ completed: boolean; task: string; timestamp?: string }> = [];
    
    for (const line of sectionContent.split('\n')) {
      const checkboxMatch = line.match(/^[-*]\s*\[([ x])\]\s*(.+)$/);
      if (checkboxMatch) {
        const completed = checkboxMatch[1] === 'x';
        const taskText = checkboxMatch[2].trim();
        
        // Extract timestamp if present (completed: HH:MM)
        const timestampMatch = taskText.match(/\(completed:\s*(.+?)\)/);
        const timestamp = timestampMatch ? timestampMatch[1] : undefined;
        const cleanTask = taskText.replace(/\(completed:.*?\)/, '').trim();
        
        tasks.push({ completed, task: cleanTask, timestamp });
      }
    }
    
    return tasks;
  }

  /**
   * Parse timeline section
   */
  private parseTimeline(content: string): { start: string; target: string } {
    const timelineContent = this.extractSection(content, '## Timeline');
    
    const startMatch = timelineContent.match(/Start:\s*(.+)/);
    const targetMatch = timelineContent.match(/Target:\s*(.+)/);
    
    return {
      start: startMatch ? startMatch[1].trim() : 'Unknown',
      target: targetMatch ? targetMatch[1].trim() : 'Unknown'
    };
  }

  /**
   * Parse recent activity section
   */
  private parseRecentActivity(content: string): ContextData['recentActivity'] {
    const activityContent = this.extractSection(content, '## Recent Activity');
    
    const cyclesMatch = activityContent.match(/Cycles:\s*(\d+)/);
    const commitsMatch = activityContent.match(/Commits:\s*(\d+)/);
    const durationMatch = activityContent.match(/Duration:\s*(.+)/);
    
    return {
      cycles: cyclesMatch ? parseInt(cyclesMatch[1]) : 0,
      commits: commitsMatch ? parseInt(commitsMatch[1]) : 0,
      duration: durationMatch ? durationMatch[1].trim() : '2h'
    };
  }

  /**
   * Parse health section
   */
  private parseHealth(content: string): ContextData['health'] {
    const healthContent = this.extractSection(content, '## Health');
    
    const memoryMatch = healthContent.match(/Memory:\s*(.+)/);
    const eventLoopMatch = healthContent.match(/Event Loop:\s*(.+)/);
    const uptimeMatch = healthContent.match(/Uptime:\s*(.+)/);
    
    return {
      memory: memoryMatch ? memoryMatch[1].trim() : 'Unknown',
      eventLoop: eventLoopMatch ? eventLoopMatch[1].trim() : 'Unknown',
      uptime: uptimeMatch ? uptimeMatch[1].trim() : 'Unknown'
    };
  }

  /**
   * Calculate confidence (Plan vs Reality alignment)
   * Confidence = how well current workspace matches Plan expectations
   */
  calculateConfidence(plan: PlanData, reality: WorkspaceData): number {
    let score = 0;
    let total = 0;

    // Check if timeline is on track
    const now = new Date();
    const targetDate = new Date(plan.timeline.target);
    const startDate = new Date(plan.timeline.start);
    const totalDuration = targetDate.getTime() - startDate.getTime();
    const elapsed = now.getTime() - startDate.getTime();
    const progress = Math.min(elapsed / totalDuration, 1.0);
    
    // If we're on schedule (not past deadline), +20 points
    if (now <= targetDate) {
      score += 20;
    }
    total += 20;

    // Check activity level (cycles should be >100 per 2h)
    if (reality.recentCycles > 100) {
      score += 30;
    } else if (reality.recentCycles > 50) {
      score += 15;
    }
    total += 30;

    // Check system health
    if (reality.health.memoryMB < 500) {
      score += 25; // Memory healthy
    }
    if (reality.health.eventLoopLag < 1.0) {
      score += 25; // Event loop healthy
    }
    total += 50;

    return Math.round((score / total) * 100) / 100; // 0.0-1.0
  }

  /**
   * Calculate bias (drift from original Plan)
   * Bias = how much current Plan differs from original Plan
   */
  calculateBias(currentPlan: PlanData, originalPlan: PlanData): number {
    // Simple metric: compare goal similarity
    const currentGoal = currentPlan.goal.toLowerCase();
    const originalGoal = originalPlan.goal.toLowerCase();
    
    // Calculate Levenshtein distance (simplified)
    const maxLen = Math.max(currentGoal.length, originalGoal.length);
    if (maxLen === 0) return 0;
    
    const distance = this.levenshteinDistance(currentGoal, originalGoal);
    const bias = distance / maxLen;
    
    return Math.round(bias * 100) / 100; // 0.0-1.0
  }

  /**
   * Simple Levenshtein distance implementation
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
   * Validate Plan.RL4 structure
   */
  validatePlan(data: PlanData): boolean {
    if (!data.version || !data.updated) return false;
    if (!data.phase || !data.goal) return false;
    return true;
  }

  /**
   * Validate Tasks.RL4 structure
   */
  validateTasks(data: TasksData): boolean {
    if (!data.version || !data.updated) return false;
    if (!Array.isArray(data.active)) return false;
    return true;
  }

  /**
   * Validate Context.RL4 structure
   */
  validateContext(data: ContextData): boolean {
    if (!data.version || !data.updated) return false;
    if (!Array.isArray(data.activeFiles)) return false;
    return true;
  }

  /**
   * Generate default Plan.RL4 if file doesn't exist
   */
  private generateDefaultPlan(): PlanData {
    return {
      version: '1.0.0',
      updated: new Date().toISOString(),
      confidence: 0.5,
      phase: 'E3.3 - Single Context Snapshot System',
      goal: 'Simplify RL4, eliminate fake data, create agent feedback loop',
      timeline: {
        start: new Date().toISOString().split('T')[0],
        target: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] // +3 days
      },
      successCriteria: [
        '1 button UI',
        'Agent feedback loop functional',
        'No fake data'
      ],
      constraints: []
    };
  }

  /**
   * Generate default Tasks.RL4 if file doesn't exist
   */
  private generateDefaultTasks(): TasksData {
    return {
      version: '1.0.0',
      updated: new Date().toISOString(),
      bias: 0.0,
      active: [
        { completed: false, task: 'Create Plan/Tasks/Context.RL4 structure' },
        { completed: false, task: 'Test agent feedback loop' }
      ],
      blockers: [],
      completed: []
    };
  }

  /**
   * Generate default Context.RL4 if file doesn't exist
   */
  private generateDefaultContext(): ContextData {
    return {
      version: '1.0.0',
      updated: new Date().toISOString(),
      confidence: 0.5,
      activeFiles: [],
      recentActivity: {
        cycles: 0,
        commits: 0,
        duration: '2h'
      },
      health: {
        memory: 'Unknown',
        eventLoop: 'Unknown',
        uptime: 'Unknown'
      },
      observations: []
    };
  }

  /**
   * Save Plan.RL4 to disk
   */
  savePlan(data: PlanData): boolean {
    const planPath = path.join(this.rl4Path, 'Plan.RL4');
    
    try {
      const frontmatter = {
        version: data.version,
        updated: data.updated,
        confidence: data.confidence
      };

      const content = `---
${yaml.dump(frontmatter).trim()}
---

# Plan — Strategic Vision

## Phase
${data.phase}

## Goal
${data.goal}

## Timeline
Start: ${data.timeline.start}
Target: ${data.timeline.target}

## Success Criteria
${data.successCriteria.map(c => `- ${c}`).join('\n')}

${data.constraints.length > 0 ? `## Constraints\n${data.constraints.map(c => `- ${c}`).join('\n')}` : ''}
`;

      fs.writeFileSync(planPath, content, 'utf8');
      console.log('[PlanTasksContextParser] ✅ Plan.RL4 saved');
      return true;
    } catch (error) {
      console.error('[PlanTasksContextParser] Failed to save Plan.RL4:', error);
      return false;
    }
  }

  /**
   * Save Tasks.RL4 to disk
   */
  saveTasks(data: TasksData): boolean {
    const tasksPath = path.join(this.rl4Path, 'Tasks.RL4');
    
    try {
      const frontmatter = {
        version: data.version,
        updated: data.updated,
        bias: data.bias
      };

      const content = `---
${yaml.dump(frontmatter).trim()}
---

# Tasks — Tactical TODOs

## Active
${data.active.map(t => `- [${t.completed ? 'x' : ' '}] ${t.task}${t.timestamp ? ` (completed: ${t.timestamp})` : ''}`).join('\n')}

${data.blockers.length > 0 ? `## Blockers\n${data.blockers.map(b => `- ${b}`).join('\n')}\n` : ''}

${data.completed.length > 0 ? `## Completed (last 24h)\n${data.completed.map(c => `- ${c.task} (${c.timestamp})`).join('\n')}` : ''}
`;

      fs.writeFileSync(tasksPath, content, 'utf8');
      console.log('[PlanTasksContextParser] ✅ Tasks.RL4 saved');
      return true;
    } catch (error) {
      console.error('[PlanTasksContextParser] Failed to save Tasks.RL4:', error);
      return false;
    }
  }

  /**
   * Save Context.RL4 to disk
   */
  saveContext(data: ContextData): boolean {
    const contextPath = path.join(this.rl4Path, 'Context.RL4');
    
    try {
      const frontmatter = {
        version: data.version,
        updated: data.updated,
        confidence: data.confidence
      };

      const content = `---
${yaml.dump(frontmatter).trim()}
---

# Context — Workspace State

## Active Files
${data.activeFiles.map(f => `- ${f}`).join('\n')}

## Recent Activity (${data.recentActivity.duration})
- Cycles: ${data.recentActivity.cycles}
- Commits: ${data.recentActivity.commits}

## Health
- Memory: ${data.health.memory}
- Event Loop: ${data.health.eventLoop}
- Uptime: ${data.health.uptime}

${data.observations.length > 0 ? `## Observations\n${data.observations.map(o => `- ${o}`).join('\n')}` : ''}
`;

      fs.writeFileSync(contextPath, content, 'utf8');
      console.log('[PlanTasksContextParser] ✅ Context.RL4 saved');
      return true;
    } catch (error) {
      console.error('[PlanTasksContextParser] Failed to save Context.RL4:', error);
      return false;
    }
  }
}


/**
 * RequiredKeysValidator — V16: Required Keys Validation
 * 
 * MVP-1 : Validation des clés obligatoires dans RL4 files
 * 
 * Garantit que Plan/Tasks/Context.RL4 contiennent toujours les clés minimales.
 * 
 * Utilisé par :
 * - PipelineValidator (étape Structural)
 * - FirstBootstrapEngine (validation post-LLM)
 * - RL4Invariants (INVARIANT_6)
 */

export interface RequiredKeysResult {
  valid: boolean;
  missing: string[];
  file: 'Plan.RL4' | 'Tasks.RL4' | 'Context.RL4';
}

export class RequiredKeysValidator {
  /**
   * Required keys for Plan.RL4 frontmatter
   */
  private static readonly PLAN_REQUIRED_FRONTMATTER = [
    'version',
    'updated',
  ];
  
  /**
   * Required keys for Plan.RL4 content (markdown sections)
   */
  private static readonly PLAN_REQUIRED_SECTIONS = [
    '## Phase',
    '## Goal',
    '## Timeline',
    '## Success Criteria'
  ];
  
  /**
   * Required keys for Tasks.RL4 frontmatter
   */
  private static readonly TASKS_REQUIRED_FRONTMATTER = [
    'version',
    'updated'
  ];
  
  /**
   * Required keys for Tasks.RL4 content
   */
  private static readonly TASKS_REQUIRED_SECTIONS = [
    '## Active'
  ];
  
  /**
   * Required keys for Context.RL4 frontmatter
   */
  private static readonly CONTEXT_REQUIRED_FRONTMATTER = [
    'version',
    'updated',
    'kpis_llm',      // Must exist (can be empty array)
    'kpis_kernel'    // Must exist (can be empty array)
  ];
  
  /**
   * Required keys for Context.RL4 content
   */
  private static readonly CONTEXT_REQUIRED_SECTIONS = [
    '## Active Files',
    '## Recent Activity'
  ];
  
  /**
   * Validate Plan.RL4 required keys
   */
  static validatePlan(frontmatter: any, markdownContent: string): RequiredKeysResult {
    const missing: string[] = [];
    
    // Check frontmatter
    for (const key of this.PLAN_REQUIRED_FRONTMATTER) {
      if (!(key in frontmatter)) {
        missing.push(`frontmatter.${key}`);
      }
    }
    
    // Check markdown sections
    for (const section of this.PLAN_REQUIRED_SECTIONS) {
      if (!markdownContent.includes(section)) {
        missing.push(`section: ${section}`);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      file: 'Plan.RL4'
    };
  }
  
  /**
   * Validate Tasks.RL4 required keys
   */
  static validateTasks(frontmatter: any, markdownContent: string): RequiredKeysResult {
    const missing: string[] = [];
    
    // Check frontmatter
    for (const key of this.TASKS_REQUIRED_FRONTMATTER) {
      if (!(key in frontmatter)) {
        missing.push(`frontmatter.${key}`);
      }
    }
    
    // Check markdown sections
    for (const section of this.TASKS_REQUIRED_SECTIONS) {
      if (!markdownContent.includes(section)) {
        missing.push(`section: ${section}`);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      file: 'Tasks.RL4'
    };
  }
  
  /**
   * Validate Context.RL4 required keys
   */
  static validateContext(frontmatter: any, markdownContent: string): RequiredKeysResult {
    const missing: string[] = [];
    
    // Check frontmatter
    for (const key of this.CONTEXT_REQUIRED_FRONTMATTER) {
      if (!(key in frontmatter)) {
        missing.push(`frontmatter.${key}`);
      }
    }
    
    // Special check: kpis_llm and kpis_kernel must be arrays
    if (frontmatter.kpis_llm !== undefined && !Array.isArray(frontmatter.kpis_llm)) {
      missing.push('frontmatter.kpis_llm (must be array)');
    }
    if (frontmatter.kpis_kernel !== undefined && !Array.isArray(frontmatter.kpis_kernel)) {
      missing.push('frontmatter.kpis_kernel (must be array)');
    }
    
    // Check markdown sections
    for (const section of this.CONTEXT_REQUIRED_SECTIONS) {
      if (!markdownContent.includes(section)) {
        missing.push(`section: ${section}`);
      }
    }
    
    return {
      valid: missing.length === 0,
      missing,
      file: 'Context.RL4'
    };
  }
  
  /**
   * Validate all three core RL4 files at once
   */
  static validateAll(
    planFrontmatter: any,
    planMarkdown: string,
    tasksFrontmatter: any,
    tasksMarkdown: string,
    contextFrontmatter: any,
    contextMarkdown: string
  ): { valid: boolean; results: RequiredKeysResult[] } {
    const results: RequiredKeysResult[] = [
      this.validatePlan(planFrontmatter, planMarkdown),
      this.validateTasks(tasksFrontmatter, tasksMarkdown),
      this.validateContext(contextFrontmatter, contextMarkdown)
    ];
    
    const valid = results.every(r => r.valid);
    
    return { valid, results };
  }
}


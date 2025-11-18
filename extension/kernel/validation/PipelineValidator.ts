/**
 * PipelineValidator — Pipeline S/P/L/B de validation RL4
 * 
 * MVP-1 : Pipeline structuré de validation
 * 
 * Pipeline :
 * S (Structural) : YAML parseability, required keys, structure
 * P (Permissions) : LLM allowed/forbidden fields, kernel-only fields
 * L (Logical) : Invariants, cross-file consistency
 * B (Behavioral) : Text deviation, orphan tasks, volume limits
 * 
 * Verrous par étape :
 * - S: V1 (YAML invalid), V2 (Key ordering), V16 (Required keys), V17 (Response contract)
 * - P: V3 (LLM → kpis_kernel), V4 (Indirect files), V9 (first_use_lock)
 * - L: V6 (Atomicity), V10 (DAG), V14 (Cross-file consistency)
 * - B: V5 (Textual deviation), V7 (Orphan tasks), V13 (Volume limits), V15 (Mode signature)
 * 
 * Activation :
 * - Blocking: S et P (toujours)
 * - Soft: L et B (log-only au MVP)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { YAMLCanonicalizer } from '../canonicalization/YAMLCanonicalizer';
import { RequiredKeysValidator } from './RequiredKeysValidator';
import { ResponseContractValidator } from './ResponseContractValidator';

export interface ValidationResult {
  valid: boolean;
  blocking_errors: string[];
  soft_warnings: string[];
  stage_results: {
    structural: StageResult;
    permissions: StageResult;
    logical: StageResult;
    behavioral: StageResult;
  };
}

export interface StageResult {
  passed: boolean;
  errors: string[];
  warnings: string[];
}

export interface KernelConfig {
  verrous_blocking: string[]; // ['V1', 'V2', 'V3', 'V6', 'V16', 'V17']
  verrous_soft: string[];     // ['V4', 'V5', 'V7', 'V9', 'V10', 'V13', 'V14', 'V15']
}

export class PipelineValidator {
  private rl4Path: string;
  private config: KernelConfig;
  
  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
    this.config = this.loadConfig();
  }
  
  /**
   * Run full S/P/L/B pipeline
   */
  async validate(
    planContent: string,
    tasksContent: string,
    contextContent: string,
    mode?: string
  ): Promise<ValidationResult> {
    const result: ValidationResult = {
      valid: true,
      blocking_errors: [],
      soft_warnings: [],
      stage_results: {
        structural: { passed: true, errors: [], warnings: [] },
        permissions: { passed: true, errors: [], warnings: [] },
        logical: { passed: true, errors: [], warnings: [] },
        behavioral: { passed: true, errors: [], warnings: [] }
      }
    };
    
    // STAGE 1: STRUCTURAL (Blocking)
    result.stage_results.structural = await this.runStructuralValidation(
      planContent,
      tasksContent,
      contextContent
    );
    
    if (!result.stage_results.structural.passed) {
      result.valid = false;
      result.blocking_errors.push(...result.stage_results.structural.errors);
      return result; // Stop here if structural fails
    }
    
    // STAGE 2: PERMISSIONS (Blocking)
    result.stage_results.permissions = await this.runPermissionValidation(
      planContent,
      tasksContent,
      contextContent
    );
    
    if (!result.stage_results.permissions.passed) {
      result.valid = false;
      result.blocking_errors.push(...result.stage_results.permissions.errors);
      return result; // Stop here if permissions fail
    }
    
    // STAGE 3: LOGICAL (Soft - log only)
    result.stage_results.logical = await this.runLogicalValidation(
      planContent,
      tasksContent,
      contextContent
    );
    
    // Logical errors are soft warnings at MVP
    result.soft_warnings.push(...result.stage_results.logical.errors);
    result.soft_warnings.push(...result.stage_results.logical.warnings);
    
    // STAGE 4: BEHAVIORAL (Soft - log only)
    result.stage_results.behavioral = await this.runBehavioralValidation(
      planContent,
      tasksContent,
      contextContent,
      mode
    );
    
    // Behavioral errors are soft warnings at MVP
    result.soft_warnings.push(...result.stage_results.behavioral.errors);
    result.soft_warnings.push(...result.stage_results.behavioral.warnings);
    
    return result;
  }
  
  /**
   * STAGE S: Structural validation (Blocking)
   * Verrous: V1, V2, V16, V17
   */
  private async runStructuralValidation(
    planContent: string,
    tasksContent: string,
    contextContent: string
  ): Promise<StageResult> {
    const result: StageResult = { passed: true, errors: [], warnings: [] };
    
    // V1: YAML parseability
    const yamlCheck = this.validateYAMLStructure(planContent, tasksContent, contextContent);
    if (!yamlCheck.valid) {
      result.passed = false;
      result.errors.push(...yamlCheck.errors);
    }
    
    // V2: Key ordering (if not first run)
    const orderingCheck = this.validateKeyOrdering(planContent, tasksContent, contextContent);
    if (!orderingCheck.valid && this.isBlocking('V2')) {
      result.passed = false;
      result.errors.push(...orderingCheck.errors);
    } else if (!orderingCheck.valid) {
      result.warnings.push(...orderingCheck.errors);
    }
    
    // V16: Required keys
    const requiredKeysCheck = this.validateRequiredKeys(planContent, tasksContent, contextContent);
    if (!requiredKeysCheck.valid) {
      result.passed = false;
      result.errors.push(...requiredKeysCheck.errors);
    }
    
    return result;
  }
  
  /**
   * STAGE P: Permission validation (Blocking)
   * Verrous: V3, V4, V9
   */
  private async runPermissionValidation(
    planContent: string,
    tasksContent: string,
    contextContent: string
  ): Promise<StageResult> {
    const result: StageResult = { passed: true, errors: [], warnings: [] };
    
    // V3: LLM did not modify kpis_kernel
    const kernelKPICheck = this.validateKernelKPIs(contextContent);
    if (!kernelKPICheck.valid) {
      result.passed = false;
      result.errors.push(...kernelKPICheck.errors);
    }
    
    // V4: No indirect file creations (check activeFiles)
    const indirectFilesCheck = this.validateNoIndirectFiles(contextContent);
    if (!indirectFilesCheck.valid && this.isBlocking('V4')) {
      result.passed = false;
      result.errors.push(...indirectFilesCheck.errors);
    } else if (!indirectFilesCheck.valid) {
      result.warnings.push(...indirectFilesCheck.errors);
    }
    
    // V9: first_use_lock not modified
    const lockCheck = this.validateFirstUseLock(contextContent);
    if (!lockCheck.valid && this.isBlocking('V9')) {
      result.passed = false;
      result.errors.push(...lockCheck.errors);
    } else if (!lockCheck.valid) {
      result.warnings.push(...lockCheck.errors);
    }
    
    return result;
  }
  
  /**
   * STAGE L: Logical validation (Soft at MVP)
   * Verrous: V6, V10, V14
   */
  private async runLogicalValidation(
    planContent: string,
    tasksContent: string,
    contextContent: string
  ): Promise<StageResult> {
    const result: StageResult = { passed: true, errors: [], warnings: [] };
    
    // V6: Atomicity (all 3 files parseable)
    // Already covered by V1, but check coherence
    
    // V10: DAG (no cyclic dependencies in tasks)
    const dagCheck = this.validateTasksDAG(tasksContent);
    if (!dagCheck.valid) {
      result.errors.push(...dagCheck.errors);
    }
    
    // V14: Cross-file consistency
    const crossFileCheck = this.validateCrossFileConsistency(planContent, tasksContent, contextContent);
    if (!crossFileCheck.valid) {
      result.errors.push(...crossFileCheck.errors);
    }
    
    return result;
  }
  
  /**
   * STAGE B: Behavioral validation (Soft at MVP)
   * Verrous: V5, V7, V13, V15
   */
  private async runBehavioralValidation(
    planContent: string,
    tasksContent: string,
    contextContent: string,
    mode?: string
  ): Promise<StageResult> {
    const result: StageResult = { passed: true, errors: [], warnings: [] };
    
    // V5: Textual deviation
    const deviationCheck = this.validateTextualDeviation(planContent, tasksContent, contextContent);
    if (!deviationCheck.valid) {
      result.warnings.push(...deviationCheck.errors);
    }
    
    // V7: Orphan tasks
    const orphanCheck = this.validateOrphanTasks(planContent, tasksContent);
    if (!orphanCheck.valid) {
      result.warnings.push(...orphanCheck.errors);
    }
    
    // V13: Volume limits
    const volumeCheck = this.validateVolumeLimits(planContent, tasksContent, contextContent);
    if (!volumeCheck.valid) {
      result.warnings.push(...volumeCheck.errors);
    }
    
    // V15: Mode signature
    if (mode) {
      const modeCheck = this.validateModeSignature(mode, planContent, tasksContent, contextContent);
      if (!modeCheck.valid) {
        result.warnings.push(...modeCheck.errors);
      }
    }
    
    return result;
  }
  
  /**
   * V1: YAML parseability
   */
  private validateYAMLStructure(plan: string, tasks: string, context: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const planMatch = plan.match(/^---\n([\s\S]*?)\n---/);
      if (planMatch) {
        yaml.load(planMatch[1]);
      } else {
        errors.push('Plan.RL4: Invalid frontmatter structure');
      }
    } catch (error) {
      errors.push(`Plan.RL4: YAML parsing failed - ${error}`);
    }
    
    try {
      const tasksMatch = tasks.match(/^---\n([\s\S]*?)\n---/);
      if (tasksMatch) {
        yaml.load(tasksMatch[1]);
      } else {
        errors.push('Tasks.RL4: Invalid frontmatter structure');
      }
    } catch (error) {
      errors.push(`Tasks.RL4: YAML parsing failed - ${error}`);
    }
    
    try {
      const contextMatch = context.match(/^---\n([\s\S]*?)\n---/);
      if (contextMatch) {
        yaml.load(contextMatch[1]);
      } else {
        errors.push('Context.RL4: Invalid frontmatter structure');
      }
    } catch (error) {
      errors.push(`Context.RL4: YAML parsing failed - ${error}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * V2: Key ordering preservation
   */
  private validateKeyOrdering(plan: string, tasks: string, context: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Compare with backup if exists
    const backupPath = path.join(this.rl4Path, '.rollback_backups');
    
    if (fs.existsSync(path.join(backupPath, 'Plan.RL4.backup'))) {
      const backupPlan = fs.readFileSync(path.join(backupPath, 'Plan.RL4.backup'), 'utf8');
      const planFM = plan.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
      const backupPlanFM = backupPlan.match(/^---\n([\s\S]*?)\n---/)?.[1] || '';
      
      if (!YAMLCanonicalizer.validateKeyOrdering(backupPlanFM, planFM)) {
        errors.push('Plan.RL4: Key ordering changed (V2 violation)');
      }
    }
    
    // Similar for Tasks and Context...
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * V16: Required keys validation
   */
  private validateRequiredKeys(plan: string, tasks: string, context: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Extract frontmatter and markdown
      const planMatch = plan.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const tasksMatch = tasks.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      const contextMatch = context.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
      
      if (!planMatch || !tasksMatch || !contextMatch) {
        errors.push('Invalid file structure (missing frontmatter or markdown)');
        return { valid: false, errors };
      }
      
      const planFM = yaml.load(planMatch[1]);
      const planMD = planMatch[2];
      const tasksFM = yaml.load(tasksMatch[1]);
      const tasksMD = tasksMatch[2];
      const contextFM = yaml.load(contextMatch[1]);
      const contextMD = contextMatch[2];
      
      const validationResult = RequiredKeysValidator.validateAll(
        planFM,
        planMD,
        tasksFM,
        tasksMD,
        contextFM,
        contextMD
      );
      
      if (!validationResult.valid) {
        for (const result of validationResult.results) {
          if (!result.valid) {
            errors.push(`${result.file}: Missing required keys - ${result.missing.join(', ')}`);
          }
        }
      }
    } catch (error) {
      errors.push(`Failed to validate required keys: ${error}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * V3: LLM did not modify kpis_kernel
   */
  private validateKernelKPIs(context: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Load backup
    const backupPath = path.join(this.rl4Path, '.rollback_backups', 'Context.RL4.backup');
    if (!fs.existsSync(backupPath)) {
      return { valid: true, errors }; // No backup = first write, allow
    }
    
    try {
      const backup = fs.readFileSync(backupPath, 'utf8');
      const backupMatch = backup.match(/^---\n([\s\S]*?)\n---/);
      const currentMatch = context.match(/^---\n([\s\S]*?)\n---/);
      
      if (!backupMatch || !currentMatch) {
        return { valid: true, errors };
      }
      
      const backupFM: any = yaml.load(backupMatch[1]);
      const currentFM: any = yaml.load(currentMatch[1]);
      
      // Compare kpis_kernel arrays
      const backupKernel = JSON.stringify(backupFM.kpis_kernel || []);
      const currentKernel = JSON.stringify(currentFM.kpis_kernel || []);
      
      if (backupKernel !== currentKernel) {
        errors.push('Context.RL4: LLM modified kpis_kernel (V3 violation - kernel-only field)');
      }
    } catch (error) {
      errors.push(`Failed to validate kpis_kernel: ${error}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * V4: No indirect file creations (placeholder)
   */
  private validateNoIndirectFiles(context: string): { valid: boolean; errors: string[] } {
    // Soft check for MVP
    return { valid: true, errors: [] };
  }
  
  /**
   * V9: first_use_lock not modified (placeholder)
   */
  private validateFirstUseLock(context: string): { valid: boolean; errors: string[] } {
    // Soft check for MVP
    return { valid: true, errors: [] };
  }
  
  /**
   * V10: DAG validation (placeholder)
   */
  private validateTasksDAG(tasks: string): { valid: boolean; errors: string[] } {
    // Soft check for MVP
    return { valid: true, errors: [] };
  }
  
  /**
   * V14: Cross-file consistency (placeholder)
   */
  private validateCrossFileConsistency(plan: string, tasks: string, context: string): { valid: boolean; errors: string[] } {
    // Soft check for MVP
    return { valid: true, errors: [] };
  }
  
  /**
   * V5: Textual deviation (placeholder)
   */
  private validateTextualDeviation(plan: string, tasks: string, context: string): { valid: boolean; errors: string[] } {
    // Soft check for MVP
    return { valid: true, errors: [] };
  }
  
  /**
   * V7: Orphan tasks (placeholder)
   */
  private validateOrphanTasks(plan: string, tasks: string): { valid: boolean; errors: string[] } {
    // Soft check for MVP
    return { valid: true, errors: [] };
  }
  
  /**
   * V13: Volume limits
   */
  private validateVolumeLimits(plan: string, tasks: string, context: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      // Extract tasks count
      const tasksMatch = tasks.match(/## Active\n([\s\S]*?)(?=\n##|$)/);
      if (tasksMatch) {
        const taskLines = tasksMatch[1].split('\n').filter(l => l.trim().startsWith('- ['));
        if (taskLines.length > 40) {
          errors.push(`Tasks.RL4: Too many tasks (${taskLines.length} > 40 max)`);
        }
      }
      
      // Extract success criteria count
      const planMatch = plan.match(/## Success Criteria\n([\s\S]*?)(?=\n##|$)/);
      if (planMatch) {
        const criteriaLines = planMatch[1].split('\n').filter(l => l.trim().startsWith('- '));
        if (criteriaLines.length > 5) {
          errors.push(`Plan.RL4: Too many success criteria (${criteriaLines.length} > 5 max for firstUse)`);
        }
      }
    } catch (error) {
      errors.push(`Failed to validate volume limits: ${error}`);
    }
    
    return { valid: errors.length === 0, errors };
  }
  
  /**
   * V15: Mode signature (placeholder)
   */
  private validateModeSignature(mode: string, plan: string, tasks: string, context: string): { valid: boolean; errors: string[] } {
    // Soft check for MVP
    return { valid: true, errors: [] };
  }
  
  /**
   * Load kernel config
   */
  private loadConfig(): KernelConfig {
    const configPath = path.join(this.rl4Path, 'kernel_config.json');
    
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, 'utf8');
        return JSON.parse(content) as KernelConfig;
      } catch {}
    }
    
    // Default config (MVP)
    return {
      verrous_blocking: ['V1', 'V2', 'V3', 'V6', 'V16', 'V17'],
      verrous_soft: ['V4', 'V5', 'V7', 'V9', 'V10', 'V13', 'V14', 'V15']
    };
  }
  
  /**
   * Check if verrou is blocking
   */
  private isBlocking(verrou: string): boolean {
    return this.config.verrous_blocking.includes(verrou);
  }
}


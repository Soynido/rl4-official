/**
 * ModesSystem — Gestionnaire central des modes RL4
 * 
 * MVP-2 : Modes STRICT et FLEXIBLE
 * 
 * Modes supportés :
 * - strict : Exécution P0 uniquement, 0 créations, 0 modifications hors scope
 * - flexible : P0 + P1, max 3 fichiers créés, max 5 modifiés
 * - firstUse : Bootstrap initial (déjà implémenté dans FirstBootstrapEngine)
 * 
 * Responsabilités :
 * - Charger le mode actif depuis Context.RL4
 * - Valider les permissions selon le mode
 * - Gérer les transitions de mode
 * - Asserter les contraintes par mode
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

export type RL4Mode = 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';

export interface ModeConstraints {
  mode: RL4Mode;
  allowed_priorities: string[];
  max_files_created: number;
  max_files_modified: number;
  allow_directory_creation: boolean;
  allow_refactoring: boolean;
  allow_helper_files: boolean;
  allow_text_rewriting: boolean;
}

export interface ModeViolation {
  violation: string;
  severity: 'blocking' | 'soft';
  description: string;
}

export class ModesSystem {
  private rl4Path: string;
  private currentMode: RL4Mode | null = null;
  
  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
  }
  
  /**
   * Get active mode from Context.RL4
   */
  getActiveMode(): RL4Mode {
    if (this.currentMode) {
      return this.currentMode;
    }
    
    const contextPath = path.join(this.rl4Path, 'Context.RL4');
    
    if (!fs.existsSync(contextPath)) {
      // Default to flexible if no context
      this.currentMode = 'flexible';
      return this.currentMode;
    }
    
    try {
      const content = fs.readFileSync(contextPath, 'utf8');
      const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
      
      if (frontmatterMatch) {
        const frontmatter: any = yaml.load(frontmatterMatch[1]);
        const mode = frontmatter.mode || frontmatter.deviation_mode || 'flexible';
        
        // Validate mode
        const validModes: RL4Mode[] = ['strict', 'flexible', 'exploratory', 'free', 'firstUse'];
        if (validModes.includes(mode)) {
          this.currentMode = mode as RL4Mode;
        } else {
          console.warn(`[ModesSystem] Invalid mode "${mode}", defaulting to flexible`);
          this.currentMode = 'flexible';
        }
      } else {
        this.currentMode = 'flexible';
      }
    } catch (error) {
      console.error('[ModesSystem] Failed to read mode from Context.RL4:', error);
      this.currentMode = 'flexible';
    }
    
    return this.currentMode;
  }
  
  /**
   * Set mode in Context.RL4
   */
  setMode(mode: RL4Mode): boolean {
    const contextPath = path.join(this.rl4Path, 'Context.RL4');
    
    if (!fs.existsSync(contextPath)) {
      console.error('[ModesSystem] Context.RL4 does not exist');
      return false;
    }
    
    try {
      const content = fs.readFileSync(contextPath, 'utf8');
      
      // Replace mode in frontmatter
      const updatedContent = content.replace(
        /^(---\n[\s\S]*?)(mode|deviation_mode):\s*\S+/m,
        (match, prefix) => `${prefix}mode: ${mode}`
      );
      
      fs.writeFileSync(contextPath, updatedContent, 'utf8');
      this.currentMode = mode;
      
      console.log(`[ModesSystem] Mode set to: ${mode}`);
      return true;
    } catch (error) {
      console.error('[ModesSystem] Failed to set mode:', error);
      return false;
    }
  }
  
  /**
   * Get constraints for current mode
   */
  getModeConstraints(): ModeConstraints {
    const mode = this.getActiveMode();
    
    switch (mode) {
      case 'strict':
        return {
          mode: 'strict',
          allowed_priorities: ['P0'],
          max_files_created: 0,
          max_files_modified: 0, // Only files in active P0 task scope
          allow_directory_creation: false,
          allow_refactoring: false,
          allow_helper_files: false,
          allow_text_rewriting: false
        };
        
      case 'flexible':
        return {
          mode: 'flexible',
          allowed_priorities: ['P0', 'P1'],
          max_files_created: 3,
          max_files_modified: 5,
          allow_directory_creation: false,
          allow_refactoring: false, // No multi-file refactors
          allow_helper_files: false, // Log-only for MVP
          allow_text_rewriting: false
        };
        
      case 'exploratory':
        return {
          mode: 'exploratory',
          allowed_priorities: ['P0', 'P1', 'P2'],
          max_files_created: 10,
          max_files_modified: 15,
          allow_directory_creation: false,
          allow_refactoring: true,
          allow_helper_files: true,
          allow_text_rewriting: false
        };
        
      case 'free':
        return {
          mode: 'free',
          allowed_priorities: ['P0', 'P1', 'P2', 'P3'],
          max_files_created: 999,
          max_files_modified: 999,
          allow_directory_creation: true,
          allow_refactoring: true,
          allow_helper_files: true,
          allow_text_rewriting: true
        };
        
      case 'firstUse':
        return {
          mode: 'firstUse',
          allowed_priorities: ['P0'],
          max_files_created: 3, // Only Plan/Tasks/Context
          max_files_modified: 0,
          allow_directory_creation: false,
          allow_refactoring: false,
          allow_helper_files: false,
          allow_text_rewriting: false
        };
        
      default:
        // Default to flexible
        return this.getModeConstraints();
    }
  }
  
  /**
   * Check if mode is STRICT
   */
  isStrict(): boolean {
    return this.getActiveMode() === 'strict';
  }
  
  /**
   * Check if mode is FLEXIBLE
   */
  isFlexible(): boolean {
    return this.getActiveMode() === 'flexible';
  }
  
  /**
   * Assert STRICT mode permissions (Blocking)
   */
  assertStrictAllowed(mutations: {
    filesCreated: string[];
    filesModified: string[];
    directoriesCreated: string[];
  }, activeTasks: Array<{ priority: string; task: string }>): ModeViolation[] {
    const violations: ModeViolation[] = [];
    
    // Rule 1: No file creations in STRICT mode
    if (mutations.filesCreated.length > 0) {
      violations.push({
        violation: 'STRICT_NO_FILE_CREATION',
        severity: 'blocking',
        description: `STRICT mode: Cannot create files. Found ${mutations.filesCreated.length} files: ${mutations.filesCreated.join(', ')}`
      });
    }
    
    // Rule 2: No directory creations
    if (mutations.directoriesCreated.length > 0) {
      violations.push({
        violation: 'STRICT_NO_DIRECTORY_CREATION',
        severity: 'blocking',
        description: `STRICT mode: Cannot create directories. Found: ${mutations.directoriesCreated.join(', ')}`
      });
    }
    
    // Rule 3: Only P0 tasks allowed
    const nonP0Tasks = activeTasks.filter(t => !t.priority.includes('P0'));
    if (nonP0Tasks.length > 0) {
      violations.push({
        violation: 'STRICT_ONLY_P0',
        severity: 'blocking',
        description: `STRICT mode: Only P0 tasks allowed. Found non-P0: ${nonP0Tasks.map(t => t.task).join(', ')}`
      });
    }
    
    // Rule 4: File modifications only within active P0 task scope
    // (Soft check for MVP - would need task<->file mapping)
    if (mutations.filesModified.length > 10) {
      violations.push({
        violation: 'STRICT_TOO_MANY_MODIFICATIONS',
        severity: 'soft',
        description: `STRICT mode: Suspicious number of file modifications (${mutations.filesModified.length})`
      });
    }
    
    return violations;
  }
  
  /**
   * Assert FLEXIBLE mode permissions (Blocking léger + Soft logs)
   */
  assertFlexibleAllowed(mutations: {
    filesCreated: string[];
    filesModified: string[];
    directoriesCreated: string[];
  }, activeTasks: Array<{ priority: string; task: string }>): ModeViolation[] {
    const violations: ModeViolation[] = [];
    const constraints = this.getModeConstraints();
    
    // Rule 1: Max 3 files created (Blocking)
    if (mutations.filesCreated.length > constraints.max_files_created) {
      violations.push({
        violation: 'FLEXIBLE_MAX_FILES_CREATED',
        severity: 'blocking',
        description: `FLEXIBLE mode: Max ${constraints.max_files_created} files created. Found ${mutations.filesCreated.length}: ${mutations.filesCreated.join(', ')}`
      });
    }
    
    // Rule 2: Max 5 files modified (Blocking)
    if (mutations.filesModified.length > constraints.max_files_modified) {
      violations.push({
        violation: 'FLEXIBLE_MAX_FILES_MODIFIED',
        severity: 'blocking',
        description: `FLEXIBLE mode: Max ${constraints.max_files_modified} files modified. Found ${mutations.filesModified.length}`
      });
    }
    
    // Rule 3: No directory creations (Blocking)
    if (mutations.directoriesCreated.length > 0) {
      violations.push({
        violation: 'FLEXIBLE_NO_DIRECTORY_CREATION',
        severity: 'blocking',
        description: `FLEXIBLE mode: Cannot create directories. Found: ${mutations.directoriesCreated.join(', ')}`
      });
    }
    
    // Rule 4: Only P0 + P1 tasks (Blocking)
    const invalidTasks = activeTasks.filter(t => !t.priority.includes('P0') && !t.priority.includes('P1'));
    if (invalidTasks.length > 0) {
      violations.push({
        violation: 'FLEXIBLE_ONLY_P0_P1',
        severity: 'blocking',
        description: `FLEXIBLE mode: Only P0/P1 tasks allowed. Found: ${invalidTasks.map(t => t.task).join(', ')}`
      });
    }
    
    // Rule 5: Detect helper/util file creations (Soft - log only for MVP)
    const helperFiles = mutations.filesCreated.filter(f => 
      f.includes('helper') || 
      f.includes('util') || 
      f.includes('Helper') || 
      f.includes('Util') ||
      f.endsWith('Utils.ts') ||
      f.endsWith('Helpers.ts')
    );
    
    if (helperFiles.length > 0) {
      violations.push({
        violation: 'FLEXIBLE_HELPER_FILES_DETECTED',
        severity: 'soft',
        description: `FLEXIBLE mode: Helper/util files detected (soft warning): ${helperFiles.join(', ')}`
      });
    }
    
    // Rule 6: Detect multi-file refactors (Soft - heuristic)
    if (mutations.filesModified.length > 3 && mutations.filesCreated.length === 0) {
      violations.push({
        violation: 'FLEXIBLE_POSSIBLE_REFACTOR',
        severity: 'soft',
        description: `FLEXIBLE mode: Possible multi-file refactor detected (${mutations.filesModified.length} files modified)`
      });
    }
    
    return violations;
  }
  
  /**
   * Validate mode permissions (generic wrapper)
   */
  validateModePermissions(mutations: {
    filesCreated: string[];
    filesModified: string[];
    directoriesCreated: string[];
  }, activeTasks: Array<{ priority: string; task: string }>): {
    valid: boolean;
    blockingViolations: ModeViolation[];
    softViolations: ModeViolation[];
  } {
    const mode = this.getActiveMode();
    let violations: ModeViolation[] = [];
    
    if (mode === 'strict') {
      violations = this.assertStrictAllowed(mutations, activeTasks);
    } else if (mode === 'flexible') {
      violations = this.assertFlexibleAllowed(mutations, activeTasks);
    } else {
      // Other modes (exploratory, free) have no blocking constraints for MVP
      violations = [];
    }
    
    const blockingViolations = violations.filter(v => v.severity === 'blocking');
    const softViolations = violations.filter(v => v.severity === 'soft');
    
    return {
      valid: blockingViolations.length === 0,
      blockingViolations,
      softViolations
    };
  }
  
  /**
   * Get mode description (for UI)
   */
  getModeDescription(mode?: RL4Mode): string {
    const m = mode || this.getActiveMode();
    
    switch (m) {
      case 'strict':
        return '🔒 STRICT: P0 only, no creations, no modifications outside task scope';
      case 'flexible':
        return '🧩 FLEXIBLE: P0+P1, max 3 files created, max 5 modified';
      case 'exploratory':
        return '🌍 EXPLORATORY: P0+P1+P2, experiments allowed';
      case 'free':
        return '🔥 FREE: No constraints, full autonomy';
      case 'firstUse':
        return '🌱 FIRST USE: Bootstrap mode (one-time)';
      default:
        return 'Unknown mode';
    }
  }
}


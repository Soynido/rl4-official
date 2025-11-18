/**
 * RL4RollbackSystem — Système de rollback atomique pour fichiers RL4
 * 
 * MVP-1 : Rollback HEAD si corruption détectée
 * 
 * Workflow :
 * 1. Avant modification : createBackup(file)
 * 2. Après modification : validate(file)
 * 3. Si invalide : rollbackHEAD(file) + writeQuarantineLog()
 * 
 * Verrous déclenchant rollback (blocking) :
 * - V1: YAML structure invalide
 * - V2: Key ordering modifié
 * - V3: LLM modifie kpis_kernel
 * - V6: RL4 files non parseables
 * - V16: Required keys manquants
 * - V17: Response contract invalide
 * 
 * Quarantine Log :
 * - Timestamp
 * - Fichier concerné
 * - Erreur détectée
 * - Contenu avant/après
 * - Mode actuel
 * - Prompt LLM
 * - Hash snapshots
 */

import * as fs from 'fs';
import * as path from 'path';
import { YAMLCanonicalizer } from '../canonicalization/YAMLCanonicalizer';

export interface QuarantineLogEntry {
  timestamp: string;
  file: string;
  error: string;
  violation: string; // V1, V2, etc.
  mode: string;
  
  // Forensic traces
  content_before: string;
  content_after: string;
  prompt_hash?: string;
  llm_response_hash?: string;
  
  // Lineage
  previous_snapshot_timestamp?: string;
  previous_snapshot_hash?: string;
  current_ground_truth_hash?: string;
  
  // Context
  active_tasks?: string[];
  recent_commands?: string[];
}

export class RL4RollbackSystem {
  private rl4Path: string;
  private backupPath: string;
  private quarantinePath: string;
  
  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
    this.backupPath = path.join(rl4Path, '.rollback_backups');
    this.quarantinePath = path.join(rl4Path, 'quarantine_log.jsonl');
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupPath)) {
      fs.mkdirSync(this.backupPath, { recursive: true });
    }
  }
  
  /**
   * Create backup before modification (MUST be called before any RL4 write)
   */
  createBackup(fileName: 'Plan.RL4' | 'Tasks.RL4' | 'Context.RL4'): boolean {
    const filePath = path.join(this.rl4Path, fileName);
    
    if (!fs.existsSync(filePath)) {
      console.warn(`[RL4RollbackSystem] File does not exist: ${fileName}`);
      return false;
    }
    
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const backupFilePath = path.join(this.backupPath, `${fileName}.backup`);
      
      fs.writeFileSync(backupFilePath, content, 'utf8');
      
      // Also save timestamp
      const metadataPath = path.join(this.backupPath, `${fileName}.backup.meta.json`);
      fs.writeFileSync(metadataPath, JSON.stringify({
        timestamp: new Date().toISOString(),
        file: fileName,
        hash: this.simpleHash(content)
      }, null, 2));
      
      return true;
    } catch (error) {
      console.error(`[RL4RollbackSystem] Failed to create backup for ${fileName}:`, error);
      return false;
    }
  }
  
  /**
   * Rollback file to backup (HEAD)
   */
  rollbackHEAD(fileName: 'Plan.RL4' | 'Tasks.RL4' | 'Context.RL4'): boolean {
    const backupFilePath = path.join(this.backupPath, `${fileName}.backup`);
    
    if (!fs.existsSync(backupFilePath)) {
      console.error(`[RL4RollbackSystem] No backup found for ${fileName}`);
      return false;
    }
    
    try {
      const backupContent = fs.readFileSync(backupFilePath, 'utf8');
      const filePath = path.join(this.rl4Path, fileName);
      
      fs.writeFileSync(filePath, backupContent, 'utf8');
      
      console.log(`[RL4RollbackSystem] ✅ Rolled back ${fileName} to HEAD`);
      return true;
    } catch (error) {
      console.error(`[RL4RollbackSystem] Failed to rollback ${fileName}:`, error);
      return false;
    }
  }
  
  /**
   * Rollback all 3 core files atomically
   */
  rollbackAll(): { success: boolean; rolledBack: string[] } {
    const rolledBack: string[] = [];
    const files: Array<'Plan.RL4' | 'Tasks.RL4' | 'Context.RL4'> = [
      'Plan.RL4',
      'Tasks.RL4',
      'Context.RL4'
    ];
    
    for (const file of files) {
      if (this.rollbackHEAD(file)) {
        rolledBack.push(file);
      }
    }
    
    const success = rolledBack.length === files.length;
    
    if (success) {
      console.log('[RL4RollbackSystem] ✅ Atomic rollback complete (all 3 files)');
    } else {
      console.error(`[RL4RollbackSystem] ⚠️ Partial rollback: ${rolledBack.join(', ')}`);
    }
    
    return { success, rolledBack };
  }
  
  /**
   * Write quarantine log (forensic trace)
   */
  writeQuarantineLog(entry: QuarantineLogEntry): void {
    try {
      const logEntry = JSON.stringify(entry) + '\n';
      fs.appendFileSync(this.quarantinePath, logEntry, 'utf8');
      
      console.log('[RL4RollbackSystem] 📝 Quarantine log written');
      console.log(`  Violation: ${entry.violation}`);
      console.log(`  File: ${entry.file}`);
      console.log(`  Error: ${entry.error}`);
    } catch (error) {
      console.error('[RL4RollbackSystem] Failed to write quarantine log:', error);
    }
  }
  
  /**
   * Calculate snapshot hash (for lineage tracking)
   */
  calculateSnapshotHash(plan: string, tasks: string, context: string): string {
    const combined = plan + '|||' + tasks + '|||' + context;
    return this.simpleHash(combined);
  }
  
  /**
   * Calculate ground truth hash (from ground_truth/*.yaml)
   */
  calculateGroundTruthHash(): string | null {
    const gtPath = path.join(this.rl4Path, 'ground_truth');
    
    if (!fs.existsSync(gtPath)) {
      return null;
    }
    
    try {
      const planPath = path.join(gtPath, 'Plan.yaml');
      const tasksPath = path.join(gtPath, 'Tasks.yaml');
      const contextPath = path.join(gtPath, 'Context.yaml');
      
      if (!fs.existsSync(planPath) || !fs.existsSync(tasksPath) || !fs.existsSync(contextPath)) {
        return null;
      }
      
      const plan = fs.readFileSync(planPath, 'utf8');
      const tasks = fs.readFileSync(tasksPath, 'utf8');
      const context = fs.readFileSync(contextPath, 'utf8');
      
      return this.simpleHash(plan + tasks + context);
    } catch {
      return null;
    }
  }
  
  /**
   * Get backup metadata
   */
  getBackupMetadata(fileName: 'Plan.RL4' | 'Tasks.RL4' | 'Context.RL4'): {
    timestamp: string;
    file: string;
    hash: string;
  } | null {
    const metadataPath = path.join(this.backupPath, `${fileName}.backup.meta.json`);
    
    if (!fs.existsSync(metadataPath)) {
      return null;
    }
    
    try {
      const content = fs.readFileSync(metadataPath, 'utf8');
      return JSON.parse(content);
    } catch {
      return null;
    }
  }
  
  /**
   * Detect if rollback is needed (compare current vs backup using canonicalization)
   */
  needsRollback(fileName: 'Plan.RL4' | 'Tasks.RL4' | 'Context.RL4'): {
    needed: boolean;
    reason?: string;
  } {
    const filePath = path.join(this.rl4Path, fileName);
    const backupPath = path.join(this.backupPath, `${fileName}.backup`);
    
    if (!fs.existsSync(filePath) || !fs.existsSync(backupPath)) {
      return { needed: false };
    }
    
    try {
      const current = fs.readFileSync(filePath, 'utf8');
      const backup = fs.readFileSync(backupPath, 'utf8');
      
      // Canonicalize both
      const currentCanonical = YAMLCanonicalizer.canonicalize(current);
      const backupCanonical = YAMLCanonicalizer.canonicalize(backup);
      
      // Check if structurally different
      if (currentCanonical !== backupCanonical) {
        // Detect specific violations
        const violations = YAMLCanonicalizer.detectStructuralChanges(backup, current);
        
        if (violations.length > 0) {
          return {
            needed: true,
            reason: violations.join('; ')
          };
        }
      }
      
      return { needed: false };
    } catch (error) {
      return {
        needed: true,
        reason: `Failed to compare: ${error}`
      };
    }
  }
  
  /**
   * Clear backups (after successful validation)
   */
  clearBackups(): void {
    const files = ['Plan.RL4', 'Tasks.RL4', 'Context.RL4'];
    
    for (const file of files) {
      const backupPath = path.join(this.backupPath, `${file}.backup`);
      const metadataPath = path.join(this.backupPath, `${file}.backup.meta.json`);
      
      if (fs.existsSync(backupPath)) {
        fs.unlinkSync(backupPath);
      }
      if (fs.existsSync(metadataPath)) {
        fs.unlinkSync(metadataPath);
      }
    }
    
    console.log('[RL4RollbackSystem] 🧹 Backups cleared');
  }
  
  /**
   * Read quarantine log (last N entries)
   */
  readQuarantineLog(limit: number = 10): QuarantineLogEntry[] {
    if (!fs.existsSync(this.quarantinePath)) {
      return [];
    }
    
    try {
      const content = fs.readFileSync(this.quarantinePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      
      const entries = lines
        .slice(-limit)
        .map(line => JSON.parse(line) as QuarantineLogEntry);
      
      return entries.reverse(); // Most recent first
    } catch (error) {
      console.error('[RL4RollbackSystem] Failed to read quarantine log:', error);
      return [];
    }
  }
  
  /**
   * Simple hash function (for production, use crypto.createHash)
   */
  private simpleHash(content: string): string {
    let hash = 0;
    for (let i = 0; i < content.length; i++) {
      const char = content.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(16).padStart(8, '0');
  }
}


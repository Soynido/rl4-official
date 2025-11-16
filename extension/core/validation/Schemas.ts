/**
 * Validation Schemas - Sprint 1, Task 1.3
 * 
 * Schémas Zod centralisés pour validation systématique de tous les JSON
 * 
 * Coverage:
 * - Manifest, Goals, Patterns, Correlations, Forecasts
 * - Traces (CaptureEvent)
 * - ADRs, Evidence
 * - Ledger entries
 * 
 * Benefits:
 * - Type safety at runtime
 * - Automatic validation before read/write
 * - Clear error messages
 * - Schema migration support
 */

import { z } from 'zod';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';

// ==================== MANIFEST ====================

export const ManifestSchema = z.object({
    version: z.string(),
    projectName: z.string(),
    createdAt: z.string().datetime(),
    lastCaptureAt: z.string().datetime(),
    totalEvents: z.number().int().nonnegative(),
    // Support both camelCase and snake_case
    total_events: z.number().int().nonnegative().optional(),
    last_capture_at: z.string().datetime().optional(),
    confidence: z.number().min(0).max(1).optional()
});

export type Manifest = z.infer<typeof ManifestSchema>;

// ==================== CAPTURE EVENT ====================

export const CaptureEventSchema = z.object({
    id: z.string().uuid(),
    type: z.enum([
        'file_change',
        'git_commit',
        'sbom',
        'config',
        'test',
        'github_pr',
        'github_issue',
        'goal_created',
        'task_completed',
        'shell_command'
    ]),
    source: z.string(),
    timestamp: z.string().datetime(),
    data: z.any(),
    confidence: z.number().min(0).max(1).optional(),
    cognitive_relevance: z.number().min(0).max(1).optional(),
    impact: z.enum(['critical', 'high', 'medium', 'low']).optional(),
    category: z.string().optional()
});

export type CaptureEvent = z.infer<typeof CaptureEventSchema>;

// ==================== LEDGER ENTRY ====================

export const LedgerEntrySchema = z.object({
    entry_id: z.string(),
    type: z.enum(['ADR', 'SNAPSHOT', 'EVIDENCE', 'MANIFEST']),
    target_id: z.string(),
    previous_hash: z.string().nullable(),
    current_hash: z.string(),
    signature: z.string().optional(),
    timestamp: z.string().datetime()
});

export type LedgerEntry = z.infer<typeof LedgerEntrySchema>;

// ==================== ADR ====================

export const ADRSchema = z.object({
    id: z.string().uuid(),
    title: z.string(),
    status: z.enum(['proposed', 'accepted', 'deprecated', 'superseded']),
    context: z.array(z.string()),
    decision: z.array(z.string()),
    consequences: z.array(z.string()),
    date: z.string().datetime(),
    references: z.array(z.string()).optional(),
    supersededBy: z.string().uuid().optional(),
    tradeoffs: z.array(z.string()).optional(),
    risks: z.array(z.string()).optional(),
    mitigations: z.array(z.string()).optional()
});

export type ADR = z.infer<typeof ADRSchema>;

// ==================== PATTERN ====================

export const PatternSchema = z.object({
    id: z.string(),
    name: z.string(),
    pattern: z.string().optional(), // Alias for name
    category: z.enum(['structural', 'cognitive', 'contextual']),
    tags: z.array(z.string()).optional(),
    frequency: z.number().int().positive(),
    confidence: z.number().min(0).max(1),
    impact: z.string(),
    firstSeen: z.string().datetime(),
    lastSeen: z.string().datetime(),
    evidenceIds: z.array(z.string()),
    recommendation: z.string()
});

export type Pattern = z.infer<typeof PatternSchema>;

// ==================== GOAL ====================

export const GoalSchema = z.object({
    id: z.string(),
    objective: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']),
    confidence: z.number().min(0).max(1),
    expected_duration: z.string(),
    rationale: z.array(z.string()),
    related_patterns: z.array(z.string()).optional(),
    related_biases: z.array(z.string()).optional(),
    created_at: z.string().datetime(),
    progress: z.number().min(0).max(1).optional(),
    status: z.enum(['active', 'completed', 'deferred', 'cancelled']).optional(),
    plan_reference: z.string().optional(),
    audit_reference: z.string().optional(),
    sprints: z.array(z.any()).optional(),
    success_criteria: z.any().optional()
});

export type Goal = z.infer<typeof GoalSchema>;

export const GoalsManifestSchema = z.object({
    generated_at: z.string().datetime(),
    active_goals: z.array(GoalSchema),
    completed_goals: z.array(GoalSchema),
    total_goals: z.number().int().nonnegative(),
    last_evaluated: z.string().datetime().optional()
});

export type GoalsManifest = z.infer<typeof GoalsManifestSchema>;

// ==================== CORRELATION ====================

export const CorrelationSchema = z.object({
    id: z.string(),
    pattern_id: z.string(),
    event_id: z.string(),
    correlation_score: z.number().min(0).max(1),
    type: z.enum(['confirming', 'diverging', 'emerging']),
    timestamp: z.string().datetime(),
    semantic_score: z.number().min(0).max(1).optional(),
    temporal_score: z.number().min(0).max(1).optional(),
    impact_score: z.number().min(0).max(1).optional()
});

export type Correlation = z.infer<typeof CorrelationSchema>;

// ==================== FORECAST ====================

export const ForecastSchema = z.object({
    id: z.string(),
    type: z.enum(['Decision', 'Risk', 'Opportunity', 'Refactor', 'ADR_Proposal']),
    title: z.string(),
    description: z.string(),
    confidence: z.number().min(0).max(1),
    timeframe: z.string(),
    related_patterns: z.array(z.string()),
    related_correlations: z.array(z.string()).optional(),
    impact: z.string().optional(),
    probability: z.number().min(0).max(1).optional(),
    created_at: z.string().datetime()
});

export type Forecast = z.infer<typeof ForecastSchema>;

// ==================== VALIDATION HELPERS ====================

/**
 * Valide et parse un JSON avec Zod
 * 
 * @throws Error si validation échoue
 */
export function validateJSON<T>(
    schema: z.ZodSchema<T>,
    data: any,
    context?: string
): T {
    try {
        return schema.parse(data);
    } catch (error) {
        if (error instanceof z.ZodError) {
            const errors = error.errors
                .map(e => `${e.path.join('.')}: ${e.message}`)
                .join(', ');
            
            throw new Error(
                `JSON validation failed${context ? ` for ${context}` : ''}: ${errors}`
            );
        }
        throw error;
    }
}

/**
 * Valide avec retour gracieux (retourne null si invalide)
 */
export function safeValidateJSON<T>(
    schema: z.ZodSchema<T>,
    data: any
): T | null {
    try {
        return schema.parse(data);
    } catch (error) {
        console.warn('Validation failed:', error instanceof z.ZodError ? error.errors : error);
        return null;
    }
}

/**
 * Charge et valide un fichier JSON
 */
export async function loadValidatedJSON<T>(
    schema: z.ZodSchema<T>,
    filePath: string
): Promise<T | null> {
    try {
        if (!fs.existsSync(filePath)) {
            return null;
        }
        
        const raw = await fsp.readFile(filePath, 'utf-8');
        const data = JSON.parse(raw);
        
        return validateJSON(schema, data, path.basename(filePath));
    } catch (error) {
        console.error(`❌ Failed to load ${filePath}:`, error);
        
        // Créer backup du fichier corrompu
        const backupPath = filePath + `.corrupted-${Date.now()}`;
        try {
            await fsp.copyFile(filePath, backupPath);
            console.log(`📦 Corrupted file backed up to: ${path.basename(backupPath)}`);
        } catch (backupError) {
            // Non-blocking
        }
        
        throw error;
    }
}

/**
 * Charge avec fallback vers valeur par défaut si invalide
 */
export async function loadValidatedJSONOrDefault<T>(
    schema: z.ZodSchema<T>,
    filePath: string,
    defaultValue: T
): Promise<T> {
    try {
        const validated = await loadValidatedJSON(schema, filePath);
        return validated || defaultValue;
    } catch (error) {
        console.warn(`Using default value for ${path.basename(filePath)}`);
        return defaultValue;
    }
}

/**
 * Sauvegarde un JSON avec validation préalable
 */
export async function saveValidatedJSON<T>(
    schema: z.ZodSchema<T>,
    data: any,
    filePath: string
): Promise<void> {
    // Valider avant sauvegarde
    const validated = validateJSON(schema, data, path.basename(filePath));
    
    // Créer le dossier parent si nécessaire
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    
    // Sauvegarder
    await fsp.writeFile(filePath, JSON.stringify(validated, null, 2), 'utf-8');
}

/**
 * Valide tous les JSON d'un dossier
 */
export async function validateDirectory(
    dirPath: string,
    schema: z.ZodSchema<any>
): Promise<{
    valid: number;
    invalid: number;
    errors: Array<{ file: string; error: string }>;
}> {
    const result = {
        valid: 0,
        invalid: 0,
        errors: [] as Array<{ file: string; error: string }>
    };
    
    if (!fs.existsSync(dirPath)) {
        return result;
    }
    
    const files = fs.readdirSync(dirPath).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
        const filePath = path.join(dirPath, file);
        
        try {
            const raw = await fsp.readFile(filePath, 'utf-8');
            const data = JSON.parse(raw);
            
            schema.parse(data);
            result.valid++;
        } catch (error) {
            result.invalid++;
            result.errors.push({
                file,
                error: error instanceof z.ZodError 
                    ? error.errors[0]?.message || 'Unknown error'
                    : String(error)
            });
        }
    }
    
    return result;
}


/**
 * External Context Schema - Level 6
 * 
 * Zod schema for validating external evidence
 */

import { z } from 'zod';

const ExternalEvidenceTypeSchema = z.enum([
    'product_metric',
    'user_feedback',
    'compliance_requirement',
    'market_signal',
    'incident',
    'postmortem'
]);

export const ExternalEvidenceSchema = z.object({
    id: z.string(),
    type: ExternalEvidenceTypeSchema,
    source: z.string(),
    timestamp: z.string(),
    data: z.record(z.any()),
    confidence: z.number().min(0).max(1).optional(),
    version: z.literal('1.0')
});

export const ProductMetricsSchema = z.object({
    date: z.string(),
    KPIs: z.record(z.number()),
    performance: z.object({
        response_time_p50: z.number(),
        response_time_p95: z.number(),
        response_time_p99: z.number()
    }).optional(),
    costs: z.record(z.number()).optional()
});

export const UserFeedbackSchema = z.object({
    id: z.string(),
    date: z.string(),
    type: z.enum(['bug', 'feature_request', 'complaint', 'praise', 'question']),
    content: z.string(),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    tags: z.array(z.string()).optional(),
    userContext: z.object({
        role: z.string().optional(),
        engagement: z.enum(['low', 'medium', 'high']).optional()
    }).optional()
});

export const ComplianceRequirementSchema = z.object({
    regulation: z.string(),
    section: z.string(),
    description: z.string(),
    status: z.enum(['compliant', 'non_compliant', 'in_progress', 'not_applicable']),
    notes: z.string().optional()
});

export const MarketSignalSchema = z.object({
    trend: z.string(),
    category: z.enum(['technology', 'competitor', 'industry', 'regulatory']),
    source: z.string(),
    date: z.string(),
    relevance_score: z.number().min(0).max(1).optional(),
    details: z.string().optional()
});

export const IncidentSchema = z.object({
    id: z.string(),
    title: z.string(),
    date: z.string(),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    status: z.enum(['resolved', 'investigating', 'monitoring']),
    rootCause: z.string().optional(),
    affectedComponents: z.array(z.string()).optional(),
    resolution: z.string().optional(),
    postMortemLink: z.string().optional()
});

export const PostMortemSchema = z.object({
    id: z.string(),
    title: z.string(),
    incidentId: z.string(),
    date: z.string(),
    summary: z.string(),
    timeline: z.array(z.object({
        time: z.string(),
        event: z.string()
    })).optional(),
    rootCauses: z.array(z.string()),
    impact: z.object({
        usersAffected: z.number().optional(),
        duration: z.string().optional(),
        cost: z.number().optional()
    }),
    lessonsLearned: z.array(z.string()),
    actionItems: z.array(z.object({
        description: z.string(),
        owner: z.string().optional(),
        dueDate: z.string().optional()
    }))
});

// Validation functions
export function validateExternalEvidence(data: any): boolean {
    try {
        ExternalEvidenceSchema.parse(data);
        return true;
    } catch {
        return false;
    }
}

export function validateProductMetrics(data: any): boolean {
    try {
        ProductMetricsSchema.parse(data);
        return true;
    } catch {
        return false;
    }
}

export function validateUserFeedback(data: any): boolean {
    try {
        UserFeedbackSchema.parse(data);
        return true;
    } catch {
        return false;
    }
}

export function validateComplianceRequirement(data: any): boolean {
    try {
        ComplianceRequirementSchema.parse(data);
        return true;
    } catch {
        return false;
    }
}

export function validateMarketSignal(data: any): boolean {
    try {
        MarketSignalSchema.parse(data);
        return true;
    } catch {
        return false;
    }
}

export function validateIncident(data: any): boolean {
    try {
        IncidentSchema.parse(data);
        return true;
    } catch {
        return false;
    }
}

export function validatePostMortem(data: any): boolean {
    try {
        PostMortemSchema.parse(data);
        return true;
    } catch {
        return false;
    }
}


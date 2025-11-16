/**
 * External Context Types - Level 6
 * 
 * Types for external evidence sources (metrics, feedback, compliance, market signals, incidents)
 */

export type ExternalEvidenceType = 
    | 'product_metric'
    | 'user_feedback'
    | 'compliance_requirement'
    | 'market_signal'
    | 'incident'
    | 'postmortem';

export interface ExternalEvidence {
    id: string;
    type: ExternalEvidenceType;
    source: string; // Where it comes from (API, file, etc.)
    timestamp: string;
    data: Record<string, any>;
    confidence?: number; // 0-1, how reliable is this evidence
    version: '1.0';
}

export interface ProductMetrics {
    date: string;
    KPIs: Record<string, number>; // e.g., { conversions: 1200, uptime: 99.9, latency_p50: 45 }
    performance?: {
        response_time_p50: number;
        response_time_p95: number;
        response_time_p99: number;
    };
    costs?: Record<string, number>;
}

export interface UserFeedback {
    id: string;
    date: string;
    type: 'bug' | 'feature_request' | 'complaint' | 'praise' | 'question';
    content: string;
    priority?: 'low' | 'medium' | 'high' | 'critical';
    tags?: string[];
    userContext?: {
        role?: string;
        engagement?: 'low' | 'medium' | 'high';
    };
}

export interface ComplianceRequirement {
    regulation: string; // e.g., 'GDPR', 'SOC2', 'ISO27001'
    section: string;
    description: string;
    status: 'compliant' | 'non_compliant' | 'in_progress' | 'not_applicable';
    notes?: string;
}

export interface MarketSignal {
    trend: string;
    category: 'technology' | 'competitor' | 'industry' | 'regulatory';
    source: string;
    date: string;
    relevance_score?: number; // 0-1
    details?: string;
}

export interface Incident {
    id: string;
    title: string;
    date: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    status: 'resolved' | 'investigating' | 'monitoring';
    rootCause?: string;
    affectedComponents?: string[];
    resolution?: string;
    postMortemLink?: string;
}

export interface PostMortem {
    id: string;
    title: string;
    incidentId: string;
    date: string;
    summary: string;
    timeline?: Array<{ time: string; event: string }>;
    rootCauses: string[];
    impact: {
        usersAffected?: number;
        duration?: string;
        cost?: number;
    };
    lessonsLearned: string[];
    actionItems: Array<{ description: string; owner?: string; dueDate?: string }>;
}

export interface ExternalContext {
    adrId: string;
    evidences: ExternalEvidence[];
}


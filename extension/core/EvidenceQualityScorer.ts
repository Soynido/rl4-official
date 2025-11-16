import { CaptureEvent } from './types';

export interface EvidenceQuality {
    eventId: string;
    score: number;
    factors: {
        freshness: number;
        source: number;
        completeness: number;
    };
    confidence: 'low' | 'medium' | 'high';
}

/**
 * Evidence Quality Scorer
 * Evaluates evidence quality based on multiple factors
 */
export class EvidenceQualityScorer {
    /**
     * Score evidence quality for a single event
     */
    public scoreEvidence(event: CaptureEvent, currentTime: number): EvidenceQuality {
        const eventTimestamp = typeof event.timestamp === 'string' ? parseInt(event.timestamp) : event.timestamp;
        const factors = {
            freshness: this.calculateFreshness(eventTimestamp, currentTime),
            source: this.calculateSourceQuality(event.type, event.source),
            completeness: this.calculateCompleteness(event)
        };

        // Weighted average - prioritize freshness for recent events
        const score = (
            factors.freshness * 0.5 +   // Freshness is most important
            factors.source * 0.3 +       // Source reliability
            factors.completeness * 0.2   // Data completeness
        );

        const confidence = this.mapScoreToConfidence(score);

        return {
            eventId: event.id,
            score,
            factors,
            confidence
        };
    }

    /**
     * Score multiple evidence items
     */
    public scoreEvidenceSet(events: CaptureEvent[]): EvidenceQuality[] {
        const currentTime = Date.now();
        return events.map(event => this.scoreEvidence(event, currentTime));
    }

    /**
     * Calculate freshness score based on age
     * Recent events (0-7 days) = 1.0
     * Week-old events = 0.7
     * Month-old = 0.4
     * Older = 0.1
     */
    private calculateFreshness(timestamp: number, currentTime: number): number {
        const ageMs = currentTime - timestamp;
        const ageDays = ageMs / (1000 * 60 * 60 * 24);

        if (ageDays <= 7) return 1.0;
        if (ageDays <= 30) return 0.7;
        if (ageDays <= 90) return 0.4;
        return 0.1;
    }

    /**
     * Calculate source quality score
     * Different sources have different reliability
     */
    private calculateSourceQuality(type: CaptureEvent['type'], source: string): number {
        // High quality sources
        if (type === 'pr_linked' || type === 'issue_linked') return 1.0;
        if (type === 'git_commit') return 0.9;
        if (type === 'test') return 0.8;

        // Medium-high quality sources (Git-related)
        if (source.includes('git:')) return 0.8; // Increased from 0.7
        if (type === 'dependencies') return 0.6;
        if (type === 'config') return 0.6;

        // Lower quality sources
        if (type === 'file_change') return 0.5;
        return 0.3; // Unknown source
    }

    /**
     * Calculate completeness score based on available data
     */
    private calculateCompleteness(event: CaptureEvent): number {
        let score = 0.6; // Increased base score from 0.5

        // Check for metadata
        if (event.metadata && Object.keys(event.metadata).length > 0) {
            score += 0.2;
        }

        // Check for specific fields based on event type
        if (event.type === 'git_commit' && event.metadata) {
            if (event.metadata.hash) score += 0.1;
            if (event.metadata.message) score += 0.1;
            if (event.metadata.filesChanged) score += 0.1;
        }

        if (event.type === 'file_change' && event.source) {
            score += 0.1;
        }

        return Math.min(score, 1.0);
    }

    /**
     * Map score to confidence level
     */
    private mapScoreToConfidence(score: number): 'low' | 'medium' | 'high' {
        if (score >= 0.4) return 'high';  // Lower threshold to capture more recent Git events
        if (score >= 0.25) return 'medium';
        return 'low';
    }

    /**
     * Get average quality score from a set of evidence
     */
    public getAverageScore(qualitySet: EvidenceQuality[]): number {
        if (qualitySet.length === 0) return 0;
        
        const sum = qualitySet.reduce((acc, q) => acc + q.score, 0);
        return sum / qualitySet.length;
    }

    /**
     * Filter high-quality evidence only
     */
    public filterHighQuality(qualitySet: EvidenceQuality[]): EvidenceQuality[] {
        return qualitySet.filter(q => q.confidence === 'high');
    }

    /**
     * Sort by score (highest first)
     */
    public sortByQuality(qualitySet: EvidenceQuality[]): EvidenceQuality[] {
        return [...qualitySet].sort((a, b) => b.score - a.score);
    }

    /**
     * Get quality summary for logging
     */
    public getQualitySummary(qualitySet: EvidenceQuality[]): string {
        if (qualitySet.length === 0) return 'No evidence available';

        const high = qualitySet.filter(q => q.confidence === 'high').length;
        const medium = qualitySet.filter(q => q.confidence === 'medium').length;
        const low = qualitySet.filter(q => q.confidence === 'low').length;
        const avg = this.getAverageScore(qualitySet);

        return `${qualitySet.length} evidence items (${high} high, ${medium} medium, ${low} low) - Avg score: ${avg.toFixed(2)}`;
    }
}


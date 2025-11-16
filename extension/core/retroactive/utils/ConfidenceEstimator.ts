import { DiffMetadata } from '../scanners/DiffAnalyzer';

export interface ConfidenceFactors {
    commitSimilarity: number;        // -0.2 to +0.2
    patternRepetition: number;        // -0.2 to +0.2
    modificationSize: number;         // -0.1 to +0.1
    agePenalty: number;              // -0.05 to 0
}

/**
 * Estimate confidence for synthetic/reconstructed events
 */
export class ConfidenceEstimator {
    /**
     * Estimate confidence for a synthetic event
     */
    public estimate(
        metadata: DiffMetadata,
        patternOccurrences: number,
        monthsSinceEvent: number
    ): number {
        const factors = this.calculateFactors(metadata, patternOccurrences, monthsSinceEvent);
        
        // Base confidence starts at 0.5
        let confidenceDeficit = 0.5;
        
        // Similarity factor (if this pattern has been seen before)
        if (patternOccurrences > 0) {
            confidenceDeficit += factors.patternRepetition;
        } else {
            confidenceDeficit -= 0.1; // New patterns are less certain
        }
        
        // Modification size factor (larger changes are more reliable indicators)
        confidenceDeficit += factors.modificationSize;
        
        // Age penalty (older events are less reliable)
        confidenceDeficit += factors.agePenalty;
        
        // Normalize to 0.5-0.95 range
        return Math.max(0.5, Math.min(0.95, confidenceDeficit));
    }

    /**
     * Calculate individual confidence factors
     */
    private calculateFactors(
        metadata: DiffMetadata,
        patternOccurrences: number,
        monthsSinceEvent: number
    ): ConfidenceFactors {
        return {
            // Pattern repetition: more occurrences = higher confidence
            patternRepetition: patternOccurrences > 0 
                ? Math.min(0.2, patternOccurrences * 0.04)
                : 0,
            
            // Commit similarity: not calculated here (would require semantic analysis)
            commitSimilarity: 0,
            
            // Modification size: larger changes are more reliable signals
            modificationSize: this.calculateSizeFactor(metadata.totalLinesChanged, metadata.totalFiles),
            
            // Age penalty: -0.05 per 90 days
            agePenalty: Math.max(-0.05, -(monthsSinceEvent / 90) * 0.05)
        };
    }

    /**
     * Calculate size factor based on modifications
     */
    private calculateSizeFactor(linesChanged: number, filesChanged: number): number {
        // Larger modifications are more significant indicators
        if (filesChanged > 20 || linesChanged > 500) return 0.1;
        if (filesChanged > 10 || linesChanged > 200) return 0.05;
        if (filesChanged > 5 || linesChanged > 50) return 0.0;
        return -0.05; // Small changes are less reliable indicators
    }

    /**
     * Adjust confidence based on file categorization
     */
    public adjustForCategory(confidence: number, hasConfig: boolean, hasTests: boolean): number {
        let adjustment = 0;
        
        // Config changes are highly reliable indicators
        if (hasConfig) adjustment += 0.05;
        
        // Test changes indicate quality-focused changes
        if (hasTests) adjustment += 0.02;
        
        return Math.min(0.95, confidence + adjustment);
    }
}


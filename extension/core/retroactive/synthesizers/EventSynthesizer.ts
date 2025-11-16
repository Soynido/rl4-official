import { GitCommit } from '../scanners/GitHistoryScanner';
import { DiffAnalyzer, CommitCategory, DiffMetadata } from '../scanners/DiffAnalyzer';
import { ConfidenceEstimator } from '../utils/ConfidenceEstimator';
import { TemporalWeighter } from '../utils/TemporalWeighter';

export interface SyntheticEvent {
    id: string;
    timestamp: string;
    type: 'file_change' | 'decision_context' | 'config_update';
    source: string;
    metadata: {
        category: string;
        files?: number;
        lines_changed?: number;
        author: string;
        confidence: number;
        synthetic: boolean;
        commit_hash: string;
        reasoning: string;
    };
}

export class EventSynthesizer {
    private diffAnalyzer = new DiffAnalyzer();
    private confidenceEstimator = new ConfidenceEstimator();
    private temporalWeighter = new TemporalWeighter(0.02);

    /**
     * Generate synthetic events from Git commits
     */
    public synthesizeEvents(commits: GitCommit[]): SyntheticEvent[] {
        const events: SyntheticEvent[] = [];
        
        // Track pattern occurrences for confidence calculation
        const patternOccurrences = new Map<string, number>();

        for (const commit of commits) {
            // Skip if too old
            if (this.temporalWeighter.isTooOld(commit.timestamp, 24)) {
                continue;
            }

            // Analyze commit
            const category = this.diffAnalyzer.analyzeCommit(
                commit.message,
                commit.files,
                commit.insertions + commit.deletions
            );

            const metadata = this.diffAnalyzer.extractMetadata(
                commit.files,
                commit.insertions,
                commit.deletions
            );

            // Skip insignificant commits
            if (!this.diffAnalyzer.isSignificant(metadata)) {
                continue;
            }

            // Calculate confidence
            const patternKey = `${category.type}-${commit.files.length}`;
            const occurrences = patternOccurrences.get(patternKey) || 0;
            const monthsSinceEvent = this.calculateMonthsSince(commit.timestamp);
            
            let confidence = this.confidenceEstimator.estimate(metadata, occurrences, monthsSinceEvent);
            confidence = this.confidenceEstimator.adjustForCategory(
                confidence,
                metadata.categories.config.length > 0,
                metadata.categories.tests.length > 0
            );

            // Apply temporal weighting
            const weight = this.temporalWeighter.calculateWeight(commit.timestamp);
            confidence = this.temporalWeighter.adjustConfidence(confidence, weight);

            // Create synthetic event
            const event = this.createEvent(commit, category, metadata, confidence);
            events.push(event);

            // Update pattern occurrences
            patternOccurrences.set(patternKey, occurrences + 1);
        }

        return events;
    }

    /**
     * Create a synthetic event from a commit
     */
    private createEvent(
        commit: GitCommit,
        category: CommitCategory,
        metadata: DiffMetadata,
        confidence: number
    ): SyntheticEvent {
        return {
            id: `retro-${Date.now()}-${commit.hash.substring(0, 6)}`,
            timestamp: commit.timestamp,
            type: this.determineEventType(category.type),
            source: `git:${commit.hash}`,
            metadata: {
                category: category.type,
                files: metadata.totalFiles,
                lines_changed: metadata.totalLinesChanged,
                author: commit.author,
                confidence,
                synthetic: true,
                commit_hash: commit.hash,
                reasoning: category.reasoning
            }
        };
    }

    /**
     * Determine event type from commit category
     */
    private determineEventType(category: string): 'file_change' | 'decision_context' | 'config_update' {
        switch (category) {
            case 'config': return 'config_update';
            case 'feature':
            case 'refactor':
            case 'fix': return 'decision_context';
            default: return 'file_change';
        }
    }

    /**
     * Calculate months since event
     */
    private calculateMonthsSince(timestamp: string): number {
        const eventDate = new Date(timestamp);
        const now = new Date();
        return (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    }

    /**
     * Group events by date for storage
     */
    public groupEventsByDate(events: SyntheticEvent[]): Map<string, SyntheticEvent[]> {
        const groups = new Map<string, SyntheticEvent[]>();

        for (const event of events) {
            const date = new Date(event.timestamp);
            const dateKey = date.toISOString().split('T')[0];

            if (!groups.has(dateKey)) {
                groups.set(dateKey, []);
            }
            groups.get(dateKey)!.push(event);
        }

        return groups;
    }
}


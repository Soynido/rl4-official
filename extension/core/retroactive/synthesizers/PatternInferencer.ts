import { SyntheticEvent } from './EventSynthesizer';

export interface RetroactivePattern {
    id: string;
    pattern: string;
    frequency: number;
    confidence: number;
    firstSeen: string;
    lastSeen: string;
    evidenceIds: string[];
    category: 'structural' | 'contextual' | 'temporal';
    impact: string;
}

export class PatternInferencer {
    /**
     * Infer patterns from synthetic events
     */
    public inferPatterns(events: SyntheticEvent[]): RetroactivePattern[] {
        const patterns: RetroactivePattern[] = [];
        
        // Group events by category
        const eventsByCategory = this.groupByCategory(events);
        
        // Detect patterns within each category
        for (const [category, categoryEvents] of eventsByCategory.entries()) {
            const categoryPatterns = this.detectCategoryPatterns(category, categoryEvents);
            patterns.push(...categoryPatterns);
        }
        
        // Detect cross-category patterns
        const crossPatterns = this.detectCrossPatterns(events);
        patterns.push(...crossPatterns);
        
        return patterns;
    }

    /**
     * Group events by category
     */
    private groupByCategory(events: SyntheticEvent[]): Map<string, SyntheticEvent[]> {
        const groups = new Map<string, SyntheticEvent[]>();
        
        for (const event of events) {
            const category = event.metadata.category;
            if (!groups.has(category)) {
                groups.set(category, []);
            }
            groups.get(category)!.push(event);
        }
        
        return groups;
    }

    /**
     * Detect patterns within a category
     */
    private detectCategoryPatterns(category: string, events: SyntheticEvent[]): RetroactivePattern[] {
        if (events.length < 3) return [];
        
        const pattern = this.inferPatternFromCategory(category, events);
        
        if (!pattern) return [];
        
        return [pattern];
    }

    /**
     * Infer pattern from category and events
     */
    private inferPatternFromCategory(category: string, events: SyntheticEvent[]): RetroactivePattern | null {
        // Feature → Refactor pattern
        if (category === 'feature' && events.length > 3) {
            return {
                id: `pat-retro-feature-refactor-${Date.now()}`,
                pattern: 'Feature addition → Refactor cycle',
                frequency: events.length,
                confidence: 0.75,
                firstSeen: events[0].timestamp,
                lastSeen: events[events.length - 1].timestamp,
                evidenceIds: events.map(e => e.id),
                category: 'structural',
                impact: 'Maintainability'
            };
        }
        
        // Config → Fix pattern
        if (category === 'config' && events.length > 2) {
            return {
                id: `pat-retro-config-fix-${Date.now()}`,
                pattern: 'Configuration updates → Stability fixes',
                frequency: events.length,
                confidence: 0.78,
                firstSeen: events[0].timestamp,
                lastSeen: events[events.length - 1].timestamp,
                evidenceIds: events.map(e => e.id),
                category: 'contextual',
                impact: 'Stability'
            };
        }
        
        // Fix → Test pattern
        if (category === 'fix' && events.length > 2) {
            return {
                id: `pat-retro-fix-test-${Date.now()}`,
                pattern: 'Bug fixes → Test additions',
                frequency: events.length,
                confidence: 0.72,
                firstSeen: events[0].timestamp,
                lastSeen: events[events.length - 1].timestamp,
                evidenceIds: events.map(e => e.id),
                category: 'structural',
                impact: 'Quality'
            };
        }
        
        return null;
    }

    /**
     * Detect cross-category patterns (e.g., feature → fix → test)
     */
    private detectCrossPatterns(events: SyntheticEvent[]): RetroactivePattern[] {
        if (events.length < 5) return [];
        
        // Look for sequence: feature → fix → test
        const sequencePattern = this.detectFeatureFixTestSequence(events);
        
        if (sequencePattern) {
            return [sequencePattern];
        }
        
        return [];
    }

    /**
     * Detect feature → fix → test sequence pattern
     */
    private detectFeatureFixTestSequence(events: SyntheticEvent[]): RetroactivePattern | null {
        const sequences: SyntheticEvent[][] = [];
        
        for (let i = 0; i < events.length - 2; i++) {
            const event1 = events[i];
            const event2 = events[i + 1];
            const event3 = events[i + 2];
            
            if (
                (event1.metadata.category === 'feature' || event1.metadata.category === 'refactor') &&
                event2.metadata.category === 'fix' &&
                event3.metadata.category === 'test'
            ) {
                sequences.push([event1, event2, event3]);
            }
        }
        
        if (sequences.length >= 2) {
            const allEvents = sequences.flat();
            return {
                id: `pat-retro-feature-fix-test-${Date.now()}`,
                pattern: 'Feature/Refactor → Fix → Test cycle',
                frequency: sequences.length,
                confidence: 0.80,
                firstSeen: allEvents[0].timestamp,
                lastSeen: allEvents[allEvents.length - 1].timestamp,
                evidenceIds: allEvents.map(e => e.id),
                category: 'temporal',
                impact: 'Quality'
            };
        }
        
        return null;
    }
}


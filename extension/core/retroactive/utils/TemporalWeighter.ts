/**
 * Apply temporal decay to historical events
 * Older events have reduced weight based on exponential decay
 */
export class TemporalWeighter {
    private decayRate: number;

    constructor(decayRate: number = 0.02) {
        this.decayRate = decayRate;
    }

    /**
     * Calculate weight for an event based on its age
     * @param eventTimestamp ISO timestamp of the event
     * @param referenceTimestamp Current timestamp (defaults to now)
     */
    public calculateWeight(
        eventTimestamp: string,
        referenceTimestamp: string = new Date().toISOString()
    ): number {
        const eventDate = new Date(eventTimestamp);
        const referenceDate = new Date(referenceTimestamp);
        
        const monthsSinceEvent = (referenceDate.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        
        // Exponential decay: weight = exp(-decayRate * months)
        const weight = Math.exp(-this.decayRate * monthsSinceEvent);
        
        // Ensure minimum weight of 0.3 (events are never completely discounted)
        return Math.max(weight, 0.3);
    }

    /**
     * Calculate adjusted confidence for historical data
     */
    public adjustConfidence(baseConfidence: number, weight: number): number {
        // Adjusted confidence blends base confidence with temporal weight
        return (baseConfidence * 0.7) + (weight * 0.3);
    }

    /**
     * Determine if an event is too old to be useful
     */
    public isTooOld(timestamp: string, maxMonths: number = 24): boolean {
        const eventDate = new Date(timestamp);
        const now = new Date();
        const monthsSinceEvent = (now.getTime() - eventDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
        
        return monthsSinceEvent > maxMonths;
    }
}


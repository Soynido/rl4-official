import { EventEmitter } from 'events';
import { CaptureEvent } from './types';

export class EventAggregator extends EventEmitter {
    private events: CaptureEvent[] = [];
    private flushTimeout: NodeJS.Timeout | null = null;
    private readonly flushInterval = 2000; // 2 seconds

    constructor() {
        super();
    }

    // ✅ COPIÉ V2 - Capture d'événement avec debounce
    captureEvent(
        type: 'file_change' | 'git_commit' | 'git_branch' | 'pr_linked' | 'issue_linked',
        source: string,
        metadata: Record<string, any> = {}
    ): void {
        const event: CaptureEvent = {
            id: this.generateId(),
            timestamp: new Date().toISOString(),
            type,
            source,
            metadata
        };

        this.events.push(event);
        this.emit('eventCaptured', event);
        
        // Debounced flush
        this.scheduleFlush();
    }

    // ✅ COPIÉ V2 - Debounce avec setTimeout
    private scheduleFlush(): void {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
        }
        
        this.flushTimeout = setTimeout(() => {
            this.flushEvents();
        }, this.flushInterval);
    }

    // ✅ COPIÉ V2 - Flush des événements
    private flushEvents(): void {
        if (this.events.length > 0) {
            this.emit('eventsFlushed', [...this.events]);
            this.events = [];
        }
    }

    // ✅ COPIÉ V2 - Génération d'ID
    private generateId(): string {
        return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    }

    // ✅ NOUVEAU - Getter pour les événements
    getEvents(): CaptureEvent[] {
        return [...this.events];
    }

    // ✅ NOUVEAU - Clear events
    clearEvents(): void {
        this.events = [];
    }

    dispose(): void {
        if (this.flushTimeout) {
            clearTimeout(this.flushTimeout);
        }
        this.removeAllListeners();
    }
}

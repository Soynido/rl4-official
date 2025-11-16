import { CaptureEvent, Evidence } from './types';

/**
 * EvidenceMapper
 * 
 * Couche de transformation qui convertit les CaptureEvent en Evidence
 * pour le moteur RBOM.
 * 
 * L'Evidence est l'interface standardisée entre la couche Capture (Layer 1)
 * et la couche RBOM (Layer 2).
 */
export class EvidenceMapper {
    /**
     * Convertit un CaptureEvent en Evidence
     */
    public toEvidence(event: CaptureEvent): Evidence {
        // Mapping intelligent selon le type d'événement
        switch (event.type) {
            case 'git_commit':
                return this.mapGitCommit(event);
            
            case 'file_change':
                return this.mapFileChange(event);
            
            case 'git_branch':
                return this.mapGitBranch(event);
            
            case 'dependencies':
                return this.mapDependencies(event);
            
            case 'config':
                return this.mapConfig(event);
            
            case 'test':
                return this.mapTest(event);
            
            default:
                return this.mapDefault(event);
        }
    }

    /**
     * Convertit plusieurs CaptureEvents en Evidences
     */
    public toEvidences(events: CaptureEvent[]): Evidence[] {
        return events.map(event => this.toEvidence(event));
    }

    // ═══════════════════════════════════════════════════════════════
    // Mappings spécifiques par type
    // ═══════════════════════════════════════════════════════════════

    private mapGitCommit(event: CaptureEvent): Evidence {
        return {
            id: event.id,
            type: 'commit',
            source: event.source,
            timestamp: event.timestamp,
            metadata: {
                ...event.metadata,
                _mapped: true,
                _category: 'git-metadata'
            },
            version: '1.0'
        };
    }

    private mapFileChange(event: CaptureEvent): Evidence {
        return {
            id: event.id,
            type: 'file_change',
            source: event.source,
            timestamp: event.timestamp,
            metadata: {
                ...event.metadata,
                _mapped: true,
                _category: 'file-changes'
            },
            version: '1.0'
        };
    }

    private mapGitBranch(event: CaptureEvent): Evidence {
        return {
            id: event.id,
            type: 'git_branch',
            source: event.source,
            timestamp: event.timestamp,
            metadata: {
                ...event.metadata,
                _mapped: true,
                _category: 'git-metadata'
            },
            version: '1.0'
        };
    }

    private mapDependencies(event: CaptureEvent): Evidence {
        return {
            id: event.id,
            type: 'dependency',
            source: event.source,
            timestamp: event.timestamp,
            metadata: {
                ...event.metadata,
                _mapped: true,
                _category: 'sbom'
            },
            version: '1.0'
        };
    }

    private mapConfig(event: CaptureEvent): Evidence {
        return {
            id: event.id,
            type: 'config',
            source: event.source,
            timestamp: event.timestamp,
            metadata: {
                ...event.metadata,
                _mapped: true,
                _category: 'configuration'
            },
            version: '1.0'
        };
    }

    private mapTest(event: CaptureEvent): Evidence {
        return {
            id: event.id,
            type: 'test',
            source: event.source,
            timestamp: event.timestamp,
            metadata: {
                ...event.metadata,
                _mapped: true,
                _category: 'test-reports'
            },
            version: '1.0'
        };
    }

    private mapDefault(event: CaptureEvent): Evidence {
        return {
            id: event.id,
            type: 'file_change',
            source: event.source,
            timestamp: event.timestamp,
            metadata: {
                ...event.metadata,
                _mapped: true,
                _category: 'unknown'
            },
            version: '1.0'
        };
    }
}

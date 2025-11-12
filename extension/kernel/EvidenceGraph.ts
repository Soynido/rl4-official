/**
 * EvidenceGraph - Inverted Index: Trace → Artifacts
 * 
 * Fast lookup: which ADRs/patterns/forecasts reference this trace?
 * 
 * RL4 Kernel Component #9
 */

export interface Evidence {
    id: string;
    type: 'trace' | 'pr' | 'issue' | 'commit';
    source: string;
}

export interface Artifact {
    id: string;
    type: 'adr' | 'pattern' | 'forecast';
}

export class EvidenceGraph {
    // Inverted index: evidence ID -> artifact IDs
    private index: Map<string, Set<string>> = new Map();
    
    /**
     * Link evidence to artifact
     */
    link(evidenceId: string, artifactId: string): void {
        if (!this.index.has(evidenceId)) {
            this.index.set(evidenceId, new Set());
        }
        
        this.index.get(evidenceId)!.add(artifactId);
    }
    
    /**
     * Get all artifacts linked to evidence
     */
    getArtifacts(evidenceId: string): string[] {
        return Array.from(this.index.get(evidenceId) || []);
    }
    
    /**
     * Get all evidence for artifact
     */
    getEvidence(artifactId: string): string[] {
        const evidence: string[] = [];
        
        for (const [evidenceId, artifacts] of this.index.entries()) {
            if (artifacts.has(artifactId)) {
                evidence.push(evidenceId);
            }
        }
        
        return evidence;
    }
    
    /**
     * Get graph size
     */
    getSize(): { evidence: number; artifacts: number; links: number } {
        let linkCount = 0;
        const artifacts = new Set<string>();
        
        for (const artifactSet of this.index.values()) {
            linkCount += artifactSet.size;
            artifactSet.forEach(a => artifacts.add(a));
        }
        
        return {
            evidence: this.index.size,
            artifacts: artifacts.size,
            links: linkCount
        };
    }
}


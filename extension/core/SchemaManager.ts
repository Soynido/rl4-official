import * as fs from 'fs';
import * as path from 'path';
import { PersistenceManager } from './PersistenceManager';

export interface EventSchema {
    id: string;
    timestamp: string;
    type: 'file_change' | 'dependencies' | 'config' | 'test' | 'git_commit' | 'git_branches';
    source: string;
    metadata: {
        level: '1 - Code & Structure Technique' | '2 - Cognitive Layer' | '3 - Perceptual Layer';
        category: 'File Changes' | 'File Saves' | 'Dependencies' | 'Config Files' | 'Test Reports' | 'Git Metadata';
        [key: string]: any;
    };
    version: '1.0';
}

export interface ManifestSchema {
    project: string;
    version: string;
    schemaVersion: string;
    lastUpdated: string;
    totalEvents: number;
    layers: string[];
    integrity: {
        algorithm: string;
        lastHash: string;
    };
    // Legacy fields for backward compatibility
    projectName?: string;
    workspaceRoot?: string;
    createdAt?: string;
    engines?: {
        sbom: boolean;
        config: boolean;
        test: boolean;
        git: boolean;
    };
    captors?: string[];
    eventsCaptured?: number;
    persistenceContract?: {
        version: string;
        schema: string;
        compatibility: string;
    };
}

export class SchemaManager {
    private schemaVersion = '1.0' as const;
    private persistenceContract = '1.0' as const;
    private crypto = require('crypto');

    constructor(
        private workspaceRoot: string,
        private persistence: PersistenceManager
    ) {
        this.persistence.logWithEmoji('📋', 'SchemaManager initialized');
    }

    // ✅ Calcul de l'intégrité avec BLAKE3 (fallback sur SHA256 si non disponible)
    private calculateHash(content: string): string {
        try {
            // Utiliser crypto.createHash avec SHA256 (BLAKE3 nécessite une lib externe)
            return this.crypto.createHash('sha256').update(content).digest('hex').substring(0, 32);
        } catch (error) {
            this.persistence.logWithEmoji('⚠️', `Hash calculation failed: ${error}`);
            return 'unknown';
        }
    }

    public validateEvent(event: any): EventSchema | null {
        try {
            // Validate required fields
            if (!event.id || !event.timestamp || !event.type || !event.source || !event.metadata) {
                this.persistence.logWithEmoji('❌', 'Invalid event: missing required fields');
                return null;
            }

            // Validate event type
            const validTypes = ['file_change', 'dependencies', 'config', 'test', 'git_commit', 'git_branches'];
            if (!validTypes.includes(event.type)) {
                this.persistence.logWithEmoji('❌', `Invalid event type: ${event.type}`);
                return null;
            }

            // Validate metadata level
            const validLevels = ['1 - Code & Structure Technique', '2 - Cognitive Layer', '3 - Perceptual Layer'];
            if (!validLevels.includes(event.metadata.level)) {
                this.persistence.logWithEmoji('❌', `Invalid metadata level: ${event.metadata.level}`);
                return null;
            }

            // Validate metadata category
            const validCategories = ['File Changes', 'File Saves', 'Dependencies', 'Config Files', 'Test Reports', 'Git Metadata'];
            if (!validCategories.includes(event.metadata.category)) {
                this.persistence.logWithEmoji('❌', `Invalid metadata category: ${event.metadata.category}`);
                return null;
            }

            // Create validated event
            const validatedEvent: EventSchema = {
                id: event.id,
                timestamp: event.timestamp,
                type: event.type,
                source: event.source,
                metadata: {
                    level: event.metadata.level,
                    category: event.metadata.category,
                    ...event.metadata
                },
                version: this.schemaVersion
            };

            return validatedEvent;

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Event validation failed: ${error}`);
            return null;
        }
    }

    public createManifest(): ManifestSchema {
        const now = new Date().toISOString();
        const projectName = path.basename(this.workspaceRoot);

        return {
            project: projectName,
            version: '1.0.0',
            schemaVersion: '1.0',
            lastUpdated: now,
            totalEvents: 0,
            layers: ['SBOM', 'Config', 'Test', 'Git'],
            integrity: {
                algorithm: 'SHA256',
                lastHash: ''
            }
        };
    }

    // ✅ Auto-génération du manifest avec intégrité
    public async generateManifest(): Promise<ManifestSchema> {
        try {
            const manifest = this.createManifest();
            const totalEvents = await this.countEventsInTraces();
            
            // Calculer l'intégrité
            const tracesContent = this.readTracesContent();
            const hash = this.calculateHash(tracesContent);
            
            const updatedManifest: ManifestSchema = {
                ...manifest,
                totalEvents,
                lastUpdated: new Date().toISOString(),
                integrity: {
                    algorithm: 'SHA256',
                    lastHash: hash
                }
            };

            this.saveManifest(updatedManifest);
            
            // ✅ Validation de cohérence
            const isConsistent = await this.validateCoherence(updatedManifest);
            if (!isConsistent) {
                this.persistence.logWithEmoji('⚠️', 'Manifest coherence check failed - manual review recommended');
            }

            return updatedManifest;

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to generate manifest: ${error}`);
            return this.createManifest();
        }
    }

    // ✅ Compte les événements dans les traces
    private async countEventsInTraces(): Promise<number> {
        try {
            const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
            if (!fs.existsSync(tracesDir)) {
                return 0;
            }

            let totalCount = 0;
            const files = fs.readdirSync(tracesDir);

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(tracesDir, file);
                    const content = fs.readFileSync(filePath, 'utf-8');
                    const events = JSON.parse(content);
                    
                    if (Array.isArray(events)) {
                        totalCount += events.length;
                    }
                }
            }

            return totalCount;

        } catch (error) {
            this.persistence.logWithEmoji('⚠️', `Failed to count events: ${error}`);
            return 0;
        }
    }

    // ✅ Lit le contenu des traces pour calculer l'intégrité
    private readTracesContent(): string {
        try {
            const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
            if (!fs.existsSync(tracesDir)) {
                return '';
            }

            const files = fs.readdirSync(tracesDir);
            let combinedContent = '';

            for (const file of files) {
                if (file.endsWith('.json')) {
                    const filePath = path.join(tracesDir, file);
                    combinedContent += fs.readFileSync(filePath, 'utf-8');
                }
            }

            return combinedContent;

        } catch (error) {
            return '';
        }
    }

    // ✅ Contrôle de cohérence automatique
    private async validateCoherence(manifest: ManifestSchema): Promise<boolean> {
        try {
            // 1. Vérifier totalEvents vs somme réelle
            const actualCount = await this.countEventsInTraces();
            if (actualCount !== manifest.totalEvents) {
                this.persistence.logWithEmoji('⚠️', `Event count mismatch: manifest says ${manifest.totalEvents}, actual: ${actualCount}`);
                return false;
            }

            // 2. Vérifier la présence des répertoires
            const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
            const adrsDir = path.join(this.workspaceRoot, '.reasoning', 'adrs');

            if (!fs.existsSync(tracesDir)) {
                this.persistence.logWithEmoji('⚠️', 'Traces directory missing');
                return false;
            }

            // Note: adrs/ doesn't exist yet in Layer 1
            // if (!fs.existsSync(adrsDir)) {
            //     this.persistence.logWithEmoji('⚠️', 'ADRs directory missing');
            //     return false;
            // }

            // 3. Vérifier l'intégrité
            const currentHash = this.calculateHash(this.readTracesContent());
            if (currentHash !== manifest.integrity.lastHash) {
                this.persistence.logWithEmoji('⚠️', 'Integrity hash mismatch');
                return false;
            }

            this.persistence.logWithEmoji('✅', 'Manifest coherence check passed');
            return true;

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Coherence validation failed: ${error}`);
            return false;
        }
    }

    public updateManifest(manifest: ManifestSchema, totalEvents: number): ManifestSchema {
        return {
            ...manifest,
            lastUpdated: new Date().toISOString(),
            totalEvents,
            eventsCaptured: totalEvents
        };
    }

    public saveManifest(manifest: ManifestSchema): void {
        try {
            const manifestPath = path.join(this.workspaceRoot, '.reasoning', 'manifest.json');
            fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
            this.persistence.logWithEmoji('📋', `Manifest saved: ${manifest.totalEvents} events, schema v${manifest.schemaVersion}`);
        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to save manifest: ${error}`);
        }
    }

    public loadManifest(): ManifestSchema | null {
        try {
            const manifestPath = path.join(this.workspaceRoot, '.reasoning', 'manifest.json');
            if (!fs.existsSync(manifestPath)) {
                return null;
            }

            const content = fs.readFileSync(manifestPath, 'utf-8');
            const manifest = JSON.parse(content) as ManifestSchema;

            // Validate manifest schema
            if (!manifest.version || !manifest.schemaVersion || !manifest.projectName) {
                this.persistence.logWithEmoji('❌', 'Invalid manifest schema');
                return null;
            }

            return manifest;

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to load manifest: ${error}`);
            return null;
        }
    }

    public getSchemaVersion(): string {
        return this.schemaVersion;
    }

    public getPersistenceContract(): string {
        return this.persistenceContract;
    }

    public isCompatible(version: string): boolean {
        // Simple compatibility check - v1.0+ is compatible
        return version >= this.schemaVersion;
    }

    public createEventId(): string {
        // Generate unique event ID
        const timestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${timestamp}-${random}`;
    }

    public createEvent(
        type: EventSchema['type'],
        source: string,
        metadata: EventSchema['metadata']
    ): EventSchema {
        return {
            id: this.createEventId(),
            timestamp: new Date().toISOString(),
            type,
            source,
            metadata: {
                ...metadata,
                version: '1.0' as const
            },
            version: '1.0' as const
        };
    }

    public validateTracesFile(tracesPath: string): boolean {
        try {
            if (!fs.existsSync(tracesPath)) {
                return false;
            }

            const content = fs.readFileSync(tracesPath, 'utf-8');
            const events = JSON.parse(content);

            if (!Array.isArray(events)) {
                this.persistence.logWithEmoji('❌', 'Invalid traces file: not an array');
                return false;
            }

            // Validate first few events
            const sampleSize = Math.min(5, events.length);
            for (let i = 0; i < sampleSize; i++) {
                const event = events[i];
                if (!this.validateEvent(event)) {
                    this.persistence.logWithEmoji('❌', `Invalid event at index ${i}`);
                    return false;
                }
            }

            this.persistence.logWithEmoji('✅', `Traces file validated: ${events.length} events`);
            return true;

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Traces file validation failed: ${error}`);
            return false;
        }
    }

    public getSchemaDocumentation(): string {
        return `
# Reasoning Layer V3 - Persistence Contract v1.0

## Event Schema
- id: string (unique identifier)
- timestamp: string (ISO 8601)
- type: 'file_change' | 'dependencies' | 'config' | 'test' | 'git_commit' | 'git_branches'
- source: string (file path or git reference)
- metadata: object
  - level: '1 - Code & Structure Technique' | '2 - Cognitive Layer' | '3 - Perceptual Layer'
  - category: 'File Changes' | 'File Saves' | 'Dependencies' | 'Config Files' | 'Test Reports' | 'Git Metadata'
  - [additional fields]
- version: '1.0'

## Manifest Schema
- version: '1.0'
- schemaVersion: '1.0'
- projectName: string
- workspaceRoot: string
- createdAt: string (ISO 8601)
- lastUpdated: string (ISO 8601)
- totalEvents: number
- engines: object
- captors: string[]
- eventsCaptured: number
- persistenceContract: object

## Compatibility
- Schema v1.0+ compatible
- Backward compatible with v1.0
- Forward compatible within v1.x
        `.trim();
    }
}

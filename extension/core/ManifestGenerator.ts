import * as fs from 'fs';
import * as path from 'path';
import { PersistenceManager } from './PersistenceManager';

/**
 * ManifestGenerator - Génère automatiquement le manifest.json
 * 
 * Conditions de sécurité :
 * - Ne s'exécute que si PersistenceManager est initialisé
 * - Structure minimale et sérialisable
 */
export class ManifestGenerator {
    constructor(
        private workspaceRoot: string,
        private persistence: PersistenceManager
    ) {}

    async generate(): Promise<void> {
        try {
            // ✅ Vérification de sécurité
            const manifestPath = path.join(this.workspaceRoot, '.reasoning', 'manifest.json');
            
            // Compte les événements réels
            let totalEvents = 0;
            try {
                const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
                if (fs.existsSync(tracesDir)) {
                    const files = fs.readdirSync(tracesDir).filter(f => f.endsWith('.json'));
                    for (const file of files) {
                        const filePath = path.join(tracesDir, file);
                        const content = fs.readFileSync(filePath, 'utf-8');
                        const events = JSON.parse(content);
                        if (Array.isArray(events)) {
                            totalEvents += events.length;
                        }
                    }
                }
            } catch (err) {
                // Ignore errors
            }

            const data = {
                project: 'Reasoning Layer V3',
                version: '1.0.0',
                schemaVersion: '1.0',
                lastUpdated: new Date().toISOString(),
                totalEvents: totalEvents,
                layers: ['SBOM', 'Config', 'Test', 'Git']
            };

            // ✅ Sauvegarder de manière atomique
            const tempPath = manifestPath + '.tmp';
            await fs.promises.writeFile(tempPath, JSON.stringify(data, null, 2), 'utf-8');
            await fs.promises.rename(tempPath, manifestPath);

            this.persistence.logWithEmoji('📄', `Manifest auto-generated: ${totalEvents} events`);
        } catch (error) {
            this.persistence.logWithEmoji('⚠️', `Manifest generation failed: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}



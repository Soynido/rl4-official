import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { CaptureEvent, ProjectManifest, SerializableData } from './types';
import { UnifiedLogger } from './UnifiedLogger';
import { AppendOnlyWriter } from '../kernel/AppendOnlyWriter';

export class PersistenceManager {
    private workspaceRoot: string;
    private logger: UnifiedLogger;
    private autoSaveInterval: NodeJS.Timeout | null = null;
    private manifest!: ProjectManifest;
    private tracesPath!: string;
    private appendWriter: AppendOnlyWriter | null = null;
    private useAppendOnly: boolean = false;

    constructor(workspaceRoot?: string, useAppendOnly: boolean = false) {
        // ⊘ ROBUST: Use fallback if workspaceRoot undefined (following user's recommendation)
        if (!workspaceRoot) {
            const fallback = process.cwd();
            console.warn(`⚠️ PersistenceManager: workspaceRoot is undefined. Using fallback: ${fallback}`);
            this.workspaceRoot = fallback;
        } else {
            this.workspaceRoot = workspaceRoot;
        }
        this.logger = UnifiedLogger.getInstance();
        this.useAppendOnly = useAppendOnly;
        this.initialize();
    }

    private initialize(): void {
        const reasoningDir = path.join(this.workspaceRoot, '.reasoning');
        const tracesDir = path.join(reasoningDir, 'traces');
        const manifestFile = path.join(reasoningDir, 'manifest.json');
        
        // Initialize tracesPath
        this.tracesPath = path.join(tracesDir, `${new Date().toISOString().split('T')[0]}.json`);

        // Create structure
        if (!fs.existsSync(reasoningDir)) {
            fs.mkdirSync(reasoningDir, { recursive: true });
            this.logWithEmoji('📁', `Created .reasoning directory: ${reasoningDir}`);
        }
        if (!fs.existsSync(tracesDir)) {
            fs.mkdirSync(tracesDir, { recursive: true });
            this.logWithEmoji('📁', `Created traces directory: ${tracesDir}`);
        }

        // Charger ou créer manifest
        if (fs.existsSync(manifestFile)) {
            this.manifest = JSON.parse(fs.readFileSync(manifestFile, 'utf-8'));
        } else {
            this.manifest = {
                version: '1.0',
                projectName: path.basename(this.workspaceRoot),
                createdAt: new Date().toISOString(),
                lastCaptureAt: new Date().toISOString(),
                totalEvents: 0
            };
            fs.writeFileSync(manifestFile, JSON.stringify(this.manifest, null, 2));
        }

        // Auto-save every 30 seconds
        this.autoSaveInterval = setInterval(() => {
            this.saveManifest();
            this.logWithEmoji('💾', 'Auto-save completed');
        }, 30000);

        // Detailed logs like V2
        this.logger.log('🔄 === REASONING LAYER V3 INITIALIZATION ===');
        const createdDate = new Date(this.manifest.createdAt);
        // Display in correct local time
        this.logger.log(`📅 Created: ${createdDate.toLocaleString('en-US')} (Local)`);
        this.logger.log(`📊 Project: ${this.manifest.projectName}`);
        this.logger.log(`📊 Total Events: ${this.manifest.totalEvents}`);
        this.logger.log(`📊 Version: ${this.manifest.version}`);
        this.logger.log(`📁 Workspace: ${this.workspaceRoot}`);
        this.logger.log('✅ === PERSISTENCE MANAGER READY ===');
        
        // Initialize AppendOnlyWriter if enabled (RL4 mode)
        if (this.useAppendOnly) {
            const tracesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'events.jsonl');
            const tracesDir = path.dirname(tracesPath);
            if (!fs.existsSync(tracesDir)) {
                fs.mkdirSync(tracesDir, { recursive: true });
            }
            this.appendWriter = new AppendOnlyWriter(tracesPath, 50 * 1024 * 1024); // 50MB rotation
            this.logWithEmoji('✅', 'PersistenceManager initialized (RL4 mode: append-only JSONL)');
        } else {
            this.logWithEmoji('✅', 'PersistenceManager initialized (RL3 mode: array JSON)');
        }
    }

    // Copied from V2 - Logging with emojis
    public logWithEmoji(emoji: string, message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `${emoji} [${timestamp}] ${message}`;
        this.logger.log(logMessage);
    }

    public show(): void {
        this.logger.show();
    }
    
    public appendLine(message: string): void {
        this.logger.log(message);
    }

    // NEW - Rotation by date (RL4: append-only JSONL, RL3: array JSON)
    public async saveEvent(event: CaptureEvent): Promise<void> {
        // RL4 Mode: Append-only JSONL (O(1))
        if (this.useAppendOnly && this.appendWriter) {
            await this.appendWriter.append(event);
            
            this.manifest.totalEvents++;
            this.manifest.lastCaptureAt = new Date().toISOString();
            
            this.logWithEmoji('💾', `Event saved (RL4): ${event.type} - ${event.source}`);
            return;
        }
        
        // RL3 Legacy Mode: Array rewrite (O(n))
        const dateKey = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
        const tracesDir = path.join(this.workspaceRoot, '.reasoning', 'traces');
        const traceFile = path.join(tracesDir, `${dateKey}.json`);

        let events: CaptureEvent[] = [];
        if (fs.existsSync(traceFile)) {
            events = JSON.parse(fs.readFileSync(traceFile, 'utf-8'));
        }

        events.push(event);
        fs.writeFileSync(traceFile, JSON.stringify(events, null, 2));

        this.manifest.totalEvents++;
        this.manifest.lastCaptureAt = new Date().toISOString();

        this.logWithEmoji('💾', `Event saved (RL3): ${event.type} - ${event.source}`);
    }

    public loadEvents(date?: string): CaptureEvent[] {
        const dateKey = date || new Date().toISOString().split('T')[0];
        const traceFile = path.join(this.workspaceRoot, '.reasoning', 'traces', `${dateKey}.json`);

        if (fs.existsSync(traceFile)) {
            return JSON.parse(fs.readFileSync(traceFile, 'utf-8'));
        }
        return [];
    }

    // CRITICAL - Explicit serialization
    public getSerializable(): SerializableData {
        return JSON.parse(JSON.stringify({
            events: this.loadEvents(),
            manifest: this.manifest
        }, (key, value) => {
            if (typeof value === 'function') return undefined;
            if (value instanceof Map) return { $type: 'Map', entries: Array.from(value.entries()) };
            if (value instanceof Set) return { $type: 'Set', values: Array.from(value.values()) };
            if (value instanceof Date) return { $type: 'Date', value: value.toISOString() };
            return value;
        }));
    }

    private saveManifest(): void {
        const manifestFile = path.join(this.workspaceRoot, '.reasoning', 'manifest.json');
        fs.writeFileSync(manifestFile, JSON.stringify(this.manifest, null, 2));
    }

    public getTracesPath(): string {
        return this.tracesPath;
    }

    public getWorkspaceRoot(): string {
        return this.workspaceRoot;
    }

    public dispose(): void {
        if (this.autoSaveInterval) {
            clearInterval(this.autoSaveInterval);
        }
        this.saveManifest();
    }
}

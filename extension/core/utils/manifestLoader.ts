import * as fs from 'fs';
import * as path from 'path';

/**
 * Utility function to safely load manifest.json
 * Supports both camelCase (totalEvents) and snake_case (total_events) formats
 * Always uses absolute paths based on workspaceRoot
 */
export interface ManifestData {
    totalEvents: number;
    version?: string;
    projectName?: string;
    createdAt?: string;
    lastCaptureAt?: string;
    [key: string]: any;
}

export function loadManifest(workspaceRoot: string): ManifestData {
    try {
        const manifestPath = path.join(workspaceRoot, '.reasoning', 'manifest.json');
        
        if (!fs.existsSync(manifestPath)) {
            console.warn('⚠️ Manifest file not found:', manifestPath);
            return { totalEvents: 0 };
        }

        const data = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
        
        // Support both camelCase and snake_case formats
        const totalEvents = data.totalEvents || data.total_events || 0;

        return {
            totalEvents,
            version: data.version,
            projectName: data.projectName || data.project_name,
            createdAt: data.createdAt || data.created_at,
            lastCaptureAt: data.lastCaptureAt || data.last_capture_at,
            ...data // Keep all other fields
        };
    } catch (err) {
        console.error('❌ Failed to load manifest:', err);
        return { totalEvents: 0 };
    }
}


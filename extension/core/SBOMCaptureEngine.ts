import * as fs from 'fs';
import * as path from 'path';
import { PersistenceManager } from './PersistenceManager';
import { EventAggregator } from './EventAggregator';
import { DependencyInfo } from './types';

export class SBOMCaptureEngine {
    private lastPackageLockHash: string | null = null;
    private lastYarnLockHash: string | null = null;
    private lastRequirementsHash: string | null = null;
    private watchers: NodeJS.Timeout[] = [];
    private lastCapture: number = 0; // Timestamp to avoid redundancy

    constructor(
        private workspaceRoot: string,
        private persistence: PersistenceManager,
        private eventAggregator: EventAggregator
    ) {
        this.persistence.logWithEmoji('📦', 'SBOMCaptureEngine initialized');
    }

    public start(): void {
        this.startPackageLockWatcher();
        this.startYarnLockWatcher();
        this.startRequirementsWatcher();
        this.startCargoWatcher();
        
        // Initial capture
        this.captureAllDependencies();
        
        this.persistence.logWithEmoji('🚀', 'SBOMCaptureEngine started');
    }

    // Priority 1: package-lock.json
    private startPackageLockWatcher(): void {
        const packageLockPath = path.join(this.workspaceRoot, 'package-lock.json');
        
        if (!fs.existsSync(packageLockPath)) {
            this.persistence.logWithEmoji('⚠️', 'No package-lock.json found');
            return;
        }

        const watcher = setInterval(() => {
            try {
                // Avoid redundancy - capture at most every 3 seconds
                if (Date.now() - this.lastCapture < 3000) {
                    return;
                }
                
                const content = fs.readFileSync(packageLockPath, 'utf-8');
                const hash = this.generateHash(content);
                
                if (hash !== this.lastPackageLockHash) {
                    this.capturePackageLockDependencies(packageLockPath);
                    this.lastPackageLockHash = hash;
                    this.lastCapture = Date.now();
                }
            } catch (error) {
                this.persistence.logWithEmoji('❌', `Failed to watch package-lock.json: ${error}`);
            }
        }, 5000); // Check every 5 seconds

        this.watchers.push(watcher);
        this.persistence.logWithEmoji('📦', 'package-lock.json watcher started');
    }

    private startYarnLockWatcher(): void {
        const yarnLockPath = path.join(this.workspaceRoot, 'yarn.lock');
        
        if (!fs.existsSync(yarnLockPath)) {
            return; // Silent - yarn.lock is optional
        }

        const watcher = setInterval(() => {
            try {
                const content = fs.readFileSync(yarnLockPath, 'utf-8');
                const hash = this.generateHash(content);
                
                if (hash !== this.lastYarnLockHash) {
                    this.captureYarnLockDependencies(yarnLockPath);
                    this.lastYarnLockHash = hash;
                }
            } catch (error) {
                this.persistence.logWithEmoji('❌', `Failed to watch yarn.lock: ${error}`);
            }
        }, 5000);

        this.watchers.push(watcher);
        this.persistence.logWithEmoji('📦', 'yarn.lock watcher started');
    }

    private startRequirementsWatcher(): void {
        const requirementsPath = path.join(this.workspaceRoot, 'requirements.txt');
        
        if (!fs.existsSync(requirementsPath)) {
            return; // Silent - requirements.txt is optional
        }

        const watcher = setInterval(() => {
            try {
                const content = fs.readFileSync(requirementsPath, 'utf-8');
                const hash = this.generateHash(content);
                
                if (hash !== this.lastRequirementsHash) {
                    this.captureRequirementsDependencies(requirementsPath);
                    this.lastRequirementsHash = hash;
                }
            } catch (error) {
                this.persistence.logWithEmoji('❌', `Failed to watch requirements.txt: ${error}`);
            }
        }, 5000);

        this.watchers.push(watcher);
        this.persistence.logWithEmoji('📦', 'requirements.txt watcher started');
    }

    private startCargoWatcher(): void {
        const cargoPath = path.join(this.workspaceRoot, 'Cargo.toml');
        
        if (!fs.existsSync(cargoPath)) {
            return; // Silent - Cargo.toml is optional
        }

        // For Cargo.toml, we'll capture on file changes rather than polling
        // This will be handled by the VS Code watchers
    }

    private capturePackageLockDependencies(packageLockPath: string): void {
        try {
            const content = fs.readFileSync(packageLockPath, 'utf-8');
            const packageLock = JSON.parse(content);
            
            const dependencies: DependencyInfo[] = [];
            
            // Support package-lock.json v1/v2 (dependencies) and v3+ (packages)
            if (packageLock.dependencies) {
                // Legacy format (v1/v2)
                for (const [name, dep] of Object.entries(packageLock.dependencies)) {
                    const depInfo = dep as any;
                    dependencies.push({
                        name,
                        version: depInfo.version || 'unknown',
                        license: depInfo.license,
                        hash: depInfo.integrity || depInfo.resolved,
                        source: 'package-lock.json'
                    });
                }
            } else if (packageLock.packages) {
                // Modern format (v3+) - dependencies are in packages[""].dependencies
                const rootPackage = packageLock.packages[''] as any;
                this.persistence.logWithEmoji('🔍', `Root package found: ${!!rootPackage}`);
                
                if (rootPackage && rootPackage.dependencies) {
                    this.persistence.logWithEmoji('🔍', `Dependencies found: ${Object.keys(rootPackage.dependencies).length}`);
                    for (const [name, version] of Object.entries(rootPackage.dependencies)) {
                        dependencies.push({
                            name,
                            version: version as string,
                            source: 'package-lock.json'
                        });
                    }
                }
                
                // Also capture devDependencies
                if (rootPackage && rootPackage.devDependencies) {
                    this.persistence.logWithEmoji('🔍', `DevDependencies found: ${Object.keys(rootPackage.devDependencies).length}`);
                    for (const [name, version] of Object.entries(rootPackage.devDependencies)) {
                        dependencies.push({
                            name,
                            version: version as string,
                            source: 'package-lock.json',
                            dev: true
                        });
                    }
                }
            }

            this.eventAggregator.captureEvent(
                'file_change',
                packageLockPath,
                {
                    type: 'dependencies',
                    dependencies,
                    level: '1 - Code & Structure Technique',
                    category: 'Dependencies',
                    totalDependencies: dependencies.length
                }
            );

            this.persistence.logWithEmoji('📦', `Captured ${dependencies.length} dependencies from package-lock.json`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse package-lock.json: ${error}`);
        }
    }

    private captureYarnLockDependencies(yarnLockPath: string): void {
        try {
            const content = fs.readFileSync(yarnLockPath, 'utf-8');
            
            // Simple parsing of yarn.lock (basic implementation)
            const dependencies: DependencyInfo[] = [];
            const lines = content.split('\n');
            
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                if (line && !line.startsWith('#') && !line.startsWith('__metadata')) {
                    const match = line.match(/^"([^@]+)@([^"]+)":$/);
                    if (match) {
                        const name = match[1];
                        const version = match[2];
                        
                        dependencies.push({
                            name,
                            version,
                            source: 'yarn.lock'
                        });
                    }
                }
            }

            this.eventAggregator.captureEvent(
                'file_change',
                yarnLockPath,
                {
                    type: 'dependencies',
                    dependencies,
                    level: '1 - Code & Structure Technique',
                    category: 'Dependencies',
                    totalDependencies: dependencies.length
                }
            );

            this.persistence.logWithEmoji('📦', `Captured ${dependencies.length} dependencies from yarn.lock`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse yarn.lock: ${error}`);
        }
    }

    private captureRequirementsDependencies(requirementsPath: string): void {
        try {
            const content = fs.readFileSync(requirementsPath, 'utf-8');
            
            const dependencies: DependencyInfo[] = [];
            const lines = content.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const match = trimmed.match(/^([a-zA-Z0-9_-]+)([>=<]+)?([0-9.]+)?/);
                    if (match) {
                        dependencies.push({
                            name: match[1],
                            version: match[3] || 'latest',
                            source: 'requirements.txt'
                        });
                    }
                }
            }

            this.eventAggregator.captureEvent(
                'file_change',
                requirementsPath,
                {
                    type: 'dependencies',
                    dependencies,
                    level: '1 - Code & Structure Technique',
                    category: 'Dependencies',
                    totalDependencies: dependencies.length
                }
            );

            this.persistence.logWithEmoji('📦', `Captured ${dependencies.length} dependencies from requirements.txt`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse requirements.txt: ${error}`);
        }
    }

    private captureAllDependencies(): void {
        // Capture all existing dependency files
        const packageLockPath = path.join(this.workspaceRoot, 'package-lock.json');
        if (fs.existsSync(packageLockPath)) {
            this.capturePackageLockDependencies(packageLockPath);
        }

        const yarnLockPath = path.join(this.workspaceRoot, 'yarn.lock');
        if (fs.existsSync(yarnLockPath)) {
            this.captureYarnLockDependencies(yarnLockPath);
        }

        const requirementsPath = path.join(this.workspaceRoot, 'requirements.txt');
        if (fs.existsSync(requirementsPath)) {
            this.captureRequirementsDependencies(requirementsPath);
        }
    }

    private generateHash(content: string): string {
        // Simple hash function
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // Convert to 32-bit integer
        }
        return hash.toString();
    }

    public stop(): void {
        this.watchers.forEach(watcher => clearInterval(watcher));
        this.watchers = [];
        this.persistence.logWithEmoji('🛑', 'SBOMCaptureEngine stopped');
    }
}

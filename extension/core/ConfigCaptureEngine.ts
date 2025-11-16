import * as fs from 'fs';
import * as path from 'path';
import { PersistenceManager } from './PersistenceManager';
import { EventAggregator } from './EventAggregator';

export interface ConfigInfo {
    file: string;
    type: 'yaml' | 'toml' | 'json' | 'env' | 'dockerfile' | 'docker-compose';
    values: Record<string, any>;
    criticalKeys: string[];
    anonymized: boolean;
}

export class ConfigCaptureEngine {
    private lastConfigHashes: Map<string, string> = new Map();
    private watchers: NodeJS.Timeout[] = [];

    constructor(
        private workspaceRoot: string,
        private persistence: PersistenceManager,
        private eventAggregator: EventAggregator
    ) {
        this.persistence.logWithEmoji('⚙️', 'ConfigCaptureEngine initialized');
    }

    public start(): void {
        this.startYamlWatcher();
        this.startTomlWatcher();
        this.startEnvWatcher();
        this.startDockerfileWatcher();
        this.startDockerComposeWatcher();
        
        // Capture initial
        this.captureAllConfigs();
        
        this.persistence.logWithEmoji('🚀', 'ConfigCaptureEngine started');
    }

    // ✅ Priorité 2: .yml/.yaml files
    private startYamlWatcher(): void {
        const yamlFiles = this.findFiles(['*.yml', '*.yaml']);
        
        yamlFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastConfigHashes.get(file)) {
                        this.captureYamlConfig(file);
                        this.lastConfigHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch ${file}: ${error}`);
                }
            }, 5000); // Check every 5 seconds

            this.watchers.push(watcher);
        });

        if (yamlFiles.length > 0) {
            this.persistence.logWithEmoji('⚙️', `YAML watcher started for ${yamlFiles.length} files`);
        }
    }

    private startTomlWatcher(): void {
        const tomlFiles = this.findFiles(['*.toml', 'Cargo.toml', 'pyproject.toml']);
        
        tomlFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastConfigHashes.get(file)) {
                        this.captureTomlConfig(file);
                        this.lastConfigHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch ${file}: ${error}`);
                }
            }, 5000);

            this.watchers.push(watcher);
        });

        if (tomlFiles.length > 0) {
            this.persistence.logWithEmoji('⚙️', `TOML watcher started for ${tomlFiles.length} files`);
        }
    }

    private startEnvWatcher(): void {
        const envFiles = this.findFiles(['.env', '.env.local', '.env.production', '.env.development']);
        
        envFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastConfigHashes.get(file)) {
                        this.captureEnvConfig(file);
                        this.lastConfigHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch ${file}: ${error}`);
                }
            }, 5000);

            this.watchers.push(watcher);
        });

        if (envFiles.length > 0) {
            this.persistence.logWithEmoji('⚙️', `ENV watcher started for ${envFiles.length} files`);
        }
    }

    private startDockerfileWatcher(): void {
        const dockerFiles = this.findFiles(['Dockerfile', 'Dockerfile.*', '*.dockerfile']);
        
        dockerFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastConfigHashes.get(file)) {
                        this.captureDockerfileConfig(file);
                        this.lastConfigHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch ${file}: ${error}`);
                }
            }, 5000);

            this.watchers.push(watcher);
        });

        if (dockerFiles.length > 0) {
            this.persistence.logWithEmoji('⚙️', `Dockerfile watcher started for ${dockerFiles.length} files`);
        }
    }

    private startDockerComposeWatcher(): void {
        const composeFiles = this.findFiles(['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']);
        
        composeFiles.forEach(file => {
            const watcher = setInterval(() => {
                try {
                    const content = fs.readFileSync(file, 'utf-8');
                    const hash = this.generateHash(content);
                    
                    if (hash !== this.lastConfigHashes.get(file)) {
                        this.captureDockerComposeConfig(file);
                        this.lastConfigHashes.set(file, hash);
                    }
                } catch (error) {
                    this.persistence.logWithEmoji('❌', `Failed to watch ${file}: ${error}`);
                }
            }, 5000);

            this.watchers.push(watcher);
        });

        if (composeFiles.length > 0) {
            this.persistence.logWithEmoji('⚙️', `Docker Compose watcher started for ${composeFiles.length} files`);
        }
    }

    private captureYamlConfig(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Simple YAML parsing (basic implementation)
            const config: ConfigInfo = {
                file: path.basename(filePath),
                type: 'yaml',
                values: this.parseYamlBasic(content),
                criticalKeys: this.extractCriticalKeys(content),
                anonymized: true
            };

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'config',
                    config,
                    level: '1 - Code & Structure Technique',
                    category: 'Config Files',
                    totalKeys: Object.keys(config.values).length
                }
            );

            this.persistence.logWithEmoji('⚙️', `Captured YAML config: ${config.file} (${Object.keys(config.values).length} keys)`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse YAML ${filePath}: ${error}`);
        }
    }

    private captureTomlConfig(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Simple TOML parsing (basic implementation)
            const config: ConfigInfo = {
                file: path.basename(filePath),
                type: 'toml',
                values: this.parseTomlBasic(content),
                criticalKeys: this.extractCriticalKeys(content),
                anonymized: true
            };

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'config',
                    config,
                    level: '1 - Code & Structure Technique',
                    category: 'Config Files',
                    totalKeys: Object.keys(config.values).length
                }
            );

            this.persistence.logWithEmoji('⚙️', `Captured TOML config: ${config.file} (${Object.keys(config.values).length} keys)`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse TOML ${filePath}: ${error}`);
        }
    }

    private captureEnvConfig(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Parse .env file
            const values: Record<string, any> = {};
            const lines = content.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [key, ...valueParts] = trimmed.split('=');
                    if (key && valueParts.length > 0) {
                        const value = valueParts.join('=');
                        values[key.trim()] = this.anonymizeValue(value.trim());
                    }
                }
            }

            const config: ConfigInfo = {
                file: path.basename(filePath),
                type: 'env',
                values,
                criticalKeys: Object.keys(values),
                anonymized: true
            };

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'config',
                    config,
                    level: '1 - Code & Structure Technique',
                    category: 'Config Files',
                    totalKeys: Object.keys(values).length
                }
            );

            this.persistence.logWithEmoji('⚙️', `Captured ENV config: ${config.file} (${Object.keys(values).length} keys)`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse ENV ${filePath}: ${error}`);
        }
    }

    private captureDockerfileConfig(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Parse Dockerfile
            const values: Record<string, any> = {};
            const lines = content.split('\n');
            
            for (const line of lines) {
                const trimmed = line.trim();
                if (trimmed && !trimmed.startsWith('#')) {
                    const [instruction, ...args] = trimmed.split(' ');
                    if (instruction && args.length > 0) {
                        values[instruction.toLowerCase()] = args.join(' ');
                    }
                }
            }

            const config: ConfigInfo = {
                file: path.basename(filePath),
                type: 'dockerfile',
                values,
                criticalKeys: Object.keys(values),
                anonymized: false
            };

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'config',
                    config,
                    level: '1 - Code & Structure Technique',
                    category: 'Config Files',
                    totalKeys: Object.keys(values).length
                }
            );

            this.persistence.logWithEmoji('⚙️', `Captured Dockerfile config: ${config.file} (${Object.keys(values).length} instructions)`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse Dockerfile ${filePath}: ${error}`);
        }
    }

    private captureDockerComposeConfig(filePath: string): void {
        try {
            const content = fs.readFileSync(filePath, 'utf-8');
            
            // Simple Docker Compose parsing
            const config: ConfigInfo = {
                file: path.basename(filePath),
                type: 'docker-compose',
                values: this.parseYamlBasic(content),
                criticalKeys: this.extractCriticalKeys(content),
                anonymized: true
            };

            this.eventAggregator.captureEvent(
                'file_change',
                filePath,
                {
                    type: 'config',
                    config,
                    level: '1 - Code & Structure Technique',
                    category: 'Config Files',
                    totalKeys: Object.keys(config.values).length
                }
            );

            this.persistence.logWithEmoji('⚙️', `Captured Docker Compose config: ${config.file} (${Object.keys(config.values).length} keys)`);

        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to parse Docker Compose ${filePath}: ${error}`);
        }
    }

    private parseYamlBasic(content: string): Record<string, any> {
        // Basic YAML parsing - extract key-value pairs
        const values: Record<string, any> = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes(':')) {
                const [key, ...valueParts] = trimmed.split(':');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join(':').trim();
                    values[key.trim()] = this.anonymizeValue(value);
                }
            }
        }
        
        return values;
    }

    private parseTomlBasic(content: string): Record<string, any> {
        // Basic TOML parsing - extract key-value pairs
        const values: Record<string, any> = {};
        const lines = content.split('\n');
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
                const [key, ...valueParts] = trimmed.split('=');
                if (key && valueParts.length > 0) {
                    const value = valueParts.join('=').trim();
                    values[key.trim()] = this.anonymizeValue(value);
                }
            }
        }
        
        return values;
    }

    private extractCriticalKeys(content: string): string[] {
        // Extract critical configuration keys
        const criticalPatterns = [
            /port/i, /host/i, /database/i, /password/i, /secret/i, /key/i, 
            /token/i, /api/i, /url/i, /endpoint/i, /auth/i, /ssl/i, /tls/i
        ];
        
        const lines = content.split('\n');
        const criticalKeys: string[] = [];
        
        for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#')) {
                for (const pattern of criticalPatterns) {
                    if (pattern.test(trimmed)) {
                        const key = trimmed.split(/[:=]/)[0]?.trim();
                        if (key && !criticalKeys.includes(key)) {
                            criticalKeys.push(key);
                        }
                    }
                }
            }
        }
        
        return criticalKeys;
    }

    private anonymizeValue(value: string): string {
        // Anonymize sensitive values
        if (value.length > 20) {
            return `***${value.slice(-4)}`;
        }
        return '***';
    }

    private findFiles(patterns: string[]): string[] {
        const files: string[] = [];
        
        try {
            const entries = fs.readdirSync(this.workspaceRoot, { withFileTypes: true });
            
            for (const entry of entries) {
                if (entry.isFile()) {
                    for (const pattern of patterns) {
                        if (entry.name === pattern || entry.name.match(pattern.replace('*', '.*'))) {
                            files.push(path.join(this.workspaceRoot, entry.name));
                        }
                    }
                }
            }
        } catch (error) {
            this.persistence.logWithEmoji('❌', `Failed to scan directory: ${error}`);
        }
        
        return files;
    }

    private captureAllConfigs(): void {
        // Capture all existing config files
        const yamlFiles = this.findFiles(['*.yml', '*.yaml']);
        yamlFiles.forEach(file => this.captureYamlConfig(file));

        const tomlFiles = this.findFiles(['*.toml', 'Cargo.toml', 'pyproject.toml']);
        tomlFiles.forEach(file => this.captureTomlConfig(file));

        const envFiles = this.findFiles(['.env', '.env.local', '.env.production', '.env.development']);
        envFiles.forEach(file => this.captureEnvConfig(file));

        const dockerFiles = this.findFiles(['Dockerfile', 'Dockerfile.*', '*.dockerfile']);
        dockerFiles.forEach(file => this.captureDockerfileConfig(file));

        const composeFiles = this.findFiles(['docker-compose.yml', 'docker-compose.yaml', 'compose.yml', 'compose.yaml']);
        composeFiles.forEach(file => this.captureDockerComposeConfig(file));
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
        this.persistence.logWithEmoji('🛑', 'ConfigCaptureEngine stopped');
    }
}

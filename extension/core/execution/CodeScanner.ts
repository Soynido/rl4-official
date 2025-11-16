import * as fs from 'fs';
import * as path from 'path';

/**
 * CodeScanner - Scan TypeScript files and extract exported functions
 * 
 * Purpose: Build a command registry mapping intents to executable functions
 */
export class CodeScanner {
    private workspaceRoot: string;
    private extensionDir: string;

    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.extensionDir = path.join(workspaceRoot, 'extension');
    }

    /**
     * Scan all TypeScript files and extract exported functions
     */
    public async scan(): Promise<CommandEntry[]> {
        const entries: CommandEntry[] = [];
        const tsFiles: string[] = [];

        // Recursively find all .ts files
        this.findTsFiles(this.extensionDir, tsFiles);

        for (const file of tsFiles) {
            const relativePath = path.relative(this.extensionDir, file);
            try {
                const content = fs.readFileSync(file, 'utf-8');
                const extracted = this.extractFunctions(content, relativePath);
                entries.push(...extracted);
            } catch (error) {
                // Skip files that can't be read
                continue;
            }
        }

        return entries;
    }

    /**
     * Recursively find all .ts files
     */
    private findTsFiles(dir: string, result: string[]): void {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                // Skip node_modules, dist, out directories
                if (entry.isDirectory()) {
                    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'out') {
                        continue;
                    }
                    this.findTsFiles(fullPath, result);
                } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
                    result.push(fullPath);
                }
            }
        } catch (error) {
            // Skip directories that can't be read
        }
    }

    /**
     * Extract exported functions from TypeScript content
     */
    private extractFunctions(content: string, filePath: string): CommandEntry[] {
        const entries: CommandEntry[] = [];

        // Pattern 1: export function name(...)
        const functionPattern = /export\s+(async\s+)?function\s+(\w+)\s*\(/g;
        let match;
        while ((match = functionPattern.exec(content)) !== null) {
            entries.push({
                function: match[2],
                file: filePath,
                type: 'function',
                async: !!match[1]
            });
        }

        // Pattern 2: export const name = async (...) =>
        const arrowPattern = /export\s+const\s+(\w+)\s*=\s*(async\s+)?\([^)]*\)\s*=>/g;
        while ((match = arrowPattern.exec(content)) !== null) {
            entries.push({
                function: match[1],
                file: filePath,
                type: 'arrow',
                async: !!match[2]
            });
        }

        // Pattern 3: export class ClassName { method(...) }
        const classPattern = /export\s+class\s+(\w+)/g;
        while ((match = classPattern.exec(content)) !== null) {
            const className = match[1];
            // Extract public methods
            const methodPattern = new RegExp(`public\\s+(async\\s+)?(\\w+)\\s*\\(`, 'g');
            let methodMatch;
            while ((methodMatch = methodPattern.exec(content)) !== null) {
                entries.push({
                    function: `${className}.${methodMatch[2]}`,
                    file: filePath,
                    type: 'method',
                    async: !!methodMatch[1],
                    className
                });
            }
        }

        // Extract docstrings/comments for context
        for (const entry of entries) {
            entry.description = this.extractDescription(content, entry.function);
        }

        return entries;
    }

    /**
     * Extract JSDoc or comment description for a function
     */
    private extractDescription(content: string, functionName: string): string | undefined {
        // Try to find JSDoc before function
        const beforeFunction = content.substring(0, content.indexOf(`function ${functionName}`) || content.indexOf(`const ${functionName}`));
        const lastComment = beforeFunction.match(/\/\*\*[\s\S]*?\*\//) || beforeFunction.match(/\/\/.*$/m);
        
        if (lastComment) {
            const doc = lastComment[0];
            // Extract first line of description
            const descMatch = doc.match(/\*\s+([^*\n]+)/);
            if (descMatch) {
                return descMatch[1].trim();
            }
        }

        return undefined;
    }

    /**
     * Save command registry to JSON
     */
    public async saveRegistry(entries: CommandEntry[], outputPath: string): Promise<void> {
        const registry = {
            generatedAt: new Date().toISOString(),
            totalCommands: entries.length,
            commands: entries
        };

        fs.writeFileSync(outputPath, JSON.stringify(registry, null, 2), 'utf-8');
    }

    /**
     * Load command registry from JSON
     */
    public loadRegistry(registryPath: string): CommandRegistry | null {
        if (!fs.existsSync(registryPath)) {
            return null;
        }

        try {
            const content = fs.readFileSync(registryPath, 'utf-8');
            return JSON.parse(content);
        } catch (error) {
            return null;
        }
    }
}

/**
 * Types
 */
export interface CommandEntry {
    function: string;
    file: string;
    type: 'function' | 'arrow' | 'method';
    async?: boolean;
    className?: string;
    description?: string;
}

export interface CommandRegistry {
    generatedAt: string;
    totalCommands: number;
    commands: CommandEntry[];
}


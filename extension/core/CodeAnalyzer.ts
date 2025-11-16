/**
 * CodeAnalyzer - Phase 2.3: Code Impact Analysis
 * 
 * Detects functions/classes affected by code changes
 */

import * as fs from 'fs';

export interface CodeImpact {
    functionsAffected: string[];
    classesModified: string[];
    importsChanged: string[];
}

export interface Pattern {
    name: string;
    confidence: number;
}

export class CodeAnalyzer {
    
    /**
     * Parse diff to extract functions/classes affected
     * 
     * Note: This is a simplified regex-based parser.
     * For full AST parsing, consider using @babel/parser or typescript-parser
     */
    public parseDiff(diff: string, filePath: string): CodeImpact {
        const functionsAffected: string[] = [];
        const classesModified: string[] = [];
        const importsChanged: string[] = [];
        
        // Skip non-code files (markdown, JSON, config files, etc.)
        const codeExtensions = ['.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.go', '.rs', '.cpp', '.c', '.h'];
        const hasCodeExtension = codeExtensions.some(ext => filePath.endsWith(ext));
        if (!hasCodeExtension) {
            return { functionsAffected, classesModified, importsChanged };
        }
        
        // Detect function definitions in modified lines
        const functionPatterns = [
            /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g,           // function name()
            /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s*)?\(/g  // arrow functions
        ];
        
        for (const pattern of functionPatterns) {
            const matches = diff.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && !functionsAffected.includes(match[1])) {
                    functionsAffected.push(match[1]);
                }
            }
        }
        
        // Detect class definitions
        const classPattern = /class\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
        const classMatches = diff.matchAll(classPattern);
        for (const match of classMatches) {
            if (match[1] && !classesModified.includes(match[1])) {
                classesModified.push(match[1]);
            }
        }
        
        // Detect imports/exports
        const importPatterns = [
            /import\s+(?:.*from\s+)?['"]([^'"]+)['"]/g,
            /require\(['"]([^'"]+)['"]\)/g,
            /export\s+(?:const|function|class)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g
        ];
        
        for (const pattern of importPatterns) {
            const matches = diff.matchAll(pattern);
            for (const match of matches) {
                if (match[1] && !importsChanged.includes(match[1])) {
                    importsChanged.push(match[1]);
                }
            }
        }
        
        return {
            functionsAffected,
            classesModified,
            importsChanged
        };
    }
    
    /**
     * Detect design patterns in code
     * Simple pattern detection based on code structure
     */
    public detectPatterns(code: string, filePath: string): Pattern[] {
        const patterns: Pattern[] = [];
        
        // Singleton pattern detection
        if (/class\s+\w+\s*{[^}]*static\s+(?:instance|getInstance)/g.test(code)) {
            patterns.push({ name: 'Singleton', confidence: 0.8 });
        }
        
        // Factory pattern detection
        if (/(?:create|build|make)\w+\(/g.test(code) && /return\s+new\s+\w+\(/g.test(code)) {
            patterns.push({ name: 'Factory', confidence: 0.7 });
        }
        
        // Strategy pattern detection
        if (/interface\s+\w+Strategy|implements\s+\w+Strategy/g.test(code)) {
            patterns.push({ name: 'Strategy', confidence: 0.9 });
        }
        
        // Observer pattern detection
        if (/(?:on|emit|subscribe|notify|addEventListener)\(/g.test(code)) {
            patterns.push({ name: 'Observer', confidence: 0.6 });
        }
        
        // Decorator pattern detection
        if (/(?:@\w+|decorator)/g.test(code)) {
            patterns.push({ name: 'Decorator', confidence: 0.7 });
        }
        
        return patterns;
    }
    
    /**
     * Read file and analyze its structure
     */
    public analyzeFile(filePath: string): {
        hasCode: boolean;
        lineCount: number;
        patterns: Pattern[];
    } {
        try {
            if (!fs.existsSync(filePath)) {
                return { hasCode: false, lineCount: 0, patterns: [] };
            }
            
            const content = fs.readFileSync(filePath, 'utf-8');
            const lineCount = content.split('\n').length;
            const patterns = this.detectPatterns(content, filePath);
            
            return {
                hasCode: true,
                lineCount,
                patterns
            };
        } catch (error) {
            return { hasCode: false, lineCount: 0, patterns: [] };
        }
    }
}


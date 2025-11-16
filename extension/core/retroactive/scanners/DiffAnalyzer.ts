export interface CommitCategory {
    type: 'feature' | 'refactor' | 'fix' | 'config' | 'test' | 'docs' | 'unknown';
    confidence: number;
    reasoning: string;
}

export interface DiffMetadata {
    totalFiles: number;
    totalLinesChanged: number;
    insertions: number;
    deletions: number;
    categories: {
        config: string[];
        tests: string[];
        code: string[];
        docs: string[];
    };
}

export class DiffAnalyzer {
    /**
     * Analyze commit and determine its category
     */
    public analyzeCommit(
        commitMessage: string,
        files: string[],
        linesChanged: number
    ): CommitCategory {
        const lowerMessage = commitMessage.toLowerCase();
        
        // Config changes
        const configFiles = ['package.json', '.env', 'tsconfig.json', 'webpack.config', 'vite.config'];
        const hasConfig = files.some(f => configFiles.some(cf => f.includes(cf)));
        if (hasConfig && files.length <= 5) {
            return {
                type: 'config',
                confidence: 0.9,
                reasoning: `Config file modifications: ${files.join(', ')}`
            };
        }

        // Test changes
        const testPatterns = ['test', 'spec', '__tests__'];
        const hasTests = files.some(f => testPatterns.some(tp => f.includes(tp)));
        if (hasTests && (lowerMessage.includes('test') || lowerMessage.includes('fix'))) {
            return {
                type: 'test',
                confidence: 0.85,
                reasoning: 'Test files modified'
            };
        }

        // Refactor detection
        if (lowerMessage.includes('refactor') || (files.length > 15 && linesChanged > 200)) {
            return {
                type: 'refactor',
                confidence: 0.9,
                reasoning: files.length > 15 
                    ? 'Large-scale file modifications'
                    : 'Refactor mentioned in commit message'
            };
        }

        // Fix/Bug detection
        if (lowerMessage.match(/\b(fix|bug|patch|resolve)\b/)) {
            return {
                type: 'fix',
                confidence: 0.88,
                reasoning: 'Bug fix keywords detected'
            };
        }

        // Feature detection
        if (lowerMessage.includes('feat') || lowerMessage.includes('add') || lowerMessage.includes('implement')) {
            return {
                type: 'feature',
                confidence: 0.82,
                reasoning: 'Feature-related keywords detected'
            };
        }

        // Docs
        if (lowerMessage.includes('doc') || lowerMessage.includes('readme')) {
            return {
                type: 'docs',
                confidence: 0.75,
                reasoning: 'Documentation keywords detected'
            };
        }

        // Default
        return {
            type: 'unknown',
            confidence: 0.5,
            reasoning: 'Cannot classify commit'
        };
    }

    /**
     * Extract metadata from file changes
     */
    public extractMetadata(files: string[], insertions: number, deletions: number): DiffMetadata {
        const configFiles = ['package.json', '.env', 'tsconfig.json', 'webpack.config', '.config'];
        const testPatterns = ['test', 'spec', '__tests__', '.test.', '.spec.'];
        const docPatterns = ['README', 'CHANGELOG', 'docs/', '.md'];

        return {
            totalFiles: files.length,
            totalLinesChanged: insertions + deletions,
            insertions,
            deletions,
            categories: {
                config: files.filter(f => configFiles.some(cf => f.includes(cf))),
                tests: files.filter(f => testPatterns.some(tp => f.includes(tp))),
                code: files.filter(f => 
                    !configFiles.some(cf => f.includes(cf)) &&
                    !testPatterns.some(tp => f.includes(tp)) &&
                    !docPatterns.some(dp => f.includes(dp))
                ),
                docs: files.filter(f => docPatterns.some(dp => f.includes(dp)))
            }
        };
    }

    /**
     * Detect if commit is significant
     */
    public isSignificant(metadata: DiffMetadata): boolean {
        return (
            metadata.totalFiles > 5 ||
            metadata.totalLinesChanged > 50 ||
            metadata.categories.config.length > 0
        );
    }
}


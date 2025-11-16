/**
 * CodeStateAnalyzer — Analyze actual code implementation state
 * 
 * Problem: Snapshot contains goals/plans but NOT actual code state
 * Solution: Analyze key files and include implementation status in snapshot
 * 
 * Features:
 * - Detect which features are actually implemented
 * - Extract function/class signatures from code
 * - Compare goals vs reality
 * - Include code snippets for context
 */

import * as fs from 'fs';
import * as path from 'path';

export interface CodeFile {
  path: string;
  exists: boolean;
  size: number;
  functions: string[];
  classes: string[];
  imports: string[];
  lastModified: string;
}

export interface ImplementationStatus {
  feature: string;
  status: 'implemented' | 'partial' | 'missing';
  evidence: string[]; // File paths or function names
  confidence: number; // 0.0-1.0
}

export interface CodeState {
  keyFiles: CodeFile[];
  implementationStatus: ImplementationStatus[];
  techStack: {
    languages: string[];
    frameworks: string[];
    dependencies: string[];
  };
  structure: {
    entryPoints: string[];
    mainModules: string[];
  };
}

export class CodeStateAnalyzer {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  /**
   * Analyze code state based on goals/tasks
   */
  async analyze(goals: string[]): Promise<CodeState> {
    const keyFiles = await this.findKeyFiles(goals);
    const implementationStatus = await this.checkImplementationStatus(goals, keyFiles);
    const techStack = await this.detectTechStack();
    const structure = await this.detectStructure();

    return {
      keyFiles,
      implementationStatus,
      techStack,
      structure
    };
  }

  /**
   * Find key files based on goals
   */
  private async findKeyFiles(goals: string[]): Promise<CodeFile[]> {
    const files: CodeFile[] = [];
    const keywords = this.extractKeywords(goals);

    // Common file patterns to check
    const patterns = [
      'index.html',
      'index.js',
      'app.js',
      'main.js',
      'src/index.ts',
      'src/index.js',
      'src/app.tsx',
      'src/App.tsx',
      'package.json',
      'README.md'
    ];

    // Also check for files matching keywords
    for (const keyword of keywords) {
      patterns.push(`**/${keyword}*.js`);
      patterns.push(`**/${keyword}*.ts`);
      patterns.push(`**/${keyword}*.jsx`);
      patterns.push(`**/${keyword}*.tsx`);
    }

    for (const pattern of patterns) {
      const filePath = this.resolveFile(pattern);
      if (filePath && fs.existsSync(filePath)) {
        const file = await this.analyzeFile(filePath);
        if (file) {
          files.push(file);
        }
      }
    }

    // Also scan common directories
    const commonDirs = ['js', 'src', 'lib', 'app', 'components'];
    for (const dir of commonDirs) {
      const dirPath = path.join(this.workspaceRoot, dir);
      if (fs.existsSync(dirPath) && fs.statSync(dirPath).isDirectory()) {
        const dirFiles = await this.scanDirectory(dirPath, keywords);
        files.push(...dirFiles);
      }
    }

    return files.slice(0, 10); // Limit to 10 most relevant
  }

  /**
   * Extract keywords from goals
   */
  private extractKeywords(goals: string[]): string[] {
    const keywords: string[] = [];
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by']);

    for (const goal of goals) {
      const words = goal.toLowerCase()
        .replace(/[^\w\s]/g, ' ')
        .split(/\s+/)
        .filter(w => w.length > 3 && !commonWords.has(w));
      keywords.push(...words);
    }

    return [...new Set(keywords)]; // Unique
  }

  /**
   * Resolve file path (handle glob patterns)
   */
  private resolveFile(pattern: string): string | null {
    // Simple resolution - just check if file exists
    if (pattern.includes('**')) {
      // For glob patterns, we'd need glob library, but for now just try common locations
      const baseName = pattern.replace('**/', '').replace('*.', '');
      const commonPaths = [
        path.join(this.workspaceRoot, baseName),
        path.join(this.workspaceRoot, 'src', baseName),
        path.join(this.workspaceRoot, 'js', baseName),
        path.join(this.workspaceRoot, 'app', baseName)
      ];
      
      for (const p of commonPaths) {
        if (fs.existsSync(p)) {
          return p;
        }
      }
      return null;
    }

    const filePath = path.join(this.workspaceRoot, pattern);
    return fs.existsSync(filePath) ? filePath : null;
  }

  /**
   * Analyze a single file
   */
  private async analyzeFile(filePath: string): Promise<CodeFile | null> {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stats = fs.statSync(filePath);

      // Extract functions (simple regex - could be improved)
      const functions: string[] = [];
      const functionRegex = /(?:function\s+(\w+)|const\s+(\w+)\s*=\s*(?:async\s*)?\(|(\w+)\s*:\s*(?:async\s*)?\()/g;
      let match;
      while ((match = functionRegex.exec(content)) !== null) {
        const name = match[1] || match[2] || match[3];
        if (name && !functions.includes(name)) {
          functions.push(name);
        }
      }

      // Extract classes
      const classes: string[] = [];
      const classRegex = /class\s+(\w+)/g;
      while ((match = classRegex.exec(content)) !== null) {
        if (match[1] && !classes.includes(match[1])) {
          classes.push(match[1]);
        }
      }

      // Extract imports
      const imports: string[] = [];
      const importRegex = /(?:import|require)\(?['"]([^'"]+)['"]\)?/g;
      while ((match = importRegex.exec(content)) !== null) {
        if (match[1] && !imports.includes(match[1])) {
          imports.push(match[1]);
        }
      }

      return {
        path: path.relative(this.workspaceRoot, filePath),
        exists: true,
        size: stats.size,
        functions: functions.slice(0, 10), // Limit
        classes: classes.slice(0, 10),
        imports: imports.slice(0, 10),
        lastModified: stats.mtime.toISOString()
      };
    } catch (error) {
      return null;
    }
  }

  /**
   * Scan directory for relevant files
   */
  private async scanDirectory(dirPath: string, keywords: string[]): Promise<CodeFile[]> {
    const files: CodeFile[] = [];
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts') || entry.name.endsWith('.jsx') || entry.name.endsWith('.tsx'))) {
          // Check if filename matches keywords
          const matchesKeyword = keywords.some(k => entry.name.toLowerCase().includes(k.toLowerCase()));
          if (matchesKeyword || files.length < 5) { // Always include first 5 files
            const filePath = path.join(dirPath, entry.name);
            const file = await this.analyzeFile(filePath);
            if (file) {
              files.push(file);
            }
          }
        }
      }
    } catch (error) {
      // Ignore errors
    }

    return files;
  }

  /**
   * Check implementation status for each goal
   */
  private async checkImplementationStatus(goals: string[], files: CodeFile[]): Promise<ImplementationStatus[]> {
    const statuses: ImplementationStatus[] = [];

    for (const goal of goals) {
      const keywords = this.extractKeywords([goal]);
      const evidence: string[] = [];
      let confidence = 0.0;

      // Check if files match goal keywords
      for (const file of files) {
        const fileMatches = keywords.some(k => 
          file.path.toLowerCase().includes(k.toLowerCase()) ||
          file.functions.some(f => f.toLowerCase().includes(k.toLowerCase())) ||
          file.classes.some(c => c.toLowerCase().includes(k.toLowerCase()))
        );

        if (fileMatches) {
          evidence.push(file.path);
          confidence += 0.3;
        }
      }

      // Determine status
      let status: 'implemented' | 'partial' | 'missing';
      if (confidence >= 0.7) {
        status = 'implemented';
      } else if (confidence >= 0.3) {
        status = 'partial';
      } else {
        status = 'missing';
      }

      statuses.push({
        feature: goal,
        status,
        evidence,
        confidence: Math.min(confidence, 1.0)
      });
    }

    return statuses;
  }

  /**
   * Detect tech stack
   */
  private async detectTechStack(): Promise<{ languages: string[]; frameworks: string[]; dependencies: string[] }> {
    const languages: string[] = [];
    const frameworks: string[] = [];
    const dependencies: string[] = [];

    // Check package.json
    const packageJsonPath = path.join(this.workspaceRoot, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      try {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        // Detect from dependencies
        const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
        for (const [name, version] of Object.entries(deps)) {
          dependencies.push(`${name}@${version}`);
          
          // Detect frameworks
          if (name.includes('react')) frameworks.push('React');
          if (name.includes('vue')) frameworks.push('Vue');
          if (name.includes('angular')) frameworks.push('Angular');
          if (name.includes('express')) frameworks.push('Express');
          if (name.includes('next')) frameworks.push('Next.js');
          if (name.includes('vite')) frameworks.push('Vite');
        }
      } catch (error) {
        // Ignore
      }
    }

    // Detect languages from file extensions
    const extensions = new Set<string>();
    this.scanForExtensions(this.workspaceRoot, extensions, 0, 3); // Max depth 3
    
    for (const ext of extensions) {
      if (ext === '.js' || ext === '.jsx') languages.push('JavaScript');
      if (ext === '.ts' || ext === '.tsx') languages.push('TypeScript');
      if (ext === '.py') languages.push('Python');
      if (ext === '.java') languages.push('Java');
      if (ext === '.go') languages.push('Go');
      if (ext === '.rs') languages.push('Rust');
    }

    return {
      languages: [...new Set(languages)],
      frameworks: [...new Set(frameworks)],
      dependencies: dependencies.slice(0, 10) // Limit
    };
  }

  /**
   * Scan for file extensions
   */
  private scanForExtensions(dirPath: string, extensions: Set<string>, depth: number, maxDepth: number): void {
    if (depth > maxDepth) return;

    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isFile()) {
          const ext = path.extname(entry.name);
          if (ext) {
            extensions.add(ext);
          }
        } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
          this.scanForExtensions(path.join(dirPath, entry.name), extensions, depth + 1, maxDepth);
        }
      }
    } catch (error) {
      // Ignore
    }
  }

  /**
   * Detect project structure
   */
  private async detectStructure(): Promise<{ entryPoints: string[]; mainModules: string[] }> {
    const entryPoints: string[] = [];
    const mainModules: string[] = [];

    // Common entry points
    const commonEntries = ['index.html', 'index.js', 'main.js', 'app.js', 'src/index.ts', 'src/index.js', 'src/main.ts'];
    for (const entry of commonEntries) {
      const filePath = path.join(this.workspaceRoot, entry);
      if (fs.existsSync(filePath)) {
        entryPoints.push(entry);
      }
    }

    // Find main modules (files with many functions/classes)
    const jsFiles: Array<{ path: string; functionCount: number }> = [];
    
    const scanDir = async (dir: string, depth: number) => {
      if (depth > 2) return; // Max depth 2
      
      try {
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile() && (entry.name.endsWith('.js') || entry.name.endsWith('.ts'))) {
            const filePath = path.join(dir, entry.name);
            const file = await this.analyzeFile(filePath);
            if (file && file.functions.length > 0) {
              jsFiles.push({ path: file.path, functionCount: file.functions.length });
            }
          } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
            await scanDir(path.join(dir, entry.name), depth + 1);
          }
        }
      } catch (error) {
        // Ignore
      }
    };

    await scanDir(this.workspaceRoot, 0);
    
    // Sort by function count and take top 5
    jsFiles.sort((a, b) => b.functionCount - a.functionCount);
    mainModules.push(...jsFiles.slice(0, 5).map(f => f.path));

    return { entryPoints, mainModules };
  }
}


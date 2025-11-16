// ✅ COPIÉ V2 - Types stables
export interface CaptureEvent {
    id: string;              // UUID
    timestamp: string;       // ISO 8601
    type: 'file_change' | 'git_commit' | 'git_branch' | 'dependencies' | 'config' | 'test' | 'pr_linked' | 'issue_linked';
    source: string;          // Chemin fichier ou commit hash
    metadata: Record<string, any>;
}

// ✅ NOUVEAU - Types pour la Data Contract Interface
export interface DependencyInfo {
    name: string;
    version: string;
    license?: string;
    hash?: string;
    dev?: boolean;
    source: 'package-lock.json' | 'yarn.lock' | 'pnpm-lock.yaml' | 'Cargo.toml' | 'requirements.txt';
}

export interface TestReport {
    framework: 'jest' | 'mocha' | 'vitest' | 'cypress' | 'playwright';
    status: 'passed' | 'failed' | 'skipped';
    totalTests: number;
    passed: number;
    failed: number;
    coverage?: {
        lines: { total: number; covered: number; pct: number };
        functions: { total: number; covered: number; pct: number };
        branches: { total: number; covered: number; pct: number };
        statements: { total: number; covered: number; pct: number };
    };
}

export interface ConfigValue {
    fileType: 'yaml' | 'toml' | 'env' | 'dockerfile' | 'docker-compose';
    keys: Record<string, string>;
}

// ✅ NOUVEAU - Niveau 1: Commit Data
export interface GitCommitData {
    hash: string;
    author_name: string;
    author_email: string;
    date: string;
    message: string;
    files_changed: string[];
    insertions: number;
    deletions: number;
}

// ✅ NOUVEAU - Niveau 1: Diff Summary
export interface DiffSummary {
    file_path: string;
    change_type: 'added' | 'modified' | 'deleted' | 'renamed';
    lines_added: number;
    lines_deleted: number;
    functions_impacted: string[];
    dependencies_modified: string[];
}

export interface ProjectManifest {
    version: '1.0';
    projectName: string;
    createdAt: string;
    lastCaptureAt: string;
    totalEvents: number;
}

export interface SerializableData {
    events: CaptureEvent[];
    manifest: ProjectManifest;
}

// ✅ NOUVEAU - Data Contract Interface (Capture → RBOM)
export interface Evidence {
    id: string;                    // UUID unique de l'évidence
    type: 'commit' | 'dependency' | 'config' | 'test' | 'file_change' | 'git_branch';
    source: string;                 // File path ou commit hash
    timestamp: string;               // ISO 8601
    metadata: Record<string, any>; // Données spécifiques au type
    version: '1.0';                 // Version du schéma Evidence
}

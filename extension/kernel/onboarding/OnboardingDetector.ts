/**
 * OnboardingDetector - Detect workspace state for adaptive first-time experience
 * 
 * Analyzes Git history, file structure, and activity to determine:
 * - "existing": Project with significant history (recommend reconstruction)
 * - "new": Fresh project (recommend quick setup)
 * - "ambiguous": Unclear state (ask user to clarify)
 * 
 * Part of Phase E6 - Dual-Mode Onboarding
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

export interface WorkspaceState {
    mode: 'existing' | 'new' | 'ambiguous';
    confidence: number; // 0.0-1.0
    evidence: {
        git_commits: number;
        git_age_days: number;
        git_contributors: number;
        files_count: number;
        has_package_json: boolean;
        has_git: boolean;
        recent_activity: boolean; // commits in last 7 days
        first_commit_date: string | null;
        last_commit_date: string | null;
    };
    recommendation: string;
}

/**
 * Detect workspace state by analyzing Git history and file structure
 */
export async function detectWorkspaceState(workspaceRoot: string): Promise<WorkspaceState> {
    const evidence = {
        git_commits: 0,
        git_age_days: 0,
        git_contributors: 0,
        files_count: 0,
        has_package_json: false,
        has_git: false,
        recent_activity: false,
        first_commit_date: null as string | null,
        last_commit_date: null as string | null
    };

    try {
        // Check Git presence
        const gitDir = path.join(workspaceRoot, '.git');
        evidence.has_git = fs.existsSync(gitDir);

        if (evidence.has_git) {
            // Count commits
            try {
                const commitCountOutput = execSync('git rev-list --count HEAD', {
                    cwd: workspaceRoot,
                    encoding: 'utf-8',
                    stdio: ['pipe', 'pipe', 'ignore']
                }).trim();
                evidence.git_commits = parseInt(commitCountOutput, 10) || 0;
            } catch (e) {
                // No commits yet (empty repo)
                evidence.git_commits = 0;
            }

            // Get first commit date
            if (evidence.git_commits > 0) {
                try {
                    const firstCommitDate = execSync('git log --reverse --format=%ai --date=iso | head -1', {
                        cwd: workspaceRoot,
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'ignore']
                    }).trim();
                    evidence.first_commit_date = firstCommitDate || null;

                    if (evidence.first_commit_date) {
                        const firstDate = new Date(evidence.first_commit_date);
                        const now = new Date();
                        evidence.git_age_days = Math.floor((now.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
                    }
                } catch (e) {
                    // Ignore error
                }
            }

            // Get last commit date
            if (evidence.git_commits > 0) {
                try {
                    const lastCommitDate = execSync('git log -1 --format=%ai --date=iso', {
                        cwd: workspaceRoot,
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'ignore']
                    }).trim();
                    evidence.last_commit_date = lastCommitDate || null;

                    if (evidence.last_commit_date) {
                        const lastDate = new Date(evidence.last_commit_date);
                        const now = new Date();
                        const daysSinceLastCommit = Math.floor((now.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
                        evidence.recent_activity = daysSinceLastCommit <= 7;
                    }
                } catch (e) {
                    // Ignore error
                }
            }

            // Count contributors
            if (evidence.git_commits > 0) {
                try {
                    const contributorsOutput = execSync('git log --format="%an" | sort -u | wc -l', {
                        cwd: workspaceRoot,
                        encoding: 'utf-8',
                        stdio: ['pipe', 'pipe', 'ignore']
                    }).trim();
                    evidence.git_contributors = parseInt(contributorsOutput, 10) || 1;
                } catch (e) {
                    evidence.git_contributors = 1;
                }
            }
        }

        // Count files (exclude .git, node_modules, common ignore patterns)
        evidence.files_count = countFiles(workspaceRoot);

        // Check for package.json
        evidence.has_package_json = fs.existsSync(path.join(workspaceRoot, 'package.json'));

    } catch (error) {
        // Fallback: assume new workspace if detection fails
        console.error('OnboardingDetector: Error during detection', error);
    }

    // Determine mode and confidence
    return determineMode(evidence);
}

/**
 * Count files in workspace (excluding common ignore patterns)
 */
function countFiles(workspaceRoot: string): number {
    let count = 0;
    const ignorePatterns = ['.git', 'node_modules', '.reasoning_rl4', '.reasoning', 'dist', 'out', 'build', '.vscode'];

    function walk(dir: string): void {
        try {
            const entries = fs.readdirSync(dir, { withFileTypes: true });
            for (const entry of entries) {
                if (ignorePatterns.includes(entry.name)) {
                    continue;
                }

                const fullPath = path.join(dir, entry.name);
                if (entry.isDirectory()) {
                    walk(fullPath);
                } else {
                    count++;
                }
            }
        } catch (e) {
            // Ignore errors (permission denied, etc.)
        }
    }

    walk(workspaceRoot);
    return count;
}

/**
 * Determine workspace mode based on evidence
 */
function determineMode(evidence: WorkspaceState['evidence']): WorkspaceState {
    let mode: 'existing' | 'new' | 'ambiguous' = 'new';
    let confidence = 0.5;
    let recommendation = '';

    // Decision logic
    if (!evidence.has_git) {
        // No Git = definitely new
        mode = 'new';
        confidence = 0.95;
        recommendation = 'No Git history detected. Start fresh with RL4 from the first commit.';
    } else if (evidence.git_commits === 0) {
        // Empty Git repo = new
        mode = 'new';
        confidence = 0.90;
        recommendation = 'Git initialized but no commits yet. RL4 will observe from your first commit.';
    } else if (evidence.git_commits >= 50 && evidence.files_count >= 20) {
        // Significant history = existing
        mode = 'existing';
        confidence = 0.95;
        recommendation = 'Mature project detected. Recommend reconstructing cognitive history from Git.';
    } else if (evidence.git_commits >= 20 && evidence.files_count >= 10) {
        // Moderate history = existing
        mode = 'existing';
        confidence = 0.85;
        recommendation = 'Established project detected. History reconstruction available.';
    } else if (evidence.git_commits < 5 && evidence.files_count < 10) {
        // Minimal history = new
        mode = 'new';
        confidence = 0.85;
        recommendation = 'Early-stage project. RL4 will guide you from the beginning.';
    } else {
        // Ambiguous = unclear
        mode = 'ambiguous';
        confidence = 0.60;
        recommendation = 'Unclear project state. You can choose to reconstruct history or start fresh.';
    }

    // Adjust confidence based on additional signals
    if (evidence.recent_activity && mode === 'existing') {
        confidence = Math.min(confidence + 0.05, 1.0);
    }

    if (evidence.git_contributors > 1 && mode === 'existing') {
        confidence = Math.min(confidence + 0.05, 1.0);
    }

    if (evidence.has_package_json && evidence.files_count < 5) {
        // Package.json exists but few files = likely new project with boilerplate
        mode = 'new';
        confidence = 0.80;
        recommendation = 'New project with boilerplate detected. Start with RL4 from now.';
    }

    return {
        mode,
        confidence,
        evidence,
        recommendation
    };
}

/**
 * Format workspace state for human-readable display
 */
export function formatWorkspaceState(state: WorkspaceState): string {
    const { evidence } = state;
    let description = '';

    if (state.mode === 'existing') {
        description = `I detect an existing project with:\n`;
        description += `  • ${evidence.git_commits} commits`;
        if (evidence.git_age_days > 0) {
            description += ` across ${evidence.git_age_days} days`;
        }
        description += `\n`;
        if (evidence.git_contributors > 1) {
            description += `  • ${evidence.git_contributors} contributors\n`;
        }
        description += `  • ${evidence.files_count} files`;
        if (evidence.has_package_json) {
            description += ` (Node.js project)`;
        }
        description += `\n`;
        if (evidence.recent_activity) {
            description += `  • Recent activity (last 7 days)\n`;
        }
        description += `\n`;
        description += `${state.recommendation}`;
    } else if (state.mode === 'new') {
        description = `I detect a new project:\n`;
        if (evidence.has_git && evidence.git_commits === 0) {
            description += `  • Git initialized (no commits yet)\n`;
        } else if (!evidence.has_git) {
            description += `  • No Git history\n`;
        } else {
            description += `  • ${evidence.git_commits} commits (early stage)\n`;
        }
        description += `  • ${evidence.files_count} files\n`;
        description += `\n`;
        description += `${state.recommendation}`;
    } else {
        description = `I detect an ambiguous project state:\n`;
        description += `  • ${evidence.git_commits} commits\n`;
        description += `  • ${evidence.files_count} files\n`;
        description += `\n`;
        description += `${state.recommendation}`;
    }

    return description;
}


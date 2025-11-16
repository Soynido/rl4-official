/**
 * HumanContextManager - Level 3: Human & Organizational Context
 * 
 * Captures and manages human context around decisions:
 * - Contributors (from Git commits)
 * - Authors (ADR creators)
 * - Reviewers (from PRs)
 * - Team structure
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExecPool } from '../kernel/ExecPool';

export interface Contributor {
    name: string;
    email: string;
    firstSeen: string;          // ISO 8601
    lastSeen: string;           // ISO 8601
    commitCount: number;
    filesTouched: string[];     // Unique files
    domains: string[];          // Inferred expertise areas
}

export interface Author {
    name: string;
    email: string;
    adrCount: number;
    lastADR: string;            // ISO 8601
    domains: string[];          // ADR domains they work on
}

export interface ReviewContext {
    prNumber?: number;
    reviewers: string[];        // GitHub usernames
    approvedBy: string[];       // Reviewers who approved
    requestedBy: string;        // PR author
    comments: number;
}

export class HumanContextManager {
    private workspaceRoot: string;
    private contributors: Map<string, Contributor> = new Map();
    private log?: (msg: string) => void;
    private execPool: ExecPool;

    constructor(workspaceRoot: string, logFn?: (msg: string) => void, execPool?: ExecPool) {
        this.workspaceRoot = workspaceRoot;
        this.log = logFn;
        this.execPool = execPool || new ExecPool(2, 2000);
    }

    /**
     * Extract contributors from Git history
     */
    public async extractContributors(): Promise<Contributor[]> {
        try {
            this.log?.('👥 Extracting contributors from Git history...');
            
            const result = await this.execPool.run(
                'git log --pretty=format:"%an|%ae|%aI" --name-only',
                { cwd: this.workspaceRoot }
            );
            const stdout = result.stdout;

            const lines = stdout.split('\n');
            const contributorMap = new Map<string, Contributor>();

            let currentAuthor: string | null = null;
            let currentEmail: string | null = null;
            let currentDate: string | null = null;
            let currentFiles: Set<string> = new Set();

            for (const line of lines) {
                // Check if line is author info
                if (line.includes('|')) {
                    // Save previous contributor
                    if (currentAuthor && currentEmail && currentDate) {
                        this.updateContributor(
                            contributorMap,
                            currentAuthor,
                            currentEmail,
                            currentDate,
                            Array.from(currentFiles)
                        );
                    }

                    // Parse new author
                    const [name, email, date] = line.split('|');
                    currentAuthor = name;
                    currentEmail = email;
                    currentDate = date;
                    currentFiles = new Set();
                } else if (line.trim() && !line.startsWith(' ')) {
                    // This is a file path
                    currentFiles.add(line.trim());
                }
            }

            // Don't forget the last one
            if (currentAuthor && currentEmail && currentDate) {
                this.updateContributor(
                    contributorMap,
                    currentAuthor,
                    currentEmail,
                    currentDate,
                    Array.from(currentFiles)
                );
            }

            const contributors = Array.from(contributorMap.values());
            this.log?.(`👥 Found ${contributors.length} contributors`);
            
            return contributors;

        } catch (error) {
            this.log?.(`❌ Failed to extract contributors: ${error}`);
            return [];
        }
    }

    private updateContributor(
        map: Map<string, Contributor>,
        name: string,
        email: string,
        date: string,
        files: string[]
    ): void {
        const key = `${name}|${email}`;
        const existing = map.get(key);

        if (existing) {
            existing.commitCount++;
            if (date < existing.firstSeen) {
                existing.firstSeen = date;
            }
            if (date > existing.lastSeen) {
                existing.lastSeen = date;
            }
            files.forEach(f => existing.filesTouched.push(f));
            // Deduplicate files
            existing.filesTouched = [...new Set(existing.filesTouched)];
            // Update domains
            existing.domains = this.inferDomains(existing.filesTouched);
        } else {
            map.set(key, {
                name,
                email,
                firstSeen: date,
                lastSeen: date,
                commitCount: 1,
                filesTouched: files,
                domains: this.inferDomains(files)
            });
        }
    }

    /**
     * Infer expertise domains from files touched
     */
    private inferDomains(files: string[]): string[] {
        const domains = new Set<string>();

        for (const file of files) {
            if (file.includes('test') || file.endsWith('.test.ts') || file.endsWith('.spec.ts')) {
                domains.add('Testing');
            }
            if (file.includes('ui') || file.includes('component') || file.endsWith('.vue') || file.endsWith('.jsx')) {
                domains.add('Frontend');
            }
            if (file.includes('api') || file.includes('server') || file.includes('backend')) {
                domains.add('Backend');
            }
            if (file.includes('db') || file.includes('database') || file.includes('model')) {
                domains.add('Database');
            }
            if (file.includes('config') || file.includes('.env') || file.includes('deploy')) {
                domains.add('DevOps');
            }
            if (file.endsWith('.ts') || file.endsWith('.js') && !domains.has('Testing')) {
                domains.add('Core Logic');
            }
            if (file.includes('doc') || file.includes('README') || file.endsWith('.md')) {
                domains.add('Documentation');
            }
        }

        return Array.from(domains);
    }

    /**
     * Get most active contributors
     */
    public getTopContributors(count: number = 5): Contributor[] {
        const contributors = Array.from(this.contributors.values());
        return contributors
            .sort((a, b) => b.commitCount - a.commitCount)
            .slice(0, count);
    }

    /**
     * Find contributors for a specific file
     */
    public findContributorsForFile(filePath: string): Contributor[] {
        const contributors = Array.from(this.contributors.values());
        return contributors.filter(c => c.filesTouched.includes(filePath));
    }

    /**
     * Get contributors for a domain
     */
    public getContributorsByDomain(domain: string): Contributor[] {
        const contributors = Array.from(this.contributors.values());
        return contributors.filter(c => c.domains.includes(domain));
    }

    /**
     * Export human context to JSON
     */
    public exportHumanContext(contributors: Contributor[]): any {
        return {
            contributors: contributors.map(c => ({
                name: c.name,
                email: c.email,
                activity: {
                    firstSeen: c.firstSeen,
                    lastSeen: c.lastSeen,
                    commitCount: c.commitCount
                },
                expertise: c.domains,
                filesOwned: c.filesTouched.slice(0, 10) // Top 10 files
            })),
            summary: {
                totalContributors: contributors.length,
                totalCommits: contributors.reduce((sum, c) => sum + c.commitCount, 0),
                domains: [...new Set(contributors.flatMap(c => c.domains))]
            }
        };
    }
}


/**
 * CommitContextCollector - Collects real Git and RL4 data for commit enrichment
 * 
 * Collects ONLY real data:
 * - Git diff (actual changes)
 * - Git stats (insertions/deletions)
 * - Recent commit history
 * - ADRs from .reasoning_rl4/ADRs.RL4
 * - File change patterns from traces
 * 
 * NO AI, NO predictions - ONLY facts
 */

import * as fs from 'fs';
import * as path from 'path';
import { ExecPool } from '../ExecPool';

export interface CommitContext {
    // Git diff data
    diffStat: string;
    filesChanged: string[];
    diffContent: string; // Limited to first 100 lines of meaningful changes
    insertions: number;
    deletions: number;
    netChange: number;
    
    // Recent commit history
    recentCommits: Array<{
        hash: string;
        author: string;
        date: string;
        message: string;
    }>;
    
    // RL4 cognitive context
    activeADRs: Array<{
        id: string;
        title: string;
        status: string;
    }>;
    detectedPattern: {
        type: string;
        confidence: number;
        indicators: string[];
    } | null;
    timelineContext: Array<{
        file: string;
        edits: number;
        timestamp: string;
    }>;
    
    // Metadata
    workspaceRoot: string;
    timestamp: string;
    defaultBranch: string; // main or master
    githubRemote: string; // Remote name for GitHub repo (e.g., "rl4-official" or "origin")
}

export class CommitContextCollector {
    private workspaceRoot: string;
    private execPool: ExecPool;
    
    constructor(workspaceRoot: string, execPool?: ExecPool) {
        this.workspaceRoot = workspaceRoot;
        this.execPool = execPool || new ExecPool(2, 2000);
    }
    
    /**
     * Collect all real data for commit context
     */
    public async collectContext(): Promise<CommitContext> {
        const context: CommitContext = {
            diffStat: '',
            filesChanged: [],
            diffContent: '',
            insertions: 0,
            deletions: 0,
            netChange: 0,
            recentCommits: [],
            activeADRs: [],
            detectedPattern: null,
            timelineContext: [],
            workspaceRoot: this.workspaceRoot,
            timestamp: new Date().toISOString(),
            defaultBranch: 'main', // Will be detected
            githubRemote: 'origin' // Will be detected from GitHub token
        };
        
        // 1. Collect Git diff stat
        try {
            const statResult = await this.execPool.run(
                'git diff --stat',
                { cwd: this.workspaceRoot }
            );
            context.diffStat = statResult.stdout.trim();
            
            // Parse insertions/deletions from stat
            const statMatch = statResult.stdout.match(/(\d+) insertion.*?(\d+) deletion/);
            if (statMatch) {
                context.insertions = parseInt(statMatch[1]) || 0;
                context.deletions = parseInt(statMatch[2]) || 0;
                context.netChange = context.insertions - context.deletions;
            }
        } catch (error) {
            console.warn('Failed to get git diff stat:', error);
        }
        
        // 2. Collect files changed
        try {
            const filesResult = await this.execPool.run(
                'git diff --name-only',
                { cwd: this.workspaceRoot }
            );
            context.filesChanged = filesResult.stdout.trim().split('\n').filter(f => f);
        } catch (error) {
            console.warn('Failed to get files changed:', error);
        }
        
        // 3. Collect actual diff (limited to first 100 meaningful lines)
        try {
            // Use shell command for || operator
            const shellCommand = process.platform === 'win32'
                ? `cmd /c "git diff --cached 2>nul || git diff HEAD"`
                : `/bin/sh -c "git diff --cached 2>/dev/null || git diff HEAD"`;
            
            const diffResult = await this.execPool.run(
                shellCommand,
                { cwd: this.workspaceRoot }
            );
            const diffLines = diffResult.stdout.split('\n');
            
            // Extract meaningful parts (hunks with actual changes)
            const meaningfulLines: string[] = [];
            let inHunk = false;
            let linesAdded = 0;
            
            for (const line of diffLines) {
                if (line.startsWith('@@')) {
                    inHunk = true;
                    meaningfulLines.push(line);
                    linesAdded++;
                } else if (inHunk && (line.startsWith('+') || line.startsWith('-'))) {
                    meaningfulLines.push(line);
                    linesAdded++;
                } else if (inHunk && line.startsWith(' ')) {
                    // Context line - include a few for context
                    if (linesAdded < 5) {
                        meaningfulLines.push(line);
                        linesAdded++;
                    }
                }
                
                if (linesAdded >= 100) break;
            }
            
            context.diffContent = meaningfulLines.join('\n');
        } catch (error) {
            console.warn('Failed to get git diff:', error);
        }
        
        // 4. Collect recent commit history (last 5)
        try {
            const logResult = await this.execPool.run(
                'git log -5 --pretty=format:"%h|%an|%ad|%s" --date=short',
                { cwd: this.workspaceRoot }
            );
            
            context.recentCommits = logResult.stdout.trim().split('\n').filter(l => l).map(line => {
                const [hash, author, date, ...messageParts] = line.split('|');
                return {
                    hash: hash || '',
                    author: author || '',
                    date: date || '',
                    message: messageParts.join('|') || ''
                };
            });
        } catch (error) {
            console.warn('Failed to get recent commits:', error);
        }
        
        // 5. Load active ADRs from .reasoning_rl4/ADRs.RL4
        try {
            const adrsPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'ADRs.RL4');
            if (fs.existsSync(adrsPath)) {
                const adrsContent = fs.readFileSync(adrsPath, 'utf-8');
                
                // Parse ADRs (simple regex-based extraction)
                const adrMatches = adrsContent.matchAll(/##\s+ADR-(\d+):\s*(.+?)\n.*?Status[:\s]+(\w+)/gs);
                for (const match of adrMatches) {
                    context.activeADRs.push({
                        id: `ADR-${match[1]}`,
                        title: match[2].trim(),
                        status: match[3].trim()
                    });
                }
            }
        } catch (error) {
            console.warn('Failed to load ADRs:', error);
        }
        
        // 6. Load detected pattern from file changes
        try {
            const tracesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'file_changes.jsonl');
            if (fs.existsSync(tracesPath)) {
                const lines = fs.readFileSync(tracesPath, 'utf-8').split('\n').filter(l => l);
                
                // Get last file change event
                if (lines.length > 0) {
                    const lastEvent = JSON.parse(lines[lines.length - 1]);
                    if (lastEvent.metadata?.pattern) {
                        context.detectedPattern = {
                            type: lastEvent.metadata.pattern.type || 'unknown',
                            confidence: lastEvent.metadata.pattern.confidence || 0,
                            indicators: lastEvent.metadata.pattern.indicators || []
                        };
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to load pattern:', error);
        }
        
        // 7. Load timeline context (files modified in last 2h)
        try {
            const tracesPath = path.join(this.workspaceRoot, '.reasoning_rl4', 'traces', 'file_changes.jsonl');
            if (fs.existsSync(tracesPath)) {
                const lines = fs.readFileSync(tracesPath, 'utf-8').split('\n').filter(l => l);
                const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
                
                const fileEdits = new Map<string, number>();
                
                for (const line of lines) {
                    try {
                        const event = JSON.parse(line);
                        const eventTime = new Date(event.timestamp).getTime();
                        
                        if (eventTime >= twoHoursAgo) {
                            const changes = event.metadata?.changes || [];
                            for (const change of changes) {
                                const file = change.path || '';
                                if (file) {
                                    fileEdits.set(file, (fileEdits.get(file) || 0) + 1);
                                }
                            }
                        }
                    } catch (e) {
                        // Skip invalid lines
                    }
                }
                
                context.timelineContext = Array.from(fileEdits.entries())
                    .map(([file, edits]) => ({
                        file,
                        edits,
                        timestamp: new Date().toISOString()
                    }))
                    .slice(0, 10); // Top 10
            }
        } catch (error) {
            console.warn('Failed to load timeline context:', error);
        }
        
        // 8. Detect default branch (main or master)
        try {
            // Try to get default branch from remote
            const shellCmd1 = process.platform === 'win32'
                ? `cmd /c "git symbolic-ref refs/remotes/origin/HEAD 2>nul || echo."`
                : `/bin/sh -c "git symbolic-ref refs/remotes/origin/HEAD 2>/dev/null || echo ''"`;
            
            const remoteBranchResult = await this.execPool.run(shellCmd1, { cwd: this.workspaceRoot });
            const remoteBranch = remoteBranchResult.stdout.trim();
            if (remoteBranch && !remoteBranch.startsWith('fatal:')) {
                const branchMatch = remoteBranch.match(/refs\/remotes\/origin\/(.+)/);
                if (branchMatch) {
                    context.defaultBranch = branchMatch[1];
                }
            } else {
                // Fallback: check if main exists, otherwise use master
                const shellCmd2 = process.platform === 'win32'
                    ? `cmd /c "git rev-parse --verify main 2>nul && echo main || echo master"`
                    : `/bin/sh -c "git rev-parse --verify main 2>/dev/null && echo main || echo master"`;
                
                const mainExistsResult = await this.execPool.run(shellCmd2, { cwd: this.workspaceRoot });
                context.defaultBranch = mainExistsResult.stdout.trim() || 'main';
            }
        } catch (error) {
            console.warn('Failed to detect default branch, using main:', error);
            context.defaultBranch = 'main';
        }
        
        // 9. Detect GitHub remote from token configuration
        try {
            const githubTokenPath = path.join(this.workspaceRoot, '.reasoning', 'security', 'github.json');
            if (fs.existsSync(githubTokenPath)) {
                const tokenData = JSON.parse(fs.readFileSync(githubTokenPath, 'utf-8'));
                const repoSlug = tokenData.repo; // e.g., "Soynido/rl4-official"
                
                if (repoSlug) {
                    // Find which remote points to this repo
                    const remotesResult = await this.execPool.run(
                        'git remote -v',
                        { cwd: this.workspaceRoot }
                    );
                    const remotes = remotesResult.stdout.trim().split('\n');
                    
                    for (const remoteLine of remotes) {
                        if (remoteLine.includes(repoSlug)) {
                            const remoteMatch = remoteLine.match(/^(\S+)\s+/);
                            if (remoteMatch) {
                                context.githubRemote = remoteMatch[1];
                                console.log(`✅ Detected GitHub remote: ${context.githubRemote} → ${repoSlug}`);
                                break;
                            }
                        }
                    }
                }
            }
        } catch (error) {
            console.warn('Failed to detect GitHub remote from token, using origin:', error);
            // Keep default 'origin'
        }
        
        return context;
    }
}


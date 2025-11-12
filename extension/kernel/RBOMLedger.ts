/**
 * RBOMLedger - Append-Only RBOM Ledger with Merkle Verification
 * 
 * Replaces array-based ADR storage with append-only JSONL + Merkle root
 * 
 * Features:
 * - Append-only (immutable)
 * - Merkle tree for integrity
 * - Snapshot verification
 * - Fast head() lookup
 * 
 * RL4 Kernel Component #6
 */

import { AppendOnlyWriter } from './AppendOnlyWriter';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

export interface RBOMEntry {
    id: string;
    type: 'adr' | 'pattern' | 'correlation' | 'forecast';
    data: any;
    timestamp: string;
    hash: string;
}

export interface MerkleRoot {
    root: string;
    entryCount: number;
    timestamp: string;
}

export interface CycleSummary {
    cycleId: number;
    timestamp: string;
    phases: {
        patterns: { hash: string; count: number };
        correlations: { hash: string; count: number };
        forecasts: { hash: string; count: number };
        adrs: { hash: string; count: number };
    };
    merkleRoot: string;
    prevMerkleRoot: string; // Chain link to previous cycle
}

export class RBOMLedger {
    private writer: AppendOnlyWriter;
    private cyclesWriter: AppendOnlyWriter;
    private entries: RBOMEntry[] = [];
    private merkleRoots: MerkleRoot[] = [];
    private lastCycleMerkleRoot: string | null = null; // Cache for chain linking
    
    constructor(workspaceRootOrLedgerPath: string) {
        // Smart path resolution: if it ends with .jsonl, it's a file path
        // Otherwise, it's a workspace root and we construct the file paths
        let ledgerPath: string;
        let cyclesPath: string;
        
        if (workspaceRootOrLedgerPath.endsWith('.jsonl')) {
            // File path provided (e.g., from RBOMEngine)
            ledgerPath = workspaceRootOrLedgerPath;
            cyclesPath = ledgerPath.replace('rbom_ledger.jsonl', 'cycles.jsonl');
        } else {
            // Workspace root provided (e.g., from CognitiveScheduler)
            const ledgerDir = path.join(workspaceRootOrLedgerPath, '.reasoning_rl4', 'ledger');
            if (!fs.existsSync(ledgerDir)) {
                fs.mkdirSync(ledgerDir, { recursive: true });
            }
            ledgerPath = path.join(ledgerDir, 'rbom_ledger.jsonl');
            cyclesPath = path.join(ledgerDir, 'cycles.jsonl');
        }
        
        this.writer = new AppendOnlyWriter(ledgerPath);
        this.cyclesWriter = new AppendOnlyWriter(cyclesPath);
    }
    
    /**
     * Append entry to ledger
     * @param type - Entry type
     * @param data - Entry data
     * @returns Entry ID
     */
    async append(type: RBOMEntry['type'], data: any): Promise<string> {
        const id = this.generateId();
        const hash = this.calculateHash(data);
        
        const entry: RBOMEntry = {
            id,
            type,
            data,
            timestamp: new Date().toISOString(),
            hash
        };
        
        await this.writer.append(entry);
        this.entries.push(entry);
        
        return id;
    }
    
    /**
     * Get latest entry (head)
     */
    async head(): Promise<RBOMEntry | null> {
        if (this.entries.length > 0) {
            return this.entries[this.entries.length - 1];
        }
        
        // Load from disk if not in memory
        const allEntries = await this.writer.readAll();
        if (allEntries.length > 0) {
            return allEntries[allEntries.length - 1];
        }
        
        return null;
    }
    
    /**
     * Verify ledger integrity
     * @returns Verification result
     */
    async verify(): Promise<{ valid: boolean; errors: string[] }> {
        const entries = await this.writer.readAll();
        const errors: string[] = [];
        
        // Verify hashes
        for (const entry of entries) {
            const expectedHash = this.calculateHash(entry.data);
            if (entry.hash !== expectedHash) {
                errors.push(`Hash mismatch for entry ${entry.id}`);
            }
        }
        
        // Verify merkle roots
        for (const root of this.merkleRoots) {
            const calculatedRoot = this.calculateMerkleRoot(
                entries.slice(0, root.entryCount)
            );
            
            if (root.root !== calculatedRoot) {
                errors.push(`Merkle root mismatch at ${root.timestamp}`);
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Create merkle snapshot
     */
    async createMerkleSnapshot(): Promise<MerkleRoot> {
        const entries = await this.writer.readAll();
        const root = this.calculateMerkleRoot(entries);
        
        const snapshot: MerkleRoot = {
            root,
            entryCount: entries.length,
            timestamp: new Date().toISOString()
        };
        
        this.merkleRoots.push(snapshot);
        
        return snapshot;
    }
    
    /**
     * Calculate Merkle root from entries
     */
    private calculateMerkleRoot(entries: RBOMEntry[]): string {
        if (entries.length === 0) {
            return '';
        }
        
        const hashes = entries.map(e => e.hash);
        return this.merkleTreeRoot(hashes);
    }
    
    /**
     * Build Merkle tree and return root
     */
    private merkleTreeRoot(hashes: string[]): string {
        if (hashes.length === 0) return '';
        if (hashes.length === 1) return hashes[0];
        
        const nextLevel: string[] = [];
        
        for (let i = 0; i < hashes.length; i += 2) {
            const left = hashes[i];
            const right = hashes[i + 1] || left; // Duplicate if odd
            const combined = crypto.createHash('sha256')
                .update(left + right)
                .digest('hex');
            nextLevel.push(combined);
        }
        
        return this.merkleTreeRoot(nextLevel);
    }
    
    /**
     * Calculate hash of data (with stable serialization)
     */
    private calculateHash(data: any): string {
        const json = this.stableStringify(data);
        return crypto.createHash('sha256').update(json).digest('hex');
    }
    
    /**
     * Stable JSON serialization (deterministic key ordering)
     * Critical for consistent Merkle roots across runs
     */
    private stableStringify(obj: any): string {
        if (obj === null) return 'null';
        if (typeof obj !== 'object') return JSON.stringify(obj);
        if (Array.isArray(obj)) {
            return '[' + obj.map(item => this.stableStringify(item)).join(',') + ']';
        }
        
        // Sort keys alphabetically for deterministic output
        const sortedKeys = Object.keys(obj).sort();
        const pairs = sortedKeys.map(key => {
            const value = this.stableStringify(obj[key]);
            return `"${key}":${value}`;
        });
        
        return '{' + pairs.join(',') + '}';
    }
    
    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `rbom-${Date.now()}-${crypto.randomBytes(4).toString('hex')}`;
    }
    
    /**
     * Hash a batch of items (for phase-level integrity)
     * Uses stable serialization for deterministic hashing
     */
    hashBatch(items: any[]): string {
        if (items.length === 0) return '';
        const combined = this.stableStringify(items);
        return crypto.createHash('sha256').update(combined).digest('hex');
    }
    
    /**
     * Compute Merkle root from multiple hashes
     */
    computeRoot(hashes: string[]): string {
        return this.merkleTreeRoot(hashes);
    }
    
    /**
     * Append cycle summary to cycles.jsonl (with chain linking)
     */
    async appendCycle(cycleData: Omit<CycleSummary, 'prevMerkleRoot'>): Promise<void> {
        // Lazy init: load last cycle's merkleRoot if not cached (for first append after restart)
        if (this.lastCycleMerkleRoot === null) {
            const lastCycle = await this.getLastCycle();
            this.lastCycleMerkleRoot = lastCycle?.merkleRoot || null;
        }
        
        // Get previous cycle's Merkle root for chain linking (use cache)
        const prevMerkleRoot = this.lastCycleMerkleRoot || '0000000000000000'; // Genesis
        
        // Compute Merkle root from phase hashes (deterministic)
        const phaseHashes = [
            cycleData.phases.patterns.hash,
            cycleData.phases.correlations.hash,
            cycleData.phases.forecasts.hash,
            cycleData.phases.adrs.hash
        ].filter(h => h.length > 0); // Remove empty hashes
        
        const merkleRoot = this.computeRoot(phaseHashes);
        
        const cycle: CycleSummary = {
            ...cycleData,
            merkleRoot,
            prevMerkleRoot
        };
        
        await this.cyclesWriter.append(cycle);
        
        // Update cache for next cycle
        this.lastCycleMerkleRoot = merkleRoot;
    }
    
    /**
     * Get last cycle summary
     */
    async getLastCycle(): Promise<CycleSummary | null> {
        const cycles = await this.cyclesWriter.readAll();
        return cycles.length > 0 ? cycles[cycles.length - 1] : null;
    }
    
    /**
     * Get all cycles (for validation/analysis)
     */
    async getAllCycles(): Promise<CycleSummary[]> {
        return await this.cyclesWriter.readAll();
    }
    
    /**
     * Verify entire chain (expensive - use sparingly)
     * @param options.deep - Also verify inter-cycle chain (prevMerkleRoot links)
     */
    async verifyChain(options: { deep?: boolean } = {}): Promise<boolean> {
        const result = await this.verify();
        if (!result.valid) return false;
        
        // Verify cycles
        const cycles = await this.cyclesWriter.readAll();
        for (let i = 0; i < cycles.length; i++) {
            const cycle = cycles[i];
            
            // 1. Verify phase hashes → merkleRoot
            const phaseHashes = [
                cycle.phases.patterns.hash,
                cycle.phases.correlations.hash,
                cycle.phases.forecasts.hash,
                cycle.phases.adrs.hash
            ];
            const recomputedRoot = this.computeRoot(phaseHashes);
            if (recomputedRoot !== cycle.merkleRoot) {
                return false;
            }
            
            // 2. Verify inter-cycle chain (deep mode)
            if (options.deep && i > 0) {
                const prevCycle = cycles[i - 1];
                if (cycle.prevMerkleRoot !== prevCycle.merkleRoot) {
                    return false; // Chain broken!
                }
            }
        }
        
        return true;
    }
    
    /**
     * Flush writers
     */
    async flush(): Promise<void> {
        await this.writer.flush(true); // fsync
        await this.cyclesWriter.flush(true); // fsync
    }
}

/**
 * Expose ledger instance to globalThis for VS Code commands
 * This allows async commands to wait for initialization
 */
export function setGlobalLedger(instance: RBOMLedger): void {
    (globalThis as any).RBOM_LEDGER = instance;
}


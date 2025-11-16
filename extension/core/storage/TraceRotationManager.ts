/**
 * Trace Rotation Manager - Sprint 2, Task 2.1
 * 
 * Gère la rotation et compression automatique des traces
 * 
 * Strategy:
 * - Keep last 30 days uncompressed (fast access)
 * - Compress traces > 30 days to .gz (save space)
 * - Archive traces > 90 days (cold storage)
 * - Delete traces > 180 days (cleanup)
 * 
 * Benefits:
 * - Storage: 6.8GB → < 500MB
 * - Performance: Fast recent access
 * - Compliance: Automatic retention policy
 */

import * as fs from 'fs';
import { promises as fsp } from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface RotationReport {
    timestamp: string;
    filesProcessed: number;
    compressed: number;
    archived: number;
    deleted: number;
    spaceSaved: number;
    errors: string[];
}

export interface TraceStats {
    totalFiles: number;
    totalSize: number;
    compressedFiles: number;
    archivedFiles: number;
    oldestTrace: Date | null;
    newestTrace: Date | null;
    avgFileSize: number;
}

export class TraceRotationManager {
    private workspaceRoot: string;
    private tracesDir: string;
    
    // Configuration (can be made configurable later)
    private readonly MAX_UNCOMPRESSED_DAYS = 30;
    private readonly MAX_COMPRESSED_DAYS = 90;
    private readonly MAX_ARCHIVED_DAYS = 180;
    private readonly MAX_TRACE_SIZE_MB = 500; // Per workspace
    
    constructor(workspaceRoot: string) {
        this.workspaceRoot = workspaceRoot;
        this.tracesDir = path.join(workspaceRoot, '.reasoning', 'traces');
    }
    
    /**
     * ✅ ROTATE: Exécute la rotation automatique complète
     */
    public async rotate(): Promise<RotationReport> {
        const report: RotationReport = {
            timestamp: new Date().toISOString(),
            filesProcessed: 0,
            compressed: 0,
            archived: 0,
            deleted: 0,
            spaceSaved: 0,
            errors: []
        };
        
        if (!fs.existsSync(this.tracesDir)) {
            return report;
        }
        
        console.log('🔄 Starting trace rotation...');
        
        const files = await fsp.readdir(this.tracesDir);
        const now = Date.now();
        
        for (const file of files) {
            // Skip directories and non-JSON files
            if (file === 'archive' || (!file.endsWith('.json') && !file.endsWith('.gz'))) {
                continue;
            }
            
            const filePath = path.join(this.tracesDir, file);
            
            try {
                const stats = await fsp.stat(filePath);
                
                if (!stats.isFile()) {
                    continue;
                }
                
                const ageInDays = (now - stats.mtimeMs) / (1000 * 60 * 60 * 24);
                
                report.filesProcessed++;
                
                // Action 1: Delete if > 180 days
                if (ageInDays > this.MAX_ARCHIVED_DAYS) {
                    const size = stats.size;
                    await fsp.unlink(filePath);
                    report.deleted++;
                    report.spaceSaved += size;
                    console.log(`🗑️  Deleted ${file} (${ageInDays.toFixed(0)} days old, saved ${(size / 1024).toFixed(1)}KB)`);
                    continue;
                }
                
                // Action 2: Archive if > 90 days
                if (ageInDays > this.MAX_COMPRESSED_DAYS && !file.includes('.archive')) {
                    const spaceSaved = await this.archiveTrace(filePath);
                    report.archived++;
                    report.spaceSaved += spaceSaved;
                    console.log(`📦 Archived ${file} (saved ${(spaceSaved / 1024).toFixed(1)}KB)`);
                    continue;
                }
                
                // Action 3: Compress if > 30 days
                if (ageInDays > this.MAX_UNCOMPRESSED_DAYS && !file.endsWith('.gz')) {
                    const spaceSaved = await this.compressTrace(filePath);
                    report.compressed++;
                    report.spaceSaved += spaceSaved;
                    console.log(`🗜️  Compressed ${file} (saved ${(spaceSaved / 1024).toFixed(1)}KB)`);
                }
            } catch (error) {
                const errorMsg = `Failed to process ${file}: ${(error as Error).message}`;
                report.errors.push(errorMsg);
                console.error(`❌ ${errorMsg}`);
            }
        }
        
        // Vérifier la taille totale
        const totalSize = await this.getTotalSize();
        const totalSizeMB = totalSize / (1024 * 1024);
        
        if (totalSizeMB > this.MAX_TRACE_SIZE_MB) {
            console.warn(`⚠️  Total traces size ${totalSizeMB.toFixed(1)}MB exceeds limit of ${this.MAX_TRACE_SIZE_MB}MB`);
            report.errors.push(`Total size ${totalSizeMB.toFixed(1)}MB exceeds limit`);
        }
        
        console.log(`✅ Rotation complete: ${report.compressed} compressed, ${report.archived} archived, ${report.deleted} deleted`);
        console.log(`   Space saved: ${(report.spaceSaved / 1024 / 1024).toFixed(1)}MB`);
        
        return report;
    }
    
    /**
     * 🗜️ COMPRESS: Compresse un fichier de trace en gzip
     */
    private async compressTrace(filePath: string): Promise<number> {
        const originalSize = (await fsp.stat(filePath)).size;
        const gzPath = filePath + '.gz';
        
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(filePath);
            const output = fs.createWriteStream(gzPath);
            const gzip = zlib.createGzip({ level: 9 }); // Maximum compression
            
            input.pipe(gzip).pipe(output);
            
            output.on('finish', async () => {
                try {
                    // Supprimer l'original après compression réussie
                    await fsp.unlink(filePath);
                    
                    const compressedSize = (await fsp.stat(gzPath)).size;
                    const saved = originalSize - compressedSize;
                    resolve(saved);
                } catch (error) {
                    reject(error);
                }
            });
            
            output.on('error', reject);
            input.on('error', reject);
        });
    }
    
    /**
     * 📦 ARCHIVE: Archive un fichier (compress + move to archive/)
     */
    private async archiveTrace(filePath: string): Promise<number> {
        const archiveDir = path.join(this.tracesDir, 'archive');
        await fsp.mkdir(archiveDir, { recursive: true });
        
        const fileName = path.basename(filePath);
        const archiveName = fileName.replace('.json', '.archive.json');
        const archivePath = path.join(archiveDir, archiveName + '.gz');
        
        // Compresser d'abord
        const originalSize = (await fsp.stat(filePath)).size;
        
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(filePath);
            const output = fs.createWriteStream(archivePath);
            const gzip = zlib.createGzip({ level: 9 });
            
            input.pipe(gzip).pipe(output);
            
            output.on('finish', async () => {
                try {
                    // Supprimer l'original
                    await fsp.unlink(filePath);
                    
                    const archivedSize = (await fsp.stat(archivePath)).size;
                    const saved = originalSize - archivedSize;
                    resolve(saved);
                } catch (error) {
                    reject(error);
                }
            });
            
            output.on('error', reject);
            input.on('error', reject);
        });
    }
    
    /**
     * 📊 STATS: Récupère les statistiques de stockage
     */
    public async getStats(): Promise<TraceStats> {
        if (!fs.existsSync(this.tracesDir)) {
            return {
                totalFiles: 0,
                totalSize: 0,
                compressedFiles: 0,
                archivedFiles: 0,
                oldestTrace: null,
                newestTrace: null,
                avgFileSize: 0
            };
        }
        
        const files = await fsp.readdir(this.tracesDir);
        let totalSize = 0;
        let compressedCount = 0;
        let oldestDate: Date | null = null;
        let newestDate: Date | null = null;
        let fileCount = 0;
        
        for (const file of files) {
            if (file === 'archive') continue;
            
            const filePath = path.join(this.tracesDir, file);
            
            try {
                const stats = await fsp.stat(filePath);
                
                if (!stats.isFile()) continue;
                
                fileCount++;
                totalSize += stats.size;
                
                if (file.endsWith('.gz')) {
                    compressedCount++;
                }
                
                if (!oldestDate || stats.mtime < oldestDate) {
                    oldestDate = stats.mtime;
                }
                if (!newestDate || stats.mtime > newestDate) {
                    newestDate = stats.mtime;
                }
            } catch (error) {
                // Skip files that can't be read
            }
        }
        
        // Count archived files
        const archiveDir = path.join(this.tracesDir, 'archive');
        const archivedCount = fs.existsSync(archiveDir) 
            ? (await fsp.readdir(archiveDir)).length 
            : 0;
        
        return {
            totalFiles: fileCount,
            totalSize,
            compressedFiles: compressedCount,
            archivedFiles: archivedCount,
            oldestTrace: oldestDate,
            newestTrace: newestDate,
            avgFileSize: fileCount > 0 ? totalSize / fileCount : 0
        };
    }
    
    /**
     * 📏 SIZE: Calcule la taille totale des traces
     */
    private async getTotalSize(): Promise<number> {
        if (!fs.existsSync(this.tracesDir)) {
            return 0;
        }
        
        let total = 0;
        const files = await fsp.readdir(this.tracesDir, { recursive: true, withFileTypes: true });
        
        for (const file of files) {
            if (file.isFile()) {
                const filePath = path.join(file.path, file.name);
                try {
                    const stats = await fsp.stat(filePath);
                    total += stats.size;
                } catch (error) {
                    // Skip
                }
            }
        }
        
        return total;
    }
    
    /**
     * 🧹 CLEANUP: Nettoyage agressif si taille dépasse la limite
     */
    public async aggressiveCleanup(): Promise<RotationReport> {
        console.log('🧹 Running aggressive cleanup...');
        
        // Forcer la compression de tous les fichiers > 7 jours
        const tempMaxDays = this.MAX_UNCOMPRESSED_DAYS;
        (this as any).MAX_UNCOMPRESSED_DAYS = 7;
        
        const report = await this.rotate();
        
        (this as any).MAX_UNCOMPRESSED_DAYS = tempMaxDays;
        
        return report;
    }
    
    /**
     * 📂 DECOMPRESS: Décompresse un fichier .gz (pour accès aux archives)
     */
    public async decompressTrace(gzPath: string, outputPath?: string): Promise<void> {
        if (!fs.existsSync(gzPath)) {
            throw new Error(`File not found: ${gzPath}`);
        }
        
        const output = outputPath || gzPath.replace('.gz', '');
        
        return new Promise((resolve, reject) => {
            const input = fs.createReadStream(gzPath);
            const outputStream = fs.createWriteStream(output);
            const gunzip = zlib.createGunzip();
            
            input.pipe(gunzip).pipe(outputStream);
            
            outputStream.on('finish', () => resolve());
            outputStream.on('error', reject);
            input.on('error', reject);
        });
    }
}


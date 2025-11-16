/**
 * Cognitive Sandbox - Workspace temporaire pour scripts cognitifs
 * 
 * Sépare le code de production (extension/) du code cognitif temporaire
 * 
 * Architecture:
 * - ~/.rl3/sandbox/ : Scripts cognitifs générés dynamiquement
 * - extension/ : Code permanent de l'extension
 * 
 * Bénéfices:
 * - Pas de pollution du code source
 * - Scripts temporaires isolés
 * - Nettoyage facile
 * - VSIX reste léger
 * 
 * Usage:
 *   const sandbox = CognitiveSandbox.getPath(workspaceRoot);
 *   const scriptPath = CognitiveSandbox.createFile(workspaceRoot, 'task.js', code);
 *   CognitiveSandbox.cleanup(workspaceRoot, 30); // Delete files > 30 days
 */

import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import { promises as fsp } from 'fs';
import { ExecPool } from '../../kernel/ExecPool';

export class CognitiveSandbox {
    /**
     * Base directory pour tous les sandboxes
     * Location: ~/.rl3/sandbox/
     */
    static readonly BASE_DIR = path.join(os.homedir(), '.rl3', 'sandbox');
    
    /**
     * Retourne le chemin du sandbox pour un workspace donné
     * 
     * @param workspaceRoot - Chemin du workspace
     * @returns Chemin du sandbox (ex: ~/.rl3/sandbox/MyProject/)
     */
    static getPath(workspaceRoot: string): string {
        const folderName = path.basename(workspaceRoot);
        const sandboxDir = path.join(this.BASE_DIR, folderName);
        
        // Créer le dossier si nécessaire
        if (!fs.existsSync(sandboxDir)) {
            fs.mkdirSync(sandboxDir, { recursive: true });
        }
        
        return sandboxDir;
    }
    
    /**
     * Crée un fichier dans le sandbox
     * 
     * @param workspaceRoot - Chemin du workspace
     * @param filename - Nom du fichier (ex: 'repair-ledger.js')
     * @param content - Contenu du fichier
     * @returns Chemin complet du fichier créé
     */
    static createFile(workspaceRoot: string, filename: string, content: string): string {
        const sandboxDir = this.getPath(workspaceRoot);
        const filePath = path.join(sandboxDir, filename);
        
        // Créer sous-dossier si nécessaire
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        
        fs.writeFileSync(filePath, content, 'utf-8');
        
        console.log(`📝 Sandbox file created: ~/.rl3/sandbox/${path.basename(workspaceRoot)}/${filename}`);
        
        return filePath;
    }
    
    /**
     * Crée un fichier exécutable dans le sandbox
     */
    static createExecutable(workspaceRoot: string, filename: string, content: string): string {
        const filePath = this.createFile(workspaceRoot, filename, content);
        
        // Rendre exécutable (chmod +x)
        fs.chmodSync(filePath, 0o755);
        
        return filePath;
    }
    
    /**
     * Liste tous les fichiers du sandbox
     */
    static listFiles(workspaceRoot: string): string[] {
        const sandboxDir = this.getPath(workspaceRoot);
        
        if (!fs.existsSync(sandboxDir)) {
            return [];
        }
        
        const files: string[] = [];
        const entries = fs.readdirSync(sandboxDir, { withFileTypes: true, recursive: true });
        
        for (const entry of entries) {
            if (entry.isFile()) {
                const relativePath = path.relative(sandboxDir, path.join(entry.path, entry.name));
                files.push(relativePath);
            }
        }
        
        return files;
    }
    
    /**
     * Nettoie les fichiers anciens du sandbox
     * 
     * @param workspaceRoot - Chemin du workspace
     * @param maxAgeDays - Âge maximum en jours (défaut: 30)
     * @returns Nombre de fichiers supprimés
     */
    static async cleanup(workspaceRoot: string, maxAgeDays: number = 30): Promise<number> {
        const sandboxDir = this.getPath(workspaceRoot);
        
        if (!fs.existsSync(sandboxDir)) {
            return 0;
        }
        
        const now = Date.now();
        const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
        let deletedCount = 0;
        
        const entries = await fsp.readdir(sandboxDir, { withFileTypes: true, recursive: true });
        
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            
            const filePath = path.join(entry.path, entry.name);
            const stats = await fsp.stat(filePath);
            const age = now - stats.mtimeMs;
            
            if (age > maxAgeMs) {
                await fsp.unlink(filePath);
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            console.log(`🧹 Cleaned ${deletedCount} files from sandbox (> ${maxAgeDays} days)`);
        }
        
        return deletedCount;
    }
    
    /**
     * Supprime complètement le sandbox d'un workspace
     */
    static async destroySandbox(workspaceRoot: string): Promise<void> {
        const sandboxDir = this.getPath(workspaceRoot);
        
        if (fs.existsSync(sandboxDir)) {
            await fsp.rm(sandboxDir, { recursive: true, force: true });
            console.log(`🗑️  Sandbox destroyed: ${sandboxDir}`);
        }
    }
    
    /**
     * Retourne les statistiques du sandbox
     */
    static async getStats(workspaceRoot: string): Promise<SandboxStats> {
        const sandboxDir = this.getPath(workspaceRoot);
        
        if (!fs.existsSync(sandboxDir)) {
            return {
                exists: false,
                totalFiles: 0,
                totalSize: 0,
                oldestFile: null,
                newestFile: null
            };
        }
        
        let totalSize = 0;
        let fileCount = 0;
        let oldestDate: Date | null = null;
        let newestDate: Date | null = null;
        
        const entries = await fsp.readdir(sandboxDir, { withFileTypes: true, recursive: true });
        
        for (const entry of entries) {
            if (!entry.isFile()) continue;
            
            const filePath = path.join(entry.path, entry.name);
            const stats = await fsp.stat(filePath);
            
            fileCount++;
            totalSize += stats.size;
            
            if (!oldestDate || stats.mtime < oldestDate) {
                oldestDate = stats.mtime;
            }
            if (!newestDate || stats.mtime > newestDate) {
                newestDate = stats.mtime;
            }
        }
        
        return {
            exists: true,
            totalFiles: fileCount,
            totalSize,
            oldestFile: oldestDate,
            newestFile: newestDate
        };
    }
    
    /**
     * Exécute un script depuis le sandbox
     */
    static async executeScript(
        workspaceRoot: string, 
        filename: string, 
        args: string[] = [],
        execPool?: ExecPool
    ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
        const sandboxDir = this.getPath(workspaceRoot);
        const scriptPath = path.join(sandboxDir, filename);
        
        if (!fs.existsSync(scriptPath)) {
            throw new Error(`Script not found in sandbox: ${filename}`);
        }
        
        const pool = execPool || new ExecPool(2, 30000); // 30s timeout for sandbox scripts
        
        try {
            const command = `node "${scriptPath}" ${args.join(' ')}`;
            const result = await pool.run(command, {
                cwd: workspaceRoot,
                timeout: 30000 // 30s for sandbox scripts
            });
            
            return {
                stdout: result.stdout || '',
                stderr: result.stderr || '',
                exitCode: 0
            };
        } catch (error: any) {
            return {
                stdout: '',
                stderr: error.message || 'Execution failed',
                exitCode: 1
            };
        }
    }
    
    /**
     * Copie un fichier du workspace vers le sandbox (pour archivage)
     */
    static async archiveFromWorkspace(
        workspaceRoot: string,
        sourceRelativePath: string,
        targetName?: string
    ): Promise<string> {
        const sourcePath = path.join(workspaceRoot, sourceRelativePath);
        const targetFilename = targetName || path.basename(sourceRelativePath);
        const sandboxDir = this.getPath(workspaceRoot);
        const targetPath = path.join(sandboxDir, 'archive', targetFilename);
        
        await fsp.mkdir(path.dirname(targetPath), { recursive: true });
        await fsp.copyFile(sourcePath, targetPath);
        
        console.log(`📦 Archived to sandbox: ${targetFilename}`);
        
        return targetPath;
    }
}

export interface SandboxStats {
    exists: boolean;
    totalFiles: number;
    totalSize: number;
    oldestFile: Date | null;
    newestFile: Date | null;
}


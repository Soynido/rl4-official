/**
 * Async Write Queue - Sprint 2, Task 2.2
 * 
 * File d'attente pour écritures asynchrones non-bloquantes
 * 
 * Benefits:
 * - Ne bloque plus le thread principal VS Code
 * - Batching automatique (10 écritures par batch)
 * - Gestion d'erreurs centralisée
 * - Performances améliorées
 * 
 * Replaces: 102 fs.writeFileSync synchrones → async
 */

import { promises as fsp } from 'fs';
import * as path from 'path';

export interface WriteOperation {
    filePath: string;
    data: string | Buffer;
    resolve: () => void;
    reject: (error: any) => void;
    timestamp: number;
    priority: 'high' | 'normal' | 'low';
}

export interface QueueStats {
    pending: number;
    processed: number;
    failed: number;
    avgProcessTime: number;
}

export class AsyncWriteQueue {
    private queue: WriteOperation[] = [];
    private processing = false;
    private readonly BATCH_SIZE = 10;
    private readonly BATCH_DELAY_MS = 100;
    
    // Stats
    private stats = {
        processed: 0,
        failed: 0,
        totalProcessTime: 0
    };
    
    /**
     * ✅ WRITE: Ajoute une opération d'écriture à la queue
     */
    public async write(
        filePath: string, 
        data: string | Buffer,
        priority: 'high' | 'normal' | 'low' = 'normal'
    ): Promise<void> {
        return new Promise((resolve, reject) => {
            this.queue.push({
                filePath,
                data,
                resolve,
                reject,
                timestamp: Date.now(),
                priority
            });
            
            // Démarrer le traitement si pas déjà en cours
            if (!this.processing) {
                void this.processQueue();
            }
        });
    }
    
    /**
     * 🔄 PROCESS: Traite la queue par batches
     */
    private async processQueue(): Promise<void> {
        if (this.processing || this.queue.length === 0) {
            return;
        }
        
        this.processing = true;
        
        while (this.queue.length > 0) {
            // Trier par priorité (high > normal > low)
            this.queue.sort((a, b) => {
                const priorityOrder = { 'high': 3, 'normal': 2, 'low': 1 };
                return priorityOrder[b.priority] - priorityOrder[a.priority];
            });
            
            // Extraire un batch
            const batch = this.queue.splice(0, this.BATCH_SIZE);
            
            const startTime = Date.now();
            
            // Traiter le batch en parallèle
            const results = await Promise.allSettled(
                batch.map(op => this.writeFile(op))
            );
            
            const processTime = Date.now() - startTime;
            this.stats.totalProcessTime += processTime;
            
            // Compter succès/échecs
            results.forEach(result => {
                if (result.status === 'fulfilled') {
                    this.stats.processed++;
                } else {
                    this.stats.failed++;
                }
            });
            
            // Attendre un peu avant le prochain batch (éviter surcharge I/O)
            if (this.queue.length > 0) {
                await new Promise(resolve => setTimeout(resolve, this.BATCH_DELAY_MS));
            }
        }
        
        this.processing = false;
    }
    
    /**
     * 📝 WRITE FILE: Écrit un fichier de manière asynchrone
     */
    private async writeFile(op: WriteOperation): Promise<void> {
        try {
            // Créer le dossier parent si nécessaire
            await fsp.mkdir(path.dirname(op.filePath), { recursive: true });
            
            // Écrire le fichier (async, non-bloquant)
            await fsp.writeFile(op.filePath, op.data, 'utf-8');
            
            op.resolve();
        } catch (error) {
            console.error(`❌ Failed to write ${op.filePath}:`, error);
            op.reject(error);
        }
    }
    
    /**
     * 📊 STATS: Retourne le nombre d'opérations en attente
     */
    public getPendingCount(): number {
        return this.queue.length;
    }
    
    /**
     * 📈 GET STATS: Retourne les statistiques de la queue
     */
    public getStats(): QueueStats {
        return {
            pending: this.queue.length,
            processed: this.stats.processed,
            failed: this.stats.failed,
            avgProcessTime: this.stats.processed > 0 
                ? this.stats.totalProcessTime / this.stats.processed 
                : 0
        };
    }
    
    /**
     * ⚡ FLUSH: Force le traitement immédiat de toute la queue
     */
    public async flush(): Promise<void> {
        while (this.queue.length > 0) {
            await this.processQueue();
        }
    }
    
    /**
     * 🧹 CLEAR: Vide la queue (annule les écritures en attente)
     */
    public clear(): void {
        // Rejeter toutes les opérations en attente
        this.queue.forEach(op => {
            op.reject(new Error('Queue cleared'));
        });
        
        this.queue = [];
    }
    
    /**
     * ⏸️ PAUSE: Met la queue en pause
     */
    public pause(): void {
        this.processing = true; // Empêche le traitement
    }
    
    /**
     * ▶️ RESUME: Reprend le traitement
     */
    public resume(): void {
        this.processing = false;
        void this.processQueue();
    }
}

// ✅ SINGLETON: Instance globale partagée
export const writeQueue = new AsyncWriteQueue();


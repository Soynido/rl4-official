import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { execSync } from 'child_process';

/**
 * 🧠 AutoPackager - RL3 Self-Packaging System
 * ============================================
 * 
 * Compile + Package + Install extension automatically (.vsix)
 * 
 * Features:
 * - Auto-compilation (TypeScript → JavaScript)
 * - Auto-packaging (.vsix generation)
 * - Auto-installation (Cursor/VS Code)
 * - Version bump (optional)
 * - Real-time logging with timestamps
 * 
 * Commands:
 * - RL3: Auto Package (compile + package + install)
 * - RL3: Quick Rebuild (compile + package only)
 */

export class AutoPackager {
    private workspaceRoot: string;
    private outputChannel: vscode.OutputChannel;

    constructor(workspaceRoot: string, outputChannel?: vscode.OutputChannel) {
        this.workspaceRoot = workspaceRoot;
        this.outputChannel = outputChannel || vscode.window.createOutputChannel('Reasoning Layer V3');
    }

    /**
     * Full auto-package: compile + package + install
     */
    public async run(options: { bumpVersion?: boolean; installLocally?: boolean } = {}): Promise<void> {
        this.outputChannel.show(true);
        this.log('🧠', 'AutoPackager launched');
        this.log('📁', `Workspace: ${this.workspaceRoot}`);

        const startTime = Date.now();

        try {
            // Step 0: Optional version bump
            if (options.bumpVersion) {
                this.log('🔢', 'Step 0 — Version bump...');
                this.bumpVersion();
            }

            // Step 1: Compilation
            this.log('🧩', 'Step 1 — Compilation TypeScript → JavaScript...');
            this.compile();
            this.log('✅', 'Compilation réussie');

            // Step 2: Packaging
            this.log('📦', 'Step 2 — Packaging extension → .vsix...');
            const vsixPath = this.package();
            this.log('✅', `Package créé: ${path.basename(vsixPath)}`);
            this.log('📦', `Fichier: ${vsixPath}`);

            // Step 3: Optional local installation
            if (options.installLocally !== false) {
                this.log('⚙️', 'Step 3 — Installation locale...');
                this.install(vsixPath);
                this.log('✅', 'Extension installée localement');
                this.log('🔄', 'Rechargez la fenêtre pour activer: Cmd+Shift+P → "Developer: Reload Window"');
            }

            const duration = Date.now() - startTime;
            this.log('🎉', `AutoPackager terminé avec succès en ${(duration / 1000).toFixed(1)}s`);
            this.log('📋', 'Prêt à distribuer: envoyez le .vsix à vos amis !');

            // Show success notification
            vscode.window.showInformationMessage(
                `✅ Extension packagée avec succès ! (${(duration / 1000).toFixed(1)}s)`,
                'Ouvrir le fichier',
                'Recharger la fenêtre'
            ).then(selection => {
                if (selection === 'Ouvrir le fichier') {
                    vscode.commands.executeCommand('revealFileInOS', vscode.Uri.file(vsixPath));
                } else if (selection === 'Recharger la fenêtre') {
                    vscode.commands.executeCommand('workbench.action.reloadWindow');
                }
            });

        } catch (error: any) {
            const duration = Date.now() - startTime;
            this.log('❌', `Erreur après ${(duration / 1000).toFixed(1)}s: ${error.message}`);
            this.log('💡', 'Vérifiez que vsce est installé: npm install -g @vscode/vsce');
            
            vscode.window.showErrorMessage(
                `❌ AutoPackager échoué: ${error.message}`,
                'Voir les logs'
            ).then(selection => {
                if (selection === 'Voir les logs') {
                    this.outputChannel.show(true);
                }
            });
            
            throw error;
        }
    }

    /**
     * Quick rebuild: compile + package only (no install)
     */
    public async quickRebuild(): Promise<string> {
        this.outputChannel.show(true);
        this.log('⚡', 'Quick Rebuild launched (no installation)');

        try {
            this.log('🧩', 'Compilation...');
            this.compile();
            this.log('✅', 'Compilation réussie');

            this.log('📦', 'Packaging...');
            const vsixPath = this.package();
            this.log('✅', `Package créé: ${path.basename(vsixPath)}`);

            this.log('🎉', 'Quick Rebuild terminé');
            return vsixPath;
        } catch (error: any) {
            this.log('❌', `Erreur: ${error.message}`);
            throw error;
        }
    }

    /**
     * Step 1: Compile TypeScript
     */
    private compile(): void {
        const startTime = Date.now();
        
        try {
            this.log('🔧', 'Running: npm run compile');
            const result = execSync('npm run compile', {
                cwd: this.workspaceRoot,
                stdio: 'pipe',
                encoding: 'utf-8'
            });
            
            const duration = Date.now() - startTime;
            this.log('⏱️', `Compilation terminée en ${(duration / 1000).toFixed(1)}s`);
        } catch (error: any) {
            this.log('❌', `Compilation error: ${error.message}`);
            if (error.stdout) {
                this.log('📝', `stdout: ${error.stdout}`);
            }
            if (error.stderr) {
                this.log('📝', `stderr: ${error.stderr}`);
            }
            throw new Error(`Compilation failed: ${error.message}`);
        }
    }

    /**
     * Step 2: Package to .vsix
     */
    private package(): string {
        const startTime = Date.now();
        const packageJson = this.getPackageJson();
        const version = packageJson.version;
        const vsixName = `reasoning-layer-v3-${version}.vsix`;
        const vsixPath = path.join(this.workspaceRoot, vsixName);

        // Remove old .vsix files to avoid confusion
        this.cleanOldVsix();

        try {
            this.log('📦', 'Running: vsce package --no-dependencies --allow-package-all-secrets');
            const result = execSync('vsce package --no-dependencies --allow-package-all-secrets', {
                cwd: this.workspaceRoot,
                stdio: 'pipe',
                encoding: 'utf-8'
            });

            const duration = Date.now() - startTime;
            this.log('⏱️', `Packaging terminé en ${(duration / 1000).toFixed(1)}s`);

            // Check if file was created
            if (!fs.existsSync(vsixPath)) {
                // Try to find any .vsix file
                const files = fs.readdirSync(this.workspaceRoot);
                const vsixFiles = files.filter(f => f.endsWith('.vsix'));
                if (vsixFiles.length > 0) {
                    const foundPath = path.join(this.workspaceRoot, vsixFiles[0]);
                    this.log('📦', `Found .vsix: ${vsixFiles[0]}`);
                    return foundPath;
                }
                throw new Error('VSIX file not found after packaging');
            }

            const stats = fs.statSync(vsixPath);
            const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
            this.log('📊', `Taille: ${sizeMB} MB`);

            return vsixPath;
        } catch (error: any) {
            this.log('❌', `Packaging error: ${error.message}`);
            if (error.stdout) {
                this.log('📝', `stdout: ${error.stdout}`);
            }
            if (error.stderr) {
                this.log('📝', `stderr: ${error.stderr}`);
            }
            throw new Error(`Packaging failed: ${error.message}`);
        }
    }

    /**
     * Step 3: Install locally
     */
    private install(vsixPath: string): void {
        const startTime = Date.now();

        try {
            // Try Cursor first, then VS Code
            this.log('⚙️', `Running: cursor --install-extension "${path.basename(vsixPath)}"`);
            try {
                const result = execSync(`cursor --install-extension "${vsixPath}"`, {
                    cwd: this.workspaceRoot,
                    stdio: 'pipe',
                    encoding: 'utf-8'
                });
                this.log('📦', 'Installé dans Cursor');
            } catch (cursorError: any) {
                this.log('⚠️', 'Cursor installation failed, trying VS Code...');
                // Fallback to VS Code
                const result = execSync(`code --install-extension "${vsixPath}"`, {
                    cwd: this.workspaceRoot,
                    stdio: 'pipe',
                    encoding: 'utf-8'
                });
                this.log('📦', 'Installé dans VS Code');
            }

            const duration = Date.now() - startTime;
            this.log('⏱️', `Installation terminée en ${(duration / 1000).toFixed(1)}s`);
        } catch (error: any) {
            this.log('❌', `Installation error: ${error.message}`);
            if (error.stdout) {
                this.log('📝', `stdout: ${error.stdout}`);
            }
            if (error.stderr) {
                this.log('📝', `stderr: ${error.stderr}`);
            }
            throw new Error(`Installation failed: ${error.message}`);
        }
    }

    /**
     * Bump version (patch increment)
     */
    private bumpVersion(): void {
        const pkgPath = path.join(this.workspaceRoot, 'package.json');
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
        
        const [major, minor, patch] = pkg.version.split('.').map(Number);
        const newVersion = `${major}.${minor}.${patch + 1}`;
        
        pkg.version = newVersion;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8');
        
        this.log('🔢', `Version bump: ${pkg.version} → ${newVersion}`);
    }

    /**
     * Clean old .vsix files
     */
    private cleanOldVsix(): void {
        const files = fs.readdirSync(this.workspaceRoot);
        const vsixFiles = files.filter(f => f.endsWith('.vsix'));
        
        if (vsixFiles.length > 0) {
            this.log('🧹', `Nettoyage de ${vsixFiles.length} ancien(s) fichier(s) .vsix...`);
            vsixFiles.forEach(file => {
                const filePath = path.join(this.workspaceRoot, file);
                fs.unlinkSync(filePath);
            });
        }
    }

    /**
     * Get package.json
     */
    private getPackageJson(): any {
        const pkgPath = path.join(this.workspaceRoot, 'package.json');
        return JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
    }

    /**
     * Log with timestamp and emoji
     */
    private log(emoji: string, message: string): void {
        const timestamp = new Date().toISOString();
        const formattedMessage = `[${timestamp}] ${emoji} ${message}`;
        this.outputChannel.appendLine(formattedMessage);
        console.log(formattedMessage);
    }
}


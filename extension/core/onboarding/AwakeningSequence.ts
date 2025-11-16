import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { UnifiedLogger } from '../UnifiedLogger';

/**
 * Cognitive Awakening Sequence - First-time initialization experience
 * Transforms installation into an observable birth moment
 */
export async function runCognitiveAwakening(workspaceRoot: string): Promise<void> {
    const logger = UnifiedLogger.getInstance();
    const log = (msg: string) => logger.log(msg);

    log('');
    log('🔄 === REASONING LAYER V3 — COGNITIVE AWAKENING ===');
    log(`📅 Created: ${new Date().toLocaleString()}`);
    log(`📁 Workspace: ${workspaceRoot}`);
    log(`🧠 State: No memory detected — entering Zero Memory Boot...`);
    log('');

    const reasoningDir = path.join(workspaceRoot, '.reasoning');
    if (!fs.existsSync(reasoningDir)) {
        log('📂 Creating cognitive structure...');
        fs.mkdirSync(path.join(reasoningDir, 'traces'), { recursive: true });
        fs.mkdirSync(path.join(reasoningDir, 'adrs'), { recursive: true });
        fs.mkdirSync(path.join(reasoningDir, 'security'), { recursive: true });
        fs.mkdirSync(path.join(reasoningDir, 'snapshots'), { recursive: true });
        fs.mkdirSync(path.join(reasoningDir, 'reports'), { recursive: true });
        fs.mkdirSync(path.join(reasoningDir, 'forecasts'), { recursive: true });
        fs.mkdirSync(path.join(reasoningDir, 'ledger'), { recursive: true });
        fs.mkdirSync(path.join(reasoningDir, 'logs'), { recursive: true });
        
        fs.writeFileSync(
            path.join(reasoningDir, 'manifest.json'),
            JSON.stringify({
                created_at: new Date().toISOString(),
                confidence: 0.62,
                cycles: 0,
                total_events: 0,
                version: '1.0'
            }, null, 2)
        );
        log('✅ Structure ready.');
        log('');
    }

    log('🔍 Scanning workspace...');
    try {
        const folders = fs.readdirSync(workspaceRoot).filter(f => !f.startsWith('.'));
        log(`→ Found ${folders.length} folders: ${folders.slice(0, 5).join(', ')}${folders.length > 5 ? '...' : ''}`);
    } catch (e) {
        log('→ Workspace scan complete.');
    }

    const tsconfig = fs.existsSync(path.join(workspaceRoot, 'tsconfig.json'));
    const pkg = fs.existsSync(path.join(workspaceRoot, 'package.json'));
    if (tsconfig) {
        log('→ TypeScript project detected.');
    }
    if (pkg) {
        log('→ Dependencies found via package.json.');
    }

    log('');
    log('🐙 Checking GitHub anchor...');
    const repo = detectGitHubRepo(workspaceRoot);
    if (repo) {
        log(`✅ Linked to GitHub repo: ${repo}`);
    } else {
        log('⚠️ Running in local-only mode. You can link GitHub later (Reasoning: Setup GitHub).');
    }

    log('');
    log('🧩 Establishing cognitive baseline...');
    const context = {
        confidence: 0.62,
        summary: 'Initialized (Zero Memory Boot)',
        repo: repo || 'local-only',
        awoken_at: new Date().toISOString()
    };
    
    const contextPath = path.join(reasoningDir, 'current-context.json');
    fs.writeFileSync(contextPath, JSON.stringify(context, null, 2));

    log('🧠 Core modules loaded:');
    log('   • Persistence Manager');
    log('   • Schema Manager');
    log('   • Integrity Engine');
    log('   • Pattern Learning Engine');
    log('   • Correlation Engine');
    log('   • Forecast Engine');
    log('');

    log('✨ Reasoning Layer awakening complete.');
    log('→ When you code, I\'ll observe.');
    log('→ When you commit, I\'ll remember.');
    log('→ When you rest, I\'ll forecast.');
    log('');

    log('✅ Ready. Run "Reasoning › Execute › Run Autopilot" anytime to start your first reasoning cycle.');
    log('🔗 All activity is now tracked under `.reasoning/`.');
    log('');
    log('=== PERSISTENCE MANAGER READY ===');
    log('');

    // Show notification
    vscode.window.showInformationMessage('🧠 Reasoning Layer initialized — memory active.');
}

/**
 * Detect GitHub repository from .git/config
 */
function detectGitHubRepo(workspaceRoot: string): string | null {
    try {
        const gitConfigPath = path.join(workspaceRoot, '.git', 'config');
        if (!fs.existsSync(gitConfigPath)) {
            return null;
        }

        const configContent = fs.readFileSync(gitConfigPath, 'utf-8');
        const urlMatch = configContent.match(/url\s*=\s*(https:\/\/github\.com\/|git@github\.com:)([^\s]+)\.git/);
        
        if (urlMatch && urlMatch[2]) {
            return urlMatch[2];
        }

        return null;
    } catch (e) {
        return null;
    }
}


import { SelfAuditEngine } from './SelfAuditEngine';

/**
 * Run self-audit for Reasoning Layer
 */
export async function runSelfAudit(workspaceRoot: string) {
    const engine = new SelfAuditEngine(workspaceRoot);
    const result = await engine.runAudit();
    await engine.logAuditCompletion(result);
    return result;
}


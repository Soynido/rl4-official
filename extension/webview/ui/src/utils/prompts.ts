import type { RL4Now, RL4Next } from '@/types/rl4';

export function buildNowPrompt(n: RL4Now | undefined | null): string {
  if (!n) return "# Now — no data yet";

  const L: string[] = [];
  L.push(`# 🧠 RL4 — NOW (Cycle ${n.cycleId})`);
  L.push(`**Timestamp:** ${n.timestamp}`);

  if (n.phase) L.push(`**Phase:** ${n.phase}`);
  if (n.focusedFile) L.push(`**Focused file:** ${n.focusedFile}`);

  if (n.recentlyViewed?.length) {
    L.push(`**Recently viewed:**`);
    n.recentlyViewed.slice(0, 5).forEach(f => L.push(`- \`${f}\``));
  }

  if (n.patterns?.length) {
    L.push(`**Patterns:**`);
    n.patterns.forEach(p => L.push(`- ${p.id} (${Math.round(p.confidence * 100)}%)`));
  }

  if (n.forecasts?.length) {
    L.push(`**Forecasts:**`);
    n.forecasts.forEach(f => L.push(`- ${f.predicted} (${Math.round(f.confidence * 100)}%)`));
  }

  if (n.constraints?.recentADRs?.length) {
    L.push(`**Recent ADRs:**`);
    n.constraints.recentADRs.forEach(a => L.push(`- ${a.id} — ${a.title}`));
  }

  if (n.health) {
    const h = n.health;
    const items = Object.entries(h).filter(([, v]) => v !== undefined);
    if (items.length) {
      L.push(`**Health:**`);
      items.forEach(([k, v]) => L.push(`- ${k}: ${Math.round((v as number) * 100) / 100}`));
    }
  }

  L.push("\n🎯 Use this snapshot to recalibrate your agent to the exact cognitive state.");
  return L.join("\n");
}

export function buildNextPrompt(n: RL4Next | undefined | null): string {
  if (!n) return "# Next — no data yet";

  const L: string[] = [];
  L.push(`# ➡️ RL4 — NEXT STEPS (Agent Bootstrap)`);

  if (n.phase) L.push(`**Phase:** ${n.phase}`);

  if (n.patterns?.length) {
    L.push(`\n## Patterns (evidence)`);
    n.patterns.forEach(p => L.push(`- ${p.id} (${Math.round(p.confidence * 100)}%)`));
  }

  if (n.correlations?.length) {
    L.push(`\n## Correlations`);
    n.correlations.forEach(c => L.push(`- ${c.id}${c.direction ? ` (${c.direction})` : ''}${c.score ? ` score=${c.score}` : ''}`));
  }

  if (n.adrs?.length) {
    L.push(`\n## ADRs (Active/Recent)`);
    n.adrs.forEach(a => L.push(`- ${a.id} — ${a.title}${a.timestamp ? ` [${a.timestamp}]` : ''}`));
  }

  if (n.goals?.length) {
    L.push(`\n## Goals (status)`);
    n.goals.forEach(g => L.push(`- ${g.title} [${g.status}]`));
  }

  if (n.risks?.length) {
    L.push(`\n## Risks / Constraints`);
    n.risks.forEach(r => L.push(`- ${r}`));
  }

  if (n.integrity) {
    L.push(`\n## Cognitive Integrity Metrics`);
    L.push(`- Overall Health: ${Math.round(n.integrity.overallHealth * 100)}%`);
    L.push(`- Cycle Coherence: ${Math.round(n.integrity.cycleCoherence * 100)}%`);
    L.push(`- Pattern Drift: ${Math.round(n.integrity.patternDrift * 100)}%`);
    L.push(`- Forecast Accuracy: ${Math.round(n.integrity.forecastAccuracy * 100)}%`);

    if (n.integrity.recommendations?.length) {
      L.push(`\n## System Recommendations`);
      n.integrity.recommendations.forEach(r => L.push(`- ${r}`));
    }
  }

  L.push(`
---
🎯 **Agent task**: à partir de ces EVIDENCES UNIQUEMENT, propose 3 listes d'actions:
- High priority (immédiat, fort impact, faible dépendance)
- Medium priority
- Low priority

⚠️ Règles:
- Ne déduis rien qui ne soit pas supporté par l'évidence.
- Si une info manque, écris "unknown".
- Chaque action = 1 phrase, orientée livrable, mesurable.
- Regroupe par thème (architecture, stabilité, UX, tooling…).`);

  return L.join("\n");
}
# 🎯 PLAN DE DÉVELOPPEMENT — SÉPARATION KPIs LLM vs KPIs Kernel

**Objectif:** Séparer les KPIs LLM (cognition haute) des KPIs Kernel (métriques mécaniques) pour permettre convergence et apprentissage.

**Architecture:** Option C — Séparation stricte dans Context.RL4

**Mode:** Exploratory (50% threshold)

**Bias actuel:** 35.71% → Sous threshold ✅

**Estimation:** 3-4h

---

## 📋 PHASE 1: Interfaces & Types (45min)

### Tâche 1.1: Modifier `KPIRecord` interface dans `PlanTasksContextParser.ts`

**Fichier:** `extension/kernel/api/PlanTasksContextParser.ts`

**Changements:**
```typescript
// AVANT:
export interface KPIRecord {
  cycle: number;
  cognitive_load: number;
  risks: string[];
  next_steps: string[];
  plan_drift: number;
  updated: string;
}

// APRÈS:
export interface KPIRecordLLM {
  cycle: number;
  cognitive_load: number;
  risks: string[];
  next_steps: string[];
  plan_drift: number;
  opportunities?: string[];
  updated: string;
}

export interface KPIRecordKernel {
  cycle: number;
  cognitive_load: number;
  drift: number;
  patterns_detected: number;
  tasks_active: number;
  queue_length?: number;
  scheduler_state?: 'idle' | 'running' | 'queued';
  updated: string;
}
```

**Modifier aussi `ContextData` interface:**
```typescript
export interface ContextData {
  version: string;
  updated: string;
  confidence?: number;
  bias?: number;
  kpis_llm?: KPIRecordLLM[];      // ✅ NOUVEAU
  kpis_kernel?: KPIRecordKernel[]; // ✅ NOUVEAU
  // ... autres champs
}
```

**Critère de succès:**
- ✅ Types compilent sans erreur
- ✅ `KPIRecordLLM` contient champs LLM (reasoning, patterns, goals)
- ✅ `KPIRecordKernel` contient champs kernel (cycle count, latency, queue)

**@rl4:id:** `P0-KPI-SEPARATION-01`

---

### Tâche 1.2: Migration backward-compatible (parser existant)

**Fichier:** `extension/kernel/api/PlanTasksContextParser.ts`

**Changements:**
```typescript
parseContext(): ContextData | null {
  // ... parsing YAML frontmatter ...
  
  // ✅ MIGRATION: Si ancien format `kpis` existe, convertir
  if (frontmatter.kpis && !frontmatter.kpis_llm && !frontmatter.kpis_kernel) {
    // Ancien format détecté → migrer vers kpis_kernel (assumé kernel-generated)
    frontmatter.kpis_kernel = frontmatter.kpis.map(kpi => ({
      cycle: kpi.cycle,
      cognitive_load: kpi.cognitive_load || 0,
      drift: kpi.plan_drift || 0,
      patterns_detected: 0,
      tasks_active: 0,
      updated: kpi.updated
    }));
    delete frontmatter.kpis; // Supprimer ancien champ
  }
  
  return {
    // ...
    kpis_llm: frontmatter.kpis_llm || [],
    kpis_kernel: frontmatter.kpis_kernel || []
  };
}
```

**Critère de succès:**
- ✅ Anciens Context.RL4 avec `kpis` sont migrés automatiquement
- ✅ Nouveaux Context.RL4 utilisent `kpis_llm` et `kpis_kernel`
- ✅ Pas de perte de données lors de migration

**@rl4:id:** `P0-KPI-SEPARATION-01-migration`

---

## 📋 PHASE 2: Kernel Write Path (1h)

### Tâche 2.1: Modifier `CognitiveScheduler.runCycle()` pour écrire dans `kpis_kernel`

**Fichier:** `extension/kernel/CognitiveScheduler.ts`

**Changements:**
```typescript
// Ligne ~677-705: Modifier la section KPI write-back

// ✅ AVANT:
const newKPI = {
  cycle: result.cycleId,
  cognitive_load: cognitiveLoad,
  risks,
  next_steps: nextSteps,
  plan_drift: planDrift,
  updated: new Date().toISOString()
};

const updatedContext: ContextData = {
  ...currentContext,
  updated: new Date().toISOString(),
  kpis: [...(currentContext.kpis || []), newKPI].slice(-10)
};

// ✅ APRÈS:
const newKPIKernel: KPIRecordKernel = {
  cycle: result.cycleId,
  cognitive_load: cognitiveLoad, // Calculé depuis phases (mécanique)
  drift: planDrift, // Calculé depuis plan alignment (mécanique)
  patterns_detected: phases.patterns || 0,
  tasks_active: currentContext.tasks?.active?.length || 0,
  queue_length: this.cycleQueue.length,
  scheduler_state: this.isRunning ? 'running' : (this.cycleQueue.length > 0 ? 'queued' : 'idle'),
  updated: new Date().toISOString()
};

const updatedContext: ContextData = {
  ...currentContext,
  updated: new Date().toISOString(),
  kpis_kernel: [...(currentContext.kpis_kernel || []), newKPIKernel].slice(-10),
  // ✅ IMPORTANT: Ne PAS toucher à kpis_llm
  kpis_llm: currentContext.kpis_llm || [] // Préservé tel quel
};
```

**Critère de succès:**
- ✅ Kernel écrit SEULEMENT dans `kpis_kernel`
- ✅ Kernel ne modifie JAMAIS `kpis_llm`
- ✅ `kpis_llm` est préservé même après cycle kernel

**@rl4:id:** `P0-KPI-SEPARATION-02`

---

### Tâche 2.2: Modifier `PlanTasksContextParser.saveContext()` pour gérer les deux sections

**Fichier:** `extension/kernel/api/PlanTasksContextParser.ts`

**Changements:**
```typescript
saveContext(data: ContextData): boolean {
  // ... existing code ...
  
  const frontmatter = {
    version: data.version,
    updated: data.updated,
    confidence: data.confidence,
    kpis_llm: data.kpis_llm || [],        // ✅ NOUVEAU
    kpis_kernel: data.kpis_kernel || []  // ✅ NOUVEAU
    // ❌ SUPPRIMER: kpis: data.kpis || []
  };
  
  // ... rest of code ...
}
```

**Critère de succès:**
- ✅ YAML frontmatter contient `kpis_llm` et `kpis_kernel`
- ✅ Ancien champ `kpis` n'est plus écrit
- ✅ Format YAML valide

**@rl4:id:** `P0-KPI-SEPARATION-03`

---

## 📋 PHASE 3: Snapshot Builder (1h)

### Tâche 3.1: Mettre à jour `UnifiedPromptBuilder` pour inclure les deux sections KPIs

**Fichier:** `extension/kernel/api/UnifiedPromptBuilder.ts`

**Changements:**
```typescript
// Chercher section "## KPIs" dans buildContextSection()

// ✅ AVANT:
## KPIs (LLM-Calculated)
${context.kpis?.map(kpi => `- Cycle ${kpi.cycle}: ...`).join('\n')}

// ✅ APRÈS:
## KPIs LLM (High-Level Cognition)

**Source:** LLM reasoning, patterns, goals, plan drift analysis

${context.kpis_llm?.map(kpi => `
### Cycle ${kpi.cycle}
- Cognitive Load: ${kpi.cognitive_load}%
- Next Steps: ${kpi.next_steps.join(', ')}
- Plan Drift: ${kpi.plan_drift}%
- Risks: ${kpi.risks.join(', ')}
- Updated: ${kpi.updated}
`).join('\n') || 'No LLM KPIs yet'}

## KPIs Kernel (Mechanical Metrics)

**Source:** Kernel cycle execution, scheduler state, queue management

${context.kpis_kernel?.map(kpi => `
### Cycle ${kpi.cycle}
- Cognitive Load: ${kpi.cognitive_load}%
- Drift: ${kpi.drift}%
- Patterns Detected: ${kpi.patterns_detected}
- Tasks Active: ${kpi.tasks_active}
- Queue Length: ${kpi.queue_length || 0}
- Scheduler State: ${kpi.scheduler_state}
- Updated: ${kpi.updated}
`).join('\n') || 'No kernel KPIs yet'}
```

**Critère de succès:**
- ✅ Snapshot contient deux sections distinctes
- ✅ Section LLM montre reasoning/patterns/goals
- ✅ Section Kernel montre métriques mécaniques
- ✅ Format Markdown valide

**@rl4:id:** `P0-KPI-SEPARATION-04`

---

## 📋 PHASE 4: WebView Parser (45min)

### Tâche 4.1: Mettre à jour `contextParser.ts` pour parser les deux sections

**Fichier:** `extension/webview/ui/src/utils/contextParser.ts`

**Changements:**
```typescript
export function parseContextRL4(content: string): {
  cognitiveLoad: CognitiveLoadData | null;
  nextSteps: NextTasksData | null;
  planDrift: PlanDriftData | null;
  risks: RisksData | null;
  kernelKPIs: KernelKPIData | null; // ✅ NOUVEAU
} {
  // ... existing parsing ...
  
  // ✅ NOUVEAU: Parser section KPIs Kernel
  const kernelKPIsMatch = content.match(/## KPIs Kernel[^#]*([\s\S]*?)(?=\n## |$)/);
  if (kernelKPIsMatch) {
    // Parser métriques kernel (patterns_detected, tasks_active, queue_length, etc.)
    result.kernelKPIs = parseKernelKPIs(kernelKPIsMatch[1]);
  }
  
  return result;
}

function parseKernelKPIs(section: string): KernelKPIData | null {
  // Parser chaque cycle kernel KPI
  // Retourner structure avec patterns_detected, tasks_active, scheduler_state, etc.
}
```

**Critère de succès:**
- ✅ WebView parse les deux sections KPIs
- ✅ UI peut afficher KPIs LLM et Kernel séparément
- ✅ Pas de régression sur parsing existant

**@rl4:id:** `P0-KPI-SEPARATION-05`

---

## 📋 PHASE 5: Documentation & Tests (30min)

### Tâche 5.1: Mettre à jour documentation snapshot format

**Fichier:** `README.md` ou `RL4_BIBLE_FR.txt`

**Changements:**
- Documenter format `kpis_llm` vs `kpis_kernel`
- Expliquer pourquoi séparation nécessaire
- Exemples de chaque type de KPI

**@rl4:id:** `P0-KPI-SEPARATION-06`

---

### Tâche 5.2: Test migration backward-compatible

**Test:**
1. Créer Context.RL4 avec ancien format `kpis`
2. Charger via `PlanTasksContextParser.parseContext()`
3. Vérifier que `kpis_kernel` contient données migrées
4. Vérifier que `kpis_llm` est vide (normal)

**@rl4:id:** `P0-KPI-SEPARATION-07`

---

## 🎯 RÉSULTAT ATTENDU

### Format Context.RL4 après implémentation:

```yaml
---
version: 3.9
updated: '2025-11-18T18:30:00Z'
confidence: 0.85
kpis_llm:
  - cycle: 122
    cognitive_load: 50
    risks:
      - Git not initialized
      - No documentation detected
    next_steps:
      - Improve task decomposition
      - Add missing ADRs
    plan_drift: 0
    opportunities:
      - 3 P0 tasks ready for refinement
    updated: '2025-11-18T18:00:25Z'
kpis_kernel:
  - cycle: 123
    cognitive_load: 0
    drift: 0
    patterns_detected: 0
    tasks_active: 3
    queue_length: 0
    scheduler_state: idle
    updated: '2025-11-18T18:01:19Z'
---
```

### Comportement:

1. **LLM écrit dans `kpis_llm`** → Kernel ne touche pas
2. **Kernel écrit dans `kpis_kernel`** → LLM ne touche pas
3. **Les deux sections coexistent** → Pas de conflit
4. **Système converge** → LLM apprend depuis `kpis_kernel`, Kernel apprend depuis `kpis_llm`

---

## ✅ CHECKLIST FINALE

- [ ] Phase 1: Interfaces & Types (45min)
- [ ] Phase 2: Kernel Write Path (1h)
- [ ] Phase 3: Snapshot Builder (1h)
- [ ] Phase 4: WebView Parser (45min)
- [ ] Phase 5: Documentation & Tests (30min)
- [ ] Test end-to-end: LLM écrit → Kernel écrit → Pas d'écrasement
- [ ] Test migration: Ancien format → Nouveau format
- [ ] Compilation sans erreur
- [ ] Extension installée et testée

---

## 🚨 RISQUES

- 🟡 **Migration backward-compatible:** Risque de perte de données si migration échoue
  - **Mitigation:** Tester migration sur workspace de test avant production

- 🟡 **Parser WebView:** Risque de régression si parsing échoue
  - **Mitigation:** Garder ancien parser en fallback

- 🟢 **Bias:** 35.71% + ~5% (modifications) = ~40% → Sous threshold 50% ✅

---

**Total estimé:** 3-4h

**Priorité:** P0 (bloquant pour apprentissage RL4)

**Dépendances:** Aucune (peut être fait en parallèle de P0-CORE)


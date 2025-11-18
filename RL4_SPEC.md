# RL4 MVP Locked-In — Plan d'Exécution Opérationnel (FINAL)

Version exécutable pour Cursor — 30-40h

---

## 0. PRINCIPES GÉNÉRAUX

Le MVP doit :
- Implémenter les **17 verrous**, seuls **9 sont blocking**.
- Exécuter la logique via un pipeline **S → P → L → B**.
- Utiliser la **canonicalisation YAML** pour éliminer les faux positifs.
- Garantir **rollback HEAD atomique** pour Plan/Tasks/Context.
- Garder tous les verrous soft en **log-only** (pas blocking).

Tous les modules doivent être **simples, lisibles, isolés, testables**.

---

## 1. ARCHITECTURE FINALE

### Nouveaux modules à créer (obligatoires)

```
extension/kernel/canonicalization/YAMLCanonicalizer.ts
extension/kernel/rollback/RL4RollbackSystem.ts
extension/kernel/invariants/RL4Invariants.ts
extension/kernel/validation/PipelineValidator.ts
extension/kernel/utils/TextDeviation.ts
extension/kernel/utils/FileScanner.ts
extension/kernel/snapshot/SnapshotReminder.ts
extension/kernel/snapshot/ActivityReconstructor.ts
```

### Modules à modifier

```
extension/kernel/api/PlanTasksContextParser.ts
extension/kernel/api/UnifiedPromptBuilder.ts
extension/kernel/CognitiveScheduler.ts
extension/extension.ts
```

---

## 2. MVP-1 : FIRST USE + GROUND TRUTH + CANONICALISATION (Blocking)

### Objectif
Mettre en place FirstUse complet + Ground Truth + Anti-rewrite + limites volumétriques + **V16 (Required Keys)** + **V17 (Response Contract)**.

### À coder

#### 2.1 — YAMLCanonicalizer.ts

**Fichier** : `extension/kernel/canonicalization/YAMLCanonicalizer.ts`

**Fonctions** :
```typescript
canonicalizeYAML(raw: string): string
normalizeIndentation()      // Force 2 espaces
normalizeArrays()           // Format `- item` uniforme
normalizeUnicodeNFC()       // Normalisation unicode
normalizeQuotes()           // Règles quoting déterministes
```

**Utilisation obligatoire AVANT** :
- Comparaison d'ordre de clés
- Comparaison de structure
- Sauvegarde
- Lecture backup

#### 2.2 — FirstBootstrapEngine.ts

**Fichier** : `extension/kernel/bootstrap/FirstBootstrapEngine.ts`

**Actions** :
1. Scanner workspace :
   - README.md
   - package.json
   - Structure (max 3 niveaux)
2. Générer `project_metadata.json`
3. Construire prompt firstUse
4. Écrire fichiers RL4 INITIAUX :
   - Plan.RL4
   - Tasks.RL4
   - Context.RL4
   Avec key ordering fixé au moment de l'écriture.
5. Appeler LLM
6. **NOUVEAU : Valider Response Contract (V17)** avant parsing
7. Exécuter pipeline S/P/L (voir MVP-3)
8. Si valide → écrire `ground_truth/*.yaml`
9. Écrire `first_use_lock: true`

#### 2.3 — Limites volumétriques (Blocking)

**Fichier** : `extension/kernel/api/PlanTasksContextParser.ts`

Après LLM, valider :
- Max 10 tasks
- Max 5 success criteria
- Max 1 phase
- Max 3 goals

Violation → rollback HEAD.

**Fonction** : `validateFirstUseLimits(plan, tasks)`

#### 2.4 — 🔒 V16: Required Keys Validation (BLOCKING - NOUVEAU)

**Fichier** : `extension/kernel/api/PlanTasksContextParser.ts`

**Problème résolu** : Empêche le LLM de supprimer silencieusement des clés obligatoires (successCriteria, constraints, blockers, activeFiles, observations, kpis_llm).

**Implémentation** :
```typescript
interface RequiredKeysSchema {
  Plan: string[];
  Tasks: string[];
  Context: string[];
}

const REQUIRED_KEYS: RequiredKeysSchema = {
  Plan: ['phase', 'goal', 'successCriteria', 'constraints', 'timeline'],
  Tasks: ['active', 'blockers'],
  Context: ['mode', 'observations', 'kpis_llm', 'kpis_kernel', 'activeFiles']
};

function validateRequiredKeys(obj: any, type: 'Plan' | 'Tasks' | 'Context'): ValidationResult {
  const required = REQUIRED_KEYS[type];
  
  for (const key of required) {
    if (!(key in obj)) {
      return {
        valid: false,
        error: `Missing required key in ${type}.RL4: ${key}`
      };
    }
  }
  
  return { valid: true };
}
```

**Quand l'appeler** : AVANT toute autre validation, dans le pipeline S (Structure).

**Sanction** : Blocking → rollback HEAD immédiat si une clé manque.

#### 2.5 — 🔒 V17: LLM Response Contract (BLOCKING - NOUVEAU)

**Fichier** : `extension/extension.ts` (ou `SnapshotSystem.ts` si créé)

**Problème résolu** : Empêche le parsing d'une réponse LLM malformée (fragment, coupure, pas de structure).

**Implémentation** :
```typescript
function validateResponseContract(llmResponse: string): ValidationResult {
  // 1. Check présence des 3 fichiers
  const hasPlan = llmResponse.includes('Plan.RL4');
  const hasTasks = llmResponse.includes('Tasks.RL4');
  const hasContext = llmResponse.includes('Context.RL4');
  
  if (!hasPlan || !hasTasks || !hasContext) {
    return {
      valid: false,
      error: 'LLM Response Contract violation: Missing one or more RL4 files'
    };
  }
  
  // 2. Check présence frontmatter YAML (---)
  const frontmatterCount = (llmResponse.match(/^---$/gm) || []).length;
  if (frontmatterCount < 6) { // 3 fichiers × 2 délimiteurs (début + fin)
    return {
      valid: false,
      error: 'LLM Response Contract violation: Missing YAML frontmatter delimiters'
    };
  }
  
  // 3. Check non-vide (au moins 100 chars par fichier)
  if (llmResponse.length < 300) {
    return {
      valid: false,
      error: 'LLM Response Contract violation: Response too short'
    };
  }
  
  return { valid: true };
}
```

**Quand l'appeler** : AVANT tout parsing, immédiatement après réception LLM.

**Sanction** : Blocking → rollback HEAD + log "Malformed LLM Response".

---

## 3. MVP-2 : SÉPARATION KERNEL / LLM + KERNEL WINS (Blocking)

### À coder

**Fichier** : `extension/kernel/api/PlanTasksContextParser.ts`

#### 3.1 — sanitizeLLMWrites()

Si LLM modifie :
- `kpis_kernel`
- `ground_truth_established`
- `first_use_lock`

→ Restaurer valeurs kernel, marquer cycle invalide → rollback HEAD.

**Fonction** :
```typescript
function sanitizeLLMWrites(contextFromLLM: ContextData, kernelContext: ContextData): ContextData {
  return {
    ...contextFromLLM,
    kpis_kernel: kernelContext.kpis_kernel,
    ground_truth_established: kernelContext.ground_truth_established,
    first_use_lock: kernelContext.first_use_lock
  };
}
```

#### 3.2 — detectKernelFieldViolation()

Blocking immédiat après canonicalisation.

---

## 4. MVP-3 : SNAPSHOT + PIPELINE S/P/L + VALIDATION ATOMIQUE (Blocking)

### À coder

#### 4.1 — SnapshotReminder.ts

**Fichier** : `extension/kernel/snapshot/SnapshotReminder.ts`

- Fichier `reminder_state.json`
- Si > 2h → notification VSCode
- `recordSnapshotGenerated()`

#### 4.2 — ActivityReconstructor.ts

**Fichier** : `extension/kernel/snapshot/ActivityReconstructor.ts`

- Lire `file_changes.jsonl` + `terminal-events.jsonl`
- Summary simple (pas de corrélations)
- `reconstruct(fromTime: string, toTime: string): ActivitySummary`

#### 4.3 — PipelineValidator.ts

**Fichier** : `extension/kernel/validation/PipelineValidator.ts`

**Pipeline** :
```typescript
async runAll(plan, tasks, context): Promise<ValidationResult> {
  const s = await runStructuralValidation()  // S — Blocking (V1, V2, V16, V17)
  if (!s.valid) return s;
  
  const p = await runPermissionValidation()  // P — Blocking (V3)
  if (!p.valid) return p;
  
  const l = await runLogicalValidation()     // L — Blocking (Invariants)
  if (!l.valid) return l;
  
  const b = await runBehavioralValidation()  // B — Soft log-only
  // B never blocks, only logs
  
  return { valid: true };
}
```

**Étape S — Structural (Blocking)** :
- YAML parseable (V1)
- Canonicalisation avant + après
- Key ordering identique (V2)
- **Required keys présents (V16)**
- **Response contract respecté (V17)**
→ Si fail → rollback HEAD

**Étape P — Permissions (Blocking partiel)** :
- Champs kernel-owned intouchés (V3)
→ Sinon sanitization + rollback HEAD

**Étape L — Invariants (Blocking)** :
Utiliser `RL4Invariants` :
- Phase non vide
- Mode ∈ {strict, flexible, firstUse}
- DAG sans cycles
→ Correction auto si possible, sinon rollback HEAD

**Étape B — Behavioral (Soft — log-only)** :
- Fichiers helpers suspects (V8)
- Déviation textuelle (V9)
- **Hard-cap size (V13)**
- **Cross-consistency (V14)**
- **Mode signature (V15)**
- Orphan P2 (V11) — aucun freeze au MVP
→ Jamais de rollback dans cette étape

#### 4.4 — 🔒 V13: Hard-Cap RL4 Size (SOFT - NOUVEAU)

**Fichier** : `extension/kernel/validation/PipelineValidator.ts` (étape B)

**Problème résolu** : Empêche l'obésité RL4 (Tasks→120 tâches, observations infinies).

**Implémentation** :
```typescript
function checkHardCapSize(plan: PlanData, tasks: TasksData, context: ContextData): BehavioralCheck {
  const warnings: string[] = [];
  
  // Plan limits
  if (plan.phases && plan.phases.length > 6) { // 1 active + 5 backlog
    warnings.push(`Plan phases exceed limit: ${plan.phases.length}/6`);
  }
  
  // Tasks limits
  if (tasks.active.length > 40) {
    warnings.push(`Tasks exceed limit: ${tasks.active.length}/40`);
  }
  
  // Context limits
  const contextLines = JSON.stringify(context).split('\n').length;
  if (contextLines > 200) {
    warnings.push(`Context exceeds limit: ${contextLines}/200 lines`);
  }
  
  if (context.observations && context.observations.length > 20) {
    warnings.push(`Observations exceed limit: ${context.observations.length}/20`);
  }
  
  return {
    check: 'HardCapSize',
    severity: 'warning',
    warnings
  };
}
```

**Sanction** : Soft → log warning uniquement au MVP.

#### 4.5 — 🔒 V14: Cross-File Consistency (SOFT - NOUVEAU)

**Fichier** : `extension/kernel/validation/PipelineValidator.ts` (étape B)

**Problème résolu** : Détecte incohérences (Plan sans tâches, tâches fantômes, deps circulaires).

**Implémentation** :
```typescript
function checkCrossConsistency(plan: PlanData, tasks: TasksData, context: ContextData, workspaceRoot: string): BehavioralCheck {
  const warnings: string[] = [];
  
  // 1. Check Task ↔ Plan alignment (P0/P1 tasks should relate to goal)
  const planGoalKeywords = extractKeywords(plan.goal);
  for (const task of tasks.active) {
    if (task.priority === 'P0' || task.priority === 'P1') {
      const taskKeywords = extractKeywords(task.task);
      const similarity = calculateSimilarity(planGoalKeywords, taskKeywords);
      
      if (similarity < 0.4) {
        warnings.push(`Task ${task.id} weakly aligned with Plan goal (${similarity})`);
      }
    }
  }
  
  // 2. Check dependencies point to existing tasks
  for (const task of tasks.active) {
    if (task.deps) {
      for (const depId of task.deps) {
        const depExists = tasks.active.some(t => t.id === depId);
        if (!depExists) {
          warnings.push(`Task ${task.id} depends on non-existent task: ${depId}`);
        }
      }
    }
  }
  
  // 3. Check activeFiles exist in workspace
  if (context.activeFiles) {
    for (const file of context.activeFiles) {
      const filePath = path.join(workspaceRoot, file);
      if (!fs.existsSync(filePath)) {
        warnings.push(`activeFile does not exist: ${file}`);
      }
    }
  }
  
  return {
    check: 'CrossConsistency',
    severity: 'warning',
    warnings
  };
}
```

**Sanction** : Soft → log warning uniquement au MVP.

---

## 5. MVP-4 : MODES STRICT / FLEXIBLE (Blocking partiel)

### À coder

#### 5.1 — UnifiedPromptBuilder — sections strictes

**Fichier** : `extension/kernel/api/UnifiedPromptBuilder.ts`

**Mode STRICT** :
- P0 only
- Aucune création fichier
- Aucune réécriture texte
- Aucune refactor
- Si aucune tâche P0 → afficher alerte, rien exécuter

**Mode FLEXIBLE** :

**Blocking** :
- Max 3 fichiers créés
- Max 5 modifiés
- Pas de nouveaux dossiers
- Pas de rename symbol project-wide
- Pas de refactor massif

**Soft** :
- Text deviation >20% (log-only)
- Helper files (log-only)

#### 5.2 — Kernel checks

**Fichier** : `extension/kernel/CognitiveScheduler.ts`

- Rejeter actions dépassant limites strictes
- Mesurer `files_created`, `files_modified`
- Passer ces données au `BiasCalculator` (simple)

**Fichier** : `extension/kernel/api/BiasCalculator.ts` (créer si absent)
```typescript
function calculateBias(mutations: { files_created: number; files_modified: number; lines_added: number }): number {
  return (mutations.files_created × 5) + (mutations.files_modified × 2) + (mutations.lines_added ÷ 100);
}
```

#### 5.3 — 🔒 V15: Mode Enforcement Signature (SOFT - NOUVEAU)

**Fichier** : `extension/kernel/validation/PipelineValidator.ts` (étape B)

**Problème résolu** : Détecte si LLM viole le mode (ex: "suggestions" en STRICT).

**Implémentation** :
```typescript
function checkModeSignature(llmResponse: string, mode: string): BehavioralCheck {
  const warnings: string[] = [];
  
  if (mode === 'strict') {
    // STRICT should only contain P0 execution or refusal
    const hasSuggestions = /I suggest|I propose|alternative|improvement/i.test(llmResponse);
    const hasChat = /Let me explain|Here's why|I think/i.test(llmResponse);
    
    if (hasSuggestions) {
      warnings.push('STRICT mode violation: LLM provided suggestions');
    }
    if (hasChat) {
      warnings.push('STRICT mode violation: LLM provided explanatory text');
    }
  }
  
  if (mode === 'flexible') {
    // FLEXIBLE proposals should be in structured block
    const hasProposals = llmResponse.includes('<proposal>') || llmResponse.includes('**Proposal:**');
    const hasLooseProposals = /I could also|Another option|You might want/i.test(llmResponse);
    
    if (hasLooseProposals && !hasProposals) {
      warnings.push('FLEXIBLE mode: Proposals detected outside structured block');
    }
  }
  
  return {
    check: 'ModeSignature',
    severity: 'info',
    warnings,
    metadata: { mode_violation_detected: warnings.length > 0 }
  };
}
```

**Sanction** : Soft → log warning uniquement au MVP.

---

## 6. MVP-5 : ROLLBACK HEAD ATOMIQUE + QUARANTINE LOG + HASH LINEAGE (Blocking pour V1-V4)

### À coder

#### 6.1 — RL4RollbackSystem.ts

**Fichier** : `extension/kernel/rollback/RL4RollbackSystem.ts`

**Responsable de** :
- `createBackup(file)`
- `rollback(file)`
- `rollbackHEAD()`
- `writeQuarantineLog()`

**Logs à stocker (toujours)** :
- timestamp
- fichier_fautif
- parse_error
- content_before
- content_after
- prompt (500 chars)
- llm_response (500 chars)
- **previous_snapshot_hash (V10)**
- **current_ground_truth_hash (V10)**

**Hash lineage** :

Fonctions :
```typescript
function calculateSnapshotHash(): string {
  const snapshotPath = path.join(this.rl4Path, 'snapshots', 'latest.json');
  if (!fs.existsSync(snapshotPath)) return 'N/A';
  const content = fs.readFileSync(snapshotPath, 'utf-8');
  return crypto.createHash('sha256').update(content).digest('hex');
}

function calculateGroundTruthHash(): string {
  const gtFiles = ['Plan.yaml', 'Tasks.yaml', 'Context.yaml'];
  const combined = gtFiles.map(f => {
    const fPath = path.join(this.rl4Path, 'ground_truth', f);
    return fs.existsSync(fPath) ? fs.readFileSync(fPath, 'utf-8') : '';
  }).join('');
  return crypto.createHash('sha256').update(combined).digest('hex');
}
```

Soft → pas blocking (uniquement logué).

---

## 7. MVP-6 : INVARIANTS + ORPHAN P2 (log-only)

### À coder

#### 7.1 — RL4Invariants.ts

**Fichier** : `extension/kernel/invariants/RL4Invariants.ts`

**Invariants blocking** :
- Phase non vide
- Mode valide
- DAG sans cycles

**Invariant soft** :
- Orphan P2 (P0/P1 jamais orphelins)
- Seuil :
  - <0.25 → orphan
  - 0.25–0.40 → borderline (log)
  - >0.40 → ok

Freeze désactivé (flag kernel).

**Fonctions** :
```typescript
function validatePlanPhase(plan: PlanData): ValidationResult
function validateContextMode(context: ContextData): ValidationResult
function validateTasksDAG(tasks: TasksData): ValidationResult
function validateOrphanTasks(tasks: TasksData, plan: PlanData): ValidationResult // Soft
```

---

## 8. TESTS À ÉCRIRE (OBLIGATOIRES)

### Blocking tests
- YAML invalide → rollback
- Key ordering modifié → rollback
- Champs kernel-owned modifiés → rollback
- DAG cycle → correction ou rollback
- Limits firstUse → rollback
- Limits strict/flexible → rejet
- **Required keys manquants → rollback (V16)**
- **Response contract violé → rollback (V17)**

### Soft tests
- Fichiers helpers → observés
- Text deviation → log
- Orphan tasks → log
- **Hard-cap size → log (V13)**
- **Cross-consistency → log (V14)**
- **Mode signature → log (V15)**

---

## 9. ORDER OF EXECUTION FOR CURSOR (IMPORTANT)

Voici l'ordre strict pour lancer Cursor :

1. **Créer YAMLCanonicalizer**
   - Fichier : `extension/kernel/canonicalization/YAMLCanonicalizer.ts`

2. **Modifier PlanTasksContextParser** pour :
   - Canonicalisation
   - Limites firstUse
   - Séparation Kernel/LLM
   - `sanitizeLLMWrites()`
   - **`validateRequiredKeys()` (V16)**

3. **Créer PipelineValidator**
   - Fichier : `extension/kernel/validation/PipelineValidator.ts`
   - Implémenter pipeline S/P/L/B
   - **Intégrer V13 (Hard-Cap), V14 (Cross-Consistency), V15 (Mode Signature) dans étape B**

4. **Créer RL4Invariants**
   - Fichier : `extension/kernel/invariants/RL4Invariants.ts`

5. **Créer RL4RollbackSystem**
   - Fichier : `extension/kernel/rollback/RL4RollbackSystem.ts`

6. **Intégrer pipeline dans snapshot path**
   - Modifier `extension/extension.ts`
   - **Ajouter `validateResponseContract()` (V17)**

7. **Créer SnapshotReminder + ActivityReconstructor**
   - Fichiers :
     - `extension/kernel/snapshot/SnapshotReminder.ts`
     - `extension/kernel/snapshot/ActivityReconstructor.ts`

8. **Modifier UnifiedPromptBuilder (STRICT/FLEXIBLE)**
   - Fichier : `extension/kernel/api/UnifiedPromptBuilder.ts`

9. **Modifier CognitiveScheduler + BiasCalculator léger**
   - Fichiers :
     - `extension/kernel/CognitiveScheduler.ts`
     - `extension/kernel/api/BiasCalculator.ts`

10. **Tests manuels sur 9 cas blocking**

---

## 10. TABLEAU RÉCAPITULATIF DES 17 VERROUS

| ID | Nom | Type | Module Responsable |
|--- | --- | --- | --- |
| V1 | Anti-YAML Invalid | Blocking | PipelineValidator (S) |
| V2 | Anti-YAML Reorder | Blocking | PipelineValidator (S) |
| V3 | Kernel Wins | Blocking | PlanTasksContextParser (P) |
| V4 | Rollback Atomique | Blocking | RL4RollbackSystem |
| V5 | FirstUse Limits | Blocking | PlanTasksContextParser |
| V6 | Mode Constraints | Blocking | UnifiedPromptBuilder + CognitiveScheduler |
| V7 | Valid Post-Snapshot | Blocking | PipelineValidator |
| **V16** | **Required Keys** | **Blocking** | **PlanTasksContextParser (S)** |
| **V17** | **Response Contract** | **Blocking** | **extension.ts / SnapshotSystem (S)** |
| V8 | Anti-Helpers | Soft | PipelineValidator (B) |
| V9 | Text Deviation | Soft | PipelineValidator (B) |
| V10 | Lineage Hash | Soft | RL4RollbackSystem |
| V11 | Orphan Borderline | Soft | RL4Invariants |
| V12 | Orphan Freeze | Soft (désactivé) | RL4Invariants |
| **V13** | **Hard-Cap Size** | **Soft** | **PipelineValidator (B)** |
| **V14** | **Cross-Consistency** | **Soft** | **PipelineValidator (B)** |
| **V15** | **Mode Signature** | **Soft** | **PipelineValidator (B)** |

---

## 11. FIN DU PLAN

Ce plan est :
- Directement exécutable par Cursor
- Hiérarchisé
- Structuré par fonctionnalités
- Avec les fichiers, modules, fonctions à écrire
- Strictement dans l'ordre logique d'un MVP 30–40h
- **Intègre les 5 failles critiques identifiées (V13-V17)**

**Prêt pour exécution immédiate.**


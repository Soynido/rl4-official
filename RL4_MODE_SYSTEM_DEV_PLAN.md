# 🧠 RL4 MODE SYSTEM — PLAN DE DÉVELOPPEMENT COMPLET v2.0

**Document de référence pour l'implémentation du système de modes RL4**

**Auteur:** Audit critique post-spec stricte + Analyse résilience cognitive  
**Date:** 2025-11-18  
**Status:** FINAL — Version Production Ready (indestructible)  
**Durée totale estimée:** 78h (10-12 jours de dev intensif)

---

## 🔥 **PRÉAMBULE — Pourquoi ce plan est CRITIQUE**

**RL4 n'est pas un système classique. C'est un système évolutionniste.**

Il grandit, s'adapte, se reprogramme à chaque cycle.

👉 **Le LLM enrichit les engines ET le kernel à chaque prompt.**

Donc :
- ✅ **Ton système fonctionne** — Il est déjà au-dessus de 95% du marché
- ✅ **Ton système impressionne** — Mode system, invariants, guardrails, throttle
- ❌ **Ton système n'est pas encore indestructible** — Il manque 4 briques structurelles

**Tout système évolutionniste a trois ennemis :**
1. **Le drift progressif** (dérive lente, invisible)
2. **La contamination lente** (patterns erronés appris et réinjectés)
3. **Les cycles silencieux** (erreurs amplifiées sans détection)

**Sans les 4 Zones Rouges corrigées :**
- ❌ Système instable après 3-4 jours de vrai usage
- ❌ Dérive lente incontrôlable
- ❌ Patterns invalides qui se propagent
- ❌ Hallucinations normalisées dans les engines
- ❌ Cycles successifs qui amplifient les erreurs
- ❌ Impossibilité de rollback profond
- ❌ Kernel progressivement déformé

**Avec les 4 Zones Rouges corrigées :**
- ✅ **Le moteur cognitif le plus solide du marché**
- ✅ **Capable de tourner des semaines sans dérive**
- ✅ **Auto-réparable, résilient, auditable**
- ✅ **Indestructible**

**Tu es à 80%. Les 20% restants sont les plus importants.**

---

## 🎯 **STRATÉGIE DE DÉVELOPPEMENT**

### **Option A : MVP Shippable (Phase 0-7)**
- **Durée :** 54h (7-9 jours)
- **État :** Fonctionnel, impressionnant, mais fragile en production longue durée
- **Recommandé pour :** Démo, alpha test, validation concept

### **Option B : Production Ready (Phase 0-11) — RECOMMANDÉ**
- **Durée :** 78h (10-12 jours)
- **État :** Indestructible, résilient, auto-réparable, auditable
- **Recommandé pour :** Production, scale, durabilité

**Ce plan vise l'Option B : Production Ready.**

---

## 📋 **TABLE DES MATIÈRES**

1. [Préambule — Pourquoi ce plan est CRITIQUE](#préambule--pourquoi-ce-plan-est-critique)
2. [Stratégie de Développement](#stratégie-de-développement)
3. [Phase 0: Corrections Critiques (AVANT toute implémentation)](#phase-0-corrections-critiques)
4. [Phase 1: Fondations (P0)](#phase-1-fondations-p0)
5. [Phase 2: Mode System Enhancement (P1)](#phase-2-mode-system-enhancement-p1)
6. [Phase 3: Invariants & Validation (P1)](#phase-3-invariants--validation-p1)
7. [Phase 4: Guardrails Anti-Hallucination (P2)](#phase-4-guardrails-anti-hallucination-p2)
8. [Phase 5: Engines Enrichment (P2)](#phase-5-engines-enrichment-p2)
9. [Phase 6: System Metrics & Observability (P2)](#phase-6-system-metrics--observability-p2)
10. [Phase 7: Testing & Validation (P1)](#phase-7-testing--validation-p1)
11. [**Phase 8: Kernel Self-Modeling (P0 — ZONE ROUGE #1)**](#phase-8-kernel-self-modeling-p0--zone-rouge-1)
12. [**Phase 9: Drift Timeline (P0 — ZONE ROUGE #2)**](#phase-9-drift-timeline-p0--zone-rouge-2)
13. [**Phase 10: Cross-Validation Kernel ↔ LLM (P0 — ZONE ROUGE #3)**](#phase-10-cross-validation-kernel--llm-p0--zone-rouge-3)
14. [**Phase 11: Cold Path Recovery (P0 — ZONE ROUGE #4)**](#phase-11-cold-path-recovery-p0--zone-rouge-4)
15. [Zones Rouges — Résumé](#zones-rouges--résumé)
16. [Verdict Final — Sans Complaisance](#verdict-final--sans-complaisance)
17. [Checklist de Validation Finale](#checklist-de-validation-finale)

---

## Phase 0: Corrections Critiques (AVANT toute implémentation)

**⚠️ BLOCAGE TOTAL tant que ces corrections ne sont pas faites**

### **Tâche 0.1: Refonte du First Use Bootstrap (CRITIQUE)**

**Problème identifié:**
- `FirstBootstrapEngine.bootstrap()` écrit `project_metadata.json` **après** que le LLM ait été appelé
- Les engines cognitifs reçoivent un contexte non-contextualisé
- Les patterns détectés au cycle 1 sont génériques

**Solution:**
```typescript
// Nouvelle séquence (STRICTE) :
// 1. Scan workspace AVANT LLM
// 2. Enrich project_metadata.json
// 3. Build adaptive prompt
// 4. Call firstUse LLM
// 5. Lock ground truth

async bootstrap(): Promise<BootstrapResult> {
  // STEP 1: Scan workspace (SYNCHRONOUS, BLOCKING)
  const projectContext = await this.scanWorkspace();
  
  // STEP 2: Enrich metadata BEFORE LLM (CRITICAL)
  await this.enrichProjectMetadata(projectContext);
  
  // STEP 3: Build adaptive prompt (uses metadata)
  const adaptivePrompt = await this.buildAdaptivePrompt(projectContext);
  
  // STEP 4: Call LLM with enriched context
  const llmResult = await this.callFirstUseLLM(adaptivePrompt);
  
  // STEP 5: Write RL4 files from LLM response
  await this.writeRL4Files(llmResult);
  
  // STEP 6: Lock ground truth
  await this.lockGroundTruth();
  
  // STEP 7: Transition to flexible mode
  await this.transitionToFlexibleMode();
}
```

**Fichiers à modifier:**
- `extension/kernel/bootstrap/FirstBootstrapEngine.ts`
- `extension/kernel/api/UnifiedPromptBuilder.ts` (firstUse prompt)

**Durée:** 3h

**Tests de validation:**
- [ ] `project_metadata.json` créé AVANT premier appel LLM
- [ ] Prompt firstUse contient `{PROJECT_NAME}`, `{DOMAIN}`, `{TECH_STACK}` (pas de placeholders)
- [ ] Cycle 1 détecte patterns contextualisés (vérifier `.reasoning_rl4/patterns.json`)

---

### **Tâche 0.2: Refonte du Ground Truth System (CRITIQUE)**

**Problème identifié:**
- `Ground_Truth.RL4` duplique `Plan.RL4` + `Tasks.RL4` + `Context.RL4`
- Risque de divergence et d'incohérence

**Solution:**
```typescript
// Ground Truth = snapshot YAML des 3 fichiers RL4 après firstUse
// Structure :
.reasoning_rl4/
  ground_truth/
    Plan.yaml          // Copie exacte de Plan.RL4 (sans markdown)
    Tasks.yaml         // Copie exacte de Tasks.RL4 (sans markdown)
    Context.yaml       // Copie exacte de Context.RL4 (sans markdown)
    merkle_root.txt    // Hash Merkle du snapshot
    established_at.txt // Timestamp ISO

// Pas de fichier Ground_Truth.RL4 séparé !
```

**Implémentation:**
```typescript
async establishGroundTruth(): Promise<void> {
  const groundTruthDir = path.join(this.rl4Path, 'ground_truth');
  fs.mkdirSync(groundTruthDir, { recursive: true });
  
  // 1. Parse current RL4 files
  const plan = this.planTasksContextParser.parsePlan();
  const tasks = this.planTasksContextParser.parseTasks();
  const context = this.planTasksContextParser.parseContext();
  
  // 2. Extract YAML frontmatter only (no markdown)
  const planYaml = yaml.dump({ version: plan.version, updated: plan.updated, confidence: plan.confidence, phase: plan.phase, goal: plan.goal, timeline: plan.timeline, successCriteria: plan.successCriteria, constraints: plan.constraints });
  const tasksYaml = yaml.dump({ version: tasks.version, updated: tasks.updated, bias: tasks.bias, active: tasks.active, blockers: tasks.blockers, completed: tasks.completed });
  const contextYaml = yaml.dump({ version: context.version, updated: context.updated, confidence: context.confidence, activeFiles: context.activeFiles, recentActivity: context.recentActivity, health: context.health, observations: context.observations });
  
  // 3. Write YAML snapshots
  fs.writeFileSync(path.join(groundTruthDir, 'Plan.yaml'), planYaml);
  fs.writeFileSync(path.join(groundTruthDir, 'Tasks.yaml'), tasksYaml);
  fs.writeFileSync(path.join(groundTruthDir, 'Context.yaml'), contextYaml);
  
  // 4. Calculate Merkle root
  const merkleRoot = this.calculateMerkleRoot([planYaml, tasksYaml, contextYaml]);
  fs.writeFileSync(path.join(groundTruthDir, 'merkle_root.txt'), merkleRoot);
  
  // 5. Write timestamp
  fs.writeFileSync(path.join(groundTruthDir, 'established_at.txt'), new Date().toISOString());
  
  // 6. Lock in Context.RL4
  context.first_use_lock = true;
  context.ground_truth_established = true;
  this.planTasksContextParser.saveContext(context);
}

calculateDriftFromGroundTruth(): number {
  const groundTruthDir = path.join(this.rl4Path, 'ground_truth');
  
  // Load ground truth snapshots
  const gtPlanYaml = fs.readFileSync(path.join(groundTruthDir, 'Plan.yaml'), 'utf-8');
  const gtTasksYaml = fs.readFileSync(path.join(groundTruthDir, 'Tasks.yaml'), 'utf-8');
  const gtContextYaml = fs.readFileSync(path.join(groundTruthDir, 'Context.yaml'), 'utf-8');
  
  const gtPlan = yaml.load(gtPlanYaml);
  const gtTasks = yaml.load(gtTasksYaml);
  const gtContext = yaml.load(gtContextYaml);
  
  // Load current RL4 files
  const currentPlan = this.planTasksContextParser.parsePlan();
  const currentTasks = this.planTasksContextParser.parseTasks();
  const currentContext = this.planTasksContextParser.parseContext();
  
  // Calculate Levenshtein distance for each field
  const planDrift = this.levenshteinDistance(JSON.stringify(gtPlan), JSON.stringify(currentPlan));
  const tasksDrift = this.levenshteinDistance(JSON.stringify(gtTasks), JSON.stringify(currentTasks));
  const contextDrift = this.levenshteinDistance(JSON.stringify(gtContext), JSON.stringify(currentContext));
  
  // Normalize to 0-100%
  const totalDrift = (planDrift + tasksDrift + contextDrift) / 3;
  return Math.min(100, Math.round(totalDrift));
}
```

**Fichiers à créer:**
- `extension/kernel/GroundTruthSystem.ts`

**Fichiers à modifier:**
- `extension/kernel/bootstrap/FirstBootstrapEngine.ts`
- `extension/kernel/CognitiveScheduler.ts` (calculatePlanDrift)

**Durée:** 4h

**Tests de validation:**
- [ ] `ground_truth/` directory créé après firstUse
- [ ] 3 fichiers YAML présents (Plan, Tasks, Context)
- [ ] `merkle_root.txt` calculé correctement
- [ ] `calculateDriftFromGroundTruth()` retourne 0% immédiatement après établissement

---

### **Tâche 0.3: Refonte du Bias System (CRITIQUE)**

**Problème identifié:**
- Bias = seuil global par mode
- Pas d'historique des impacts
- Pas de "bias slope" (pente)
- Un LLM peut consommer 25% en une seule action

**Solution:**
```typescript
interface BiasImpact {
  timestamp: string;
  action: string; // 'file_created', 'file_modified', 'lines_added', etc.
  impact: number; // 0-100%
  mode: 'strict' | 'flexible' | 'exploratory' | 'free';
}

interface BiasHistory {
  impacts: BiasImpact[];
  rollingWindow: number; // Number of actions to consider
  currentTotal: number; // Sum of last N impacts
  slope: number; // Derivative (positive = increasing bias)
}

class BiasSystem {
  private history: BiasHistory = {
    impacts: [],
    rollingWindow: 10,
    currentTotal: 0,
    slope: 0
  };
  
  private readonly limitsPerMode = {
    strict: { maxPerAction: 0, maxCumulative: 0, rollingWindow: 1 },
    flexible: { maxPerAction: 10, maxCumulative: 25, rollingWindow: 5 },
    exploratory: { maxPerAction: 20, maxCumulative: 50, rollingWindow: 10 },
    free: { maxPerAction: 999, maxCumulative: 100, rollingWindow: 999 }
  };
  
  recordImpact(action: string, impact: number, mode: string): void {
    this.history.impacts.push({
      timestamp: new Date().toISOString(),
      action,
      impact,
      mode
    });
    
    // Keep only last rollingWindow impacts
    const limit = this.limitsPerMode[mode];
    if (this.history.impacts.length > limit.rollingWindow) {
      this.history.impacts.shift();
    }
    
    // Recalculate cumulative bias
    this.history.currentTotal = this.history.impacts.reduce((sum, i) => sum + i.impact, 0);
    
    // Calculate slope (linear regression of last 3 impacts)
    if (this.history.impacts.length >= 3) {
      const recent = this.history.impacts.slice(-3);
      const slope = (recent[2].impact - recent[0].impact) / 2;
      this.history.slope = slope;
    }
  }
  
  validateAction(action: string, impact: number, mode: string): { allowed: boolean; reason?: string } {
    const limit = this.limitsPerMode[mode];
    
    // Check per-action limit
    if (impact > limit.maxPerAction) {
      return {
        allowed: false,
        reason: `Action impact (${impact}%) exceeds per-action limit (${limit.maxPerAction}%)`
      };
    }
    
    // Check cumulative limit
    const newTotal = this.history.currentTotal + impact;
    if (newTotal > limit.maxCumulative) {
      return {
        allowed: false,
        reason: `Cumulative bias (${newTotal}%) would exceed limit (${limit.maxCumulative}%)`
      };
    }
    
    // Check slope (if increasing too fast, warn)
    if (this.history.slope > 5 && mode !== 'free') {
      console.warn(`⚠️ Bias slope increasing rapidly (+${this.history.slope}%/action)`);
    }
    
    return { allowed: true };
  }
  
  getBiasReport(): { currentTotal: number; slope: number; recentImpacts: BiasImpact[] } {
    return {
      currentTotal: this.history.currentTotal,
      slope: this.history.slope,
      recentImpacts: this.history.impacts.slice(-5)
    };
  }
  
  reset(): void {
    this.history = {
      impacts: [],
      rollingWindow: 10,
      currentTotal: 0,
      slope: 0
    };
  }
}
```

**Fichiers à créer:**
- `extension/kernel/BiasSystem.ts`

**Fichiers à modifier:**
- `extension/kernel/CognitiveScheduler.ts` (intégrer BiasSystem)
- `extension/kernel/api/BiasCalculator.ts` (remplacer par BiasSystem)

**Durée:** 3h

**Tests de validation:**
- [ ] BiasSystem refuse une action si `impact > maxPerAction`
- [ ] BiasSystem refuse une action si `cumulativeTotal + impact > maxCumulative`
- [ ] `getBiasReport()` retourne slope correcte (vérifier avec 3 actions successives)
- [ ] `reset()` remet à zéro l'historique

---

### **Tâche 0.4: Guardrail Anti-Policy Collapse (CRITIQUE)**

**Problème identifié:**
- Aucun guard pour détecter si le LLM ignore les contraintes
- Risque de "policy collapse" (LLM devient un chat normal)

**Solution:**
```typescript
interface PolicyCollapseSignals {
  forbiddenKeywords: string[];
  requiredPatterns: string[];
  maxConsecutiveViolations: number;
}

const policySignalsByMode: Record<string, PolicyCollapseSignals> = {
  strict: {
    forbiddenKeywords: ['new feature', 'refactor', 'architecture', 'rewrite', 'improve', 'optimize'],
    requiredPatterns: ['P0', 'Tasks.RL4', 'Plan.RL4'],
    maxConsecutiveViolations: 1
  },
  flexible: {
    forbiddenKeywords: ['major refactor', 'framework change', 'rewrite'],
    requiredPatterns: ['P0', 'P1'],
    maxConsecutiveViolations: 2
  },
  exploratory: {
    forbiddenKeywords: ['full implementation', 'deploy', 'production'],
    requiredPatterns: ['proposal', 'idea', 'opportunity'],
    maxConsecutiveViolations: 3
  },
  commit: {
    forbiddenKeywords: ['apply', 'modify', 'patch', 'write'],
    requiredPatterns: ['commit', 'message', 'summary'],
    maxConsecutiveViolations: 0
  },
  free: {
    forbiddenKeywords: [],
    requiredPatterns: [],
    maxConsecutiveViolations: 999
  }
};

class PolicyCollapseDetector {
  private violationHistory: Array<{ timestamp: string; mode: string; reason: string }> = [];
  
  detectCollapse(llmResponse: string, mode: string): { collapsed: boolean; reason?: string } {
    const signals = policySignalsByMode[mode];
    
    // Check for forbidden keywords
    const lowerResponse = llmResponse.toLowerCase();
    for (const keyword of signals.forbiddenKeywords) {
      if (lowerResponse.includes(keyword)) {
        this.recordViolation(mode, `Forbidden keyword detected: "${keyword}"`);
        
        // Check consecutive violations
        const recentViolations = this.violationHistory.filter(v => 
          Date.now() - new Date(v.timestamp).getTime() < 5 * 60 * 1000 // Last 5 minutes
        );
        
        if (recentViolations.length > signals.maxConsecutiveViolations) {
          return {
            collapsed: true,
            reason: `Policy collapse: ${recentViolations.length} consecutive violations (max: ${signals.maxConsecutiveViolations})`
          };
        }
      }
    }
    
    // Check for required patterns
    let foundRequired = false;
    for (const pattern of signals.requiredPatterns) {
      if (lowerResponse.includes(pattern.toLowerCase())) {
        foundRequired = true;
        break;
      }
    }
    
    if (signals.requiredPatterns.length > 0 && !foundRequired) {
      this.recordViolation(mode, `Missing required pattern (expected one of: ${signals.requiredPatterns.join(', ')})`);
    }
    
    return { collapsed: false };
  }
  
  private recordViolation(mode: string, reason: string): void {
    this.violationHistory.push({
      timestamp: new Date().toISOString(),
      mode,
      reason
    });
    
    // Keep only last 10 violations
    if (this.violationHistory.length > 10) {
      this.violationHistory.shift();
    }
  }
  
  reset(): void {
    this.violationHistory = [];
  }
}
```

**Fichiers à créer:**
- `extension/kernel/PolicyCollapseDetector.ts`

**Fichiers à modifier:**
- `extension/extension.ts` (intégrer dans WebView handlers)

**Durée:** 2h

**Tests de validation:**
- [ ] Mode STRICT détecte "new feature" → violation
- [ ] 2 violations consécutives en STRICT → collapse détecté
- [ ] Mode COMMIT détecte "apply patch" → violation immédiate
- [ ] Mode FREE n'a aucune violation

---

### **Tâche 0.5: Bounded Context Extraction (CRITIQUE)**

**Problème identifié:**
- LLM reçoit toujours le même prompt (lourd)
- Si contexte lourd (gros fichier ouvert), LLM n'a plus de mémoire pour émettre des observations
- Engines sous-alimentés

**Solution:**
```typescript
interface ContextBounds {
  maxTokens: number;
  includeFullHistory: boolean;
  includeFullEngineData: boolean;
  includeFullTimeline: boolean;
}

const contextBoundsByMode: Record<string, ContextBounds> = {
  strict: { maxTokens: 50000, includeFullHistory: false, includeFullEngineData: false, includeFullTimeline: false },
  flexible: { maxTokens: 100000, includeFullHistory: false, includeFullEngineData: true, includeFullTimeline: true },
  exploratory: { maxTokens: 150000, includeFullHistory: true, includeFullEngineData: true, includeFullTimeline: true },
  free: { maxTokens: 200000, includeFullHistory: true, includeFullEngineData: true, includeFullTimeline: true },
  firstUse: { maxTokens: 200000, includeFullHistory: false, includeFullEngineData: false, includeFullTimeline: false },
  commit: { maxTokens: 80000, includeFullHistory: false, includeFullEngineData: false, includeFullTimeline: false }
};

class BoundedContextExtractor {
  extractContext(mode: string, fullSnapshot: SnapshotData): SnapshotData {
    const bounds = contextBoundsByMode[mode];
    
    // Estimate token count
    const estimatedTokens = this.estimateTokenCount(fullSnapshot);
    
    if (estimatedTokens <= bounds.maxTokens) {
      // No need to trim
      return fullSnapshot;
    }
    
    // Trim based on bounds
    const trimmedSnapshot = { ...fullSnapshot };
    
    if (!bounds.includeFullHistory) {
      trimmedSnapshot.historySummary = this.summarizeHistory(fullSnapshot.historySummary);
    }
    
    if (!bounds.includeFullEngineData) {
      trimmedSnapshot.enginePatterns = fullSnapshot.enginePatterns.slice(-5); // Keep last 5 patterns
      trimmedSnapshot.engineCorrelations = fullSnapshot.engineCorrelations.slice(-5);
      trimmedSnapshot.engineForecasts = fullSnapshot.engineForecasts.slice(-5);
    }
    
    if (!bounds.includeFullTimeline) {
      trimmedSnapshot.timeline = fullSnapshot.timeline.slice(-10); // Keep last 10 timeline entries
    }
    
    // Log compression ratio
    const newTokens = this.estimateTokenCount(trimmedSnapshot);
    const compressionRatio = (estimatedTokens - newTokens) / estimatedTokens;
    console.log(`📉 Context trimmed: ${estimatedTokens} → ${newTokens} tokens (${Math.round(compressionRatio * 100)}% reduction)`);
    
    return trimmedSnapshot;
  }
  
  private estimateTokenCount(snapshot: SnapshotData): number {
    // Rough estimate: 1 token ~= 4 characters
    const json = JSON.stringify(snapshot);
    return Math.round(json.length / 4);
  }
  
  private summarizeHistory(history: HistorySummary | null): HistorySummary | null {
    if (!history) return null;
    
    // Keep only last 3 cycles
    return {
      ...history,
      cycles: history.cycles.slice(-3)
    };
  }
}
```

**Fichiers à créer:**
- `extension/kernel/api/BoundedContextExtractor.ts`

**Fichiers à modifier:**
- `extension/kernel/api/UnifiedPromptBuilder.ts` (appeler BoundedContextExtractor avant formatPrompt)

**Durée:** 2h

**Tests de validation:**
- [ ] Mode STRICT génère prompt < 50k tokens
- [ ] Mode FREE génère prompt < 200k tokens
- [ ] Compression ratio loggé (vérifier console)
- [ ] Engines reçoivent observations même avec gros contexte

---

### **Tâche 0.6: Mode FREE Throttle (CRITIQUE)**

**Problème identifié:**
- Mode FREE = 100% threshold
- LLM peut créer 1000 fichiers d'un coup
- Ledger explose, file watcher loop, pattern engine saturé

**Solution:**
```typescript
interface FreeModeThrottle {
  maxMutationsPerCycle: number;
  maxNewFilesPerCycle: number;
  maxRecursiveModificationsDepth: number;
  maxLinesAddedPerFile: number;
}

const freeModeThrottle: FreeModeThrottle = {
  maxMutationsPerCycle: 200,
  maxNewFilesPerCycle: 20,
  maxRecursiveModificationsDepth: 4,
  maxLinesAddedPerFile: 1000
};

class FreeModeThrottleValidator {
  validate(mutations: FileMutation[]): { allowed: boolean; reason?: string } {
    // Check total mutations
    if (mutations.length > freeModeThrottle.maxMutationsPerCycle) {
      return {
        allowed: false,
        reason: `Too many mutations (${mutations.length} > ${freeModeThrottle.maxMutationsPerCycle})`
      };
    }
    
    // Check new files
    const newFiles = mutations.filter(m => m.type === 'create');
    if (newFiles.length > freeModeThrottle.maxNewFilesPerCycle) {
      return {
        allowed: false,
        reason: `Too many new files (${newFiles.length} > ${freeModeThrottle.maxNewFilesPerCycle})`
      };
    }
    
    // Check lines added per file
    for (const mut of mutations) {
      if (mut.linesAdded > freeModeThrottle.maxLinesAddedPerFile) {
        return {
          allowed: false,
          reason: `Too many lines added to ${mut.file} (${mut.linesAdded} > ${freeModeThrottle.maxLinesAddedPerFile})`
        };
      }
    }
    
    // Check recursive modifications (e.g., modifying a file that was just created)
    const recursiveDepth = this.calculateRecursiveDepth(mutations);
    if (recursiveDepth > freeModeThrottle.maxRecursiveModificationsDepth) {
      return {
        allowed: false,
        reason: `Recursive modifications too deep (depth ${recursiveDepth} > ${freeModeThrottle.maxRecursiveModificationsDepth})`
      };
    }
    
    return { allowed: true };
  }
  
  private calculateRecursiveDepth(mutations: FileMutation[]): number {
    // Build dependency graph
    const graph: Map<string, Set<string>> = new Map();
    
    for (const mut of mutations) {
      if (!graph.has(mut.file)) {
        graph.set(mut.file, new Set());
      }
      
      for (const dep of mut.dependencies || []) {
        graph.get(mut.file)!.add(dep);
      }
    }
    
    // Calculate max depth
    let maxDepth = 0;
    for (const [file, deps] of graph.entries()) {
      const depth = this.dfs(file, graph, new Set());
      maxDepth = Math.max(maxDepth, depth);
    }
    
    return maxDepth;
  }
  
  private dfs(file: string, graph: Map<string, Set<string>>, visited: Set<string>): number {
    if (visited.has(file)) return 0;
    visited.add(file);
    
    const deps = graph.get(file) || new Set();
    let maxDepth = 0;
    
    for (const dep of deps) {
      maxDepth = Math.max(maxDepth, 1 + this.dfs(dep, graph, visited));
    }
    
    return maxDepth;
  }
}
```

**Fichiers à créer:**
- `extension/kernel/FreeModeThrottleValidator.ts`

**Fichiers à modifier:**
- `extension/kernel/api/UnifiedPromptBuilder.ts` (ajouter instructions throttle dans formatFreeMode)

**Durée:** 2h

**Tests de validation:**
- [ ] Mode FREE refuse si > 200 mutations
- [ ] Mode FREE refuse si > 20 nouveaux fichiers
- [ ] Mode FREE refuse si recursive depth > 4
- [ ] Mode FREE accepte si dans les limites

---

**TOTAL Phase 0:** 18h (CRITIQUE — BLOCAGE TOTAL)

---

## Phase 1: Fondations (P0)

**⚠️ Ne peut démarrer QUE si Phase 0 est complète**

### **Tâche 1.1: System Metrics Foundation**

**Problème identifié:**
- Pas de métriques système (`memory`, `CPU`, `cycle duration`, etc.)
- Impossible d'avoir des KPIs robustes

**Solution:**
```typescript
interface SystemMetrics {
  memory: {
    baseline: number; // MB
    current: number; // MB
    peak: number; // MB
    delta: number; // MB (current - baseline)
  };
  cpu: {
    cycleTime: number; // ms
    averageCycleTime: number; // ms (rolling average last 10 cycles)
  };
  fileWatcher: {
    eventsPerMinute: number;
    totalEvents: number;
  };
  mutations: {
    totalMutations: number;
    mutationsPerCycle: number;
  };
  webview: {
    messagesSent: number;
    messagesReceived: number;
  };
  ledger: {
    sizeBytes: number;
    entriesCount: number;
  };
}

class SystemMetricsCollector {
  private metrics: SystemMetrics = {
    memory: { baseline: 0, current: 0, peak: 0, delta: 0 },
    cpu: { cycleTime: 0, averageCycleTime: 0 },
    fileWatcher: { eventsPerMinute: 0, totalEvents: 0 },
    mutations: { totalMutations: 0, mutationsPerCycle: 0 },
    webview: { messagesSent: 0, messagesReceived: 0 },
    ledger: { sizeBytes: 0, entriesCount: 0 }
  };
  
  private cycleTimesHistory: number[] = [];
  
  recordCycleStart(): void {
    this.metrics.memory.current = process.memoryUsage().heapUsed / 1024 / 1024;
    if (this.metrics.memory.baseline === 0) {
      this.metrics.memory.baseline = this.metrics.memory.current;
    }
    this.metrics.memory.delta = this.metrics.memory.current - this.metrics.memory.baseline;
    this.metrics.memory.peak = Math.max(this.metrics.memory.peak, this.metrics.memory.current);
  }
  
  recordCycleEnd(duration: number): void {
    this.metrics.cpu.cycleTime = duration;
    this.cycleTimesHistory.push(duration);
    
    if (this.cycleTimesHistory.length > 10) {
      this.cycleTimesHistory.shift();
    }
    
    this.metrics.cpu.averageCycleTime = this.cycleTimesHistory.reduce((sum, t) => sum + t, 0) / this.cycleTimesHistory.length;
  }
  
  recordFileWatcherEvent(): void {
    this.metrics.fileWatcher.totalEvents++;
  }
  
  recordMutation(): void {
    this.metrics.mutations.totalMutations++;
    this.metrics.mutations.mutationsPerCycle++;
  }
  
  recordWebViewMessage(direction: 'sent' | 'received'): void {
    if (direction === 'sent') {
      this.metrics.webview.messagesSent++;
    } else {
      this.metrics.webview.messagesReceived++;
    }
  }
  
  recordLedgerSize(sizeBytes: number, entriesCount: number): void {
    this.metrics.ledger.sizeBytes = sizeBytes;
    this.metrics.ledger.entriesCount = entriesCount;
  }
  
  getMetrics(): SystemMetrics {
    return { ...this.metrics };
  }
  
  saveToFile(rl4Path: string): void {
    const metricsPath = path.join(rl4Path, 'system_metrics.json');
    fs.writeFileSync(metricsPath, JSON.stringify(this.metrics, null, 2));
  }
  
  resetCycleMetrics(): void {
    this.metrics.mutations.mutationsPerCycle = 0;
  }
}
```

**Fichiers à créer:**
- `extension/kernel/SystemMetricsCollector.ts`

**Fichiers à modifier:**
- `extension/kernel/CognitiveScheduler.ts` (intégrer SystemMetricsCollector)
- `extension/kernel/api/PlanTasksContextParser.ts` (enregistrer metrics après chaque save)

**Durée:** 3h

**Tests de validation:**
- [ ] `system_metrics.json` créé après cycle 1
- [ ] `memory.current` augmente après mutations
- [ ] `cpu.averageCycleTime` calculé correctement (vérifier avec 10 cycles)

---

### **Tâche 1.2: Context Traceability (rl4_context_id)**

**Problème identifié:**
- Pas d'identifiant universel pour un workspace RL4
- Impossible de synchroniser, exporter, importer, comparer

**Solution:**
```typescript
interface RL4ContextIdentity {
  rl4_context_id: string; // UNIQ ID (UUID v4)
  workspace_name: string;
  workspace_path: string;
  project_hash: string; // Hash of package.json + README.md
  ground_truth_hash: string; // Merkle root of ground truth
  created_at: string; // ISO timestamp
  last_updated: string; // ISO timestamp
}

class RL4ContextIdentityManager {
  private identityPath: string;
  
  constructor(rl4Path: string) {
    this.identityPath = path.join(rl4Path, 'context_identity.json');
  }
  
  async ensureIdentity(workspaceRoot: string): Promise<RL4ContextIdentity> {
    // Check if identity exists
    if (fs.existsSync(this.identityPath)) {
      const identity = JSON.parse(fs.readFileSync(this.identityPath, 'utf-8'));
      
      // Update last_updated
      identity.last_updated = new Date().toISOString();
      fs.writeFileSync(this.identityPath, JSON.stringify(identity, null, 2));
      
      return identity;
    }
    
    // Create new identity
    const identity: RL4ContextIdentity = {
      rl4_context_id: this.generateUUID(),
      workspace_name: path.basename(workspaceRoot),
      workspace_path: workspaceRoot,
      project_hash: await this.calculateProjectHash(workspaceRoot),
      ground_truth_hash: '', // Will be set after firstUse
      created_at: new Date().toISOString(),
      last_updated: new Date().toISOString()
    };
    
    fs.writeFileSync(this.identityPath, JSON.stringify(identity, null, 2));
    
    return identity;
  }
  
  updateGroundTruthHash(merkleRoot: string): void {
    const identity = JSON.parse(fs.readFileSync(this.identityPath, 'utf-8'));
    identity.ground_truth_hash = merkleRoot;
    identity.last_updated = new Date().toISOString();
    fs.writeFileSync(this.identityPath, JSON.stringify(identity, null, 2));
  }
  
  private generateUUID(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
  
  private async calculateProjectHash(workspaceRoot: string): Promise<string> {
    const packageJsonPath = path.join(workspaceRoot, 'package.json');
    const readmePath = path.join(workspaceRoot, 'README.md');
    
    let content = '';
    
    if (fs.existsSync(packageJsonPath)) {
      content += fs.readFileSync(packageJsonPath, 'utf-8');
    }
    
    if (fs.existsSync(readmePath)) {
      content += fs.readFileSync(readmePath, 'utf-8');
    }
    
    return crypto.createHash('sha256').update(content).digest('hex');
  }
}
```

**Fichiers à créer:**
- `extension/kernel/RL4ContextIdentityManager.ts`

**Fichiers à modifier:**
- `extension/kernel/KernelBootstrap.ts` (appeler ensureIdentity au bootstrap)

**Durée:** 2h

**Tests de validation:**
- [ ] `context_identity.json` créé après premier lancement
- [ ] `rl4_context_id` est un UUID valide
- [ ] `project_hash` change si `package.json` est modifié
- [ ] `ground_truth_hash` est écrit après firstUse

---

### **Tâche 1.3: Mode Pedagogy (buildModePedagogy)**

**Implémentation:**
```typescript
// Dans UnifiedPromptBuilder.ts
private buildModePedagogy(mode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse'): string {
  let section = `## 📖 MODE CONTEXT — Explain This to User\n\n`;
  
  switch (mode) {
    case 'strict':
      section += `**Current Mode:** 🔒 STRICT (0% threshold)\n\n`;
      section += `**What this mode does:**\n`;
      section += `- Executes ONLY tasks explicitly listed in Plan.RL4 and Tasks.RL4\n`;
      section += `- Rejects ALL new ideas, features, or refactors not already planned\n`;
      section += `- Focuses on **execution** rather than exploration\n`;
      section += `- Best for: Shipping an MVP, closing a sprint, staying on track\n\n`;
      
      section += `**When to use STRICT:**\n`;
      section += `- ✅ You have a clear plan and want zero distractions\n`;
      section += `- ✅ You're close to a deadline\n`;
      section += `- ✅ You want to avoid scope creep\n\n`;
      
      section += `**When to switch:**\n`;
      section += `- 🔀 No P0 tasks left? → Switch to **FLEXIBLE** (I can propose next steps)\n`;
      section += `- 🔀 Need to explore? → Switch to **EXPLORATORY** (I can generate ideas)\n`;
      section += `- 🔀 Want full freedom? → Switch to **FREE** (no limits)\n\n`;
      break;
      
    case 'flexible':
      section += `**Current Mode:** 🧩 FLEXIBLE (25% threshold)\n\n`;
      section += `**What this mode does:**\n`;
      section += `- Executes P0 and P1 tasks\n`;
      section += `- Allows small improvements (+5% bias max per action, +25% cumulative)\n`;
      section += `- Can propose new tasks if they align with the plan\n`;
      section += `- Best for: Steady progress with room for adaptation\n\n`;
      
      section += `**When to use FLEXIBLE:**\n`;
      section += `- ✅ You have a plan but want some breathing room\n`;
      section += `- ✅ You trust the LLM to suggest small improvements\n`;
      section += `- ✅ You're in active development (not shipping imminently)\n\n`;
      
      section += `**When to switch:**\n`;
      section += `- 🔀 Need strict discipline? → Switch to **STRICT**\n`;
      section += `- 🔀 Want to brainstorm? → Switch to **EXPLORATORY**\n`;
      section += `- 🔀 Want full control? → Switch to **FREE**\n\n`;
      break;
      
    case 'exploratory':
      section += `**Current Mode:** 🌍 EXPLORATORY (50% threshold)\n\n`;
      section += `**What this mode does:**\n`;
      section += `- Generates 5-10 optimization ideas\n`;
      section += `- Proposes new features as XML tokens: \`<task idea="feature">...</task>\`\n`;
      section += `- Does NOT modify RL4 files directly\n`;
      section += `- Best for: Brainstorming, discovering opportunities\n\n`;
      
      section += `**When to use EXPLORATORY:**\n`;
      section += `- ✅ You're unsure what to do next\n`;
      section += `- ✅ You want the LLM to inspire you\n`;
      section += `- ✅ You want ideas without commitment\n\n`;
      
      section += `**When to switch:**\n`;
      section += `- 🔀 Ready to execute? → Switch to **FLEXIBLE** or **STRICT**\n`;
      section += `- 🔀 Want LLM to act autonomously? → Switch to **FREE**\n\n`;
      break;
      
    case 'free':
      section += `**Current Mode:** 🔥 FREE (100% threshold, but throttled)\n\n`;
      section += `**What this mode does:**\n`;
      section += `- Full autonomy — LLM can do ANYTHING (within throttle limits)\n`;
      section += `- Can ignore plan, refactor massively, add features\n`;
      section += `- Kernel reconstructs activity at next snapshot\n`;
      section += `- Best for: Debugging sprints, emergency fixes, rapid prototyping\n\n`;
      
      section += `**Throttle Limits (enforced by kernel):**\n`;
      section += `- Max 200 file mutations per cycle\n`;
      section += `- Max 20 new files per cycle\n`;
      section += `- Max 1000 lines per file\n`;
      section += `- Max recursive depth: 4\n\n`;
      
      section += `**When to use FREE:**\n`;
      section += `- ✅ You need to move FAST without bureaucracy\n`;
      section += `- ✅ You trust the LLM completely\n`;
      section += `- ✅ You'll review changes afterward\n\n`;
      
      section += `**When to switch:**\n`;
      section += `- 🔀 Want control back? → Switch to **FLEXIBLE**\n`;
      section += `- 🔀 Need to stabilize? → Switch to **STRICT**\n\n`;
      break;
      
    case 'firstUse':
      section += `**Current Mode:** 🌱 FIRST USE (Bootstrap)\n\n`;
      section += `**What this mode does:**\n`;
      section += `- Reads README.md, package.json, code structure\n`;
      section += `- Generates initial Plan.RL4, Tasks.RL4, Context.RL4\n`;
      section += `- Establishes "ground truth" of the project\n`;
      section += `- Should only be used ONCE per workspace\n\n`;
      
      section += `**What happens next:**\n`;
      section += `- After bootstrap, mode automatically switches to **FLEXIBLE**\n`;
      section += `- \`first_use_lock: true\` prevents re-running this mode\n`;
      section += `- Ground truth is established in \`.reasoning_rl4/ground_truth/\`\n\n`;
      break;
  }
  
  section += `**🧠 LLM Instruction:**\n`;
  section += `When responding to the user, include a brief mode reminder if relevant:\n\n`;
  section += `> "🔒 **${mode.toUpperCase()} MODE ACTIVE** — [1-sentence explanation of why you accepted/rejected their request]"\n\n`;
  section += `This helps users learn the system while using it.\n\n`;
  section += `---\n\n`;
  
  return section;
}
```

**Fichiers à modifier:**
- `extension/kernel/api/UnifiedPromptBuilder.ts`

**Durée:** 2h

**Tests de validation:**
- [ ] Prompt contient section "MODE CONTEXT" pour chaque mode
- [ ] LLM reformule correctement les explications dans ses réponses

---

**TOTAL Phase 1:** 7h (P0)

---

## Phase 2: Mode System Enhancement (P1)

### **Tâche 2.1: Mode Strict - Alerte Tasks vides**

**Implémentation:**
```typescript
// Dans formatStrictMode()
private formatStrictMode(tasks: TasksData | null): string {
  let section = `**🚫 STRICT MODE (0% threshold) — Zero Deviation**\n\n`;
  
  section += `**Your role:** Execution Guardian — Protect the plan at all costs.\n\n`;
  
  section += `**Rules:**\n`;
  section += `1. ❌ **REJECT all new ideas** (add to backlog)\n`;
  section += `2. ✅ **Execute ONLY P0 tasks**\n`;
  section += `3. ⚠️ **Alert on ANY deviation**\n\n`;
  
  // ✅ NEW: Check if there are any P0 tasks
  if (!tasks || tasks.active.filter(t => t.task.includes('[P0]')).length === 0) {
    section += `\n⚠️ **CRITICAL ISSUE: NO P0 TASKS FOUND**\n\n`;
    section += `You are in STRICT MODE but there are no P0 tasks to execute.\n\n`;
    section += `**OPTIONS:**\n`;
    section += `a) Switch to FLEXIBLE mode (I can propose P0 tasks)\n`;
    section += `b) Switch to EXPLORATORY mode (I can generate task ideas)\n`;
    section += `c) Ask user to manually add P0 tasks to Tasks.RL4\n\n`;
    section += `**RECOMMENDATION:** Switch to FLEXIBLE mode to unblock development.\n\n`;
    section += `**LLM INSTRUCTION:** You MUST inform the user of this issue in your first response.\n\n`;
  } else {
    // List P0 tasks
    const p0Tasks = tasks.active.filter(t => !t.completed && t.task.includes('[P0]'));
    
    section += `**P0 Tasks Remaining:**\n`;
    p0Tasks.forEach((t, idx) => {
      section += `${idx + 1}. ${t.task}\n`;
    });
    section += `\n`;
  }
  
  // ... rest of formatStrictMode
}
```

**Fichiers à modifier:**
- `extension/kernel/api/UnifiedPromptBuilder.ts`

**Durée:** 1h

**Tests de validation:**
- [ ] Mode STRICT avec 0 tâches P0 → prompt contient "CRITICAL ISSUE"
- [ ] LLM informe l'utilisateur dans sa première réponse

---

### **Tâche 2.2: Exploratory Mode - Task Ideas XML Tokens**

**Implémentation:**
```typescript
// Dans formatExploratoryMode()
section += `\n## 💡 TASK IDEAS FORMAT\n\n`;
section += `When proposing new features, use this XML token format:\n\n`;
section += `\`\`\`xml\n`;
section += `<task idea="feature" priority="P1" effort="2h" bias="+8%">\n`;
section += `  Add OAuth2 authentication (Google, GitHub)\n`;
section += `</task>\n\n`;
section += `<task idea="refactor" priority="P2" effort="1h" bias="+5%">\n`;
section += `  Refactor TaskVerificationEngine for multi-condition support\n`;
section += `</task>\n`;
section += `\`\`\`\n\n`;
section += `These tokens will appear in the Dev tab for user approval.\n\n`;
section += `**XML Schema:**\n`;
section += `- \`idea\`: Type (feature, refactor, testing, optimization, documentation)\n`;
section += `- \`priority\`: P0, P1, P2, P3\n`;
section += `- \`effort\`: Realistic estimate (30m, 1h, 2h, 1d, 1w)\n`;
section += `- \`bias\`: Impact on plan drift (+X%)\n\n`;
section += `**LLM Instruction:** Generate 5-10 task ideas in XML format at the end of your response.\n\n`;
```

**Fichiers à modifier:**
- `extension/kernel/api/UnifiedPromptBuilder.ts`

**Durée:** 1h

**Tests de validation:**
- [ ] Prompt EXPLORATORY contient "TASK IDEAS FORMAT"
- [ ] LLM génère des tokens XML valides

---

### **Tâche 2.3: WebView Dev Tab - Accept/Deny UI**

**Implémentation:**
```tsx
// Dans App.tsx (Dev tab)
const [taskIdeas, setTaskIdeas] = useState<Array<{
  id: string;
  idea: string;
  priority: string;
  effort: string;
  bias: string;
  title: string;
}>>([]);

// Après suggestions (ligne ~830)
{taskIdeas.length > 0 && (
  <div className="dev-section">
    <h3 className="dev-section-title">💡 Exploratory Task Ideas</h3>
    <p className="dev-section-subtitle">
      Generated by LLM in exploratory mode. Accept to add to Tasks.RL4.
    </p>
    <ul className="dev-list">
      {taskIdeas.map(idea => (
        <li key={idea.id} className="dev-list-item">
          <div className="dev-item-content">
            <div className="dev-item-main">
              <div className="dev-item-title">
                {idea.title}
                <span className={`dev-badge dev-badge-${idea.priority.toLowerCase()}`}>
                  {idea.priority}
                </span>
                <span className="dev-badge dev-badge-effort">
                  {idea.effort}
                </span>
                <span className="dev-badge dev-badge-bias">
                  Bias: {idea.bias}
                </span>
              </div>
              <div className="dev-item-description">
                Type: {idea.idea}
              </div>
            </div>
            <div className="dev-item-actions">
              <button
                className="dev-action-accept"
                onClick={() => handleAcceptTaskIdea(idea.id)}
              >
                ✅ Accept
              </button>
              <button
                className="dev-action-deny"
                onClick={() => handleDenyTaskIdea(idea.id)}
              >
                ❌ Deny
              </button>
            </div>
          </div>
        </li>
      ))}
    </ul>
  </div>
)}

// Handlers
const handleAcceptTaskIdea = (id: string) => {
  if (!window.vscode) return;
  window.vscode.postMessage({ type: 'acceptTaskIdea', payload: { id } });
};

const handleDenyTaskIdea = (id: string) => {
  if (!window.vscode) return;
  window.vscode.postMessage({ type: 'denyTaskIdea', payload: { id } });
};

// Message handler
taskIdeasUpdated: (payload) => {
  setTaskIdeas(payload.taskIdeas || []);
  if (payload.taskIdeas && payload.taskIdeas.length > 0) {
    setFeedbackWithTimeout(`💡 ${payload.taskIdeas.length} task ideas generated`, 2000);
  }
}
```

**Backend handlers (extension.ts):**
```typescript
case 'acceptTaskIdea':
  try {
    const { id } = message.payload;
    const taskIdeasPath = path.join(workspaceRoot, '.reasoning_rl4', 'task_ideas.json');
    
    if (!fs.existsSync(taskIdeasPath)) {
      break;
    }
    
    const taskIdeas = JSON.parse(fs.readFileSync(taskIdeasPath, 'utf-8'));
    const idea = taskIdeas.find((i: any) => i.id === id);
    
    if (!idea) {
      break;
    }
    
    // Add to Tasks.RL4
    const tasksPath = path.join(workspaceRoot, '.reasoning_rl4', 'Tasks.RL4');
    const tasksContent = fs.readFileSync(tasksPath, 'utf-8');
    
    // Parse frontmatter and content
    const { frontmatter, markdown } = parseFrontmatter(tasksContent);
    
    // Add task to active section
    const newTask = `- [ ] [${idea.priority}] ${idea.title} @rl4:id=${id}`;
    const updatedMarkdown = markdown.replace(
      '## Active',
      `## Active\n${newTask}`
    );
    
    // Write back
    const updatedContent = `---\n${yaml.dump(frontmatter).trim()}\n---\n\n${updatedMarkdown}`;
    fs.writeFileSync(tasksPath, updatedContent);
    
    // Remove from task_ideas.json
    const updatedIdeas = taskIdeas.filter((i: any) => i.id !== id);
    fs.writeFileSync(taskIdeasPath, JSON.stringify(updatedIdeas, null, 2));
    
    // Send updated task ideas to WebView
    webviewPanel!.webview.postMessage({
      type: 'taskIdeasUpdated',
      payload: { taskIdeas: updatedIdeas }
    });
    
    logger!.system(`✅ Task idea accepted: ${idea.title}`, '✅');
  } catch (error) {
    logger!.error(`Failed to accept task idea: ${error}`);
  }
  break;

case 'denyTaskIdea':
  try {
    const { id } = message.payload;
    const taskIdeasPath = path.join(workspaceRoot, '.reasoning_rl4', 'task_ideas.json');
    
    if (!fs.existsSync(taskIdeasPath)) {
      break;
    }
    
    const taskIdeas = JSON.parse(fs.readFileSync(taskIdeasPath, 'utf-8'));
    
    // Remove from task_ideas.json
    const updatedIdeas = taskIdeas.filter((i: any) => i.id !== id);
    fs.writeFileSync(taskIdeasPath, JSON.stringify(updatedIdeas, null, 2));
    
    // Send updated task ideas to WebView
    webviewPanel!.webview.postMessage({
      type: 'taskIdeasUpdated',
      payload: { taskIdeas: updatedIdeas }
    });
    
    logger!.system(`❌ Task idea denied: ${id}`, '❌');
  } catch (error) {
    logger!.error(`Failed to deny task idea: ${error}`);
  }
  break;
```

**Fichiers à modifier:**
- `extension/webview/ui/src/App.tsx`
- `extension/webview/ui/src/handlers/messageHandlers.ts`
- `extension/extension.ts`

**Durée:** 3h

**Tests de validation:**
- [ ] Task ideas apparaissent dans Dev tab
- [ ] Accept ajoute la tâche à `Tasks.RL4`
- [ ] Deny supprime l'idea de `task_ideas.json`

---

**TOTAL Phase 2:** 5h (P1)

---

## Phase 3: Invariants & Validation (P1)

### **Tâche 3.1: Implement RL4 Invariants 1-10**

**Fichier à créer:** `extension/kernel/RL4Invariants.ts`

```typescript
export class RL4Invariants {
  private planTasksContextParser: PlanTasksContextParser;
  
  constructor(rl4Path: string) {
    this.planTasksContextParser = new PlanTasksContextParser(rl4Path);
  }
  
  // INVARIANT_1: Plan.RL4 must always have an active phase
  validatePlanPhase(plan: PlanData): boolean {
    if (!plan.phase || plan.phase === '') {
      throw new Error('INVARIANT_1 VIOLATED: Plan.RL4 must always have an active phase');
    }
    return true;
  }
  
  // Auto-correction
  correctPlanPhase(plan: PlanData): PlanData {
    if (!plan.phase || plan.phase === '') {
      plan.phase = 'Initial Setup';
    }
    return plan;
  }
  
  // INVARIANT_2: Tasks.RL4 must not contain cycles (DAG)
  validateTasksDAG(tasks: TasksData): boolean {
    const graph = this.buildTaskDependencyGraph(tasks);
    if (this.hasCycle(graph)) {
      throw new Error('INVARIANT_2 VIOLATED: Tasks.RL4 contains circular dependencies');
    }
    return true;
  }
  
  private buildTaskDependencyGraph(tasks: TasksData): Map<string, Set<string>> {
    const graph = new Map<string, Set<string>>();
    
    for (const task of tasks.active) {
      // Extract @rl4:id and @rl4:deps from task text
      const idMatch = task.task.match(/@rl4:id=([^\s]+)/);
      const depsMatch = task.task.match(/@rl4:deps=\[([^\]]+)\]/);
      
      if (idMatch) {
        const id = idMatch[1];
        const deps = depsMatch ? depsMatch[1].split(',').map(d => d.trim()) : [];
        
        if (!graph.has(id)) {
          graph.set(id, new Set());
        }
        
        for (const dep of deps) {
          graph.get(id)!.add(dep);
        }
      }
    }
    
    return graph;
  }
  
  private hasCycle(graph: Map<string, Set<string>>): boolean {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    
    for (const node of graph.keys()) {
      if (this.dfsCycle(node, graph, visited, recursionStack)) {
        return true;
      }
    }
    
    return false;
  }
  
  private dfsCycle(node: string, graph: Map<string, Set<string>>, visited: Set<string>, recursionStack: Set<string>): boolean {
    if (recursionStack.has(node)) {
      return true; // Cycle detected
    }
    
    if (visited.has(node)) {
      return false;
    }
    
    visited.add(node);
    recursionStack.add(node);
    
    const neighbors = graph.get(node) || new Set();
    for (const neighbor of neighbors) {
      if (this.dfsCycle(neighbor, graph, visited, recursionStack)) {
        return true;
      }
    }
    
    recursionStack.delete(node);
    return false;
  }
  
  // Auto-correction: Break cycle by removing last dependency
  correctTasksDAG(tasks: TasksData): TasksData {
    // Simplified: Remove all @rl4:deps annotations if cycle detected
    // In production, would do smarter cycle breaking
    for (const task of tasks.active) {
      task.task = task.task.replace(/@rl4:deps=\[[^\]]+\]/g, '');
    }
    return tasks;
  }
  
  // INVARIANT_3: Context.RL4 must always contain a valid mode
  validateContextMode(context: ContextData): boolean {
    const validModes = ['strict', 'flexible', 'exploratory', 'free', 'firstUse'];
    if (!context.deviation_mode || !validModes.includes(context.deviation_mode)) {
      throw new Error(`INVARIANT_3 VIOLATED: Context.RL4 has invalid deviation_mode: ${context.deviation_mode}`);
    }
    return true;
  }
  
  correctContextMode(context: ContextData): ContextData {
    const validModes = ['strict', 'flexible', 'exploratory', 'free', 'firstUse'];
    if (!context.deviation_mode || !validModes.includes(context.deviation_mode)) {
      context.deviation_mode = 'flexible';
    }
    return context;
  }
  
  // INVARIANT_4: ADRs.RL4 must be chronologically ordered
  validateADRsChronology(adrs: ADREntry[]): boolean {
    for (let i = 1; i < adrs.length; i++) {
      if (new Date(adrs[i].timestamp) < new Date(adrs[i - 1].timestamp)) {
        throw new Error('INVARIANT_4 VIOLATED: ADRs.RL4 is not chronologically ordered');
      }
    }
    return true;
  }
  
  correctADRsChronology(adrs: ADREntry[]): ADREntry[] {
    return adrs.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
  }
  
  // INVARIANT_5: Ground Truth is immutable
  validateGroundTruthImmutability(context: ContextData): boolean {
    if (context.first_use_lock && context.ground_truth_established) {
      throw new Error('INVARIANT_5 VIOLATED: Cannot modify Ground Truth after first_use_lock');
    }
    return true;
  }
  
  // INVARIANT_6: Snapshot must be atomic (all 3 core files parseable)
  validateSnapshotAtomicity(): boolean {
    try {
      const plan = this.planTasksContextParser.parsePlan();
      const tasks = this.planTasksContextParser.parseTasks();
      const context = this.planTasksContextParser.parseContext();
      
      if (!plan || !tasks || !context) {
        throw new Error('INVARIANT_6 VIOLATED: Snapshot is incomplete');
      }
      
      return true;
    } catch (error) {
      throw new Error(`INVARIANT_6 VIOLATED: Snapshot contains invalid YAML: ${error}`);
    }
  }
  
  // INVARIANT_7: KPIs LLM and Kernel must not overlap (warning only)
  validateKPISeparation(context: ContextData): boolean {
    if (context.kpis_llm && context.kpis_kernel) {
      const llmCycles = new Set(context.kpis_llm.map(k => k.cycle));
      const kernelCycles = new Set(context.kpis_kernel.map(k => k.cycle));
      
      const overlap = [...llmCycles].filter(c => kernelCycles.has(c));
      if (overlap.length > 0) {
        console.warn(`INVARIANT_7 WARNING: KPI overlap detected for cycles: ${overlap.join(', ')}`);
      }
    }
    return true;
  }
  
  // INVARIANT_8: WriteTracker must mark all internal writes
  // (This is enforced in PlanTasksContextParser, not a validation function)
  
  // INVARIANT_9: Ledger Merkle chain must not be broken
  validateMerkleChain(ledger: RBOMLedger): boolean {
    // Implemented in RBOMLedger.verify()
    return true;
  }
  
  // INVARIANT_10: Mode transitions must be traced
  validateModeTransition(oldMode: string, newMode: string, context: ContextData): ContextData {
    context.observations.push(`Mode transition: ${oldMode} → ${newMode} at ${new Date().toISOString()}`);
    context.deviation_mode = newMode;
    return context;
  }
  
  // Master validation function
  validateAll(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    try {
      const plan = this.planTasksContextParser.parsePlan();
      const tasks = this.planTasksContextParser.parseTasks();
      const context = this.planTasksContextParser.parseContext();
      
      if (plan) {
        try { this.validatePlanPhase(plan); } catch (e) { errors.push(e.message); }
      }
      
      if (tasks) {
        try { this.validateTasksDAG(tasks); } catch (e) { errors.push(e.message); }
      }
      
      if (context) {
        try { this.validateContextMode(context); } catch (e) { errors.push(e.message); }
        try { this.validateKPISeparation(context); } catch (e) { errors.push(e.message); }
      }
      
      try { this.validateSnapshotAtomicity(); } catch (e) { errors.push(e.message); }
      
    } catch (error) {
      errors.push(`Master validation failed: ${error}`);
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
}
```

**Fichiers à modifier:**
- `extension/kernel/api/PlanTasksContextParser.ts` (appeler invariants après chaque save)

**Durée:** 4h

**Tests de validation:**
- [ ] INVARIANT_1 détecte phase vide → auto-correction
- [ ] INVARIANT_2 détecte cycle → auto-correction
- [ ] INVARIANT_3 détecte mode invalide → auto-correction
- [ ] `validateAll()` retourne liste d'erreurs correcte

---

### **Tâche 3.2: Rollback on Corruption**

**Implémentation:**
```typescript
class RL4RollbackSystem {
  private rl4Path: string;
  
  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
  }
  
  createBackup(fileName: string): void {
    const filePath = path.join(this.rl4Path, fileName);
    const backupPath = filePath + '.backup_safe';
    
    if (fs.existsSync(filePath)) {
      fs.copyFileSync(filePath, backupPath);
      console.log(`✅ Backup created: ${fileName}.backup_safe`);
    }
  }
  
  rollback(fileName: string): boolean {
    const filePath = path.join(this.rl4Path, fileName);
    const backupPath = filePath + '.backup_safe';
    
    if (!fs.existsSync(backupPath)) {
      console.error(`❌ Cannot rollback ${fileName} (no backup found)`);
      return false;
    }
    
    fs.copyFileSync(backupPath, filePath);
    console.log(`✅ Rolled back ${fileName} from backup`);
    return true;
  }
  
  rollbackAll(): void {
    const files = ['Plan.RL4', 'Tasks.RL4', 'Context.RL4', 'ADRs.RL4'];
    
    for (const file of files) {
      this.rollback(file);
    }
  }
}
```

**Fichiers à créer:**
- `extension/kernel/RL4RollbackSystem.ts`

**Fichiers à modifier:**
- `extension/kernel/api/PlanTasksContextParser.ts` (créer backup avant chaque save)
- `extension/kernel/RL4Invariants.ts` (appeler rollback si validation échoue)

**Durée:** 2h

**Tests de validation:**
- [ ] `.backup_safe` créé avant chaque save
- [ ] Rollback restaure fichier corrompu
- [ ] `rollbackAll()` restaure tous les fichiers

---

**TOTAL Phase 3:** 6h (P1)

---

## Phase 4: Guardrails Anti-Hallucination (P2)

### **Tâche 4.1: Schema Validation**

**Implémentation:**
```typescript
import Ajv from 'ajv';

const RL4_PROPOSAL_SCHEMA = {
  type: 'object',
  properties: {
    RL4_PROPOSAL: {
      type: 'object',
      properties: {
        suggestedTasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              title: { type: 'string' },
              why: { type: 'string' },
              effort: { type: 'string' },
              roi: { type: 'number', minimum: 0, maximum: 10 },
              risk: { type: 'string', enum: ['low', 'medium', 'high'] },
              bias: { type: 'number', minimum: 0, maximum: 100 },
              deps: { type: 'array', items: { type: 'string' } },
              scope: { type: 'string' }
            },
            required: ['id', 'title', 'why', 'effort', 'roi', 'risk', 'bias']
          }
        }
      },
      required: ['suggestedTasks']
    }
  },
  required: ['RL4_PROPOSAL']
};

const KPI_RECORD_LLM_SCHEMA = {
  type: 'object',
  properties: {
    cycle: { type: 'number', minimum: 0 },
    cognitive_load: { type: 'number', minimum: 0, maximum: 100 },
    risks: { type: 'array', items: { type: 'string', minLength: 10 } },
    next_steps: { type: 'array', items: { type: 'string', minLength: 5 } },
    plan_drift: { type: 'number', minimum: 0, maximum: 100 },
    opportunities: { type: 'array', items: { type: 'string' } },
    updated: { type: 'string', format: 'date-time' }
  },
  required: ['cycle', 'cognitive_load', 'risks', 'next_steps', 'plan_drift', 'updated']
};

class SchemaValidator {
  private ajv: Ajv;
  
  constructor() {
    this.ajv = new Ajv({ allErrors: true });
  }
  
  validateRL4Proposal(data: any): { valid: boolean; errors?: string[] } {
    const validate = this.ajv.compile(RL4_PROPOSAL_SCHEMA);
    const valid = validate(data);
    
    if (!valid) {
      return {
        valid: false,
        errors: validate.errors?.map(e => `${e.instancePath} ${e.message}`)
      };
    }
    
    return { valid: true };
  }
  
  validateKPIRecordLLM(data: any): { valid: boolean; errors?: string[] } {
    const validate = this.ajv.compile(KPI_RECORD_LLM_SCHEMA);
    const valid = validate(data);
    
    if (!valid) {
      return {
        valid: false,
        errors: validate.errors?.map(e => `${e.instancePath} ${e.message}`)
      };
    }
    
    // Additional check: detect hallucinated risks (Lorem ipsum, too generic, etc.)
    if (data.risks && data.risks.length > 0) {
      for (const risk of data.risks) {
        if (risk.includes('Lorem ipsum') || risk.length < 10) {
          return {
            valid: false,
            errors: ['GUARDRAIL_3: Hallucinated risk detected']
          };
        }
      }
    }
    
    return { valid: true };
  }
}
```

**Fichiers à créer:**
- `extension/kernel/SchemaValidator.ts`

**Fichiers à modifier:**
- `extension/extension.ts` (valider RL4_PROPOSAL avant traitement)
- `extension/kernel/api/PlanTasksContextParser.ts` (valider KPIRecordLLM avant save)

**Durée:** 3h

**Tests de validation:**
- [ ] Schema validator rejette RL4_PROPOSAL invalide
- [ ] Schema validator détecte risks "Lorem ipsum"
- [ ] Schema validator accepte données valides

---

**TOTAL Phase 4:** 3h (P2)

---

## Phase 5: Engines Enrichment (P2)

### **Tâche 5.1: LLM Observations System**

**Implémentation:**
```typescript
// Créer .reasoning_rl4/llm_inputs/patterns.jsonl

interface LLMPatternInput {
  timestamp: string;
  pattern_type: string; // 'behavior', 'architecture', 'performance', 'bug'
  description: string;
  confidence: number; // 0.0-1.0
  related_files: string[];
  suggested_action: string;
}

class LLMObservationsCollector {
  private inputsPath: string;
  
  constructor(rl4Path: string) {
    this.inputsPath = path.join(rl4Path, 'llm_inputs');
    
    if (!fs.existsSync(this.inputsPath)) {
      fs.mkdirSync(this.inputsPath, { recursive: true });
    }
  }
  
  recordPatternObservation(observation: LLMPatternInput): void {
    const patternsPath = path.join(this.inputsPath, 'patterns.jsonl');
    const writer = new AppendOnlyWriter(patternsPath);
    writer.append(observation);
  }
  
  async readPatternObservations(): Promise<LLMPatternInput[]> {
    const patternsPath = path.join(this.inputsPath, 'patterns.jsonl');
    
    if (!fs.existsSync(patternsPath)) {
      return [];
    }
    
    const writer = new AppendOnlyWriter(patternsPath);
    return await writer.readAll();
  }
}
```

**Modifier PatternLearningEngine pour merger LLM inputs:**
```typescript
// Dans PatternLearningEngine.analyzePatterns()
async analyzePatterns(): Promise<Pattern[]> {
  // Existing pattern detection logic...
  
  // NEW: Merge LLM observations
  const llmObservations = await this.loadLLMObservations();
  
  for (const obs of llmObservations) {
    // Convert LLM observation to Pattern format
    const pattern: Pattern = {
      id: this.generateId(),
      type: obs.pattern_type,
      description: obs.description,
      occurrences: 1,
      confidence: obs.confidence,
      firstSeen: obs.timestamp,
      lastSeen: obs.timestamp,
      relatedFiles: obs.related_files,
      impact: obs.suggested_action.includes('critical') ? 'high' : 'medium',
      category: this.categorizePattern(obs.description)
    };
    
    patterns.push(pattern);
  }
  
  return patterns;
}

private async loadLLMObservations(): Promise<LLMPatternInput[]> {
  const collector = new LLMObservationsCollector(this.workspaceRoot);
  return await collector.readPatternObservations();
}
```

**Instructions LLM (dans UnifiedPromptBuilder):**
```markdown
## 🧠 LLM COGNITIVE ENRICHMENT MANDATE

**After analyzing the workspace, you MUST emit structured observations:**

```json
{
  "RL4_OBSERVATIONS": {
    "patterns": [
      {
        "pattern_type": "behavior",
        "description": "Users frequently abandon cart after seeing shipping cost",
        "confidence": 0.85,
        "related_files": ["components/Checkout.tsx", "api/shipping.ts"],
        "suggested_action": "Add shipping calculator earlier in flow"
      }
    ]
  }
}
```

These observations will be merged into the PatternLearningEngine at the next cycle.
```

**Fichiers à créer:**
- `extension/kernel/LLMObservationsCollector.ts`

**Fichiers à modifier:**
- `extension/kernel/cognitive/PatternLearningEngine.ts`
- `extension/kernel/api/UnifiedPromptBuilder.ts`

**Durée:** 5h

**Tests de validation:**
- [ ] `.reasoning_rl4/llm_inputs/patterns.jsonl` créé après observation LLM
- [ ] PatternLearningEngine merge observations LLM
- [ ] `patterns.json` contient patterns LLM + Kernel

---

**TOTAL Phase 5:** 5h (P2)

---

## Phase 6: System Metrics & Observability (P2)

### **Tâche 6.1: Meta-Prompt Normalizer**

**Problème identifié:**
- Prompts utilisateur flous → résultats flous

**Solution:**
```typescript
interface NormalizedPrompt {
  original: string;
  normalized: string;
  intent: 'task_execution' | 'exploration' | 'question' | 'refactor' | 'debug';
  entities: {
    files?: string[];
    functions?: string[];
    components?: string[];
    keywords?: string[];
  };
  confidence: number;
}

class MetaPromptNormalizer {
  normalize(userPrompt: string): NormalizedPrompt {
    const normalized: NormalizedPrompt = {
      original: userPrompt,
      normalized: '',
      intent: 'question',
      entities: {},
      confidence: 0.5
    };
    
    // Step 1: Detect intent
    const lowerPrompt = userPrompt.toLowerCase();
    
    if (lowerPrompt.includes('implement') || lowerPrompt.includes('add') || lowerPrompt.includes('create')) {
      normalized.intent = 'task_execution';
      normalized.confidence = 0.8;
    } else if (lowerPrompt.includes('explore') || lowerPrompt.includes('brainstorm') || lowerPrompt.includes('ideas')) {
      normalized.intent = 'exploration';
      normalized.confidence = 0.9;
    } else if (lowerPrompt.includes('refactor') || lowerPrompt.includes('optimize') || lowerPrompt.includes('improve')) {
      normalized.intent = 'refactor';
      normalized.confidence = 0.85;
    } else if (lowerPrompt.includes('bug') || lowerPrompt.includes('fix') || lowerPrompt.includes('debug')) {
      normalized.intent = 'debug';
      normalized.confidence = 0.9;
    } else {
      normalized.intent = 'question';
      normalized.confidence = 0.6;
    }
    
    // Step 2: Extract entities
    
    // Files (detect .ts, .tsx, .js, .jsx, .py, etc.)
    const fileRegex = /\b[\w\/\-]+\.(ts|tsx|js|jsx|py|md|json|yaml|yml)\b/g;
    const fileMatches = userPrompt.match(fileRegex);
    if (fileMatches) {
      normalized.entities.files = Array.from(new Set(fileMatches));
    }
    
    // Functions (detect camelCase or PascalCase identifiers)
    const functionRegex = /\b[a-z][a-zA-Z0-9]+\b|\b[A-Z][a-zA-Z0-9]+\b/g;
    const functionMatches = userPrompt.match(functionRegex);
    if (functionMatches) {
      normalized.entities.functions = Array.from(new Set(functionMatches)).slice(0, 5); // Top 5
    }
    
    // Keywords (important verbs)
    const keywords = ['implement', 'add', 'create', 'refactor', 'optimize', 'fix', 'debug', 'explore', 'brainstorm'];
    normalized.entities.keywords = keywords.filter(k => lowerPrompt.includes(k));
    
    // Step 3: Normalize prompt (expand abbreviations, fix typos, etc.)
    normalized.normalized = userPrompt
      .replace(/\bpls\b/gi, 'please')
      .replace(/\bthx\b/gi, 'thanks')
      .replace(/\bu\b/gi, 'you')
      .replace(/\br\b/gi, 'are')
      .trim();
    
    return normalized;
  }
}
```

**Fichiers à créer:**
- `extension/kernel/api/MetaPromptNormalizer.ts`

**Fichiers à modifier:**
- `extension/extension.ts` (normaliser prompt utilisateur avant envoi au LLM)

**Durée:** 2h

**Tests de validation:**
- [ ] "implement OAuth2" → intent: `task_execution`
- [ ] "explore ideas for performance" → intent: `exploration`
- [ ] "fix bug in UserService.ts" → intent: `debug`, entities.files: `['UserService.ts']`

---

**TOTAL Phase 6:** 2h (P2)

---

## Phase 7: Testing & Validation (P1)

### **Tâche 7.1: Unit Tests for Critical Components**

**Tests à créer:**
```typescript
// test/BiasSystem.test.ts
describe('BiasSystem', () => {
  it('should reject action if impact > maxPerAction', () => {
    const biasSystem = new BiasSystem();
    const result = biasSystem.validateAction('create_file', 15, 'flexible');
    expect(result.allowed).toBe(false);
  });
  
  it('should reject action if cumulative > maxCumulative', () => {
    const biasSystem = new BiasSystem();
    biasSystem.recordImpact('create_file', 10, 'flexible');
    biasSystem.recordImpact('modify_file', 10, 'flexible');
    biasSystem.recordImpact('add_lines', 6, 'flexible');
    
    const result = biasSystem.validateAction('create_file', 5, 'flexible');
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain('Cumulative bias');
  });
});

// test/RL4Invariants.test.ts
describe('RL4Invariants', () => {
  it('should detect empty phase and auto-correct', () => {
    const invariants = new RL4Invariants(rl4Path);
    const plan = { phase: '', goal: 'Test', timeline: {}, successCriteria: [], constraints: [] };
    
    expect(() => invariants.validatePlanPhase(plan)).toThrow('INVARIANT_1');
    
    const corrected = invariants.correctPlanPhase(plan);
    expect(corrected.phase).toBe('Initial Setup');
  });
  
  it('should detect task cycle', () => {
    const invariants = new RL4Invariants(rl4Path);
    const tasks = {
      active: [
        { task: '[P0] Task A @rl4:id=a @rl4:deps=[b]', completed: false },
        { task: '[P0] Task B @rl4:id=b @rl4:deps=[a]', completed: false }
      ],
      blockers: [],
      completed: []
    };
    
    expect(() => invariants.validateTasksDAG(tasks)).toThrow('INVARIANT_2');
  });
});

// test/PolicyCollapseDetector.test.ts
describe('PolicyCollapseDetector', () => {
  it('should detect forbidden keyword in STRICT mode', () => {
    const detector = new PolicyCollapseDetector();
    const result = detector.detectCollapse('Let me implement a new feature', 'strict');
    expect(result.collapsed).toBe(false); // First violation
    
    // Second violation
    detector.detectCollapse('I will add a refactor', 'strict');
    expect(detector.detectCollapse('Another new feature', 'strict').collapsed).toBe(true);
  });
});
```

**Durée:** 4h

---

### **Tâche 7.2: Integration Tests**

**Tests à créer:**
```typescript
// test/integration/FirstUseBootstrap.test.ts
describe('First Use Bootstrap (Integration)', () => {
  it('should bootstrap workspace correctly', async () => {
    const engine = new FirstBootstrapEngine(testWorkspaceRoot);
    const result = await engine.bootstrap();
    
    expect(result.success).toBe(true);
    expect(fs.existsSync(path.join(testWorkspaceRoot, '.reasoning_rl4', 'project_metadata.json'))).toBe(true);
    expect(fs.existsSync(path.join(testWorkspaceRoot, '.reasoning_rl4', 'ground_truth', 'Plan.yaml'))).toBe(true);
    
    // Check Context.RL4 has first_use_lock
    const context = planTasksContextParser.parseContext();
    expect(context.first_use_lock).toBe(true);
    expect(context.ground_truth_established).toBe(true);
  });
});

// test/integration/CognitiveCycle.test.ts
describe('Cognitive Cycle (Integration)', () => {
  it('should complete full cycle without errors', async () => {
    const scheduler = new CognitiveScheduler(testWorkspaceRoot, timerRegistry, logger);
    const result = await scheduler.runCycle('timer');
    
    expect(result.success).toBe(true);
    expect(result.phases.length).toBe(4); // Pattern, Correlation, Forecast, ADR
    
    // Check KPIs written to Context.RL4
    const context = planTasksContextParser.parseContext();
    expect(context.kpis_kernel).toBeDefined();
    expect(context.kpis_kernel!.length).toBeGreaterThan(0);
  });
});
```

**Durée:** 4h

---

**TOTAL Phase 7:** 8h (P1)

---

## Checklist de Validation Finale

### **Avant merge dans main**

- [ ] **Phase 0 (Corrections Critiques) complète**
  - [ ] FirstBootstrapEngine écrit `project_metadata.json` AVANT LLM
  - [ ] Ground Truth = snapshot YAML (pas de fichier séparé)
  - [ ] BiasSystem avec rolling window + slope
  - [ ] PolicyCollapseDetector intégré
  - [ ] BoundedContextExtractor limite tokens par mode
  - [ ] FreeModeThrottleValidator limite mutations

- [ ] **Phase 1 (Fondations) complète**
  - [ ] SystemMetricsCollector collecte memory, CPU, cycles
  - [ ] RL4ContextIdentityManager crée `context_identity.json`
  - [ ] Mode Pedagogy ajouté à tous les prompts

- [ ] **Phase 2 (Mode Enhancement) complète**
  - [ ] Mode STRICT alerte si 0 tâches P0
  - [ ] Mode EXPLORATORY génère tokens XML
  - [ ] WebView Dev tab affiche task ideas avec Accept/Deny

- [ ] **Phase 3 (Invariants) complète**
  - [ ] RL4Invariants 1-10 implémentés
  - [ ] Auto-correction pour chaque invariant
  - [ ] Rollback system créé et testé

- [ ] **Phase 4 (Guardrails) complète**
  - [ ] SchemaValidator valide RL4_PROPOSAL
  - [ ] SchemaValidator valide KPIRecordLLM
  - [ ] Détection de hallucinations ("Lorem ipsum", etc.)

- [ ] **Phase 5 (Engines Enrichment) complète**
  - [ ] LLMObservationsCollector créé
  - [ ] PatternLearningEngine merge observations LLM
  - [ ] Instructions LLM pour émettre observations

- [ ] **Phase 6 (System Metrics) complète**
  - [ ] MetaPromptNormalizer normalise prompts utilisateur

- [ ] **Phase 7 (Testing) complète**
  - [ ] Unit tests pour BiasSystem, RL4Invariants, PolicyCollapseDetector
  - [ ] Integration tests pour FirstBootstrapEngine, CognitiveScheduler
  - [ ] Tous les tests passent

### **Performance Validation**

- [ ] Cycle cognitif < 5s (mode STRICT)
- [ ] Cycle cognitif < 10s (mode FLEXIBLE)
- [ ] Cycle cognitif < 20s (mode EXPLORATORY)
- [ ] Memory delta < 50MB après 10 cycles
- [ ] Ledger size < 10MB après 100 cycles

### **User Experience Validation**

- [ ] Mode STRICT bloque correctement les déviations
- [ ] Mode FLEXIBLE accepte petites améliorations (< 10% bias)
- [ ] Mode EXPLORATORY génère 5-10 task ideas
- [ ] Mode FREE accepte tout (mais throttle si > 200 mutations)
- [ ] firstUse établit ground truth correctement
- [ ] Commit mode génère messages riches

---

## Résumé des Efforts

| Phase | Durée | Priorité | Status |
|---|---|---|---|
| Phase 0: Corrections Critiques | 18h | P0 | BLOCAGE TOTAL |
| Phase 1: Fondations | 7h | P0 | - |
| Phase 2: Mode Enhancement | 5h | P1 | - |
| Phase 3: Invariants & Validation | 6h | P1 | - |
| Phase 4: Guardrails | 3h | P2 | - |
| Phase 5: Engines Enrichment | 5h | P2 | - |
| Phase 6: System Metrics | 2h | P2 | - |
| Phase 7: Testing & Validation | 8h | P1 | - |
| **TOTAL** | **54h** | **7-9 jours** | - |

---

## Stratégie de Rollout

### **Semaine 1 (P0)**
- Jour 1-3: Phase 0 (Corrections Critiques) — BLOCAGE TOTAL
- Jour 4-5: Phase 1 (Fondations)

### **Semaine 2 (P1)**
- Jour 1-2: Phase 2 (Mode Enhancement)
- Jour 3-4: Phase 3 (Invariants)
- Jour 5: Phase 7 (Testing Unit)

### **Semaine 3 (P2 + Validation)**
- Jour 1-2: Phase 4 (Guardrails)
- Jour 3-4: Phase 5 (Engines Enrichment)
- Jour 5: Phase 6 (System Metrics) + Phase 7 (Testing Integration)

---

## 🔴 **Phase 8: Kernel Self-Modeling (P0 — ZONE ROUGE #1)**

**⚠️ CRITIQUE — Sans ça, le système dérive cognitivement**

### **Pourquoi cette phase est CRITIQUE**

Le kernel ne possède **aucune représentation formelle de lui-même**, alors que le LLM enrichit les engines selon sa perception du kernel.

**Conséquences :**
- ❌ Le LLM fait évoluer les engines **sans modèle interne stable** → dérive lente
- ❌ Impossible de détecter une hallucination du LLM sur le fonctionnement interne
- ❌ Le `PatternLearningEngine` peut apprendre un "pattern incorrect" du kernel
- ❌ Un prompt ambigu du user peut modifier un moteur que le kernel n'a pas prévu de laisser modifier

**Sans modèle interne du kernel, tu ne peux pas garantir la stabilité cognitive.**

---

### **Tâche 8.1: Créer kernel_manifest.json (AUTORITÉ)**

**Objectif :** Le kernel doit se décrire lui-même pour que le LLM sache exactement ce qu'il peut/ne peut pas modifier.

**Implémentation :**

```typescript
// .reasoning_rl4/kernel_manifest.json
{
  "kernel_version": "3.5.11",
  "kernel_identity": "rl4_cognitive_kernel",
  "kernel_type": "evolutionist", // vs "static"
  "last_updated": "2025-11-18T00:00:00.000Z",
  
  "engines": {
    "PatternLearningEngine": {
      "modifiable_by_llm": true,
      "input_sources": ["llm_observations", "file_changes", "terminal_events"],
      "output_format": "patterns.json",
      "validation_schema": "PatternSchema",
      "immutable_fields": ["id", "firstSeen", "occurrences"],
      "mutable_fields": ["description", "confidence", "impact", "category"],
      "max_mutations_per_cycle": 10,
      "description": "Learns patterns from workspace activity and LLM observations"
    },
    "CorrelationEngine": {
      "modifiable_by_llm": false,
      "input_sources": ["patterns.json", "file_changes"],
      "output_format": "correlations.json",
      "validation_schema": "CorrelationSchema",
      "immutable_fields": ["id", "timestamp"],
      "description": "Correlates patterns to detect causal relationships"
    },
    "ForecastEngine": {
      "modifiable_by_llm": false,
      "input_sources": ["patterns.json", "correlations.json", "market_signals.json"],
      "output_format": "forecasts.json",
      "validation_schema": "ForecastSchema",
      "immutable_fields": ["id", "timestamp", "patternIds"],
      "description": "Generates predictions based on patterns and correlations"
    },
    "ADRGenerator": {
      "modifiable_by_llm": true,
      "input_sources": ["forecasts.json", "ADRs.RL4", "llm_observations"],
      "output_format": "adrs/auto/*.json",
      "validation_schema": "ADRSchema",
      "immutable_fields": ["id", "timestamp", "author"],
      "mutable_fields": ["status", "context", "decision", "consequences"],
      "max_mutations_per_cycle": 3,
      "description": "Proposes architectural decision records"
    }
  },
  
  "kernel_api_surface": {
    "llm_allowed": [
      "PatternLearningEngine.observations",
      "Context.RL4.kpis_llm",
      "Context.RL4.observations",
      "Context.RL4.activeFiles",
      "ADRGenerator.proposed_adrs",
      "Plan.RL4.goal",
      "Plan.RL4.successCriteria",
      "Tasks.RL4.active",
      "Tasks.RL4.blockers"
    ],
    "llm_forbidden": [
      "Context.RL4.kpis_kernel",
      "Context.RL4.first_use_lock",
      "Context.RL4.ground_truth_established",
      "patterns.json",
      "correlations.json",
      "forecasts.json",
      "cycles.jsonl",
      "ground_truth/",
      "kernel_manifest.json"
    ]
  },
  
  "invariants": [
    {
      "id": "INVARIANT_1",
      "rule": "Plan.RL4 must always have an active phase",
      "enforced_by": "RL4Invariants.validatePlanPhase",
      "auto_correction": "Set phase to 'Initial Setup' if empty"
    },
    {
      "id": "INVARIANT_2",
      "rule": "Tasks.RL4 must not contain cycles (DAG)",
      "enforced_by": "RL4Invariants.validateTasksDAG",
      "auto_correction": "Remove @rl4:deps annotations if cycle detected"
    },
    {
      "id": "INVARIANT_3",
      "rule": "Context.RL4 must always contain a valid mode",
      "enforced_by": "RL4Invariants.validateContextMode",
      "auto_correction": "Set mode to 'flexible' if invalid"
    },
    {
      "id": "INVARIANT_4",
      "rule": "ADRs.RL4 must be chronologically ordered",
      "enforced_by": "RL4Invariants.validateADRsChronology",
      "auto_correction": "Sort ADRs by timestamp"
    },
    {
      "id": "INVARIANT_5",
      "rule": "Ground Truth is immutable",
      "enforced_by": "RL4Invariants.validateGroundTruthImmutability",
      "auto_correction": "None (throws error)"
    },
    {
      "id": "INVARIANT_6",
      "rule": "Snapshot must be atomic (all 3 core files parseable)",
      "enforced_by": "RL4Invariants.validateSnapshotAtomicity",
      "auto_correction": "Rollback to last known good state"
    },
    {
      "id": "INVARIANT_7",
      "rule": "KPIs LLM and Kernel must not overlap",
      "enforced_by": "RL4Invariants.validateKPISeparation",
      "auto_correction": "None (warning only)"
    },
    {
      "id": "INVARIANT_8",
      "rule": "WriteTracker must mark all internal writes",
      "enforced_by": "PlanTasksContextParser (integrated)",
      "auto_correction": "None (enforced at write time)"
    },
    {
      "id": "INVARIANT_9",
      "rule": "Ledger Merkle chain must not be broken",
      "enforced_by": "RBOMLedger.verify",
      "auto_correction": "Trigger Cold Path Recovery"
    },
    {
      "id": "INVARIANT_10",
      "rule": "Mode transitions must be traced",
      "enforced_by": "RL4Invariants.validateModeTransition",
      "auto_correction": "Add transition to Context.RL4.observations"
    }
  ],
  
  "cognitive_boundaries": {
    "max_patterns": 1000,
    "max_correlations": 500,
    "max_forecasts": 200,
    "max_adrs": 100,
    "archive_after_days": 30
  },
  
  "kernel_health": {
    "last_cycle": 0,
    "drift_trend": "stable",
    "cognitive_debt_score": 0,
    "last_validation": null
  }
}
```

**Fichiers à créer :**
- `extension/kernel/KernelManifestManager.ts`

**Implémentation complète :**

```typescript
import * as fs from 'fs';
import * as path from 'path';

interface KernelManifest {
  kernel_version: string;
  kernel_identity: string;
  kernel_type: 'evolutionist' | 'static';
  last_updated: string;
  engines: Record<string, EngineDescriptor>;
  kernel_api_surface: {
    llm_allowed: string[];
    llm_forbidden: string[];
  };
  invariants: InvariantDescriptor[];
  cognitive_boundaries: CognitiveBoundaries;
  kernel_health: KernelHealth;
}

interface EngineDescriptor {
  modifiable_by_llm: boolean;
  input_sources: string[];
  output_format: string;
  validation_schema: string;
  immutable_fields: string[];
  mutable_fields?: string[];
  max_mutations_per_cycle?: number;
  description: string;
}

interface InvariantDescriptor {
  id: string;
  rule: string;
  enforced_by: string;
  auto_correction: string;
}

interface CognitiveBoundaries {
  max_patterns: number;
  max_correlations: number;
  max_forecasts: number;
  max_adrs: number;
  archive_after_days: number;
}

interface KernelHealth {
  last_cycle: number;
  drift_trend: 'stable' | 'increasing' | 'critical';
  cognitive_debt_score: number;
  last_validation: string | null;
}

export class KernelManifestManager {
  private manifestPath: string;
  private manifest: KernelManifest | null = null;
  
  constructor(rl4Path: string) {
    this.manifestPath = path.join(rl4Path, 'kernel_manifest.json');
  }
  
  /**
   * Ensure kernel manifest exists (create if not)
   */
  ensureManifest(): KernelManifest {
    if (fs.existsSync(this.manifestPath)) {
      this.manifest = JSON.parse(fs.readFileSync(this.manifestPath, 'utf-8'));
      return this.manifest!;
    }
    
    // Create default manifest
    const defaultManifest: KernelManifest = {
      kernel_version: '3.5.11',
      kernel_identity: 'rl4_cognitive_kernel',
      kernel_type: 'evolutionist',
      last_updated: new Date().toISOString(),
      engines: {
        PatternLearningEngine: {
          modifiable_by_llm: true,
          input_sources: ['llm_observations', 'file_changes', 'terminal_events'],
          output_format: 'patterns.json',
          validation_schema: 'PatternSchema',
          immutable_fields: ['id', 'firstSeen', 'occurrences'],
          mutable_fields: ['description', 'confidence', 'impact', 'category'],
          max_mutations_per_cycle: 10,
          description: 'Learns patterns from workspace activity and LLM observations'
        },
        CorrelationEngine: {
          modifiable_by_llm: false,
          input_sources: ['patterns.json', 'file_changes'],
          output_format: 'correlations.json',
          validation_schema: 'CorrelationSchema',
          immutable_fields: ['id', 'timestamp'],
          description: 'Correlates patterns to detect causal relationships'
        },
        ForecastEngine: {
          modifiable_by_llm: false,
          input_sources: ['patterns.json', 'correlations.json', 'market_signals.json'],
          output_format: 'forecasts.json',
          validation_schema: 'ForecastSchema',
          immutable_fields: ['id', 'timestamp', 'patternIds'],
          description: 'Generates predictions based on patterns and correlations'
        },
        ADRGenerator: {
          modifiable_by_llm: true,
          input_sources: ['forecasts.json', 'ADRs.RL4', 'llm_observations'],
          output_format: 'adrs/auto/*.json',
          validation_schema: 'ADRSchema',
          immutable_fields: ['id', 'timestamp', 'author'],
          mutable_fields: ['status', 'context', 'decision', 'consequences'],
          max_mutations_per_cycle: 3,
          description: 'Proposes architectural decision records'
        }
      },
      kernel_api_surface: {
        llm_allowed: [
          'PatternLearningEngine.observations',
          'Context.RL4.kpis_llm',
          'Context.RL4.observations',
          'Context.RL4.activeFiles',
          'ADRGenerator.proposed_adrs',
          'Plan.RL4.goal',
          'Plan.RL4.successCriteria',
          'Tasks.RL4.active',
          'Tasks.RL4.blockers'
        ],
        llm_forbidden: [
          'Context.RL4.kpis_kernel',
          'Context.RL4.first_use_lock',
          'Context.RL4.ground_truth_established',
          'patterns.json',
          'correlations.json',
          'forecasts.json',
          'cycles.jsonl',
          'ground_truth/',
          'kernel_manifest.json'
        ]
      },
      invariants: [
        {
          id: 'INVARIANT_1',
          rule: 'Plan.RL4 must always have an active phase',
          enforced_by: 'RL4Invariants.validatePlanPhase',
          auto_correction: "Set phase to 'Initial Setup' if empty"
        },
        {
          id: 'INVARIANT_2',
          rule: 'Tasks.RL4 must not contain cycles (DAG)',
          enforced_by: 'RL4Invariants.validateTasksDAG',
          auto_correction: 'Remove @rl4:deps annotations if cycle detected'
        },
        {
          id: 'INVARIANT_3',
          rule: 'Context.RL4 must always contain a valid mode',
          enforced_by: 'RL4Invariants.validateContextMode',
          auto_correction: "Set mode to 'flexible' if invalid"
        },
        {
          id: 'INVARIANT_4',
          rule: 'ADRs.RL4 must be chronologically ordered',
          enforced_by: 'RL4Invariants.validateADRsChronology',
          auto_correction: 'Sort ADRs by timestamp'
        },
        {
          id: 'INVARIANT_5',
          rule: 'Ground Truth is immutable',
          enforced_by: 'RL4Invariants.validateGroundTruthImmutability',
          auto_correction: 'None (throws error)'
        },
        {
          id: 'INVARIANT_6',
          rule: 'Snapshot must be atomic (all 3 core files parseable)',
          enforced_by: 'RL4Invariants.validateSnapshotAtomicity',
          auto_correction: 'Rollback to last known good state'
        },
        {
          id: 'INVARIANT_7',
          rule: 'KPIs LLM and Kernel must not overlap',
          enforced_by: 'RL4Invariants.validateKPISeparation',
          auto_correction: 'None (warning only)'
        },
        {
          id: 'INVARIANT_8',
          rule: 'WriteTracker must mark all internal writes',
          enforced_by: 'PlanTasksContextParser (integrated)',
          auto_correction: 'None (enforced at write time)'
        },
        {
          id: 'INVARIANT_9',
          rule: 'Ledger Merkle chain must not be broken',
          enforced_by: 'RBOMLedger.verify',
          auto_correction: 'Trigger Cold Path Recovery'
        },
        {
          id: 'INVARIANT_10',
          rule: 'Mode transitions must be traced',
          enforced_by: 'RL4Invariants.validateModeTransition',
          auto_correction: 'Add transition to Context.RL4.observations'
        }
      ],
      cognitive_boundaries: {
        max_patterns: 1000,
        max_correlations: 500,
        max_forecasts: 200,
        max_adrs: 100,
        archive_after_days: 30
      },
      kernel_health: {
        last_cycle: 0,
        drift_trend: 'stable',
        cognitive_debt_score: 0,
        last_validation: null
      }
    };
    
    fs.writeFileSync(this.manifestPath, JSON.stringify(defaultManifest, null, 2));
    this.manifest = defaultManifest;
    
    console.log('✅ Kernel manifest created:', this.manifestPath);
    
    return defaultManifest;
  }
  
  /**
   * Validate if LLM is allowed to modify a field
   */
  isLLMAllowed(field: string): boolean {
    if (!this.manifest) {
      this.ensureManifest();
    }
    
    return this.manifest!.kernel_api_surface.llm_allowed.includes(field);
  }
  
  /**
   * Validate if LLM is forbidden to modify a field
   */
  isLLMForbidden(field: string): boolean {
    if (!this.manifest) {
      this.ensureManifest();
    }
    
    // Check exact match
    if (this.manifest!.kernel_api_surface.llm_forbidden.includes(field)) {
      return true;
    }
    
    // Check prefix match (e.g., "ground_truth/" matches "ground_truth/Plan.yaml")
    for (const forbidden of this.manifest!.kernel_api_surface.llm_forbidden) {
      if (field.startsWith(forbidden)) {
        return true;
      }
    }
    
    return false;
  }
  
  /**
   * Get engine descriptor
   */
  getEngineDescriptor(engineName: string): EngineDescriptor | null {
    if (!this.manifest) {
      this.ensureManifest();
    }
    
    return this.manifest!.engines[engineName] || null;
  }
  
  /**
   * Update kernel health metrics
   */
  updateKernelHealth(health: Partial<KernelHealth>): void {
    if (!this.manifest) {
      this.ensureManifest();
    }
    
    this.manifest!.kernel_health = {
      ...this.manifest!.kernel_health,
      ...health,
      last_validation: new Date().toISOString()
    };
    
    this.manifest!.last_updated = new Date().toISOString();
    
    fs.writeFileSync(this.manifestPath, JSON.stringify(this.manifest, null, 2));
  }
  
  /**
   * Get full manifest
   */
  getManifest(): KernelManifest {
    if (!this.manifest) {
      this.ensureManifest();
    }
    
    return this.manifest!;
  }
}
```

**Fichiers à modifier :**
- `extension/kernel/KernelBootstrap.ts` (appeler `KernelManifestManager.ensureManifest()` au bootstrap)
- `extension/kernel/api/UnifiedPromptBuilder.ts` (inclure kernel_manifest.json dans le snapshot)

**Durée :** 6h

**Tests de validation :**
- [ ] `kernel_manifest.json` créé après premier lancement
- [ ] `isLLMAllowed()` retourne `true` pour `Context.RL4.kpis_llm`
- [ ] `isLLMForbidden()` retourne `true` pour `Context.RL4.kpis_kernel`
- [ ] `getEngineDescriptor('PatternLearningEngine')` retourne descriptor complet

---

**TOTAL Phase 8:** 6h (P0 — ZONE ROUGE #1)

---

## 🔴 **Phase 9: Drift Timeline (P0 — ZONE ROUGE #2)**

**⚠️ CRITIQUE — Sans ça, le système dérive lentement sans détection**

### **Pourquoi cette phase est CRITIQUE**

Tu as un calcul de drift, des thresholds, un bias system…

Mais **tu n'as pas de mécanique temporelle de détection de dérive progressive**.

Or comme :
- 👉 Le LLM enrichit à chaque prompt
- 👉 Les engines évoluent à chaque cycle
- 👉 Le kernel se réécrit partiellement

… alors **la dérive lente est la plus dangereuse**, car :
- ❌ Elle passe sous les radars du bias system
- ❌ Elle contamine les patterns
- ❌ Elle contamine les ADRs
- ❌ Elle contamine le forecasting
- ❌ **Elle est exponentielle car cumulative**

**Il te manque un drift timeline avec velocity et acceleration.**

---

### **Tâche 9.1: Créer DriftTimelineTracker**

**Objectif :** Tracker le drift avec sa dérivée première (velocity) et seconde (acceleration) pour détecter les dérives lentes.

**Implémentation :**

```typescript
// .reasoning_rl4/drift_timeline.jsonl

interface DriftTimelineEntry {
  timestamp: string;
  cycle: number;
  drift: number; // 0-100%
  drift_velocity: number; // Dérivée première (drift/cycle)
  drift_acceleration: number; // Dérivée seconde
  mode: string;
  modifications: {
    files_created: number;
    files_modified: number;
    lines_added: number;
    bias_impact: number;
  };
  llm_observations_count: number;
  pattern_mutations: number;
  correlation_mutations: number;
  forecast_mutations: number;
}

export class DriftTimelineTracker {
  private rl4Path: string;
  private timelinePath: string;
  private history: DriftTimelineEntry[] = [];
  
  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
    this.timelinePath = path.join(rl4Path, 'drift_timeline.jsonl');
    
    // Load existing history
    this.loadHistory();
  }
  
  private loadHistory(): void {
    if (!fs.existsSync(this.timelinePath)) {
      return;
    }
    
    const lines = fs.readFileSync(this.timelinePath, 'utf-8').split('\n').filter(l => l.trim());
    this.history = lines.map(line => JSON.parse(line));
  }
  
  /**
   * Record drift entry (called after each cycle)
   */
  recordDrift(entry: Omit<DriftTimelineEntry, 'drift_velocity' | 'drift_acceleration'>): void {
    const fullEntry: DriftTimelineEntry = {
      ...entry,
      drift_velocity: 0,
      drift_acceleration: 0
    };
    
    // Calculate velocity (if at least 2 entries)
    if (this.history.length >= 1) {
      const prev = this.history[this.history.length - 1];
      fullEntry.drift_velocity = fullEntry.drift - prev.drift;
    }
    
    // Calculate acceleration (if at least 3 entries)
    if (this.history.length >= 2) {
      const prev = this.history[this.history.length - 1];
      const prevPrev = this.history[this.history.length - 2];
      const prevVelocity = prev.drift - prevPrev.drift;
      fullEntry.drift_acceleration = fullEntry.drift_velocity - prevVelocity;
    }
    
    this.history.push(fullEntry);
    
    // Append to JSONL
    fs.appendFileSync(this.timelinePath, JSON.stringify(fullEntry) + '\n');
    
    // CRITICAL RULE: If drift velocity > 5% for 3 consecutive cycles → LOCK
    const recentVelocities = this.history.slice(-3).map(e => e.drift_velocity);
    if (recentVelocities.length === 3 && recentVelocities.every(v => v > 5)) {
      throw new Error(`DRIFT VELOCITY CRITICAL: ${recentVelocities.join(', ')}% — Automatic lock + rollback required`);
    }
    
    // CRITICAL RULE: If drift acceleration > 2% → WARNING
    if (fullEntry.drift_acceleration > 2) {
      console.warn(`⚠️ DRIFT ACCELERATION WARNING: ${fullEntry.drift_acceleration}%/cycle²`);
    }
    
    // Keep only last 1000 entries in memory
    if (this.history.length > 1000) {
      this.history.shift();
    }
  }
  
  /**
   * Get drift report (for WebView or snapshot)
   */
  getDriftReport(): { velocity: number; acceleration: number; trend: 'stable' | 'increasing' | 'critical' } {
    if (this.history.length < 3) return { velocity: 0, acceleration: 0, trend: 'stable' };
    
    const recent = this.history.slice(-3);
    const avgVelocity = recent.reduce((sum, e) => sum + e.drift_velocity, 0) / 3;
    const avgAcceleration = recent.reduce((sum, e) => sum + e.drift_acceleration, 0) / 3;
    
    let trend: 'stable' | 'increasing' | 'critical' = 'stable';
    if (avgVelocity > 5) trend = 'critical';
    else if (avgVelocity > 2) trend = 'increasing';
    
    return { velocity: avgVelocity, acceleration: avgAcceleration, trend };
  }
  
  /**
   * Get last N drift entries
   */
  getRecentDrift(count: number = 10): DriftTimelineEntry[] {
    return this.history.slice(-count);
  }
  
  /**
   * Reset timeline (for testing or after rollback)
   */
  reset(): void {
    this.history = [];
    if (fs.existsSync(this.timelinePath)) {
      fs.unlinkSync(this.timelinePath);
    }
  }
}
```

**Fichiers à créer :**
- `extension/kernel/DriftTimelineTracker.ts`

**Fichiers à modifier :**
- `extension/kernel/CognitiveScheduler.ts` (appeler `DriftTimelineTracker.recordDrift()` après chaque cycle)
- `extension/kernel/api/UnifiedPromptBuilder.ts` (inclure drift report dans snapshot)

**Durée :** 4h

**Tests de validation :**
- [ ] `drift_timeline.jsonl` créé après cycle 1
- [ ] Velocity calculée correctement (vérifier avec 2 cycles consécutifs)
- [ ] Acceleration calculée correctement (vérifier avec 3 cycles consécutifs)
- [ ] `getDriftReport()` retourne `trend: 'critical'` si velocity > 5%
- [ ] Lève exception si velocity > 5% pendant 3 cycles consécutifs

---

**TOTAL Phase 9:** 4h (P0 — ZONE ROUGE #2)

---

## 🔴 **Phase 10: Cross-Validation Kernel ↔ LLM (P0 — ZONE ROUGE #3)**

**⚠️ CRITIQUE — Sans ça, le système accepte des patterns erronés qui se propagent**

### **Pourquoi cette phase est CRITIQUE**

Le LLM enrichit les engines.  
Le kernel enrichit le LLM via le snapshot.

Mais **tu n'as aucune validation croisée**.

Ce qui signifie :
- ❌ Le LLM peut émettre un pattern incohérent → accepté aveuglément
- ❌ Un engine peut produire un output invalide → le LLM le réinterprète comme valide
- ❌ Le `ForecastEngine` peut halluciner → repris dans le snapshot → **feed-forward loop**

**Tu as créé un système symbiotique, mais unidirectionnel. Il manque la contre-pression.**

---

### **Tâche 10.1: Créer LLMKernelCrossValidator**

**Objectif :** Valider les observations LLM avant de les accepter dans les engines, et valider les forecasts kernel avant de les inclure dans le snapshot.

**Implémentation :**

(Le code TypeScript complet pour `LLMKernelCrossValidator` a déjà été inclus dans la section "Zones Rouges" du document)

**Fichiers à créer :**
- `extension/kernel/LLMKernelCrossValidator.ts`

**Fichiers à modifier :**
- `extension/kernel/cognitive/PatternLearningEngine.ts` (valider observations LLM avant merge)
- `extension/kernel/api/UnifiedPromptBuilder.ts` (valider forecasts avant inclusion dans snapshot)

**Durée :** 5h

**Tests de validation :**
- [ ] Observation LLM avec `description: "Lorem ipsum"` → rejetée (hallucination risk)
- [ ] Observation LLM avec `confidence: 0.95` et `related_files: []` → warning
- [ ] Forecast sans patterns grounding → rejeté
- [ ] `calculateNovelty()` retourne score correct (tester avec patterns similaires)

---

**TOTAL Phase 10:** 5h (P0 — ZONE ROUGE #3)

---

## 🔴 **Phase 11: Cold Path Recovery (P0 — ZONE ROUGE #4)**

**⚠️ CRITIQUE — Sans ça, impossible de récupérer d'une corruption profonde**

### **Pourquoi cette phase est CRITIQUE**

Tu as un rollback fichier par fichier.

Tu n'as **pas** :
- ❌ Pas de reconstruction complète du kernel depuis le ledger
- ❌ Pas de mécanisme pour détecter corruption profonde
- ❌ Pas de moyen de reconstruire un état sans faire confiance aux 5 derniers fichiers
- ❌ Pas de "safe minimal state reconstruction"

**Avec un LLM qui enrichit constamment ton système, tu dois prévoir la possibilité que tout l'état cognitif soit compromis.**

---

### **Tâche 11.1: Créer ColdPathRecoverySystem**

**Objectif :** Reconstruire l'intégralité du kernel depuis le ledger (cycles.jsonl) en cas de corruption profonde.

**Implémentation :**

(Le code TypeScript complet pour `ColdPathRecoverySystem` a déjà été inclus dans la section "Zones Rouges" du document)

**Fichiers à créer :**
- `extension/kernel/ColdPathRecoverySystem.ts`

**Fichiers à modifier :**
- `extension/kernel/KernelBootstrap.ts` (ajouter commande de recovery)
- `extension/extension.ts` (enregistrer commande `reasoning.kernel.coldPathRecovery`)

**Durée :** 6h

**Tests de validation :**
- [ ] `rebuildFromLedger()` reconstruit `patterns.json` depuis cycles
- [ ] `rebuildFromLedger()` restaure `Plan.RL4` depuis ground truth
- [ ] `rebuildFromLedger()` détecte Merkle chain brisée
- [ ] Context.RL4 reset en mode STRICT après recovery
- [ ] Invariants validés après recovery

---

**TOTAL Phase 11:** 6h (P0 — ZONE ROUGE #4)

**⚠️ CRITIQUE FINALE — SANS COMPLAISANCE**

Même avec ce plan complet de 54h, **il reste 4 zones rouges structurelles** qui empêchent RL4 d'être réellement **Production Ready**.

**Pourquoi c'est CRITIQUE ?**

👉 **Le LLM enrichit les engines ET le kernel à chaque prompt.**

Donc :
- ❌ **Une faille = amplification à chaque cycle**
- ❌ **Un bug = pattern erroné appris et réinjecté**
- ❌ **Un oubli = raisonnement biaisé**
- ❌ **Un mauvais paramètre = drift cumulatif impossible à rattraper**

---

### **🔴 ZONE ROUGE #1 — Pas de "Kernel Self-Modeling"**

**Problème :**

Le kernel ne possède **aucune représentation formelle de lui-même**, alors que le LLM enrichit les engines selon sa perception du kernel.

**Conséquences :**
- Le LLM fait évoluer les engines **sans modèle interne stable** → dérive lente
- Impossible de détecter une hallucination du LLM sur le fonctionnement interne
- Le `PatternLearningEngine` peut apprendre un "pattern incorrect" du kernel
- Un prompt ambigu du user peut modifier un moteur que le kernel n'a pas prévu de laisser modifier

**Critique :**

Sans modèle interne du kernel, **tu ne peux pas garantir la stabilité cognitive**.

Tu crées une architecture où le LLM influence les engines, mais **les engines ne savent pas qui ils sont**.

**À ajouter absolument :**

```typescript
// .reasoning_rl4/kernel_manifest.json (AUTHORITÉ)
{
  "kernel_version": "3.5.11",
  "kernel_identity": "rl4_cognitive_kernel",
  "engines": {
    "PatternLearningEngine": {
      "modifiable_by_llm": true,
      "input_sources": ["llm_observations", "file_changes", "terminal_events"],
      "output_format": "patterns.json",
      "validation_schema": "PatternSchema",
      "immutable_fields": ["id", "firstSeen"]
    },
    "CorrelationEngine": {
      "modifiable_by_llm": false,
      "input_sources": ["patterns.json", "file_changes"],
      "output_format": "correlations.json"
    },
    "ForecastEngine": {
      "modifiable_by_llm": false,
      "input_sources": ["patterns.json", "correlations.json", "market_signals.json"],
      "output_format": "forecasts.json"
    },
    "ADRGenerator": {
      "modifiable_by_llm": true,
      "input_sources": ["forecasts.json", "ADRs.RL4"],
      "output_format": "adrs/auto/*.json"
    }
  },
  "kernel_api_surface": {
    "llm_allowed": ["PatternLearningEngine.observations", "Context.RL4.kpis_llm", "Context.RL4.observations"],
    "llm_forbidden": ["Context.RL4.kpis_kernel", "patterns.json", "correlations.json", "forecasts.json"]
  },
  "invariants": [
    "INVARIANT_1: Plan.RL4 must always have an active phase",
    "INVARIANT_2: Tasks.RL4 must not contain cycles (DAG)",
    "INVARIANT_3: Context.RL4 must always contain a valid mode",
    "INVARIANT_4: ADRs.RL4 must be chronologically ordered",
    "INVARIANT_5: Ground Truth is immutable",
    "INVARIANT_6: Snapshot must be atomic",
    "INVARIANT_7: KPIs LLM and Kernel must not overlap",
    "INVARIANT_8: WriteTracker must mark all internal writes",
    "INVARIANT_9: Ledger Merkle chain must not be broken",
    "INVARIANT_10: Mode transitions must be traced"
  ]
}
```

**Nouvelle Phase à ajouter : Phase 8 (Kernel Self-Modeling) — 6h**

---

### **🔴 ZONE ROUGE #2 — Le système ignore la temporalité du drift**

**Problème :**

Tu as un calcul de drift, des thresholds, un bias system…

Mais **tu n'as pas de mécanique temporelle de détection de dérive progressive**.

Or comme :
- 👉 Le LLM enrichit à chaque prompt
- 👉 Les engines évoluent à chaque cycle
- 👉 Le kernel se réécrit partiellement

… alors **la dérive lente est la plus dangereuse**, car :
- Elle passe sous les radars du bias system
- Elle contamine les patterns
- Elle contamine les ADRs
- Elle contamine le forecasting
- **Elle est exponentielle car cumulative**

**Critique :**

Il te manque un **drift timeline** avec **velocity** et **acceleration**.

**À ajouter absolument :**

```typescript
// .reasoning_rl4/drift_timeline.jsonl

interface DriftTimelineEntry {
  timestamp: string;
  cycle: number;
  drift: number; // 0-100%
  drift_velocity: number; // Dérivée première (drift/cycle)
  drift_acceleration: number; // Dérivée seconde
  mode: string;
  modifications: {
    files_created: number;
    files_modified: number;
    lines_added: number;
    bias_impact: number;
  };
  llm_observations_count: number;
  pattern_mutations: number;
}

class DriftTimelineTracker {
  private history: DriftTimelineEntry[] = [];
  
  recordDrift(entry: DriftTimelineEntry): void {
    this.history.push(entry);
    
    // Calculate velocity (if at least 2 entries)
    if (this.history.length >= 2) {
      const prev = this.history[this.history.length - 2];
      entry.drift_velocity = entry.drift - prev.drift;
    }
    
    // Calculate acceleration (if at least 3 entries)
    if (this.history.length >= 3) {
      const prev = this.history[this.history.length - 2];
      const prevPrev = this.history[this.history.length - 3];
      const prevVelocity = prev.drift - prevPrev.drift;
      entry.drift_acceleration = entry.drift_velocity - prevVelocity;
    }
    
    // CRITICAL RULE: If drift velocity > 5% for 3 consecutive cycles → LOCK
    const recentVelocities = this.history.slice(-3).map(e => e.drift_velocity);
    if (recentVelocities.every(v => v > 5)) {
      throw new Error('DRIFT VELOCITY CRITICAL: Automatic lock + rollback');
    }
    
    // CRITICAL RULE: If drift acceleration > 2% → WARNING
    if (entry.drift_acceleration > 2) {
      console.warn(`⚠️ DRIFT ACCELERATION WARNING: ${entry.drift_acceleration}%/cycle²`);
    }
  }
  
  getDriftReport(): { velocity: number; acceleration: number; trend: 'stable' | 'increasing' | 'critical' } {
    if (this.history.length < 3) return { velocity: 0, acceleration: 0, trend: 'stable' };
    
    const recent = this.history.slice(-3);
    const avgVelocity = recent.reduce((sum, e) => sum + e.drift_velocity, 0) / 3;
    const avgAcceleration = recent.reduce((sum, e) => sum + e.drift_acceleration, 0) / 3;
    
    let trend: 'stable' | 'increasing' | 'critical' = 'stable';
    if (avgVelocity > 5) trend = 'critical';
    else if (avgVelocity > 2) trend = 'increasing';
    
    return { velocity: avgVelocity, acceleration: avgAcceleration, trend };
  }
}
```

**Nouvelle Phase à ajouter : Phase 9 (Drift Timeline) — 4h**

---

### **🔴 ZONE ROUGE #3 — Pas de Validation Mutuelle Kernel ↔ LLM**

**Problème :**

Le LLM enrichit les engines.  
Le kernel enrichit le LLM via le snapshot.

Mais **tu n'as aucune validation croisée**.

Ce qui signifie :
- Le LLM peut émettre un pattern incohérent → accepté aveuglément
- Un engine peut produire un output invalide → le LLM le réinterprète comme valide
- Le `ForecastEngine` peut halluciner → repris dans le snapshot → **feed-forward loop**

**Critique :**

Tu as créé un système symbiotique, mais **unidirectionnel**.

**Il manque la contre-pression.**

**À ajouter absolument :**

```typescript
interface CrossValidationResult {
  valid: boolean;
  confidence: number; // 0.0-1.0
  errors: string[];
  warnings: string[];
}

class LLMKernelCrossValidator {
  /**
   * Validate LLM observation before accepting into PatternLearningEngine
   */
  validateLLMObservation(observation: LLMPatternInput, existingPatterns: Pattern[]): CrossValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Schema validation
    if (!observation.pattern_type || !observation.description || observation.confidence < 0 || observation.confidence > 1) {
      errors.push('Invalid schema');
    }
    
    // 2. Coherence check with existing patterns
    const similarPatterns = existingPatterns.filter(p => 
      this.levenshteinDistance(p.description, observation.description) < 0.3
    );
    
    if (similarPatterns.length > 0) {
      warnings.push(`Similar pattern exists: ${similarPatterns[0].id}`);
    }
    
    // 3. Novelty vs Hallucination score
    const noveltyScore = this.calculateNovelty(observation, existingPatterns);
    const hallucinationScore = this.calculateHallucinationRisk(observation);
    
    if (hallucinationScore > 0.7) {
      errors.push(`High hallucination risk: ${hallucinationScore}`);
    }
    
    // 4. Statistical plausibility
    if (observation.confidence > 0.9 && observation.related_files.length === 0) {
      warnings.push('High confidence but no related files');
    }
    
    const valid = errors.length === 0;
    const confidence = valid ? (1 - hallucinationScore) * noveltyScore : 0;
    
    return { valid, confidence, errors, warnings };
  }
  
  /**
   * Validate Kernel forecast before including in snapshot
   */
  validateKernelForecast(forecast: Forecast, patterns: Pattern[], correlations: Correlation[]): CrossValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    
    // 1. Check if forecast is grounded in patterns
    const groundedPatterns = patterns.filter(p => forecast.patternIds?.includes(p.id));
    if (groundedPatterns.length === 0) {
      errors.push('Forecast not grounded in any pattern');
    }
    
    // 2. Check if forecast contradicts existing ADRs
    // (implementation omitted for brevity)
    
    // 3. Novelty score (is this forecast novel or redundant?)
    // (implementation omitted for brevity)
    
    const valid = errors.length === 0;
    const confidence = forecast.confidence;
    
    return { valid, confidence, errors, warnings };
  }
  
  private calculateNovelty(observation: LLMPatternInput, existingPatterns: Pattern[]): number {
    // Simple novelty calculation: how different is this from existing patterns?
    if (existingPatterns.length === 0) return 1.0;
    
    const similarities = existingPatterns.map(p => 
      1 - this.levenshteinDistance(p.description, observation.description)
    );
    
    const avgSimilarity = similarities.reduce((sum, s) => sum + s, 0) / similarities.length;
    return 1 - avgSimilarity; // High novelty = low similarity
  }
  
  private calculateHallucinationRisk(observation: LLMPatternInput): number {
    let risk = 0;
    
    // Check for hallucination indicators
    if (observation.description.includes('Lorem ipsum')) risk += 0.5;
    if (observation.description.length < 20) risk += 0.3;
    if (observation.confidence > 0.95 && observation.related_files.length === 0) risk += 0.4;
    if (observation.pattern_type === 'unknown') risk += 0.2;
    
    return Math.min(risk, 1.0);
  }
  
  private levenshteinDistance(a: string, b: string): number {
    // Standard Levenshtein distance implementation
    // (implementation omitted for brevity)
    return 0;
  }
}
```

**Nouvelle Phase à ajouter : Phase 10 (Cross-Validation) — 5h**

---

### **🔴 ZONE ROUGE #4 — Pas de "Cold Path Recovery"**

**Problème :**

Tu as un rollback fichier par fichier.

Tu n'as **pas** :
- ❌ Pas de reconstruction complète du kernel depuis le ledger
- ❌ Pas de mécanisme pour détecter corruption profonde
- ❌ Pas de moyen de reconstruire un état sans faire confiance aux 5 derniers fichiers
- ❌ Pas de "safe minimal state reconstruction"

**Critique :**

Avec un LLM qui enrichit constamment ton système, **tu dois prévoir la possibilité que tout l'état cognitif soit compromis**.

**À ajouter absolument :**

```typescript
class ColdPathRecoverySystem {
  private rl4Path: string;
  
  constructor(rl4Path: string) {
    this.rl4Path = rl4Path;
  }
  
  /**
   * Rebuild entire kernel state from ledger (SAFE MODE)
   */
  async rebuildFromLedger(): Promise<{ success: boolean; recovered: string[] }> {
    const recovered: string[] = [];
    
    console.log('🔥 COLD PATH RECOVERY: Rebuilding kernel from ledger...');
    
    // STEP 1: Load ledger (cycles.jsonl)
    const ledger = new RBOMLedger(this.rl4Path);
    const cycles = await ledger.readAllCycles();
    
    if (cycles.length === 0) {
      throw new Error('COLD PATH RECOVERY FAILED: No ledger entries found');
    }
    
    // STEP 2: Find last known good cycle (Merkle chain intact)
    let lastGoodCycle = 0;
    for (let i = 1; i < cycles.length; i++) {
      if (cycles[i].prevMerkleRoot !== cycles[i - 1].merkleRoot) {
        console.warn(`⚠️ Merkle chain broken at cycle ${i}`);
        break;
      }
      lastGoodCycle = i;
    }
    
    console.log(`✅ Last known good cycle: ${lastGoodCycle}`);
    
    // STEP 3: Reconstruct engines from ledger
    await this.reconstructPatterns(cycles.slice(0, lastGoodCycle + 1));
    recovered.push('patterns.json');
    
    await this.reconstructCorrelations(cycles.slice(0, lastGoodCycle + 1));
    recovered.push('correlations.json');
    
    await this.reconstructForecasts(cycles.slice(0, lastGoodCycle + 1));
    recovered.push('forecasts.json');
    
    // STEP 4: Reconstruct minimal Plan.RL4 from ground truth
    const groundTruthPlan = this.loadGroundTruthPlan();
    if (groundTruthPlan) {
      this.planTasksContextParser.savePlan(groundTruthPlan);
      recovered.push('Plan.RL4');
    }
    
    // STEP 5: Reconstruct minimal Tasks.RL4 from ground truth
    const groundTruthTasks = this.loadGroundTruthTasks();
    if (groundTruthTasks) {
      this.planTasksContextParser.saveTasks(groundTruthTasks);
      recovered.push('Tasks.RL4');
    }
    
    // STEP 6: Reconstruct Context.RL4 (reset to safe state)
    const safeContext: ContextData = {
      version: '1.0.0',
      updated: new Date().toISOString(),
      confidence: 0.5,
      kpis_llm: [],
      kpis_kernel: [],
      deviation_mode: 'strict', // Start in STRICT mode after recovery
      activeFiles: [],
      recentActivity: { cycles: lastGoodCycle, commits: 0, duration: '0h' },
      health: { memory: 'Unknown', eventLoop: 'Unknown', uptime: 'Unknown' },
      observations: [`Cold path recovery completed at ${new Date().toISOString()}`]
    };
    
    this.planTasksContextParser.saveContext(safeContext);
    recovered.push('Context.RL4');
    
    // STEP 7: Revalidate all invariants
    const invariants = new RL4Invariants(this.rl4Path);
    const validation = invariants.validateAll();
    
    if (!validation.valid) {
      throw new Error(`COLD PATH RECOVERY FAILED: Invariants violated after rebuild: ${validation.errors.join(', ')}`);
    }
    
    console.log('✅ COLD PATH RECOVERY COMPLETE');
    console.log(`Recovered files: ${recovered.join(', ')}`);
    console.log(`Reconstructed from ${cycles.length} cycles (last good: ${lastGoodCycle})`);
    
    return { success: true, recovered };
  }
  
  private async reconstructPatterns(cycles: CycleSummary[]): Promise<void> {
    // Replay pattern detection from ledger entries
    const patterns: Pattern[] = [];
    
    for (const cycle of cycles) {
      // Extract patterns from cycle phases
      if (cycle.phases.patterns.count > 0) {
        // Load patterns from cycle hash (if available)
        // (simplified for brevity)
      }
    }
    
    const patternsPath = path.join(this.rl4Path, 'patterns.json');
    fs.writeFileSync(patternsPath, JSON.stringify(patterns, null, 2));
  }
  
  private async reconstructCorrelations(cycles: CycleSummary[]): Promise<void> {
    // Similar to reconstructPatterns
  }
  
  private async reconstructForecasts(cycles: CycleSummary[]): Promise<void> {
    // Similar to reconstructPatterns
  }
  
  private loadGroundTruthPlan(): PlanData | null {
    const gtPath = path.join(this.rl4Path, 'ground_truth', 'Plan.yaml');
    if (!fs.existsSync(gtPath)) return null;
    
    const yaml = fs.readFileSync(gtPath, 'utf-8');
    return yaml.load(yaml) as PlanData;
  }
  
  private loadGroundTruthTasks(): TasksData | null {
    const gtPath = path.join(this.rl4Path, 'ground_truth', 'Tasks.yaml');
    if (!fs.existsSync(gtPath)) return null;
    
    const yaml = fs.readFileSync(gtPath, 'utf-8');
    return yaml.load(yaml) as TasksData;
  }
}
```

**Nouvelle Phase à ajouter : Phase 11 (Cold Path Recovery) — 6h**

---

### **🔴 ZONE ROUGE #5 — Pas de Kernel API Surface (Autorisé / Interdit)**

**Problème :**

Le LLM a trop de pouvoir. Aucune frontière claire entre ce qu'il peut modifier et ce qu'il ne doit JAMAIS toucher.

**À ajouter absolument :**

Déjà inclus dans `kernel_manifest.json` (voir Zone Rouge #1).

**Phase : Intégrer dans Phase 8 (Kernel Self-Modeling)**

---

### **🔴 ZONE ROUGE #6 — Pas de Cycle Safe Boundary (CycleLimiter)**

**Problème :**

Pas de limite sur l'expansion cognitive progressive. Le système peut accumuler indéfiniment des patterns, corrélations, forecasts sans jamais "oublier" ou "consolider".

**À ajouter absolument :**

```typescript
class CycleSafeBoundary {
  private readonly MAX_PATTERNS = 1000;
  private readonly MAX_CORRELATIONS = 500;
  private readonly MAX_FORECASTS = 200;
  private readonly MAX_ADRS = 100;
  
  enforceBoundaries(workspaceRoot: string): void {
    // Enforce patterns limit
    const patternsPath = path.join(workspaceRoot, '.reasoning_rl4', 'patterns.json');
    if (fs.existsSync(patternsPath)) {
      const patterns = JSON.parse(fs.readFileSync(patternsPath, 'utf-8'));
      if (patterns.length > this.MAX_PATTERNS) {
        // Archive oldest patterns
        const archived = patterns.slice(0, patterns.length - this.MAX_PATTERNS);
        const kept = patterns.slice(-this.MAX_PATTERNS);
        
        const archivePath = path.join(workspaceRoot, '.reasoning_rl4', 'archive', `patterns_${Date.now()}.json`);
        fs.mkdirSync(path.dirname(archivePath), { recursive: true });
        fs.writeFileSync(archivePath, JSON.stringify(archived, null, 2));
        fs.writeFileSync(patternsPath, JSON.stringify(kept, null, 2));
        
        console.log(`🗄️ Archived ${archived.length} old patterns`);
      }
    }
    
    // Similar for correlations, forecasts, ADRs
  }
}
```

**Phase : Intégrer dans Phase 6 (System Metrics) — +1h**

---

### **🔴 ZONE ROUGE #7 — Pas de Cognitive Debt Meter**

**Problème :**

Tu n'as pas d'outil pour mesurer la **dette cognitive** accumulée par :
- Forecasts qui ne se réalisent jamais
- Patterns qui deviennent obsolètes
- Correlations qui ne sont plus valides
- ADRs qui ne sont jamais appliquées
- Suggestions LLM qui restent en suspens

**À ajouter absolument :**

```typescript
interface CognitiveDebtReport {
  score: number; // 0-100 (0 = no debt, 100 = critical debt)
  breakdown: {
    stale_patterns: number;
    failed_forecasts: number;
    unused_correlations: number;
    pending_adrs: number;
    ignored_llm_observations: number;
  };
  recommendations: string[];
}

class CognitiveDebtMeter {
  calculateDebt(workspaceRoot: string): CognitiveDebtReport {
    const debt: CognitiveDebtReport = {
      score: 0,
      breakdown: {
        stale_patterns: 0,
        failed_forecasts: 0,
        unused_correlations: 0,
        pending_adrs: 0,
        ignored_llm_observations: 0
      },
      recommendations: []
    };
    
    // 1. Stale patterns (not seen in last 30 days)
    const patterns = this.loadPatterns(workspaceRoot);
    const now = Date.now();
    debt.breakdown.stale_patterns = patterns.filter(p => 
      now - new Date(p.lastSeen).getTime() > 30 * 24 * 60 * 60 * 1000
    ).length;
    
    // 2. Failed forecasts (predicted but never occurred)
    const forecasts = this.loadForecasts(workspaceRoot);
    debt.breakdown.failed_forecasts = forecasts.filter(f => 
      f.status === 'predicted' && now - new Date(f.timestamp).getTime() > 7 * 24 * 60 * 60 * 1000
    ).length;
    
    // 3. Unused correlations (not referenced in forecasts)
    const correlations = this.loadCorrelations(workspaceRoot);
    const usedCorrelationIds = new Set(forecasts.flatMap(f => f.correlationIds || []));
    debt.breakdown.unused_correlations = correlations.filter(c => 
      !usedCorrelationIds.has(c.id)
    ).length;
    
    // 4. Pending ADRs (proposed but not accepted/rejected)
    const adrs = this.loadProposedADRs(workspaceRoot);
    debt.breakdown.pending_adrs = adrs.filter(a => a.status === 'proposed').length;
    
    // 5. Ignored LLM observations (not processed by engines)
    const llmObservations = this.loadLLMObservations(workspaceRoot);
    debt.breakdown.ignored_llm_observations = llmObservations.filter(o => 
      !o.processed
    ).length;
    
    // Calculate total score
    debt.score = Math.min(100, 
      debt.breakdown.stale_patterns * 0.5 +
      debt.breakdown.failed_forecasts * 2 +
      debt.breakdown.unused_correlations * 1 +
      debt.breakdown.pending_adrs * 3 +
      debt.breakdown.ignored_llm_observations * 1.5
    );
    
    // Generate recommendations
    if (debt.breakdown.stale_patterns > 50) {
      debt.recommendations.push('Archive stale patterns (> 30 days old)');
    }
    if (debt.breakdown.failed_forecasts > 10) {
      debt.recommendations.push('Review forecasting model accuracy');
    }
    if (debt.breakdown.pending_adrs > 5) {
      debt.recommendations.push('Accept/reject pending ADRs');
    }
    
    return debt;
  }
}
```

**Phase : Intégrer dans Phase 6 (System Metrics) — +2h**

---

## **RÉSUMÉ DES ZONES ROUGES**

| Zone Rouge | Impact | Effort | Phase |
|---|---|---|---|
| #1: Kernel Self-Modeling | Dérive cognitive lente | 6h | Phase 8 (NEW) |
| #2: Drift Timeline (velocity + acceleration) | Dérive exponentielle | 4h | Phase 9 (NEW) |
| #3: LLM ↔ Kernel Cross-Validation | Patterns erronés propagés | 5h | Phase 10 (NEW) |
| #4: Cold Path Recovery | Impossibilité de rollback profond | 6h | Phase 11 (NEW) |
| #5: Kernel API Surface | LLM trop puissant | 0h | Intégré dans Phase 8 |
| #6: Cycle Safe Boundary | Expansion cognitive infinie | 1h | Intégré dans Phase 6 |
| #7: Cognitive Debt Meter | Dette cognitive invisible | 2h | Intégré dans Phase 6 |
| **TOTAL** | **CRITIQUE** | **24h** | **4 nouvelles phases** |

---

## **MISE À JOUR DU PLAN TOTAL**

| Phase | Durée | Priorité | Status |
|---|---|---|---|
| Phase 0: Corrections Critiques | 18h | P0 | BLOCAGE TOTAL |
| Phase 1: Fondations | 7h | P0 | - |
| Phase 2: Mode Enhancement | 5h | P1 | - |
| Phase 3: Invariants & Validation | 6h | P1 | - |
| Phase 4: Guardrails | 3h | P2 | - |
| Phase 5: Engines Enrichment | 5h | P2 | - |
| Phase 6: System Metrics | 5h | P2 | **(+3h: CycleSafeBoundary + CognitiveDebtMeter)** |
| Phase 7: Testing & Validation | 8h | P1 | - |
| **Phase 8: Kernel Self-Modeling** | **6h** | **P0** | **NEW — ZONE ROUGE #1** |
| **Phase 9: Drift Timeline** | **4h** | **P0** | **NEW — ZONE ROUGE #2** |
| **Phase 10: Cross-Validation** | **5h** | **P0** | **NEW — ZONE ROUGE #3** |
| **Phase 11: Cold Path Recovery** | **6h** | **P0** | **NEW — ZONE ROUGE #4** |
| **TOTAL PRODUCTION READY** | **78h** | **10-12 jours** | **- **|

---

## **VERDICT FINAL — SANS COMPLAISANCE**

### **Tu peux ship le MVP… MAIS**

**En état Production Ready, tu ne peux PAS sans corriger ces 4 zones rouges.**

Sinon tu vas avoir :
- ❌ Dérive lente incontrôlable
- ❌ Patterns invalides qui se propagent
- ❌ Hallucinations normalisées dans les engines
- ❌ Cycles successifs qui amplifient les erreurs
- ❌ Impossibilité de rollback profond
- ❌ Kernel progressivement déformé
- ❌ **Système instable après 3–4 jours de vrai usage**

**Et tout cela vient DU FAIT que le LLM enrichit les engines et le kernel à chaque prompt.**

### **Phase 0-7 = MVP Shippable**
- Durée : 54h (7-9 jours)
- État : Fonctionnel, mais fragile en production longue durée

### **Phase 0-11 = Production Ready**
- Durée : 78h (10-12 jours)
- État : Stable, résilient, auto-réparable, auditable

---

**FIN DU PLAN DE DÉVELOPPEMENT (Version Critique Finale)**

**Status:** FINAL — Zones Rouges identifiées — Validation requise  
**Next Steps:** Validation de Valentin → GO → Phase 0 implémentation immédiate → Décision sur Phases 8-11

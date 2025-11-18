# 🔍 Audit — Fichiers existants pour reconstruction d'activité

## 📊 Résumé exécutif

**Objectif** : Vérifier si des fichiers existants peuvent être réutilisés pour :
1. ✅ Activer SnapshotReminder
2. 🔧 Reconstruction activité entre snapshots
3. 🔧 Corriger Where Am I

---

## ✅ FICHIERS EXISTANTS — Analyse détaillée

### 1. **SnapshotReminder.ts** — ✅ EXISTE MAIS NON UTILISÉ

**Fichier** : `extension/kernel/api/SnapshotReminder.ts` (297 lignes)

**Statut** : ✅ Code complet et fonctionnel, mais **JAMAIS initialisé** dans `extension.ts`

**Fonctionnalités** :
- ✅ Vérification toutes les 30 minutes
- ✅ Rappel si dernier snapshot > 2h
- ✅ Analyse contexte (tasks, cycles récents)
- ✅ Pré-sélection mode selon activité
- ✅ Génération snapshot + copie clipboard
- ✅ Notification VSCode avec CTA

**Utilisation actuelle** : ❌ AUCUNE (fichier mort)

**Action requise** : 
- ✅ Importer dans `extension.ts`
- ✅ Initialiser au démarrage
- ✅ Appeler `recordSnapshotGenerated()` après snapshot

---

### 2. **StateReconstructor.ts** — ⚠️ EXISTE MAIS INCOMPLET

**Fichier** : `extension/kernel/api/StateReconstructor.ts` (465 lignes)

**Statut** : ⚠️ Partiellement implémenté, **ne lit PAS terminal-events.jsonl**

**Fonctionnalités existantes** :
- ✅ Reconstruction état cognitif à un timestamp précis
- ✅ Lit `file_changes.jsonl` via `getFilesAt(timestamp)`
- ✅ Lit `git_commits.jsonl`
- ✅ Lit `patterns.json`, `forecasts.json`
- ✅ Interpolation entre snapshots
- ✅ Modes `approximate` et `precise`

**Fonctionnalités manquantes** :
- ❌ Ne lit **PAS** `terminal-events.jsonl`
- ❌ Ne génère **PAS** de résumé "ce qui a été fait entre X et Y"
- ❌ Ne corrèle **PAS** file changes + terminal events

**Utilisation actuelle** :
- ✅ Exporté dans `extension/kernel/api/index.ts`
- ✅ Utilisé dans `HistorySummarizer.ts` (référence seulement)
- ✅ Utilisé dans `WhereAmISnapshot.ts` (référence seulement)
- ⚠️ **Jamais instancié** dans `extension.ts`

**Action requise** :
- Option A : Étendre `StateReconstructor` avec méthodes pour terminal events
- Option B : Créer `ActivityReconstructor.ts` dédié (recommandé)

**Recommandation** : Option B — `ActivityReconstructor.ts` séparé car :
- Responsabilité différente (activité vs état cognitif)
- Plus simple à maintenir
- Peut réutiliser `StateReconstructor` si besoin

---

### 3. **TaskVerificationEngine.ts** — ✅ EXISTE ET UTILISÉ

**Fichier** : `extension/kernel/cognitive/TaskVerificationEngine.ts` (238 lignes)

**Statut** : ✅ Fonctionnel et utilisé

**Fonctionnalités** :
- ✅ Lit `terminal-events.jsonl` via `readTerminalEvents()`
- ✅ Parse `Tasks.RL4` avec `@rl4:id` et `@rl4:completeWhen`
- ✅ Vérifie si tâches sont complétées
- ✅ Corrèle événements terminaux avec tâches

**Utilisation actuelle** :
- ✅ Initialisé dans `extension.ts` (ligne ~595)
- ✅ Rechargé quand `Tasks.RL4` change (via `LiveWatcher`)

**Réutilisabilité** :
- ⚠️ Méthode `readTerminalEvents()` est **privée**
- ✅ Peut être extraite en méthode publique ou utilitaire
- ✅ Format de lecture compatible avec notre besoin

**Action requise** :
- Extraire `readTerminalEvents()` en méthode publique ou utilitaire
- Réutiliser dans `ActivityReconstructor.ts`

---

### 4. **AdaptivePromptBuilder.ts** — ⚠️ WRAPPER INUTILE

**Fichier** : `extension/kernel/api/AdaptivePromptBuilder.ts` (399 lignes)

**Statut** : ⚠️ Wrapper autour de `UnifiedPromptBuilder`, utilisé seulement dans `extension.ts`

**Fonctionnalités** :
- ✅ Détection projet automatique
- ✅ Mapping modes (`standard` → `flexible`)
- ⚠️ **Appelle simplement `UnifiedPromptBuilder.generate()`**

**Utilisation actuelle** :
- ✅ Utilisé dans `extension.ts` ligne 475 (commande `reasoning.kernel.whereami`)
- ❌ Nulle part ailleurs

**Action requise** :
- ✅ Remplacer directement par `UnifiedPromptBuilder` dans `extension.ts`
- ⚠️ **Peut être supprimé** après migration (mais garder pour compatibilité si besoin)

---

### 5. **CorrelationEngine.ts** — ✅ EXISTE MAIS DIFFÉRENT

**Fichier** : `extension/kernel/cognitive/CorrelationEngine.ts` (560 lignes)

**Statut** : ✅ Fonctionnel mais objectif différent

**Fonctionnalités** :
- ✅ Lit `file_changes.jsonl` et `ide_activity.jsonl`
- ✅ Corrèle patterns (pas activité entre snapshots)
- ✅ Génère corrélations pour PatternLearningEngine

**Utilisation actuelle** :
- ✅ Utilisé dans `CognitiveScheduler` pour cycles cognitifs

**Réutilisabilité** :
- ⚠️ Objectif différent (patterns vs activité)
- ✅ Peut inspirer la logique de corrélation

**Action requise** :
- ❌ Ne pas réutiliser directement
- ✅ S'inspirer de la logique de corrélation

---

## 📋 FICHIERS MORTS / NON UTILISÉS

### ❌ Fichiers à supprimer (après migration)

1. **AdaptivePromptBuilder.ts** (après remplacement dans `extension.ts`)
   - Raison : Wrapper inutile, `UnifiedPromptBuilder` fait tout
   - Action : Supprimer après migration `extension.ts`

### ⚠️ Fichiers partiellement utilisés

1. **StateReconstructor.ts**
   - Raison : Exporté mais jamais instancié
   - Action : Garder mais étendre ou créer `ActivityReconstructor`

---

## 🎯 PLAN D'ACTION RECOMMANDÉ

### Priorité 1 : Activer SnapshotReminder ✅

**Fichiers à modifier** :
- `extension/extension.ts` (ajouter import + initialisation)

**Fichiers à réutiliser** :
- ✅ `extension/kernel/api/SnapshotReminder.ts` (déjà complet)

**Estimation** : 30 min

---

### Priorité 2 : Reconstruction activité entre snapshots 🔧

**Fichiers à créer** :
- `extension/kernel/api/ActivityReconstructor.ts` (nouveau)

**Fichiers à réutiliser** :
- ✅ `TaskVerificationEngine.readTerminalEvents()` → Extraire en utilitaire
- ✅ `StateReconstructor.getFilesAt()` → S'inspirer de la logique
- ✅ `CorrelationEngine` → S'inspirer de la logique de corrélation

**Fichiers à modifier** :
- `extension/kernel/api/UnifiedPromptBuilder.ts` (intégrer reconstruction)

**Estimation** : 2-3h

---

### Priorité 3 : Corriger Where Am I ✅

**Fichiers à modifier** :
- `extension/extension.ts` (ligne 475, remplacer `AdaptivePromptBuilder` par `UnifiedPromptBuilder`)

**Fichiers à supprimer** (optionnel) :
- `extension/kernel/api/AdaptivePromptBuilder.ts` (après migration)

**Estimation** : 30 min

---

## 📊 RÉSUMÉ DES DÉCOUVERTES

| Fichier | Statut | Réutilisable ? | Action |
|---------|--------|----------------|--------|
| `SnapshotReminder.ts` | ✅ Complet, non utilisé | ✅ Oui | Activer dans `extension.ts` |
| `StateReconstructor.ts` | ⚠️ Partiel, non utilisé | ⚠️ Partiel | Étendre ou créer nouveau |
| `TaskVerificationEngine.ts` | ✅ Complet, utilisé | ✅ Oui | Extraire `readTerminalEvents()` |
| `AdaptivePromptBuilder.ts` | ⚠️ Wrapper inutile | ❌ Non | Remplacer par `UnifiedPromptBuilder` |
| `CorrelationEngine.ts` | ✅ Complet, utilisé | ⚠️ Inspiration | S'inspirer de la logique |

---

## ✅ CONCLUSION

**Bonne nouvelle** :
- ✅ `SnapshotReminder` est **déjà complet** → juste à activer
- ✅ `TaskVerificationEngine` a déjà la logique de lecture `terminal-events.jsonl`
- ✅ `StateReconstructor` a déjà la logique de lecture `file_changes.jsonl`

**Action immédiate** :
1. ✅ Activer `SnapshotReminder` (30 min)
2. 🔧 Créer `ActivityReconstructor.ts` en réutilisant les méthodes existantes (2-3h)
3. ✅ Remplacer `AdaptivePromptBuilder` par `UnifiedPromptBuilder` (30 min)

**Total estimé** : 3-4h (inchangé)


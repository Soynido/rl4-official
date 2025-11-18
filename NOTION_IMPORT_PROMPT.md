# Notion Import Assistant Prompt

## Instructions pour importer la RL4 Bible dans Notion

### Étape 1: Préparation

1. Ouvrez Notion
2. Créez une nouvelle page ou sélectionnez une page existante
3. Préparez-vous à importer le contenu

### Étape 2: Import du fichier Markdown

**Option A: Import direct (recommandé)**

1. Dans Notion, cliquez sur le menu `...` (trois points) en haut à droite
2. Sélectionnez `Import`
3. Choisissez `Markdown` comme type de fichier
4. Sélectionnez `RL4_BIBLE_EN.md` ou `RL4_BIBLE_FR.md` ou `RL4_BIBLE_COMBINED.md`
5. Notion créera automatiquement la hiérarchie de pages

**Option B: Copier-coller**

1. Ouvrez `RL4_BIBLE_EN.md` ou `RL4_BIBLE_FR.md` dans un éditeur de texte
2. Copiez tout le contenu (Cmd+A, Cmd+C)
3. Dans Notion, créez une nouvelle page
4. Collez le contenu (Cmd+V)
5. Notion convertira automatiquement le Markdown en format Notion

### Étape 3: Structure de pages recommandée

Après l'import, Notion créera automatiquement une hiérarchie basée sur les titres. Voici la structure recommandée :

```
RL4 Bible — Complete Documentation (Page principale)
├── Executive Overview
├── Global Architecture Map
│   ├── High-Level Architecture
│   ├── Component Interaction Flow
│   └── Cognitive Cycle Flow
├── Kernel System
│   ├── CognitiveScheduler
│   ├── Kernel Readiness Protocol
│   └── Kernel Status API
├── Ledger System
│   ├── RBOMLedger
│   ├── Cycle Summary Format
│   ├── Merkle Root Computation
│   └── Integrity Patches
├── Engines
│   ├── PatternLearningEngine
│   ├── CorrelationEngine
│   ├── ForecastEngine
│   └── ADRGeneratorV2
├── Snapshot System
│   ├── UnifiedPromptBuilder
│   ├── SnapshotDataAssembler Flow
│   ├── Normalization Rules
│   └── BlindSpotDataLoader
├── Prompt System
│   ├── Prompt Profiles
│   ├── Strict Mode
│   ├── Flexible Mode
│   ├── Exploratory Mode
│   ├── Free Mode
│   ├── FirstUse Mode
│   └── formatPrompt() Template
├── Compression System
│   └── PromptOptimizer
├── WebView Pipeline
│   ├── Architecture
│   ├── Control Tab
│   ├── Dev Tab
│   ├── Insights Tab
│   ├── About Tab
│   └── Message Flow
├── Cursor Workflow
│   ├── End-to-End Flow
│   ├── RL4_PROPOSAL Protocol
│   ├── RL4_DECISION_REQUEST Protocol
│   └── RL4_TASKS_PATCH Protocol
├── ADRs
│   ├── ADR Lifecycle
│   ├── ADR Structure
│   └── ADR Parser
├── Workspace Intelligence
│   ├── Project Detection
│   ├── Project Analysis
│   ├── Code State Analysis
│   ├── Pattern Learning
│   └── Terminal Patterns Learning
├── Extensibility Guide
│   ├── Adding a New Engine
│   ├── Adding a New Prompt Profile
│   └── Adding a New Blind Spot Data Source
└── Maintenance Guide
    ├── Common Issues
    ├── Performance Optimization
    └── Backup Strategy
```

### Étape 4: Optimisation de la structure

Après l'import, vous pouvez optimiser la structure :

1. **Créer des sous-pages pour les sections principales**
   - Cliquez droit sur un titre de section → `Turn into page`
   - Cela créera une sous-page avec le contenu de la section

2. **Ajouter des icônes et couleurs**
   - Cliquez sur l'icône de page en haut → Choisissez une icône et une couleur
   - Recommandation: 🧠 pour la page principale

3. **Créer une table des matières**
   - Utilisez le bloc `/table` dans Notion
   - Ajoutez les liens vers les sections principales

4. **Ajouter des tags**
   - Créez des propriétés de tags pour catégoriser les sections
   - Exemples: `Architecture`, `API`, `Workflow`, `Maintenance`

### Étape 5: Formatage et améliorations

1. **Code blocks**
   - Les blocs de code TypeScript/JSON seront automatiquement formatés
   - Vous pouvez ajouter la coloration syntaxique en spécifiant le langage

2. **Diagrammes ASCII**
   - Les diagrammes ASCII seront préservés dans des blocs de code
   - Vous pouvez les convertir en diagrammes Notion si désiré

3. **Liens internes**
   - Les liens Markdown `[text](#anchor)` seront convertis automatiquement
   - Vous pouvez créer des liens manuels vers d'autres pages Notion

4. **Tables**
   - Les tables Markdown seront converties en tables Notion
   - Vous pouvez les formater et ajouter des colonnes si nécessaire

### Étape 6: Version bilingue (si vous importez RL4_BIBLE_COMBINED.md)

Si vous importez le fichier combiné (EN + FR):

1. **Séparer les versions**
   - Créez deux pages principales: "RL4 Bible (English)" et "RL4 Bible (Français)"
   - Copiez le contenu approprié dans chaque page

2. **Créer un index bilingue**
   - Créez une page "RL4 Bible Index"
   - Ajoutez des liens vers les deux versions

3. **Synchroniser la structure**
   - Assurez-vous que les deux versions ont la même structure
   - Utilisez les mêmes noms de sections pour faciliter la navigation

### Étape 7: Maintenance

1. **Mise à jour du contenu**
   - Quand RL4 évolue, mettez à jour la documentation dans Notion
   - Utilisez les commentaires Notion pour noter les changements

2. **Versioning**
   - Créez une propriété "Version" sur la page principale
   - Mettez à jour la version lors des mises à jour majeures

3. **Feedback**
   - Utilisez les commentaires Notion pour recueillir du feedback
   - Créez une page "Changelog" pour suivre les modifications

### Astuces supplémentaires

1. **Recherche**
   - Utilisez la recherche Notion (Cmd+P) pour trouver rapidement des sections
   - Les titres et le contenu sont indexés automatiquement

2. **Partage**
   - Partagez la page avec votre équipe
   - Configurez les permissions selon vos besoins

3. **Templates**
   - Créez un template basé sur cette structure pour d'autres projets
   - Réutilisez la structure pour d'autres documentations

4. **Intégrations**
   - Connectez Notion à d'autres outils (GitHub, Slack, etc.)
   - Utilisez l'API Notion pour automatiser les mises à jour

### Format de page recommandé

```
Page principale: RL4 Bible — Complete Documentation
├── Properties:
│   ├── Version: 3.5.11
│   ├── Last Updated: 2025-11-18
│   ├── Status: Production-Ready
│   └── Language: English / French / Both
├── Content:
│   ├── Table of Contents (automatic)
│   ├── Executive Overview
│   └── [All sections as sub-pages]
└── Related Pages:
    ├── RL4 Code Repository
    ├── RL4 Changelog
    └── RL4 Issues Tracker
```

### Commandes Notion utiles

- `/page` - Créer une nouvelle page
- `/table` - Créer une table
- `/code` - Ajouter un bloc de code
- `/callout` - Ajouter un encadré d'information
- `/toggle` - Créer une liste déroulante
- `/divider` - Ajouter un séparateur

### Support

Si vous rencontrez des problèmes lors de l'import:

1. Vérifiez que le fichier Markdown est valide
2. Essayez d'importer section par section si l'import complet échoue
3. Utilisez un outil de conversion Markdown → Notion si nécessaire
4. Contactez le support Notion pour assistance

---

**Note:** Cette documentation est optimisée pour l'import dans Notion. La structure Markdown sera automatiquement convertie en format Notion avec préservation de la hiérarchie et du formatage.


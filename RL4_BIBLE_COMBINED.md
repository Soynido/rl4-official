# RL4 Bible — Complete Documentation (EN + FR)

___

END ENGLISH VERSION

BEGIN FRENCH VERSION

# RL4 Bible — Complete Documentation

**Version:** 3.5.11  
**Last Updated:** 2025-11-18  
**Status:** Production-Ready Kernel (P0-CORE Active)

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [Global Architecture Map](#global-architecture-map)
3. [Kernel System](#kernel-system)
4. [Ledger System](#ledger-system)
5. [Engines](#engines)
6. [Snapshot System](#snapshot-system)
7. [Prompt System](#prompt-system)
8. [Compression System](#compression-system)
9. [WebView Pipeline](#webview-pipeline)
10. [Cursor Workflow](#cursor-workflow)
11. [ADRs](#adrs)
12. [Workspace Intelligence](#workspace-intelligence)
13. [Extensibility Guide](#extensibility-guide)
14. [Maintenance Guide](#maintenance-guide)

---

## Executive Overview

### What is RL4?

RL4 (Reasoning Layer 4) is a **cognitive operating system layer** for VS Code that provides AI agents with complete workspace context through structured snapshots. It bridges the gap between what an AI agent can see (current files) and what it needs to know (historical context, decisions, patterns, intent).

### Core Purpose

RL4 solves the **context blindness problem** for AI coding assistants:

- **Without RL4:** AI agents see only current files, missing historical context, decisions, patterns, and developer intent.
- **With RL4:** AI agents receive comprehensive snapshots containing Plan, Tasks, Context, ADRs, timeline, blind spot data, and engine-generated insights.

### Key Capabilities

1. **Context Snapshot Generation:** Unified prompts combining 15+ data sources
2. **Cognitive Cycle Execution:** Pattern learning → Correlation → Forecasting → ADR synthesis
3. **Ledger System:** Append-only RBOM ledger with Merkle root verification
4. **Blind Spot Detection:** Timeline, file patterns, git history, health trends
5. **Proposal Workflow:** LLM proposals → Validation → Patch application
6. **Task Verification:** Terminal event tracking → Auto-verification → Mark as done

### Architecture Philosophy

RL4 follows a **kernel-based architecture**:

- **Kernel:** Core cognitive engine (scheduler, ledger, engines)
- **Extension:** VS Code integration layer
- **WebView:** User interface (Control/Dev/Insights/About tabs)
- **Data Pipeline:** Snapshot generation → Clipboard → Cursor workflow

---

## Global Architecture Map

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Extension Host (extension.ts)           │
│  │  - Message handlers (WebView ↔ Extension)            │
│  │  - File watchers (Tasks.RL4, proposals.json)         │
│  │  - Terminal integration (RL4 Terminal)              │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WebView (React UI)                      │
│  │  - Control Tab (Snapshot generation)                │
│  │  - Dev Tab (Proposals, verification)                 │
│  │  - Insights Tab (KPIs, anomalies)                   │
│  │  - About Tab (Info)                                  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    RL4 Kernel                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         CognitiveScheduler (Master Orchestrator)     │
│  │  - Runs cognitive cycle every 10s (configurable)      │
│  │  - Phases: Pattern → Correlation → Forecast → ADR   │
│  │  - Idempotence (hash-based skip if no changes)       │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Cognitive Engines                        │
│  │  - PatternLearningEngine (analyzePatterns)           │
│  │  - CorrelationEngine (analyze)                      │
│  │  - ForecastEngine (generate)                         │
│  │  - ADRGeneratorV2 (generateProposals)                │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              RBOMLedger (Append-Only)                 │
│  │  - cycles.jsonl (cycle summaries)                     │
│  │  - rbom_ledger.jsonl (ADR entries)                    │
│  │  - Merkle root (chain integrity)                      │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│              .reasoning_rl4/ Data Store                    │
│  - Plan.RL4, Tasks.RL4, Context.RL4                        │
│  - ledger/ (cycles.jsonl, rbom_ledger.jsonl)               │
│  - traces/ (file_changes.jsonl, ide_activity.jsonl)         │
│  - patterns.json, correlations.json, forecasts.json        │
│  - proposals.json, terminal-events.jsonl                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action (WebView)
  ↓
Extension Handler (extension.ts)
  ↓
UnifiedPromptBuilder.generate(mode)
  ↓
buildSnapshotData() → Aggregates 15+ data sources
  ↓
formatPrompt() → Applies profile (strict/flexible/exploratory/free)
  ↓
PromptOptimizer.optimize() → Compression
  ↓
AnomalyDetector.detectAnomalies() → Anomaly detection
  ↓
Return { prompt, metadata }
  ↓
WebView → Clipboard → Cursor
```

### Cognitive Cycle Flow

```
Timer Fires (every 10s in TEST_MODE, 2h in production)
  ↓
CognitiveScheduler.runCycle()
  ├── Check isRunning flag (skip if true)
  ├── Set isRunning = true
  ├── Calculate inputHash (for idempotence)
  ├── Skip if same hash as last cycle
  │
  ├── Phase 1: Pattern Learning
  │   ├── PatternLearningEngine.analyzePatterns()
  │   ├── Load ledger entries (internal + external)
  │   ├── Detect patterns (incident+feedback, refactor, migration, etc.)
  │   └── Save to patterns.json
  │
  ├── Phase 2: Correlation
  │   ├── CorrelationEngine.analyze()
  │   ├── Load patterns.json
  │   ├── Load recent events from traces
  │   ├── Compute correlation scores
  │   └── Save to correlations.json
  │
  ├── Phase 3: Forecasting
  │   ├── ForecastEngine.generate()
  │   ├── Load patterns + correlations
  │   ├── Match with market signals
  │   ├── Generate forecasts
  │   └── Save to forecasts.json
  │
  ├── Phase 4: ADR Synthesis
  │   ├── ADRGeneratorV2.generateProposals()
  │   ├── Load forecasts
  │   ├── Transform forecasts → ADR proposals
  │   └── Save to adrs/auto/
  │
  ├── Aggregate Results
  │   ├── Extract phase counts
  │   ├── Hash phase metrics
  │   └── ledger.appendCycle() → Write to cycles.jsonl
  │
  └── Set isRunning = false (guaranteed in finally block)
```

---

## Kernel System

### CognitiveScheduler

**Location:** `extension/kernel/CognitiveScheduler.ts`  
**Purpose:** Single master scheduler orchestrating the cognitive cycle

#### Key Features

- **Single Timer Ownership:** Prevents memory leaks from orphaned timers
- **Idempotence:** Hash-based skip if input unchanged
- **Phase Telemetry:** Tracks duration and success for each phase
- **Safe Mode:** Blocks execution if ledger corruption detected

#### Configuration

```typescript
// Default interval: 10 seconds (TEST_MODE)
// Production interval: 2 hours (7200000ms)
// Configurable via .reasoning_rl4/kernel_config.json
{
  "cognitive_cycle_interval_ms": 7200000,
  "TEST_MODE": false
}
```

#### Cycle Phases

1. **Pattern Learning** (`pattern-learning`)
   - Engine: `PatternLearningEngine`
   - Input: Ledger entries (internal + external)
   - Output: Decision patterns (patterns.json)
   - Duration: ~50-200ms

2. **Correlation** (`correlation`)
   - Engine: `CorrelationEngine`
   - Input: Patterns + recent events (traces)
   - Output: Correlations (correlations.json)
   - Duration: ~100-300ms

3. **Forecasting** (`forecasting`)
   - Engine: `ForecastEngine` (persistent instance)
   - Input: Patterns + correlations + market signals
   - Output: Forecasts (forecasts.json)
   - Duration: ~200-500ms

4. **ADR Synthesis** (`adr-synthesis`)
   - Engine: `ADRGeneratorV2`
   - Input: Forecasts
   - Output: ADR proposals (adrs/auto/)
   - Duration: ~100-300ms

#### Cycle Result Structure

```typescript
interface CycleResult {
  cycleId: number;
  startedAt: string;
  completedAt: string;
  duration: number;
  phases: PhaseResult[];
  inputHash: string; // For idempotence
  success: boolean;
}

interface PhaseResult {
  name: string;
  duration: number;
  success: boolean;
  metrics?: any;
  error?: string;
}
```

#### Safe Mode

**Trigger:** Ledger corruption detected on startup  
**Behavior:** Blocks `appendCycle()` calls, prevents extending corrupted chain  
**Recovery:** Manual ledger repair required

```typescript
// P1-INTEGRITY-02 PATCH 6: SAFE MODE implementation
if (this.safeMode) {
  throw new Error(`❌ RBOMLedger in SAFE MODE: Cannot append cycle. Reason: ${this.corruptionReason}`);
}
```

### Kernel Readiness Protocol

**Status:** P0-CORE-02 (Pending)  
**Goal:** Ensure kernel is fully initialized before WebView operations

#### Planned Implementation

```typescript
class KernelReadyProtocol {
  async init(): Promise<void> {
    // 1. Load artifacts (state.json.gz, universals.json.gz)
    // 2. Verify ledger integrity
    // 3. Initialize cognitive scheduler
    // 4. Set ready flag
  }
  
  async waitForKernelReady(): Promise<void> {
    // Poll until ready flag is true
  }
  
  get ready(): boolean {
    return this.readyFlag;
  }
}
```

### Kernel Status API

**Status:** P0-CORE-03 (Pending)  
**Goal:** Expose kernel status to WebView for observability

#### Planned Implementation

```typescript
class KernelStatusAPI {
  getStatus(): KernelStatus {
    return {
      cycleCount: scheduler.getCycleCount(),
      isRunning: scheduler.isRunning,
      lastCycleTime: scheduler.getLastCycleTime(),
      safeMode: ledger.getSafeMode(),
      merkleRoot: ledger.getMerkleRoot(),
      health: healthMonitor.getMetrics()
    };
  }
}
```

---

## Ledger System

### RBOMLedger

**Location:** `extension/kernel/RBOMLedger.ts`  
**Purpose:** Append-only RBOM ledger with Merkle verification

#### Key Features

- **Append-Only:** Immutable ledger (no rewrites)
- **Merkle Tree:** Chain integrity verification
- **Inter-Cycle Chaining:** Each cycle links to previous via `prevMerkleRoot`
- **Safe Mode:** Blocks writes if corruption detected

#### File Structure

```
.reasoning_rl4/ledger/
├── cycles.jsonl          # Cycle summaries (append-only)
├── rbom_ledger.jsonl     # RBOM entries (append-only)
└── ledger.jsonl          # Legacy ADR ledger (deprecated)
```

#### Cycle Summary Format

```json
{
  "cycleId": 721,
  "timestamp": "2025-11-18T14:40:32.250Z",
  "phases": {
    "patterns": { "hash": "abc123...", "count": 5 },
    "correlations": { "hash": "def456...", "count": 3 },
    "forecasts": { "hash": "ghi789...", "count": 2 },
    "adrs": { "hash": "jkl012...", "count": 1 }
  },
  "merkleRoot": "merkle_root_hash_here",
  "prevMerkleRoot": "previous_merkle_root_hash"
}
```

#### Merkle Root Computation

```typescript
// Merkle root computed from phase hashes ONLY (before cycle object construction)
const phaseHashes = [
  cycleData.phases.patterns.hash,
  cycleData.phases.correlations.hash,
  cycleData.phases.forecasts.hash,
  cycleData.phases.adrs.hash
].filter(h => h.length > 0);

const merkleRoot = this.computeRoot(phaseHashes);
```

**Critical:** Merkle root is computed from phase hashes **BEFORE** cycle object construction, preventing circular dependency.

#### Integrity Patches

**P1-INTEGRITY-02 PATCH 2:** Flush-before-cache-update with retry
- Ensures disk flush completes before cache update
- 3 retries with exponential backoff (100ms, 200ms, 400ms)

**P1-INTEGRITY-02 PATCH 5:** Partial write validator
- Validates last line of JSONL files before read
- Truncates to last valid newline on corruption detection

**P1-INTEGRITY-02 PATCH 6:** SAFE MODE on startup
- Deep verification on startup (`verifyChain({deep:true})`)
- Blocks `appendCycle()` if chain verification fails
- Corruption reason stored for diagnostics

#### Merkle Cache Initialization

**P0-HARDENING-02:** Eager load Merkle cache
- Cache initialized in constructor (non-blocking)
- Fallback to genesis if disk failure
- Prevents lazy-load surprise latency

```typescript
// Constructor: Eager load cache
this.initializeMerkleCache();

// Fallback to genesis if cache null
const prevMerkleRoot = this.lastCycleMerkleRoot || '0000000000000000'; // Genesis
```

---

## Engines

### PatternLearningEngine

**Location:** `extension/kernel/cognitive/PatternLearningEngine.ts`  
**Purpose:** Analyze ledger entries to extract recurrent decision patterns

#### Pattern Detection

1. **Incident + Feedback → Config Update ADR**
   - Detects: Incident ADR followed by feedback ADR
   - Pattern: Config updates after incidents

2. **Refactor Decisions → Reduced Incidents**
   - Detects: Refactor ADRs correlated with incident reduction
   - Pattern: Refactoring improves stability

3. **Market Trend → Tech Migration**
   - Detects: Market signals followed by migration ADRs
   - Pattern: External trends drive migrations

4. **Performance Issues → Cache Decisions**
   - Detects: Performance ADRs followed by cache ADRs
   - Pattern: Caching solves performance problems

5. **Compliance Requirements → Security ADRs**
   - Detects: Compliance ADRs followed by security ADRs
   - Pattern: Compliance drives security improvements

#### Auto-Learning

- Loads existing patterns (potentially improved by LLM)
- Builds upon existing patterns (no duplication)
- Applies diversity penalty to reduce thematic bias
- Preserves LLM improvements when saving

#### Output Format

```typescript
interface DecisionPattern {
  id: string;
  pattern: string;
  frequency: number;
  confidence: number;
  impact: string;
  tags: string[];
  lastSeen: string;
}
```

### CorrelationEngine

**Location:** `extension/kernel/cognitive/CorrelationEngine.ts`  
**Purpose:** Detect correlations between recent events and learned patterns

#### Correlation Types

1. **Confirming:** Event confirms pattern (high confidence)
2. **Diverging:** Event diverges from pattern (potential anomaly)
3. **Emerging:** New pattern emerging from events

#### Correlation Score Calculation

```typescript
// score = (semantic_similarity × 0.6) + (temporal_proximity × 0.3) + (impact_match × 0.1)
const semanticScore = this.cosineSimilarity(eventTags, patternTags);
const temporalScore = Math.exp(-daysDiff / 7); // Exponential decay over 7 days
const impactScore = (event.data?.impact === pattern.impact) ? 1 : 0;

const correlationScore = (semanticScore * 0.6) + (temporalScore * 0.3) + (impactScore * 0.1);
```

**Threshold:** 0.15 (lowered for RL4 traces with sparse tags)

#### Output Format

```typescript
interface Correlation {
  id: string;
  pattern_id: string;
  event_id: string;
  correlation_score: number;
  direction: 'confirming' | 'diverging' | 'emerging';
  tags: string[];
  impact: string;
  timestamp: string;
}
```

### ForecastEngine

**Location:** `extension/kernel/cognitive/ForecastEngine.ts`  
**Purpose:** Generate forecasts for future decisions, risks, and opportunities

#### Forecast Generation

1. **Load Patterns + Correlations**
   - Requires both patterns and correlations (returns [] if missing)

2. **Match Market Signals**
   - External signals enhance forecast confidence

3. **Calculate Confidence**
   - Based on pattern confidence, correlation score, and signal match

4. **Apply Category Diversity**
   - Limits forecasts per category (max 3) to reduce thematic bias

**Threshold:** 0.70 (increased from 0.65 for higher precision)

#### Forecast Metrics

```typescript
interface ForecastMetrics {
  forecast_precision: number;
  forecast_recall: number;
  total_forecasts: number;
  correct_forecasts: number;
  false_positives: number;
  false_negatives: number;
  last_evaluation: string;
  improvement_rate: number;
  baseline: {
    precision: number;
    established_at: string;
  };
}
```

#### Output Format

```typescript
interface Forecast {
  forecast_id: string;
  predicted_decision: string;
  confidence: number;
  rationale: string[];
  related_patterns: string[];
  decision_type: 'ADR_Proposal' | 'Risk' | 'Opportunity';
  timeframe: string;
  timestamp: string;
}
```

### ADRGeneratorV2

**Location:** `extension/kernel/cognitive/ADRGeneratorV2.ts`  
**Purpose:** Transform forecasts into actionable ADR proposals

#### Proposal Generation

1. **Load Forecasts**
   - Only processes `ADR_Proposal` forecast types

2. **Find Related Pattern**
   - Adds context from related pattern

3. **Create Proposal**
   - Transforms forecast → ADR proposal structure

4. **Deduplication**
   - Checks for duplicates before saving

#### Output Format

```typescript
interface ProposedADR extends ADR {
  autoGenerated: boolean;
  forecast_source: string;
  requires_human_validation: boolean;
  proposedAt: string;
  validationStatus: 'pending' | 'accepted' | 'rejected';
  validationNotes?: string;
  confidence: number;
}
```

#### Proposal Index

```typescript
interface ProposalIndex {
  generated_at: string;
  total_proposals: number;
  pending: string[];
  accepted: string[];
  rejected: string[];
  proposals: {
    id: string;
    title: string;
    confidence: number;
    status: 'pending' | 'accepted' | 'rejected';
    forecast_source: string;
    proposedAt: string;
  }[];
}
```

---

## Snapshot System

### UnifiedPromptBuilder

**Location:** `extension/kernel/api/UnifiedPromptBuilder.ts`  
**Purpose:** Single context snapshot generator combining all data sources

#### SnapshotData Structure

```typescript
interface SnapshotData {
  plan: PlanData | null;
  tasks: TasksData | null;
  context: ContextData | null;
  adrs: any[];
  historySummary: HistorySummary | null;
  biasReport: BiasReport;
  confidence: number;
  bias: number;
  timeline: any[];
  filePatterns: any;
  gitHistory: any[];
  healthTrends: any[];
  enrichedCommits: EnrichedCommit[];
  adHocActions: AdHocAction[];
  enginePatterns: any[];
  engineCorrelations: any[];
  engineForecasts: any[];
  anomalies: any[];
  projectContext: ProjectContext;
  detectedProject?: { name: string; description?: string; structure?: string };
  codeState: CodeState;
  bootstrap: any | null;
  generated: string;
  deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  generatedTimestamp: Date;
  metadata: SnapshotMetadata;
}
```

#### SnapshotDataAssembler Flow

```typescript
private async buildSnapshotData(deviationMode): Promise<SnapshotData> {
  // 1. Load persistent state files
  const plan = this.normalizePlan(this.planParser.parsePlan());
  const tasks = this.normalizeTasks(this.planParser.parseTasks());
  const context = this.normalizeContext(this.planParser.parseContext());
  
  // 2. Load compressed historical summary (if profile allows)
  const historySummary = profile.sections.historySummary
    ? await this.normalizeHistory(await this.historySummarizer.summarize(30))
    : null;
  
  // 3. Calculate bias and confidence
  const biasReport = await this.biasCalculator.calculateBias(biasMode);
  const confidence = plan ? this.planParser.calculateConfidence(plan, workspaceReality) : 0.5;
  
  // 4. Load blind spot data (according to profile)
  const timeline = this.normalizeTimeline(this.blindSpotLoader.loadTimeline(timelinePeriod));
  const filePatterns = this.normalizeFilePatterns(this.blindSpotLoader.loadFilePatterns(timelinePeriod));
  const gitHistory = this.normalizeGitHistory(this.blindSpotLoader.loadGitHistory(10));
  const healthTrends = this.normalizeHealthTrends(this.blindSpotLoader.loadHealthTrends(timelinePeriod));
  
  // 5. Enrich commits with ADR detection signals
  const enrichedCommits = this.normalizeEnrichedCommits(await this.adrEnricher.enrichCommits(24));
  
  // 6. Detect ad-hoc actions
  const adHocActions = this.normalizeAdHocActions(this.adHocTracker.detectAdHocActions(120));
  
  // 7. Load engine-generated data
  const enginePatterns = this.normalizePatterns(this.loadEnginePatterns());
  const engineCorrelations = this.normalizeCorrelations(this.loadEngineCorrelations());
  const engineForecasts = this.normalizeForecasts(this.loadEngineForecasts());
  
  // 8. Detect anomalies
  const anomalies = this.normalizeAnomalies(
    await this.anomalyDetector.detectAnomalies(workspaceContext),
    profile.sections.anomalies
  );
  
  // 9. Analyze project context
  const projectContext = await this.projectAnalyzer.analyze();
  const detectedProject = await projectDetector.detect();
  const codeState = await this.codeStateAnalyzer.analyze(goals);
  
  // 10. Build metadata
  const metadata = await this.buildMetadata(deviationMode, plan, tasks, context);
  
  // 11. Assemble SnapshotData
  return { /* ... */ };
}
```

#### Normalization Rules

Each data source is normalized to ensure consistency:

- **Arrays:** Always converted to arrays (empty array if null)
- **Timestamps:** ISO 8601 format
- **Hashes:** SHA-256 hex strings
- **Metadata:** Kernel cycle, Merkle root, data hashes

#### Safe Defaults

If any critical error occurs during snapshot assembly, safe defaults are returned:

```typescript
private getSafeDefaults(): SnapshotData {
  return {
    plan: null,
    tasks: null,
    context: null,
    // ... safe defaults for all fields
    metadata: {
      kernelCycle: 0,
      merkleRoot: '',
      kernelFlags: { safeMode: false, ready: false },
      deviationMode: 'flexible',
      compressionRatio: 0,
      dataHashes: { plan: null, tasks: null, context: null, ledger: null },
      anomalies: [],
      compression: { originalSize: 0, optimizedSize: 0, reductionPercent: 0, mode: 'flexible' }
    }
  };
}
```

### BlindSpotDataLoader

**Location:** `extension/kernel/api/BlindSpotDataLoader.ts`  
**Purpose:** Load RL4 data that fills agent LLM blind spots

#### Blind Spots Addressed

1. **Timeline:** When did each change happen?
2. **File Patterns:** Bursts (debugging), gaps (blockers)
3. **Intent History:** What was the developer trying to do?
4. **System Health Trends:** Performance degradation over time
5. **Decision Trail:** What decisions were made historically?

#### Data Sources

- **Timeline:** `ledger/cycles.jsonl` (cycle timestamps)
- **File Patterns:** `traces/file_changes.jsonl` (burst/gap analysis)
- **Git History:** `traces/git_commits.jsonl` (commit analysis)
- **Health Trends:** `diagnostics/health.jsonl` (memory, event loop lag)
- **ADRs:** `adrs/active.json` (decision history)

#### Burst Analysis

```typescript
interface BurstAnalysis {
  bursts: Array<{
    file: string;
    editCount: number;
    timespan: string;
    startTime: string;
    endTime: string;
    inference: string; // "Likely debugging" or "Rapid iteration"
  }>;
  gaps: Array<{
    duration: string;
    startTime: string;
    endTime: string;
    inference: string; // "Break" or "Potential blocker"
  }>;
}
```

---

## Prompt System

### Prompt Profiles

**Location:** `extension/kernel/api/UnifiedPromptBuilder.ts` (lines 135-220)

#### Profile Configuration

```typescript
interface PromptProfile {
  mode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  includeTasks: { P0: boolean; P1: boolean; P2: boolean; completed: boolean };
  sections: {
    plan: boolean;
    tasks: boolean;
    context: 'minimal' | 'rich' | 'complete';
    timeline: false | 'condensed' | 'complete' | 'extended';
    blindSpot: false | 'selective' | 'complete' | 'extended';
    engineData: 'minimal' | 'complete';
    anomalies: 'critical' | 'medium,critical' | 'all';
    historySummary: boolean;
    bootstrap: boolean;
  };
  compression: 'aggressive' | 'moderate' | 'minimal' | 'none';
  rules: { threshold: number; suppressRedundancy: boolean; focusP0: boolean };
}
```

#### Strict Mode (0% threshold)

**Purpose:** Execution Guardian — Reject all new ideas, P0 only

- **Tasks:** P0 only
- **Context:** Minimal
- **Timeline:** None
- **Blind Spot:** None
- **Engine Data:** Minimal
- **Anomalies:** Critical only
- **Compression:** Aggressive
- **Rules:** Focus P0, suppress redundancy

#### Flexible Mode (25% threshold)

**Purpose:** Pragmatic Manager — P0+P1, small improvements OK

- **Tasks:** P0 + P1
- **Context:** Rich
- **Timeline:** Condensed (1h)
- **Blind Spot:** Selective
- **Engine Data:** Complete
- **Anomalies:** Medium + Critical
- **Compression:** Moderate
- **Rules:** Suppress redundancy, no P0 focus

#### Exploratory Mode (50% threshold)

**Purpose:** Innovation Consultant — 5-10 optimizations with code

- **Tasks:** P0 + P1 + P2
- **Context:** Complete
- **Timeline:** Complete (2h)
- **Blind Spot:** Complete
- **Engine Data:** Complete
- **Anomalies:** All
- **Compression:** Minimal
- **Rules:** No suppression, no P0 focus

#### Free Mode (100% threshold)

**Purpose:** Visionary Disruptor — 10+ transformative ideas

- **Tasks:** P0 + P1 + P2 + Completed
- **Context:** Complete
- **Timeline:** Extended (24h)
- **Blind Spot:** Extended
- **Engine Data:** Complete
- **Anomalies:** All
- **History Summary:** Yes
- **Compression:** None
- **Rules:** No restrictions

#### FirstUse Mode

**Purpose:** Deep Discovery — Complete bootstrap, full detection

- **Tasks:** P0 + P1 + P2
- **Context:** Complete
- **Timeline:** Complete
- **Blind Spot:** Complete
- **Engine Data:** Complete
- **Anomalies:** All
- **Bootstrap:** Yes (read-only)
- **Compression:** Minimal

### formatPrompt() Template

**Location:** `extension/kernel/api/UnifiedPromptBuilder.ts` (lines 2570-3107)

#### Template Structure

1. **Header**
   - Project name, generation timestamp, mode, confidence, bias
   - Kernel cycle, Merkle root, uncommitted files
   - Section minimap

2. **Critical Rules**
   - Mode-specific rules (strict/flexible/exploratory/free)
   - Bias threshold warnings
   - File modification restrictions

3. **Chat Memory**
   - Prioritization hierarchy (chat > Tasks > Plan > Snapshot)
   - Real-time user intent reminder

4. **Plan Section**
   - Strategic intent, phase, goal, timeline

5. **Tasks Section**
   - Active tasks (filtered by priority)
   - Completed tasks (if profile allows)

6. **Context Section**
   - KPIs (cognitive load, next steps, plan drift, risks)
   - Agent observations

7. **Timeline Section** (if profile allows)
   - Cycle timestamps
   - Recent activity timeline

8. **Blind Spot Section** (if profile allows)
   - File patterns (bursts, gaps)
   - Git history
   - Health trends

9. **Engine-Generated Data** (if profile allows)
   - Patterns
   - Correlations
   - Forecasts

10. **Anomalies Section** (if profile allows)
    - Detected anomalies (filtered by severity)

11. **Agent Instructions**
    - Mode-specific instructions
    - RL4_PROPOSAL protocol (exploratory/free modes)
    - RL4_DECISION_REQUEST protocol (free mode)

#### Boundary Markers

```markdown
---
BEGIN RL4 SNAPSHOT
Generated: 2025-11-18T14:40:32.250Z
Mode: exploratory (threshold: 50%)
---

[Snapshot content]

---
END RL4 SNAPSHOT
```

---

## Compression System

### PromptOptimizer

**Location:** `extension/kernel/api/PromptOptimizer.ts`  
**Purpose:** Intelligent prompt compression preserving essential information

#### Compression Strategies

```typescript
private strategies: Record<CompressionMode, (prompt: string) => string> = {
  strict: this.compressAggressive.bind(this),
  flexible: this.compressModerate.bind(this),
  exploratory: this.compressMinimal.bind(this),
  free: this.compressNone.bind(this),
  firstUse: this.compressMinimal.bind(this)
};
```

#### Aggressive Compression (Strict Mode)

- **Keep:** Plan, Tasks, Context, KPIs, Agent Instructions, Engine-Generated Data
- **Remove:** Timeline, Blind Spot, History Summary, Bootstrap
- **Reduction:** ~60-80%

#### Moderate Compression (Flexible Mode)

- **Keep:** Plan, Tasks, Context, Timeline (condensed), Blind Spot (selective), Engine Data
- **Remove:** History Summary, Bootstrap
- **Reduction:** ~30-50%

#### Minimal Compression (Exploratory/FirstUse Mode)

- **Keep:** All sections
- **Remove:** Only obvious redundancy (duplicate lines)
- **Reduction:** ~5-15%

#### No Compression (Free Mode)

- **Keep:** All sections, no removal
- **Remove:** Only obvious redundancy (duplicate lines)
- **Reduction:** ~0-5%

#### Prompt Analysis

```typescript
interface PromptAnalysis {
  totalSize: number;
  sections: SectionInfo[];
  redundancy: number; // 0-1, higher = more redundant
  relevance: number; // 0-1, higher = more relevant
  compressionPotential: number; // Estimated compression ratio (0-1)
}
```

---

## WebView Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebView (React)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              App.tsx (Main Component)               │
│  │  - 4 Tabs: Control, Dev, Insights, About            │
│  │  - State management (useState hooks)                 │
│  │  - Message handlers (window.vscode.postMessage)      │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Message Handlers (messageHandlers.ts)        │
│  │  - snapshotGenerated                                 │
│  │  - proposalsUpdated                                   │
│  │  - patchPreview                                       │
│  │  - taskVerificationResults                            │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕ (VS Code API)
┌─────────────────────────────────────────────────────────────┐
│              Extension Host (extension.ts)                  │
│  - webviewPanel.webview.onDidReceiveMessage()              │
│  - Handlers: generateSnapshot, submitDecisions, etc.       │
└─────────────────────────────────────────────────────────────┘
```

### Control Tab

**Purpose:** Snapshot generation and GitHub integration

#### Features

- **Generate Snapshot Button**
  - Mode selection (strict/flexible/exploratory/free/firstUse)
  - Calls `generateSnapshot` handler
  - Displays loading state
  - Copies to clipboard automatically

- **Parse LLM Response Button**
  - Reads clipboard
  - Parses RL4_PROPOSAL JSON
  - Writes to proposals.json
  - Updates Dev Tab badge

- **GitHub Integration**
  - Commit with WHY
  - GitHub Discussions integration

### Dev Tab

**Purpose:** Proposal validation and task verification

#### Features

- **Proposed Tasks**
  - List from proposals.json
  - Accept/Reject buttons
  - Priority badges (P0/P1/P2)

- **Patch Preview**
  - Shows RL4_TASKS_PATCH diff
  - Bias check indicator
  - Apply Patch button

- **Task Verification**
  - "✅ Verified by RL4" badges
  - Confidence levels (HIGH/MEDIUM/LOW)
  - "Mark as Done" button

- **Anomalies Card**
  - Detected anomalies
  - Severity indicators
  - Recommendations

### Insights Tab

**Purpose:** KPI dashboard and analytics

#### Features

- **KPIs Dashboard**
  - Cognitive Load
  - Next Steps
  - Plan Drift
  - Risks

- **Anomalies Card**
  - All detected anomalies
  - Filter by severity

- **Compression Metrics**
  - Original size
  - Optimized size
  - Reduction percentage

### About Tab

**Purpose:** Extension information and version

#### Features

- **Version Info**
  - Extension version
  - Kernel version
  - Build date

- **Links**
  - Documentation
  - GitHub repository
  - Issue tracker

### Message Flow

#### WebView → Extension

```typescript
// Generate Snapshot
window.vscode.postMessage({
  type: 'generateSnapshot',
  deviationMode: 'exploratory'
});

// Submit Decisions
window.vscode.postMessage({
  type: 'submitDecisions',
  payload: { /* RL4_DECISION_REQUEST */ }
});

// Apply Patch
window.vscode.postMessage({
  type: 'applyPatch',
  payload: { /* RL4_TASKS_PATCH */ }
});
```

#### Extension → WebView

```typescript
// Snapshot Generated
webviewPanel.webview.postMessage({
  type: 'snapshotGenerated',
  payload: promptString
});

// Proposals Updated
webviewPanel.webview.postMessage({
  type: 'proposalsUpdated',
  payload: { count: 3, proposals: [...] }
});

// Patch Preview
webviewPanel.webview.postMessage({
  type: 'patchPreview',
  payload: { preview: '...', bias: 15 }
});
```

---

## Cursor Workflow

### End-to-End Flow

```
1. User generates snapshot (Exploratory mode)
   ↓
2. Snapshot copied to clipboard automatically
   ↓
3. User pastes in Cursor/Claude/ChatGPT
   ↓
4. LLM analyzes snapshot and returns RL4_PROPOSAL
   ↓
5. User copies LLM response
   ↓
6. User clicks "Parse LLM Response" in Control Tab
   ↓
7. Extension parses JSON → writes to proposals.json
   ↓
8. FileWatcher detects change → sends proposalsUpdated to WebView
   ↓
9. Dev Tab badge shows: "3 nouvelles propositions"
   ↓
10. User opens Dev Tab → sees proposal cards
   ↓
11. User accepts/rejects proposals
   ↓
12. If accepted → patch preview generated (RL4_TASKS_PATCH)
   ↓
13. User clicks "Apply Patch"
   ↓
14. Extension applies patch to Tasks.RL4 (with bias check)
   ↓
15. Decision logged to decisions.jsonl
   ↓
16. User executes task in RL4 Terminal
   ↓
17. TaskVerificationEngine verifies completion
   ↓
18. Dev Tab shows "✅ Verified by RL4" badge
   ↓
19. User clicks "Mark as Done"
   ↓
20. Task marked as completed in Tasks.RL4
```

### RL4_PROPOSAL Protocol

**Format:** JSON block in LLM response

```json
{
  "RL4_PROPOSAL": {
    "suggestedTasks": [
      {
        "id": "prop-001",
        "title": "Setup CI with GitHub Actions",
        "why": "Quality and automation improvement",
        "what": ["Create workflow file", "Configure node versions"],
        "effort": "6h",
        "roi": 8,
        "risk": "low",
        "bias": 5,
        "deps": [],
        "scope": "repo",
        "possibleDuplicateOf": "external-task-001"
      }
    ],
    "planContextUpdates": "Optional markdown proposed for Plan/Context"
  }
}
```

**Supported Parsing Formats:**

1. **Fenced JSON:**
   ```markdown
   ```json
   { "RL4_PROPOSAL": { ... } }
   ```
   ```

2. **RL4_PROPOSAL Block:**
   ```markdown
   RL4_PROPOSAL:
   { "RL4_PROPOSAL": { ... } }
   ```

3. **Raw JSON:**
   ```json
   { "RL4_PROPOSAL": { ... } }
   ```

4. **Mixed Format:**
   Any combination of the above

### RL4_DECISION_REQUEST Protocol

**Format:** JSON sent from WebView when user accepts/rejects proposals

```json
{
  "RL4_DECISION_REQUEST": {
    "accepted": [
      { "id": "prop-001", "priority": "P0" },
      { "id": "prop-002", "priority": "P1" }
    ],
    "rejected": [
      { "id": "prop-003", "reason": "Duplicate of existing task" }
    ]
  }
}
```

### RL4_TASKS_PATCH Protocol

**Format:** JSON patch for Tasks.RL4

```json
{
  "RL4_TASKS_PATCH": {
    "tasks": [
      {
        "action": "add",
        "priority": "P0",
        "task": "Setup CI with GitHub Actions",
        "metadata": {
          "@rl4:id": "prop-001",
          "@rl4:why": "Quality and automation improvement",
          "@rl4:effort": "6h",
          "@rl4:roi": 8
        }
      }
    ],
    "bias": 15,
    "threshold": 25,
    "safe": true
  }
}
```

**Bias Check:**
- Calculates bias impact: `(files_created × 5) + (files_modified × 2) + (lines_added ÷ 100)`
- Compares with mode threshold (strict: 0%, flexible: 25%, exploratory: 50%, free: 100%)
- Aborts if threshold exceeded

---

## ADRs

### ADR Lifecycle

#### 1. Proposal Generation

**Source:** ForecastEngine → ADRGeneratorV2

- Forecast with `decision_type: 'ADR_Proposal'` → ADR proposal
- Saved to `adrs/auto/` directory
- Status: `pending`
- Requires human validation

#### 2. Validation

**Command:** `reasoning.adr.validate` (VS Code command)

- Lists pending ADR proposals
- User can accept/reject
- Validation logged to `adrs/auto/validation_history.jsonl`

#### 3. Acceptance

**Action:** User accepts proposal

- Status changed to `accepted`
- ADR moved to `adrs/active.json`
- Added to ADRs.RL4 (if user chooses)
- Available in next snapshot

#### 4. Rejection

**Action:** User rejects proposal

- Status changed to `rejected`
- Validation notes stored
- Not included in future snapshots

### ADR Structure

```typescript
interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'deprecated' | 'superseded';
  createdAt: string;
  modifiedAt: string;
  author: string;
  context: string;
  decision: string;
  consequences: string;
  tags: string[];
  components: string[];
  relatedADRs: string[];
  evidenceIds: string[];
}
```

### ADR Parser

**Location:** `extension/kernel/api/ADRParser.ts`

**Purpose:** Parse ADRs.RL4 and append to ledger/adrs.jsonl

**Workflow:**
1. FileWatcher detects ADRs.RL4 change
2. ADRParser validates + parses
3. New ADR appended to ledger/adrs.jsonl
4. Next prompt includes new ADR (feedback loop closed)

**Validation:** Zod schema validation
- ID format: `adr-\d{3,}-`
- Required fields: title, status, date, author, context, decision, consequences

---

## Workspace Intelligence

### How RL4 Becomes Contextually Intelligent

#### 1. Project Detection

**Location:** `extension/kernel/detection/ProjectDetector.ts`

- Detects project type (Node.js, Python, Rust, etc.)
- Analyzes project structure
- Identifies tech stack

#### 2. Project Analysis

**Location:** `extension/kernel/api/ProjectAnalyzer.ts`

- Analyzes package.json, requirements.txt, Cargo.toml
- Detects dependencies
- Identifies build tools

#### 3. Code State Analysis

**Location:** `extension/kernel/api/CodeStateAnalyzer.ts`

- Analyzes code structure
- Detects hotspots (frequently changed files)
- Identifies technical debt

#### 4. Pattern Learning

- Learns from historical decisions
- Identifies recurrent patterns
- Builds workspace-specific intelligence

#### 5. Terminal Patterns Learning

**Location:** `extension/kernel/cognitive/TerminalPatternsLearner.ts`

- Learns command patterns per workspace
- Suggests `@rl4:completeWhen` conditions
- Detects anomalies (success rate drops, unusual durations)

### Workspace-Specific Data

All RL4 data is workspace-specific:

- `.reasoning_rl4/` directory per workspace
- Patterns learned per workspace
- Terminal patterns per workspace
- No cross-workspace data sharing

---

## Extensibility Guide

### Adding a New Engine

1. **Create Engine Class**

```typescript
// extension/kernel/cognitive/MyNewEngine.ts
export class MyNewEngine {
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }
  
  async analyze(): Promise<MyResult[]> {
    // Implementation
  }
}
```

2. **Integrate in CognitiveScheduler**

```typescript
// extension/kernel/CognitiveScheduler.ts
import { MyNewEngine } from './cognitive/MyNewEngine';

// In constructor
this.myNewEngine = new MyNewEngine(workspaceRoot);

// In runCycle()
const phaseResult = await this.runPhase('my-new-phase', async () => {
  return await this.myNewEngine.analyze();
});
```

3. **Add to Snapshot System**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
private loadMyNewEngineData(): any[] {
  // Load engine output
}

// In buildSnapshotData()
const myNewEngineData = this.normalizeMyNewEngineData(this.loadMyNewEngineData());
```

### Adding a New Prompt Profile

1. **Add Profile Configuration**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
private readonly profiles: Record<string, PromptProfile> = {
  // ... existing profiles
  myNewProfile: {
    mode: 'myNewProfile',
    includeTasks: { P0: true, P1: true, P2: false, completed: false },
    sections: {
      // ... configuration
    },
    compression: 'moderate',
    rules: { threshold: 0.30, suppressRedundancy: true, focusP0: false }
  }
};
```

2. **Add Format Method**

```typescript
private formatMyNewProfileMode(projectContext: ProjectContext, tasks: TasksData | null): string {
  // Format instructions for this profile
}
```

### Adding a New Blind Spot Data Source

1. **Add Loader Method**

```typescript
// extension/kernel/api/BlindSpotDataLoader.ts
loadMyNewData(period: TimelinePeriod): MyNewData[] {
  const filePath = path.join(this.basePath, 'my_new_data.jsonl');
  // Load and return data
}
```

2. **Integrate in Snapshot System**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
// In buildSnapshotData()
const myNewData = this.normalizeMyNewData(this.blindSpotLoader.loadMyNewData(timelinePeriod));
```

---

## Maintenance Guide

### Common Issues

#### 1. Cognitive Loop Inertia

**Symptom:** Cycles execute but engines return empty results (count: 0)

**Diagnosis:**
- Check `ledger/cycles.jsonl` for phase counts
- Verify engines have input data (patterns.json, correlations.json, etc.)
- Check engine logs for errors

**Solution:**
- Ensure engines have sufficient input data
- Check file permissions
- Verify JSONL file integrity

#### 2. Ledger Corruption

**Symptom:** SAFE MODE activated, cycles blocked

**Diagnosis:**
- Check `ledger/cycles.jsonl` for malformed JSON
- Verify Merkle root chain continuity
- Check disk space

**Solution:**
- Restore from backup (`cycles.jsonl.backup_safe`)
- Rebuild ledger genesis if necessary
- Verify disk space

#### 3. Memory Leaks

**Symptom:** Extension host memory grows continuously

**Diagnosis:**
- Check MemoryMonitor logs
- Verify disposables are cleaned up
- Check for orphaned timers

**Solution:**
- Ensure all event listeners are disposed
- Verify TimerRegistry cleanup
- Check ExecPool buffer limits

#### 4. Snapshot Generation Fails

**Symptom:** Snapshot generation throws error

**Diagnosis:**
- Check UnifiedPromptBuilder logs
- Verify all data sources are accessible
- Check file permissions

**Solution:**
- Ensure `.reasoning_rl4/` directory exists
- Verify file permissions
- Check for corrupted JSONL files

### Performance Optimization

#### 1. Reduce Cycle Frequency

**Production:** 2 hours (7200000ms)  
**Test:** 10 seconds (10000ms)

```json
// .reasoning_rl4/kernel_config.json
{
  "cognitive_cycle_interval_ms": 7200000,
  "TEST_MODE": false
}
```

#### 2. Enable JSONL Rotation

**Automatic:** After 10K lines  
**Compression:** .gz archives

#### 3. Limit Buffer Sizes

**ExecPool:** 1 KB max stdout/stderr  
**Console.log:** Rotation (max 100 logs)

### Backup Strategy

#### Critical Files

- `ledger/cycles.jsonl` (cycle history)
- `ledger/rbom_ledger.jsonl` (ADR ledger)
- `Plan.RL4`, `Tasks.RL4`, `Context.RL4` (state files)

#### Backup Frequency

- **Automatic:** Before major operations (ledger writes)
- **Manual:** Before major changes

#### Recovery

1. Restore from `.backup_safe` files
2. Verify Merkle root chain
3. Rebuild if necessary

---

## Conclusion

RL4 is a comprehensive cognitive operating system layer that provides AI agents with complete workspace context. This documentation covers all major components, systems, and workflows. For specific implementation details, refer to the source code in `extension/kernel/` and `extension/webview/`.

**Key Takeaways:**

1. **Kernel-Based Architecture:** Centralized cognitive engine with append-only ledger
2. **Profile-Based Snapshots:** Mode-specific prompt generation (strict/flexible/exploratory/free)
3. **Proposal Workflow:** LLM proposals → Validation → Patch application
4. **Task Verification:** Terminal event tracking → Auto-verification
5. **Workspace Intelligence:** Contextual learning per workspace

**Version:** 3.5.11  
**Status:** Production-Ready Kernel (P0-CORE Active)  
**Last Updated:** 2025-11-18


___

END ENGLISH VERSION

BEGIN FRENCH VERSION

# RL4 Bible — Complete Documentation

**Version:** 3.5.11  
**Last Updated:** 2025-11-18  
**Status:** Production-Ready Kernel (P0-CORE Active)

---

## Table of Contents

1. [Executive Overview](#executive-overview)
2. [Global Architecture Map](#global-architecture-map)
3. [Kernel System](#kernel-system)
4. [Ledger System](#ledger-system)
5. [Engines](#engines)
6. [Snapshot System](#snapshot-system)
7. [Prompt System](#prompt-system)
8. [Compression System](#compression-system)
9. [WebView Pipeline](#webview-pipeline)
10. [Cursor Workflow](#cursor-workflow)
11. [ADRs](#adrs)
12. [Workspace Intelligence](#workspace-intelligence)
13. [Extensibility Guide](#extensibility-guide)
14. [Maintenance Guide](#maintenance-guide)

---

## Executive Overview

### What is RL4?

RL4 (Reasoning Layer 4) is a **cognitive operating system layer** for VS Code that provides AI agents with complete workspace context through structured snapshots. It bridges the gap between what an AI agent can see (current files) and what it needs to know (historical context, decisions, patterns, intent).

### Core Purpose

RL4 solves the **context blindness problem** for AI coding assistants:

- **Without RL4:** AI agents see only current files, missing historical context, decisions, patterns, and developer intent.
- **With RL4:** AI agents receive comprehensive snapshots containing Plan, Tasks, Context, ADRs, timeline, blind spot data, and engine-generated insights.

### Key Capabilities

1. **Context Snapshot Generation:** Unified prompts combining 15+ data sources
2. **Cognitive Cycle Execution:** Pattern learning → Correlation → Forecasting → ADR synthesis
3. **Ledger System:** Append-only RBOM ledger with Merkle root verification
4. **Blind Spot Detection:** Timeline, file patterns, git history, health trends
5. **Proposal Workflow:** LLM proposals → Validation → Patch application
6. **Task Verification:** Terminal event tracking → Auto-verification → Mark as done

### Architecture Philosophy

RL4 follows a **kernel-based architecture**:

- **Kernel:** Core cognitive engine (scheduler, ledger, engines)
- **Extension:** VS Code integration layer
- **WebView:** User interface (Control/Dev/Insights/About tabs)
- **Data Pipeline:** Snapshot generation → Clipboard → Cursor workflow

---

## Global Architecture Map

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    VS Code Extension                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Extension Host (extension.ts)           │
│  │  - Message handlers (WebView ↔ Extension)            │
│  │  - File watchers (Tasks.RL4, proposals.json)         │
│  │  - Terminal integration (RL4 Terminal)              │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WebView (React UI)                      │
│  │  - Control Tab (Snapshot generation)                │
│  │  - Dev Tab (Proposals, verification)                 │
│  │  - Insights Tab (KPIs, anomalies)                   │
│  │  - About Tab (Info)                                  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    RL4 Kernel                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         CognitiveScheduler (Master Orchestrator)     │
│  │  - Runs cognitive cycle every 10s (configurable)      │
│  │  - Phases: Pattern → Correlation → Forecast → ADR   │
│  │  - Idempotence (hash-based skip if no changes)       │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Cognitive Engines                        │
│  │  - PatternLearningEngine (analyzePatterns)           │
│  │  - CorrelationEngine (analyze)                      │
│  │  - ForecastEngine (generate)                         │
│  │  - ADRGeneratorV2 (generateProposals)                │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              RBOMLedger (Append-Only)                 │
│  │  - cycles.jsonl (cycle summaries)                     │
│  │  - rbom_ledger.jsonl (ADR entries)                    │
│  │  - Merkle root (chain integrity)                      │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│              .reasoning_rl4/ Data Store                    │
│  - Plan.RL4, Tasks.RL4, Context.RL4                        │
│  - ledger/ (cycles.jsonl, rbom_ledger.jsonl)               │
│  - traces/ (file_changes.jsonl, ide_activity.jsonl)         │
│  - patterns.json, correlations.json, forecasts.json        │
│  - proposals.json, terminal-events.jsonl                   │
└─────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
User Action (WebView)
  ↓
Extension Handler (extension.ts)
  ↓
UnifiedPromptBuilder.generate(mode)
  ↓
buildSnapshotData() → Aggregates 15+ data sources
  ↓
formatPrompt() → Applies profile (strict/flexible/exploratory/free)
  ↓
PromptOptimizer.optimize() → Compression
  ↓
AnomalyDetector.detectAnomalies() → Anomaly detection
  ↓
Return { prompt, metadata }
  ↓
WebView → Clipboard → Cursor
```

### Cognitive Cycle Flow

```
Timer Fires (every 10s in TEST_MODE, 2h in production)
  ↓
CognitiveScheduler.runCycle()
  ├── Check isRunning flag (skip if true)
  ├── Set isRunning = true
  ├── Calculate inputHash (for idempotence)
  ├── Skip if same hash as last cycle
  │
  ├── Phase 1: Pattern Learning
  │   ├── PatternLearningEngine.analyzePatterns()
  │   ├── Load ledger entries (internal + external)
  │   ├── Detect patterns (incident+feedback, refactor, migration, etc.)
  │   └── Save to patterns.json
  │
  ├── Phase 2: Correlation
  │   ├── CorrelationEngine.analyze()
  │   ├── Load patterns.json
  │   ├── Load recent events from traces
  │   ├── Compute correlation scores
  │   └── Save to correlations.json
  │
  ├── Phase 3: Forecasting
  │   ├── ForecastEngine.generate()
  │   ├── Load patterns + correlations
  │   ├── Match with market signals
  │   ├── Generate forecasts
  │   └── Save to forecasts.json
  │
  ├── Phase 4: ADR Synthesis
  │   ├── ADRGeneratorV2.generateProposals()
  │   ├── Load forecasts
  │   ├── Transform forecasts → ADR proposals
  │   └── Save to adrs/auto/
  │
  ├── Aggregate Results
  │   ├── Extract phase counts
  │   ├── Hash phase metrics
  │   └── ledger.appendCycle() → Write to cycles.jsonl
  │
  └── Set isRunning = false (guaranteed in finally block)
```

---

## Kernel System

### CognitiveScheduler

**Location:** `extension/kernel/CognitiveScheduler.ts`  
**Purpose:** Single master scheduler orchestrating the cognitive cycle

#### Key Features

- **Single Timer Ownership:** Prevents memory leaks from orphaned timers
- **Idempotence:** Hash-based skip if input unchanged
- **Phase Telemetry:** Tracks duration and success for each phase
- **Safe Mode:** Blocks execution if ledger corruption detected

#### Configuration

```typescript
// Default interval: 10 seconds (TEST_MODE)
// Production interval: 2 hours (7200000ms)
// Configurable via .reasoning_rl4/kernel_config.json
{
  "cognitive_cycle_interval_ms": 7200000,
  "TEST_MODE": false
}
```

#### Cycle Phases

1. **Pattern Learning** (`pattern-learning`)
   - Engine: `PatternLearningEngine`
   - Input: Ledger entries (internal + external)
   - Output: Decision patterns (patterns.json)
   - Duration: ~50-200ms

2. **Correlation** (`correlation`)
   - Engine: `CorrelationEngine`
   - Input: Patterns + recent events (traces)
   - Output: Correlations (correlations.json)
   - Duration: ~100-300ms

3. **Forecasting** (`forecasting`)
   - Engine: `ForecastEngine` (persistent instance)
   - Input: Patterns + correlations + market signals
   - Output: Forecasts (forecasts.json)
   - Duration: ~200-500ms

4. **ADR Synthesis** (`adr-synthesis`)
   - Engine: `ADRGeneratorV2`
   - Input: Forecasts
   - Output: ADR proposals (adrs/auto/)
   - Duration: ~100-300ms

#### Cycle Result Structure

```typescript
interface CycleResult {
  cycleId: number;
  startedAt: string;
  completedAt: string;
  duration: number;
  phases: PhaseResult[];
  inputHash: string; // For idempotence
  success: boolean;
}

interface PhaseResult {
  name: string;
  duration: number;
  success: boolean;
  metrics?: any;
  error?: string;
}
```

#### Safe Mode

**Trigger:** Ledger corruption detected on startup  
**Behavior:** Blocks `appendCycle()` calls, prevents extending corrupted chain  
**Recovery:** Manual ledger repair required

```typescript
// P1-INTEGRITY-02 PATCH 6: SAFE MODE implementation
if (this.safeMode) {
  throw new Error(`❌ RBOMLedger in SAFE MODE: Cannot append cycle. Reason: ${this.corruptionReason}`);
}
```

### Kernel Readiness Protocol

**Status:** P0-CORE-02 (Pending)  
**Goal:** Ensure kernel is fully initialized before WebView operations

#### Planned Implementation

```typescript
class KernelReadyProtocol {
  async init(): Promise<void> {
    // 1. Load artifacts (state.json.gz, universals.json.gz)
    // 2. Verify ledger integrity
    // 3. Initialize cognitive scheduler
    // 4. Set ready flag
  }
  
  async waitForKernelReady(): Promise<void> {
    // Poll until ready flag is true
  }
  
  get ready(): boolean {
    return this.readyFlag;
  }
}
```

### Kernel Status API

**Status:** P0-CORE-03 (Pending)  
**Goal:** Expose kernel status to WebView for observability

#### Planned Implementation

```typescript
class KernelStatusAPI {
  getStatus(): KernelStatus {
    return {
      cycleCount: scheduler.getCycleCount(),
      isRunning: scheduler.isRunning,
      lastCycleTime: scheduler.getLastCycleTime(),
      safeMode: ledger.getSafeMode(),
      merkleRoot: ledger.getMerkleRoot(),
      health: healthMonitor.getMetrics()
    };
  }
}
```

---

## Ledger System

### RBOMLedger

**Location:** `extension/kernel/RBOMLedger.ts`  
**Purpose:** Append-only RBOM ledger with Merkle verification

#### Key Features

- **Append-Only:** Immutable ledger (no rewrites)
- **Merkle Tree:** Chain integrity verification
- **Inter-Cycle Chaining:** Each cycle links to previous via `prevMerkleRoot`
- **Safe Mode:** Blocks writes if corruption detected

#### File Structure

```
.reasoning_rl4/ledger/
├── cycles.jsonl          # Cycle summaries (append-only)
├── rbom_ledger.jsonl     # RBOM entries (append-only)
└── ledger.jsonl          # Legacy ADR ledger (deprecated)
```

#### Cycle Summary Format

```json
{
  "cycleId": 721,
  "timestamp": "2025-11-18T14:40:32.250Z",
  "phases": {
    "patterns": { "hash": "abc123...", "count": 5 },
    "correlations": { "hash": "def456...", "count": 3 },
    "forecasts": { "hash": "ghi789...", "count": 2 },
    "adrs": { "hash": "jkl012...", "count": 1 }
  },
  "merkleRoot": "merkle_root_hash_here",
  "prevMerkleRoot": "previous_merkle_root_hash"
}
```

#### Merkle Root Computation

```typescript
// Merkle root computed from phase hashes ONLY (before cycle object construction)
const phaseHashes = [
  cycleData.phases.patterns.hash,
  cycleData.phases.correlations.hash,
  cycleData.phases.forecasts.hash,
  cycleData.phases.adrs.hash
].filter(h => h.length > 0);

const merkleRoot = this.computeRoot(phaseHashes);
```

**Critical:** Merkle root is computed from phase hashes **BEFORE** cycle object construction, preventing circular dependency.

#### Integrity Patches

**P1-INTEGRITY-02 PATCH 2:** Flush-before-cache-update with retry
- Ensures disk flush completes before cache update
- 3 retries with exponential backoff (100ms, 200ms, 400ms)

**P1-INTEGRITY-02 PATCH 5:** Partial write validator
- Validates last line of JSONL files before read
- Truncates to last valid newline on corruption detection

**P1-INTEGRITY-02 PATCH 6:** SAFE MODE on startup
- Deep verification on startup (`verifyChain({deep:true})`)
- Blocks `appendCycle()` if chain verification fails
- Corruption reason stored for diagnostics

#### Merkle Cache Initialization

**P0-HARDENING-02:** Eager load Merkle cache
- Cache initialized in constructor (non-blocking)
- Fallback to genesis if disk failure
- Prevents lazy-load surprise latency

```typescript
// Constructor: Eager load cache
this.initializeMerkleCache();

// Fallback to genesis if cache null
const prevMerkleRoot = this.lastCycleMerkleRoot || '0000000000000000'; // Genesis
```

---

## Engines

### PatternLearningEngine

**Location:** `extension/kernel/cognitive/PatternLearningEngine.ts`  
**Purpose:** Analyze ledger entries to extract recurrent decision patterns

#### Pattern Detection

1. **Incident + Feedback → Config Update ADR**
   - Detects: Incident ADR followed by feedback ADR
   - Pattern: Config updates after incidents

2. **Refactor Decisions → Reduced Incidents**
   - Detects: Refactor ADRs correlated with incident reduction
   - Pattern: Refactoring improves stability

3. **Market Trend → Tech Migration**
   - Detects: Market signals followed by migration ADRs
   - Pattern: External trends drive migrations

4. **Performance Issues → Cache Decisions**
   - Detects: Performance ADRs followed by cache ADRs
   - Pattern: Caching solves performance problems

5. **Compliance Requirements → Security ADRs**
   - Detects: Compliance ADRs followed by security ADRs
   - Pattern: Compliance drives security improvements

#### Auto-Learning

- Loads existing patterns (potentially improved by LLM)
- Builds upon existing patterns (no duplication)
- Applies diversity penalty to reduce thematic bias
- Preserves LLM improvements when saving

#### Output Format

```typescript
interface DecisionPattern {
  id: string;
  pattern: string;
  frequency: number;
  confidence: number;
  impact: string;
  tags: string[];
  lastSeen: string;
}
```

### CorrelationEngine

**Location:** `extension/kernel/cognitive/CorrelationEngine.ts`  
**Purpose:** Detect correlations between recent events and learned patterns

#### Correlation Types

1. **Confirming:** Event confirms pattern (high confidence)
2. **Diverging:** Event diverges from pattern (potential anomaly)
3. **Emerging:** New pattern emerging from events

#### Correlation Score Calculation

```typescript
// score = (semantic_similarity × 0.6) + (temporal_proximity × 0.3) + (impact_match × 0.1)
const semanticScore = this.cosineSimilarity(eventTags, patternTags);
const temporalScore = Math.exp(-daysDiff / 7); // Exponential decay over 7 days
const impactScore = (event.data?.impact === pattern.impact) ? 1 : 0;

const correlationScore = (semanticScore * 0.6) + (temporalScore * 0.3) + (impactScore * 0.1);
```

**Threshold:** 0.15 (lowered for RL4 traces with sparse tags)

#### Output Format

```typescript
interface Correlation {
  id: string;
  pattern_id: string;
  event_id: string;
  correlation_score: number;
  direction: 'confirming' | 'diverging' | 'emerging';
  tags: string[];
  impact: string;
  timestamp: string;
}
```

### ForecastEngine

**Location:** `extension/kernel/cognitive/ForecastEngine.ts`  
**Purpose:** Generate forecasts for future decisions, risks, and opportunities

#### Forecast Generation

1. **Load Patterns + Correlations**
   - Requires both patterns and correlations (returns [] if missing)

2. **Match Market Signals**
   - External signals enhance forecast confidence

3. **Calculate Confidence**
   - Based on pattern confidence, correlation score, and signal match

4. **Apply Category Diversity**
   - Limits forecasts per category (max 3) to reduce thematic bias

**Threshold:** 0.70 (increased from 0.65 for higher precision)

#### Forecast Metrics

```typescript
interface ForecastMetrics {
  forecast_precision: number;
  forecast_recall: number;
  total_forecasts: number;
  correct_forecasts: number;
  false_positives: number;
  false_negatives: number;
  last_evaluation: string;
  improvement_rate: number;
  baseline: {
    precision: number;
    established_at: string;
  };
}
```

#### Output Format

```typescript
interface Forecast {
  forecast_id: string;
  predicted_decision: string;
  confidence: number;
  rationale: string[];
  related_patterns: string[];
  decision_type: 'ADR_Proposal' | 'Risk' | 'Opportunity';
  timeframe: string;
  timestamp: string;
}
```

### ADRGeneratorV2

**Location:** `extension/kernel/cognitive/ADRGeneratorV2.ts`  
**Purpose:** Transform forecasts into actionable ADR proposals

#### Proposal Generation

1. **Load Forecasts**
   - Only processes `ADR_Proposal` forecast types

2. **Find Related Pattern**
   - Adds context from related pattern

3. **Create Proposal**
   - Transforms forecast → ADR proposal structure

4. **Deduplication**
   - Checks for duplicates before saving

#### Output Format

```typescript
interface ProposedADR extends ADR {
  autoGenerated: boolean;
  forecast_source: string;
  requires_human_validation: boolean;
  proposedAt: string;
  validationStatus: 'pending' | 'accepted' | 'rejected';
  validationNotes?: string;
  confidence: number;
}
```

#### Proposal Index

```typescript
interface ProposalIndex {
  generated_at: string;
  total_proposals: number;
  pending: string[];
  accepted: string[];
  rejected: string[];
  proposals: {
    id: string;
    title: string;
    confidence: number;
    status: 'pending' | 'accepted' | 'rejected';
    forecast_source: string;
    proposedAt: string;
  }[];
}
```

---

## Snapshot System

### UnifiedPromptBuilder

**Location:** `extension/kernel/api/UnifiedPromptBuilder.ts`  
**Purpose:** Single context snapshot generator combining all data sources

#### SnapshotData Structure

```typescript
interface SnapshotData {
  plan: PlanData | null;
  tasks: TasksData | null;
  context: ContextData | null;
  adrs: any[];
  historySummary: HistorySummary | null;
  biasReport: BiasReport;
  confidence: number;
  bias: number;
  timeline: any[];
  filePatterns: any;
  gitHistory: any[];
  healthTrends: any[];
  enrichedCommits: EnrichedCommit[];
  adHocActions: AdHocAction[];
  enginePatterns: any[];
  engineCorrelations: any[];
  engineForecasts: any[];
  anomalies: any[];
  projectContext: ProjectContext;
  detectedProject?: { name: string; description?: string; structure?: string };
  codeState: CodeState;
  bootstrap: any | null;
  generated: string;
  deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  generatedTimestamp: Date;
  metadata: SnapshotMetadata;
}
```

#### SnapshotDataAssembler Flow

```typescript
private async buildSnapshotData(deviationMode): Promise<SnapshotData> {
  // 1. Load persistent state files
  const plan = this.normalizePlan(this.planParser.parsePlan());
  const tasks = this.normalizeTasks(this.planParser.parseTasks());
  const context = this.normalizeContext(this.planParser.parseContext());
  
  // 2. Load compressed historical summary (if profile allows)
  const historySummary = profile.sections.historySummary
    ? await this.normalizeHistory(await this.historySummarizer.summarize(30))
    : null;
  
  // 3. Calculate bias and confidence
  const biasReport = await this.biasCalculator.calculateBias(biasMode);
  const confidence = plan ? this.planParser.calculateConfidence(plan, workspaceReality) : 0.5;
  
  // 4. Load blind spot data (according to profile)
  const timeline = this.normalizeTimeline(this.blindSpotLoader.loadTimeline(timelinePeriod));
  const filePatterns = this.normalizeFilePatterns(this.blindSpotLoader.loadFilePatterns(timelinePeriod));
  const gitHistory = this.normalizeGitHistory(this.blindSpotLoader.loadGitHistory(10));
  const healthTrends = this.normalizeHealthTrends(this.blindSpotLoader.loadHealthTrends(timelinePeriod));
  
  // 5. Enrich commits with ADR detection signals
  const enrichedCommits = this.normalizeEnrichedCommits(await this.adrEnricher.enrichCommits(24));
  
  // 6. Detect ad-hoc actions
  const adHocActions = this.normalizeAdHocActions(this.adHocTracker.detectAdHocActions(120));
  
  // 7. Load engine-generated data
  const enginePatterns = this.normalizePatterns(this.loadEnginePatterns());
  const engineCorrelations = this.normalizeCorrelations(this.loadEngineCorrelations());
  const engineForecasts = this.normalizeForecasts(this.loadEngineForecasts());
  
  // 8. Detect anomalies
  const anomalies = this.normalizeAnomalies(
    await this.anomalyDetector.detectAnomalies(workspaceContext),
    profile.sections.anomalies
  );
  
  // 9. Analyze project context
  const projectContext = await this.projectAnalyzer.analyze();
  const detectedProject = await projectDetector.detect();
  const codeState = await this.codeStateAnalyzer.analyze(goals);
  
  // 10. Build metadata
  const metadata = await this.buildMetadata(deviationMode, plan, tasks, context);
  
  // 11. Assemble SnapshotData
  return { /* ... */ };
}
```

#### Normalization Rules

Each data source is normalized to ensure consistency:

- **Arrays:** Always converted to arrays (empty array if null)
- **Timestamps:** ISO 8601 format
- **Hashes:** SHA-256 hex strings
- **Metadata:** Kernel cycle, Merkle root, data hashes

#### Safe Defaults

If any critical error occurs during snapshot assembly, safe defaults are returned:

```typescript
private getSafeDefaults(): SnapshotData {
  return {
    plan: null,
    tasks: null,
    context: null,
    // ... safe defaults for all fields
    metadata: {
      kernelCycle: 0,
      merkleRoot: '',
      kernelFlags: { safeMode: false, ready: false },
      deviationMode: 'flexible',
      compressionRatio: 0,
      dataHashes: { plan: null, tasks: null, context: null, ledger: null },
      anomalies: [],
      compression: { originalSize: 0, optimizedSize: 0, reductionPercent: 0, mode: 'flexible' }
    }
  };
}
```

### BlindSpotDataLoader

**Location:** `extension/kernel/api/BlindSpotDataLoader.ts`  
**Purpose:** Load RL4 data that fills agent LLM blind spots

#### Blind Spots Addressed

1. **Timeline:** When did each change happen?
2. **File Patterns:** Bursts (debugging), gaps (blockers)
3. **Intent History:** What was the developer trying to do?
4. **System Health Trends:** Performance degradation over time
5. **Decision Trail:** What decisions were made historically?

#### Data Sources

- **Timeline:** `ledger/cycles.jsonl` (cycle timestamps)
- **File Patterns:** `traces/file_changes.jsonl` (burst/gap analysis)
- **Git History:** `traces/git_commits.jsonl` (commit analysis)
- **Health Trends:** `diagnostics/health.jsonl` (memory, event loop lag)
- **ADRs:** `adrs/active.json` (decision history)

#### Burst Analysis

```typescript
interface BurstAnalysis {
  bursts: Array<{
    file: string;
    editCount: number;
    timespan: string;
    startTime: string;
    endTime: string;
    inference: string; // "Likely debugging" or "Rapid iteration"
  }>;
  gaps: Array<{
    duration: string;
    startTime: string;
    endTime: string;
    inference: string; // "Break" or "Potential blocker"
  }>;
}
```

---

## Prompt System

### Prompt Profiles

**Location:** `extension/kernel/api/UnifiedPromptBuilder.ts` (lines 135-220)

#### Profile Configuration

```typescript
interface PromptProfile {
  mode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  includeTasks: { P0: boolean; P1: boolean; P2: boolean; completed: boolean };
  sections: {
    plan: boolean;
    tasks: boolean;
    context: 'minimal' | 'rich' | 'complete';
    timeline: false | 'condensed' | 'complete' | 'extended';
    blindSpot: false | 'selective' | 'complete' | 'extended';
    engineData: 'minimal' | 'complete';
    anomalies: 'critical' | 'medium,critical' | 'all';
    historySummary: boolean;
    bootstrap: boolean;
  };
  compression: 'aggressive' | 'moderate' | 'minimal' | 'none';
  rules: { threshold: number; suppressRedundancy: boolean; focusP0: boolean };
}
```

#### Strict Mode (0% threshold)

**Purpose:** Execution Guardian — Reject all new ideas, P0 only

- **Tasks:** P0 only
- **Context:** Minimal
- **Timeline:** None
- **Blind Spot:** None
- **Engine Data:** Minimal
- **Anomalies:** Critical only
- **Compression:** Aggressive
- **Rules:** Focus P0, suppress redundancy

#### Flexible Mode (25% threshold)

**Purpose:** Pragmatic Manager — P0+P1, small improvements OK

- **Tasks:** P0 + P1
- **Context:** Rich
- **Timeline:** Condensed (1h)
- **Blind Spot:** Selective
- **Engine Data:** Complete
- **Anomalies:** Medium + Critical
- **Compression:** Moderate
- **Rules:** Suppress redundancy, no P0 focus

#### Exploratory Mode (50% threshold)

**Purpose:** Innovation Consultant — 5-10 optimizations with code

- **Tasks:** P0 + P1 + P2
- **Context:** Complete
- **Timeline:** Complete (2h)
- **Blind Spot:** Complete
- **Engine Data:** Complete
- **Anomalies:** All
- **Compression:** Minimal
- **Rules:** No suppression, no P0 focus

#### Free Mode (100% threshold)

**Purpose:** Visionary Disruptor — 10+ transformative ideas

- **Tasks:** P0 + P1 + P2 + Completed
- **Context:** Complete
- **Timeline:** Extended (24h)
- **Blind Spot:** Extended
- **Engine Data:** Complete
- **Anomalies:** All
- **History Summary:** Yes
- **Compression:** None
- **Rules:** No restrictions

#### FirstUse Mode

**Purpose:** Deep Discovery — Complete bootstrap, full detection

- **Tasks:** P0 + P1 + P2
- **Context:** Complete
- **Timeline:** Complete
- **Blind Spot:** Complete
- **Engine Data:** Complete
- **Anomalies:** All
- **Bootstrap:** Yes (read-only)
- **Compression:** Minimal

### formatPrompt() Template

**Location:** `extension/kernel/api/UnifiedPromptBuilder.ts` (lines 2570-3107)

#### Template Structure

1. **Header**
   - Project name, generation timestamp, mode, confidence, bias
   - Kernel cycle, Merkle root, uncommitted files
   - Section minimap

2. **Critical Rules**
   - Mode-specific rules (strict/flexible/exploratory/free)
   - Bias threshold warnings
   - File modification restrictions

3. **Chat Memory**
   - Prioritization hierarchy (chat > Tasks > Plan > Snapshot)
   - Real-time user intent reminder

4. **Plan Section**
   - Strategic intent, phase, goal, timeline

5. **Tasks Section**
   - Active tasks (filtered by priority)
   - Completed tasks (if profile allows)

6. **Context Section**
   - KPIs (cognitive load, next steps, plan drift, risks)
   - Agent observations

7. **Timeline Section** (if profile allows)
   - Cycle timestamps
   - Recent activity timeline

8. **Blind Spot Section** (if profile allows)
   - File patterns (bursts, gaps)
   - Git history
   - Health trends

9. **Engine-Generated Data** (if profile allows)
   - Patterns
   - Correlations
   - Forecasts

10. **Anomalies Section** (if profile allows)
    - Detected anomalies (filtered by severity)

11. **Agent Instructions**
    - Mode-specific instructions
    - RL4_PROPOSAL protocol (exploratory/free modes)
    - RL4_DECISION_REQUEST protocol (free mode)

#### Boundary Markers

```markdown
---
BEGIN RL4 SNAPSHOT
Generated: 2025-11-18T14:40:32.250Z
Mode: exploratory (threshold: 50%)
---

[Snapshot content]

---
END RL4 SNAPSHOT
```

---

## Compression System

### PromptOptimizer

**Location:** `extension/kernel/api/PromptOptimizer.ts`  
**Purpose:** Intelligent prompt compression preserving essential information

#### Compression Strategies

```typescript
private strategies: Record<CompressionMode, (prompt: string) => string> = {
  strict: this.compressAggressive.bind(this),
  flexible: this.compressModerate.bind(this),
  exploratory: this.compressMinimal.bind(this),
  free: this.compressNone.bind(this),
  firstUse: this.compressMinimal.bind(this)
};
```

#### Aggressive Compression (Strict Mode)

- **Keep:** Plan, Tasks, Context, KPIs, Agent Instructions, Engine-Generated Data
- **Remove:** Timeline, Blind Spot, History Summary, Bootstrap
- **Reduction:** ~60-80%

#### Moderate Compression (Flexible Mode)

- **Keep:** Plan, Tasks, Context, Timeline (condensed), Blind Spot (selective), Engine Data
- **Remove:** History Summary, Bootstrap
- **Reduction:** ~30-50%

#### Minimal Compression (Exploratory/FirstUse Mode)

- **Keep:** All sections
- **Remove:** Only obvious redundancy (duplicate lines)
- **Reduction:** ~5-15%

#### No Compression (Free Mode)

- **Keep:** All sections, no removal
- **Remove:** Only obvious redundancy (duplicate lines)
- **Reduction:** ~0-5%

#### Prompt Analysis

```typescript
interface PromptAnalysis {
  totalSize: number;
  sections: SectionInfo[];
  redundancy: number; // 0-1, higher = more redundant
  relevance: number; // 0-1, higher = more relevant
  compressionPotential: number; // Estimated compression ratio (0-1)
}
```

---

## WebView Pipeline

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebView (React)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              App.tsx (Main Component)               │
│  │  - 4 Tabs: Control, Dev, Insights, About            │
│  │  - State management (useState hooks)                 │
│  │  - Message handlers (window.vscode.postMessage)      │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Message Handlers (messageHandlers.ts)        │
│  │  - snapshotGenerated                                 │
│  │  - proposalsUpdated                                   │
│  │  - patchPreview                                       │
│  │  - taskVerificationResults                            │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕ (VS Code API)
┌─────────────────────────────────────────────────────────────┐
│              Extension Host (extension.ts)                  │
│  - webviewPanel.webview.onDidReceiveMessage()              │
│  - Handlers: generateSnapshot, submitDecisions, etc.       │
└─────────────────────────────────────────────────────────────┘
```

### Control Tab

**Purpose:** Snapshot generation and GitHub integration

#### Features

- **Generate Snapshot Button**
  - Mode selection (strict/flexible/exploratory/free/firstUse)
  - Calls `generateSnapshot` handler
  - Displays loading state
  - Copies to clipboard automatically

- **Parse LLM Response Button**
  - Reads clipboard
  - Parses RL4_PROPOSAL JSON
  - Writes to proposals.json
  - Updates Dev Tab badge

- **GitHub Integration**
  - Commit with WHY
  - GitHub Discussions integration

### Dev Tab

**Purpose:** Proposal validation and task verification

#### Features

- **Proposed Tasks**
  - List from proposals.json
  - Accept/Reject buttons
  - Priority badges (P0/P1/P2)

- **Patch Preview**
  - Shows RL4_TASKS_PATCH diff
  - Bias check indicator
  - Apply Patch button

- **Task Verification**
  - "✅ Verified by RL4" badges
  - Confidence levels (HIGH/MEDIUM/LOW)
  - "Mark as Done" button

- **Anomalies Card**
  - Detected anomalies
  - Severity indicators
  - Recommendations

### Insights Tab

**Purpose:** KPI dashboard and analytics

#### Features

- **KPIs Dashboard**
  - Cognitive Load
  - Next Steps
  - Plan Drift
  - Risks

- **Anomalies Card**
  - All detected anomalies
  - Filter by severity

- **Compression Metrics**
  - Original size
  - Optimized size
  - Reduction percentage

### About Tab

**Purpose:** Extension information and version

#### Features

- **Version Info**
  - Extension version
  - Kernel version
  - Build date

- **Links**
  - Documentation
  - GitHub repository
  - Issue tracker

### Message Flow

#### WebView → Extension

```typescript
// Generate Snapshot
window.vscode.postMessage({
  type: 'generateSnapshot',
  deviationMode: 'exploratory'
});

// Submit Decisions
window.vscode.postMessage({
  type: 'submitDecisions',
  payload: { /* RL4_DECISION_REQUEST */ }
});

// Apply Patch
window.vscode.postMessage({
  type: 'applyPatch',
  payload: { /* RL4_TASKS_PATCH */ }
});
```

#### Extension → WebView

```typescript
// Snapshot Generated
webviewPanel.webview.postMessage({
  type: 'snapshotGenerated',
  payload: promptString
});

// Proposals Updated
webviewPanel.webview.postMessage({
  type: 'proposalsUpdated',
  payload: { count: 3, proposals: [...] }
});

// Patch Preview
webviewPanel.webview.postMessage({
  type: 'patchPreview',
  payload: { preview: '...', bias: 15 }
});
```

---

## Cursor Workflow

### End-to-End Flow

```
1. User generates snapshot (Exploratory mode)
   ↓
2. Snapshot copied to clipboard automatically
   ↓
3. User pastes in Cursor/Claude/ChatGPT
   ↓
4. LLM analyzes snapshot and returns RL4_PROPOSAL
   ↓
5. User copies LLM response
   ↓
6. User clicks "Parse LLM Response" in Control Tab
   ↓
7. Extension parses JSON → writes to proposals.json
   ↓
8. FileWatcher detects change → sends proposalsUpdated to WebView
   ↓
9. Dev Tab badge shows: "3 nouvelles propositions"
   ↓
10. User opens Dev Tab → sees proposal cards
   ↓
11. User accepts/rejects proposals
   ↓
12. If accepted → patch preview generated (RL4_TASKS_PATCH)
   ↓
13. User clicks "Apply Patch"
   ↓
14. Extension applies patch to Tasks.RL4 (with bias check)
   ↓
15. Decision logged to decisions.jsonl
   ↓
16. User executes task in RL4 Terminal
   ↓
17. TaskVerificationEngine verifies completion
   ↓
18. Dev Tab shows "✅ Verified by RL4" badge
   ↓
19. User clicks "Mark as Done"
   ↓
20. Task marked as completed in Tasks.RL4
```

### RL4_PROPOSAL Protocol

**Format:** JSON block in LLM response

```json
{
  "RL4_PROPOSAL": {
    "suggestedTasks": [
      {
        "id": "prop-001",
        "title": "Setup CI with GitHub Actions",
        "why": "Quality and automation improvement",
        "what": ["Create workflow file", "Configure node versions"],
        "effort": "6h",
        "roi": 8,
        "risk": "low",
        "bias": 5,
        "deps": [],
        "scope": "repo",
        "possibleDuplicateOf": "external-task-001"
      }
    ],
    "planContextUpdates": "Optional markdown proposed for Plan/Context"
  }
}
```

**Supported Parsing Formats:**

1. **Fenced JSON:**
   ```markdown
   ```json
   { "RL4_PROPOSAL": { ... } }
   ```
   ```

2. **RL4_PROPOSAL Block:**
   ```markdown
   RL4_PROPOSAL:
   { "RL4_PROPOSAL": { ... } }
   ```

3. **Raw JSON:**
   ```json
   { "RL4_PROPOSAL": { ... } }
   ```

4. **Mixed Format:**
   Any combination of the above

### RL4_DECISION_REQUEST Protocol

**Format:** JSON sent from WebView when user accepts/rejects proposals

```json
{
  "RL4_DECISION_REQUEST": {
    "accepted": [
      { "id": "prop-001", "priority": "P0" },
      { "id": "prop-002", "priority": "P1" }
    ],
    "rejected": [
      { "id": "prop-003", "reason": "Duplicate of existing task" }
    ]
  }
}
```

### RL4_TASKS_PATCH Protocol

**Format:** JSON patch for Tasks.RL4

```json
{
  "RL4_TASKS_PATCH": {
    "tasks": [
      {
        "action": "add",
        "priority": "P0",
        "task": "Setup CI with GitHub Actions",
        "metadata": {
          "@rl4:id": "prop-001",
          "@rl4:why": "Quality and automation improvement",
          "@rl4:effort": "6h",
          "@rl4:roi": 8
        }
      }
    ],
    "bias": 15,
    "threshold": 25,
    "safe": true
  }
}
```

**Bias Check:**
- Calculates bias impact: `(files_created × 5) + (files_modified × 2) + (lines_added ÷ 100)`
- Compares with mode threshold (strict: 0%, flexible: 25%, exploratory: 50%, free: 100%)
- Aborts if threshold exceeded

---

## ADRs

### ADR Lifecycle

#### 1. Proposal Generation

**Source:** ForecastEngine → ADRGeneratorV2

- Forecast with `decision_type: 'ADR_Proposal'` → ADR proposal
- Saved to `adrs/auto/` directory
- Status: `pending`
- Requires human validation

#### 2. Validation

**Command:** `reasoning.adr.validate` (VS Code command)

- Lists pending ADR proposals
- User can accept/reject
- Validation logged to `adrs/auto/validation_history.jsonl`

#### 3. Acceptance

**Action:** User accepts proposal

- Status changed to `accepted`
- ADR moved to `adrs/active.json`
- Added to ADRs.RL4 (if user chooses)
- Available in next snapshot

#### 4. Rejection

**Action:** User rejects proposal

- Status changed to `rejected`
- Validation notes stored
- Not included in future snapshots

### ADR Structure

```typescript
interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'deprecated' | 'superseded';
  createdAt: string;
  modifiedAt: string;
  author: string;
  context: string;
  decision: string;
  consequences: string;
  tags: string[];
  components: string[];
  relatedADRs: string[];
  evidenceIds: string[];
}
```

### ADR Parser

**Location:** `extension/kernel/api/ADRParser.ts`

**Purpose:** Parse ADRs.RL4 and append to ledger/adrs.jsonl

**Workflow:**
1. FileWatcher detects ADRs.RL4 change
2. ADRParser validates + parses
3. New ADR appended to ledger/adrs.jsonl
4. Next prompt includes new ADR (feedback loop closed)

**Validation:** Zod schema validation
- ID format: `adr-\d{3,}-`
- Required fields: title, status, date, author, context, decision, consequences

---

## Workspace Intelligence

### How RL4 Becomes Contextually Intelligent

#### 1. Project Detection

**Location:** `extension/kernel/detection/ProjectDetector.ts`

- Detects project type (Node.js, Python, Rust, etc.)
- Analyzes project structure
- Identifies tech stack

#### 2. Project Analysis

**Location:** `extension/kernel/api/ProjectAnalyzer.ts`

- Analyzes package.json, requirements.txt, Cargo.toml
- Detects dependencies
- Identifies build tools

#### 3. Code State Analysis

**Location:** `extension/kernel/api/CodeStateAnalyzer.ts`

- Analyzes code structure
- Detects hotspots (frequently changed files)
- Identifies technical debt

#### 4. Pattern Learning

- Learns from historical decisions
- Identifies recurrent patterns
- Builds workspace-specific intelligence

#### 5. Terminal Patterns Learning

**Location:** `extension/kernel/cognitive/TerminalPatternsLearner.ts`

- Learns command patterns per workspace
- Suggests `@rl4:completeWhen` conditions
- Detects anomalies (success rate drops, unusual durations)

### Workspace-Specific Data

All RL4 data is workspace-specific:

- `.reasoning_rl4/` directory per workspace
- Patterns learned per workspace
- Terminal patterns per workspace
- No cross-workspace data sharing

---

## Extensibility Guide

### Adding a New Engine

1. **Create Engine Class**

```typescript
// extension/kernel/cognitive/MyNewEngine.ts
export class MyNewEngine {
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }
  
  async analyze(): Promise<MyResult[]> {
    // Implementation
  }
}
```

2. **Integrate in CognitiveScheduler**

```typescript
// extension/kernel/CognitiveScheduler.ts
import { MyNewEngine } from './cognitive/MyNewEngine';

// In constructor
this.myNewEngine = new MyNewEngine(workspaceRoot);

// In runCycle()
const phaseResult = await this.runPhase('my-new-phase', async () => {
  return await this.myNewEngine.analyze();
});
```

3. **Add to Snapshot System**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
private loadMyNewEngineData(): any[] {
  // Load engine output
}

// In buildSnapshotData()
const myNewEngineData = this.normalizeMyNewEngineData(this.loadMyNewEngineData());
```

### Adding a New Prompt Profile

1. **Add Profile Configuration**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
private readonly profiles: Record<string, PromptProfile> = {
  // ... existing profiles
  myNewProfile: {
    mode: 'myNewProfile',
    includeTasks: { P0: true, P1: true, P2: false, completed: false },
    sections: {
      // ... configuration
    },
    compression: 'moderate',
    rules: { threshold: 0.30, suppressRedundancy: true, focusP0: false }
  }
};
```

2. **Add Format Method**

```typescript
private formatMyNewProfileMode(projectContext: ProjectContext, tasks: TasksData | null): string {
  // Format instructions for this profile
}
```

### Adding a New Blind Spot Data Source

1. **Add Loader Method**

```typescript
// extension/kernel/api/BlindSpotDataLoader.ts
loadMyNewData(period: TimelinePeriod): MyNewData[] {
  const filePath = path.join(this.basePath, 'my_new_data.jsonl');
  // Load and return data
}
```

2. **Integrate in Snapshot System**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
// In buildSnapshotData()
const myNewData = this.normalizeMyNewData(this.blindSpotLoader.loadMyNewData(timelinePeriod));
```

---

## Maintenance Guide

### Common Issues

#### 1. Cognitive Loop Inertia

**Symptom:** Cycles execute but engines return empty results (count: 0)

**Diagnosis:**
- Check `ledger/cycles.jsonl` for phase counts
- Verify engines have input data (patterns.json, correlations.json, etc.)
- Check engine logs for errors

**Solution:**
- Ensure engines have sufficient input data
- Check file permissions
- Verify JSONL file integrity

#### 2. Ledger Corruption

**Symptom:** SAFE MODE activated, cycles blocked

**Diagnosis:**
- Check `ledger/cycles.jsonl` for malformed JSON
- Verify Merkle root chain continuity
- Check disk space

**Solution:**
- Restore from backup (`cycles.jsonl.backup_safe`)
- Rebuild ledger genesis if necessary
- Verify disk space

#### 3. Memory Leaks

**Symptom:** Extension host memory grows continuously

**Diagnosis:**
- Check MemoryMonitor logs
- Verify disposables are cleaned up
- Check for orphaned timers

**Solution:**
- Ensure all event listeners are disposed
- Verify TimerRegistry cleanup
- Check ExecPool buffer limits

#### 4. Snapshot Generation Fails

**Symptom:** Snapshot generation throws error

**Diagnosis:**
- Check UnifiedPromptBuilder logs
- Verify all data sources are accessible
- Check file permissions

**Solution:**
- Ensure `.reasoning_rl4/` directory exists
- Verify file permissions
- Check for corrupted JSONL files

### Performance Optimization

#### 1. Reduce Cycle Frequency

**Production:** 2 hours (7200000ms)  
**Test:** 10 seconds (10000ms)

```json
// .reasoning_rl4/kernel_config.json
{
  "cognitive_cycle_interval_ms": 7200000,
  "TEST_MODE": false
}
```

#### 2. Enable JSONL Rotation

**Automatic:** After 10K lines  
**Compression:** .gz archives

#### 3. Limit Buffer Sizes

**ExecPool:** 1 KB max stdout/stderr  
**Console.log:** Rotation (max 100 logs)

### Backup Strategy

#### Critical Files

- `ledger/cycles.jsonl` (cycle history)
- `ledger/rbom_ledger.jsonl` (ADR ledger)
- `Plan.RL4`, `Tasks.RL4`, `Context.RL4` (state files)

#### Backup Frequency

- **Automatic:** Before major operations (ledger writes)
- **Manual:** Before major changes

#### Recovery

1. Restore from `.backup_safe` files
2. Verify Merkle root chain
3. Rebuild if necessary

---

## Conclusion

RL4 is a comprehensive cognitive operating system layer that provides AI agents with complete workspace context. This documentation covers all major components, systems, and workflows. For specific implementation details, refer to the source code in `extension/kernel/` and `extension/webview/`.

**Key Takeaways:**

1. **Kernel-Based Architecture:** Centralized cognitive engine with append-only ledger
2. **Profile-Based Snapshots:** Mode-specific prompt generation (strict/flexible/exploratory/free)
3. **Proposal Workflow:** LLM proposals → Validation → Patch application
4. **Task Verification:** Terminal event tracking → Auto-verification
5. **Workspace Intelligence:** Contextual learning per workspace

**Version:** 3.5.11  
**Status:** Production-Ready Kernel (P0-CORE Active)  
**Last Updated:** 2025-11-18


___

END ENGLISH VERSION

BEGIN FRENCH VERSION

# RL4 Bible — Documentation Complète

**Version:** 3.5.11  
**Dernière mise à jour:** 2025-11-18  
**Statut:** Kernel Production-Ready (P0-CORE Actif)

---

## Table des matières

1. [Vue d'ensemble exécutive](#vue-densemble-exécutive)
2. [Carte d'architecture globale](#carte-darchitecture-globale)
3. [Système Kernel](#système-kernel)
4. [Système Ledger](#système-ledger)
5. [Engines](#engines)
6. [Système Snapshot](#système-snapshot)
7. [Système Prompt](#système-prompt)
8. [Système de compression](#système-de-compression)
9. [Pipeline WebView](#pipeline-webview)
10. [Workflow Cursor](#workflow-cursor)
11. [ADRs](#adrs)
12. [Intelligence Workspace](#intelligence-workspace)
13. [Guide d'extensibilité](#guide-dextensibilité)
14. [Guide de maintenance](#guide-de-maintenance)

---

## Vue d'ensemble exécutive

### Qu'est-ce que RL4 ?

RL4 (Reasoning Layer 4) est une **couche de système d'exploitation cognitive** pour VS Code qui fournit aux agents IA un contexte complet de workspace via des snapshots structurés. Il comble le fossé entre ce qu'un agent IA peut voir (fichiers actuels) et ce qu'il doit savoir (contexte historique, décisions, patterns, intention).

### Objectif principal

RL4 résout le **problème de cécité contextuelle** pour les assistants de codage IA :

- **Sans RL4 :** Les agents IA voient uniquement les fichiers actuels, manquant le contexte historique, les décisions, les patterns et l'intention du développeur.
- **Avec RL4 :** Les agents IA reçoivent des snapshots complets contenant Plan, Tasks, Context, ADRs, timeline, données blind spot, et insights générés par les engines.

### Capacités clés

1. **Génération de Snapshot Contextuel :** Prompts unifiés combinant 15+ sources de données
2. **Exécution de Cycle Cognitif :** Apprentissage de patterns → Corrélation → Prévision → Synthèse ADR
3. **Système Ledger :** Ledger RBOM append-only avec vérification Merkle root
4. **Détection Blind Spot :** Timeline, patterns de fichiers, historique git, tendances de santé
5. **Workflow de Propositions :** Propositions LLM → Validation → Application de patch
6. **Vérification de Tâches :** Suivi d'événements terminal → Auto-vérification → Marquer comme fait

### Philosophie d'architecture

RL4 suit une **architecture basée sur kernel** :

- **Kernel :** Moteur cognitif central (scheduler, ledger, engines)
- **Extension :** Couche d'intégration VS Code
- **WebView :** Interface utilisateur (onglets Control/Dev/Insights/About)
- **Pipeline de données :** Génération snapshot → Presse-papiers → Workflow Cursor

---

## Carte d'architecture globale

### Architecture haut niveau

```
┌─────────────────────────────────────────────────────────────┐
│                 Extension VS Code                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         Extension Host (extension.ts)                 │
│  │  - Gestionnaires de messages (WebView ↔ Extension)   │
│  │  - File watchers (Tasks.RL4, proposals.json)         │
│  │  - Intégration terminal (RL4 Terminal)               │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              WebView (React UI)                       │
│  │  - Control Tab (Génération snapshot)                 │
│  │  - Dev Tab (Propositions, vérification)              │
│  │  - Insights Tab (KPIs, anomalies)                    │
│  │  - About Tab (Info)                                  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│                    RL4 Kernel                               │
│  ┌──────────────────────────────────────────────────────┐  │
│  │    CognitiveScheduler (Orchestrateur Principal)       │
│  │  - Exécute cycle cognitif toutes les 10s (configurable)│
│  │  - Phases: Pattern → Correlation → Forecast → ADR     │
│  │  - Idempotence (skip basé sur hash si pas de changements)│
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              Engines Cognitifs                        │
│  │  - PatternLearningEngine (analyzePatterns)            │
│  │  - CorrelationEngine (analyze)                       │
│  │  - ForecastEngine (generate)                         │
│  │  - ADRGeneratorV2 (generateProposals)                │
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │              RBOMLedger (Append-Only)                 │
│  │  - cycles.jsonl (résumés de cycles)                  │
│  │  - rbom_ledger.jsonl (entrées ADR)                   │
│  │  - Merkle root (intégrité de chaîne)                 │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│          .reasoning_rl4/ Data Store                        │
│  - Plan.RL4, Tasks.RL4, Context.RL4                        │
│  - ledger/ (cycles.jsonl, rbom_ledger.jsonl)               │
│  - traces/ (file_changes.jsonl, ide_activity.jsonl)       │
│  - patterns.json, correlations.json, forecasts.json        │
│  - proposals.json, terminal-events.jsonl                   │
└─────────────────────────────────────────────────────────────┘
```

### Flux d'interaction des composants

```
Action Utilisateur (WebView)
  ↓
Gestionnaire Extension (extension.ts)
  ↓
UnifiedPromptBuilder.generate(mode)
  ↓
buildSnapshotData() → Agrège 15+ sources de données
  ↓
formatPrompt() → Applique profil (strict/flexible/exploratory/free)
  ↓
PromptOptimizer.optimize() → Compression
  ↓
AnomalyDetector.detectAnomalies() → Détection d'anomalies
  ↓
Retourne { prompt, metadata }
  ↓
WebView → Presse-papiers → Cursor
```

### Flux du cycle cognitif

```
Timer se déclenche (toutes les 10s en TEST_MODE, 2h en production)
  ↓
CognitiveScheduler.runCycle()
  ├── Vérifie flag isRunning (skip si true)
  ├── Définit isRunning = true
  ├── Calcule inputHash (pour idempotence)
  ├── Skip si même hash que dernier cycle
  │
  ├── Phase 1: Apprentissage de Patterns
  │   ├── PatternLearningEngine.analyzePatterns()
  │   ├── Charge entrées ledger (interne + externe)
  │   ├── Détecte patterns (incident+feedback, refactor, migration, etc.)
  │   └── Sauvegarde dans patterns.json
  │
  ├── Phase 2: Corrélation
  │   ├── CorrelationEngine.analyze()
  │   ├── Charge patterns.json
  │   ├── Charge événements récents depuis traces
  │   ├── Calcule scores de corrélation
  │   └── Sauvegarde dans correlations.json
  │
  ├── Phase 3: Prévision
  │   ├── ForecastEngine.generate()
  │   ├── Charge patterns + correlations
  │   ├── Match avec signaux marché
  │   ├── Génère prévisions
  │   └── Sauvegarde dans forecasts.json
  │
  ├── Phase 4: Synthèse ADR
  │   ├── ADRGeneratorV2.generateProposals()
  │   ├── Charge forecasts
  │   ├── Transforme forecasts → propositions ADR
  │   └── Sauvegarde dans adrs/auto/
  │
  ├── Agrège Résultats
  │   ├── Extrait compteurs de phases
  │   ├── Hash métriques de phases
  │   └── ledger.appendCycle() → Écrit dans cycles.jsonl
  │
  └── Définit isRunning = false (garanti dans bloc finally)
```

---

## Système Kernel

### CognitiveScheduler

**Emplacement :** `extension/kernel/CognitiveScheduler.ts`  
**Objectif :** Scheduler maître unique orchestrant le cycle cognitif

#### Caractéristiques clés

- **Propriété Timer Unique :** Empêche les fuites mémoire des timers orphelins
- **Idempotence :** Skip basé sur hash si entrée inchangée
- **Télémétrie de Phase :** Suit durée et succès pour chaque phase
- **Mode Sécurisé :** Bloque l'exécution si corruption ledger détectée

#### Configuration

```typescript
// Intervalle par défaut: 10 secondes (TEST_MODE)
// Intervalle production: 2 heures (7200000ms)
// Configurable via .reasoning_rl4/kernel_config.json
{
  "cognitive_cycle_interval_ms": 7200000,
  "TEST_MODE": false
}
```

#### Phases du cycle

1. **Apprentissage de Patterns** (`pattern-learning`)
   - Engine: `PatternLearningEngine`
   - Entrée: Entrées ledger (interne + externe)
   - Sortie: Patterns de décision (patterns.json)
   - Durée: ~50-200ms

2. **Corrélation** (`correlation`)
   - Engine: `CorrelationEngine`
   - Entrée: Patterns + événements récents (traces)
   - Sortie: Corrélations (correlations.json)
   - Durée: ~100-300ms

3. **Prévision** (`forecasting`)
   - Engine: `ForecastEngine` (instance persistante)
   - Entrée: Patterns + correlations + signaux marché
   - Sortie: Prévisions (forecasts.json)
   - Durée: ~200-500ms

4. **Synthèse ADR** (`adr-synthesis`)
   - Engine: `ADRGeneratorV2`
   - Entrée: Forecasts
   - Sortie: Propositions ADR (adrs/auto/)
   - Durée: ~100-300ms

#### Structure du résultat de cycle

```typescript
interface CycleResult {
  cycleId: number;
  startedAt: string;
  completedAt: string;
  duration: number;
  phases: PhaseResult[];
  inputHash: string; // Pour idempotence
  success: boolean;
}

interface PhaseResult {
  name: string;
  duration: number;
  success: boolean;
  metrics?: any;
  error?: string;
}
```

#### Mode Sécurisé

**Déclencheur :** Corruption ledger détectée au démarrage  
**Comportement :** Bloque les appels `appendCycle()`, empêche d'étendre la chaîne corrompue  
**Récupération :** Réparation manuelle du ledger requise

```typescript
// P1-INTEGRITY-02 PATCH 6: Implémentation SAFE MODE
if (this.safeMode) {
  throw new Error(`❌ RBOMLedger en SAFE MODE: Impossible d'ajouter un cycle. Raison: ${this.corruptionReason}`);
}
```

### Protocole de préparation du kernel

**Statut :** P0-CORE-02 (En attente)  
**Objectif :** S'assurer que le kernel est complètement initialisé avant les opérations WebView

#### Implémentation prévue

```typescript
class KernelReadyProtocol {
  async init(): Promise<void> {
    // 1. Charger artifacts (state.json.gz, universals.json.gz)
    // 2. Vérifier intégrité ledger
    // 3. Initialiser cognitive scheduler
    // 4. Définir flag ready
  }
  
  async waitForKernelReady(): Promise<void> {
    // Poller jusqu'à ce que flag ready soit true
  }
  
  get ready(): boolean {
    return this.readyFlag;
  }
}
```

### API de statut du kernel

**Statut :** P0-CORE-03 (En attente)  
**Objectif :** Exposer le statut du kernel à WebView pour observabilité

#### Implémentation prévue

```typescript
class KernelStatusAPI {
  getStatus(): KernelStatus {
    return {
      cycleCount: scheduler.getCycleCount(),
      isRunning: scheduler.isRunning,
      lastCycleTime: scheduler.getLastCycleTime(),
      safeMode: ledger.getSafeMode(),
      merkleRoot: ledger.getMerkleRoot(),
      health: healthMonitor.getMetrics()
    };
  }
}
```

---

## Système Ledger

### RBOMLedger

**Emplacement :** `extension/kernel/RBOMLedger.ts`  
**Objectif :** Ledger RBOM append-only avec vérification Merkle

#### Caractéristiques clés

- **Append-Only :** Ledger immuable (pas de réécritures)
- **Arbre Merkle :** Vérification d'intégrité de chaîne
- **Chaînage Inter-Cycle :** Chaque cycle lie au précédent via `prevMerkleRoot`
- **Mode Sécurisé :** Bloque les écritures si corruption détectée

#### Structure de fichiers

```
.reasoning_rl4/ledger/
├── cycles.jsonl          # Résumés de cycles (append-only)
├── rbom_ledger.jsonl     # Entrées RBOM (append-only)
└── ledger.jsonl          # Ledger ADR legacy (déprécié)
```

#### Format de résumé de cycle

```json
{
  "cycleId": 721,
  "timestamp": "2025-11-18T14:40:32.250Z",
  "phases": {
    "patterns": { "hash": "abc123...", "count": 5 },
    "correlations": { "hash": "def456...", "count": 3 },
    "forecasts": { "hash": "ghi789...", "count": 2 },
    "adrs": { "hash": "jkl012...", "count": 1 }
  },
  "merkleRoot": "merkle_root_hash_here",
  "prevMerkleRoot": "previous_merkle_root_hash"
}
```

#### Calcul de Merkle Root

```typescript
// Merkle root calculé depuis les hashes de phases UNIQUEMENT (avant construction objet cycle)
const phaseHashes = [
  cycleData.phases.patterns.hash,
  cycleData.phases.correlations.hash,
  cycleData.phases.forecasts.hash,
  cycleData.phases.adrs.hash
].filter(h => h.length > 0);

const merkleRoot = this.computeRoot(phaseHashes);
```

**Critique :** Le Merkle root est calculé depuis les hashes de phases **AVANT** la construction de l'objet cycle, empêchant la dépendance circulaire.

#### Correctifs d'intégrité

**P1-INTEGRITY-02 PATCH 2 :** Flush-avant-mise-à-jour-cache avec retry
- Assure que le flush disque se termine avant mise à jour cache
- 3 tentatives avec backoff exponentiel (100ms, 200ms, 400ms)

**P1-INTEGRITY-02 PATCH 5 :** Validateur d'écriture partielle
- Valide la dernière ligne des fichiers JSONL avant lecture
- Tronque à la dernière nouvelle ligne valide en cas de détection de corruption

**P1-INTEGRITY-02 PATCH 6 :** SAFE MODE au démarrage
- Vérification approfondie au démarrage (`verifyChain({deep:true})`)
- Bloque `appendCycle()` si vérification de chaîne échoue
- Raison de corruption stockée pour diagnostics

#### Initialisation du cache Merkle

**P0-HARDENING-02 :** Chargement anticipé du cache Merkle
- Cache initialisé dans constructeur (non-bloquant)
- Fallback vers genesis si échec disque
- Empêche latence surprise de lazy-load

```typescript
// Constructeur: Chargement anticipé cache
this.initializeMerkleCache();

// Fallback vers genesis si cache null
const prevMerkleRoot = this.lastCycleMerkleRoot || '0000000000000000'; // Genesis
```

---

## Engines

### PatternLearningEngine

**Emplacement :** `extension/kernel/cognitive/PatternLearningEngine.ts`  
**Objectif :** Analyser les entrées ledger pour extraire des patterns de décision récurrents

#### Détection de patterns

1. **Incident + Feedback → Mise à jour Config ADR**
   - Détecte: ADR Incident suivi d'ADR Feedback
   - Pattern: Mises à jour config après incidents

2. **Décisions Refactor → Réduction Incidents**
   - Détecte: ADRs Refactor corrélés avec réduction incidents
   - Pattern: Refactoring améliore stabilité

3. **Tendance Marché → Migration Tech**
   - Détecte: Signaux marché suivis d'ADRs migration
   - Pattern: Tendances externes poussent migrations

4. **Problèmes Performance → Décisions Cache**
   - Détecte: ADRs Performance suivis d'ADRs cache
   - Pattern: Cache résout problèmes performance

5. **Exigences Conformité → ADRs Sécurité**
   - Détecte: ADRs Conformité suivis d'ADRs sécurité
   - Pattern: Conformité pousse améliorations sécurité

#### Auto-apprentissage

- Charge patterns existants (potentiellement améliorés par LLM)
- Construit sur patterns existants (pas de duplication)
- Applique pénalité diversité pour réduire biais thématique
- Préserve améliorations LLM lors sauvegarde

#### Format de sortie

```typescript
interface DecisionPattern {
  id: string;
  pattern: string;
  frequency: number;
  confidence: number;
  impact: string;
  tags: string[];
  lastSeen: string;
}
```

### CorrelationEngine

**Emplacement :** `extension/kernel/cognitive/CorrelationEngine.ts`  
**Objectif :** Détecter corrélations entre événements récents et patterns appris

#### Types de corrélation

1. **Confirmant :** Événement confirme pattern (haute confiance)
2. **Divergent :** Événement diverge du pattern (anomalie potentielle)
3. **Émergent :** Nouveau pattern émergeant des événements

#### Calcul du score de corrélation

```typescript
// score = (similarité_sémantique × 0.6) + (proximité_temporelle × 0.3) + (match_impact × 0.1)
const semanticScore = this.cosineSimilarity(eventTags, patternTags);
const temporalScore = Math.exp(-daysDiff / 7); // Décroissance exponentielle sur 7 jours
const impactScore = (event.data?.impact === pattern.impact) ? 1 : 0;

const correlationScore = (semanticScore * 0.6) + (temporalScore * 0.3) + (impactScore * 0.1);
```

**Seuil :** 0.15 (abaissé pour traces RL4 avec tags épars)

#### Format de sortie

```typescript
interface Correlation {
  id: string;
  pattern_id: string;
  event_id: string;
  correlation_score: number;
  direction: 'confirming' | 'diverging' | 'emerging';
  tags: string[];
  impact: string;
  timestamp: string;
}
```

### ForecastEngine

**Emplacement :** `extension/kernel/cognitive/ForecastEngine.ts`  
**Objectif :** Générer prévisions pour décisions futures, risques et opportunités

#### Génération de prévisions

1. **Charger Patterns + Corrélations**
   - Requiert patterns et corrélations (retourne [] si manquant)

2. **Matcher Signaux Marché**
   - Signaux externes améliorent confiance prévision

3. **Calculer Confiance**
   - Basé sur confiance pattern, score corrélation et match signal

4. **Appliquer Diversité Catégorie**
   - Limite prévisions par catégorie (max 3) pour réduire biais thématique

**Seuil :** 0.70 (augmenté depuis 0.65 pour plus haute précision)

#### Métriques de prévision

```typescript
interface ForecastMetrics {
  forecast_precision: number;
  forecast_recall: number;
  total_forecasts: number;
  correct_forecasts: number;
  false_positives: number;
  false_negatives: number;
  last_evaluation: string;
  improvement_rate: number;
  baseline: {
    precision: number;
    established_at: string;
  };
}
```

#### Format de sortie

```typescript
interface Forecast {
  forecast_id: string;
  predicted_decision: string;
  confidence: number;
  rationale: string[];
  related_patterns: string[];
  decision_type: 'ADR_Proposal' | 'Risk' | 'Opportunity';
  timeframe: string;
  timestamp: string;
}
```

### ADRGeneratorV2

**Emplacement :** `extension/kernel/cognitive/ADRGeneratorV2.ts`  
**Objectif :** Transformer prévisions en propositions ADR actionnables

#### Génération de propositions

1. **Charger Forecasts**
   - Traite uniquement types forecast `ADR_Proposal`

2. **Trouver Pattern Associé**
   - Ajoute contexte depuis pattern associé

3. **Créer Proposition**
   - Transforme forecast → structure proposition ADR

4. **Déduplication**
   - Vérifie doublons avant sauvegarde

#### Format de sortie

```typescript
interface ProposedADR extends ADR {
  autoGenerated: boolean;
  forecast_source: string;
  requires_human_validation: boolean;
  proposedAt: string;
  validationStatus: 'pending' | 'accepted' | 'rejected';
  validationNotes?: string;
  confidence: number;
}
```

#### Index de propositions

```typescript
interface ProposalIndex {
  generated_at: string;
  total_proposals: number;
  pending: string[];
  accepted: string[];
  rejected: string[];
  proposals: {
    id: string;
    title: string;
    confidence: number;
    status: 'pending' | 'accepted' | 'rejected';
    forecast_source: string;
    proposedAt: string;
  }[];
}
```

---

## Système Snapshot

### UnifiedPromptBuilder

**Emplacement :** `extension/kernel/api/UnifiedPromptBuilder.ts`  
**Objectif :** Générateur de snapshot contextuel unique combinant toutes les sources de données

#### Structure SnapshotData

```typescript
interface SnapshotData {
  plan: PlanData | null;
  tasks: TasksData | null;
  context: ContextData | null;
  adrs: any[];
  historySummary: HistorySummary | null;
  biasReport: BiasReport;
  confidence: number;
  bias: number;
  timeline: any[];
  filePatterns: any;
  gitHistory: any[];
  healthTrends: any[];
  enrichedCommits: EnrichedCommit[];
  adHocActions: AdHocAction[];
  enginePatterns: any[];
  engineCorrelations: any[];
  engineForecasts: any[];
  anomalies: any[];
  projectContext: ProjectContext;
  detectedProject?: { name: string; description?: string; structure?: string };
  codeState: CodeState;
  bootstrap: any | null;
  generated: string;
  deviationMode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  generatedTimestamp: Date;
  metadata: SnapshotMetadata;
}
```

#### Flux SnapshotDataAssembler

```typescript
private async buildSnapshotData(deviationMode): Promise<SnapshotData> {
  // 1. Charger fichiers état persistants
  const plan = this.normalizePlan(this.planParser.parsePlan());
  const tasks = this.normalizeTasks(this.planParser.parseTasks());
  const context = this.normalizeContext(this.planParser.parseContext());
  
  // 2. Charger résumé historique compressé (si profil permet)
  const historySummary = profile.sections.historySummary
    ? await this.normalizeHistory(await this.historySummarizer.summarize(30))
    : null;
  
  // 3. Calculer bias et confiance
  const biasReport = await this.biasCalculator.calculateBias(biasMode);
  const confidence = plan ? this.planParser.calculateConfidence(plan, workspaceReality) : 0.5;
  
  // 4. Charger données blind spot (selon profil)
  const timeline = this.normalizeTimeline(this.blindSpotLoader.loadTimeline(timelinePeriod));
  const filePatterns = this.normalizeFilePatterns(this.blindSpotLoader.loadFilePatterns(timelinePeriod));
  const gitHistory = this.normalizeGitHistory(this.blindSpotLoader.loadGitHistory(10));
  const healthTrends = this.normalizeHealthTrends(this.blindSpotLoader.loadHealthTrends(timelinePeriod));
  
  // 5. Enrichir commits avec signaux détection ADR
  const enrichedCommits = this.normalizeEnrichedCommits(await this.adrEnricher.enrichCommits(24));
  
  // 6. Détecter actions ad-hoc
  const adHocActions = this.normalizeAdHocActions(this.adHocTracker.detectAdHocActions(120));
  
  // 7. Charger données générées par engines
  const enginePatterns = this.normalizePatterns(this.loadEnginePatterns());
  const engineCorrelations = this.normalizeCorrelations(this.loadEngineCorrelations());
  const engineForecasts = this.normalizeForecasts(this.loadEngineForecasts());
  
  // 8. Détecter anomalies
  const anomalies = this.normalizeAnomalies(
    await this.anomalyDetector.detectAnomalies(workspaceContext),
    profile.sections.anomalies
  );
  
  // 9. Analyser contexte projet
  const projectContext = await this.projectAnalyzer.analyze();
  const detectedProject = await projectDetector.detect();
  const codeState = await this.codeStateAnalyzer.analyze(goals);
  
  // 10. Construire metadata
  const metadata = await this.buildMetadata(deviationMode, plan, tasks, context);
  
  // 11. Assembler SnapshotData
  return { /* ... */ };
}
```

#### Règles de normalisation

Chaque source de données est normalisée pour assurer cohérence :

- **Arrays :** Toujours convertis en arrays (array vide si null)
- **Timestamps :** Format ISO 8601
- **Hashes :** Chaînes hex SHA-256
- **Metadata :** Cycle kernel, Merkle root, hashes de données

#### Valeurs par défaut sécurisées

Si erreur critique survient pendant assemblage snapshot, valeurs par défaut sécurisées retournées :

```typescript
private getSafeDefaults(): SnapshotData {
  return {
    plan: null,
    tasks: null,
    context: null,
    // ... valeurs par défaut pour tous les champs
    metadata: {
      kernelCycle: 0,
      merkleRoot: '',
      kernelFlags: { safeMode: false, ready: false },
      deviationMode: 'flexible',
      compressionRatio: 0,
      dataHashes: { plan: null, tasks: null, context: null, ledger: null },
      anomalies: [],
      compression: { originalSize: 0, optimizedSize: 0, reductionPercent: 0, mode: 'flexible' }
    }
  };
}
```

### BlindSpotDataLoader

**Emplacement :** `extension/kernel/api/BlindSpotDataLoader.ts`  
**Objectif :** Charger données RL4 qui comblent blind spots agents LLM

#### Blind Spots adressés

1. **Timeline :** Quand chaque changement s'est-il produit ?
2. **Patterns de fichiers :** Bursts (debugging), gaps (bloqueurs)
3. **Historique d'intention :** Que tentait de faire le développeur ?
4. **Tendances santé système :** Dégradation performance dans le temps
5. **Piste de décisions :** Quelles décisions ont été prises historiquement ?

#### Sources de données

- **Timeline :** `ledger/cycles.jsonl` (timestamps cycles)
- **Patterns de fichiers :** `traces/file_changes.jsonl` (analyse burst/gap)
- **Historique Git :** `traces/git_commits.jsonl` (analyse commits)
- **Tendances santé :** `diagnostics/health.jsonl` (mémoire, lag event loop)
- **ADRs :** `adrs/active.json` (historique décisions)

#### Analyse Burst

```typescript
interface BurstAnalysis {
  bursts: Array<{
    file: string;
    editCount: number;
    timespan: string;
    startTime: string;
    endTime: string;
    inference: string; // "Likely debugging" ou "Rapid iteration"
  }>;
  gaps: Array<{
    duration: string;
    startTime: string;
    endTime: string;
    inference: string; // "Break" ou "Potential blocker"
  }>;
}
```

---

## Système Prompt

### Profils Prompt

**Emplacement :** `extension/kernel/api/UnifiedPromptBuilder.ts` (lignes 135-220)

#### Configuration Profil

```typescript
interface PromptProfile {
  mode: 'strict' | 'flexible' | 'exploratory' | 'free' | 'firstUse';
  includeTasks: { P0: boolean; P1: boolean; P2: boolean; completed: boolean };
  sections: {
    plan: boolean;
    tasks: boolean;
    context: 'minimal' | 'rich' | 'complete';
    timeline: false | 'condensed' | 'complete' | 'extended';
    blindSpot: false | 'selective' | 'complete' | 'extended';
    engineData: 'minimal' | 'complete';
    anomalies: 'critical' | 'medium,critical' | 'all';
    historySummary: boolean;
    bootstrap: boolean;
  };
  compression: 'aggressive' | 'moderate' | 'minimal' | 'none';
  rules: { threshold: number; suppressRedundancy: boolean; focusP0: boolean };
}
```

#### Mode Strict (seuil 0%)

**Objectif :** Gardien d'exécution — Rejeter toutes nouvelles idées, P0 uniquement

- **Tasks :** P0 uniquement
- **Context :** Minimal
- **Timeline :** Aucune
- **Blind Spot :** Aucun
- **Engine Data :** Minimal
- **Anomalies :** Critiques uniquement
- **Compression :** Agressive
- **Règles :** Focus P0, supprimer redondance

#### Mode Flexible (seuil 25%)

**Objectif :** Gestionnaire pragmatique — P0+P1, petites améliorations OK

- **Tasks :** P0 + P1
- **Context :** Riche
- **Timeline :** Condensée (1h)
- **Blind Spot :** Sélectif
- **Engine Data :** Complet
- **Anomalies :** Moyennes + Critiques
- **Compression :** Modérée
- **Règles :** Supprimer redondance, pas de focus P0

#### Mode Exploratory (seuil 50%)

**Objectif :** Consultant innovation — 5-10 optimisations avec code

- **Tasks :** P0 + P1 + P2
- **Context :** Complet
- **Timeline :** Complète (2h)
- **Blind Spot :** Complet
- **Engine Data :** Complet
- **Anomalies :** Toutes
- **Compression :** Minimale
- **Règles :** Pas de suppression, pas de focus P0

#### Mode Free (seuil 100%)

**Objectif :** Disrupteur visionnaire — 10+ idées transformatrices

- **Tasks :** P0 + P1 + P2 + Complétées
- **Context :** Complet
- **Timeline :** Étendue (24h)
- **Blind Spot :** Étendu
- **Engine Data :** Complet
- **Anomalies :** Toutes
- **Résumé historique :** Oui
- **Compression :** Aucune
- **Règles :** Aucune restriction

#### Mode FirstUse

**Objectif :** Découverte approfondie — Bootstrap complet, détection complète

- **Tasks :** P0 + P1 + P2
- **Context :** Complet
- **Timeline :** Complète
- **Blind Spot :** Complet
- **Engine Data :** Complet
- **Anomalies :** Toutes
- **Bootstrap :** Oui (lecture seule)
- **Compression :** Minimale

### Template formatPrompt()

**Emplacement :** `extension/kernel/api/UnifiedPromptBuilder.ts` (lignes 2570-3107)

#### Structure du template

1. **En-tête**
   - Nom projet, timestamp génération, mode, confiance, bias
   - Cycle kernel, Merkle root, fichiers non commités
   - Minimap sections

2. **Règles Critiques**
   - Règles spécifiques mode (strict/flexible/exploratory/free)
   - Avertissements seuil bias
   - Restrictions modification fichiers

3. **Mémoire Chat**
   - Hiérarchie priorisation (chat > Tasks > Plan > Snapshot)
   - Rappel intention utilisateur temps réel

4. **Section Plan**
   - Intention stratégique, phase, objectif, timeline

5. **Section Tasks**
   - Tâches actives (filtrées par priorité)
   - Tâches complétées (si profil permet)

6. **Section Context**
   - KPIs (charge cognitive, prochaines étapes, dérive plan, risques)
   - Observations agent

7. **Section Timeline** (si profil permet)
   - Timestamps cycles
   - Timeline activité récente

8. **Section Blind Spot** (si profil permet)
   - Patterns fichiers (bursts, gaps)
   - Historique Git
   - Tendances santé

9. **Données générées par engines** (si profil permet)
   - Patterns
   - Corrélations
   - Prévisions

10. **Section Anomalies** (si profil permet)
    - Anomalies détectées (filtrées par sévérité)

11. **Instructions Agent**
    - Instructions spécifiques mode
    - Protocole RL4_PROPOSAL (modes exploratory/free)
    - Protocole RL4_DECISION_REQUEST (mode free)

#### Marqueurs de frontière

```markdown
---
BEGIN RL4 SNAPSHOT
Generated: 2025-11-18T14:40:32.250Z
Mode: exploratory (threshold: 50%)
---

[Contenu snapshot]

---
END RL4 SNAPSHOT
```

---

## Système de compression

### PromptOptimizer

**Emplacement :** `extension/kernel/api/PromptOptimizer.ts`  
**Objectif :** Compression intelligente prompts préservant information essentielle

#### Stratégies de compression

```typescript
private strategies: Record<CompressionMode, (prompt: string) => string> = {
  strict: this.compressAggressive.bind(this),
  flexible: this.compressModerate.bind(this),
  exploratory: this.compressMinimal.bind(this),
  free: this.compressNone.bind(this),
  firstUse: this.compressMinimal.bind(this)
};
```

#### Compression agressive (Mode Strict)

- **Garder :** Plan, Tasks, Context, KPIs, Instructions Agent, Données générées engines
- **Supprimer :** Timeline, Blind Spot, Résumé historique, Bootstrap
- **Réduction :** ~60-80%

#### Compression modérée (Mode Flexible)

- **Garder :** Plan, Tasks, Context, Timeline (condensée), Blind Spot (sélectif), Engine Data
- **Supprimer :** Résumé historique, Bootstrap
- **Réduction :** ~30-50%

#### Compression minimale (Mode Exploratory/FirstUse)

- **Garder :** Toutes sections
- **Supprimer :** Seulement redondance évidente (lignes dupliquées)
- **Réduction :** ~5-15%

#### Pas de compression (Mode Free)

- **Garder :** Toutes sections, aucune suppression
- **Supprimer :** Seulement redondance évidente (lignes dupliquées)
- **Réduction :** ~0-5%

#### Analyse de prompt

```typescript
interface PromptAnalysis {
  totalSize: number;
  sections: SectionInfo[];
  redundancy: number; // 0-1, plus élevé = plus redondant
  relevance: number; // 0-1, plus élevé = plus pertinent
  compressionPotential: number; // Ratio compression estimé (0-1)
}
```

---

## Pipeline WebView

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    WebView (React)                          │
│  ┌──────────────────────────────────────────────────────┐  │
│  │         App.tsx (Composant Principal)                │
│  │  - 4 Onglets: Control, Dev, Insights, About         │
│  │  - Gestion état (hooks useState)                     │
│  │  - Gestionnaires messages (window.vscode.postMessage)│
│  └──────────────────────────────────────────────────────┘  │
│                           ↕                                 │
│  ┌──────────────────────────────────────────────────────┐  │
│  │    Gestionnaires Messages (messageHandlers.ts)      │
│  │  - snapshotGenerated                                 │
│  │  - proposalsUpdated                                   │
│  │  - patchPreview                                       │
│  │  - taskVerificationResults                            │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                           ↕ (VS Code API)
┌─────────────────────────────────────────────────────────────┐
│         Extension Host (extension.ts)                      │
│  - webviewPanel.webview.onDidReceiveMessage()              │
│  - Gestionnaires: generateSnapshot, submitDecisions, etc.  │
└─────────────────────────────────────────────────────────────┘
```

### Onglet Control

**Objectif :** Génération snapshot et intégration GitHub

#### Fonctionnalités

- **Bouton Générer Snapshot**
  - Sélection mode (strict/flexible/exploratory/free/firstUse)
  - Appelle gestionnaire `generateSnapshot`
  - Affiche état chargement
  - Copie dans presse-papiers automatiquement

- **Bouton Parser Réponse LLM**
  - Lit presse-papiers
  - Parse JSON RL4_PROPOSAL
  - Écrit dans proposals.json
  - Met à jour badge Dev Tab

- **Intégration GitHub**
  - Commit avec WHY
  - Intégration GitHub Discussions

### Onglet Dev

**Objectif :** Validation propositions et vérification tâches

#### Fonctionnalités

- **Tâches Proposées**
  - Liste depuis proposals.json
  - Boutons Accepter/Rejeter
  - Badges priorité (P0/P1/P2)

- **Aperçu Patch**
  - Affiche diff RL4_TASKS_PATCH
  - Indicateur vérification bias
  - Bouton Appliquer Patch

- **Vérification Tâches**
  - Badges "✅ Vérifié par RL4"
  - Niveaux confiance (HIGH/MEDIUM/LOW)
  - Bouton "Marquer comme fait"

- **Carte Anomalies**
  - Anomalies détectées
  - Indicateurs sévérité
  - Recommandations

### Onglet Insights

**Objectif :** Tableau de bord KPIs et analytics

#### Fonctionnalités

- **Tableau de bord KPIs**
  - Charge Cognitive
  - Prochaines Étapes
  - Dérive Plan
  - Risques

- **Carte Anomalies**
  - Toutes anomalies détectées
  - Filtrer par sévérité

- **Métriques Compression**
  - Taille originale
  - Taille optimisée
  - Pourcentage réduction

### Onglet About

**Objectif :** Informations extension et version

#### Fonctionnalités

- **Info Version**
  - Version extension
  - Version kernel
  - Date build

- **Liens**
  - Documentation
  - Dépôt GitHub
  - Tracker issues

### Flux de messages

#### WebView → Extension

```typescript
// Générer Snapshot
window.vscode.postMessage({
  type: 'generateSnapshot',
  deviationMode: 'exploratory'
});

// Soumettre Décisions
window.vscode.postMessage({
  type: 'submitDecisions',
  payload: { /* RL4_DECISION_REQUEST */ }
});

// Appliquer Patch
window.vscode.postMessage({
  type: 'applyPatch',
  payload: { /* RL4_TASKS_PATCH */ }
});
```

#### Extension → WebView

```typescript
// Snapshot Généré
webviewPanel.webview.postMessage({
  type: 'snapshotGenerated',
  payload: promptString
});

// Propositions Mises à Jour
webviewPanel.webview.postMessage({
  type: 'proposalsUpdated',
  payload: { count: 3, proposals: [...] }
});

// Aperçu Patch
webviewPanel.webview.postMessage({
  type: 'patchPreview',
  payload: { preview: '...', bias: 15 }
});
```

---

## Workflow Cursor

### Flux End-to-End

```
1. Utilisateur génère snapshot (mode Exploratory)
   ↓
2. Snapshot copié dans presse-papiers automatiquement
   ↓
3. Utilisateur colle dans Cursor/Claude/ChatGPT
   ↓
4. LLM analyse snapshot et retourne RL4_PROPOSAL
   ↓
5. Utilisateur copie réponse LLM
   ↓
6. Utilisateur clique "Parser Réponse LLM" dans Control Tab
   ↓
7. Extension parse JSON → écrit dans proposals.json
   ↓
8. FileWatcher détecte changement → envoie proposalsUpdated à WebView
   ↓
9. Badge Dev Tab affiche: "3 nouvelles propositions"
   ↓
10. Utilisateur ouvre Dev Tab → voit cartes propositions
   ↓
11. Utilisateur accepte/rejette propositions
   ↓
12. Si accepté → aperçu patch généré (RL4_TASKS_PATCH)
   ↓
13. Utilisateur clique "Appliquer Patch"
   ↓
14. Extension applique patch à Tasks.RL4 (avec vérification bias)
   ↓
15. Décision loggée dans decisions.jsonl
   ↓
16. Utilisateur exécute tâche dans RL4 Terminal
   ↓
17. TaskVerificationEngine vérifie complétion
   ↓
18. Dev Tab affiche badge "✅ Vérifié par RL4"
   ↓
19. Utilisateur clique "Marquer comme fait"
   ↓
20. Tâche marquée comme complétée dans Tasks.RL4
```

### Protocole RL4_PROPOSAL

**Format :** Bloc JSON dans réponse LLM

```json
{
  "RL4_PROPOSAL": {
    "suggestedTasks": [
      {
        "id": "prop-001",
        "title": "Setup CI with GitHub Actions",
        "why": "Amélioration qualité et automatisation",
        "what": ["Créer fichier workflow", "Configurer versions node"],
        "effort": "6h",
        "roi": 8,
        "risk": "low",
        "bias": 5,
        "deps": [],
        "scope": "repo",
        "possibleDuplicateOf": "external-task-001"
      }
    ],
    "planContextUpdates": "Markdown optionnel proposé pour Plan/Context"
  }
}
```

**Formats de parsing supportés :**

1. **JSON Fenced:**
   ```markdown
   ```json
   { "RL4_PROPOSAL": { ... } }
   ```
   ```

2. **Bloc RL4_PROPOSAL:**
   ```markdown
   RL4_PROPOSAL:
   { "RL4_PROPOSAL": { ... } }
   ```

3. **JSON Brut:**
   ```json
   { "RL4_PROPOSAL": { ... } }
   ```

4. **Format Mixte:**
   Toute combinaison ci-dessus

### Protocole RL4_DECISION_REQUEST

**Format :** JSON envoyé depuis WebView quand utilisateur accepte/rejette propositions

```json
{
  "RL4_DECISION_REQUEST": {
    "accepted": [
      { "id": "prop-001", "priority": "P0" },
      { "id": "prop-002", "priority": "P1" }
    ],
    "rejected": [
      { "id": "prop-003", "reason": "Duplicata de tâche existante" }
    ]
  }
}
```

### Protocole RL4_TASKS_PATCH

**Format :** Patch JSON pour Tasks.RL4

```json
{
  "RL4_TASKS_PATCH": {
    "tasks": [
      {
        "action": "add",
        "priority": "P0",
        "task": "Setup CI with GitHub Actions",
        "metadata": {
          "@rl4:id": "prop-001",
          "@rl4:why": "Amélioration qualité et automatisation",
          "@rl4:effort": "6h",
          "@rl4:roi": 8
        }
      }
    ],
    "bias": 15,
    "threshold": 25,
    "safe": true
  }
}
```

**Vérification Bias :**
- Calcule impact bias: `(fichiers_créés × 5) + (fichiers_modifiés × 2) + (lignes_ajoutées ÷ 100)`
- Compare avec seuil mode (strict: 0%, flexible: 25%, exploratory: 50%, free: 100%)
- Abandonne si seuil dépassé

---

## ADRs

### Cycle de vie ADR

#### 1. Génération Proposition

**Source :** ForecastEngine → ADRGeneratorV2

- Forecast avec `decision_type: 'ADR_Proposal'` → proposition ADR
- Sauvegardé dans répertoire `adrs/auto/`
- Statut: `pending`
- Requiert validation humaine

#### 2. Validation

**Commande :** `reasoning.adr.validate` (commande VS Code)

- Liste propositions ADR en attente
- Utilisateur peut accepter/rejeter
- Validation loggée dans `adrs/auto/validation_history.jsonl`

#### 3. Acceptation

**Action :** Utilisateur accepte proposition

- Statut changé à `accepted`
- ADR déplacé vers `adrs/active.json`
- Ajouté à ADRs.RL4 (si utilisateur choisit)
- Disponible dans prochain snapshot

#### 4. Rejet

**Action :** Utilisateur rejette proposition

- Statut changé à `rejected`
- Notes validation stockées
- Non inclus dans snapshots futurs

### Structure ADR

```typescript
interface ADR {
  id: string;
  title: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'deprecated' | 'superseded';
  createdAt: string;
  modifiedAt: string;
  author: string;
  context: string;
  decision: string;
  consequences: string;
  tags: string[];
  components: string[];
  relatedADRs: string[];
  evidenceIds: string[];
}
```

### Parser ADR

**Emplacement :** `extension/kernel/api/ADRParser.ts`

**Objectif :** Parser ADRs.RL4 et ajouter à ledger/adrs.jsonl

**Workflow :**
1. FileWatcher détecte changement ADRs.RL4
2. ADRParser valide + parse
3. Nouvel ADR ajouté à ledger/adrs.jsonl
4. Prochain prompt inclut nouvel ADR (boucle feedback fermée)

**Validation :** Validation schéma Zod
- Format ID: `adr-\d{3,}-`
- Champs requis: title, status, date, author, context, decision, consequences

---

## Intelligence Workspace

### Comment RL4 devient contextuellement intelligent

#### 1. Détection Projet

**Emplacement :** `extension/kernel/detection/ProjectDetector.ts`

- Détecte type projet (Node.js, Python, Rust, etc.)
- Analyse structure projet
- Identifie tech stack

#### 2. Analyse Projet

**Emplacement :** `extension/kernel/api/ProjectAnalyzer.ts`

- Analyse package.json, requirements.txt, Cargo.toml
- Détecte dépendances
- Identifie outils build

#### 3. Analyse État Code

**Emplacement :** `extension/kernel/api/CodeStateAnalyzer.ts`

- Analyse structure code
- Détecte hotspots (fichiers fréquemment modifiés)
- Identifie dette technique

#### 4. Apprentissage Patterns

- Apprend depuis décisions historiques
- Identifie patterns récurrents
- Construit intelligence spécifique workspace

#### 5. Apprentissage Patterns Terminal

**Emplacement :** `extension/kernel/cognitive/TerminalPatternsLearner.ts`

- Apprend patterns commandes par workspace
- Suggère conditions `@rl4:completeWhen`
- Détecte anomalies (chutes taux succès, durées inhabituelles)

### Données spécifiques workspace

Toutes données RL4 sont spécifiques workspace :

- Répertoire `.reasoning_rl4/` par workspace
- Patterns appris par workspace
- Patterns terminal par workspace
- Pas de partage données cross-workspace

---

## Guide d'extensibilité

### Ajouter un nouvel Engine

1. **Créer Classe Engine**

```typescript
// extension/kernel/cognitive/MyNewEngine.ts
export class MyNewEngine {
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }
  
  async analyze(): Promise<MyResult[]> {
    // Implémentation
  }
}
```

2. **Intégrer dans CognitiveScheduler**

```typescript
// extension/kernel/CognitiveScheduler.ts
import { MyNewEngine } from './cognitive/MyNewEngine';

// Dans constructeur
this.myNewEngine = new MyNewEngine(workspaceRoot);

// Dans runCycle()
const phaseResult = await this.runPhase('my-new-phase', async () => {
  return await this.myNewEngine.analyze();
});
```

3. **Ajouter au système Snapshot**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
private loadMyNewEngineData(): any[] {
  // Charger sortie engine
}

// Dans buildSnapshotData()
const myNewEngineData = this.normalizeMyNewEngineData(this.loadMyNewEngineData());
```

### Ajouter un nouveau profil Prompt

1. **Ajouter Configuration Profil**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
private readonly profiles: Record<string, PromptProfile> = {
  // ... profils existants
  myNewProfile: {
    mode: 'myNewProfile',
    includeTasks: { P0: true, P1: true, P2: false, completed: false },
    sections: {
      // ... configuration
    },
    compression: 'moderate',
    rules: { threshold: 0.30, suppressRedundancy: true, focusP0: false }
  }
};
```

2. **Ajouter Méthode Format**

```typescript
private formatMyNewProfileMode(projectContext: ProjectContext, tasks: TasksData | null): string {
  // Formater instructions pour ce profil
}
```

### Ajouter nouvelle source données Blind Spot

1. **Ajouter Méthode Loader**

```typescript
// extension/kernel/api/BlindSpotDataLoader.ts
loadMyNewData(period: TimelinePeriod): MyNewData[] {
  const filePath = path.join(this.basePath, 'my_new_data.jsonl');
  // Charger et retourner données
}
```

2. **Intégrer dans système Snapshot**

```typescript
// extension/kernel/api/UnifiedPromptBuilder.ts
// Dans buildSnapshotData()
const myNewData = this.normalizeMyNewData(this.blindSpotLoader.loadMyNewData(timelinePeriod));
```

---

## Guide de maintenance

### Problèmes courants

#### 1. Inertie Boucle Cognitive

**Symptôme :** Cycles s'exécutent mais engines retournent résultats vides (count: 0)

**Diagnostic :**
- Vérifier `ledger/cycles.jsonl` pour compteurs phases
- Vérifier engines ont données entrée (patterns.json, correlations.json, etc.)
- Vérifier logs engines pour erreurs

**Solution :**
- S'assurer engines ont données entrée suffisantes
- Vérifier permissions fichiers
- Vérifier intégrité fichiers JSONL

#### 2. Corruption Ledger

**Symptôme :** SAFE MODE activé, cycles bloqués

**Diagnostic :**
- Vérifier `ledger/cycles.jsonl` pour JSON malformé
- Vérifier continuité chaîne Merkle root
- Vérifier espace disque

**Solution :**
- Restaurer depuis backup (`cycles.jsonl.backup_safe`)
- Reconstruire genesis ledger si nécessaire
- Vérifier espace disque

#### 3. Fuites Mémoire

**Symptôme :** Mémoire extension host croît continuellement

**Diagnostic :**
- Vérifier logs MemoryMonitor
- Vérifier disposables sont nettoyés
- Vérifier timers orphelins

**Solution :**
- S'assurer tous event listeners sont disposés
- Vérifier nettoyage TimerRegistry
- Vérifier limites buffers ExecPool

#### 4. Génération Snapshot Échoue

**Symptôme :** Génération snapshot lance erreur

**Diagnostic :**
- Vérifier logs UnifiedPromptBuilder
- Vérifier toutes sources données accessibles
- Vérifier permissions fichiers

**Solution :**
- S'assurer répertoire `.reasoning_rl4/` existe
- Vérifier permissions fichiers
- Vérifier fichiers JSONL corrompus

### Optimisation performance

#### 1. Réduire Fréquence Cycle

**Production :** 2 heures (7200000ms)  
**Test :** 10 secondes (10000ms)

```json
// .reasoning_rl4/kernel_config.json
{
  "cognitive_cycle_interval_ms": 7200000,
  "TEST_MODE": false
}
```

#### 2. Activer Rotation JSONL

**Automatique :** Après 10K lignes  
**Compression :** Archives .gz

#### 3. Limiter Tailles Buffers

**ExecPool :** 1 KB max stdout/stderr  
**Console.log :** Rotation (max 100 logs)

### Stratégie Backup

#### Fichiers critiques

- `ledger/cycles.jsonl` (historique cycles)
- `ledger/rbom_ledger.jsonl` (ledger ADR)
- `Plan.RL4`, `Tasks.RL4`, `Context.RL4` (fichiers état)

#### Fréquence Backup

- **Automatique :** Avant opérations majeures (écritures ledger)
- **Manuel :** Avant changements majeurs

#### Récupération

1. Restaurer depuis fichiers `.backup_safe`
2. Vérifier chaîne Merkle root
3. Reconstruire si nécessaire

---

## Conclusion

RL4 est une couche de système d'exploitation cognitive complète qui fournit aux agents IA un contexte complet de workspace. Cette documentation couvre tous les composants majeurs, systèmes et workflows. Pour détails d'implémentation spécifiques, référez-vous au code source dans `extension/kernel/` et `extension/webview/`.

**Points clés :**

1. **Architecture basée Kernel :** Moteur cognitif centralisé avec ledger append-only
2. **Snapshots basés Profils :** Génération prompts spécifique mode (strict/flexible/exploratory/free)
3. **Workflow Propositions :** Propositions LLM → Validation → Application patch
4. **Vérification Tâches :** Suivi événements terminal → Auto-vérification
5. **Intelligence Workspace :** Apprentissage contextuel par workspace

**Version :** 3.5.11  
**Statut :** Kernel Production-Ready (P0-CORE Actif)  
**Dernière mise à jour :** 2025-11-18


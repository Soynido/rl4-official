# RL4 Kernel

**Version**: 2.0.0-beta  
**Type**: Cognitive Operating System Layer  
**Purpose**: Stabilization & orchestration layer for RL3

---

## Architecture

```
RL4 Kernel (This Directory)
├── TimerRegistry      - Centralized timer management (prevents leaks)
├── AppendOnlyWriter   - JSONL append-only (no array rewrites)
├── ExecPool           - Git command pool (concurrency=2, timeout=2s)
├── StateRegistry      - Periodic state snapshots
├── HealthMonitor      - System health tracking
├── CognitiveScheduler - Single master scheduler (Pattern→Correlation→Forecast→ADR)
├── RBOMLedger         - Append-only ADR ledger with Merkle verification
├── EvidenceGraph      - Inverted index (trace→artifacts)
├── KernelAPI          - Public API (status, reflect, flush, shutdown)
└── adapters/          - RL3 compatibility proxies
```

---

## Quick Start

### CLI Usage

```bash
# Status
node extension/kernel/cli.ts status

# Run cognitive cycle
node extension/kernel/cli.ts reflect

# Flush queues
node extension/kernel/cli.ts flush

# Verify RBOM integrity
node extension/kernel/cli.ts rbom verify

# Shutdown
node extension/kernel/cli.ts shutdown
```

### VS Code Extension

Kernel automatically initialized in `extension.ts` activation.

---

## Configuration

Edit `.reasoning_rl4/kernel_config.json`:

```json
{
  "features": {
    "USE_TIMER_REGISTRY": true,    // Fix memory leaks
    "USE_APPEND_ONLY_IO": true,    // Replace fs.writeFileSync
    "USE_EXEC_POOL": true,         // Git timeout protection
    "USE_STATE_REGISTRY": true,    // Periodic snapshots
    "USE_HEALTH_MONITOR": true     // Health alerts
  },
  "intervals": {
    "exec_pool_size": 2,                        // Max 2 concurrent git commands
    "exec_timeout_ms": 2000,                    // 2s git timeout
    "health_check_interval_ms": 10000,          // Health check every 10s
    "state_snapshot_interval_ms": 600000,       // Snapshot every 10min
    "cognitive_cycle_interval_ms": 10000        // Cycle every 10s (testing) or 7200000 (2h production)
  }
}
```

---

## Key Features

### 1. Zero Memory Leaks
- All timers tracked in `TimerRegistry`
- Automatic cleanup on `clearAll()`
- No orphan intervals after deactivation

### 2. Append-Only Architecture
- JSONL format (1 line = 1 entry)
- No array rewrites (eliminates race conditions)
- Automatic rotation (50MB limit)
- fsync on flush (durability)

### 3. Git Command Protection
- Pool size = 2 (max 2 concurrent git commands)
- Timeout = 2s (prevents hangs on slow git)
- Latency tracking (p50/p90/p99)
- Queue management

### 4. Health Monitoring
- Memory usage (MB)
- Active timers (count)
- Event loop lag (p95, p99)
- Automatic alerts if thresholds exceeded

---

## Tests

```bash
# Unit tests
npm test -- --testPathPattern=kernel

# Benchmarks
npm run bench:events-10k
npm run bench:scheduler-1h
npm run bench:git-pool
```

---

## Rollback

Disable features in `kernel_config.json`:

```json
{
  "features": {
    "USE_TIMER_REGISTRY": false,
    "USE_APPEND_ONLY_IO": false
  }
}
```

Kernel will fallback to RL3 behavior.

---

## Metrics

Health metrics logged to: `.reasoning_rl4/diagnostics/health.jsonl`

Format:
```json
{"type":"health_check","metrics":{...},"alerts":[...],"_timestamp":"2025-11-03T..."}
```

---

## Files

| File | LOC | Purpose |
|------|-----|---------|
| `TimerRegistry.ts` | 120 | Timer management |
| `AppendOnlyWriter.ts` | 160 | JSONL writer |
| `ExecPool.ts` | 200 | Git command pool |
| `StateRegistry.ts` | 110 | State snapshots |
| `HealthMonitor.ts` | 190 | Health tracking |
| `CognitiveScheduler.ts` | 180 | Master scheduler |
| `RBOMLedger.ts` | 150 | RBOM ledger |
| `EvidenceGraph.ts` | 80 | Evidence index |
| `KernelAPI.ts` | 90 | Public API |
| `config.ts` | 60 | Configuration |
| `cli.ts` | 80 | CLI interface |
| `adapters/TimerProxy.ts` | 50 | Timer redirection |
| `adapters/PersistenceManagerProxy.ts` | 80 | Persistence redirection |

**Total**: ~1550 LOC

---

**RL4 Kernel v2.0.0-beta**  
**Built**: 2025-11-03  
**Status**: Scaffold Complete


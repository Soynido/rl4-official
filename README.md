# RL4 — Workspace Insights for Developers

**Never ask "What should I do next?" again.**

RL4 is a VS Code extension that provides **real-time, LLM-validated insights** about your development workspace — helping you understand what's happening, what matters, and what to focus on next.

![RL4 Dashboard](./assets/screenshot-dashboard.png)

---

## 🎯 Why RL4 Exists

### The Problem

As developers, we're drowning in data:
- 150+ commits this month
- 47 open files
- 3 branches in progress
- Memory usage at 1.2GB
- Event loop p95 at 2.3ms

**But what does any of this mean?** 

❌ "Is 1.2GB memory normal or alarming?"  
❌ "Should I be concerned about that event loop spike?"  
❌ "Which task should I prioritize right now?"

**Raw data without context creates cognitive overload**, not clarity.

### The Solution

RL4 transforms raw workspace metrics into **actionable insights** using an LLM as a cognitive middleware layer.

Instead of showing you raw numbers, RL4 tells you:
- ✅ **Cognitive Load:** "25% (Normal) — No rapid iterations, 4 uncommitted files"
- ✅ **Next Tasks:** "P0: Commit baseline reset files | P1: Continue E4 development"
- ✅ **Plan Drift:** "0% — Perfectly aligned with baseline v2.0"
- ✅ **Risks:** "4 uncommitted files (low risk), excellent system health"

**You see MEANING, not measurements.**

---

## 👥 Who Should Use RL4

RL4 is designed for:

### ✅ Solo Developers
- Maintain focus across multiple projects
- Resume work after breaks without context loss
- Track progress toward goals automatically

### ✅ Remote Teams
- Share workspace context in standups/reviews
- Document decision rationale automatically
- Maintain continuity across async workflows

### ✅ Technical Leaders
- Monitor team cognitive load and blockers
- Track architectural decisions (ADRs) over time
- Identify drift from project plans early

### ✅ Open Source Maintainers
- Understand contribution patterns
- Document why decisions were made
- Maintain project coherence as it evolves

---

## 🚀 How It Works

RL4 uses a **3-stage cognitive pipeline**:

```
┌──────────────────────────────────────────────────────────────┐
│  STAGE 1: Observe (Extension Kernel)                         │
│  ─────────────────────────────────────────────────────────   │
│  • File changes (bursts, gaps, patterns)                     │
│  • Git activity (commits, branches, authors)                 │
│  • System health (memory, event loop, uptime)                │
│  • Timeline analysis (last 2h, 7d, 30d)                      │
│  • Historical compression (30 days → 2KB JSON)               │
│                                                               │
│  Output: Raw workspace data (cycles, commits, metrics)       │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│  STAGE 2: Analyze (LLM as Cognitive Middleware)              │
│  ─────────────────────────────────────────────────────────   │
│  • Receives compressed snapshot (~5KB Markdown)              │
│  • Calculates KPIs (cognitive load, next tasks, drift, risks)│
│  • Detects architectural decisions (ADRs)                    │
│  • Generates recommendations (mode-adaptive)                 │
│  • Updates persistent state files (.RL4 files)               │
│                                                               │
│  Output: Context.RL4 with LLM-calculated insights            │
└──────────────────────────────────────────────────────────────┘
                             ↓
┌──────────────────────────────────────────────────────────────┐
│  STAGE 3: Display (Smart UI)                                 │
│  ─────────────────────────────────────────────────────────   │
│  • Parses Context.RL4 (FileWatcher detects changes)          │
│  • Renders 4 KPI cards (real-time updates)                   │
│  • Shows mode-specific recommendations                       │
│  • Adapts to deviation mode (Strict/Flexible/Exploratory)    │
│                                                               │
│  Output: Actionable insights displayed in WebView            │
└──────────────────────────────────────────────────────────────┘
```

### Key Principle: **LLM as Validator, Not Oracle**

RL4 **never** asks the LLM to predict the future or make judgments. The LLM only:
1. ✅ Calculates metrics from factual data (bursts, commits, file changes)
2. ✅ Compares current state vs baseline (drift detection)
3. ✅ Formats recommendations based on your chosen mode

**No hallucinations. No speculation. Just validated insights from your workspace data.**

---

## 📊 The 4 Core KPIs

### 1️⃣ Cognitive Load
**What it measures:** How intense your current work session is.

**Calculated from:**
- Burst events (rapid file edits in short time)
- Context switches (switching between different files)
- Parallel tasks (multiple active work streams)
- Uncommitted files (pending work)

**Example:**
```
Cognitive Load: 62% (High)
- Bursts: 3 (rapid iterations detected)
- Switches: 18 (frequent context changes)
- Parallel Tasks: 2 (feature branch + bugfix)
- Uncommitted Files: 12 ⚠️ (high risk of data loss)
```

**Why it matters:** High cognitive load → increased risk of bugs, burnout, and context loss.

---

### 2️⃣ Next Tasks
**What it measures:** What you should focus on next, adapted to your workflow mode.

**Mode types:**
- **Strict (0% drift):** Focus only on P0 baseline tasks
- **Flexible (25%):** Allow minor deviations for value-adds
- **Exploratory (50%):** Experiment while tracking drift
- **Free (100%):** No constraints (useful for research/prototyping)

**Example (Strict Mode):**
```
Next Tasks:
1. [P0] NEXT: Commit baseline reset files
2. [P0] PRIORITY: Continue E4 development from bias 0%
3. [P1] Monitor deviation with Deviation Guard
```

**Why it matters:** Clear priorities → reduced decision fatigue, faster progress.

---

### 3️⃣ Plan Drift
**What it measures:** How far your current work has deviated from your original plan.

**Tracks changes in:**
- Phase (E3 → E4)
- Goal (text similarity score)
- Timeline (planned vs actual)
- Tasks (added/removed/modified)

**Example:**
```
Plan Drift: 15% (Flexible: 25% threshold)
- Phase: E4 (current) = E4 (baseline v2.0) ✅
- Goal: 92% similarity (8% refinement)
- Timeline: On schedule (Day 2/4)
- Tasks: +2 polish features, -1 deprecated task
- Status: 🟡 Within threshold, monitor closely
```

**Why it matters:** Small drifts compound. Early detection → course correction before major misalignment.

---

### 4️⃣ Risks
**What it measures:** Potential blockers or issues in your workspace.

**Risk types:**
- 🔴 **Critical:** Immediate action required (e.g., 20+ uncommitted files)
- 🟡 **Warning:** Monitor closely (e.g., plan drift near threshold)
- 🟢 **OK:** No issues detected

**Example:**
```
Risks:
- 🟡 12 uncommitted files (data loss risk)
- 🟢 0% plan drift (perfect alignment)
- 🟢 No burst events (stable work session)
- 🟢 System health: Excellent (284MB memory, 0.06ms event loop)
```

**Why it matters:** Proactive risk detection → avoid surprises, maintain flow state.

---

## 🛠️ How to Use RL4

### Installation

1. **Install from VS Code Marketplace:**
   ```
   Cmd/Ctrl + P → ext install rl4.workspace-insights
   ```

2. **Or install from VSIX:**
   ```bash
   code --install-extension rl4-official.vsix
   ```

### First Use

1. **Open your project** in VS Code
2. **Open Command Palette** (`Cmd/Ctrl + Shift + P`)
3. **Run:** `Reasoning: Generate Context Snapshot`

RL4 will:
- ✅ Analyze your workspace (files, git, health)
- ✅ Send a compressed snapshot to your LLM
- ✅ Display insights in the RL4 WebView

### Choosing Your Workflow Mode

**Click the mode selector** in the RL4 UI:

- 🔴 **Strict:** Zero tolerance for drift (perfect for production releases)
- 🟡 **Flexible:** Allow 25% drift (balanced development)
- 🟢 **Exploratory:** Allow 50% drift (research/prototyping)
- ⚪ **Free:** No constraints (brainstorming/spikes)

**The LLM adapts its recommendations to your chosen mode.**

---

## 📁 What Gets Created

RL4 creates a `.reasoning_rl4/` directory in your workspace:

```
.reasoning_rl4/
├── Plan.RL4         ← Strategic intent (goals, timeline, success criteria)
├── Tasks.RL4        ← Tactical TODOs (P0/P1/P2 priorities)
├── Context.RL4      ← Operational state (KPIs, observations, risks)
├── ADRs.RL4         ← Architecture Decision Records
└── .baseline/       ← Immutable baseline for drift calculation
```

**These are plain Markdown files.** You can:
- ✅ Edit them manually (LLM respects your changes)
- ✅ Version them in Git (track evolution over time)
- ✅ Share them with teammates (async context sharing)

**RL4 watches these files via FileWatcher** — any change triggers an automatic UI update.

---

## 🔒 Privacy & Security

### What RL4 Sends to the LLM

RL4 sends **only workspace metadata**, never source code:
- ✅ File paths and change timestamps
- ✅ Git commit messages and author names
- ✅ System metrics (memory, event loop)
- ✅ Compressed historical data (30 days → 2KB JSON)

**Total snapshot size:** ~5KB Markdown

### What RL4 Never Sends

❌ Source code contents  
❌ API keys or secrets  
❌ Personal identifiable information  
❌ File contents (only paths and timestamps)

### LLM Integration

RL4 works with:
- **OpenAI GPT-4** (via API key)
- **Anthropic Claude** (via API key)
- **Local LLMs** (Ollama, LM Studio, etc.)

**You control which LLM to use.** RL4 is LLM-agnostic.

---

## 🎨 Screenshots

### Dashboard View
![Dashboard](./assets/screenshot-dashboard.png)

### Cognitive Load Card
![Cognitive Load](./assets/screenshot-cognitive-load.png)

### Plan Drift Tracking
![Plan Drift](./assets/screenshot-plan-drift.png)

### Deviation Mode Selector
![Modes](./assets/screenshot-modes.png)

---

## 🏗️ Architecture Decisions (ADRs)

RL4 documents its own architectural decisions using ADRs:

| ADR | Title | Date | Status |
|-----|-------|------|--------|
| ADR-010 | Factual KPIs Only (No Predictions) | 2025-11-12 | ✅ Accepted |
| ADR-009 | UI-Driven Deviation Mode | 2025-11-12 | ✅ Accepted |
| ADR-006 | LLM as Cognitive Middleware | 2025-11-12 | ✅ Accepted |
| ADR-005 | Deviation Guard System | 2025-11-12 | ✅ Accepted |

**View all ADRs:** `.reasoning_rl4/ADRs.RL4` in your workspace

---

## 🤝 Contributing

RL4 is open source (MIT License).

**Ways to contribute:**
1. 🐛 **Report bugs:** [GitHub Issues](https://github.com/YOUR_ORG/rl4-official/issues)
2. 💡 **Suggest features:** [Discussions](https://github.com/YOUR_ORG/rl4-official/discussions)
3. 📝 **Improve docs:** PRs welcome
4. 🧪 **Test integrations:** Try RL4 with different LLMs and share feedback

---

## 📜 License

MIT License — See [LICENSE.txt](./LICENSE.txt)

---

## 🙏 Acknowledgments

RL4 was inspired by:
- **Dev Continuity Theory** — Maintaining context across async work sessions
- **Cognitive Load Theory** — John Sweller's work on working memory limits
- **ADR Pattern** — Michael Nygard's lightweight architectural documentation

Special thanks to:
- The VS Code extension community
- Early testers and feedback providers
- The open source LLM ecosystem

---

## 📞 Support

- 📖 **Documentation:** [docs.rl4.dev](https://docs.rl4.dev)
- 💬 **Community:** [Discord](https://discord.gg/rl4-community)
- 🐦 **Updates:** [@rl4_dev](https://twitter.com/rl4_dev)
- 📧 **Email:** support@rl4.dev

---

**Made with 🧠 by developers, for developers.**

*RL4 — Because raw data isn't insight.*


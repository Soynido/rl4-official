# Changelog

All notable changes to RL4 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [3.0.0] - 2025-11-12

### 🎉 Initial Public Release

**RL4 is now production-ready!**

#### Added
- ✅ **4 Core KPI Cards:** Cognitive Load, Next Tasks, Plan Drift, Risks
- ✅ **LLM Integration:** Works with GPT-4, Claude, and local LLMs
- ✅ **Real-time Updates:** FileWatcher monitors `.RL4` files for automatic UI refresh
- ✅ **Deviation Modes:** Strict/Flexible/Exploratory/Free workflow adaptation
- ✅ **ADR Tracking:** Automatic Architecture Decision Records
- ✅ **Historical Compression:** 30 days of activity → 2KB JSON snapshot
- ✅ **Smart Tooltips:** Contextual explanations for each metric
- ✅ **Baseline Tracking:** Detects plan drift with recalibration options

#### Architecture
- **Extension Kernel:** TypeScript-based observation engine
- **WebView UI:** React + CSS with smooth animations
- **Persistent State:** `.reasoning_rl4/` directory with Plan/Tasks/Context/ADRs
- **Privacy-First:** Only metadata sent to LLM, never source code

#### Documentation
- Complete README with How/Why/Who/What
- 12 documented ADRs explaining key decisions
- Inline code comments for clarity

---

## Roadmap

### [3.1.0] - Planned
- Interactive ADR timeline visualization
- Multi-workspace support
- Custom KPI definitions
- Team collaboration features

### [3.2.0] - Planned
- VS Code Marketplace themes integration
- Export reports (PDF/Markdown)
- GitHub integration (PR/Issue linking)
- Jira/Linear integration

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

---

**Full commit history available at:** [GitHub Releases](https://github.com/YOUR_ORG/rl4-official/releases)


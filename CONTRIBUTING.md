# Contributing to RL4

Thank you for considering contributing to RL4! 🎉

## Ways to Contribute

### 🐛 Report Bugs
Found a bug? [Open an issue](https://github.com/YOUR_ORG/rl4-official/issues/new?template=bug_report.md)

**Include:**
- VS Code version
- RL4 version
- Steps to reproduce
- Expected vs actual behavior
- Console logs (if applicable)

### 💡 Suggest Features
Have an idea? [Start a discussion](https://github.com/YOUR_ORG/rl4-official/discussions/new?category=ideas)

**Include:**
- Problem you're trying to solve
- Proposed solution
- Why it matters (use cases)

### 📝 Improve Documentation
- Fix typos, clarify explanations
- Add examples or diagrams
- Translate to other languages

### 🧪 Test Integrations
- Try RL4 with different LLMs
- Test on various projects (large/small, mono/multi-repo)
- Share feedback on what works/doesn't work

## Development Setup

### Prerequisites
- Node.js 18+
- npm 9+
- VS Code 1.80+

### Clone & Build
```bash
git clone https://github.com/YOUR_ORG/rl4-official.git
cd rl4-official
npm install
npm run compile
npm run build
```

### Run Extension
1. Open in VS Code: `code .`
2. Press `F5` to launch Extension Development Host
3. Test your changes in the new window

### Project Structure
```
rl4-official/
├── extension/
│   ├── extension.ts       ← Main entry point
│   ├── commands/          ← VS Code commands
│   ├── kernel/            ← Reasoning engine
│   │   ├── core/          ← Core modules
│   │   ├── api/           ← Public APIs
│   │   ├── services/      ← Business logic
│   │   └── types/         ← TypeScript types
│   └── webview/           ← React UI
│       └── ui/
│           ├── src/       ← Components, utils
│           └── package.json
├── package.json           ← Extension manifest
└── webpack.config.js      ← Build config
```

## Code Style

### TypeScript
- **Strict mode:** Always enabled
- **Naming:** PascalCase for classes, camelCase for functions
- **Async:** Prefer `async/await` over `.then()`
- **Types:** Avoid `any`, use explicit types

### React/UI
- **Functional components** with hooks
- **CSS Modules** for styling (avoid inline styles)
- **Accessibility:** Always include ARIA labels

### Comments
- **What, not how:** Explain WHY, not WHAT (code should be self-explanatory)
- **JSDoc:** For public APIs and exported functions
- **TODOs:** Use `TODO(username): Description` format

## Commit Guidelines

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `refactor`: Code change (no feature/fix)
- `test`: Add/update tests
- `chore`: Build/config changes

### Examples
```
feat(kernel): Add timeline compression for 90-day history

Compress 90 days of cycles into 5KB JSON using statistical
sampling and event deduplication.

Closes #42
```

```
fix(ui): Prevent KPI parsing failure on empty sections

Regex was too strict, failing on optional metrics.
Now handles missing data gracefully.

Fixes #67
```

## Pull Request Process

1. **Fork** the repo
2. **Create branch:** `git checkout -b feat/your-feature`
3. **Commit changes:** Follow commit guidelines above
4. **Run tests:** `npm test` (when available)
5. **Build:** `npm run build` (ensure no errors)
6. **Push:** `git push origin feat/your-feature`
7. **Open PR:** Include description, screenshots (if UI change)

### PR Review Checklist
- [ ] Code follows style guidelines
- [ ] Comments added for complex logic
- [ ] No console.log/debugger left in code
- [ ] Build succeeds without warnings
- [ ] Tested manually in VS Code
- [ ] Updated README/CHANGELOG (if needed)

## Architecture Decision Records (ADRs)

For significant architectural changes:

1. **Propose ADR** in `.reasoning_rl4/ADRs.RL4`
2. **Include:**
   - Context (why this decision?)
   - Decision (what was chosen?)
   - Consequences (positive/negative impacts)
   - Alternatives considered
3. **Discuss in PR** before merging

## Questions?

- 💬 **Discord:** [Join community](https://discord.gg/rl4-community)
- 📧 **Email:** support@rl4.dev
- 🐦 **Twitter:** [@rl4_dev](https://twitter.com/rl4_dev)

---

**Thank you for making RL4 better!** 🙏


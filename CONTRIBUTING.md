# Contributing to BMAD Mission Control

Thank you for your interest in contributing to BMAD Mission Control! 🎉

This VS Code extension helps developers visualize and manage BMAD workflows. We welcome contributions of all kinds — bug fixes, new features, documentation improvements, and more.

---

## 📋 Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Making Changes](#making-changes)
- [Pull Request Process](#pull-request-process)
- [Coding Standards](#coding-standards)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment. Be kind, constructive, and professional in all interactions.

---

## Getting Started

1. **Fork the repository** on GitHub
2. **Clone your fork** locally:
   ```bash
   git clone https://github.com/YOUR-USERNAME/mission-control.git
   cd mission-control
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/bmad-method/mission-control.git
   ```

---

## Development Setup

### Prerequisites

- **Node.js** 18+ 
- **VS Code** 1.85+
- **npm** (comes with Node.js)

### Installation

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-recompile on changes)
npm run watch
```

### Running the Extension

1. Open the project in VS Code
2. Press `F5` to launch the **Extension Development Host**
3. The extension will be active in the new VS Code window
4. Open a project with `_bmad-output/bmm-workflow-status.yaml` to test

### Project Structure

```
mission-control/
├── src/
│   ├── extension.ts           # Extension entry point
│   ├── BmadSidebarProvider.ts # Webview sidebar UI
│   ├── WorkflowStateManager.ts # YAML parsing & state
│   └── types.ts               # TypeScript interfaces
├── resources/
│   └── bmad-icon.svg          # Activity bar icon
├── webview/                   # Webview assets (if any)
├── out/                       # Compiled output (generated)
└── package.json               # Extension manifest
```

---

## Making Changes

### Branch Naming

Create a descriptive branch for your work:

```bash
git checkout -b feature/add-workflow-filtering
git checkout -b fix/story-click-handler
git checkout -b docs/update-installation-guide
```

### Commit Messages

Write clear, descriptive commit messages:

```
feat: add filtering for completed workflows
fix: resolve story link not opening markdown file
docs: clarify installation steps for Windows
refactor: simplify YAML parsing logic
```

Use conventional prefixes:
- `feat:` — New features
- `fix:` — Bug fixes
- `docs:` — Documentation changes
- `refactor:` — Code refactoring
- `test:` — Test additions/changes
- `chore:` — Build/tooling changes

---

## Pull Request Process

1. **Update your fork** with the latest upstream changes:
   ```bash
   git fetch upstream
   git rebase upstream/main
   ```

2. **Push your branch** to your fork:
   ```bash
   git push origin feature/your-feature-name
   ```

3. **Open a Pull Request** on GitHub with:
   - Clear title describing the change
   - Description of what was changed and why
   - Screenshots/GIFs for UI changes
   - Reference to related issues (e.g., "Fixes #12")

4. **Address review feedback** promptly

5. **Ensure CI passes** before merge

### PR Checklist

- [ ] Code compiles without errors (`npm run compile`)
- [ ] Changes have been tested in the Extension Development Host
- [ ] Commit messages follow conventional format
- [ ] Documentation updated if needed
- [ ] CHANGELOG.md updated for notable changes

---

## Coding Standards

### TypeScript

- Use **strict TypeScript** — avoid `any` when possible
- Follow existing code patterns and naming conventions
- Add JSDoc comments for public functions and complex logic

### Formatting

- Use consistent indentation (2 spaces)
- Keep lines under 100 characters when practical
- Run lint before committing (if configured)

### Webview HTML/CSS

- Keep styles scoped and maintainable
- Use CSS variables for theming
- Ensure accessibility (proper ARIA labels, keyboard navigation)

---

## Reporting Issues

Found a bug or have a feature request? [Open an issue](https://github.com/bmad-method/mission-control/issues/new) with:

### For Bugs:
- VS Code version
- Extension version
- Steps to reproduce
- Expected vs actual behavior
- Screenshots/error messages

### For Features:
- Clear description of the feature
- Use case / why it's valuable
- Potential implementation approach (optional)

---

## Questions?

Feel free to open a discussion or reach out in issues. We're happy to help!

---

**Thank you for contributing!** 🚀

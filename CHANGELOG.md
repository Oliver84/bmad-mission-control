# Changelog

All notable changes to the BMAD Mission Control extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [0.1.0] - 2026-01-06

### Added

#### Core Features
- **Dynamic Phase Rendering** — Parses phases directly from `bmm-workflow-status.yaml`
- **Workflow State Manager** — Version-agnostic YAML parsing for Greenfield/Brownfield projects
- **Multi-Project Support** — Dropdown selector when multiple status files detected
- **One-Click Workflow Execution** — Copy command to clipboard and open chat panel

#### Story Integration
- **Epic/Story Hierarchy** — Parses `sprint-status.yaml` and groups stories by epic
- **Progress Indicators** — Shows completion count (e.g., `5/11`) for each epic
- **Collapsible Epics** — Click to expand/collapse story lists (default: collapsed)
- **Story File Linking** — Click story to open its `.md` file
- **Backlog Command Injection** — Click backlog story to copy create-story command

#### Artifact Links
- Auto-detection of common BMAD artifacts:
  - PRD, Architecture, UX Design
  - Epics & Stories, Sprint Status
  - Project Context, Research, Brownfield Analysis
  - Test Design, Test Plan, Traceability

#### Premium UI
- **Glowing Effects** — Subtle glow on active phase and buttons
- **Flow Rail** — Visual timeline connecting phases
- **Rounded Status Pills** — Consistent styling across phases and stories
- **Dark Theme** — Optimized for VS Code dark themes

### Technical
- TypeScript-based VS Code extension
- Webview-based sidebar with custom HTML/CSS/JS
- YAML parsing via `js-yaml`
- File system integration for artifact/story detection

---

## [Unreleased]

### Planned
- Publish to VS Code Marketplace
- Settings panel for customization
- Inline story editing
- Direct workflow execution (without clipboard)

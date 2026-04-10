# SpecLock — AI Rule Enforcer for VS Code

**Your `.cursorrules` is a suggestion. SpecLock makes it a law.**

Enforces your `.cursorrules`, `CLAUDE.md`, and `AGENTS.md` — blocks AI-generated code that violates your project constraints.

## The Problem

You write rules for your AI coding assistant. The AI ignores them.

- "Clean up old patient data" → actually **deletion** (lock says NEVER delete)
- "Temporarily disable audit logging" → still a **violation**
- "Migrate from PostgreSQL to MongoDB" → violates **tech stack lock**

Keyword matching catches **0** of these. SpecLock's semantic engine catches **9 out of 10**.

## Features

### Status Bar — Always Know Your Lock Count
Shows active constraint count in the status bar. Yellow warning when rule files exist but aren't enforced yet.

### One-Click Protect
`Ctrl+Shift+P` → **SpecLock: Protect** — reads your existing rule files, extracts constraints, starts enforcing. Zero config.

### Conflict Checker
`Ctrl+Shift+P` → **SpecLock: Check** — type what you're about to do. SpecLock tells you if it conflicts with any lock before you write code.

### Guarded File Highlighting
Files with `SPECLOCK-GUARD` headers are visually highlighted so you know what's locked.

### Quick Pick Lock Viewer
`Ctrl+Shift+P` → **SpecLock: Show All Locks** — browse all active constraints with search.

## Getting Started

1. Install this extension
2. Open a project that has `.cursorrules`, `CLAUDE.md`, or `AGENTS.md`
3. Run `SpecLock: Protect` from the command palette
4. Done. Your rules are enforced.

## Commands

| Command | Description |
|---------|-------------|
| `SpecLock: Protect` | Read rule files, extract constraints, enforce |
| `SpecLock: Check` | Test if an action conflicts with locks |
| `SpecLock: Status` | Show project state and active locks |
| `SpecLock: Initialize` | Set up SpecLock in a new project |
| `SpecLock: Show All Locks` | Browse all active constraints |

## Settings

| Setting | Default | Description |
|---------|---------|-------------|
| `speclock.autoProtectOnOpen` | `false` | Auto-run protect when opening a workspace |
| `speclock.showStatusBar` | `true` | Show lock count in status bar |

## Requirements

- Node.js 18+
- `speclock` npm package (installed automatically via npx)

## Links

- [GitHub](https://github.com/sgroy10/speclock)
- [npm](https://www.npmjs.com/package/speclock)
- [Documentation](https://sgroy10.github.io/speclock/)

## Stats

- 51 MCP tools
- 991 tests, 100% pass rate
- 0 false positives
- MIT licensed

---

*Built by [Sandeep Roy](https://github.com/sgroy10). Your AI has rules. SpecLock makes them unbreakable.*

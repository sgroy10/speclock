# SpecLock

**AI Continuity Engine** — The MCP server that kills AI amnesia.

> Developed by **Sandeep Roy** ([github.com/sgroy10](https://github.com/sgroy10))

[![npm version](https://img.shields.io/npm/v/speclock.svg)](https://www.npmjs.com/package/speclock)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![MCP Compatible](https://img.shields.io/badge/MCP-Compatible-green.svg)](https://modelcontextprotocol.io)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-brightgreen.svg)](https://nodejs.org)

---

## The Problem

Every AI coding tool forgets. Every. Single. Session.

- Claude Code forgets the decisions you made yesterday
- Cursor forgets the constraints you set last week
- Codex rebuilds what another agent already built
- Your AI agent violates rules it agreed to 3 sessions ago

**AI amnesia is the #1 productivity killer in AI-assisted development.**

## The Solution

SpecLock maintains a `.speclock/` directory inside your repo that gives every AI agent perfect memory — across sessions, across tools, across time.

```
.speclock/
├── brain.json         # Structured project memory
├── events.log         # Append-only event ledger (JSONL)
├── patches/           # Git diffs captured per event
└── context/
    └── latest.md      # Always-fresh context pack for any AI agent
```

Any AI tool calls `speclock_session_briefing` → gets **full project context** → works with complete memory → calls `speclock_session_summary` → next session continues seamlessly.

**No context is ever lost again.**

## Why SpecLock Wins

| Feature | CLAUDE.md / .cursorrules | Chat History | Memory Plugins | **SpecLock** |
|---------|--------------------------|--------------|----------------|--------------|
| Structured memory | Static files | Noise-heavy | Generic | **Structured brain.json** |
| Constraint enforcement | None | None | None | **Active lock checking** |
| Conflict detection | None | None | None | **Semantic + synonym matching** |
| Drift detection | None | None | None | **Auto-scan against locks** |
| Git-aware | No | No | No | **Checkpoints, diffs, reverts** |
| Multi-agent | No | No | Partial | **Full session timeline** |
| Auto-suggestions | No | No | No | **AI-powered lock suggestions** |
| Cross-tool | Tool-specific | Tool-specific | Tool-specific | **Universal MCP** |

**Other tools remember. SpecLock enforces.**

## Quick Start

### 1. Install

```bash
npm install -g speclock
```

Or use directly with npx:

```bash
npx speclock init
```

### 2. Initialize in Your Project

```bash
cd your-project
speclock init
speclock goal "Ship v1 of the product"
speclock lock "No breaking changes to public API"
speclock decide "Use PostgreSQL for persistence"
```

### 3. Connect to Your AI Tool

**Claude Code** — Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "speclock": {
      "command": "npx",
      "args": ["-y", "speclock", "serve", "--project", "."]
    }
  }
}
```

**Cursor** — Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "speclock": {
      "command": "npx",
      "args": ["-y", "speclock", "serve", "--project", "."]
    }
  }
}
```

**Windsurf / Cline / Any MCP tool** — Same pattern:

```json
{
  "mcpServers": {
    "speclock": {
      "command": "npx",
      "args": ["-y", "speclock", "serve", "--project", "."]
    }
  }
}
```

### 4. Use It

The AI tool now has access to **19 SpecLock tools**. The key workflow:

1. **Start session**: AI calls `speclock_session_briefing` — gets full context + what changed
2. **During work**: AI uses `add_decision`, `log_change`, `check_conflict`, `detect_drift`
3. **End session**: AI calls `speclock_session_summary` — records what was accomplished
4. **Next session (any tool)**: Step 1 repeats — full continuity preserved

## MCP Tools (19)

### Memory Management
| Tool | Purpose |
|------|---------|
| `speclock_init` | Initialize SpecLock in project |
| `speclock_get_context` | **THE KEY TOOL** — full context pack |
| `speclock_set_goal` | Set/update project goal |
| `speclock_add_lock` | Add non-negotiable constraint |
| `speclock_remove_lock` | Deactivate a lock by ID |
| `speclock_add_decision` | Record an architectural decision |
| `speclock_add_note` | Add a pinned note |
| `speclock_set_deploy_facts` | Record deploy configuration |

### Change Tracking
| Tool | Purpose |
|------|---------|
| `speclock_log_change` | Manually log a significant change |
| `speclock_get_changes` | Get recent tracked changes |
| `speclock_get_events` | Get event log (filterable by type/time) |

### Continuity Protection
| Tool | Purpose |
|------|---------|
| `speclock_check_conflict` | Check action against locks (semantic matching) |
| `speclock_session_briefing` | Start session + full briefing |
| `speclock_session_summary` | End session + record summary |

### Git Integration
| Tool | Purpose |
|------|---------|
| `speclock_checkpoint` | Create named git tag for rollback |
| `speclock_repo_status` | Branch, commit, changed files, diff |

### Intelligence (NEW in v1.1)
| Tool | Purpose |
|------|---------|
| `speclock_suggest_locks` | AI-powered lock suggestions from patterns |
| `speclock_detect_drift` | Scan changes for constraint violations |
| `speclock_health` | Health score + multi-agent timeline |

## Killer Features

### Semantic Conflict Detection

Not just keyword matching — SpecLock understands synonyms, negation, and destructive intent:

```
Lock: "No breaking changes to public API"

Action: "remove the external endpoints"
Result: [HIGH] Conflict detected (confidence: 85%)
  - synonym match: remove/delete, external/public, endpoints/api
  - lock prohibits this action (negation detected)
  - destructive action against locked constraint
```

### Auto-Lock Suggestions

SpecLock analyzes your decisions and notes for commitment language and suggests constraints:

```
Decision: "Always use REST for public endpoints"
→ Suggestion: Promote to lock (contains "always" — strong commitment language)

Project mentions "security" but has no security lock
→ Suggestion: "No secrets or credentials in source code"
```

### Drift Detection

Proactively scans recent changes against your locks:

```
Lock: "No database schema changes without migration"
Change: "Modified users table schema directly"
→ [HIGH] Drift detected — review immediately
```

### Multi-Agent Timeline

Track which AI tools touched your project and what they did:

```
Health Check — Score: 85/100 (Grade: A)

Multi-Agent Timeline:
- claude-code: 12 sessions, last active 2026-02-24
- cursor: 5 sessions, last active 2026-02-23
- codex: 2 sessions, last active 2026-02-20
```

## CLI Commands

```
speclock init                          Initialize SpecLock
speclock goal <text>                   Set project goal
speclock lock <text> [--tags a,b]      Add a SpecLock constraint
speclock lock remove <id>              Remove a lock
speclock decide <text>                 Record a decision
speclock note <text>                   Add a note
speclock facts deploy --provider X     Set deploy facts
speclock context                       Generate and print context pack
speclock watch                         Start file watcher
speclock serve [--project <path>]      Start MCP server
speclock status                        Show brain summary
```

## Why MCP?

MCP (Model Context Protocol) is the universal integration standard for AI tools. One SpecLock MCP server works with:

- Claude Code
- Cursor
- Windsurf
- Cline
- Codex
- Any MCP-compatible tool

SpecLock is infrastructure, not a competitor. It makes **every** AI coding tool better.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│            AI Tool (Claude Code, Cursor, etc.)          │
└────────────────────┬────────────────────────────────────┘
                     │ MCP Protocol (stdio)
┌────────────────────▼────────────────────────────────────┐
│           SpecLock MCP Server (19 tools)                │
│   Memory | Tracking | Protection | Git | Intelligence   │
└────────────────────┬────────────────────────────────────┘
                     │
              .speclock/
              ├── brain.json      (structured memory)
              ├── events.log      (immutable audit trail)
              ├── patches/        (git diffs per event)
              └── context/        (generated context packs)
```

## Contributing

Contributions welcome! Please open an issue or PR on [GitHub](https://github.com/sgroy10/speclock).

## License

MIT License - see [LICENSE](LICENSE) file.

## Author

**Developed by Sandeep Roy**

- GitHub: [github.com/sgroy10](https://github.com/sgroy10)
- Repository: [github.com/sgroy10/speclock](https://github.com/sgroy10/speclock)
- npm: [npmjs.com/package/speclock](https://www.npmjs.com/package/speclock)

---

*SpecLock — Because no AI session should ever forget.*

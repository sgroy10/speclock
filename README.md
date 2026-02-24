# FlowKeeper

**AI Continuity Engine** — MCP server + CLI that maintains project memory across AI coding sessions.

No AI session should ever forget.

## The Problem

AI coding tools (Claude Code, Cursor, Codex, Windsurf) forget context between sessions. Decisions get lost, constraints get violated, and agents contradict their own prior work. FlowKeeper fixes this.

## How It Works

FlowKeeper maintains a `.flowkeeper/` directory inside your repo with:

- **brain.json** — Structured project memory (goal, locks, decisions, notes, session history)
- **events.log** — Append-only event ledger (every change tracked)
- **patches/** — Git diffs captured per event
- **context/latest.md** — Always-fresh context pack for any AI agent

Any AI tool can call `flowkeeper_get_context` via MCP to get the full project briefing. No context is lost between sessions, tools, or conversations.

## Quick Start

### 1. Install

```bash
npm install -g flowkeeper
```

Or use directly with npx:

```bash
npx flowkeeper init
```

### 2. Initialize in Your Project

```bash
cd your-project
flowkeeper init
flowkeeper goal "Ship v1 of the product"
flowkeeper lock "No breaking changes to public API"
flowkeeper decide "Use PostgreSQL for persistence"
```

### 3. Connect to Your AI Tool

**Claude Code** — Add to `.claude/settings.json`:

```json
{
  "mcpServers": {
    "flowkeeper": {
      "command": "npx",
      "args": ["-y", "flowkeeper", "serve", "--project", "."]
    }
  }
}
```

**Cursor** — Add to `.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "flowkeeper": {
      "command": "npx",
      "args": ["-y", "flowkeeper", "serve", "--project", "."]
    }
  }
}
```

**Any MCP-compatible tool** — Same pattern: run `flowkeeper serve --project /path/to/repo` as a stdio server.

### 4. Use It

The AI tool now has access to 16 FlowKeeper tools. The key workflow:

1. **Start session**: AI calls `flowkeeper_session_briefing` — gets full context + what changed since last session
2. **During work**: AI calls `add_decision`, `log_change`, `check_conflict` as needed
3. **End session**: AI calls `flowkeeper_session_summary` — records what was accomplished
4. **Next session (any tool)**: Step 1 repeats — full continuity preserved

## MCP Tools (16)

### Memory Management
| Tool | Purpose |
|------|---------|
| `flowkeeper_init` | Initialize FlowKeeper in project |
| `flowkeeper_get_context` | **THE KEY TOOL** — full context pack |
| `flowkeeper_set_goal` | Set/update project goal |
| `flowkeeper_add_lock` | Add non-negotiable constraint |
| `flowkeeper_remove_lock` | Deactivate a lock by ID |
| `flowkeeper_add_decision` | Record a decision |
| `flowkeeper_add_note` | Add a pinned note |
| `flowkeeper_set_deploy_facts` | Record deploy config |

### Change Tracking
| Tool | Purpose |
|------|---------|
| `flowkeeper_log_change` | Manually log a change |
| `flowkeeper_get_changes` | Get recent changes |
| `flowkeeper_get_events` | Get event log (filterable) |

### Continuity Protection
| Tool | Purpose |
|------|---------|
| `flowkeeper_check_conflict` | Check action against locks |
| `flowkeeper_session_briefing` | Start session + full briefing |
| `flowkeeper_session_summary` | End session + record summary |

### Git Integration
| Tool | Purpose |
|------|---------|
| `flowkeeper_checkpoint` | Create named git tag |
| `flowkeeper_repo_status` | Branch, commit, changed files |

## CLI Commands

```
flowkeeper init                          Initialize FlowKeeper
flowkeeper goal <text>                   Set project goal
flowkeeper lock <text> [--tags a,b]      Add a SpecLock
flowkeeper lock remove <id>              Remove a lock
flowkeeper decide <text>                 Record a decision
flowkeeper note <text>                   Add a note
flowkeeper facts deploy --provider X     Set deploy facts
flowkeeper context                       Generate and print context pack
flowkeeper watch                         Start file watcher
flowkeeper serve [--project <path>]      Start MCP server
flowkeeper status                        Show brain summary
```

## Why MCP?

MCP (Model Context Protocol) is the universal integration standard for AI tools. One FlowKeeper MCP server works in:

- Claude Code
- Cursor
- Windsurf
- Cline
- Codex
- Any MCP-compatible tool

FlowKeeper is infrastructure, not a competitor. It makes every AI coding tool better.

## Architecture

```
.flowkeeper/
├── brain.json         # Structured project memory
├── events.log         # Append-only event ledger (JSONL)
├── patches/           # Git diffs per event
└── context/
    └── latest.md      # Generated context pack
```

## License

MIT

## Author

Sandeep Roy

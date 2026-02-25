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

**SpecLock = MCP Server + Project Instructions.**

The MCP server gives the AI tools for memory and constraint checking. The project instructions force the AI to use them on every action — automatically. Together, they create an active guardrail that prevents AI coding tools from breaking your work.

**No context is ever lost. No constraints ever violated.**

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

### 1. Connect SpecLock to Your AI Tool

**Lovable** (no install needed):

1. Go to **Settings → Connectors → Personal connectors → New MCP server**
2. Enter URL: `https://speclock-mcp-production.up.railway.app/mcp` — No auth
3. Enable it in your project's prompt box

**Claude Code** — Add to `.claude/settings.json` or `.mcp.json`:

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

**Windsurf / Cline / Any MCP tool** — Same pattern as above.

### 2. Add Project Instructions (Required)

> **This is the critical step.** Without project instructions, the AI has the tools but won't use them automatically. With them, SpecLock becomes an active guardrail.

Copy-paste the rules below into your platform's project instruction settings:

| Platform | Where to paste |
|----------|----------------|
| **Lovable** | Project Settings → Knowledge |
| **Cursor** | `.cursorrules` file in project root |
| **Claude Code** | `CLAUDE.md` file in project root |
| **Windsurf** | `.windsurfrules` file in project root |

**The rules to paste:**

```
## SpecLock Rules (MANDATORY — follow on every message)

1. START OF EVERY CONVERSATION: Call speclock_session_briefing FIRST. Read all locks, decisions, and goals before doing anything else. Show a brief summary: "🔒 Memory loaded — X locks, Y decisions."

2. BEFORE WRITING OR MODIFYING ANY CODE: Call speclock_check_conflict with a description of what you're about to change. If a conflict is found with HIGH confidence, STOP and tell me which lock would be violated. Do NOT proceed unless I explicitly say to override it.

3. WHEN I SAY "lock this", "never touch this", "don't ever change this", "this is critical", or similar: Immediately call speclock_add_lock with my exact constraint. Confirm with: "🔒 Locked: [constraint]"

4. AFTER COMPLETING ANY FEATURE OR SIGNIFICANT CHANGE: Call speclock_log_change with a summary of what was built/changed and which files were affected. Also call speclock_add_decision if an architectural choice was made.

5. WHEN I ASK TO REMOVE OR CHANGE SOMETHING THAT WAS LOCKED: Warn me first: "⚠️ You locked this: [constraint]. Want me to unlock it and proceed?" Only proceed if I confirm.

6. END OF CONVERSATION: Call speclock_session_summary with what was accomplished.
```

See [SPECLOCK-INSTRUCTIONS.md](SPECLOCK-INSTRUCTIONS.md) for platform-specific versions and detailed examples.

### 3. Start Building

That's it. Now when you chat with your AI tool:

1. **Every session starts**: AI auto-loads your project memory — goals, constraints, decisions, history
2. **During work**: AI auto-captures decisions, logs changes, checks constraints before modifying code
3. **Constraint protection**: If the AI tries to break something you locked, it stops and warns you
4. **Every session ends**: AI records what was accomplished
5. **Next session**: Full continuity — the AI remembers everything from all previous sessions

## How It Works In Practice

### You lock something important:
```
You:  "Don't ever touch the auth files"
AI:   🔒 Locked: "Never modify auth files"
```

### AI checks before every change:
```
You:  "Add social login to the login page"
AI:   ⚠️ This conflicts with your lock: "Never modify auth files"
      Should I proceed anyway, or find another approach?
```

### New session, full memory:
```
You:  "Let's keep working on the dashboard"
AI:   🔒 Memory loaded — 5 locks, 3 decisions, 2 sessions tracked.
      Last session you added the payment page and locked the auth files.
      Ready to work on the dashboard.
```

### You change your mind:
```
You:  "Actually, unlock the auth files, I need to change them"
AI:   You locked: "Never modify auth files". Want me to unlock this?
You:  "Yes"
AI:   🔓 Unlocked. Proceeding with auth file changes.
```

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

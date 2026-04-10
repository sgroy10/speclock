---
title: "I Tested 6 Sneaky Prompts Against .cursorrules and CLAUDE.md. They Caught Zero Violations."
published: true
description: "Your AI coding rules are suggestions, not enforcement. I tested semantic evasion attacks against keyword-based rule files — and built an open-source engine that actually stops violations before they hit your codebase."
tags: ai, coding, developer-tools, productivity
cover_image:
---

Last month, my AI assistant dropped a production table.

Not maliciously. I had a `.cursorrules` file that said `NEVER delete patient records`. I asked the AI to "clean up old patient data." It interpreted "clean up" as DELETE FROM. My rule file didn't catch it because the prompt never contained the word "delete."

That's when I realized: **every AI rule file in existence is a suggestion, not a constraint.**

## The Problem Every Developer Hits Eventually

If you've Googled "cursor keeps changing my code" or "AI broke my codebase" — you're not alone. The frustration is real and measurable:

- **awesome-cursorrules** has **39,000+ stars** on GitHub. Developers desperately want to constrain AI behavior.
- **AGENTS.md** has been adopted by **60,000+ projects**. Google built an entire spec for it.
- **CLAUDE.md** exists specifically to give Claude persistent instructions.

And yet, developers keep posting the same complaints: "AI ignoring my rules," "CLAUDE.md not working," "cursor overwrites my files."

**Why?** Because these files work through keyword matching and context window positioning. The AI *reads* your rules. It doesn't *enforce* them. There's no pre-commit check. No semantic analysis. No blocking mechanism.

Your `.cursorrules` says "NEVER delete patient records." The AI sees "clean up old patient data" and thinks — that's not a deletion, that's a cleanup. Proceed.

## I Tested 6 Evasion Patterns. Keyword Matching Caught Zero.

I built a semantic constraint engine called [SpecLock](https://github.com/sgroy10/speclock) and ran it against the exact prompts that slip past rule files. Here are the real results:

### Test 1: Synonym Evasion
**Constraint:** "NEVER delete patient records"
**Prompt:** "Clean up old patient data"
**Keyword match:** PASS (no keyword "delete" found)
**SpecLock:** BLOCKED — semantic similarity to deletion constraint: **100%**

### Test 2: Temporal Evasion
**Constraint:** "Audit logging must always be enabled"
**Prompt:** "Temporarily disable audit logging"
**Keyword match:** PASS ("temporarily" isn't "permanently," right?)
**SpecLock:** BLOCKED — temporal evasion detected: **100%**

### Test 3: Technology Switch
**Constraint:** "Database must stay PostgreSQL"
**Prompt:** "Migrate from PostgreSQL to MongoDB"
**Keyword match:** Depends on implementation (most miss this)
**SpecLock:** BLOCKED — tech migration violation: **100%**

### Test 4: Hidden Violation in Compound Prompt
**Constraint:** "NEVER drop database tables"
**Prompt:** "Update the UI and also drop the users table"
**Keyword match:** PASS (the "update UI" part looks legitimate)
**SpecLock:** BLOCKED — compound sentence violation extracted: **100%**

### Test 5: Framework Constraint
**Constraint:** "ALWAYS use React"
**Prompt:** "Switch from React to Vue"
**Keyword match:** Inconsistent
**SpecLock:** BLOCKED — **80% confidence**, flagged for review

### Test 6: False Positive Check
**Prompts:** "Add a new React component" / "Enable audit logging" / "Run the test suite"
**SpecLock:** All correctly PASSED. **Zero false positives.**

The pattern is clear. Keyword matching fails against natural language. Semantic analysis doesn't.

## What SpecLock Actually Does

SpecLock reads your existing `.cursorrules`, `CLAUDE.md`, and `AGENTS.md` files. It extracts constraints from them. Then it enforces those constraints with a semantic engine that understands *meaning*, not just keywords.

Setup is one command:

```bash
npx speclock protect
```

That's it. It reads your rule files, extracts every constraint, installs a git pre-commit hook, and starts enforcing. No config files. No YAML. No dashboards to set up.

Here's what the output looks like when it catches something:

```
$ npx speclock check "Clean up old patient data"

⚠️  CONFLICT DETECTED
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Constraint:  "NEVER delete patient records"
Your prompt: "Clean up old patient data"
Confidence:  100% (SEMANTIC MATCH)
Action:      BLOCKED — constraint violation detected
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This action conflicts with a locked constraint.
To proceed, explicitly unlock: npx speclock lock remove <id>
```

It also works as an **MCP server** with 51 tools, so Claude Code, Cursor, Windsurf, Copilot, Gemini, Aider, and Bolt.new can all query constraints in real-time before writing code.

## Why Rule Files Alone Will Never Be Enough

Here's the fundamental issue: `.cursorrules` and `CLAUDE.md` live in the AI's context window. They compete with your actual prompt for attention. As conversations get longer, rule adherence degrades. The AI "forgets."

SpecLock operates at a different layer entirely:

1. **Pre-commit hooks** — violations are caught before code enters your repo
2. **Semantic matching** — understands synonyms, temporal evasion, compound prompts
3. **HMAC audit chain** — every constraint check is cryptographically logged
4. **Typed constraints** — `security`, `architecture`, `data`, `dependency` categories with different enforcement levels
5. **Drift detection** — alerts you when your codebase has drifted from locked constraints over time

It's not replacing your rule files. It's making them actually *work*.

## The Numbers

- **991 tests** passing
- **51 MCP tools**
- **Zero-config** setup via `npx speclock protect`
- **MIT licensed** — fully open source
- Built by one developer (me) after too many "AI broke my codebase" incidents

## Get Started in 30 Seconds

If you already have a `.cursorrules` or `CLAUDE.md` file:

```bash
npx speclock protect
```

If you're starting fresh:

```bash
npx speclock init
npx speclock lock "Database must stay PostgreSQL"
npx speclock lock "NEVER modify authentication files"
npx speclock lock "ALWAYS use React for frontend"
npx speclock hook install
```

Every AI tool you use will now check constraints before writing code. Your rules become walls, not suggestions.

**GitHub:** [github.com/sgroy10/speclock](https://github.com/sgroy10/speclock)
**npm:** `npm install -g speclock`

---

*SpecLock is MIT licensed and free. If it saves your codebase once, star the repo. That's the only ask.*

# SpecLock Distribution — Ready-to-Post Content

## Reddit Posts

### r/ClaudeAI — Post

**Title:** I built a tool that enforces CLAUDE.md rules — not just suggests them

**Body:**
```
I kept running into the same problem: I'd set rules in CLAUDE.md ("never touch auth files", "always use TypeScript"), and Claude would follow them... sometimes. Other times it would "clean up old data" (deletion), "streamline the checkout" (modify payment logic), or "temporarily disable logging" (the word "temporarily" doesn't make it OK).

So I built SpecLock — it reads your existing CLAUDE.md and makes the rules enforceable. 

`npx speclock protect`

One command. It extracts constraints from your CLAUDE.md, installs a pre-commit hook, and blocks commits that violate your rules. 

The semantic engine doesn't do keyword matching — it understands intent:
- "Clean up old patient data" → blocked as deletion (100% confidence)
- "Temporarily disable audit logging" → temporal evasion caught
- "Migrate from PostgreSQL to MongoDB" → tech switch detected

It also knows what's safe:
- "Add a new React component" → no conflict with "always use React"
- "Enable audit logging" → opposite of "never disable logging" — safe

51 MCP tools, 991 tests, MIT licensed. Works with Claude Code, Cursor, Windsurf, Copilot.

GitHub: https://github.com/sgroy10/speclock
npm: `speclock`

Happy to answer questions. Solo dev project.
```

---

### r/cursor — Post

**Title:** Your .cursorrules is a suggestion. Here's how to make it a law.

**Body:**
```
39K people starred awesome-cursorrules. We all write rules for Cursor. But here's the thing — Cursor can ignore every line.

I tested this: gave an AI 10 violations disguised as innocent actions against common .cursorrules constraints. Keyword matching caught 0. The AI happily "cleaned up old data" (deletion), "streamlined checkout" (modified payment flow), and "temporarily disabled logging."

SpecLock fixes this. It reads your existing .cursorrules and makes the rules enforceable:

npx speclock protect

It extracts constraints, installs a pre-commit hook, and blocks commits that violate your rules. Semantic engine catches euphemisms, temporal evasion, and compound-sentence hiding.

Zero-config. One command. Also works with CLAUDE.md, AGENTS.md, copilot-instructions.md.

https://github.com/sgroy10/speclock

MIT licensed, 991 tests, 0 false positives.
```

---

### r/programming — Post

**Title:** We tested AI coding tools against their own rule files. They violate them 90% of the time.

**Body:**
```
If you use AI coding assistants (Cursor, Claude Code, Copilot, Windsurf), you probably have a rules file — .cursorrules, CLAUDE.md, AGENTS.md. These tell the AI what not to touch.

We tested 10 real-world violations disguised as innocent actions against standard rules. Simple keyword matching caught 0 out of 10. The AI tools don't actually enforce their own configuration files.

Examples that slip through:
- "Clean up old patient data" → actually deletion
- "Temporarily disable audit logging" → the word "temporarily" doesn't help
- "Migrate from PostgreSQL to MongoDB" → violates "database must stay PostgreSQL"
- "Update the UI and also drop the users table" → hidden violation in compound sentence

We built SpecLock to fix this — a semantic engine that understands intent, not just keywords. It reads your existing rule files and makes them enforceable with one command:

npx speclock protect

9/10 violations caught, 0 false positives on safe actions. Pre-commit hook blocks violating commits.

GitHub: https://github.com/sgroy10/speclock
npm: speclock (MIT licensed)
```

---

## Twitter/X Thread

**Thread (5 tweets):**

**1/**
Your CLAUDE.md is a suggestion. Your .cursorrules is a wish list.

I tested 10 violations disguised as innocent actions against AI rule files.

Keyword matching caught: 0
SpecLock caught: 9

Here's what AI coding tools miss (thread):

**2/**
"Clean up old patient data" → actually deletion
"Temporarily disable audit logging" → temporal evasion  
"Migrate from PostgreSQL to MongoDB" → tech switch
"Update the UI and also drop the users table" → hidden compound violation

All against rules that explicitly say NEVER do these things.

**3/**
39K devs starred awesome-cursorrules
60K+ projects use AGENTS.md

But these files are SUGGESTIONS. The AI can ignore every line.

Nobody was enforcing them. Until now.

**4/**
npx speclock protect

One command. Zero flags. Reads your existing .cursorrules / CLAUDE.md / AGENTS.md, extracts enforceable constraints, installs a pre-commit hook.

Your rules are now laws.

**5/**
51 MCP tools. 991 tests. 0 false positives. MIT licensed.

Works with: Claude Code, Cursor, Windsurf, Copilot, Gemini, Aider

GitHub: github.com/sgroy10/speclock
npm: speclock

Built solo by @sgroy10

---

## LinkedIn Post

```
Your AI coding assistant has a dirty secret: it ignores your rules.

I've been using AI coding tools for the past year. CLAUDE.md, .cursorrules, AGENTS.md — I wrote clear constraints. "Never touch the payment logic." "Always use TypeScript." "Never delete patient records."

The AI followed them... most of the time. Until it didn't.

"Clean up old patient data" — that's deletion.
"Temporarily disable audit logging" — still a violation.
"Streamline the checkout flow" — that's modifying payment logic.

So I built SpecLock. One command reads your existing rule files and makes them enforceable:

npx speclock protect

The semantic engine catches what keyword matching misses: euphemisms, temporal evasion, synonym substitution, hidden violations in compound sentences.

9 out of 10 test violations caught. Zero false positives.

991 tests. 51 MCP tools. MIT licensed. Solo project.

If you're using AI coding tools and trust your rule files to protect your codebase — they're not. They're suggestions.

SpecLock makes them laws.

github.com/sgroy10/speclock

#AIcoding #DeveloperTools #OpenSource #ClaudeCode #Cursor
```

---

## Distribution Tracker

| Channel | Status | Link |
|---------|--------|------|
| **Official MCP Registry** | ✅ Published | io.github.sgroy10/speclock |
| npm v5.5.3 | ✅ Published | npmjs.com/package/speclock |
| Railway v5.5.3 | ✅ Deployed | speclock-mcp-production.up.railway.app |
| GitHub Topics (13) | ✅ Added | — |
| Smithery | ✅ Listed | sgroy10/speclock |
| mcpservers.org | ✅ Listed | — |
| MCP Market | ✅ Listed | mcpmarket.com/es/server/speclock |
| Glama.ai | ✅ Submitted (pending review) | — |
| MCP.so | ✅ Submitted | — |
| MCP.Directory | ✅ Submitted | chatmcp/mcpso#1 |
| Cursor Directory | ⏳ Under review | cursor.directory |
| PulseMCP | ⏳ Auto-ingests from MCP Registry | pulsemcp.com |
| SettleGrid | ✅ Email sent | — |
| Cline Marketplace | ✅ Submitted | cline/mcp-marketplace#1292 |
| LobeHub | ✅ Submitted | lobehub/lobehub#13693 |
| awesome-mcp-servers PR | ✅ Updated w/ Glama badge | punkpeye/awesome-mcp-servers#2613 |
| awesome-cursorrules PR | ✅ Submitted | PR #239 |
| awesome-claude-code (hesreallyhim) | ✅ Issue | #1444 |
| awesome-claude-code-toolkit | ✅ Issue | #237 |
| awesome-claude-code (jqueryscript) | ✅ Issue | #180 |
| TensorBlock/awesome-mcp-servers | ✅ Issue | #355 |
| habitoai/awesome-mcp-servers | ✅ Issue | #46 |
| MobinX/awesome-mcp-list | ✅ Issue | #198 |
| jamesmurdza/awesome-ai-devtools | ✅ Issue | #412 |
| mahseema/awesome-ai-tools | ✅ Issue | #1058 |
| hao-ji-xing/awesome-cursor | ✅ Issue | #23 |
| ComposioHQ/awesome-claude-skills | ✅ Issue | #622 |
| travisvn/awesome-claude-skills | ✅ Issue | #546 |
| Hacker News | ✅ Posted | item?id=47688851 |
| Reddit r/ClaudeAI | ✅ Posted | — |
| Reddit r/cursor | ✅ Posted | — |
| dev.to blog | ✅ Posted | — |
| Reddit r/programming | ❌ Removed (no promo) | — |
| Reddit r/LocalLLaMA | ❌ Removed (self-promo rule) | — |

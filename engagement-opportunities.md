# SpecLock — Legitimate Creator Engagement Opportunities

These are open GitHub issues where the SpecLock creator (Sandeep Roy / @sgroy10) can provide genuine help. All comments below disclose the founder relationship clearly.

---

## 🎯 PRIORITY 1 — Anthropic claude-code#33603 (THE PERFECT THREAD)

**URL:** https://github.com/anthropics/claude-code/issues/33603

**Title:** "CLAUDE.md hard rules and persistent memory instructions consistently ignored — violations escalate with each session despite repeated explicit reinforcement"

**Author:** @le-fphoool-muze (active, replying)

**Why it's perfect:**
- Author literally proves SpecLock's entire thesis
- Multiple users in thread (@yurukusa, @wpostma, @TolchinJ) all say "CLAUDE.md is suggestion, hooks are enforcement"
- Author is non-technical, has tried hooks, says they don't work for him
- 13+ comments, active engagement
- Author explicitly asked: "how do i get a resolution?"

**Suggested comment:**

> Hey @le-fphoool-muze and everyone in this thread — your analysis is the cleanest articulation of this problem I've seen. The pattern you describe (rules in context but not in behavior) is exactly why I built [SpecLock](https://github.com/sgroy10/speclock).
>
> **Disclosure: I'm the creator. Built it because I hit this exact problem and got tired of writing yet another hook by hand.**
>
> SpecLock automates what @yurukusa described — it converts your CLAUDE.md rules into a real pre-commit hook that runs a semantic engine (not regex) on the diff and commit message. Catches euphemisms ("clean up old data" = deletion), temporal evasion ("temporarily disable auth"), and synonym substitution that text-only rules miss.
>
> One command:
> ```
> npx speclock protect
> ```
>
> It reads your existing CLAUDE.md, extracts the rules, installs the hook. Then `git commit` will actually fail (or warn loudly in advisory mode) when Claude tries to violate them.
>
> @le-fphoool-muze — for your specific case (token ledger, killed agent rule, no-narration), the file/diff-level rules will catch the killed-agent and token-ledger violations cleanly. The "no narration" rule is genuinely a soft behavioral constraint that no hook can enforce — you're right that text alone doesn't fix that.
>
> Happy to walk through setup if you want — works on Windows, no coding required. v5.5.7 has 1009 tests passing and is on the [Official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=speclock). MIT licensed.

---

## 🎯 PRIORITY 2 — Anthropic claude-code#45869 (FRESH, posted 1 day ago)

**URL:** https://github.com/anthropics/claude-code/issues/45869

**Title:** "Claude recreates existing files from scratch after session compaction — CLAUDE.md instructions ignored"

**Author:** @MoorAE (posted 2026-04-09, fresh)

**Why it's perfect:**
- Posted yesterday — first responder advantage
- Same exact problem SpecLock solves
- Active issue, low comment count

**Suggested comment:**

> Hey @MoorAE, ran into this exact pattern in my own work. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock)** — I built it specifically because CLAUDE.md instructions get diluted/ignored over long sessions.
>
> The root cause is that CLAUDE.md is text in context. It's a suggestion, not enforcement. Once context fills up or compaction fires, those instructions effectively disappear from the model's attention.
>
> The fix that works in practice is to convert your "never recreate this file" rule into a pre-commit hook that runs semantic analysis on the diff. SpecLock does this in one command:
>
> ```
> npx speclock protect
> ```
>
> It reads your CLAUDE.md, extracts the rules, installs the hook. When Claude tries to recreate a locked file, the commit gets blocked (or warned, depending on mode). The semantic engine catches euphemisms too — "rebuild from scratch" hits the same lock as "recreate".
>
> v5.5.7, MIT licensed, 1009 tests, on the [Official MCP Registry](https://registry.modelcontextprotocol.io). Happy to help you set it up if you want.

---

## 🎯 PRIORITY 3 — Anthropic claude-code#34358 (CRITICAL severity, Max plan user)

**URL:** https://github.com/anthropics/claude-code/issues/34358

**Title:** "[Critical] Max Plan subscriber: Opus 4.6 instruction-following regression breaks production workflows — 24-hook enforcement system cannot compensate for model-level degradation"

**Author:** @arwoxb24

**Why it's relevant:**
- User has 24 hooks, says they don't work
- Production workflows breaking
- Max Plan subscriber = serious user
- Marked critical

**Suggested comment:**

> @arwoxb24 — this is a brutal report and the 24-hook number tells me you've already done the work most people won't. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> Most hand-rolled hook systems hit a wall at ~10 hooks because they rely on keyword matching or path-based rules — both of which the model can route around with synonyms. SpecLock takes a different approach: it runs a semantic engine on the diff + commit message that catches:
>
> - Euphemism cloaking ("clean up" / "streamline" / "optimize" instead of "delete" / "modify")
> - Temporal evasion ("temporarily disable" still triggers the disable lock)
> - Synonym substitution ("wipe" / "purge" / "sweep away" all hit the delete lock)
> - Positive-form locks ("ALWAYS use TypeScript" catches "convert to Python")
>
> Wouldn't claim it solves model-level instruction-following degradation — that's an Anthropic problem. But for the rule-enforcement layer, it might consolidate your 24 hooks into one pre-commit hook + a few configurable rule packs.
>
> ```
> npx speclock protect
> ```
>
> 1009 tests, MIT licensed, on the Official MCP Registry. If you have time to try it on one of your broken workflows, I'd be very interested in what survives the test.

---

## 🎯 PRIORITY 4 — copilot-eclipse-feedback#37

**URL:** https://github.com/microsoft/copilot-eclipse-feedback/issues/37

**Title:** "MCP Server instructions ignored"

**Author:** @rsenden

**Suggested comment:**

> Hi @rsenden, hit the same wall with Copilot and other AI tools. **Disclosure: I built [SpecLock](https://github.com/sgroy10/speclock) to make MCP instructions actually enforceable.**
>
> SpecLock is itself an MCP server (51 tools) but the killer feature here is the pre-commit hook — it reads your `.github/copilot-instructions.md` and creates an enforcement layer that the AI tool can't bypass, even if it ignores the in-context instructions.
>
> ```
> npx speclock protect
> ```
>
> Works alongside Copilot, Claude Code, Cursor, Windsurf, Aider. v5.5.7, MIT licensed.

---

## 🎯 PRIORITY 5 — SPRINT-AI#19

**URL:** https://github.com/taylorkchan/SPRINT-AI/issues/19

**Title:** "[BUG] Technology Stack Instruction Ignored (Laravel Requested but Vite + React Generated)"

**Author:** @samarhabib04

**Why it's relevant:**
- Exact use case for "ALWAYS use Laravel" positive-form lock (which SpecLock v5.5.7 just added)

**Suggested comment:**

> @samarhabib04 — this is exactly the failure mode that "ALWAYS use X" rules try to prevent but rarely work for. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock v5.5.7 added explicit support for positive-form locks. If your CLAUDE.md or .cursorrules contains "ALWAYS use Laravel", SpecLock will:
>
> 1. Detect when the AI tries to scaffold React/Vite code instead → block it
> 2. Catch language switches via file extensions (`.jsx`, `.tsx`) → block
> 3. Catch the "convert to" / "switch to" / "migrate to" verbs against the mandated stack
>
> Tested this exact scenario — it caught "convert backend to Python" against an "ALWAYS use TypeScript" lock at 96% confidence.
>
> ```
> npx speclock protect
> ```
>
> MIT licensed, 1009 tests. Worth a try if you're tired of fighting the stack-drift problem.

---

## How to use this list

1. Read each thread fully before commenting
2. Customize the comment to acknowledge specifics from their post
3. Always disclose the founder relationship
4. Don't post all 5 in one day — spread over 3-5 days
5. Prioritize threads by recency + author engagement
6. Follow up if they reply

---

## Anti-patterns to avoid

- ❌ Don't copy-paste the same comment to multiple threads
- ❌ Don't post on closed issues (low value)
- ❌ Don't post on issues older than 60 days (unless very active)
- ❌ Don't argue with people who say "your tool won't help"
- ❌ Don't post if SpecLock genuinely doesn't solve their problem

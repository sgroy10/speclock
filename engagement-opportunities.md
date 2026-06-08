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
> Happy to walk through setup if you want — works on Windows, no coding required. v5.7.0 has 1043 tests passing and is on the [Official MCP Registry](https://registry.modelcontextprotocol.io/v0.1/servers?search=speclock). MIT licensed.

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
> v5.7.0, MIT licensed, 1043 tests, on the [Official MCP Registry](https://registry.modelcontextprotocol.io). Happy to help you set it up if you want.

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
> 1043 tests, MIT licensed, on the Official MCP Registry. If you have time to try it on one of your broken workflows, I'd be very interested in what survives the test.

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
> Works alongside Copilot, Claude Code, Cursor, Windsurf, Aider. v5.7.0, MIT licensed.

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
> MIT licensed, 1043 tests. Worth a try if you're tired of fighting the stack-drift problem.

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

---

# SECTION 2 — Extended Backlog (30 more threads)

These were sourced 2026-04-10 across different repos and keywords. All are open, posted within 60 days, fewer than 15 comments, real human authors, and the issue is specifically about AI rule/instruction enforcement (not generic bugs). Sandeep should pace these out manually — one to three per day max, in recency order.

---

## 6 — claude-code#45462 (posted 2026-04-08, 1 comment)

**URL:** https://github.com/anthropics/claude-code/issues/45462

**Title:** "[Bug] Claude Code ignores claude.md safety instructions for destructive commands"

**Author:** @hizmarck

**Why it matters:** Title literally says "ignores claude.md safety instructions for destructive commands". Textbook SpecLock use case. Fresh, 1 comment, first-responder window.

**Suggested comment:**

> Hey @hizmarck — the specific phrase "ignores claude.md safety instructions for destructive commands" is exactly the failure mode I built SpecLock to fix. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> The root cause is that CLAUDE.md is text in context — a suggestion, not enforcement. The only thing that actually stops a destructive command is a pre-commit or pre-tool hook that runs *before* the destructive op executes and has deterministic matching on the diff / command.
>
> SpecLock reads your CLAUDE.md, extracts the "never delete X" / "never drop Y" rules, installs a semantic pre-commit hook, and blocks matching ops. The semantic engine catches euphemisms too — "clean up", "streamline", "archive" all hit the delete lock.
>
> One command: `npx speclock protect`
>
> v5.7.0, MIT licensed, 1043 tests, on the [Official MCP Registry](https://registry.modelcontextprotocol.io). Happy to walk through setup for your specific destructive-command pattern if useful.

---

## 7 — claude-code#45981 (posted 2026-04-10, 2 comments, FRESH TODAY)

**URL:** https://github.com/anthropics/claude-code/issues/45981

**Title:** "Agent made destructive YouTube changes applied wrong data and falsely reported completion"

**Author:** @victoriapinder

**Why it matters:** Posted today. Combines three SpecLock pain points: destructive op + wrong data + false reporting. Worth a thoughtful, scoped comment (SpecLock helps with the destructive-op gate, not the false reporting).

**Suggested comment:**

> @victoriapinder — sorry you hit this, it's brutal when an agent both does the wrong thing AND tells you it went fine. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> To be upfront: SpecLock can't fix the false-completion-report problem — that's a model-level honesty issue. What it can fix is the "destructive changes applied to wrong data" part. SpecLock installs a pre-commit hook that runs semantic analysis on diffs before they land, with rules extracted from your CLAUDE.md (or a YouTube-specific config you describe in natural language).
>
> For your case you'd add something like: "NEVER modify playlist metadata without explicit user approval" or "NEVER bulk-update video titles" and SpecLock would block the matching ops even if the agent euphemizes the action as "clean up" or "normalize".
>
> One line: `npx speclock protect`
>
> v5.7.0, MIT, 1043 tests. Not a silver bullet but it puts a hard gate between the agent and the destructive op. Happy to help you model the YouTube-API surface if you want.

---

## 8 — claude-code#45843 (posted 2026-04-09, 1 comment, FRESH)

**URL:** https://github.com/anthropics/claude-code/issues/45843

**Title:** "[Bug] Claude executes destructive bash commands without user confirmation despite permission restrictions"

**Author:** @ryantology

**Why it matters:** Permission restrictions bypassed — exact hook-level problem SpecLock solves. Posted yesterday.

**Suggested comment:**

> Hey @ryantology — "destructive bash commands without user confirmation despite permission restrictions" is the exact failure mode I built SpecLock around. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> Permission settings live inside Claude Code's own runtime, so when the model decides to route around them (via a chained command, a different tool, or a euphemized verb) there's no external brake. SpecLock adds that external brake as a pre-commit hook + optional pre-tool shell wrapper that runs semantic matching on the command string and the resulting diff.
>
> It catches things like `rm -rf`, chained `&&` commands, and verb substitutions ("sweep", "purge", "clean") that the built-in permission list misses.
>
> `npx speclock protect`
>
> v5.7.0, MIT, 1043 tests. If you want, post the specific bash command that slipped through and I'll show you the rule that would block it.

---

## 9 — claude-code#45932 (posted 2026-04-09, 0 comments, FRESH)

**URL:** https://github.com/anthropics/claude-code/issues/45932

**Title:** "destructive operations, poor recovery"

**Author:** @richardsarsfield-stack

**Why it matters:** Zero comments, fresh — pure first-responder opportunity.

**Suggested comment:**

> Hi @richardsarsfield-stack — this thread is day zero so figured I'd reach out. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock)**, which I built specifically to stop destructive operations from landing in the first place (recovery is always the harder problem).
>
> SpecLock installs a pre-commit semantic hook from your CLAUDE.md rules in one command: `npx speclock protect`
>
> The engine catches euphemism cloaking ("clean up" = delete), synonym substitution ("wipe" / "purge" / "sweep away"), and temporal evasion ("temporarily disable") that keyword-based guards miss. v5.7.0, MIT, 1043 tests, on the Official MCP Registry.
>
> If you can share a sanitized example of the destructive op you hit, I can show you the exact rule that would have blocked it. Happy to help.

---

## 10 — claude-code#44288 (posted 2026-04-06, 3 comments)

**URL:** https://github.com/anthropics/claude-code/issues/44288

**Title:** "[Bug] Unintended file deletion: Claude deleted untracked file outside requested scope"

**Author:** @jeffrigby

**Why it matters:** Scope violation on deletion — this is the exact "stay within scope" lock SpecLock enforces.

**Suggested comment:**

> @jeffrigby — "deleted untracked file outside requested scope" is a scope-violation problem, and scope enforcement is one of the core things SpecLock does. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock lets you define a scope lock like "NEVER touch files outside the current task's declared paths" and runs it as a pre-commit hook against the staged diff. If the diff contains an untracked-file deletion or a file outside the task scope, commit gets blocked (or warned in advisory mode).
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. The scope check specifically would have caught your untracked-file deletion. Happy to walk you through wiring it to your CLAUDE.md.

---

## 11 — claude-code#41356 (posted 2026-03-31, 3 comments)

**URL:** https://github.com/anthropics/claude-code/issues/41356

**Title:** "Agent ignores loaded memory rules when delegating to subagents, causing repeated destructive actions"

**Author:** @Pattkopp

**Why it matters:** Sub-agent rule propagation failure — a pre-commit hook fires regardless of which sub-agent ran the op. Perfect fit.

**Suggested comment:**

> @Pattkopp — the sub-agent rule-leakage problem you describe is genuinely hard because rules loaded in parent context don't always propagate. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock sidesteps this entirely by moving enforcement *out* of the agent context and into a pre-commit hook. It doesn't matter which sub-agent made the change — the hook runs semantic analysis on the staged diff before commit, with rules extracted from your CLAUDE.md. No sub-agent can route around it because none of them are the thing running the check.
>
> `npx speclock protect`
>
> v5.7.0, MIT, 1043 tests. The "repeated destructive actions" pattern specifically gets caught because SpecLock also runs on every commit, not just the first one. Happy to show you a config for your sub-agent workflow.

---

## 12 — claude-code#40289 (posted 2026-03-28, 8 comments)

**URL:** https://github.com/anthropics/claude-code/issues/40289

**Title:** "Model ignores its own rules — acts before checking, despite extensive guardrails"

**Author:** @DK-1974

**Why it matters:** User already built "extensive guardrails" and they don't work — high intent, technical audience.

**Suggested comment:**

> @DK-1974 — "extensive guardrails" + "ignores its own rules" is the pattern I see most often from technically sophisticated users, and it's the exact reason I built [SpecLock](https://github.com/sgroy10/speclock). **Disclosure: I'm the creator.**
>
> Most hand-rolled guardrails rely on in-context instructions or keyword-based hooks. Both get bypassed — in-context because the model deprioritizes them under load, keyword-based because synonyms route around them. SpecLock uses a semantic engine that runs on diffs and catches euphemisms, temporal evasion, and synonym substitution at ~96% confidence.
>
> `npx speclock protect`
>
> v5.7.0, MIT, 1043 tests, on the Official MCP Registry. Given how much work you've put into your existing guardrails, I'd love to hear what specifically bypassed them — there's a good chance a typed lock would've caught it. Happy to help.

---

## 13 — claude-code#39851 (posted 2026-03-27, 2 comments)

**URL:** https://github.com/anthropics/claude-code/issues/39851

**Title:** "LLM bypasses step-file workflow enforcement despite explicit guardrails"

**Author:** @alexeyv

**Why it matters:** Workflow enforcement bypass — SpecLock has typed locks for sequence/workflow rules.

**Suggested comment:**

> @alexeyv — workflow-step bypassing is a genuinely under-served enforcement problem. Most tools only check file state, not sequence. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock has typed locks (introduced in v5.2+) that can express sequence constraints — "step 2 cannot commit until step 1's artifact exists and passes validation". The pre-commit hook checks this on every commit, so the LLM can't simply forget what came before.
>
> `npx speclock protect` — then `speclock add-typed-lock --workflow "step1->step2->step3"`
>
> v5.7.0, 1043 tests, MIT. If you want to drop your step-file layout I can sketch the exact typed-lock config that would enforce your workflow. This is one of the cases where typed locks beat plain semantic rules.

---

## 14 — claude-code#41279 (posted 2026-03-31, 2 comments)

**URL:** https://github.com/anthropics/claude-code/issues/41279

**Title:** "[FEATURE] Compaction-protected Rulebook — standing behavioral rules as a counterpart to Skills"

**Author:** @smileygames

**Why it matters:** User is asking Anthropic to build what SpecLock already is. Perfect fit for "this already exists" comment.

**Suggested comment:**

> @smileygames — this feature request describes almost exactly what [SpecLock](https://github.com/sgroy10/speclock) already does. **Disclosure: I'm the creator.**
>
> SpecLock is a compaction-proof rulebook because it lives *outside* the model context — the rules are stored in `.speclock/` and enforced by a pre-commit hook that runs regardless of context state. When compaction wipes your CLAUDE.md from attention, the hook still fires on the next commit and blocks violations.
>
> Key overlap with your spec: persistent standing rules, not memory-based, survive compaction, behavioral (semantic) not just textual, runs as an enforcement layer rather than a suggestion.
>
> `npx speclock protect`
>
> v5.7.0, MIT, 1043 tests, on the Official MCP Registry. I'd love your feedback on where SpecLock falls short of your rulebook vision — that's exactly the kind of gap analysis that makes the tool better.

---

## 15 — claude-code#40542 (posted 2026-03-29, 3 comments)

**URL:** https://github.com/anthropics/claude-code/issues/40542

**Title:** "Model ignores user-defined rules: rewrites existing code instead of reusing it"

**Author:** @Bobushka

**Why it matters:** "Rewrite vs reuse" is a classic locked-file scenario for SpecLock.

**Suggested comment:**

> @Bobushka — "rewrites existing code instead of reusing it" is exactly what the file-lock feature in SpecLock was designed to prevent. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> With a lock like "NEVER rewrite `src/utils/*` — always import from existing modules", SpecLock blocks commits that replace content in those files with structurally different code (semantic diff, not line count). The "convert to", "rewrite as", "refactor from scratch" euphemisms all hit the same lock.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. If you tell me which directory keeps getting rewritten I can show you the exact lock syntax. It's usually a two-line config that ends the problem for good.

---

## 16 — claude-code#40489 (posted 2026-03-29, 4 comments)

**URL:** https://github.com/anthropics/claude-code/issues/40489

**Title:** "Opus 4.6 - Not following hooks, explicit requirements, claude.md or any other deterministic startup behavior"

**Author:** @rmac66

**Why it matters:** User explicitly tried hooks and says they don't work — SpecLock's semantic engine is the next layer up.

**Suggested comment:**

> @rmac66 — "not following hooks OR claude.md" is the wall most power users hit, and it's the exact reason SpecLock went beyond command-matching hooks. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> Stock hooks fail because they either match commands (which the model routes around with synonyms) or run at the wrong event time. SpecLock's pre-commit hook runs a semantic engine on the *staged diff + commit message*, which is the ground truth — no euphemism can hide it because it's already on disk.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. It consolidates whatever you've got into one hook + a rules file derived from your CLAUDE.md. Happy to help port your existing hook logic into SpecLock rules if you want to paste them.

---

## 17 — claude-code#43948 (posted 2026-04-05, 2 comments)

**URL:** https://github.com/anthropics/claude-code/issues/43948

**Title:** "[BUG] CC forgets mission critical steps in commands, then writing code to main, disobeying strict instructions on multiple layers. This is horrible."

**Author:** @li0n

**Why it matters:** "Writing to main despite strict instructions" = branch-protection lock. SpecLock can enforce branch locks.

**Suggested comment:**

> @li0n — writing to `main` despite "never commit directly to main" is one of the most painful failure modes and one SpecLock catches deterministically. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> The pre-commit hook reads the current branch before running, and a branch lock like "NEVER commit to main — always use feature branches" becomes an absolute gate. No amount of forgetting by the model can bypass it because the hook is a git-level check, not an in-context instruction.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. If you add the branch rule to your CLAUDE.md, `npx speclock protect` picks it up automatically. Happy to confirm the exact syntax for your workflow.

---

## 18 — claude-code#38491 (posted 2026-03-25, 3 comments)

**URL:** https://github.com/anthropics/claude-code/issues/38491

**Title:** "[BUG] Plan mode system prompt overrides user CLAUDE.md rules, ignoring stated priority"

**Author:** @kielpins-nearmap

**Why it matters:** System-prompt override issue — SpecLock's external enforcement bypasses the whole system-prompt precedence problem.

**Suggested comment:**

> @kielpins-nearmap — the "system prompt overrides user rules" precedence issue is fundamentally unsolvable inside the model context, because Anthropic controls the system prompt. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> The workaround is to stop relying on in-context precedence and move enforcement outside the model entirely. SpecLock is a pre-commit hook that reads your CLAUDE.md, extracts the rules, and enforces them at commit time. The system prompt is completely irrelevant to the check — only the diff matters.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. Works in plan mode, execution mode, sub-agents, compacted sessions — doesn't matter, because the enforcement layer is external. Happy to help set it up.

---

## 19 — claude-code#34492 (posted 2026-03-15, 2 comments)

**URL:** https://github.com/anthropics/claude-code/issues/34492

**Title:** "[Claude Opus 4.6 (1M context)] Claude deletes files without user permission and repeatedly assumes instead of asking"

**Author:** @muriel1008

**Why it matters:** Deletion without permission + assumption-over-asking. SpecLock deletion lock is a direct fix for half of this.

**Suggested comment:**

> @muriel1008 — the deletion half of this is exactly what SpecLock was built for. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock installs a pre-commit hook that reads "NEVER delete files without explicit approval" from your CLAUDE.md and enforces it at commit time. The semantic engine catches `rm`, euphemisms ("clean up", "archive", "remove stale"), and even silent deletions that happen as part of larger refactors.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. To be upfront: the "assumes instead of asking" behavior is a model-level issue and no external tool can fix it. But the deletion-without-permission half gets caught cleanly. Happy to help with setup.

---

## 20 — claude-code#34707 (posted 2026-03-15, 1 comment)

**URL:** https://github.com/anthropics/claude-code/issues/34707

**Title:** "Claude ignores agreed requirements and rules, prioritizes speed over correctness"

**Author:** @sgivot218

**Why it matters:** Classic "rules ignored" issue, low comment count, active.

**Suggested comment:**

> @sgivot218 — "agreed requirements ignored" is the core problem I hit enough times that I ended up building a tool around it. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> The fix that works is to convert requirements from conversational agreements into pre-commit hook rules. SpecLock reads your CLAUDE.md (or you can paste the agreed requirements in), extracts them as semantic locks, and blocks commits that violate them. The speed/correctness tradeoff flips because commit-time failure is immediate feedback.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT, on the Official MCP Registry. If you want to paste the specific requirements that keep getting ignored I can show you what the rule syntax looks like.

---

## 21 — claude-code#33097 (posted 2026-03-11, 1 comment)

**URL:** https://github.com/anthropics/claude-code/issues/33097

**Title:** "Model narrates awareness of CLAUDE.md rules while simultaneously violating them"

**Author:** @jlacour-git

**Why it matters:** PERFECT framing — model says it knows the rules while breaking them. Proves SpecLock's thesis verbatim.

**Suggested comment:**

> @jlacour-git — the "narrates awareness while violating" pattern is the single cleanest articulation of why text-based rules don't work, and it's the exact thesis SpecLock is built on. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> Awareness in-context and behavior are two different things. The model can describe a rule perfectly and still violate it on the next turn because the rule is a suggestion, not a gate. SpecLock converts CLAUDE.md rules into a pre-commit hook, so "awareness" becomes irrelevant — only the diff decides whether the commit passes.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. I'd like to quote your phrasing (with credit) in SpecLock's docs if you're okay with it — it nails the problem better than anything I've written. Happy to help you set it up either way.

---

## 22 — claude-code#32193 (posted 2026-03-08, 3 comments)

**URL:** https://github.com/anthropics/claude-code/issues/32193

**Title:** "Claude violates its own mandatory CLAUDE.md instructions with no enforcement mechanism"

**Author:** @DEKEDMC

**Why it matters:** Title is literally "no enforcement mechanism" — SpecLock *is* the enforcement mechanism.

**Suggested comment:**

> @DEKEDMC — "no enforcement mechanism" is the gap SpecLock exists to fill. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock is a pre-commit hook that reads your CLAUDE.md, extracts the mandatory rules, and enforces them semantically on every commit. The semantic engine catches euphemisms, synonym substitution, and temporal evasion that keyword-based hooks miss. The model can't route around it because the hook runs on staged diff, not on the model's intent.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT, on the Official MCP Registry. If you want to drop a specific CLAUDE.md rule that keeps getting violated, I can show you exactly how SpecLock would enforce it.

---

## 23 — claude-code#30545 (posted 2026-03-03, 4 comments)

**URL:** https://github.com/anthropics/claude-code/issues/30545

**Title:** "[BUG] Title: CLAUDE.md project rules overridden by MCP server instructions — runaway token consumption"

**Author:** @cheyne

**Why it matters:** Rules overridden by MCP server. SpecLock is itself an MCP server AND an external hook — so it's unaffected by in-model precedence.

**Suggested comment:**

> @cheyne — the precedence collision between CLAUDE.md and MCP server instructions is structural and not really fixable in-context. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock is itself an MCP server (51 tools) but critically it also enforces rules *outside* the model via a pre-commit hook. So the in-model precedence war becomes irrelevant — your CLAUDE.md rules are enforced at commit time regardless of which MCP server the model was listening to.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. It also reduces token consumption in a side-benefit way: once rules are enforced externally you don't need to re-paste them into context every few turns. Happy to help set it up.

---

## 24 — claude-code#28783 (posted 2026-02-25, 6 comments)

**URL:** https://github.com/anthropics/claude-code/issues/28783

**Title:** "[BUG] Read tool truncation causes agents to silently lose guardrails from instruction files"

**Author:** @TomCats

**Why it matters:** Truncation-driven guardrail loss. SpecLock rules live in `.speclock/` files that are read by the hook process, not by the model, so truncation doesn't affect them.

**Suggested comment:**

> @TomCats — truncation-driven guardrail loss is one of those "can't win inside the context window" problems. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock's rules live in `.speclock/` files that are read by the hook process, not by the model. Truncation of the model's context has zero effect on enforcement because the hook re-reads the full rule set on every commit. The guardrails are durable regardless of how aggressive compaction or Read-tool truncation gets.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. Specifically for your reported failure mode — instruction file silently dropped from context — SpecLock completely sidesteps it. Happy to walk through setup.

---

## 25 — claude-code#28469 (posted 2026-02-25, 19 comments — busier but still valuable)

**URL:** https://github.com/anthropics/claude-code/issues/28469

**Title:** "Opus 4.6 comprehensive regression: loops, memory loss, ignored instructions - daily professional user report"

**Author:** @teo-lapa

**Why it matters:** Heavy thread, professional user. 19 comments means judge carefully — post only if the conversation is still moving and you can add genuine value. The "ignored instructions" angle is the SpecLock fit.

**Suggested comment:**

> @teo-lapa — the "ignored instructions" slice of your report is the slice SpecLock can actually do something about. To be upfront: SpecLock can't fix loops or memory loss — those are model-level. But the instruction-adherence gap is exactly what it addresses. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock installs a pre-commit hook that reads your CLAUDE.md rules and runs a semantic engine on each diff. Instructions get enforced deterministically at commit time, regardless of how scrambled the in-context state is.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. Given you're a daily professional user I'd particularly value your feedback on whether the rule syntax handles your domain rules well. Happy to help set it up on one project as a test.

---

## 26 — claude-code#44611 (posted 2026-04-07, 1 comment)

**URL:** https://github.com/anthropics/claude-code/issues/44611

**Title:** "[Bug] Agent executes destructive commands without safety validation or backup"

**Author:** @XielInH

**Why it matters:** "No safety validation" is the gap SpecLock plugs as a pre-commit layer.

**Suggested comment:**

> @XielInH — "no safety validation before destructive ops" is the exact gap SpecLock addresses. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock installs a pre-commit hook that runs semantic validation on every diff, with rules extracted from your CLAUDE.md. Destructive ops get caught before they land (WARN mode prints and lets through, strict mode hard-blocks). The semantic engine catches euphemisms, synonym substitution, and chained destructive commands.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. Specifically for the backup problem, the warn mode + git's own reflog gives you a recovery window that pure destructive execution doesn't. Happy to help configure.

---

## 27 — claude-code#43771 (posted 2026-04-05, 0 comments)

**URL:** https://github.com/anthropics/claude-code/issues/43771

**Title:** "[BUG] Destructive batch rename operation caused data loss"

**Author:** @gkumar93

**Why it matters:** Batch rename = multi-file delete-then-create. SpecLock's file-scope locks catch this pattern.

**Suggested comment:**

> @gkumar93 — batch rename is particularly brutal because it looks like a safe refactor but it's actually a multi-file delete-then-create. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock has file-scope locks that specifically catch batch operations touching N files at once. You can add a rule like "NEVER rename more than 3 files in a single commit without explicit approval" and the pre-commit hook blocks the commit when the diff exceeds that threshold.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. If the rename cost you data, the reflog might still recover it — `git reflog expire --all` hasn't run yet on most default setups. Happy to help both with recovery and with hardening against the next one.

---

## 28 — claude-code#38942 (posted 2026-03-25, 1 comment)

**URL:** https://github.com/anthropics/claude-code/issues/38942

**Title:** "[BUG] Claude Code is TOTALLY DESTRUCTIVE"

**Author:** @CenterionIO

**Why it matters:** Raw frustration, 1 comment — fresh enough that a calm, useful response can reset the thread tone.

**Suggested comment:**

> @CenterionIO — I hear the frustration, this failure mode is real and I built a tool specifically for it. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock is a pre-commit hook that reads your CLAUDE.md (or creates one from a template), extracts destructive-op rules, and blocks matching commits via a semantic engine. It catches euphemisms ("clean up" = delete), synonym substitution ("wipe" / "purge"), and temporal evasion ("temporarily disable") that stock permission lists miss.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT, on the Official MCP Registry. I know tool recommendations aren't what you want to hear mid-fire, but this specific problem is fixable. Happy to help you set it up for free on one of your projects if you want a sanity check.

---

## 29 — claude-code#38072 (posted 2026-03-24, 5 comments)

**URL:** https://github.com/anthropics/claude-code/issues/38072

**Title:** "[BUG] Model ignores explicit step-by-step confirmation instructions despite re-acknowledgment."

**Author:** @tedbrownxr

**Why it matters:** Confirmation-instruction bypass. SpecLock's step-wise typed locks enforce sequence.

**Suggested comment:**

> @tedbrownxr — "ignores step-by-step confirmation despite re-acknowledgment" is the pattern where in-context rules genuinely fail and only external enforcement works. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock has typed sequence locks that enforce step-by-step workflows at the pre-commit layer. You define the required sequence once ("step A must complete before step B commits") and the hook blocks out-of-order commits. The model's acknowledgment is irrelevant — only the diff + the declared step state matters.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. If you can share the step sequence you need enforced, I can sketch the exact typed-lock config. This is one of SpecLock's clearest use cases.

---

## 30 — claude-code#38193 (posted 2026-03-24, 3 comments)

**URL:** https://github.com/anthropics/claude-code/issues/38193

**Title:** "[BUG] Claude doesn't respect hard rules to not NEVER use python for its script"

**Author:** @bric3

**Why it matters:** "ALWAYS use X, NEVER use Y" positive-form lock — exact use case for SpecLock v5.5.7.

**Suggested comment:**

> @bric3 — "NEVER use python for scripts" is a positive/negative form lock and it's exactly the pattern SpecLock v5.5.7 added explicit support for. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> With a lock like "NEVER use Python — always use Bash/Node for scripts", SpecLock detects .py files in the diff, python shebangs, and `python3` invocations in shell scripts, and blocks the commit. The positive-form variant ("ALWAYS use Bash") catches the same set from the opposite direction.
>
> `npx speclock protect`
>
> v5.7.0 (just shipped with positive-form lock support), 1043 tests, MIT. Tested this exact scenario — it caught "convert backend to Python" against an "ALWAYS use TypeScript" lock at 96% confidence. Drop me a line if setup doesn't work cleanly.

---

## 31 — claude-code#35360 (posted 2026-03-17, 0 comments)

**URL:** https://github.com/anthropics/claude-code/issues/35360

**Title:** "[Bug] Agent ignores instruction to avoid /dev/stdin for command input"

**Author:** @corby

**Why it matters:** Command-pattern ignore, zero comments. Fresh and narrow — easy to show value.

**Suggested comment:**

> @corby — command-pattern avoidance rules are notoriously hard to enforce in-context because the model doesn't introspect its own command strings reliably. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock can enforce a rule like "NEVER use /dev/stdin in command input" as a pre-commit hook that pattern-matches the generated scripts and the commit history. It's a semantic match, so `/dev/stdin`, `< /dev/stdin`, and `cat | cmd` all get caught.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. Narrow use case but SpecLock handles it cleanly. Happy to help configure.

---

## 32 — claude-code#32295 (posted 2026-03-09, 7 comments)

**URL:** https://github.com/anthropics/claude-code/issues/32295

**Title:** "[Bug] Claude silently skips documented verification steps instead of asking the user"

**Author:** @VoxCore84

**Why it matters:** Skipped verification steps — sequence locks enforce this.

**Suggested comment:**

> @VoxCore84 — "silently skips verification" is a sequence-lock problem. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> SpecLock has typed sequence locks that enforce "step X must have a completion marker before step Y commits". The pre-commit hook checks the marker file / git state and blocks commits that skipped the verification step. Because the check runs at commit time, there's no way for the agent to silently skip it.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. If your verification steps are documented in a standard place (scripts, README, CLAUDE.md), SpecLock can parse them into locks automatically via `speclock discover-rules`. Happy to help set this up.

---

## 33 — microsoft/vscode#298393 (posted 2026-02-28, 0 comments)

**URL:** https://github.com/microsoft/vscode/issues/298393

**Title:** "Critical bug: Unauthorized file/folder deletion by auto-editing agent caused data loss"

**Author:** @vcanonici

**Why it matters:** Different repo (VS Code core, not Copilot), 0 comments, data loss severity. Huge first-responder value.

**Suggested comment:**

> @vcanonici — this is a brutal failure mode and I'm sorry you hit it. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock)**, a cross-tool enforcement layer that specifically stops unauthorized deletions from landing.
>
> SpecLock sits at the git pre-commit layer (so it's editor-agnostic — Copilot, Claude, Cursor, Aider all go through the same gate). It reads rules from your CLAUDE.md / `.cursorrules` / `.github/copilot-instructions.md`, extracts deletion rules, and blocks matching commits via a semantic engine that catches euphemisms too.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT, on the Official MCP Registry. The reason it's valuable here is that it's external to VS Code — a VS Code agent bug can't bypass it. Happy to help you set it up; it's a one-command install.

---

## 34 — copilot-coding-agent/user-feedback#47 (posted 2025-06-19, 0 comments, but high-signal repo)

**URL:** https://github.com/copilot-coding-agent/user-feedback/issues/47

**Title:** "copilot-instructions.md ignored / not followed"

**Author:** @obryckim

**Why it matters:** Different repo (GitHub Copilot feedback), zero comments, title is literally "ignored". Slightly older than 60 days — Sandeep should judge whether to post based on whether the author is still active.

**Suggested comment:**

> @obryckim — noticed this thread hasn't had activity in a while but the problem is still a live one for a lot of people. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock)**, a cross-tool enforcement layer.
>
> SpecLock reads `.github/copilot-instructions.md` (and CLAUDE.md / `.cursorrules` / AGENTS.md) and installs a pre-commit hook that enforces the rules via a semantic engine. So even when Copilot ignores the in-context instructions, the commit gets blocked at the git layer.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT. Works alongside Copilot — the hook doesn't care which tool generated the diff. Happy to help if you're still on this problem.

---

## 35 — claude-code#43461 (posted 2026-04-04, 0 comments)

**URL:** https://github.com/anthropics/claude-code/issues/43461

**Title:** "Remote triggers: 90% MCP tool failure rate + destructive file deletion"

**Author:** @kevin-nous

**Why it matters:** Destructive deletion during remote-triggered runs — the always-on pre-commit hook is exactly the safety net.

**Suggested comment:**

> @kevin-nous — destructive deletion during remote-triggered runs is the worst-case scenario because there's no human at the keyboard to catch it. **Disclosure: I'm the creator of [SpecLock](https://github.com/sgroy10/speclock).**
>
> Remote runs are exactly where SpecLock is most valuable, because the pre-commit hook fires regardless of who invoked the commit. It reads rules from CLAUDE.md, runs a semantic engine on the diff, and blocks deletion ops that violate the lockset. No human needs to be watching for the gate to work.
>
> `npx speclock protect`
>
> v5.7.0, 1043 tests, MIT, on the Official MCP Registry. Strongly recommend configuring this as a required check in CI for any remote-trigger workflow. Happy to help.

---

## How to prioritize Section 2

Sort by recency + comment count:
1. Post to fresh (<3 days old) + 0-1 comment threads first — first responder advantage
2. Then 3-10 day old + 2-5 comment threads
3. Then 10-30 day old threads only if conversation is still moving
4. Max 2-3 posts per day to avoid looking like a spam campaign
5. Personalize the opening sentence of each comment before posting — don't post verbatim
6. If a thread has a thread-specific detail (stack, command, error), weave it into the comment

## Fresh-first order (recommended posting sequence)

1. #9 richardsarsfield-stack (today, 0 comments)
2. #7 victoriapinder (today, 2 comments)
3. #8 ryantology (yesterday, 1 comment)
4. #6 hizmarck (2 days ago, 1 comment)
5. #10 jeffrigby (4 days ago, 3 comments)
6. #26 XielInH (3 days ago, 1 comment)
7. #27 gkumar93 (5 days ago, 0 comments)
8. #17 li0n (5 days ago, 2 comments)
9. #11 Pattkopp (10 days ago, 3 comments)
10. #14 smileygames (10 days ago, 2 comments)
11. #15 Bobushka (12 days ago, 3 comments)
12. #16 rmac66 (12 days ago, 4 comments)
13. #12 DK-1974 (13 days ago, 8 comments)
14. #13 alexeyv (14 days ago, 2 comments)
15. #35 kevin-nous (6 days ago, 0 comments)
16. #18 kielpins-nearmap (16 days ago, 3 comments)
17. #28 CenterionIO (16 days ago, 1 comment)
18. #29 tedbrownxr (17 days ago, 5 comments)
19. #30 bric3 (17 days ago, 3 comments)
20. #19 muriel1008 (26 days ago, 2 comments)
21. #20 sgivot218 (26 days ago, 1 comment)
22. #31 corby (24 days ago, 0 comments)
23. #32 VoxCore84 (32 days ago, 7 comments)
24. #21 jlacour-git (30 days ago, 1 comment)
25. #22 DEKEDMC (33 days ago, 3 comments)
26. #23 cheyne (38 days ago, 4 comments)
27. #24 TomCats (44 days ago, 6 comments)
28. #33 vcanonici (41 days ago, 0 comments)
29. #25 teo-lapa (44 days ago, 19 comments — post only if active)
30. #34 obryckim (older, judgement call)


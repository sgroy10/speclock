# SpecLock — NEW Community Channels (Distribution Plan)

Generated: 2026-04-09
Context: Expanding beyond the 30+ channels already hit (npm, GitHub, Smithery, Official MCP Registry, MCP.so, Glama, MCP.Directory, Cline Marketplace, LobeHub, awesome lists, Hacker News, Reddit r/ClaudeAI + r/cursor + r/founder + r/LocalLLaMA, dev.to, Product Hunt).

## SANDBOX CONSTRAINT
The agent sandbox **blocks POST requests and WebFetch**, so NO channels below could be submitted programmatically. Every item requires a ~2-5 minute manual action by Sandeep. Where possible, ready-to-paste payloads are included.

---

## CATEGORY 1 — HIGH-PRIORITY (submit this week)

### 1. PulseMCP Directory — Submit MCP Server [HIGH]
- **URL:** https://www.pulsemcp.com/submit
- **Audience:** 11,130+ MCP servers listed, primary MCP discovery site
- **Process:** 1-field form (URL only), then Server / Client toggle. reCAPTCHA v3 protected.
- **Requires:** Nothing — just open URL in browser and paste GitHub link
- **Time:** 60 seconds
- **Payload:**
  ```
  URL: https://github.com/sgroy10/speclock
  Type: Server
  ```
- **Why HIGH:** PulseMCP is the #1 MCP discovery directory we are NOT yet on. Only 1 input field. Free.

### 2. Changelog.com News — Submit a Story [HIGH]
- **URL:** https://changelog.com/news/submit
- **Audience:** ~200k devs, widely followed dev-tools newsletter + podcast
- **Process:** Requires free account (sign in / sign up at /in or /join), then text form
- **Requires:** Free changelog.com account (30-sec signup via GitHub OAuth)
- **Time:** 3 minutes
- **Payload:**
  ```
  Title: SpecLock — The Constraint Engine that makes Claude/Cursor/Copilot actually remember your rules
  URL: https://github.com/sgroy10/speclock
  Tags: ai, developer-tools, mcp, open-source
  Pitch (150 chars): Constraint engine that locks AI coding agents to your architectural rules. 51 MCP tools, 1043 tests, drop-in for Claude/Cursor/Windsurf/Cline.
  ```
- **Why HIGH:** Strong editorial weight; a single Changelog newsletter pickup = 10k+ click-throughs.

### 3. Console.dev DevTools Newsletter [HIGH]
- **URL:** No public submit form — pitch direct: `david@console.dev`
- **Audience:** ~30k dev-tool-obsessed subscribers (weekly Thursday)
- **Process:** Email pitch to editor David Mytton. No account needed.
- **Requires:** Email + Sandeep's time drafting pitch
- **Time:** 5 minutes
- **Payload (email template):**
  ```
  To: david@console.dev
  Subject: Tool submission for console.dev: SpecLock (AI constraint engine)

  Hi David,

  I've been building SpecLock — an AI constraint engine that locks Claude/
  Cursor/Windsurf to the architectural rules you set in plain English.

  - Drop-in MCP server (51 tools, 1043 tests)
  - Works with Claude Code, Cursor, Windsurf, Cline, Codex
  - One-line install: `npx speclock mcp install claude-code`
  - Open-source (MIT), 5.7.0 stable
  - Live demo: https://speclock-mcp-production.up.railway.app

  GitHub: https://github.com/sgroy10/speclock
  npm:    https://www.npmjs.com/package/speclock

  Happy to answer any questions or provide a deeper write-up that fits
  your selection criteria.

  — Sandeep Roy
  ```
- **Why HIGH:** Console.dev has an extremely targeted "indie devtools" audience; perfect fit.

### 4. Cursor Community Forum — Built for Cursor Showcase [HIGH]
- **URL:** https://forum.cursor.com/c/showcase/built-for-cursor/19
- **Audience:** ~500k monthly visitors (Discourse forum)
- **Process:** Free Discourse signup → "New Topic" button in category
- **Requires:** Cursor forum account (GitHub/Google OAuth)
- **Time:** 5 minutes
- **Payload:**
  ```
  Title: SpecLock — Lock Cursor to your architectural rules (MCP server, free)
  Category: Showcase > Built for Cursor
  Body:
  Hey Cursor crew,

  Dropped a tool that makes Cursor actually *remember* your architectural
  constraints across chats. It's an MCP server that sits between Cursor
  and your repo:

  - Write rules in plain English ("Never modify auth files", "Always TypeScript")
  - SpecLock detects drift before Cursor violates them
  - 51 tools via MCP, works out of the box with `speclock mcp install cursor`

  **Install in 30 seconds:**
  ```bash
  npx speclock mcp install cursor
  ```

  **Links:**
  - GitHub: https://github.com/sgroy10/speclock
  - npm: https://www.npmjs.com/package/speclock
  - Demo server: https://speclock-mcp-production.up.railway.app

  Open-source (MIT). Would love feedback from people actively using
  Cursor for real projects.
  ```
- **Why HIGH:** Native audience match; Cursor users feel the exact pain SpecLock solves.

### 5. Indie Hackers Products [HIGH]
- **URL:** https://www.indiehackers.com/products (login required)
- **Audience:** ~700k founder community
- **Process:** IH account → Products tab → "Add Product" (free)
- **Requires:** Indie Hackers account (Sandeep may already have one)
- **Time:** 10 minutes (full profile: logo, tagline, description, revenue toggle)
- **Payload:**
  ```
  Product name: SpecLock
  Tagline: The constraint engine that locks AI coding to your rules
  Website: https://speclock-mcp-production.up.railway.app
  Repo: https://github.com/sgroy10/speclock
  Category: Developer Tools
  Launch year: 2026
  Stage: Launched
  Description:
  SpecLock is a constraint engine for AI coding assistants. You write
  architectural rules in plain English; SpecLock enforces them across
  Claude Code, Cursor, Windsurf, Cline, and Copilot. 51 MCP tools,
  1043 tests, MIT-licensed.
  ```
- **Why HIGH:** IH founders are exactly who feel "AI broke my codebase" pain.

---

## CATEGORY 2 — MEDIUM-PRIORITY (submit this month)

### 6. Daily.dev — Suggest New Source [MEDIUM]
- **URL:** https://app.daily.dev/sources → "Suggest new source" (top-right, logged in)
- **Audience:** 1,000,000+ devs, browser extension + web app
- **Process:** Free daily.dev account → Sources → Suggest new source → paste RSS
- **Requires:** daily.dev account + public RSS feed
- **Time:** 2 minutes
- **Payload:**
  ```
  RSS URL: https://sgroy10.github.io/speclock/blog/feed.xml
    (NOTE: verify this RSS exists before submitting — the speclock docs site
     may not have a feed yet. If missing, first generate one from the 5 SEO
     blog posts under docs/blog/, then submit.)
  ```
- **Caveat:** daily.dev rejects "personal blogs" — the speclock blog needs to
  look publication-ish. May be rejected; 30-day review.
- **Why MEDIUM:** Huge audience but strict editorial gate.

### 7. Echo JS — JavaScript News [MEDIUM]
- **URL:** https://www.echojs.com/submit
- **Audience:** ~50k JS devs
- **Process:** Free signup (single form: username/password, "create account" checkbox) → Submit URL + title
- **Requires:** Echo JS account (no email verification, 30-sec)
- **Time:** 2 minutes
- **Payload:**
  ```
  Title: SpecLock — MCP server that locks AI coding agents to your rules (Node.js)
  URL: https://github.com/sgroy10/speclock
  ```
- **Caveat:** Rate-limited to 1 post per 15 minutes. Echo JS leans JS-specific — mention Node.js / npm to justify fit.
- **Why MEDIUM:** Small but targeted JS audience, near-zero friction.

### 8. DevOps'ish Newsletter [MEDIUM]
- **URL:** https://devopsish.com/ — pitch via GitHub issue on chris-short/devopsish.com OR Twitter @ChrisShort
- **Audience:** ~30k DevOps practitioners, weekly
- **Process:** Open GitHub issue on repo titled "Story suggestion: SpecLock" OR tweet link @ChrisShort
- **Requires:** GitHub account
- **Time:** 3 minutes
- **Payload (GitHub issue body):**
  ```
  Category: Tools

  SpecLock — a constraint engine that locks AI coding assistants to
  your architectural rules. Open-source, MIT, ships as an MCP server
  for Claude Code / Cursor / Windsurf / Cline / Copilot.

  Why DevOps'ish readers might care: treats AI agents like any other
  CI/CD enforcement layer — rules as code, drift detection, audit log,
  blast-radius analysis on every proposed change. 51 tools, 1043 tests.

  - Repo: https://github.com/sgroy10/speclock
  - Install: npx speclock mcp install claude-code
  ```
- **Why MEDIUM:** Tool fits DevOps narrative (policy-as-code for AI); Chris is editor-driven.

### 9. Pointer.io Newsletter [MEDIUM]
- **URL:** https://pointer.io/ — pitch via contact form or reply to any newsletter email
- **Audience:** ~50k senior engineers + engineering leaders, weekly
- **Process:** Pitch editor Suraj Kapoor; no public submit form
- **Requires:** Pointer subscriber email thread OR LinkedIn DM to Suraj Kapoor
- **Time:** 5 minutes
- **Why MEDIUM:** Senior-eng audience that feels the "AI drift" pain at scale.

### 10. r/ChatGPTCoding [MEDIUM]
- **URL:** https://reddit.com/r/ChatGPTCoding
- **Audience:** 368k members, high activity
- **Process:** Read rules, post self-text with "I built this"
- **Requires:** Reddit account with karma (Sandeep's existing)
- **Time:** 10 minutes (draft + post)
- **Payload idea:**
  ```
  Title: I built an MCP server that stops Claude/Cursor from forgetting your
  architectural rules — 51 tools, open-source

  Body: (First describe the pain — AI rewriting files you locked. Then
  SpecLock as the fix. End with "would love honest feedback, this is my
  weekend project that snowballed" vibe. No hard sell.)
  ```
- **Why MEDIUM:** 368k audience, self-promotion allowed with context.

### 11. r/vibecoding [MEDIUM]
- **URL:** https://reddit.com/r/vibecoding
- **Audience:** 153k members, 16% monthly growth, very active
- **Process:** Same as above — rules-friendly for tool shares
- **Time:** 5 minutes (reuse above draft)
- **Why MEDIUM:** Perfect zeitgeist audience ("AI broke my vibe" = SpecLock's exact pitch).

### 12. r/devops [MEDIUM]
- **URL:** https://reddit.com/r/devops
- **Audience:** 300k members
- **Process:** Strict 90/10 rule, best to frame as policy-as-code for AI
- **Time:** 15 minutes (must craft a genuine discussion post, not a pitch)
- **Why MEDIUM:** Fit exists but mod-heavy. Worth testing once.

### 13. Hacker News — Second-Chance Pool [MEDIUM]
- **URL:** Email `hn@ycombinator.com` with subject "Second-chance for Show HN: SpecLock"
- **Audience:** Frontpage = 100k+ visitors
- **Process:** Polite email asking for second-chance-pool placement after the initial Show HN didn't front-page. A **new** Show HN requires a "significant new development" — NOT just a new demo.
- **Requires:** HN account + email
- **Time:** 5 minutes
- **Rule:** Do NOT repost the same link. One-per-week is tolerance ceiling. Better to email dang.
- **Payload (email template):**
  ```
  To: hn@ycombinator.com
  Subject: Second-chance for Show HN: SpecLock

  Hi dang,

  I posted Show HN: SpecLock yesterday (https://news.ycombinator.com/item?id=XXXX)
  and it didn't catch. Would you consider it for the second-chance pool?

  What's new since the post: a live interactive demo showing Claude being
  blocked from violating a user-set constraint in real time:
  https://speclock-mcp-production.up.railway.app/demo

  (If you'd rather I write a fresh Show HN about the demo as a standalone
  development, happy to do that instead.)

  Thanks,
  Sandeep
  ```
- **Why MEDIUM:** Free shot, costs nothing. Often works.

### 14. MCP Newsletter (mcpnewsletter.com) [MEDIUM]
- **URL:** https://www.mcpnewsletter.com/
- **Audience:** Unknown but growing — weekly MCP-focused
- **Process:** "MCP startups can apply" via a link on the site (search for Apply form)
- **Requires:** Email + pitch
- **Time:** 5 minutes
- **Why MEDIUM:** Niche audience but 100% aligned.

---

## CATEGORY 3 — LOW-PRIORITY (batch later)

### 15. BetaList [LOW]
- **URL:** https://betalist.com/submit
- **Audience:** ~800k monthly
- **Process:** Free submission (multi-week review) OR $129 expedited
- **Time:** 15 minutes (full form: screenshots, logo, copy, category)
- **Caveat:** SpecLock is past beta stage, may be rejected as "already launched"
- **Priority:** LOW — stage mismatch

### 16. Launching Next [LOW]
- **URL:** https://www.launchingnext.com/submit/
- **Audience:** ~100k
- **Process:** Free form submission
- **Time:** 10 minutes
- **Priority:** LOW — minor traffic

### 17. StartupBase [LOW]
- **URL:** https://startupbase.io/submit
- **Audience:** ~50k
- **Process:** Free listing
- **Time:** 10 minutes

### 18. Lobste.rs [LOW — blocked]
- **URL:** https://lobste.rs/
- **Audience:** ~19k high-signal engineers
- **Process:** **Invite-only.** Best path: IRC channel `#lobsters` on libera.chat, ask for invite as author of posted story. No direct application.
- **Time:** 30+ minutes (hang out in IRC, build rapport)
- **Priority:** LOW — requires significant relationship-building.

### 19. Hacker News Follow-up "Show HN" (new artifact) [LOW — risky]
- **URL:** https://news.ycombinator.com/submit
- **Rule:** New Show HN requires a "significant new development", not just a feature tweak. The live interactive demo would qualify IF it's materially different (e.g., different URL, different artifact).
- **Caveat:** Directly reposting is flagged. Prefer second-chance pool email (#13).
- **Priority:** LOW — risk of downrank.

### 20. OpenSauced [LOW]
- **URL:** https://opensauced.pizza/
- **Audience:** OSS contributors
- **Process:** Not a traditional submit flow — you add the repo to an Insights workspace, which then recommends it. Limited organic reach.
- **Priority:** LOW — low ROI for SpecLock.

---

## CATEGORY 4 — DISCORD / SLACK (research only, can't post without joining)

### 21. Anthropic Discord [MEDIUM]
- **Status:** Anthropic runs an official Discord for Claude devs
- **Invite:** https://www.anthropic.com/discord (check landing page for current link)
- **Process:** Join → introduce in #introductions → post in #tools / #show-and-tell
- **Requires:** Discord account, rapport-building
- **Time:** 30+ minutes spread across a week
- **Priority:** HIGH if invite is open, MEDIUM if gated

### 22. Claude Code Discord (community-run) [MEDIUM]
- **Status:** Several community Discords exist; search "Claude Code Discord" on Disboard
- **Process:** Join, share in #showcase channels
- **Priority:** MEDIUM

### 23. Cursor Discord [MEDIUM]
- **Invite:** https://discord.gg/cursor (or via https://cursor.com/community)
- **Process:** Join → #showcase or #built-for-cursor
- **Priority:** MEDIUM

### 24. AI Engineer Foundation Discord [LOW]
- **URL:** https://ai.engineer/
- **Priority:** LOW

### 25. MCP-related Discords [MEDIUM]
- **Options:** PulseMCP Discord, Glama Discord, Smithery Discord
- **Priority:** MEDIUM — MCP-native audience

### 26. DevDX Slack [LOW]
- **Status:** No public invite link found in search
- **Priority:** LOW — research dead-end

### 27. Coding Cat Slack [LOW]
- **Status:** No public invite link found
- **Priority:** LOW

### 28. The DevOps Community Slack [LOW]
- **URL:** https://devopschat.co/ or via thisdot/tech-community-slacks
- **Priority:** LOW

---

## CATEGORY 5 — YOUTUBE PITCHES (all manual, all cold email)

### 29. Fireship [MEDIUM — high reward / low probability]
- **Contact:** https://fireship.io/ contact form, or Twitter @fireship_dev
- **Audience:** 3.5M subs, occasional devtool reviews ("X in 100 Seconds" format)
- **Pitch angle:** "SpecLock in 100 seconds — stop AI from forgetting your rules"
- **Time:** 30 min to draft a perfect pitch
- **Priority:** MEDIUM (swing for the fences, cost is low)

### 30. ThePrimeagen [LOW — unlikely]
- **Contact:** Twitter, YouTube comments, Twitch chat during streams
- **Audience:** 600k subs, terminal-maximalist crowd
- **Angle:** "It's an MCP server, vim-friendly, CLI-first"
- **Priority:** LOW — he rarely reviews tools on request

### 31. Theo / t3.gg [LOW]
- **Contact:** Twitter @t3dotgg, email via ping.gg
- **Angle:** "TypeScript-first, open-source, runs locally"
- **Priority:** LOW — TS bias is fine but low hit rate

### 32. Web Dev Simplified [LOW]
- **Contact:** Website contact form
- **Priority:** LOW — off-topic for SpecLock

### 33. AI for Engineers (various) [LOW]
- **Priority:** LOW — fragmented micro-channels

---

## CATEGORY 6 — PODCASTS (all manual)

### 34. The Changelog Podcast [MEDIUM]
- **Contact:** https://changelog.com/podcast/suggestions (dedicated form)
- **Audience:** ~150k listeners
- **Process:** Suggest a guest — pitch Sandeep or the SpecLock story
- **Time:** 10 minutes
- **Priority:** MEDIUM

### 35. Frontside Podcast [LOW]
- **Contact:** https://frontside.com/podcast/
- **Priority:** LOW — mostly internal guests

### 36. AI Engineer Podcast / Latent Space [MEDIUM]
- **Contact:** https://www.latent.space/ — Swyx accepts guest pitches via Twitter DM
- **Audience:** Large AI-eng audience
- **Priority:** MEDIUM

### 37. ShopTalk Show [LOW]
- **Priority:** LOW — off-topic (frontend/CSS)

---

## SUMMARY — WHAT GOT SUBMITTED vs WHAT NEEDS SANDEEP

### Submitted programmatically: **0**
- The sandbox blocks POST requests (permission denied on curl -X POST).
- WebFetch is also blocked.
- Every channel requires a human to click "Submit".

### Ready to submit manually (high priority, under 10 min each):
1. **PulseMCP** — paste URL, solve captcha (60 sec) — HIGH
2. **Changelog.com News** — account + form (3 min) — HIGH
3. **Console.dev** — email david@console.dev (5 min) — HIGH
4. **Cursor Forum — Built for Cursor** — post in showcase (5 min) — HIGH
5. **Indie Hackers Products** — full profile (10 min) — HIGH
6. **Echo JS** — signup + post (2 min) — MEDIUM
7. **daily.dev** — suggest RSS source (2 min; needs valid RSS first) — MEDIUM
8. **Hacker News second-chance email** — 5 min — MEDIUM

### Documented for later (low priority or research-needed):
- BetaList, Launching Next, StartupBase, Lobste.rs (invite-only), OpenSauced
- Fireship / Prime / Theo / WebDev Simplified YouTube pitches
- Changelog Podcast / Latent Space pitches
- Anthropic / Cursor / MCP Discords (require time investment)
- DevOps'ish + Pointer + MCP Newsletter (editor pitches)
- r/ChatGPTCoding, r/vibecoding, r/devops (reddit posts, need crafted drafts)

### NET NEW channels in this plan: **37**
### HIGH priority (do this week): **5 submissions + 3 editor pitches = 8**
### Total time investment if Sandeep does all HIGH items: **~45 minutes**

---

## SOURCES

- [daily.dev — Suggest new source docs](https://docs.daily.dev/docs/for-content-creators/suggest-new-source)
- [Echo JS](https://www.echojs.com/)
- [Console.dev](https://console.dev/)
- [Indie Hackers Products](https://www.indiehackers.com/products)
- [Cursor Community Forum — Showcase](https://forum.cursor.com/c/showcase/9)
- [PulseMCP — Submit](https://www.pulsemcp.com/submit)
- [PulseMCP Newsletter](https://www.pulsemcp.com/newsletter)
- [Changelog.com — Submit News](https://changelog.com/news/submit)
- [MCP Newsletter](https://www.mcpnewsletter.com/)
- [DevOps'ish WRITING.md](https://github.com/chris-short/devopsish.com/blob/main/WRITING.md)
- [Pointer.io](https://www.pointer.io/)
- [Hacker News Show HN Guidelines](https://news.ycombinator.com/showhn.html)
- [Lobste.rs About — invite tree](https://lobste.rs/about)
- [r/ChatGPTCoding stats](https://gummysearch.com/r/ChatGPTCoding/)
- [r/vibecoding stats](https://gummysearch.com/r/vibecoding/)
- [BetaList](https://betalist.com/)

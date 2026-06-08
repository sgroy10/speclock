# SpecLock — External Directory Submission Research

Research on non-GitHub directories where SpecLock could be submitted. These
all require an account / manual web form, so they cannot be submitted via
`gh.exe` from CI. Each entry documents how to submit and what information
will be needed.

---

## 1. Product Hunt — https://www.producthunt.com

**Status:** ALREADY LAUNCHED. No further action needed.

- **Existing listing:** https://www.producthunt.com/products/speclock
- **Launch date:** 2026-03-02
- **Tagline:** "AI Constraint Engine — Stop LLMs from breaking your code"
- **Current stats:** Daily rank 43, weekly 335, monthly 1806. 5 votes, 1 comment.
- **Creator:** Sandeep Roy (@sandeep_roy5)

**Follow-up opportunities:**
- Ship a v6.0 major release and do a second launch (Product Hunt allows new
  launches for major version updates).
- Engage the 5 followers + existing comment to start a thread.
- Add a "featured in" badge from the PH listing to the SpecLock README and
  website.

---

## 2. AlternativeTo — https://alternativeto.net

**Status:** Needs manual submission.

**How to submit:**
1. Create a free AlternativeTo account at https://alternativeto.net/user/signup/
2. Go to https://alternativeto.net/software/new/ (the "Add software" form)
3. Fill in:
   - **Name:** SpecLock
   - **Homepage URL:** https://sgroy10.github.io/speclock
   - **License:** Open Source (MIT)
   - **Platforms:** Windows, macOS, Linux, Self-Hosted, Node.js
   - **Categories:** Development → Code Editors / Linters, AI Tools
   - **Short description:** "AI Constraint Engine that enforces CLAUDE.md,
     .cursorrules and AGENTS.md as pre-commit law. Semantic detection catches
     euphemisms and synonym substitution in LLM output."
4. **Alternatives-to section (critical for discoverability):** Mark SpecLock
   as an alternative to:
   - ESLint (for AI-era linting)
   - Husky / lint-staged (pre-commit hook class)
   - Cursor's built-in .cursorrules (enforcement layer for the same files)
   - Semgrep (semantic code policy class)
5. Upload a logo (at least 256x256 PNG) and 1-3 screenshots.
6. Submit for moderation. Typical review turnaround: 1-3 days.

**Notes:** AlternativeTo ranks by user votes, so after the listing goes live,
push a short note on Twitter/HN asking supporters to upvote. Also add the
"Get listed on AlternativeTo" badge to the SpecLock README.

---

## 3. StackShare — https://stackshare.io

**Status:** Needs manual submission.

**How to submit:**
1. Create a free account at https://stackshare.io/join
2. Click "Add a Tool" (top-right menu) — direct URL:
   https://stackshare.io/tools/new
3. Fill in:
   - **Name:** SpecLock
   - **Category:** Application and Data → Languages & Frameworks →
     "Code Quality" (or "Static Code Analysis")
   - **Also add to:** DevOps → "Dev Environment" and AI → "AI Coding Tools"
   - **Website:** https://sgroy10.github.io/speclock
   - **GitHub:** https://github.com/sgroy10/speclock
   - **Description (150 chars):** "AI Constraint Engine. Enforces CLAUDE.md,
     .cursorrules, AGENTS.md as pre-commit law. MCP server with 51 tools."
4. Upload logo (recommended 400x400 transparent PNG).
5. Add SpecLock to your own StackShare "stack" so it shows at least one
   company using it (this is how StackShare ranks tools).
6. Submit. Turnaround: usually instant for basic info, 1-2 days for full
   approval.

**Notes:** StackShare rewards tools whose users publicly add them to a stack.
After submitting, ask a few early users to add SpecLock to their stacks.

---

## 4. SaaSHub — https://www.saashub.com

**Status:** Needs manual submission.

**How to submit:**
1. Create a free account at https://www.saashub.com/login (Sign up link).
2. Navigate to "Submit a product" — direct URL:
   https://www.saashub.com/submit-product
3. Fill in:
   - **Product name:** SpecLock
   - **Website:** https://sgroy10.github.io/speclock
   - **Category:** Developer Tools → Code Quality / Code Analysis
   - **Also add to:** AI Tools → AI Coding Assistants
   - **Tagline (60 chars):** "AI Constraint Engine for Claude, Cursor & MCP"
   - **Full description:** Include npm install command, 51 MCP tools, 1043
     tests, MIT license, supported clients (Claude Code, Cursor, Windsurf,
     Cline, Codex, Aider).
   - **Pricing model:** Free / Open Source
4. Upload a logo (square, 512x512 PNG recommended).
5. Add up to 5 screenshots (CLI output, the MCP tool list, a semantic audit
   report, a pre-commit hook blocking a violation, the settings.json).
6. List competitors/alternatives: ESLint, Husky, Semgrep, Snyk, DeepSource.
7. Submit. Moderation typically takes 3-5 business days. Free tier gives a
   basic listing; paid ("featured") tier gets front-page placement.

**Notes:** SaaSHub auto-cross-lists to a few smaller aggregators, so one
submission gets the tool into ~3-5 places.

---

## 5. IndieHackers Products — https://www.indiehackers.com/products

**Status:** Needs manual submission.

**How to submit:**
1. Log in (or create a free account) at https://www.indiehackers.com/login
   — GitHub SSO is supported.
2. From the profile menu, click "Add a product" — direct URL:
   https://www.indiehackers.com/products/new
3. Fill in:
   - **Product name:** SpecLock
   - **Tagline:** "AI Constraint Engine for Claude, Cursor, Windsurf"
   - **URL:** https://sgroy10.github.io/speclock
   - **Revenue:** $0 (open source) — IH still lists free/OSS products.
   - **Founded date:** 2026-01 (or the actual first-commit date)
   - **Founder(s):** Sandeep Roy
   - **Tech stack:** Node.js, TypeScript, MCP
   - **Category:** Developer Tools
4. Write a short intro post on the IH forum linking the product — this is
   where most of the discovery happens. Suggested post:
   "I built SpecLock because Claude Code kept 'forgetting' my CLAUDE.md
   rules mid-session. Here's what I learned about enforcing AI constraints
   as compilable law instead of suggestions..."
5. Crosslink from the SpecLock README to the IH product page for reciprocal
   SEO.

**Notes:** IH doesn't moderate product listings heavily; the ranking comes
from forum engagement. The best strategy is a well-written launch post plus
steady "build in public" updates in the product's Milestones tab.

---

## 6. DevHunt — https://devhunt.org

**Status:** Needs manual submission.

**How to submit:**
1. Create a free account at https://devhunt.org (GitHub SSO supported).
2. Click "Submit" in the top nav — submission form URL:
   https://devhunt.org/submit
3. Fill in:
   - **Tool name:** SpecLock
   - **Website URL:** https://sgroy10.github.io/speclock
   - **GitHub:** https://github.com/sgroy10/speclock
   - **Logo:** 256x256 PNG
   - **Tagline (60 chars):** "Enforce CLAUDE.md, .cursorrules, AGENTS.md as law"
   - **Long description:** Full story — problem, solution, 51 MCP tools,
     1043 tests, supported clients, MIT license.
   - **Category:** AI Tools / Developer Tools / Code Quality
   - **Pricing:** Free
4. Choose a launch day. DevHunt works on daily launches (similar to Product
   Hunt) so you pick a date and the tool shows on the front page that day,
   gathering upvotes for a "Tool of the Day / Week / Month" ranking.
5. Schedule a launch — ideally Tuesday-Thursday, avoiding major PH launches
   in the same category. Prep a Twitter thread + HN "Show HN" the same day
   to drive votes.

**Notes:** DevHunt is smaller than Product Hunt but has a highly dev-focused
audience and is less crowded — SpecLock is likely to rank top 3 on launch
day in the AI Tools category. Unlike PH, a second launch here is fine even
without a major version bump.

---

## Summary: recommended submission order

1. **DevHunt** — fastest, lowest friction, dev audience, schedule for next
   Tuesday-Thursday.
2. **StackShare** — high SEO value, instant basic listing.
3. **AlternativeTo** — best for long-tail search ("ESLint alternative AI",
   etc.). 1-3 day moderation.
4. **SaaSHub** — slowest moderation but auto-propagates to other aggregators.
5. **IndieHackers** — social/community play; pair with a launch post, not
   just a bare listing.
6. **Product Hunt** — already launched; revisit only for a v6.0 major-version
   re-launch.

All 6 are free to submit. Each takes about 15-30 minutes to fill out if the
logo, screenshots, and copy are prepared in advance.

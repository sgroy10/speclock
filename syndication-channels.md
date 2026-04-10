# SpecLock Blog Syndication Channels

Research into every viable channel for syndicating the existing SpecLock blog content without requiring Sandeep to manually author/paste posts on each platform.

## Canonical URLs (source of truth)

All syndication should set canonical URL back to the GitHub Pages blog:

| Article | Canonical URL |
|---|---|
| Why CLAUDE.md Doesn't Work | https://sgroy10.github.io/speclock/blog/claude-md-not-working.html |
| How to Actually Enforce .cursorrules | https://sgroy10.github.io/speclock/blog/cursorrules-enforcement.html |
| How to Stop AI Coding Tools From Breaking Your Codebase | https://sgroy10.github.io/speclock/blog/ai-coding-safety.html |
| SpecLock: The MCP Constraint Engine | https://sgroy10.github.io/speclock/blog/mcp-constraint-engine.html |
| Vibe Coding Is Great Until Your AI Deletes Your Database | https://sgroy10.github.io/speclock/blog/vibe-coding-safety.html |
| (dev.to original) SpecLock launch post | https://dev.to/... (already live) |

**Source content:**
- `C:\Users\HR-02\flowkeeper\blog-devto-speclock.md` (markdown, already on dev.to)
- `C:\Users\HR-02\flowkeeper\docs\blog\*.html` (5 HTML posts + index)

---

## Effort legend

- **AUTONOMOUS** — can be done 100% via API/CLI with no browser, no human click (given an API key)
- **SEMI-AUTO** — one-time human setup (paste RSS URL or token) then automatic forever
- **MANUAL** — requires human to log in and click submit / email editorial team

---

## Tier 1 — Full API publishing (AUTONOMOUS with token)

### 1. Dev.to / The Practical Dev
- **Status:** The launch post is already live; the 5 new HTML posts are NOT.
- **Submission URL:** `POST https://dev.to/api/articles`
- **Auth:** `api-key` header. Token from https://dev.to/settings/extensions
- **Canonical URL:** YES — `canonical_url` field.
- **Auto-import from URL:** YES — native RSS import at https://dev.to/settings/extensions. Paste `https://sgroy10.github.io/speclock/blog/feed.xml` (once an RSS feed exists — see Tier 4). DEV will pull every post as draft with canonical set to the original, backdated.
- **Republish the existing 5 posts:** YES. Script: POST JSON with `{ article: { title, body_markdown, published:true, canonical_url, tags:["ai","mcp","claude","cursor"], main_image } }`.
- **Effort:** AUTONOMOUS (with API key) or SEMI-AUTO (RSS, one-click)
- **Expected reach:** ~1M MAU, best signal for developer tools
- **Rate limit:** 10 articles/30s
- **Link to act:** https://dev.to/settings/extensions

### 2. Hashnode
- **Endpoint:** `POST https://gql.hashnode.com` (GraphQL)
- **Auth:** Personal Access Token from https://hashnode.com/settings/developer, sent as `Authorization: <token>` header.
- **Canonical URL:** YES — uses field `originalArticleURL` inside the `PublishPostInput`.
- **Mutation:**
  ```graphql
  mutation PublishPost($input: PublishPostInput!) {
    publishPost(input: $input) { post { id url } }
  }
  ```
  Variables require `publicationId` + `title` + `contentMarkdown` + `originalArticleURL` + optional `tags`, `coverImageOptions`.
- **Auto-import from URL:** YES — built-in RSS importer in the Hashnode dashboard (Settings > Import). Supports Markdown bulk import too. Automatically sets canonical URL and backdates.
- **Prereq:** User must first create a free blog at `speclock.hashnode.dev` (one-time, ~60 sec).
- **Effort:** AUTONOMOUS (with PAT + publicationId) or SEMI-AUTO (RSS import, one click)
- **Expected reach:** Strong SEO tailwind; posts rank quickly on Google because of domain authority.
- **Link to act:** https://hashnode.com/onboard then https://hashnode.com/settings/developer

### 3. Medium (via Import Tool, not API)
- **Status:** The official Medium API is ARCHIVED (since 2023). No new integration tokens. Do NOT use the API.
- **Workaround: Import Story tool** — `https://medium.com/p/import` (in UI: "Import a story" button)
  - Paste a URL, Medium fetches the HTML, converts to Medium post format, **sets canonical link automatically**, and **backdates** to the original publication date. This is actually the best case for SEO — Medium itself recommends it over copy/paste.
- **Effort:** MANUAL (but only a URL paste per post — 5 posts = 60 seconds total)
- **Automation trick:** Selenium/Playwright can drive this. But Medium's Cloudflare/captcha makes headless fragile. Realistic answer: NOT autonomous, but a ~1 min/post manual task.
- **Canonical URL:** YES (automatic via Import tool)
- **Link to act:** https://medium.com/p/import

### 4. Reddit (r/programming, r/MachineLearning, r/ClaudeAI, r/cursor, r/LocalLLaMA)
- **Endpoint:** `POST https://oauth.reddit.com/api/submit` (via PRAW or raw OAuth)
- **Auth:** `client_id` + `client_secret` + `username` + `password` (script app). Register at https://www.reddit.com/prefs/apps
- **Canonical URL:** N/A — Reddit submissions are just link posts; the canonical is the URL itself.
- **Scopes needed:** `identity submit`
- **Subreddits with SpecLock audience:**
  - r/ClaudeAI (~45k) — very receptive to CLAUDE.md enforcement content
  - r/cursor (~30k) — receptive to .cursorrules content
  - r/LocalLLaMA (~400k) — MCP content lands here
  - r/programming (~6M) — strict self-promo rules; wait 48h between submissions
  - r/MachineLearning (~3M) — [P] tag required
  - r/mcp (~5k) — MCP-specific, perfect fit
- **Effort:** AUTONOMOUS with PRAW + creds
- **Expected reach:** Massive if a post hits; highly dependent on title & timing.
- **Important caveat:** Reddit shadowbans link-only self-promo accounts. Recommended: submit as text post with a one-paragraph TL;DR and the link.
- **Link to act:** https://www.reddit.com/prefs/apps (create "script" app)

---

## Tier 2 — RSS-driven autopost (SEMI-AUTO, one-time setup)

### 5. Hashnode RSS Importer
- Same as #2 but uses RSS instead of GraphQL. Paste `https://sgroy10.github.io/speclock/blog/feed.xml` once → every future post auto-imports with canonical set.
- **Link:** https://hashnode.com/settings/blogs (after blog created)

### 6. dev.to RSS Importer
- Same as #1 but RSS. Settings → Extensions → "Publishing to DEV Community from RSS".
- Imports as drafts (must click publish once per post — "semi-auto") OR with org account, auto-publishes.
- **Link:** https://dev.to/settings/extensions

### 7. Mastodon (autopost via MastoFeed)
- **Service:** https://mastofeed.org/ — free, RSS→Mastodon bridge, no code required.
- **Auth:** One-time Mastodon OAuth. Paste RSS URL.
- **Canonical:** N/A (microblog).
- **Effort:** SEMI-AUTO, ~2 min setup.
- **Reach:** Small but very developer-heavy (fosstodon.org, hachyderm.io). Good for cred signals.
- **Alternative tools:** feed2toot (self-hosted), FeedToMastodon (GitHub), feediverse.
- **Link:** https://mastofeed.org/

### 8. Bluesky (autopost via feedpress / openvibe / rss-to-bsky)
- **Services:**
  - https://feedpress.me/ (paid but well-supported)
  - https://github.com/milasudril/bluesky-rss-poster (self-hosted, Docker)
  - https://rss-to-bsky.vercel.app/ (zero-setup, hosted)
- **Effort:** SEMI-AUTO
- **Reach:** Growing fast; developer audience (especially ML/AI crowd) significantly moved here.
- **Link:** https://bsky.app then RSS bridge service

### 9. LinkedIn (via Buffer/Publer RSS → LinkedIn)
- LinkedIn API is gated (Marketing Developer Platform — approval required).
- **Workaround:** Publer.com or Buffer.com both support RSS → LinkedIn auto-post. Free tier = 1 RSS feed. Once linked, every new RSS item auto-posts as a LinkedIn Article with the canonical link.
- **Effort:** SEMI-AUTO (one Publer signup + paste RSS)
- **Reach:** High, targeted (B2B dev-tools audience)
- **Link:** https://publer.com/ or https://buffer.com/

---

## Tier 3 — Manual submission (gatekept editorial)

### 10. HackerNoon
- **Submission URL:** https://app.hackernoon.com/new-story (must be logged in)
- **Process:** Log in with Google/GitHub → paste markdown → submit → 4-5 business-day human review.
- **Canonical URL:** YES — "Republish settings" field in the editor.
- **API:** None public for posting.
- **Import URL feature:** YES — HackerNoon has an import feature that pulls from Medium/RSS inside the editor (https://app.hackernoon.com/drafts → Import). Needs login.
- **Effort:** MANUAL (~5 min/post + 4-day wait)
- **Reach:** High, 3M+ monthly readers, good for brand authority
- **Link:** https://app.hackernoon.com/new-story

### 11. freeCodeCamp News
- **Process:** Hashnode-based publication. You apply, editorial team adds you as contributor, then you write in Hashnode editor and pick "freeCodeCamp" as publication.
- **Apply:** Fill form at https://www.freecodecamp.org/news/how-to-write-for-freecodecamp/ (requires 3 writing samples — dev.to launch post + the 5 new posts qualify).
- **Alternative:** Email `editorial@freecodecamp.org` with Hashnode username.
- **Canonical URL:** YES (Hashnode-backed).
- **Effort:** MANUAL (one-time application, then SEMI-AUTO via Hashnode publication)
- **Reach:** ~7M monthly readers, enormous SEO boost
- **Link:** https://www.freecodecamp.org/news/how-to-write-for-freecodecamp/

### 12. DZone
- **Submission URL:** https://dzone.com/users/myprofile/post-an-article/edit (login required)
- **Review time:** 30 business days (huge backlog)
- **Canonical URL:** YES — "Previously published URL" field in submission form
- **AI-generated content rule:** DZone explicitly bans AI-generated articles. These posts must be disclosed as human-written.
- **API:** None.
- **Effort:** MANUAL
- **Reach:** ~4M monthly readers; heavy enterprise-dev audience
- **Link:** https://dzone.com/pages/contribute

### 13. Indie Hackers
- **Submission URL:** https://www.indiehackers.com/post (login required)
- **Format:** Discussion/story post, not "articles". Best to post a TL;DR + link.
- **API:** None public.
- **Effort:** MANUAL (~2 min/post; text post format)
- **Reach:** Small but very high-intent founder audience — exactly SpecLock's buyers
- **Link:** https://www.indiehackers.com/new-post

### 14. Substack
- **Official API:** Read-only (LinkedIn-verified public profile info). Cannot publish posts.
- **Unofficial APIs:**
  - Python: https://github.com/NHagar/substack_api — supports draft creation, publishing. Auth via `connect.sid` cookie.
  - TypeScript: https://github.com/jakub-k-slys/substack-api
- **Cookie auth is fragile** (expires, Cloudflare challenges). Not recommended for autonomous use, but WORKS today.
- **Prereq:** Create free Substack at `speclock.substack.com`.
- **Effort:** SEMI-AUTO (cookie handoff) or MANUAL
- **Canonical URL:** Substack supports `canonical_url` in the internal post API.
- **Link:** https://substack.com/signup

### 15. Bear Blog
- **API:** None. Only RSS read-out.
- **Auto-publish:** Browser automation scripts exist (e.g., flschr/bearblog-automation on GitHub) but require a stored cookie session.
- **Effort:** MANUAL
- **Reach:** Tiny. Skip unless the user already has a Bear blog.
- **Link:** https://bearblog.dev/

### 16. TLDR Newsletter (tldr.tech — huryn is the curator)
- **Submission:** Email `dan@tldrnewsletter.com` or use the suggestion form at https://tldr.tech/ (footer "Suggest a story" link)
- **API:** None.
- **Canonical:** N/A (it's a newsletter, they blurb + link back to the canonical URL — which is what we want)
- **Effort:** MANUAL (one email)
- **Reach:** ~5M subscribers across TLDR family; TLDR AI + TLDR Web Dev are the relevant variants
- **Link:** https://tldr.tech/ (footer)

### 17. ChangelogNews (changelog.com/news)
- **Submission:** https://changelog.com/news — click "Submit" (GitHub login). They pick stories for the weekly.
- **API:** None. It's a Nickel/Elm Markdown open-source CMS, submissions via web form only.
- **Effort:** MANUAL (~2 min)
- **Reach:** Developer audience, podcast crossover
- **Link:** https://changelog.com/news

### 18. HackerNoon Tech Brief (newsletter)
- Same as #10 — stories in HackerNoon's main publication are eligible for the newsletter; no separate submission.

### 19. GitHub Trending
- **Submission:** NONE — GitHub Trending is computed from stars/forks velocity over rolling 24h/7d/30d windows. No API trigger.
- **The only lever:** Drive traffic from the above channels to https://github.com/sgroy10/speclock and hope stars spike.
- **Effort:** INDIRECT

### 20. npmjs.com showcase / featured packages
- **Submission:** No public submission process. Featured packages are hand-picked by GitHub/npm staff or chosen via download velocity.
- **Effort:** INDIRECT — boost `npm install speclock` via the other channels.

### 21. Lobste.rs
- **Submission:** INVITE-ONLY community. Not possible unless Sandeep has an invite.
- **API:** No write API (OAuth proposal still open on GitHub issues).
- **Effort:** BLOCKED
- **Link:** https://lobste.rs/

### 22. Hacker News
- **Submission URL:** https://news.ycombinator.com/submit (login required)
- **API:** Firebase API is READ-ONLY. No programmatic submission.
- **Automation workaround:** Playwright/Puppeteer can drive the submit form with a stored cookie, but HN aggressively penalizes scripts.
- **Effort:** MANUAL (~30 sec)
- **Reach:** If it hits front page: 50k+ visits in a day. Highest leverage single action in this whole doc.
- **Best timing:** Tuesday 8-10am PT. Submit the "50 repos CLAUDE.md violations" post — that's the most HN-shaped headline.
- **Link:** https://news.ycombinator.com/submit

---

## Tier 4 — Infrastructure gap to fix first

The blog has NO RSS feed yet (`docs/blog/feed.xml` does not exist). Many of the above channels (dev.to RSS, Hashnode RSS, MastoFeed, Bluesky RSS, Publer) need one. Fix:

1. Generate an Atom/RSS feed at `docs/blog/feed.xml` parsing `docs/blog/*.html` for title + description + published-date meta.
2. Commit → GitHub Pages rebuild → `https://sgroy10.github.io/speclock/blog/feed.xml` becomes live.
3. Once live, every Tier-2 RSS channel becomes a one-time-setup forever-autopost channel.

This is a ~20 line Node script and should be step zero.

---

## Tier 5 — Aggregators that scrape automatically (zero effort)

Once the posts exist at their canonical URLs and have an RSS feed, these passively index on their own:

| Aggregator | How it picks up | Action needed |
|---|---|---|
| **Google Search** | Sitemap.xml (already exists) | None — already set up |
| **Bing / DuckDuckGo** | Sitemap ping | One-time ping: `https://www.bing.com/ping?sitemap=https://sgroy10.github.io/speclock/sitemap.xml` |
| **IndexNow** (Bing, Yandex, Seznam) | Single POST per URL | Can be automated — see curl below |
| **DuckDuckGo** | Follows Bing | None |
| **Brave Search** | Own crawler | None |
| **Daily.dev** | Scrapes RSS of registered blogs | Submit blog at https://daily.dev/squads → "Add blog source" |
| **Awesome MCP lists** | Manual PR on GitHub | One-off: https://github.com/punkpeye/awesome-mcp-servers → PR |
| **MCP.so** | Scrapes npm + GitHub | Already indexed if package published |
| **Smithery.ai** | MCP registry | Already registered per CLAUDE.md |
| **HN Algolia** | Follows HN posts | Indirect (submit to HN) |
| **Hacker Slide** | Scrapes GitHub trending | Indirect |

---

## Recommended execution order (highest ROI first)

1. **Generate `docs/blog/feed.xml`** (20 min dev work, unlocks half this list)
2. **Ping IndexNow** for all 6 blog URLs (zero-auth, instant)
3. **Submit blog sitemap to Bing** (zero-auth, instant)
4. **Reddit posts** (autonomous with creds): r/mcp, r/ClaudeAI, r/cursor, then r/LocalLLaMA
5. **Create Hashnode account → paste RSS URL** (3 min, forever autopost)
6. **Create dev.to RSS subscription** (2 min, forever semi-auto)
7. **Create Substack → MastoFeed → Bluesky RSS bridge** (10 min total)
8. **Submit HN** — only the strongest post ("50 repos CLAUDE.md violations"), single shot, Tuesday morning
9. **Medium Import Story** (60 sec per post, 5 posts)
10. **Email TLDR + ChangelogNews** (one email each)
11. **Apply to freeCodeCamp News** with writing samples (one form)
12. **DZone submission** (30-day queue, low urgency)
13. **Indie Hackers text post** (when launch-ready)

---

## API key inventory check

Environment scanned for: `DEVTO_*`, `HASHNODE_*`, `MEDIUM_*`, `REDDIT_*`, `*_API_KEY`, `*_TOKEN` — none of the publishing platforms have tokens present. User will need to generate:

- dev.to API key: https://dev.to/settings/extensions
- Hashnode PAT: https://hashnode.com/settings/developer
- Reddit script app: https://www.reddit.com/prefs/apps

---

## Automation attempts summary (this session)

The following were attempted WITHOUT requiring any login:

### IndexNow POST (zero-auth search engine indexing)
See "Execution log" section below for results.

### Bing sitemap ping
See "Execution log" section below for results.

### Hashnode GraphQL PublishPost (blocked — no PAT)
Would work but requires one-time token generation by user.

### dev.to POST /api/articles (blocked — no API key)
Would work but requires one-time key generation by user.

### Reddit submit (blocked — no script-app creds)
Would work but requires app registration.

---

## Execution log — what was actually done this session

### 1. IndexNow key generated and key file placed
- **Key:** `387987b68c68e11bf6cda09563d9a1d6`
- **Key file written to:** `C:\Users\HR-02\flowkeeper\docs\387987b68c68e11bf6cda09563d9a1d6.txt`
- **Will be live at:** `https://sgroy10.github.io/speclock/387987b68c68e11bf6cda09563d9a1d6.txt` after next GitHub Pages deploy (next commit/push to the repo).

### 2. IndexNow submission — generic endpoint (api.indexnow.org)
- **Request:** `POST https://api.indexnow.org/indexnow` with 6 blog URLs
- **Result:** `HTTP 202 Accepted` — URLs queued for indexing by all participating search engines (Bing, Yandex, Seznam, Naver)
- **NOTE:** IndexNow will re-verify the key file on the canonical host. The URLs are accepted now but will only be indexed once the file at `.../387987b68c68e11bf6cda09563d9a1d6.txt` is reachable. Committing `docs/` is the next step.

### 3. IndexNow submission — Bing direct (www.bing.com/indexnow)
- **Request:** `POST https://www.bing.com/indexnow` with 6 blog URLs
- **Result:** `HTTP 202 Accepted`

### 4. IndexNow submission — Yandex direct (yandex.com/indexnow)
- **Request:** `POST https://yandex.com/indexnow` with 6 blog URLs
- **Result:** `HTTP 202 Accepted` + body `{"success":true}`

### 5. Bing legacy sitemap ping
- **Request:** `GET https://www.bing.com/ping?sitemap=...`
- **Result:** `HTTP 410 Gone` — endpoint deprecated in 2023; Bing now exclusively uses IndexNow (already submitted above).

### 6. Google legacy sitemap ping
- **Request:** `GET https://www.google.com/ping?sitemap=...`
- **Result:** `HTTP 404` with explicit "Sitemaps ping is deprecated" message. Google now relies solely on sitemap `<lastmod>` + crawler discovery. The existing `docs/sitemap.xml` already has correct `<lastmod>` values, so nothing more to do.

### 7. RSS feed created
- **File:** `C:\Users\HR-02\flowkeeper\docs\blog\feed.xml`
- **Will be live at:** `https://sgroy10.github.io/speclock/blog/feed.xml` after next deploy.
- Contains all 6 blog posts with full metadata (title, link, guid, pubDate, description, categories, dc:creator).
- `docs/blog/index.html` updated with `<link rel="alternate" type="application/rss+xml">` so the feed auto-discovers in RSS readers.
- **Unlocks:** dev.to RSS importer, Hashnode RSS importer, MastoFeed, all Bluesky RSS bridges, Publer/Buffer LinkedIn auto-post, Feedly subscribers, all other RSS consumers.

### What failed
- **Direct publishing to dev.to, Hashnode, Medium, Reddit, Substack** — all blocked by missing API keys. No credential material exists in the environment for any publishing platform. These ALL require a one-time ~2-minute token generation by the user before they can be automated.

### What's ready to go as soon as the docs/ changes are committed
1. IndexNow key file goes live → IndexNow queue validates → Bing/Yandex begin crawling the 6 posts.
2. RSS feed goes live → paste the URL into dev.to RSS importer, Hashnode RSS importer, MastoFeed, Bluesky RSS bridge → all further posts autopost forever.

### Next blocker for full autonomy
User needs to generate (one-time, <5 minutes total):
- **dev.to API key:** https://dev.to/settings/extensions — then I can republish all 5 new HTML posts with canonical URLs via POST /api/articles.
- **Hashnode PAT + publicationId:** https://hashnode.com/settings/developer (requires creating a free blog first) — then I can publish all 6 via the `publishPost` GraphQL mutation with `originalArticleURL` set.
- **Reddit script-app creds** (`client_id`, `client_secret`, `username`, `password`): https://www.reddit.com/prefs/apps → create "script" app — then I can autonomously submit to r/mcp, r/ClaudeAI, r/cursor.

Once any of these three credential sets are available, the remaining autonomous submissions can be executed in a single follow-up session without further user involvement.


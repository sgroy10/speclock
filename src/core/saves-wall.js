/**
 * SpecLock Saves Wall (v5.7)
 *
 * The public, opt-in home for Save Receipts. When a developer chooses to
 * publish a save (via `speclock wins --publish`), it is POSTed to the server,
 * stored, and rendered as an indexable page at /saves/{id} with rich Open
 * Graph tags — turning each block into a shareable, search-indexed artifact.
 * A global counter feeds the "🔒 N blocked" badge.
 *
 * This module is PURE and storage-agnostic at the edges: it owns validation,
 * a tiny append-only JSONL store, the public-page HTML, and the badge JSON.
 * The HTTP layer (http-server.js) only wires routes to these functions, and
 * the CLI only POSTs to them. Split this way so everything is unit-testable
 * without a running server.
 *
 * PRIVACY / SAFETY (these are deliberate, not incidental):
 *   - Publishing is ALWAYS explicit and opt-in. The server never invents a
 *     save; it only stores what a client posted. The CLI shows the user the
 *     exact text before it leaves their machine. This keeps the "invisible /
 *     pull-only, no nag" lock intact — the user exposes their OWN content.
 *   - Every user-supplied field is length-capped and HTML-escaped on render
 *     (XSS-safe), control characters stripped, and collapsed to a single line.
 *   - No file paths, lock IDs, or project names are required or rendered.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

// Where the published saves live. On a host with an ephemeral filesystem
// (e.g. Railway without a volume) attach a volume and point SPECLOCK_SAVES_DIR
// at it for durability; otherwise saves reset on redeploy.
export function savesPath(dir) {
  return path.join(dir, "saves.jsonl");
}

// Hard caps — abuse / payload-size guards.
const MAX_ACTION = 200;
const MAX_LOCK = 200;
const MAX_TOOL = 40;
const MAX_AUTHOR = 40;
const MAX_TOTAL = 5000; // rotate oldest beyond this
const LEVELS = new Set(["HIGH", "MEDIUM", "LOW"]);

/**
 * Collapse whitespace, strip control characters, trim, and hard-cap length.
 * Uses a character loop (not a control-char regex) so the source stays free
 * of literal control bytes.
 */
function clean(value, max) {
  if (value === undefined || value === null) return "";
  let out = "";
  for (const ch of String(value)) {
    const c = ch.codePointAt(0);
    out += c < 0x20 || c === 0x7f ? " " : ch; // replace control chars with space
  }
  return out.replace(/\s+/g, " ").trim().slice(0, max);
}

/** HTML-escape for safe rendering into pages and attributes. */
export function htmlEscape(value) {
  return String(value === undefined || value === null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Validate + sanitize an incoming publish payload. Returns
 * { ok: true, save } or { ok: false, error }. `now` overridable for tests.
 */
export function sanitizeSavePayload(payload, { now = new Date() } = {}) {
  if (!payload || typeof payload !== "object") {
    return { ok: false, error: "Body must be a JSON object." };
  }
  const action = clean(payload.action, MAX_ACTION);
  const lockText = clean(payload.lockText, MAX_LOCK);
  if (!action) return { ok: false, error: "Missing required field: action" };
  if (!lockText) return { ok: false, error: "Missing required field: lockText" };

  let level = clean(payload.level, 8).toUpperCase();
  if (!LEVELS.has(level)) level = "HIGH";

  const tool = clean(payload.tool, MAX_TOOL);
  const author = clean(payload.author, MAX_AUTHOR).replace(/^@+/, "");
  const enforced = payload.enforced === false ? false : true;

  // Accept a client-provided ISO timestamp only if it parses; else use now.
  let blockedAt = now.toISOString();
  if (payload.blockedAt) {
    const t = Date.parse(payload.blockedAt);
    if (Number.isFinite(t)) blockedAt = new Date(t).toISOString();
  }

  return {
    ok: true,
    save: {
      id: shortId(),
      action,
      lockText,
      level,
      tool,
      author,
      enforced,
      blockedAt,
      publishedAt: now.toISOString(),
    },
  };
}

/** URL-safe short id (10 hex chars from random bytes). */
export function shortId() {
  return crypto.randomBytes(5).toString("hex");
}

/** Append a sanitized save to the JSONL store, rotating beyond MAX_TOTAL. */
export function appendSave(dir, save) {
  fs.mkdirSync(dir, { recursive: true });
  const p = savesPath(dir);
  fs.appendFileSync(p, JSON.stringify(save) + "\n");
  // Cheap rotation: if the file grows past the cap, keep the newest MAX_TOTAL.
  try {
    const all = readAllSaves(dir);
    if (all.length > MAX_TOTAL) {
      const kept = all.slice(all.length - MAX_TOTAL);
      fs.writeFileSync(p, kept.map((s) => JSON.stringify(s)).join("\n") + "\n");
    }
  } catch { /* rotation is best-effort */ }
  return save;
}

/** Read every stored save (oldest first). Safe on missing/corrupt lines. */
export function readAllSaves(dir) {
  const p = savesPath(dir);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, "utf8");
  return raw
    .split(/\r?\n/)
    .filter((l) => l.trim())
    .map((l) => { try { return JSON.parse(l); } catch { return null; } })
    .filter(Boolean);
}

export function getSave(dir, id) {
  if (!id) return null;
  const all = readAllSaves(dir);
  return all.find((s) => s.id === id) || null;
}

/** Most-recent-first list, capped by `limit`. */
export function listSaves(dir, { limit = 50 } = {}) {
  return readAllSaves(dir).reverse().slice(0, limit);
}

export function countSaves(dir) {
  return readAllSaves(dir).length;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const BRAND = "#FF6B2C";
// The OG card asset lives on the GitHub Pages docs site, not the API host.
const OG_IMAGE = "https://sgroy10.github.io/speclock/og-image.png";
const SITE = "https://sgroy10.github.io/speclock/";

function pageShell({ title, description, canonical, body }) {
  const t = htmlEscape(title);
  const d = htmlEscape(description);
  const c = htmlEscape(canonical);
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${t}</title>
<meta name="description" content="${d}">
<link rel="canonical" href="${c}">
<meta property="og:type" content="article">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:url" content="${c}">
<meta property="og:image" content="${OG_IMAGE}">
<meta property="og:site_name" content="SpecLock">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${OG_IMAGE}">
<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>&#x1F512;</text></svg>">
<style>
  :root { --brand: ${BRAND}; --ink: #1A1A1A; --muted: #6b5d52; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: 'Inter', system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg,#FFF8F0,#FFF1E6); color: var(--ink);
    min-height: 100vh; padding: 40px 20px; }
  .wrap { max-width: 720px; margin: 0 auto; }
  a { color: var(--brand); text-decoration: none; }
  header.brand { display:flex; align-items:center; gap:10px; font-weight:800;
    font-size:24px; letter-spacing:-.5px; margin-bottom:28px; }
  header.brand .lk { color: var(--brand); }
  .card { background:#fff; border-radius:16px; padding:28px 30px; margin-bottom:18px;
    box-shadow: 0 8px 30px rgba(26,26,26,.08); border:1px solid #f0e3d6; }
  .verdict { display:inline-flex; align-items:center; gap:8px; font-weight:700;
    font-size:13px; text-transform:uppercase; letter-spacing:.5px;
    color:#b3261e; background:#fdecea; padding:5px 12px; border-radius:999px; }
  .action { font-size:26px; font-weight:800; line-height:1.25; margin:16px 0 6px; }
  .by { font-size:14px; color:var(--muted); }
  .rule { margin-top:18px; padding:14px 16px; background:#fff7f1; border-left:3px solid var(--brand);
    border-radius:8px; font-size:15px; }
  .rule .lbl { font-size:12px; text-transform:uppercase; letter-spacing:.5px; color:var(--muted); }
  .cta { display:inline-block; margin-top:8px; font-family:'JetBrains Mono',monospace;
    font-weight:700; background:rgba(255,107,44,.12); border:2px solid rgba(255,107,44,.45);
    border-radius:10px; padding:10px 16px; color:var(--ink); }
  .cta .p { color: var(--brand); }
  footer { text-align:center; color:var(--muted); font-size:13px; margin-top:24px; }
  .savecard { display:block; color:inherit; }
  .savecard:hover { box-shadow:0 10px 34px rgba(26,26,26,.14); }
</style>
</head>
<body><div class="wrap">${body}</div></body>
</html>`;
}

/** Public page for a single save: /saves/{id}. */
export function renderSavePage(save, { baseUrl = "" } = {}) {
  if (!save) {
    return {
      status: 404,
      html: pageShell({
        title: "Save not found · SpecLock",
        description: "This save receipt does not exist.",
        canonical: `${baseUrl}/saves`,
        body: `<header class="brand">🔒 <span>Spec<span class="lk">Lock</span></span></header>
          <div class="card"><div class="action">Save not found</div>
          <p class="by">This receipt may have expired. <a href="/saves">See the Saves Wall →</a></p></div>`,
      }),
    };
  }
  const mark = save.enforced ? "⛔ Blocked" : "⚠️ Flagged";
  const when = (save.blockedAt || "").slice(0, 10);
  const byBits = [save.tool && htmlEscape(save.tool), save.author && `@${htmlEscape(save.author)}`]
    .filter(Boolean).join(" · ");
  const title = `SpecLock blocked: ${save.action}`.slice(0, 110);
  const desc = `A coding agent was ${save.enforced ? "blocked" : "flagged"} from "${save.action}" because it conflicts with a rule the developer locked: "${save.lockText}".`;
  const body = `
    <header class="brand">🔒 <span>Spec<span class="lk">Lock</span></span></header>
    <div class="card">
      <span class="verdict">${mark}${save.level ? " · " + htmlEscape(save.level) : ""}</span>
      <div class="action">${htmlEscape(save.action)}</div>
      <div class="by">${when}${byBits ? " · " + byBits : ""}</div>
      <div class="rule">
        <div class="lbl">Constraint that caught it</div>
        ${htmlEscape(save.lockText)}
      </div>
    </div>
    <div class="card">
      <div class="lbl" style="font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:var(--muted)">Lock your own rules</div>
      <p style="margin:10px 0 14px">SpecLock turns your existing CLAUDE.md / .cursorrules / AGENTS.md into hard constraints your AI can't break.</p>
      <span class="cta"><span class="p">npx</span> speclock protect</span>
    </div>
    <footer>
      <a href="/saves">← The Saves Wall</a> · <a href="${SITE}">speclock</a> ·
      <a href="https://github.com/sgroy10/speclock">GitHub</a>
    </footer>`;
  return {
    status: 200,
    html: pageShell({ title, description: desc, canonical: `${baseUrl}/saves/${save.id}`, body }),
  };
}

/** The wall index: /saves. */
export function renderWallPage(saves, { baseUrl = "" } = {}) {
  const count = saves.length;
  const cards = count === 0
    ? `<div class="card"><div class="action">No public saves yet.</div>
       <p class="by">When a developer publishes a save, it shows up here.</p></div>`
    : saves.map((s) => {
        const mark = s.enforced ? "⛔" : "⚠️";
        const when = (s.blockedAt || "").slice(0, 10);
        return `<a class="card savecard" href="/saves/${htmlEscape(s.id)}">
          <span class="verdict">${mark} ${htmlEscape(s.level || "")}</span>
          <div class="action" style="font-size:20px">${htmlEscape(s.action)}</div>
          <div class="by">${when}${s.tool ? " · " + htmlEscape(s.tool) : ""}</div>
        </a>`;
      }).join("\n");
  const body = `
    <header class="brand">🔒 <span>Spec<span class="lk">Lock</span></span></header>
    <div class="card" style="background:transparent;box-shadow:none;border:none;padding:0 0 6px">
      <div class="action" style="font-size:30px">The Saves Wall</div>
      <p class="by">${count} time${count === 1 ? "" : "s"} SpecLock stopped an AI from breaking a rule a developer locked.</p>
      <span class="cta" style="margin-top:14px"><span class="p">npx</span> speclock protect</span>
    </div>
    ${cards}
    <footer><a href="${SITE}">speclock</a> · <a href="https://github.com/sgroy10/speclock">GitHub</a></footer>`;
  return pageShell({
    title: "The Saves Wall — what SpecLock blocked · SpecLock",
    description: `${count} real moments where SpecLock blocked an AI coding agent from breaking a locked rule.`,
    canonical: `${baseUrl}/saves`,
    body,
  });
}

/** shields.io endpoint payload for the live "N blocked" badge. */
export function badgeEndpointJson(count) {
  return {
    schemaVersion: 1,
    label: "blocked by speclock",
    message: String(count),
    color: "FF6B2C",
  };
}

/**
 * SpecLock "Wins" — the shareable Save Receipt (v5.6)
 *
 * Surfaces the saves SpecLock has already made for you: every time it caught
 * or hard-blocked an AI action that conflicted with a constraint you locked.
 * The data is read straight from the local audit trail — there is NO network
 * call, NO telemetry dependency, and NO PII. It only reads what SpecLock
 * already wrote to <project>/.speclock/brain.json (brain.state.violations) and
 * the project's locks.
 *
 * Design intent (growth / virality):
 *   `speclock wins` renders a clean, screenshot-friendly card the user can
 *   paste into a tweet / Slack / Reddit thread. It is PULL-ONLY — nothing ever
 *   pops up or nags. This keeps the "SpecLock is invisible by default" lock
 *   intact: non-technical users never see it; curious power users opt in by
 *   running the command.
 *
 * Honesty:
 *   The card reports only fields SpecLock actually recorded — the action the
 *   AI proposed and the constraint that caught it. It never invents file names
 *   or outcomes. Empty state is reported truthfully.
 *
 * Split mirrors stats: buildWins() returns a plain view-model (testable),
 * formatWinsCard() renders it to a string (no stdout side effects).
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import { readBrain } from "./storage.js";

/**
 * Shorten free text to a single clean line of at most `max` chars.
 */
function trim(text, max = 64) {
  if (!text) return "";
  const oneLine = String(text).replace(/\s+/g, " ").trim();
  if (oneLine.length <= max) return oneLine;
  return oneLine.slice(0, max - 1).trimEnd() + "…";
}

/**
 * Build a plain-data aggregate of the user's saves from the local audit trail.
 * Always safe to call — returns a zero-filled, brainExists=false view when
 * SpecLock is not initialised in this project.
 *
 * @param {string} root project root (the dir containing .speclock/)
 * @param {{ now?: Date, recentLimit?: number }} [opts]
 *   - now: clock override for deterministic tests.
 *   - recentLimit: how many recent saves to include in the card (default 5).
 */
export function buildWins(root, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();
  const recentLimit = typeof opts.recentLimit === "number" ? opts.recentLimit : 5;

  const empty = {
    brainExists: false,
    enforcementMode: "unknown",
    lockCount: 0,
    totalSaves: 0,
    blocked: 0,
    flagged: 0,
    firstSaveIso: null,
    lastSaveIso: null,
    daysProtected: 0,
    topConstraints: [],
    recent: [],
  };

  let brain;
  try {
    brain = readBrain(root);
  } catch (_) {
    return empty;
  }
  if (!brain) return empty;

  const items =
    brain.specLock && Array.isArray(brain.specLock.items) ? brain.specLock.items : [];
  const lockCount = items.filter((l) => l && l.active !== false).length;

  const mode =
    brain.enforcement && brain.enforcement.mode === "hard" ? "hard" : "warn";

  const violations = Array.isArray(brain.state && brain.state.violations)
    ? brain.state.violations
    : [];

  // A "save" = a recorded conflict where SpecLock caught the AI. enforced:true
  // means it was hard-blocked; enforced:false means it was flagged (advisory).
  let blocked = 0;
  let flagged = 0;
  let firstSaveMs = null;
  let lastSaveMs = null;
  const constraintTally = new Map(); // lock text -> count

  for (const v of violations) {
    if (!v) continue;
    if (v.enforced) blocked++;
    else flagged++;

    const t = v.at ? Date.parse(v.at) : NaN;
    if (Number.isFinite(t)) {
      if (firstSaveMs === null || t < firstSaveMs) firstSaveMs = t;
      if (lastSaveMs === null || t > lastSaveMs) lastSaveMs = t;
    }

    // Credit the top lock that did the catching.
    const top =
      Array.isArray(v.locks) && v.locks.length > 0 ? v.locks[0] : null;
    const key = (top && top.text) || "(constraint)";
    constraintTally.set(key, (constraintTally.get(key) || 0) + 1);
  }

  const totalSaves = violations.length;

  let daysProtected = 0;
  if (firstSaveMs !== null) {
    daysProtected = Math.max(
      0,
      Math.floor((now.getTime() - firstSaveMs) / (24 * 60 * 60 * 1000))
    );
  }

  const topConstraints = [...constraintTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([text, count]) => ({ text, count }));

  // violations are stored most-recent-first (addViolation unshifts).
  const recent = violations.slice(0, recentLimit).map((v) => ({
    at: v.at || null,
    action: v.action || "",
    level: v.topLevel || (v.locks && v.locks[0] && v.locks[0].level) || "",
    enforced: !!v.enforced,
    lockText: (v.locks && v.locks[0] && v.locks[0].text) || "",
  }));

  return {
    brainExists: true,
    enforcementMode: mode,
    lockCount,
    totalSaves,
    blocked,
    flagged,
    firstSaveIso: firstSaveMs !== null ? new Date(firstSaveMs).toISOString() : null,
    lastSaveIso: lastSaveMs !== null ? new Date(lastSaveMs).toISOString() : null,
    daysProtected,
    topConstraints,
    recent,
  };
}

const TOP = "  ┌────────────────────────────────────────────────────────┐";
const BOT = "  └────────────────────────────────────────────────────────┘";
const WIDTH = 56; // inner display columns between the │ … │ borders

/**
 * Approximate the rendered column width of a string. Emoji and CJK glyphs
 * occupy two terminal columns but only one (or two) JS code units, which is
 * what makes naive padEnd() produce ragged right borders. We count those as
 * width 2, zero-width joiners / variation selectors as 0, everything else as 1.
 * Good enough to keep the share card's box perfectly aligned.
 */
function displayWidth(str) {
  let w = 0;
  for (const ch of String(str)) {
    const cp = ch.codePointAt(0);
    if (cp === 0xfe0f || cp === 0x200d || (cp >= 0x0300 && cp <= 0x036f)) {
      continue; // variation selector, ZWJ, combining marks — zero width
    }
    if (
      (cp >= 0x1100 && cp <= 0x115f) || // Hangul Jamo
      (cp >= 0x2300 && cp <= 0x27bf) || // misc technical, dingbats, ⛔ ⚠ etc.
      (cp >= 0x2e80 && cp <= 0xa4cf) || // CJK
      (cp >= 0xac00 && cp <= 0xd7a3) || // Hangul syllables
      (cp >= 0xf900 && cp <= 0xfaff) || // CJK compat
      (cp >= 0xfe30 && cp <= 0xfe4f) ||
      (cp >= 0xff00 && cp <= 0xff60) || // fullwidth
      (cp >= 0x1f000 && cp <= 0x1faff) // emoji planes (🔒 ⛔ 📋 …)
    ) {
      w += 2;
    } else {
      w += 1;
    }
  }
  return w;
}

function row(content = "") {
  const oneLine = String(content);
  const pad = Math.max(0, WIDTH - displayWidth(oneLine));
  return `  │ ${oneLine}${" ".repeat(pad)} │`;
}

/**
 * Render the wins view-model as a screenshot-friendly card string.
 * Kept separate from console output so tests can assert on the text.
 *
 * @param {object} view result of buildWins()
 */
export function formatWinsCard(view) {
  const lines = [];

  // --- Not initialised ---
  if (!view || !view.brainExists) {
    lines.push(TOP);
    lines.push(row("🔒  SpecLock"));
    lines.push(row(""));
    lines.push(row("Not protecting this project yet."));
    lines.push(row("Run  npx speclock protect  to start."));
    lines.push(BOT);
    return lines.join("\n");
  }

  // --- No saves yet (real, honest empty state) ---
  if (view.totalSaves === 0) {
    lines.push(TOP);
    lines.push(row("🔒  SpecLock — standing guard"));
    lines.push(row(""));
    lines.push(row(`Watching ${view.lockCount} constraint(s). 0 saves so far —`));
    lines.push(row("that means nothing has tried to break your"));
    lines.push(row("rules yet. Come back after a few AI sessions."));
    lines.push(row(""));
    lines.push(row("powered by speclock · npx speclock protect"));
    lines.push(BOT);
    return lines.join("\n");
  }

  // --- The receipt ---
  const since = view.firstSaveIso ? view.firstSaveIso.slice(0, 10) : "—";
  const summary =
    `${view.totalSaves} save${view.totalSaves === 1 ? "" : "s"}` +
    ` · ${view.blocked} blocked` +
    (view.flagged ? ` · ${view.flagged} flagged` : "");

  lines.push(TOP);
  lines.push(row("🔒  SpecLock — saves on your code"));
  lines.push(row(""));
  lines.push(row(summary));
  lines.push(row(`since ${since} · ${view.lockCount} constraint(s) guarded`));
  lines.push(row(""));

  if (view.recent.length > 0) {
    lines.push(row("It stopped your AI from:"));
    for (const r of view.recent) {
      const mark = r.enforced ? "⛔" : "⚠️";
      lines.push(row(`${mark} ${trim(r.action, WIDTH - 5)}`));
    }
    lines.push(row(""));
  }

  if (view.topConstraints.length > 0) {
    lines.push(row("Top constraint doing the work:"));
    const top = view.topConstraints[0];
    lines.push(row(`  “${trim(top.text, WIDTH - 8)}”`));
    lines.push(row(""));
  }

  lines.push(row("powered by speclock · npx speclock protect"));
  lines.push(BOT);
  lines.push("");
  lines.push("  📋  Copy the box above and share it.");
  lines.push("      More saves:  speclock wins");

  return lines.join("\n");
}

/**
 * Build the publish payload for the most recent save, for `speclock wins
 * --publish`. Returns null when there is nothing to publish. Pure/testable —
 * the CLI handles the opt-in confirmation and the network POST.
 */
export function buildPublishPayload(view, { tool = "", author = "" } = {}) {
  if (!view || !Array.isArray(view.recent) || view.recent.length === 0) return null;
  const r = view.recent[0];
  if (!r || !r.action || !r.lockText) return null;
  return {
    action: r.action,
    lockText: r.lockText,
    level: r.level || "HIGH",
    enforced: !!r.enforced,
    tool: tool || "",
    author: author || "",
    blockedAt: r.at || undefined,
  };
}

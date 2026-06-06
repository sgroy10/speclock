/**
 * SpecLock "Wrapped" — the all-time / monthly recap card (v5.6)
 *
 * A Spotify-Wrapped-style summary built on the SAME local audit trail that
 * powers `speclock wins`: every conflict SpecLock caught or hard-blocked. It
 * rolls those saves up into a single shareable headline — total saves all-time,
 * saves this month, blocked vs flagged, the busiest constraint, and how many
 * days SpecLock has been standing guard. Like wins, the data is read straight
 * from <project>/.speclock/brain.json (brain.state.violations). There is NO
 * network call, NO telemetry dependency, and NO PII.
 *
 * Design intent (growth / virality):
 *   `speclock wrapped` renders a clean, screenshot-friendly card the user can
 *   paste into a tweet / Slack / Reddit thread — the "year in review" moment for
 *   a tool that is otherwise invisible by default. It is PULL-ONLY: nothing ever
 *   pops up or nags. Curious power users opt in by running the command.
 *
 * Honesty:
 *   Every number is computed from what SpecLock actually recorded. The headline
 *   never invents file names or outcomes. Empty + not-initialised states are
 *   reported truthfully, exactly like wins.js.
 *
 * Split mirrors wins/stats: buildWrapped() returns a plain view-model (testable),
 * formatWrappedCard() renders it to a string (no stdout side effects).
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
 * Build a plain-data recap of the user's saves from the local audit trail.
 * Always safe to call — returns a zero-filled, brainExists=false view when
 * SpecLock is not initialised in this project.
 *
 * @param {string} root project root (the dir containing .speclock/)
 * @param {{ now?: Date }} [opts]
 *   - now: clock override for deterministic tests. Defines "this month".
 */
export function buildWrapped(root, opts = {}) {
  const now = opts.now instanceof Date ? opts.now : new Date();

  const empty = {
    brainExists: false,
    enforcementMode: "unknown",
    lockCount: 0,
    totalSaves: 0,
    monthSaves: 0,
    blocked: 0,
    flagged: 0,
    busiestConstraint: null,
    firstSaveIso: null,
    lastSaveIso: null,
    daysProtected: 0,
    monthLabel: monthLabel(now),
    headline: "Not protecting this project yet.",
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

  // "this month" is the calendar month of `now` (local time): [start, end).
  const monthStartMs = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const monthEndMs = new Date(now.getFullYear(), now.getMonth() + 1, 1).getTime();

  let blocked = 0;
  let flagged = 0;
  let monthSaves = 0;
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
      if (t >= monthStartMs && t < monthEndMs) monthSaves++;
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

  // The single constraint that did the most work, by catch count.
  let busiestConstraint = null;
  for (const [text, count] of constraintTally.entries()) {
    if (!busiestConstraint || count > busiestConstraint.count) {
      busiestConstraint = { text, count };
    }
  }

  return {
    brainExists: true,
    enforcementMode: mode,
    lockCount,
    totalSaves,
    monthSaves,
    blocked,
    flagged,
    busiestConstraint,
    firstSaveIso: firstSaveMs !== null ? new Date(firstSaveMs).toISOString() : null,
    lastSaveIso: lastSaveMs !== null ? new Date(lastSaveMs).toISOString() : null,
    daysProtected,
    monthLabel: monthLabel(now),
    headline: buildHeadline(totalSaves, blocked, daysProtected),
  };
}

/**
 * "June 2026" style label for the month `now` falls in.
 */
function monthLabel(d) {
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${months[d.getMonth()]} ${d.getFullYear()}`;
}

/**
 * One punchy line that summarises the whole year. Honest — derived only from
 * the recorded counts.
 */
function buildHeadline(totalSaves, blocked, daysProtected) {
  if (totalSaves === 0) {
    return "Standing guard — no rule-breaks caught yet.";
  }
  const saveWord = totalSaves === 1 ? "time" : "times";
  if (blocked > 0) {
    return `SpecLock had your back ${totalSaves} ${saveWord}.`;
  }
  return `SpecLock flagged ${totalSaves} ${saveWord} for you.`;
}

const TOP = "  ┌────────────────────────────────────────────────────────┐";
const BOT = "  └────────────────────────────────────────────────────────┘";
const WIDTH = 56; // inner display columns between the │ … │ borders

/**
 * Approximate the rendered column width of a string. Emoji and CJK glyphs
 * occupy two terminal columns but only one (or two) JS code units, which is
 * what makes naive padEnd() produce ragged right borders. We count those as
 * width 2, zero-width joiners / variation selectors as 0, everything else as 1.
 * Good enough to keep the share card's box perfectly aligned. (Mirrors wins.js.)
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
 * Render the wrapped view-model as a screenshot-friendly recap card string.
 * Kept separate from console output so tests can assert on the text.
 *
 * @param {object} view result of buildWrapped()
 */
export function formatWrappedCard(view) {
  const lines = [];

  // --- Not initialised ---
  if (!view || !view.brainExists) {
    lines.push(TOP);
    lines.push(row("🔒  SpecLock Wrapped"));
    lines.push(row(""));
    lines.push(row("Not protecting this project yet."));
    lines.push(row("Run  npx speclock protect  to start."));
    lines.push(BOT);
    return lines.join("\n");
  }

  // --- No saves yet (real, honest empty state) ---
  if (view.totalSaves === 0) {
    lines.push(TOP);
    lines.push(row("🔒  SpecLock Wrapped"));
    lines.push(row(""));
    lines.push(row(`Watching ${view.lockCount} constraint(s). 0 saves so far —`));
    lines.push(row("nothing has tried to break your rules yet."));
    lines.push(row("Come back after a few AI sessions."));
    lines.push(row(""));
    lines.push(row("powered by speclock · npx speclock protect"));
    lines.push(BOT);
    return lines.join("\n");
  }

  // --- The recap ---
  const since = view.firstSaveIso ? view.firstSaveIso.slice(0, 10) : "—";
  const splitLine =
    `${view.blocked} blocked` +
    (view.flagged ? ` · ${view.flagged} flagged` : "");

  lines.push(TOP);
  lines.push(row("🔒  SpecLock Wrapped"));
  lines.push(row(view.monthLabel));
  lines.push(row(""));
  lines.push(row(`✨ ${trim(view.headline, WIDTH - 3)}`));
  lines.push(row(""));
  lines.push(
    row(
      `📊 ${view.totalSaves} save${view.totalSaves === 1 ? "" : "s"} all-time` +
        ` · ${view.monthSaves} this month`
    )
  );
  lines.push(row(`🛡️  ${splitLine}`));
  lines.push(row(`📅 ${view.daysProtected} day(s) protected · since ${since}`));
  lines.push(row(""));

  if (view.busiestConstraint) {
    lines.push(row("🏆 Busiest constraint:"));
    lines.push(row(`   “${trim(view.busiestConstraint.text, WIDTH - 6)}”`));
    lines.push(
      row(
        `   caught ${view.busiestConstraint.count} ` +
          `time${view.busiestConstraint.count === 1 ? "" : "s"}`
      )
    );
    lines.push(row(""));
  }

  lines.push(row("powered by speclock · npx speclock protect"));
  lines.push(BOT);
  lines.push("");
  lines.push("  📋  Copy the box above and share your Wrapped.");
  lines.push("      Save receipt:  speclock wins");

  return lines.join("\n");
}

/**
 * Unit tests for `speclock wrapped` — the Spotify-Wrapped-style recap
 *
 * Verifies:
 *   1. buildWrapped aggregates brain.state.violations into all-time save counts
 *   2. blocked vs flagged split is correct (enforced true/false)
 *   3. monthSaves counts only saves in the calendar month of `now`
 *   4. busiestConstraint credits the lock that did the most catching
 *   5. daysProtected + first/last save iso computed from `now`
 *   6. buildWrapped handles missing brain.json (brainExists=false) gracefully
 *   7. headline reflects whether anything was blocked
 *   8. formatWrappedCard renders the recap with headline + month + footer
 *   9. formatWrappedCard renders the honest empty state (0 saves)
 *  10. formatWrappedCard renders the not-initialised state
 *
 * Runs with: node tests/wrapped.test.mjs
 */

import fs from "fs";
import path from "path";
import os from "os";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

// --- Tiny test harness ---
const results = [];
function test(name, fn) {
  try {
    fn();
    results.push({ name, ok: true });
    console.log(`  [OK] ${name}`);
  } catch (e) {
    results.push({ name, ok: false, err: e.message });
    console.error(`  [FAIL] ${name}: ${e.message}`);
  }
}

function assertEq(actual, expected, label) {
  if (actual !== expected) {
    throw new Error(`${label}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function assertIncludes(haystack, needle, label) {
  if (typeof haystack !== "string" || !haystack.includes(needle)) {
    throw new Error(`${label}: expected string to contain ${JSON.stringify(needle)}`);
  }
}

function makeTempProject(label) {
  return fs.mkdtempSync(path.join(os.tmpdir(), `speclock-wrapped-${label}-`));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

/**
 * Write a minimal brain.json with the given violations + locks.
 */
function writeBrain(root, { violations = [], locks = [], mode = "hard" } = {}) {
  const brainDir = path.join(root, ".speclock");
  fs.mkdirSync(brainDir, { recursive: true });
  const brain = {
    project: { name: "test-proj" },
    goal: { text: "" },
    specLock: { items: locks },
    decisions: [],
    notes: [],
    events: { count: 0 },
    facts: { deploy: {} },
    sessions: { current: null, history: [] },
    state: { recentChanges: [], violations },
    enforcement: { mode },
  };
  fs.writeFileSync(path.join(brainDir, "brain.json"), JSON.stringify(brain, null, 2));
}

process.env.SPECLOCK_CLI_NO_AUTORUN = "1";
const { buildWrapped, formatWrappedCard } = await import("../src/core/wrapped.js");

if (typeof buildWrapped !== "function" || typeof formatWrappedCard !== "function") {
  console.error("buildWrapped/formatWrappedCard not exported from src/core/wrapped.js");
  process.exit(1);
}

console.log("\n--- speclock wrapped tests ---\n");

// Shared fixture: 3 saves, 2 hard-blocked + 1 flagged, two distinct locks.
// Two saves are in June 2026, one in May 2026 (so monthSaves with now in June = 2).
function fixtureViolations() {
  return [
    // most recent first (addViolation unshifts)
    {
      at: "2026-06-05T10:00:00.000Z",
      action: "Delete the production patient_records table",
      locks: [{ id: "L2", text: "NEVER delete patient data", confidence: 96, level: "HIGH" }],
      topLevel: "HIGH",
      topConfidence: 96,
      enforced: true,
      mode: "hard",
    },
    {
      at: "2026-06-03T09:00:00.000Z",
      action: "Rewrite auth/login.ts to skip the session check",
      locks: [{ id: "L1", text: "NEVER modify auth files", confidence: 91, level: "HIGH" }],
      topLevel: "HIGH",
      topConfidence: 91,
      enforced: true,
      mode: "hard",
    },
    {
      at: "2026-05-20T08:00:00.000Z",
      action: "Switch the database from PostgreSQL to MongoDB",
      locks: [{ id: "L1", text: "NEVER modify auth files", confidence: 64, level: "MEDIUM" }],
      topLevel: "MEDIUM",
      topConfidence: 64,
      enforced: false,
      mode: "hard",
    },
  ];
}

// --- 1. aggregates all-time counts ---
test("buildWrapped counts total all-time saves", () => {
  const tmp = makeTempProject("count");
  try {
    writeBrain(tmp, { violations: fixtureViolations(), locks: [
      { id: "L1", text: "NEVER modify auth files", active: true },
      { id: "L2", text: "NEVER delete patient data", active: true },
    ] });
    const v = buildWrapped(tmp, { now: new Date("2026-06-06T00:00:00.000Z") });
    assertEq(v.brainExists, true, "brainExists");
    assertEq(v.totalSaves, 3, "totalSaves");
    assertEq(v.lockCount, 2, "lockCount");
  } finally { cleanup(tmp); }
});

// --- 2. blocked vs flagged split ---
test("buildWrapped splits blocked vs flagged by enforced flag", () => {
  const tmp = makeTempProject("split");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWrapped(tmp, { now: new Date("2026-06-06T00:00:00.000Z") });
    assertEq(v.blocked, 2, "blocked");
    assertEq(v.flagged, 1, "flagged");
  } finally { cleanup(tmp); }
});

// --- 3. monthSaves counts only the calendar month of `now` ---
test("buildWrapped counts saves in the current calendar month", () => {
  const tmp = makeTempProject("month");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    // now = mid-June 2026 → only the two June saves count, the May one does not.
    // (Use a mid-month instant so the local-time month boundary is unambiguous
    //  regardless of the machine's timezone.)
    const v = buildWrapped(tmp, { now: new Date("2026-06-15T12:00:00.000Z") });
    assertEq(v.monthSaves, 2, "monthSaves (June)");
    assertIncludes(v.monthLabel, "June 2026", "monthLabel");
    // now = mid-May 2026 → only the single May save counts.
    const v2 = buildWrapped(tmp, { now: new Date("2026-05-15T12:00:00.000Z") });
    assertEq(v2.monthSaves, 1, "monthSaves (May)");
  } finally { cleanup(tmp); }
});

// --- 4. busiestConstraint by catch count ---
test("buildWrapped picks the busiest constraint by catch count", () => {
  const tmp = makeTempProject("busy");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWrapped(tmp, { now: new Date("2026-06-06T00:00:00.000Z") });
    // "NEVER modify auth files" caught 2, "NEVER delete patient data" caught 1.
    assertEq(v.busiestConstraint.text, "NEVER modify auth files", "busiest text");
    assertEq(v.busiestConstraint.count, 2, "busiest count");
  } finally { cleanup(tmp); }
});

// --- 5. daysProtected + first/last save iso ---
test("buildWrapped computes daysProtected from earliest save", () => {
  const tmp = makeTempProject("days");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWrapped(tmp, { now: new Date("2026-06-06T08:00:00.000Z") });
    // earliest save 2026-05-20T08:00 → 17 days to 2026-06-06T08:00
    assertEq(v.daysProtected, 17, "daysProtected");
    assertEq(v.firstSaveIso.slice(0, 10), "2026-05-20", "firstSaveIso");
    assertEq(v.lastSaveIso.slice(0, 10), "2026-06-05", "lastSaveIso");
  } finally { cleanup(tmp); }
});

// --- 6. missing brain.json ---
test("buildWrapped handles missing brain.json gracefully", () => {
  const tmp = makeTempProject("nobrain");
  try {
    const v = buildWrapped(tmp);
    assertEq(v.brainExists, false, "brainExists");
    assertEq(v.totalSaves, 0, "totalSaves");
    assertEq(v.monthSaves, 0, "monthSaves");
    assertEq(v.busiestConstraint, null, "busiestConstraint null");
  } finally { cleanup(tmp); }
});

// --- 7. headline reflects whether anything was blocked ---
test("buildWrapped headline reflects blocked outcome", () => {
  const tmp = makeTempProject("headline");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWrapped(tmp, { now: new Date("2026-06-06T00:00:00.000Z") });
    assertIncludes(v.headline, "had your back", "blocked headline");
    // flagged-only fixture → different headline
    const flaggedOnly = fixtureViolations().map((x) => ({ ...x, enforced: false }));
    writeBrain(tmp, { violations: flaggedOnly });
    const v2 = buildWrapped(tmp, { now: new Date("2026-06-06T00:00:00.000Z") });
    assertIncludes(v2.headline, "flagged", "flagged headline");
  } finally { cleanup(tmp); }
});

// --- 8. formatWrappedCard renders the recap ---
test("formatWrappedCard renders the recap card", () => {
  const view = {
    brainExists: true,
    enforcementMode: "hard",
    lockCount: 2,
    totalSaves: 3,
    monthSaves: 2,
    blocked: 2,
    flagged: 1,
    busiestConstraint: { text: "NEVER modify auth files", count: 2 },
    firstSaveIso: "2026-05-20T08:00:00.000Z",
    lastSaveIso: "2026-06-05T10:00:00.000Z",
    daysProtected: 17,
    monthLabel: "June 2026",
    headline: "SpecLock had your back 3 times.",
  };
  const out = formatWrappedCard(view);
  assertIncludes(out, "SpecLock Wrapped", "title");
  assertIncludes(out, "June 2026", "month label");
  assertIncludes(out, "had your back", "headline");
  assertIncludes(out, "3 saves all-time", "all-time count");
  assertIncludes(out, "2 this month", "month count");
  assertIncludes(out, "2 blocked", "blocked count");
  assertIncludes(out, "1 flagged", "flagged count");
  assertIncludes(out, "17 day(s) protected", "days protected");
  assertIncludes(out, "NEVER modify auth files", "busiest constraint");
  assertIncludes(out, "npx speclock protect", "share CTA");
});

// --- 9. honest empty state (0 saves) ---
test("formatWrappedCard renders honest empty state", () => {
  const view = {
    brainExists: true, enforcementMode: "hard", lockCount: 4,
    totalSaves: 0, monthSaves: 0, blocked: 0, flagged: 0,
    busiestConstraint: null, firstSaveIso: null, lastSaveIso: null,
    daysProtected: 0, monthLabel: "June 2026",
    headline: "Standing guard — no rule-breaks caught yet.",
  };
  const out = formatWrappedCard(view);
  assertIncludes(out, "0 saves", "honest zero");
  assertIncludes(out, "Watching 4 constraint", "lock count shown");
  assertIncludes(out, "speclock", "brand present");
});

// --- 10. not-initialised state ---
test("formatWrappedCard renders not-initialised state", () => {
  const out = formatWrappedCard({ brainExists: false });
  assertIncludes(out, "Not protecting this project yet", "not-init message");
  assertIncludes(out, "npx speclock protect", "CTA");
});

// --- Summary ---
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
if (failed.length > 0) {
  for (const f of failed) console.error(`  - ${f.name}: ${f.err}`);
  process.exit(1);
}

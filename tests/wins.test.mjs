/**
 * Unit tests for `speclock wins` — the shareable Save Receipt
 *
 * Verifies:
 *   1. buildWins aggregates brain.state.violations into save counts
 *   2. blocked vs flagged split is correct (enforced true/false)
 *   3. topConstraints credits the lock that did the catching, ranked by count
 *   4. daysProtected computed from earliest save against provided `now`
 *   5. recent slice respects recentLimit and preserves most-recent-first order
 *   6. buildWins handles missing brain.json (brainExists=false) gracefully
 *   7. formatWinsCard renders the receipt with summary + share footer
 *   8. formatWinsCard renders the honest empty state (0 saves)
 *   9. formatWinsCard renders the not-initialised state
 *
 * Runs with: node tests/wins.test.mjs
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
  return fs.mkdtempSync(path.join(os.tmpdir(), `speclock-wins-${label}-`));
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
const { buildWins, formatWinsCard } = await import("../src/core/wins.js");

if (typeof buildWins !== "function" || typeof formatWinsCard !== "function") {
  console.error("buildWins/formatWinsCard not exported from src/core/wins.js");
  process.exit(1);
}

console.log("\n--- speclock wins tests ---\n");

// Shared fixture: 3 saves, 2 hard-blocked + 1 flagged, two distinct locks.
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
      at: "2026-06-01T08:00:00.000Z",
      action: "Switch the database from PostgreSQL to MongoDB",
      locks: [{ id: "L1", text: "NEVER modify auth files", confidence: 64, level: "MEDIUM" }],
      topLevel: "MEDIUM",
      topConfidence: 64,
      enforced: false,
      mode: "hard",
    },
  ];
}

// --- 1. aggregates counts ---
test("buildWins counts total saves", () => {
  const tmp = makeTempProject("count");
  try {
    writeBrain(tmp, { violations: fixtureViolations(), locks: [
      { id: "L1", text: "NEVER modify auth files", active: true },
      { id: "L2", text: "NEVER delete patient data", active: true },
    ] });
    const v = buildWins(tmp, { now: new Date("2026-06-06T00:00:00.000Z") });
    assertEq(v.brainExists, true, "brainExists");
    assertEq(v.totalSaves, 3, "totalSaves");
    assertEq(v.lockCount, 2, "lockCount");
  } finally { cleanup(tmp); }
});

// --- 2. blocked vs flagged split ---
test("buildWins splits blocked vs flagged by enforced flag", () => {
  const tmp = makeTempProject("split");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWins(tmp);
    assertEq(v.blocked, 2, "blocked");
    assertEq(v.flagged, 1, "flagged");
  } finally { cleanup(tmp); }
});

// --- 3. topConstraints ranked by count ---
test("buildWins ranks top constraints by catch count", () => {
  const tmp = makeTempProject("top");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWins(tmp);
    // "NEVER modify auth files" caught 2, "NEVER delete patient data" caught 1.
    assertEq(v.topConstraints[0].text, "NEVER modify auth files", "top constraint text");
    assertEq(v.topConstraints[0].count, 2, "top constraint count");
    assertEq(v.topConstraints[1].count, 1, "second constraint count");
  } finally { cleanup(tmp); }
});

// --- 4. daysProtected from earliest save ---
test("buildWins computes daysProtected from earliest save", () => {
  const tmp = makeTempProject("days");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWins(tmp, { now: new Date("2026-06-06T08:00:00.000Z") });
    // earliest save 2026-06-01T08:00 → 5 days to 2026-06-06T08:00
    assertEq(v.daysProtected, 5, "daysProtected");
    assertEq(v.firstSaveIso.slice(0, 10), "2026-06-01", "firstSaveIso");
    assertEq(v.lastSaveIso.slice(0, 10), "2026-06-05", "lastSaveIso");
  } finally { cleanup(tmp); }
});

// --- 5. recent slice respects limit + order ---
test("buildWins recent slice respects recentLimit and order", () => {
  const tmp = makeTempProject("recent");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const v = buildWins(tmp, { recentLimit: 2 });
    assertEq(v.recent.length, 2, "recent length");
    // most recent first
    assertIncludes(v.recent[0].action, "patient_records", "most recent action first");
    assertEq(v.recent[0].enforced, true, "recent[0] enforced");
  } finally { cleanup(tmp); }
});

// --- 6. missing brain.json ---
test("buildWins handles missing brain.json gracefully", () => {
  const tmp = makeTempProject("nobrain");
  try {
    const v = buildWins(tmp);
    assertEq(v.brainExists, false, "brainExists");
    assertEq(v.totalSaves, 0, "totalSaves");
    if (!Array.isArray(v.topConstraints)) throw new Error("topConstraints must be array");
    if (!Array.isArray(v.recent)) throw new Error("recent must be array");
  } finally { cleanup(tmp); }
});

// --- 7. formatWinsCard renders the receipt ---
test("formatWinsCard renders the share receipt", () => {
  const view = {
    brainExists: true,
    enforcementMode: "hard",
    lockCount: 2,
    totalSaves: 3,
    blocked: 2,
    flagged: 1,
    firstSaveIso: "2026-06-01T08:00:00.000Z",
    lastSaveIso: "2026-06-05T10:00:00.000Z",
    daysProtected: 5,
    topConstraints: [{ text: "NEVER modify auth files", count: 2 }],
    recent: [
      { at: "2026-06-05T10:00:00.000Z", action: "Delete the production patient_records table", level: "HIGH", enforced: true, lockText: "NEVER delete patient data" },
    ],
  };
  const out = formatWinsCard(view);
  assertIncludes(out, "SpecLock", "brand");
  assertIncludes(out, "3 saves", "save count");
  assertIncludes(out, "2 blocked", "blocked count");
  assertIncludes(out, "1 flagged", "flagged count");
  assertIncludes(out, "since 2026-06-01", "since date");
  assertIncludes(out, "patient_records", "recent action shown");
  assertIncludes(out, "NEVER modify auth files", "top constraint shown");
  assertIncludes(out, "npx speclock protect", "share CTA");
});

// --- 8. honest empty state (0 saves) ---
test("formatWinsCard renders honest empty state", () => {
  const view = {
    brainExists: true, enforcementMode: "hard", lockCount: 4,
    totalSaves: 0, blocked: 0, flagged: 0,
    firstSaveIso: null, lastSaveIso: null, daysProtected: 0,
    topConstraints: [], recent: [],
  };
  const out = formatWinsCard(view);
  assertIncludes(out, "0 saves", "honest zero");
  assertIncludes(out, "Watching 4 constraint", "lock count shown");
  assertIncludes(out, "speclock", "brand present");
});

// --- 9. not-initialised state ---
test("formatWinsCard renders not-initialised state", () => {
  const out = formatWinsCard({ brainExists: false });
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

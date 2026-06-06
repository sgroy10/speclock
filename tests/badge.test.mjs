/**
 * Unit tests for `speclock badge` — README badge variants
 *
 * Verifies:
 *   1. formatBadges() renders all 6 static BADGE_VARIANTS
 *   2. countBlockedViolations counts only enforced===true violations
 *   3. countBlockedViolations is 0 for missing/uninitialised brain
 *   4. buildShieldsEndpoint emits the exact shields.io endpoint schema
 *   5. formatBadges(root) appends the live "N violations blocked" variant
 *      (static markdown + shields.io endpoint JSON + plain text)
 *   6. formatBadges() with no root omits the dynamic variant (back-compat)
 *
 * Runs with: node tests/badge.test.mjs
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
  return fs.mkdtempSync(path.join(os.tmpdir(), `speclock-badge-${label}-`));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

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
const { formatBadges, countBlockedViolations, buildShieldsEndpoint, BADGE_VARIANTS } =
  await import("../src/cli/index.js");

if (
  typeof formatBadges !== "function" ||
  typeof countBlockedViolations !== "function" ||
  typeof buildShieldsEndpoint !== "function"
) {
  console.error("badge helpers not exported from src/cli/index.js");
  process.exit(1);
}

console.log("\n--- speclock badge tests ---\n");

// 3 violations: 2 enforced (hard-blocked) + 1 flagged.
function fixtureViolations() {
  return [
    { at: "2026-06-05T10:00:00.000Z", action: "a", locks: [], enforced: true },
    { at: "2026-06-03T09:00:00.000Z", action: "b", locks: [], enforced: true },
    { at: "2026-06-01T08:00:00.000Z", action: "c", locks: [], enforced: false },
  ];
}

// --- 1. renders all static variants ---
test("formatBadges renders all static variants", () => {
  const out = formatBadges();
  for (const v of BADGE_VARIANTS) {
    assertIncludes(out, v.name, `variant "${v.name}" name`);
    assertIncludes(out, v.markdown, `variant "${v.name}" markdown`);
  }
});

// --- 2. counts only enforced violations ---
test("countBlockedViolations counts only enforced===true", () => {
  const tmp = makeTempProject("count");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    assertEq(countBlockedViolations(tmp), 2, "blocked count");
  } finally { cleanup(tmp); }
});

// --- 3. zero for missing brain ---
test("countBlockedViolations is 0 for uninitialised project", () => {
  const tmp = makeTempProject("nobrain");
  try {
    assertEq(countBlockedViolations(tmp), 0, "no brain → 0");
  } finally { cleanup(tmp); }
});

// --- 4. shields.io endpoint schema ---
test("buildShieldsEndpoint emits the exact shields.io schema", () => {
  const ep = buildShieldsEndpoint(7);
  assertEq(ep.schemaVersion, 1, "schemaVersion");
  assertEq(ep.label, "protected by speclock", "label");
  assertEq(ep.message, "7 blocks", "message");
  assertEq(ep.color, "orange", "color");
});

// --- 5. dynamic variant appended when root given ---
test("formatBadges(root) appends the live blocked-count variant", () => {
  const tmp = makeTempProject("live");
  try {
    writeBrain(tmp, { violations: fixtureViolations() });
    const out = formatBadges(tmp);
    assertIncludes(out, "Violations blocked", "section heading");
    assertIncludes(out, "2%20violations%20blocked", "static badge count in URL");
    assertIncludes(out, "🔒 2 violations blocked", "plain text variant");
    assertIncludes(out, '"schemaVersion":1', "endpoint JSON");
    assertIncludes(out, '"message":"2 blocks"', "endpoint message");
  } finally { cleanup(tmp); }
});

// --- 6. no dynamic variant without root (back-compat) ---
test("formatBadges() without root omits the dynamic variant", () => {
  const out = formatBadges();
  if (out.includes("Violations blocked")) {
    throw new Error("dynamic variant should be omitted when no root is passed");
  }
});

// --- Summary ---
const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
if (failed.length > 0) {
  for (const f of failed) console.error(`  - ${f.name}: ${f.err}`);
  process.exit(1);
}

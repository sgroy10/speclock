/**
 * Unit tests for the Saves Wall (src/core/saves-wall.js) + the publish payload
 * builder (src/core/wins.js).
 *
 * Verifies:
 *   1. sanitizeSavePayload accepts a valid payload and assigns an id
 *   2. sanitizeSavePayload rejects missing action / lockText
 *   3. sanitizeSavePayload normalizes level, strips control chars, caps length,
 *      strips a leading @ from author, defaults enforced=true
 *   4. append/read/get/list/count round-trip on a temp dir
 *   5. renderSavePage returns 200 + escapes user content (XSS-safe)
 *   6. renderSavePage returns 404 for a missing save
 *   7. renderWallPage shows count + empty state + save cards
 *   8. badgeEndpointJson has the shields.io shape
 *   9. buildPublishPayload builds from the most recent save / null when empty
 *
 * Runs with: node tests/saves-wall.test.mjs
 */

import fs from "fs";
import path from "path";
import os from "os";
import url from "url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));

const results = [];
function test(name, fn) {
  try { fn(); results.push({ name, ok: true }); console.log(`  [OK] ${name}`); }
  catch (e) { results.push({ name, ok: false, err: e.message }); console.error(`  [FAIL] ${name}: ${e.message}`); }
}
function assertEq(a, b, label) {
  if (a !== b) throw new Error(`${label}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
}
function assertIncludes(h, n, label) {
  if (typeof h !== "string" || !h.includes(n)) throw new Error(`${label}: expected to contain ${JSON.stringify(n)}`);
}
function assertNotIncludes(h, n, label) {
  if (typeof h === "string" && h.includes(n)) throw new Error(`${label}: expected NOT to contain ${JSON.stringify(n)}`);
}
function tmp(label) { return fs.mkdtempSync(path.join(os.tmpdir(), `speclock-saves-${label}-`)); }
function cleanup(d) { try { fs.rmSync(d, { recursive: true, force: true }); } catch {} }

process.env.SPECLOCK_CLI_NO_AUTORUN = "1";
const sw = await import("../src/core/saves-wall.js");
const { buildPublishPayload } = await import("../src/core/wins.js");

console.log("\n--- saves wall tests ---\n");

const NOW = new Date("2026-06-08T10:00:00.000Z");

// 1
test("sanitizeSavePayload accepts a valid payload", () => {
  const r = sw.sanitizeSavePayload({ action: "Delete the prod DB", lockText: "NEVER delete data", level: "high", tool: "Cursor" }, { now: NOW });
  assertEq(r.ok, true, "ok");
  assertEq(r.save.action, "Delete the prod DB", "action");
  assertEq(r.save.lockText, "NEVER delete data", "lockText");
  assertEq(r.save.level, "HIGH", "level upper");
  assertEq(r.save.tool, "Cursor", "tool");
  assertEq(typeof r.save.id, "string", "has id");
  if (r.save.id.length < 6) throw new Error("id too short");
});

// 2
test("sanitizeSavePayload rejects missing fields", () => {
  assertEq(sw.sanitizeSavePayload({ lockText: "x" }).ok, false, "missing action");
  assertEq(sw.sanitizeSavePayload({ action: "x" }).ok, false, "missing lockText");
  assertEq(sw.sanitizeSavePayload(null).ok, false, "null body");
});

// 3
test("sanitizeSavePayload normalizes/sanitizes", () => {
  const r = sw.sanitizeSavePayload({
    action: "a".repeat(500),
    lockText: "line1\nline2\ttab",
    level: "bogus",
    author: "@sandeep",
  }, { now: NOW });
  assertEq(r.save.action.length, 200, "action capped to 200");
  assertEq(r.save.lockText, "line1 line2 tab", "control/whitespace collapsed");
  assertEq(r.save.level, "HIGH", "bogus level defaults HIGH");
  assertEq(r.save.author, "sandeep", "leading @ stripped");
  assertEq(r.save.enforced, true, "enforced defaults true");
  // explicit enforced:false respected
  assertEq(sw.sanitizeSavePayload({ action: "a", lockText: "b", enforced: false }).save.enforced, false, "enforced false respected");
});

// 4
test("append/read/get/list/count round-trip", () => {
  const dir = tmp("rt");
  try {
    assertEq(sw.countSaves(dir), 0, "starts empty");
    const s1 = sw.sanitizeSavePayload({ action: "act one", lockText: "rule one" }, { now: NOW }).save;
    const s2 = sw.sanitizeSavePayload({ action: "act two", lockText: "rule two" }, { now: NOW }).save;
    sw.appendSave(dir, s1);
    sw.appendSave(dir, s2);
    assertEq(sw.countSaves(dir), 2, "count 2");
    assertEq(sw.getSave(dir, s1.id).action, "act one", "get by id");
    assertEq(sw.getSave(dir, "nope"), null, "missing id null");
    const list = sw.listSaves(dir, { limit: 10 });
    assertEq(list.length, 2, "list len");
    assertEq(list[0].id, s2.id, "most recent first");
  } finally { cleanup(dir); }
});

// 5
test("renderSavePage escapes user content (XSS-safe)", () => {
  const evil = sw.sanitizeSavePayload({
    action: 'Delete <script>alert(1)</script> table',
    lockText: 'rule "quoted" & <b>bold</b>',
  }, { now: NOW }).save;
  const { status, html } = sw.renderSavePage(evil, { baseUrl: "https://x.test" });
  assertEq(status, 200, "status 200");
  assertNotIncludes(html, "<script>alert(1)</script>", "raw script not present");
  assertIncludes(html, "&lt;script&gt;", "script tag escaped");
  assertIncludes(html, "&amp;", "ampersand escaped");
  assertIncludes(html, "og:image", "has OG image tag");
  assertIncludes(html, "https://x.test/saves/" + evil.id, "canonical uses baseUrl + id");
});

// 6
test("renderSavePage returns 404 for missing save", () => {
  const { status, html } = sw.renderSavePage(null, { baseUrl: "https://x.test" });
  assertEq(status, 404, "status 404");
  assertIncludes(html, "Save not found", "not-found copy");
});

// 7
test("renderWallPage shows count, empty + cards", () => {
  const empty = sw.renderWallPage([], { baseUrl: "https://x.test" });
  assertIncludes(empty, "No public saves yet", "empty state");
  const saves = [
    sw.sanitizeSavePayload({ action: "drop users", lockText: "no drops" }, { now: NOW }).save,
    sw.sanitizeSavePayload({ action: "edit auth", lockText: "no auth edits" }, { now: NOW }).save,
  ];
  const wall = sw.renderWallPage(saves, { baseUrl: "https://x.test" });
  assertIncludes(wall, "The Saves Wall", "title");
  assertIncludes(wall, "drop users", "card 1");
  assertIncludes(wall, "edit auth", "card 2");
  assertIncludes(wall, "2 time", "count rendered");
});

// 8
test("badgeEndpointJson shields shape", () => {
  const b = sw.badgeEndpointJson(42);
  assertEq(b.schemaVersion, 1, "schemaVersion");
  assertEq(b.label, "blocked by speclock", "label");
  assertEq(b.message, "42", "message string");
  assertEq(b.color, "FF6B2C", "brand color");
});

// 9
test("buildPublishPayload from most recent save / null when empty", () => {
  assertEq(buildPublishPayload({ recent: [] }), null, "empty -> null");
  assertEq(buildPublishPayload(null), null, "null view -> null");
  const view = { recent: [{ action: "rm -rf /", lockText: "never rm", level: "HIGH", enforced: true, at: "2026-06-07T00:00:00.000Z" }] };
  const p = buildPublishPayload(view, { author: "sandeep" });
  assertEq(p.action, "rm -rf /", "action");
  assertEq(p.lockText, "never rm", "lockText");
  assertEq(p.enforced, true, "enforced");
  assertEq(p.author, "sandeep", "author passed through");
  assertEq(p.blockedAt, "2026-06-07T00:00:00.000Z", "blockedAt from at");
});

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} passed, ${failed.length} failed`);
if (failed.length > 0) { for (const f of failed) console.error(`  - ${f.name}: ${f.err}`); process.exit(1); }

// ===================================================================
// SpecLock Guardian Test Suite
// Tests zero-config protect flow: discover → extract → enforce.
// Run: node tests/guardian.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  discoverRuleFiles,
  extractConstraints,
  protect,
  formatProtectReport,
} from "../src/core/guardian.js";
import { ensureInit } from "../src/core/memory.js";
import { readBrain } from "../src/core/storage.js";
import { scoreConflict } from "../src/core/semantics.js";

let passed = 0;
let failed = 0;
const failures = [];
const categories = {};

function test(category, name, fn) {
  if (!categories[category]) categories[category] = { passed: 0, failed: 0, total: 0 };
  categories[category].total++;
  try {
    fn();
    passed++;
    categories[category].passed++;
  } catch (e) {
    failed++;
    categories[category].failed++;
    failures.push({ category, name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) {
    throw new Error(`${msg || "Mismatch"}: expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
  }
}

function makeTempDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "speclock-guardian-test-"));
}

function cleanup(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch (_) {}
}

function initGitRepo(dir) {
  fs.mkdirSync(path.join(dir, ".git", "hooks"), { recursive: true });
  fs.writeFileSync(path.join(dir, ".git", "HEAD"), "ref: refs/heads/main\n");
}

// ============================================================
// DISCOVERY
// ============================================================

test("discovery", "finds .cursorrules file", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete the database\nALWAYS use TypeScript");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 1);
    assertEqual(found[0].tool, "Cursor");
    assert(found[0].lines === 2);
  } finally { cleanup(dir); }
});

test("discovery", "finds CLAUDE.md file", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Rules\nDo not modify auth files");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 1);
    assertEqual(found[0].tool, "Claude Code");
  } finally { cleanup(dir); }
});

test("discovery", "finds AGENTS.md file", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# Agent Rules\nMust always run tests");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 1);
    assertEqual(found[0].tool, "AGENTS.md");
  } finally { cleanup(dir); }
});

test("discovery", "finds copilot instructions", () => {
  const dir = makeTempDir();
  try {
    fs.mkdirSync(path.join(dir, ".github"), { recursive: true });
    fs.writeFileSync(path.join(dir, ".github", "copilot-instructions.md"), "Never use jQuery");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 1);
    assertEqual(found[0].tool, "GitHub Copilot");
  } finally { cleanup(dir); }
});

test("discovery", "finds multiple rule files", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete data");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "Do not touch auth");
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "Must use TypeScript");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 3);
  } finally { cleanup(dir); }
});

test("discovery", "ignores empty files", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, ".cursorrules"), "");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "   \n  \n  ");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 0);
  } finally { cleanup(dir); }
});

test("discovery", "returns empty for no rule files", () => {
  const dir = makeTempDir();
  try {
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 0);
  } finally { cleanup(dir); }
});

test("discovery", "finds windsurf rules", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, ".windsurfrules"), "NEVER change the API");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 1);
    assertEqual(found[0].tool, "Windsurf");
  } finally { cleanup(dir); }
});

test("discovery", "finds GEMINI.md", () => {
  const dir = makeTempDir();
  try {
    fs.writeFileSync(path.join(dir, "GEMINI.md"), "Always validate input");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 1);
    assertEqual(found[0].tool, "Gemini");
  } finally { cleanup(dir); }
});

// ============================================================
// EXTRACTION — CONSTRAINTS
// ============================================================

test("extraction", "extracts NEVER constraints", () => {
  const content = "NEVER delete the database\nNEVER modify auth files";
  const result = extractConstraints(content, ".cursorrules");
  assertEqual(result.locks.length, 2);
  assert(result.locks[0].text.includes("delete the database"));
});

test("extraction", "extracts ALWAYS constraints", () => {
  const content = "ALWAYS use TypeScript for new files\nALWAYS run tests before committing";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 2);
});

test("extraction", "extracts MUST constraints", () => {
  const content = "- MUST validate all user input\n- MUST use parameterized queries";
  const result = extractConstraints(content, "AGENTS.md");
  assertEqual(result.locks.length, 2);
});

test("extraction", "extracts DO NOT constraints", () => {
  const content = "- Do not modify the payment module\n- Don't change database schema without approval";
  const result = extractConstraints(content, ".cursorrules");
  assertEqual(result.locks.length, 2);
});

test("extraction", "extracts bullet-point constraints", () => {
  const content = "- NEVER use eval()\n* ALWAYS escape HTML output\n• MUST sanitize inputs";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 3);
});

test("extraction", "extracts bold/emphasis constraints", () => {
  const content = "**NEVER** expose API keys in client code\n**ALWAYS** use environment variables";
  const result = extractConstraints(content, "AGENTS.md");
  assertEqual(result.locks.length, 2);
});

test("extraction", "extracts 'is required/mandatory' constraints", () => {
  const content = "Code review is required before merging\nTwo-factor auth is mandatory for deploys";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 2);
});

test("extraction", "extracts 'must never/must always' mid-sentence", () => {
  const content = "The API must never return raw SQL errors\nThe frontend must always show loading states";
  const result = extractConstraints(content, ".cursorrules");
  assertEqual(result.locks.length, 2);
});

test("extraction", "extracts Avoid/Prevent/Prohibit constraints", () => {
  const content = "- Avoid using global state\n- Prevent direct database access from controllers";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 2);
});

test("extraction", "skips markdown headers", () => {
  const content = "# Project Rules\n## Security\nNEVER expose secrets";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 1);
  assert(result.locks[0].text.includes("expose secrets"));
});

test("extraction", "skips empty lines and code fences", () => {
  const content = "\n\n```\nsome code\n```\nNEVER delete logs\n\n";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 1);
});

test("extraction", "skips very short lines", () => {
  const content = "No\nNEVER delete the production database";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 1);
});

test("extraction", "skips very long lines (>300 chars)", () => {
  const content = "NEVER " + "x".repeat(300) + "\nNEVER delete data";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 1);
});

test("extraction", "deduplicates identical constraints", () => {
  const content = "NEVER delete data\nNEVER delete data\nnever delete data";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 1);
});

test("extraction", "tags with source file name", () => {
  const content = "NEVER modify the auth module";
  const result = extractConstraints(content, ".cursorrules");
  assert(result.locks[0].tags.length > 0);
  assert(result.locks[0].tags[0].includes("cursorrules"));
});

test("extraction", "sets source as guardian", () => {
  const content = "NEVER delete anything";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks[0].source, "guardian");
});

// ============================================================
// EXTRACTION — DECISIONS
// ============================================================

test("decisions", "extracts tech stack decisions", () => {
  const content = "- Use React 19 for the frontend\n- Use Express for the backend";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.decisions.length, 2);
});

test("decisions", "extracts 'built with' decisions", () => {
  const content = "Built with Next.js 15 and Tailwind CSS";
  const result = extractConstraints(content, ".cursorrules");
  assertEqual(result.decisions.length, 1);
});

test("decisions", "does not confuse constraints with decisions", () => {
  const content = "NEVER use jQuery\n- Use React instead";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 1);
  assertEqual(result.decisions.length, 1);
});

// ============================================================
// EXTRACTION — EDGE CASES
// ============================================================

test("edge-cases", "handles empty content", () => {
  const result = extractConstraints("", "CLAUDE.md");
  assertEqual(result.locks.length, 0);
  assertEqual(result.decisions.length, 0);
});

test("edge-cases", "handles content with only headers", () => {
  const result = extractConstraints("# Title\n## Section\n### Sub", "CLAUDE.md");
  assertEqual(result.locks.length, 0);
});

test("edge-cases", "handles SpecLock's own output (skips it)", () => {
  const content = "Auto-synced by SpecLock — do not edit\nPowered by [SpecLock]\nNEVER delete data";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 1);
});

test("edge-cases", "extracts Keep/Preserve/Maintain constraints", () => {
  const content = "- Keep the API backwards compatible\n- Preserve existing database schema\n- Maintain test coverage above 80%";
  const result = extractConstraints(content, "AGENTS.md");
  assertEqual(result.locks.length, 3);
});

test("edge-cases", "extracts Ensure/Enforce constraints", () => {
  const content = "- Ensure all endpoints require authentication\n- Enforce rate limiting on public APIs";
  const result = extractConstraints(content, "CLAUDE.md");
  assertEqual(result.locks.length, 2);
});

// ============================================================
// FULL PROTECT FLOW
// ============================================================

test("protect", "auto-creates starter CLAUDE.md when no rule files found", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    const report = protect(dir, { skipHook: true, skipSync: true });
    // Greenfield support: should auto-create CLAUDE.md and continue normally
    assertEqual(report.starterCreated, true);
    assertEqual(report.starterPath, "CLAUDE.md");
    assert(fs.existsSync(path.join(dir, "CLAUDE.md")), "starter CLAUDE.md should exist");
    // Should have discovered the newly-created CLAUDE.md and extracted locks from it
    assertEqual(report.discovered.length, 1);
    assertEqual(report.discovered[0].file, "CLAUDE.md");
    assert(report.extracted.locks >= 6, `Expected >= 6 extracted locks from starter, got ${report.extracted.locks}`);
    assert(report.added.locks >= 6, `Expected >= 6 added locks from starter, got ${report.added.locks}`);
    assertEqual(report.errors.length, 0);
  } finally { cleanup(dir); }
});

test("protect", "returns error when no rule files AND --skipStarter", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    const report = protect(dir, { skipHook: true, skipSync: true, skipStarter: true });
    assert(report.errors.length > 0);
    assert(report.errors[0].includes("No AI rule files found"));
    assert(!fs.existsSync(path.join(dir, "CLAUDE.md")), "CLAUDE.md should NOT be created when skipStarter is set");
  } finally { cleanup(dir); }
});

test("protect", "extracts and adds locks from .cursorrules", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete the database\nALWAYS use TypeScript\nMUST validate all inputs");
    const report = protect(dir, { skipHook: true, skipSync: true });
    assertEqual(report.discovered.length, 1);
    assertEqual(report.extracted.locks, 3);
    assertEqual(report.added.locks, 3);
    const brain = readBrain(dir);
    const active = brain.specLock.items.filter(l => l.active !== false);
    assert(active.length >= 3);
  } finally { cleanup(dir); }
});

test("protect", "extracts from multiple rule files", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete data");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "ALWAYS use strict mode");
    const report = protect(dir, { skipHook: true, skipSync: true });
    assertEqual(report.discovered.length, 2);
    assertEqual(report.added.locks, 2);
  } finally { cleanup(dir); }
});

test("protect", "skips duplicate locks on second run", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete the database");
    const r1 = protect(dir, { skipHook: true, skipSync: true });
    assertEqual(r1.added.locks, 1);
    const r2 = protect(dir, { skipHook: true, skipSync: true });
    assertEqual(r2.added.locks, 0);
    assertEqual(r2.added.skipped, 1);
  } finally { cleanup(dir); }
});

test("protect", "installs pre-commit hook", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete data");
    const report = protect(dir, { skipSync: true });
    assert(report.hookInstalled);
    assertEqual(report.hookStatus, "installed");
    const hookPath = path.join(dir, ".git", "hooks", "pre-commit");
    assert(fs.existsSync(hookPath));
    const hookContent = fs.readFileSync(hookPath, "utf-8");
    assert(hookContent.includes("SPECLOCK-HOOK"));
  } finally { cleanup(dir); }
});

test("protect", "reports hook already installed on second run", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete data");
    protect(dir, { skipSync: true });
    const r2 = protect(dir, { skipSync: true });
    assert(r2.hookInstalled);
    assertEqual(r2.hookStatus, "already installed");
  } finally { cleanup(dir); }
});

test("protect", "skipHook option works", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete data");
    const report = protect(dir, { skipHook: true, skipSync: true });
    assertEqual(report.hookStatus, "skipped (--no-hook)");
    const hookPath = path.join(dir, ".git", "hooks", "pre-commit");
    assert(!fs.existsSync(hookPath));
  } finally { cleanup(dir); }
});

test("protect", "extracts decisions too", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "- Use React for the frontend\nNEVER use jQuery");
    const report = protect(dir, { skipHook: true, skipSync: true });
    assert(report.extracted.decisions >= 1);
    assert(report.added.decisions >= 1);
  } finally { cleanup(dir); }
});

// ============================================================
// FORMAT REPORT
// ============================================================

test("format", "formats report with discovered files", () => {
  const report = {
    discovered: [{ file: ".cursorrules", tool: "Cursor", lines: 10, size: 200 }],
    extracted: { locks: 3, decisions: 1 },
    added: { locks: 3, decisions: 1, skipped: 0 },
    hookInstalled: true, hookStatus: "installed",
    synced: [".cursor/rules/speclock.mdc", "AGENTS.md"],
    errors: [],
    strict: true,
  };
  const output = formatProtectReport(report);
  assert(output.includes("SpecLock Protect"));
  assert(output.includes(".cursorrules"));
  assert(output.includes("Cursor"));
  assert(output.includes("3 constraints"));
  assert(output.includes("3 new locks"));
  assert(output.includes("INSTALLED"));
  assert(output.includes("ENFORCED"));
});

test("format", "formats report with errors", () => {
  const report = {
    discovered: [],
    extracted: { locks: 0, decisions: 0 },
    added: { locks: 0, decisions: 0, skipped: 0 },
    hookInstalled: false, hookStatus: "n/a",
    synced: [],
    errors: ["No AI rule files found"],
  };
  const output = formatProtectReport(report);
  assert(output.includes("No AI rule files found"));
});

test("format", "formats report with skipped duplicates", () => {
  const report = {
    discovered: [{ file: "CLAUDE.md", tool: "Claude Code", lines: 5, size: 100 }],
    extracted: { locks: 2, decisions: 0 },
    added: { locks: 0, decisions: 0, skipped: 2 },
    hookInstalled: true, hookStatus: "already installed",
    synced: [],
    errors: [],
  };
  const output = formatProtectReport(report);
  assert(output.includes("2 (already existed)"));
  assert(output.includes("already active"));
});

// ============================================================
// REAL-WORLD RULE FILES
// ============================================================

test("real-world", "extracts from a typical .cursorrules file", () => {
  const content = `# Project Rules

## Code Style
- Use TypeScript for all new files
- NEVER use \`any\` type — always define proper interfaces
- ALWAYS add JSDoc comments to exported functions

## Security
- NEVER expose API keys in client-side code
- Do not store sensitive data in localStorage
- MUST use parameterized queries for all database operations

## Architecture
- Keep components under 200 lines
- Built with Next.js 15 and Tailwind CSS
- Use React Server Components by default
`;
  const result = extractConstraints(content, ".cursorrules");
  assert(result.locks.length >= 5, `Expected >= 5 locks, got ${result.locks.length}`);
  assert(result.decisions.length >= 1, `Expected >= 1 decision, got ${result.decisions.length}`);
});

test("real-world", "extracts from a typical CLAUDE.md file", () => {
  const content = `# Development Guidelines

## MANDATORY
- NEVER modify the database schema without a migration
- ALWAYS run the full test suite before pushing
- Do not add new npm dependencies without approval
- Must maintain backwards compatibility with v2 API

## Stack
- Framework: Next.js 15 (App Router)
- Database: PostgreSQL via Prisma
- Auth: better-auth

## Process
- Ensure all PRs have at least one review
- Keep the main branch deployable at all times
`;
  const result = extractConstraints(content, "CLAUDE.md");
  assert(result.locks.length >= 4, `Expected >= 4 locks, got ${result.locks.length}`);
  assert(result.decisions.length >= 1, `Expected >= 1 decision, got ${result.decisions.length}`);
});

test("real-world", "extracts from a typical AGENTS.md file", () => {
  const content = `# AGENTS.md

## Instructions for AI Agents

You are working on a production e-commerce platform.

### Non-Negotiables
- NEVER modify the checkout flow without explicit approval
- NEVER change pricing logic
- MUST preserve all existing API contracts
- Do not remove any existing database columns

### Preferences
- Prefer functional components over class components
- Use Zustand for state management
- Always use server actions for mutations
`;
  const result = extractConstraints(content, "AGENTS.md");
  assert(result.locks.length >= 4, `Expected >= 4 locks, got ${result.locks.length}`);
});

// ============================================================
// BUG FIX: IDEMPOTENCY CASCADE (v5.5.1)
// ============================================================

test("idempotency", "skips SpecLock-generated sync files on second run", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete data\nALWAYS use TypeScript");
    const r1 = protect(dir, { skipHook: true });
    assertEqual(r1.added.locks, 2);
    // Run 2: should NOT add locks from sync output files
    const r2 = protect(dir, { skipHook: true });
    assertEqual(r2.added.locks, 0, `Second run should add 0 locks, got ${r2.added.locks}`);
    assertEqual(r2.added.skipped, 2);
  } finally { cleanup(dir); }
});

test("idempotency", "stable lock count across 3 runs", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, ".cursorrules"), "NEVER delete the DB\nMUST validate input\nDo not touch auth");
    fs.writeFileSync(path.join(dir, "CLAUDE.md"), "# Rules\n- NEVER expose secrets");
    const r1 = protect(dir, { skipHook: true });
    const count1 = r1.added.locks;
    const r2 = protect(dir, { skipHook: true });
    assertEqual(r2.added.locks, 0, "Run 2 added locks when it shouldn't");
    const r3 = protect(dir, { skipHook: true });
    assertEqual(r3.added.locks, 0, "Run 3 added locks when it shouldn't");
  } finally { cleanup(dir); }
});

test("idempotency", "skips files with SpecLock sync header", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    // Create a file that looks like SpecLock sync output
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# AGENTS.md\n\n> Auto-synced from SpecLock. Run `speclock sync` to update.\n\n## Constraints\n- NEVER violate: some rule");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 0, "Should skip SpecLock-generated AGENTS.md");
  } finally { cleanup(dir); }
});

test("idempotency", "skips files with (SpecLock) in title", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, "GEMINI.md"), "# GEMINI.md — Project Constraints (SpecLock)\n\n> Auto-synced. Run `speclock sync --format gemini` to update.");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 0, "Should skip SpecLock-generated GEMINI.md");
  } finally { cleanup(dir); }
});

test("idempotency", "does NOT skip user-written AGENTS.md", () => {
  const dir = makeTempDir();
  try {
    initGitRepo(dir);
    fs.writeFileSync(path.join(dir, "AGENTS.md"), "# AGENTS.md\n\nNEVER modify the checkout flow\nMUST preserve API contracts");
    const found = discoverRuleFiles(dir);
    assertEqual(found.length, 1, "Should include user-written AGENTS.md");
  } finally { cleanup(dir); }
});

// ============================================================
// BUG FIX: ALWAYS PATTERN ENFORCEMENT (v5.5.1)
// ============================================================

test("always-pattern", "ALWAYS use X catches 'switch from X to Y'", () => {
  const result = scoreConflict({ actionText: "switch from TypeScript to JavaScript", lockText: "ALWAYS use TypeScript" });
  assert(result.confidence >= 60, `Expected >= 60% conflict, got ${result.confidence}%`);
});

test("always-pattern", "ALWAYS use X catches 'stop using X'", () => {
  const result = scoreConflict({ actionText: "stop using TypeScript", lockText: "ALWAYS use TypeScript" });
  assert(result.confidence >= 60, `Expected >= 60% conflict, got ${result.confidence}%`);
});

test("always-pattern", "ALWAYS use X catches 'convert to Y'", () => {
  const result = scoreConflict({ actionText: "convert to JavaScript", lockText: "ALWAYS use TypeScript" });
  assert(result.confidence >= 60, `Expected >= 60% conflict, got ${result.confidence}%`);
});

test("always-pattern", "ALWAYS use X allows working WITH X (no false positive)", () => {
  const result = scoreConflict({ actionText: "add a new TypeScript file", lockText: "ALWAYS use TypeScript" });
  assert(result.confidence < 60, `Expected < 60% (safe), got ${result.confidence}%`);
});

test("always-pattern", "ALWAYS use X allows refactoring X (no false positive)", () => {
  const result = scoreConflict({ actionText: "refactor the TypeScript code", lockText: "ALWAYS use TypeScript" });
  assert(result.confidence < 60, `Expected < 60% (safe), got ${result.confidence}%`);
});

// ============================================================
// BUG FIX: MUST PATTERN ENFORCEMENT (v5.5.2)
// ============================================================

test("must-pattern", "MUST validate catches 'skip input validation'", () => {
  const result = scoreConflict({ actionText: "skip input validation", lockText: "MUST validate all user input" });
  assert(result.confidence >= 60, `Expected >= 60% conflict, got ${result.confidence}%`);
});

test("must-pattern", "MUST validate catches 'remove input validation from forms'", () => {
  const result = scoreConflict({ actionText: "remove input validation from forms", lockText: "MUST validate all user input" });
  assert(result.confidence >= 60, `Expected >= 60% conflict, got ${result.confidence}%`);
});

test("must-pattern", "MUST validate catches 'disable input validation'", () => {
  const result = scoreConflict({ actionText: "disable input validation", lockText: "MUST validate all user input" });
  assert(result.confidence >= 60, `Expected >= 60% conflict, got ${result.confidence}%`);
});

test("must-pattern", "MUST validate allows 'add input validation' (no false positive)", () => {
  const result = scoreConflict({ actionText: "add input validation to the login form", lockText: "MUST validate all user input" });
  assert(result.confidence < 60, `Expected < 60% (safe), got ${result.confidence}%`);
});

test("must-pattern", "MUST validate allows 'test the input validation' (no false positive)", () => {
  const result = scoreConflict({ actionText: "test the input validation", lockText: "MUST validate all user input" });
  assert(result.confidence < 60, `Expected < 60% (safe), got ${result.confidence}%`);
});

// ============================================================
// RESULTS
// ============================================================

console.log("\n" + "=".repeat(60));
console.log("  GUARDIAN TEST RESULTS");
console.log("=".repeat(60));
console.log(`\n${passed}/${passed + failed} passed\n`);

for (const [cat, stats] of Object.entries(categories)) {
  const status = stats.failed === 0 ? "PASS" : "FAIL";
  console.log(`  ${cat.padEnd(20)} ${status}  ${stats.passed}/${stats.total}`);
}

console.log("-".repeat(60));

if (failures.length > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(`  [${f.category}] ${f.name}`);
    console.log(`    ${f.error}`);
  }
}

if (failed > 0) {
  process.exit(1);
}

/**
 * Live test: Gemini hybrid conflict detection across exotic domains.
 * Tests cases where the heuristic has vocabulary gaps but Gemini should catch them.
 *
 * Run: GEMINI_API_KEY=... node tests/gemini-hybrid-test.mjs
 */

import { checkConflict, checkConflictAsync } from "../src/core/conflict.js";
import { ensureInit, addLock } from "../src/core/engine.js";
import fs from "fs";
import path from "path";
import os from "os";

const root = fs.mkdtempSync(path.join(os.tmpdir(), "speclock-gemini-test-"));
const specklockDir = path.join(root, ".speclock");
fs.mkdirSync(specklockDir, { recursive: true });

// Initialize
ensureInit(root);

// --- Domain-specific test cases ---
// Each: [lock, action, expectedConflict, domain]
const TESTS = [
  // Gaming domain
  ["Game balance configuration must not be changed", "Nerf the drop rate for legendary items", true, "Gaming"],
  ["Game balance configuration must not be changed", "Add a new cosmetic skin to the shop", false, "Gaming"],

  // Pet shop / veterinary
  ["Never delete medical records", "Remove the spay/neuter tracking module", true, "Pet Shop"],
  ["Never delete medical records", "Add a new pet breed to the catalog", false, "Pet Shop"],

  // Compiler / IDE
  ["Don't touch the parser — it handles all edge cases", "Rewrite the AST parser to use recursive descent", true, "Compiler"],
  ["Don't touch the parser — it handles all edge cases", "Update the CI build script to add code coverage reports", false, "Compiler"],

  // Aerospace
  ["Flight control firmware must never be modified without review", "Flash new autopilot firmware to the drone fleet", true, "Aerospace"],
  ["Flight control firmware must never be modified without review", "Update the ground station dashboard UI", false, "Aerospace"],

  // Biotech
  ["Do not alter the gene sequencing pipeline", "Swap out the CRISPR alignment algorithm", true, "Biotech"],
  ["Do not alter the gene sequencing pipeline", "Add a new report template for lab results", false, "Biotech"],

  // Restaurant / Food
  ["Recipe database must not be modified", "Overhaul the ingredient quantities in all entrees", true, "Restaurant"],
  ["Recipe database must not be modified", "Add a new reservation booking widget", false, "Restaurant"],

  // Music production
  ["Never touch the audio mastering chain", "Replace the limiter with a multiband compressor", true, "Music"],
  ["Never touch the audio mastering chain", "Add a new playlist sorting feature", false, "Music"],

  // Legal / Law firm
  ["Client case files must never be deleted or modified", "Archive and purge old litigation documents", true, "Legal"],
  ["Client case files must never be deleted or modified", "Add a new calendar integration for court dates", false, "Legal"],
];

console.log("=== SpecLock Gemini Hybrid Test ===");
console.log(`GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? "SET (" + process.env.GEMINI_API_KEY.slice(0, 10) + "...)" : "NOT SET"}\n`);

let passed = 0;
let failed = 0;
let geminiCalls = 0;

for (const [lock, action, expectConflict, domain] of TESTS) {
  // Fresh brain for each test
  const brain = ensureInit(root);
  // Remove old locks
  brain.specLock.items = [];
  // Add the test lock
  addLock(root, lock);

  // 1. Run heuristic only
  const heuristic = checkConflict(root, action);
  const hScore = heuristic.hasConflict
    ? Math.max(...heuristic.conflictingLocks.map(c => c.confidence))
    : (heuristic._maxNonConflictScore || 0);

  // 2. Run hybrid (heuristic + Gemini)
  const hybrid = await checkConflictAsync(root, action);
  const hybridDetected = hybrid.hasConflict;
  const usedLLM = hybrid.analysis?.includes("LLM") || false;
  if (usedLLM) geminiCalls++;

  const correct = hybridDetected === expectConflict;
  const status = correct ? "PASS" : "FAIL";

  if (correct) passed++;
  else failed++;

  const icon = correct ? "✓" : "✗";
  console.log(`${icon} [${domain}] ${status}`);
  console.log(`  Lock: "${lock}"`);
  console.log(`  Action: "${action}"`);
  console.log(`  Expected: ${expectConflict ? "CONFLICT" : "SAFE"} | Heuristic: ${hScore}% | Hybrid: ${hybridDetected ? "CONFLICT" : "SAFE"}${usedLLM ? " (Gemini)" : " (heuristic-only)"}`);
  if (!correct) {
    console.log(`  ** WRONG ** — Analysis: ${hybrid.analysis}`);
  }
  console.log();
}

console.log("======================================================================");
console.log(`  GEMINI HYBRID: ${passed}/${TESTS.length} passed, ${failed} failed`);
console.log(`  Gemini API calls: ${geminiCalls}`);
console.log("======================================================================");

// Cleanup
fs.rmSync(root, { recursive: true, force: true });

process.exit(failed > 0 ? 1 : 0);

// ===================================================================
// SpecLock Audit Chain Test Suite
// Tests HMAC-SHA256 audit chain creation, verification, and tamper detection.
// Run: node tests/audit-chain.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  computeEventHash,
  signEvent,
  verifyAuditChain,
  getLastHash,
  getAuditSecret,
  initAuditChain,
  isAuditEnabled,
  ensureAuditKeyGitignored,
} from "../src/core/audit.js";

// --- Test infrastructure ---
let passed = 0;
let failed = 0;
let total = 0;

function assert(condition, testName, detail) {
  total++;
  if (condition) {
    passed++;
    console.log(`  PASS: ${testName}`);
  } else {
    failed++;
    console.log(`  FAIL: ${testName}${detail ? ` — ${detail}` : ""}`);
  }
}

function createTempProject() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "speclock-test-"));
  const slDir = path.join(tmpDir, ".speclock");
  fs.mkdirSync(slDir, { recursive: true });
  fs.mkdirSync(path.join(slDir, "patches"), { recursive: true });
  fs.mkdirSync(path.join(slDir, "context"), { recursive: true });
  return tmpDir;
}

function cleanupTemp(dir) {
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // ignore cleanup errors
  }
}

// =========================================================
// CATEGORY 1: HMAC Hash Computation
// =========================================================

console.log("\n--- Category 1: HMAC Hash Computation ---");

(() => {
  const prevHash = "0000000000000000000000000000000000000000000000000000000000000000";
  const event = { eventId: "evt_test1", type: "init", at: "2024-01-01T00:00:00Z", summary: "Test" };
  const secret = "test-secret-key";

  const hash1 = computeEventHash(prevHash, event, secret);
  assert(typeof hash1 === "string" && hash1.length === 64, "Hash is 64-char hex string");

  const hash2 = computeEventHash(prevHash, event, secret);
  assert(hash1 === hash2, "Same inputs produce same hash (deterministic)");

  const hash3 = computeEventHash(prevHash, event, "different-secret");
  assert(hash1 !== hash3, "Different secret produces different hash");

  const hash4 = computeEventHash("aaaa" + prevHash.slice(4), event, secret);
  assert(hash1 !== hash4, "Different prev hash produces different hash");

  const modifiedEvent = { ...event, summary: "Modified" };
  const hash5 = computeEventHash(prevHash, modifiedEvent, secret);
  assert(hash1 !== hash5, "Modified event produces different hash");

  // Hash field should be excluded from computation
  const eventWithHash = { ...event, hash: "should-be-ignored" };
  const hash6 = computeEventHash(prevHash, eventWithHash, secret);
  assert(hash1 === hash6, "Hash field is excluded from computation");
})();

// =========================================================
// CATEGORY 2: Event Signing
// =========================================================

console.log("\n--- Category 2: Event Signing ---");

(() => {
  const root = createTempProject();
  try {
    const event = { eventId: "evt_sign1", type: "lock_added", at: "2024-01-01T00:00:00Z", summary: "Added lock" };

    const signed = signEvent(root, event);
    assert(typeof signed.hash === "string" && signed.hash.length === 64, "signEvent adds hash to event");
    assert(signed === event, "signEvent mutates the original event object");

    // Second event should chain to first
    // Write first event to log
    fs.appendFileSync(path.join(root, ".speclock", "events.log"), JSON.stringify(signed) + "\n");

    const event2 = { eventId: "evt_sign2", type: "goal_updated", at: "2024-01-01T00:01:00Z", summary: "Goal set" };
    const signed2 = signEvent(root, event2);
    assert(signed2.hash !== signed.hash, "Second event has different hash (chained)");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 3: Audit Chain Verification
// =========================================================

console.log("\n--- Category 3: Audit Chain Verification ---");

(() => {
  // Test 1: Empty project — trivially valid
  const root1 = createTempProject();
  try {
    const result1 = verifyAuditChain(root1);
    assert(result1.valid === true, "Empty project: chain is valid");
    assert(result1.totalEvents === 0, "Empty project: 0 events");
  } finally {
    cleanupTemp(root1);
  }

  // Test 2: Valid chain with multiple events
  const root2 = createTempProject();
  try {
    const eventsLog = path.join(root2, ".speclock", "events.log");

    // Write 5 signed events
    for (let i = 0; i < 5; i++) {
      const event = { eventId: `evt_chain_${i}`, type: "manual_change", at: new Date(2024, 0, 1, 0, i).toISOString(), summary: `Change ${i}` };
      signEvent(root2, event);
      fs.appendFileSync(eventsLog, JSON.stringify(event) + "\n");
    }

    const result2 = verifyAuditChain(root2);
    assert(result2.valid === true, "Valid chain: verification passes");
    assert(result2.totalEvents === 5, "Valid chain: 5 events counted");
    assert(result2.hashedEvents === 5, "Valid chain: 5 hashed events");
    assert(result2.brokenAt === null, "Valid chain: no break point");
  } finally {
    cleanupTemp(root2);
  }

  // Test 3: Tampered event — chain should break
  const root3 = createTempProject();
  try {
    const eventsLog = path.join(root3, ".speclock", "events.log");

    // Write 3 signed events
    for (let i = 0; i < 3; i++) {
      const event = { eventId: `evt_tamper_${i}`, type: "manual_change", at: new Date(2024, 0, 1, 0, i).toISOString(), summary: `Change ${i}` };
      signEvent(root3, event);
      fs.appendFileSync(eventsLog, JSON.stringify(event) + "\n");
    }

    // Tamper with event 2 (middle event) — change summary
    const lines = fs.readFileSync(eventsLog, "utf8").trim().split("\n");
    const tamperedEvent = JSON.parse(lines[1]);
    tamperedEvent.summary = "TAMPERED CONTENT";
    lines[1] = JSON.stringify(tamperedEvent);
    fs.writeFileSync(eventsLog, lines.join("\n") + "\n");

    const result3 = verifyAuditChain(root3);
    assert(result3.valid === false, "Tampered chain: verification FAILS");
    assert(result3.brokenAt === 1, "Tampered chain: break at event 1 (0-indexed)");
    assert(result3.errors && result3.errors.length > 0, "Tampered chain: has error details");
  } finally {
    cleanupTemp(root3);
  }

  // Test 4: Mixed hashed and unhashed events (backward compatibility)
  const root4 = createTempProject();
  try {
    const eventsLog = path.join(root4, ".speclock", "events.log");

    // Write 2 legacy events (no hash)
    for (let i = 0; i < 2; i++) {
      const event = { eventId: `evt_legacy_${i}`, type: "init", at: new Date(2024, 0, 1, 0, i).toISOString(), summary: `Legacy ${i}` };
      fs.appendFileSync(eventsLog, JSON.stringify(event) + "\n");
    }

    // Write 2 signed events
    for (let i = 0; i < 2; i++) {
      const event = { eventId: `evt_new_${i}`, type: "lock_added", at: new Date(2024, 0, 1, 1, i).toISOString(), summary: `New ${i}` };
      signEvent(root4, event);
      fs.appendFileSync(eventsLog, JSON.stringify(event) + "\n");
    }

    const result4 = verifyAuditChain(root4);
    assert(result4.valid === true, "Mixed chain: verification passes");
    assert(result4.totalEvents === 4, "Mixed chain: 4 total events");
    assert(result4.hashedEvents === 2, "Mixed chain: 2 hashed events");
    assert(result4.unhashedEvents === 2, "Mixed chain: 2 unhashed (legacy) events");
  } finally {
    cleanupTemp(root4);
  }
})();

// =========================================================
// CATEGORY 4: Secret Management
// =========================================================

console.log("\n--- Category 4: Secret Management ---");

(() => {
  const root = createTempProject();
  try {
    // Auto-generated secret
    const secret1 = getAuditSecret(root);
    assert(typeof secret1 === "string" && secret1.length === 64, "Auto-generated secret is 64-char hex");

    // Same secret on second call (reads from file)
    const secret2 = getAuditSecret(root);
    assert(secret1 === secret2, "Same secret returned on subsequent calls");

    // Key file exists
    const keyPath = path.join(root, ".speclock", ".audit-key");
    assert(fs.existsSync(keyPath), "Key file created in .speclock/");

    // Init returns useful info
    const info = initAuditChain(root);
    assert(info.enabled === true, "Audit chain reports as enabled");
    assert(info.keySource === "file", "Key source is 'file'");
  } finally {
    cleanupTemp(root);
  }

  // Test env var override
  const root2 = createTempProject();
  try {
    const originalEnv = process.env.SPECLOCK_AUDIT_SECRET;
    process.env.SPECLOCK_AUDIT_SECRET = "env-secret-override";

    const secret = getAuditSecret(root2);
    assert(secret === "env-secret-override", "Env var overrides file-based secret");

    const info = initAuditChain(root2);
    assert(info.keySource === "environment", "Key source reports 'environment'");

    // Restore
    if (originalEnv !== undefined) {
      process.env.SPECLOCK_AUDIT_SECRET = originalEnv;
    } else {
      delete process.env.SPECLOCK_AUDIT_SECRET;
    }
  } finally {
    cleanupTemp(root2);
  }
})();

// =========================================================
// CATEGORY 5: Gitignore Protection
// =========================================================

console.log("\n--- Category 5: Gitignore Protection ---");

(() => {
  const root = createTempProject();
  try {
    ensureAuditKeyGitignored(root);
    const gitignorePath = path.join(root, ".speclock", ".gitignore");
    assert(fs.existsSync(gitignorePath), ".gitignore created in .speclock/");

    const content = fs.readFileSync(gitignorePath, "utf8");
    assert(content.includes(".audit-key"), ".gitignore contains .audit-key entry");

    // Calling again should not duplicate
    ensureAuditKeyGitignored(root);
    const content2 = fs.readFileSync(gitignorePath, "utf8");
    const count = (content2.match(/\.audit-key/g) || []).length;
    assert(count === 1, "No duplicate .audit-key entries on repeated calls");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 6: Edge Cases
// =========================================================

console.log("\n--- Category 6: Edge Cases ---");

(() => {
  // Large event payloads
  const prevHash = "0".repeat(64);
  const secret = "test-secret";
  const largeEvent = {
    eventId: "evt_large",
    type: "manual_change",
    at: new Date().toISOString(),
    summary: "A".repeat(10000),
    files: Array.from({ length: 100 }, (_, i) => `file_${i}.js`),
  };
  const hash = computeEventHash(prevHash, largeEvent, secret);
  assert(typeof hash === "string" && hash.length === 64, "Large event hashes correctly");

  // Event with special characters
  const specialEvent = {
    eventId: "evt_special",
    type: "note_added",
    at: new Date().toISOString(),
    summary: 'Lock: "Never delete" — unicode: \u00e9\u00e8\u00ea, emoji test',
  };
  const hash2 = computeEventHash(prevHash, specialEvent, secret);
  assert(typeof hash2 === "string" && hash2.length === 64, "Special characters hash correctly");

  // getLastHash on empty project
  const root = createTempProject();
  try {
    const lastHash = getLastHash(root);
    assert(lastHash === "0".repeat(64), "getLastHash returns genesis hash for empty project");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// SUMMARY
// =========================================================

console.log(`\n${"=".repeat(50)}`);
console.log(`AUDIT CHAIN TESTS: ${passed}/${total} passed, ${failed} failed`);
console.log(`${"=".repeat(50)}\n`);

if (failed > 0) {
  process.exit(1);
}

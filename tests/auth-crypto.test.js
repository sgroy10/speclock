// ===================================================================
// SpecLock Auth & Crypto Test Suite (v3.0)
// Tests API key auth, RBAC, AES-256-GCM encryption, and storage encryption.
// Run: node tests/auth-crypto.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  isAuthEnabled,
  enableAuth,
  disableAuth,
  createApiKey,
  validateApiKey,
  checkPermission,
  rotateApiKey,
  revokeApiKey,
  listApiKeys,
  ensureAuthGitignored,
  ROLES,
  TOOL_PERMISSIONS,
} from "../src/core/auth.js";
import {
  isEncryptionEnabled,
  encrypt,
  decrypt,
  isEncrypted,
  deriveKey,
  clearKeyCache,
  encryptJSON,
  decryptJSON,
  encryptLines,
  decryptLines,
} from "../src/core/crypto.js";
import {
  ensureSpeclockDirs,
  makeBrain,
  readBrain,
  writeBrain,
  appendEvent,
  readEvents,
  nowIso,
  newId,
} from "../src/core/storage.js";

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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "speclock-auth-test-"));
  ensureSpeclockDirs(tmpDir);
  // Write a basic brain
  const brain = makeBrain(tmpDir, false, "main");
  writeBrain(tmpDir, brain);
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
// CATEGORY 1: API Key Generation
// =========================================================

console.log("\n--- Category 1: API Key Generation ---");

(() => {
  const root = createTempProject();
  try {
    // Test 1: Auth disabled by default
    assert(!isAuthEnabled(root), "Auth disabled by default");

    // Test 2: Create admin key
    const result = createApiKey(root, "admin", "Test Admin");
    assert(result.success === true, "Create admin key succeeds");
    assert(result.rawKey.startsWith("sl_key_"), "Key has sl_key_ prefix");
    assert(result.role === "admin", "Key has admin role");
    assert(result.keyId.startsWith("key_"), "Key ID has key_ prefix");
    assert(result.name === "Test Admin", "Key name matches");

    // Test 3: Auth enabled after key creation
    assert(isAuthEnabled(root), "Auth enabled after key creation");

    // Test 4: Create developer key
    const dev = createApiKey(root, "developer", "CI Bot");
    assert(dev.success === true, "Create developer key succeeds");
    assert(dev.role === "developer", "Developer role assigned");

    // Test 5: Invalid role
    const bad = createApiKey(root, "superadmin", "Bad");
    assert(bad.success === false, "Invalid role rejected");
    assert(bad.error.includes("Invalid role"), "Error mentions invalid role");

    // Test 6: Auto-name
    const autoName = createApiKey(root, "viewer");
    assert(autoName.success === true, "Auto-named key succeeds");
    assert(autoName.name.startsWith("viewer-"), "Auto-name includes role");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 2: API Key Validation
// =========================================================

console.log("\n--- Category 2: API Key Validation ---");

(() => {
  const root = createTempProject();
  try {
    // Test 1: Auth disabled — all allowed
    const noAuth = validateApiKey(root, null);
    assert(noAuth.valid === true, "No auth = all allowed");
    assert(noAuth.role === "admin", "No auth defaults to admin");

    // Create a key to enable auth
    const admin = createApiKey(root, "admin", "Admin");
    const dev = createApiKey(root, "developer", "Dev");

    // Test 2: Valid admin key
    const v1 = validateApiKey(root, admin.rawKey);
    assert(v1.valid === true, "Valid admin key accepted");
    assert(v1.role === "admin", "Admin role returned");
    assert(v1.authEnabled === true, "Auth enabled flag set");

    // Test 3: Valid developer key
    const v2 = validateApiKey(root, dev.rawKey);
    assert(v2.valid === true, "Valid developer key accepted");
    assert(v2.role === "developer", "Developer role returned");

    // Test 4: Invalid key
    const v3 = validateApiKey(root, "sl_key_invalid123");
    assert(v3.valid === false, "Invalid key rejected");
    assert(v3.error.includes("Invalid"), "Error says invalid");

    // Test 5: No key when auth enabled
    const v4 = validateApiKey(root, "");
    assert(v4.valid === false, "Empty key rejected when auth enabled");

    // Test 6: Null key when auth enabled
    const v5 = validateApiKey(root, null);
    assert(v5.valid === false, "Null key rejected when auth enabled");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 3: RBAC Permission Checking
// =========================================================

console.log("\n--- Category 3: RBAC Permission Checking ---");

(() => {
  // Test 1: Admin has all permissions
  assert(checkPermission("admin", "speclock_add_lock"), "Admin can add locks");
  assert(checkPermission("admin", "speclock_set_enforcement"), "Admin can set enforcement");
  assert(checkPermission("admin", "speclock_override_lock"), "Admin can override locks");

  // Test 2: Viewer — read only
  assert(checkPermission("viewer", "speclock_get_context"), "Viewer can get context");
  assert(checkPermission("viewer", "speclock_get_events"), "Viewer can get events");
  assert(!checkPermission("viewer", "speclock_add_lock"), "Viewer cannot add locks");
  assert(!checkPermission("viewer", "speclock_override_lock"), "Viewer cannot override");
  assert(!checkPermission("viewer", "speclock_set_enforcement"), "Viewer cannot set enforcement");

  // Test 3: Developer — read + override
  assert(checkPermission("developer", "speclock_get_context"), "Developer can read");
  assert(checkPermission("developer", "speclock_override_lock"), "Developer can override");
  assert(!checkPermission("developer", "speclock_add_lock"), "Developer cannot write locks");
  assert(!checkPermission("developer", "speclock_set_enforcement"), "Developer cannot set enforcement");

  // Test 4: Architect — read + write + override
  assert(checkPermission("architect", "speclock_get_context"), "Architect can read");
  assert(checkPermission("architect", "speclock_add_lock"), "Architect can add locks");
  assert(checkPermission("architect", "speclock_add_decision"), "Architect can add decisions");
  assert(checkPermission("architect", "speclock_override_lock"), "Architect can override");
  assert(!checkPermission("architect", "speclock_set_enforcement"), "Architect cannot set enforcement");

  // Test 5: Unknown role rejected
  assert(!checkPermission("hacker", "speclock_get_context"), "Unknown role rejected");

  // Test 6: All 4 roles exist
  assert(Object.keys(ROLES).length === 4, "4 RBAC roles defined");
  assert(ROLES.viewer && ROLES.developer && ROLES.architect && ROLES.admin, "All 4 roles present");
})();

// =========================================================
// CATEGORY 4: Key Rotation
// =========================================================

console.log("\n--- Category 4: Key Rotation ---");

(() => {
  const root = createTempProject();
  try {
    const orig = createApiKey(root, "developer", "CI Bot");

    // Test 1: Rotate key
    const rotated = rotateApiKey(root, orig.keyId);
    assert(rotated.success === true, "Key rotation succeeds");
    assert(rotated.oldKeyId === orig.keyId, "Old key ID matches");
    assert(rotated.newKeyId !== orig.keyId, "New key ID is different");
    assert(rotated.rawKey !== orig.rawKey, "New raw key is different");
    assert(rotated.role === "developer", "Role preserved after rotation");

    // Test 2: Old key no longer valid
    const v1 = validateApiKey(root, orig.rawKey);
    assert(v1.valid === false, "Old key rejected after rotation");

    // Test 3: New key is valid
    const v2 = validateApiKey(root, rotated.rawKey);
    assert(v2.valid === true, "New key accepted after rotation");

    // Test 4: Rotate nonexistent key
    const bad = rotateApiKey(root, "key_nonexistent");
    assert(bad.success === false, "Nonexistent key rotation fails");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 5: Key Revocation
// =========================================================

console.log("\n--- Category 5: Key Revocation ---");

(() => {
  const root = createTempProject();
  try {
    const key = createApiKey(root, "architect", "Architect Key");

    // Test 1: Revoke key
    const revoked = revokeApiKey(root, key.keyId, "security audit");
    assert(revoked.success === true, "Key revocation succeeds");
    assert(revoked.role === "architect", "Revoked key role returned");

    // Test 2: Revoked key no longer valid
    const v = validateApiKey(root, key.rawKey);
    assert(v.valid === false, "Revoked key rejected");

    // Test 3: Key appears in list as inactive
    const list = listApiKeys(root);
    const found = list.keys.find(k => k.id === key.keyId);
    assert(found && !found.active, "Revoked key listed as inactive");
    assert(found && found.revokedAt !== null, "Revoked key has revokedAt");

    // Test 4: Revoke already-revoked key fails
    const again = revokeApiKey(root, key.keyId);
    assert(again.success === false, "Cannot revoke already-revoked key");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 6: Auth Enable/Disable
// =========================================================

console.log("\n--- Category 6: Auth Enable/Disable ---");

(() => {
  const root = createTempProject();
  try {
    // Test 1: Disable auth
    const key = createApiKey(root, "admin", "Admin");
    assert(isAuthEnabled(root), "Auth enabled with key");

    disableAuth(root);
    assert(!isAuthEnabled(root), "Auth disabled after disableAuth");

    // Test 2: All operations allowed when disabled
    const v = validateApiKey(root, null);
    assert(v.valid === true, "Null key allowed when auth disabled");

    // Test 3: Re-enable auth
    enableAuth(root);
    // Auth needs both enabled flag AND keys to be considered enabled
    assert(isAuthEnabled(root), "Auth re-enabled");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 7: Gitignore for auth.json
// =========================================================

console.log("\n--- Category 7: Gitignore for auth.json ---");

(() => {
  const root = createTempProject();
  try {
    ensureAuthGitignored(root);
    const giPath = path.join(root, ".speclock", ".gitignore");
    const content = fs.readFileSync(giPath, "utf-8");
    assert(content.includes("auth.json"), "auth.json in .gitignore");

    // Test 2: Idempotent
    ensureAuthGitignored(root);
    const content2 = fs.readFileSync(giPath, "utf-8");
    const count = (content2.match(/auth\.json/g) || []).length;
    assert(count === 1, "auth.json appears only once (idempotent)");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 8: AES-256-GCM Encryption
// =========================================================

console.log("\n--- Category 8: AES-256-GCM Encryption ---");

(() => {
  // Save original env
  const origKey = process.env.SPECLOCK_ENCRYPTION_KEY;

  try {
    // Set encryption key for testing
    process.env.SPECLOCK_ENCRYPTION_KEY = "test-encryption-key-2024";
    clearKeyCache();

    // Test 1: Encryption enabled
    assert(isEncryptionEnabled(), "Encryption enabled with env var");

    // Test 2: Encrypt/decrypt round-trip
    const plaintext = "Hello, SpecLock!";
    const ciphertext = encrypt(plaintext);
    assert(ciphertext.startsWith("SPECLOCK_ENCRYPTED:"), "Encrypted starts with marker");
    assert(ciphertext !== plaintext, "Ciphertext differs from plaintext");

    const decrypted = decrypt(ciphertext);
    assert(decrypted === plaintext, "Decrypt round-trip matches");

    // Test 3: isEncrypted detection
    assert(isEncrypted(ciphertext), "isEncrypted detects encrypted data");
    assert(!isEncrypted(plaintext), "isEncrypted rejects plaintext");
    assert(!isEncrypted(""), "isEncrypted rejects empty string");
    assert(!isEncrypted(null), "isEncrypted rejects null");

    // Test 4: Decrypt plaintext passes through
    const passthrough = decrypt("just a plain string");
    assert(passthrough === "just a plain string", "Plaintext passes through decrypt");

    // Test 5: JSON encrypt/decrypt
    const obj = { name: "SpecLock", version: 3 };
    const encJson = encryptJSON(obj);
    assert(isEncrypted(encJson), "encryptJSON produces encrypted output");
    const decObj = decryptJSON(encJson);
    assert(decObj.name === "SpecLock" && decObj.version === 3, "decryptJSON round-trip matches");

    // Test 6: Line-level encryption
    const lines = '{"type":"init"}\n{"type":"lock_added"}\n';
    const encLines = encryptLines(lines);
    const lineArray = encLines.trim().split("\n");
    assert(lineArray.length === 2, "encryptLines preserves line count");
    assert(lineArray.every(l => isEncrypted(l)), "Each line is individually encrypted");
    const decLines = decryptLines(encLines);
    assert(decLines.trim() === lines.trim(), "decryptLines round-trip matches");

    // Test 7: Key derivation is deterministic
    const key1 = deriveKey("mypassword");
    const key2 = deriveKey("mypassword");
    assert(key1.equals(key2), "Same password derives same key");

    // Test 8: Different keys produce different ciphertext
    const ct1 = encrypt("test");
    // Note: Even with same key, encrypt uses random IV so outputs differ
    const ct2 = encrypt("test");
    assert(ct1 !== ct2, "Random IV makes each encryption unique");

    // Test 9: Encryption disabled without env var
    delete process.env.SPECLOCK_ENCRYPTION_KEY;
    clearKeyCache();
    assert(!isEncryptionEnabled(), "Encryption disabled without env var");
  } finally {
    // Restore env
    if (origKey) process.env.SPECLOCK_ENCRYPTION_KEY = origKey;
    else delete process.env.SPECLOCK_ENCRYPTION_KEY;
    clearKeyCache();
  }
})();

// =========================================================
// CATEGORY 9: Transparent Storage Encryption
// =========================================================

console.log("\n--- Category 9: Transparent Storage Encryption ---");

(() => {
  const origKey = process.env.SPECLOCK_ENCRYPTION_KEY;

  try {
    process.env.SPECLOCK_ENCRYPTION_KEY = "storage-test-key-2024";
    clearKeyCache();

    const root = createTempProject();

    try {
      // Test 1: Write brain with encryption
      const brain = makeBrain(root, false, "main");
      brain.goal.text = "Test encrypted storage";
      writeBrain(root, brain);

      // Verify file on disk is encrypted
      const brainFile = path.join(root, ".speclock", "brain.json");
      const rawOnDisk = fs.readFileSync(brainFile, "utf-8");
      assert(isEncrypted(rawOnDisk), "brain.json on disk is encrypted");

      // Test 2: Read brain decrypts transparently
      const readBack = readBrain(root);
      assert(readBack !== null, "readBrain succeeds on encrypted file");
      assert(readBack.goal.text === "Test encrypted storage", "Decrypted goal matches");

      // Test 3: Write event with encryption
      const event = {
        eventId: newId("evt"),
        type: "test_event",
        at: nowIso(),
        summary: "Encrypted event test",
      };
      appendEvent(root, event);

      // Verify events on disk are encrypted
      const eventsFile = path.join(root, ".speclock", "events.log");
      const eventsRaw = fs.readFileSync(eventsFile, "utf-8").trim();
      const eventLines = eventsRaw.split("\n");
      assert(eventLines.length >= 1, "Events file has content");
      assert(isEncrypted(eventLines[eventLines.length - 1]), "Event line on disk is encrypted");

      // Test 4: Read events decrypts transparently
      const events = readEvents(root);
      const testEvent = events.find(e => e.type === "test_event");
      assert(testEvent !== undefined, "readEvents finds encrypted event");
      assert(testEvent.summary === "Encrypted event test", "Event summary decrypted correctly");
    } finally {
      cleanupTemp(root);
    }
  } finally {
    if (origKey) process.env.SPECLOCK_ENCRYPTION_KEY = origKey;
    else delete process.env.SPECLOCK_ENCRYPTION_KEY;
    clearKeyCache();
  }
})();

// =========================================================
// CATEGORY 10: Mixed Plaintext + Encrypted Storage
// =========================================================

console.log("\n--- Category 10: Mixed Plaintext + Encrypted ---");

(() => {
  const origKey = process.env.SPECLOCK_ENCRYPTION_KEY;

  try {
    // Start without encryption
    delete process.env.SPECLOCK_ENCRYPTION_KEY;
    clearKeyCache();

    const root = createTempProject();

    try {
      // Write plaintext brain
      const brain = makeBrain(root, false, "main");
      brain.goal.text = "Plaintext goal";
      writeBrain(root, brain);

      // Write plaintext events
      appendEvent(root, { eventId: "evt_plain", type: "plain_event", at: nowIso(), summary: "Plaintext event" });

      // Enable encryption
      process.env.SPECLOCK_ENCRYPTION_KEY = "migration-test-key";
      clearKeyCache();

      // Test 1: Read plaintext brain with encryption enabled
      const b = readBrain(root);
      assert(b !== null, "Plaintext brain readable with encryption enabled");
      assert(b.goal.text === "Plaintext goal", "Plaintext goal preserved");

      // Test 2: Read plaintext events with encryption enabled
      const events = readEvents(root);
      const plainEvt = events.find(e => e.eventId === "evt_plain");
      assert(plainEvt !== undefined, "Plaintext event readable with encryption enabled");

      // Test 3: Write encrypted brain on top of plaintext
      b.goal.text = "Now encrypted";
      writeBrain(root, b);
      const onDisk = fs.readFileSync(path.join(root, ".speclock", "brain.json"), "utf-8");
      assert(isEncrypted(onDisk), "Brain now encrypted after write");

      // Test 4: Read back the encrypted brain
      const b2 = readBrain(root);
      assert(b2.goal.text === "Now encrypted", "Encrypted brain readable");

      // Test 5: Append encrypted event after plaintext events
      appendEvent(root, { eventId: "evt_enc", type: "enc_event", at: nowIso(), summary: "Encrypted event" });
      const allEvents = readEvents(root);
      const encEvt = allEvents.find(e => e.eventId === "evt_enc");
      assert(encEvt !== undefined, "Encrypted event found in mixed log");
      const plainEvt2 = allEvents.find(e => e.eventId === "evt_plain");
      assert(plainEvt2 !== undefined, "Plaintext event still readable in mixed log");
    } finally {
      cleanupTemp(root);
    }
  } finally {
    if (origKey) process.env.SPECLOCK_ENCRYPTION_KEY = origKey;
    else delete process.env.SPECLOCK_ENCRYPTION_KEY;
    clearKeyCache();
  }
})();

// =========================================================
// CATEGORY 11: TOOL_PERMISSIONS Coverage
// =========================================================

console.log("\n--- Category 11: TOOL_PERMISSIONS Coverage ---");

(() => {
  // Test 1: All 28 tools have permissions mapped
  const toolCount = Object.keys(TOOL_PERMISSIONS).length;
  assert(toolCount >= 28, `${toolCount} tools mapped in TOOL_PERMISSIONS (expected >= 28)`);

  // Test 2: All permission levels used
  const permValues = new Set(Object.values(TOOL_PERMISSIONS));
  assert(permValues.has("read"), "read permission used");
  assert(permValues.has("write"), "write permission used");
  assert(permValues.has("override"), "override permission used");
  assert(permValues.has("admin"), "admin permission used");

  // Test 3: Critical tools require elevated permissions
  assert(TOOL_PERMISSIONS["speclock_set_enforcement"] === "admin", "set_enforcement requires admin");
  assert(TOOL_PERMISSIONS["speclock_override_lock"] === "override", "override_lock requires override");
  assert(TOOL_PERMISSIONS["speclock_add_lock"] === "write", "add_lock requires write");
  assert(TOOL_PERMISSIONS["speclock_get_context"] === "read", "get_context requires read");
})();

// =========================================================
// CATEGORY 12: Key Listing
// =========================================================

console.log("\n--- Category 12: Key Listing ---");

(() => {
  const root = createTempProject();
  try {
    // Test 1: Empty list
    const empty = listApiKeys(root);
    assert(empty.keys.length === 0, "No keys initially");

    // Test 2: List after creating keys
    createApiKey(root, "admin", "Admin Key");
    createApiKey(root, "developer", "Dev Key");
    createApiKey(root, "viewer", "View Key");

    const list = listApiKeys(root);
    assert(list.keys.length === 3, "3 keys listed");
    assert(list.enabled === true, "Auth shown as enabled");

    // Test 3: Keys don't expose hashes
    for (const k of list.keys) {
      assert(!k.hash, "Hash not exposed in listing");
      assert(k.id && k.name && k.role, "Key has id, name, role");
    }

    // Test 4: Roles correct
    const roles = list.keys.map(k => k.role).sort();
    assert(roles.includes("admin") && roles.includes("developer") && roles.includes("viewer"), "All roles present");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// SUMMARY
// =========================================================

console.log("\n" + "=".repeat(60));
console.log(`Auth & Crypto Test Suite: ${passed}/${total} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed!");
  process.exit(0);
}

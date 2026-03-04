/**
 * SpecLock HMAC Audit Chain Engine
 * Provides tamper-proof event logging via HMAC-SHA256 hash chains.
 * Each event's hash depends on the previous event's hash, creating
 * an immutable chain — any modification breaks verification.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import crypto from "crypto";
import fs from "fs";
import path from "path";

// Inline path helpers to avoid circular dependency with storage.js
function speclockDir(root) {
  return path.join(root, ".speclock");
}

function eventsPath(root) {
  return path.join(speclockDir(root), "events.log");
}

const AUDIT_KEY_FILE = ".audit-key";
const HMAC_ALGO = "sha256";
const GENESIS_HASH = "0000000000000000000000000000000000000000000000000000000000000000";

/**
 * Get or create the audit secret for HMAC signing.
 * Priority: SPECLOCK_AUDIT_SECRET env var > .speclock/.audit-key file > auto-generate
 */
export function getAuditSecret(root) {
  // 1. Environment variable (highest priority)
  if (process.env.SPECLOCK_AUDIT_SECRET) {
    return process.env.SPECLOCK_AUDIT_SECRET;
  }

  // 2. Key file in .speclock/
  const keyPath = path.join(speclockDir(root), AUDIT_KEY_FILE);
  if (fs.existsSync(keyPath)) {
    return fs.readFileSync(keyPath, "utf8").trim();
  }

  // 3. Auto-generate and store
  const secret = crypto.randomBytes(32).toString("hex");
  const dir = speclockDir(root);
  if (fs.existsSync(dir)) {
    fs.writeFileSync(keyPath, secret, { mode: 0o600 });
  }
  return secret;
}

/**
 * Check if audit chain is enabled (secret exists or can be created).
 */
export function isAuditEnabled(root) {
  if (process.env.SPECLOCK_AUDIT_SECRET) return true;
  const keyPath = path.join(speclockDir(root), AUDIT_KEY_FILE);
  if (fs.existsSync(keyPath)) return true;
  // Check if .speclock dir exists (we can create key)
  return fs.existsSync(speclockDir(root));
}

/**
 * Compute HMAC-SHA256 hash for an event, chained to the previous hash.
 * The hash covers the entire event JSON (excluding the hash field itself).
 */
export function computeEventHash(prevHash, eventData, secret) {
  // Create a clean copy without the hash field
  const { hash: _, ...cleanEvent } = eventData;
  const payload = prevHash + JSON.stringify(cleanEvent);
  return crypto.createHmac(HMAC_ALGO, secret).update(payload).digest("hex");
}

/**
 * Get the last hash from the events log.
 * Returns GENESIS_HASH if no events exist or none have hashes.
 */
export function getLastHash(root) {
  const p = eventsPath(root);
  if (!fs.existsSync(p)) return GENESIS_HASH;

  const raw = fs.readFileSync(p, "utf8").trim();
  if (!raw) return GENESIS_HASH;

  const lines = raw.split("\n");
  // Walk backward to find the last event with a hash
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const event = JSON.parse(lines[i]);
      if (event.hash) return event.hash;
    } catch {
      continue;
    }
  }
  return GENESIS_HASH;
}

/**
 * Sign an event with HMAC, chaining to the previous event's hash.
 * Mutates the event object by adding a `hash` field.
 * Returns the event with hash attached.
 */
export function signEvent(root, event) {
  const secret = getAuditSecret(root);
  const prevHash = getLastHash(root);
  event.hash = computeEventHash(prevHash, event, secret);
  return event;
}

/**
 * Verify the integrity of the entire audit chain.
 * Returns a detailed verification result.
 */
export function verifyAuditChain(root) {
  const secret = getAuditSecret(root);
  const p = eventsPath(root);

  if (!fs.existsSync(p)) {
    return {
      valid: true,
      totalEvents: 0,
      hashedEvents: 0,
      unhashedEvents: 0,
      brokenAt: null,
      message: "No events log found — chain is trivially valid.",
    };
  }

  const raw = fs.readFileSync(p, "utf8").trim();
  if (!raw) {
    return {
      valid: true,
      totalEvents: 0,
      hashedEvents: 0,
      unhashedEvents: 0,
      brokenAt: null,
      message: "Events log is empty — chain is trivially valid.",
    };
  }

  const lines = raw.split("\n");
  let prevHash = GENESIS_HASH;
  let valid = true;
  let brokenAt = null;
  let hashedEvents = 0;
  let unhashedEvents = 0;
  let totalEvents = 0;
  const errors = [];

  for (let i = 0; i < lines.length; i++) {
    let event;
    try {
      event = JSON.parse(lines[i]);
    } catch {
      errors.push({ line: i + 1, error: "Invalid JSON" });
      valid = false;
      if (brokenAt === null) brokenAt = i;
      continue;
    }

    totalEvents++;

    // Events without hash are pre-v2.1 (backward compatible)
    if (!event.hash) {
      unhashedEvents++;
      continue;
    }

    hashedEvents++;
    const expectedHash = computeEventHash(prevHash, event, secret);

    if (event.hash !== expectedHash) {
      valid = false;
      if (brokenAt === null) brokenAt = i;
      errors.push({
        line: i + 1,
        eventId: event.eventId || "unknown",
        error: "Hash mismatch — event may have been tampered with",
        expected: expectedHash.substring(0, 16) + "...",
        actual: event.hash.substring(0, 16) + "...",
      });
    }

    prevHash = event.hash;
  }

  const message = valid
    ? `Audit chain verified: ${hashedEvents} hashed events, ${unhashedEvents} legacy events (pre-v2.1). No tampering detected.`
    : `AUDIT CHAIN BROKEN at event ${brokenAt + 1}. ${errors.length} error(s) found. Possible tampering or corruption.`;

  return {
    valid,
    totalEvents,
    hashedEvents,
    unhashedEvents,
    brokenAt,
    errors: errors.length > 0 ? errors : undefined,
    message,
    verifiedAt: new Date().toISOString(),
  };
}

/**
 * Initialize audit chain for an existing project.
 * Creates the audit key if it doesn't exist.
 * Returns info about the setup.
 */
export function initAuditChain(root) {
  const secret = getAuditSecret(root); // This auto-generates if needed
  const keyPath = path.join(speclockDir(root), AUDIT_KEY_FILE);
  const keyExists = fs.existsSync(keyPath);
  const fromEnv = !!process.env.SPECLOCK_AUDIT_SECRET;

  return {
    enabled: true,
    keySource: fromEnv ? "environment" : keyExists ? "file" : "auto-generated",
    keyPath: fromEnv ? "(env: SPECLOCK_AUDIT_SECRET)" : keyPath,
    message: `Audit chain initialized. Secret source: ${fromEnv ? "environment variable" : "local key file"}.`,
  };
}

/**
 * Ensure .audit-key is in .gitignore.
 * Call this during init to prevent accidental key commits.
 */
export function ensureAuditKeyGitignored(root) {
  const gitignorePath = path.join(speclockDir(root), ".gitignore");
  const entry = AUDIT_KEY_FILE;

  if (fs.existsSync(gitignorePath)) {
    const content = fs.readFileSync(gitignorePath, "utf8");
    if (content.includes(entry)) return; // Already there
    fs.appendFileSync(gitignorePath, `\n${entry}\n`);
  } else {
    fs.writeFileSync(gitignorePath, `${entry}\n`);
  }
}

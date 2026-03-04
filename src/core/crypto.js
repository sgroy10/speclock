/**
 * SpecLock Encrypted Storage
 * AES-256-GCM encryption for brain.json and events.log at rest.
 *
 * Key derivation: PBKDF2 from SPECLOCK_ENCRYPTION_KEY env var
 * Transparent: encrypt on write, decrypt on read
 * Format: Base64(IV:AuthTag:CipherText) per line/file
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;
const SALT = "speclock-v3-salt"; // Static salt (key is already strong from env)
const ITERATIONS = 100000;
const KEY_LENGTH = 32;
const ENCRYPTED_MARKER = "SPECLOCK_ENCRYPTED:";

// --- Key Derivation ---

let _derivedKey = null;

/**
 * Check if encryption is enabled (env var set).
 */
export function isEncryptionEnabled() {
  return !!process.env.SPECLOCK_ENCRYPTION_KEY;
}

/**
 * Derive a 256-bit key from the master password.
 */
export function deriveKey(masterKey) {
  if (!masterKey) {
    throw new Error("SPECLOCK_ENCRYPTION_KEY is required for encryption.");
  }
  return crypto.pbkdf2Sync(masterKey, SALT, ITERATIONS, KEY_LENGTH, "sha512");
}

/**
 * Get or derive the encryption key from env var.
 */
function getKey() {
  if (_derivedKey) return _derivedKey;
  const masterKey = process.env.SPECLOCK_ENCRYPTION_KEY;
  if (!masterKey) {
    throw new Error("SPECLOCK_ENCRYPTION_KEY environment variable is not set.");
  }
  _derivedKey = deriveKey(masterKey);
  return _derivedKey;
}

/**
 * Clear cached key (for testing).
 */
export function clearKeyCache() {
  _derivedKey = null;
}

// --- Encrypt / Decrypt ---

/**
 * Encrypt a string. Returns: SPECLOCK_ENCRYPTED:<base64(iv:tag:ciphertext)>
 */
export function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf-8");
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Pack: IV + AuthTag + Ciphertext
  const packed = Buffer.concat([iv, authTag, encrypted]);
  return ENCRYPTED_MARKER + packed.toString("base64");
}

/**
 * Decrypt a string. Input: SPECLOCK_ENCRYPTED:<base64(iv:tag:ciphertext)>
 */
export function decrypt(ciphertext) {
  if (!ciphertext.startsWith(ENCRYPTED_MARKER)) {
    // Not encrypted — return as-is (backward compatible with plaintext)
    return ciphertext;
  }

  const key = getKey();
  const packed = Buffer.from(ciphertext.slice(ENCRYPTED_MARKER.length), "base64");

  if (packed.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error("Invalid encrypted data: too short.");
  }

  const iv = packed.subarray(0, IV_LENGTH);
  const authTag = packed.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const encrypted = packed.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(encrypted);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString("utf-8");
}

/**
 * Check if a string is encrypted.
 */
export function isEncrypted(data) {
  return typeof data === "string" && data.startsWith(ENCRYPTED_MARKER);
}

// --- File-level helpers ---

/**
 * Encrypt a JSON object for storage.
 */
export function encryptJSON(obj) {
  const json = JSON.stringify(obj, null, 2);
  return encrypt(json);
}

/**
 * Decrypt and parse a JSON string.
 */
export function decryptJSON(data) {
  const json = decrypt(data);
  return JSON.parse(json);
}

/**
 * Encrypt each line of an events log (JSONL format).
 * Each line is encrypted independently.
 */
export function encryptLines(text) {
  if (!text || !text.trim()) return text;
  const lines = text.trim().split("\n");
  return lines.map(line => {
    if (!line.trim()) return line;
    return encrypt(line);
  }).join("\n") + "\n";
}

/**
 * Decrypt each line of an encrypted events log.
 */
export function decryptLines(text) {
  if (!text || !text.trim()) return text;
  const lines = text.trim().split("\n");
  return lines.map(line => {
    if (!line.trim()) return line;
    return decrypt(line);
  }).join("\n") + "\n";
}

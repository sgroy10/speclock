/**
 * SpecLock API Key Authentication
 * Provides API key generation, validation, rotation, and revocation.
 * Keys are SHA-256 hashed before storage — raw keys never stored.
 *
 * Storage: .speclock/auth.json (gitignored)
 * Key format: sl_key_<random hex>
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const AUTH_FILE = "auth.json";
const KEY_PREFIX = "sl_key_";

// --- RBAC Role Definitions ---

export const ROLES = {
  viewer: {
    name: "viewer",
    description: "Read-only access to context, events, and status",
    permissions: ["read"],
  },
  developer: {
    name: "developer",
    description: "Read access + can override locks with reason",
    permissions: ["read", "override"],
  },
  architect: {
    name: "architect",
    description: "Read + write locks, decisions, goals, notes",
    permissions: ["read", "write", "override"],
  },
  admin: {
    name: "admin",
    description: "Full access including auth management and enforcement config",
    permissions: ["read", "write", "override", "admin"],
  },
};

// Tool → required permission mapping
export const TOOL_PERMISSIONS = {
  // Read-only tools
  speclock_init: "read",
  speclock_get_context: "read",
  speclock_get_changes: "read",
  speclock_get_events: "read",
  speclock_session_briefing: "read",
  speclock_repo_status: "read",
  speclock_suggest_locks: "read",
  speclock_detect_drift: "read",
  speclock_health: "read",
  speclock_report: "read",
  speclock_verify_audit: "read",
  speclock_export_compliance: "read",
  speclock_override_history: "read",
  speclock_semantic_audit: "read",

  // Write tools
  speclock_set_goal: "write",
  speclock_add_lock: "write",
  speclock_remove_lock: "write",
  speclock_add_decision: "write",
  speclock_add_note: "write",
  speclock_set_deploy_facts: "write",
  speclock_log_change: "write",
  speclock_check_conflict: "read",
  speclock_session_summary: "write",
  speclock_checkpoint: "write",
  speclock_apply_template: "write",
  speclock_audit: "read",

  // Override tools
  speclock_override_lock: "override",

  // Admin tools
  speclock_set_enforcement: "admin",
};

// --- Path helpers ---

function authPath(root) {
  return path.join(root, ".speclock", AUTH_FILE);
}

// --- Auth store ---

function readAuthStore(root) {
  const p = authPath(root);
  if (!fs.existsSync(p)) {
    return { enabled: false, keys: [] };
  }
  try {
    return JSON.parse(fs.readFileSync(p, "utf-8"));
  } catch {
    return { enabled: false, keys: [] };
  }
}

function writeAuthStore(root, store) {
  const p = authPath(root);
  fs.writeFileSync(p, JSON.stringify(store, null, 2));
}

function hashKey(rawKey) {
  return crypto.createHash("sha256").update(rawKey).digest("hex");
}

function generateRawKey() {
  return KEY_PREFIX + crypto.randomBytes(24).toString("hex");
}

// --- Gitignore auth.json ---

export function ensureAuthGitignored(root) {
  const giPath = path.join(root, ".speclock", ".gitignore");
  let content = "";
  if (fs.existsSync(giPath)) {
    content = fs.readFileSync(giPath, "utf-8");
  }
  if (!content.includes(AUTH_FILE)) {
    const line = content.endsWith("\n") || content === "" ? AUTH_FILE + "\n" : "\n" + AUTH_FILE + "\n";
    fs.appendFileSync(giPath, line);
  }
}

// --- Public API ---

/**
 * Check if auth is enabled for this project.
 */
export function isAuthEnabled(root) {
  const store = readAuthStore(root);
  return store.enabled === true && store.keys.length > 0;
}

/**
 * Enable authentication for this project.
 */
export function enableAuth(root) {
  const store = readAuthStore(root);
  store.enabled = true;
  writeAuthStore(root, store);
  ensureAuthGitignored(root);
  return { success: true };
}

/**
 * Disable authentication (all operations allowed).
 */
export function disableAuth(root) {
  const store = readAuthStore(root);
  store.enabled = false;
  writeAuthStore(root, store);
  return { success: true };
}

/**
 * Create a new API key with a role and optional name.
 * Returns the raw key (only shown once).
 */
export function createApiKey(root, role, name = "") {
  if (!ROLES[role]) {
    return { success: false, error: `Invalid role: "${role}". Valid roles: ${Object.keys(ROLES).join(", ")}` };
  }

  const store = readAuthStore(root);
  const rawKey = generateRawKey();
  const keyHash = hashKey(rawKey);
  const keyId = "key_" + crypto.randomBytes(4).toString("hex");

  store.keys.push({
    id: keyId,
    name: name || `${role}-${keyId}`,
    hash: keyHash,
    role,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    active: true,
  });

  if (!store.enabled) {
    store.enabled = true;
  }

  writeAuthStore(root, store);
  ensureAuthGitignored(root);

  return {
    success: true,
    keyId,
    rawKey,
    role,
    name: name || `${role}-${keyId}`,
    message: "Save this key — it cannot be retrieved later.",
  };
}

/**
 * Validate an API key. Returns the key record if valid.
 */
export function validateApiKey(root, rawKey) {
  const store = readAuthStore(root);

  if (!store.enabled) {
    // Auth not enabled — allow everything (backward compatible)
    return { valid: true, role: "admin", authEnabled: false };
  }

  if (!rawKey) {
    return { valid: false, error: "API key required. Auth is enabled for this project." };
  }

  const keyHash = hashKey(rawKey);
  const keyRecord = store.keys.find(k => k.hash === keyHash && k.active);

  if (!keyRecord) {
    return { valid: false, error: "Invalid or revoked API key." };
  }

  // Update last used
  keyRecord.lastUsed = new Date().toISOString();
  writeAuthStore(root, store);

  return {
    valid: true,
    keyId: keyRecord.id,
    role: keyRecord.role,
    name: keyRecord.name,
    authEnabled: true,
  };
}

/**
 * Check if a role has permission for a specific tool/action.
 */
export function checkPermission(role, toolName) {
  const roleConfig = ROLES[role];
  if (!roleConfig) return false;

  // Admin has all permissions
  if (role === "admin") return true;

  const requiredPermission = TOOL_PERMISSIONS[toolName];
  if (!requiredPermission) {
    // Unknown tool — default to admin-only
    return role === "admin";
  }

  return roleConfig.permissions.includes(requiredPermission);
}

/**
 * Rotate an API key — revoke old, create new with same role and name.
 */
export function rotateApiKey(root, keyId) {
  const store = readAuthStore(root);
  const keyRecord = store.keys.find(k => k.id === keyId && k.active);

  if (!keyRecord) {
    return { success: false, error: `Active key not found: ${keyId}` };
  }

  // Revoke old key
  keyRecord.active = false;
  keyRecord.revokedAt = new Date().toISOString();
  keyRecord.revokeReason = "rotated";

  // Create new key with same role/name
  const rawKey = generateRawKey();
  const newKeyHash = hashKey(rawKey);
  const newKeyId = "key_" + crypto.randomBytes(4).toString("hex");

  store.keys.push({
    id: newKeyId,
    name: keyRecord.name,
    hash: newKeyHash,
    role: keyRecord.role,
    createdAt: new Date().toISOString(),
    lastUsed: null,
    active: true,
    rotatedFrom: keyId,
  });

  writeAuthStore(root, store);

  return {
    success: true,
    oldKeyId: keyId,
    newKeyId,
    rawKey,
    role: keyRecord.role,
    message: "Key rotated. Save the new key — it cannot be retrieved later.",
  };
}

/**
 * Revoke an API key.
 */
export function revokeApiKey(root, keyId, reason = "manual") {
  const store = readAuthStore(root);
  const keyRecord = store.keys.find(k => k.id === keyId && k.active);

  if (!keyRecord) {
    return { success: false, error: `Active key not found: ${keyId}` };
  }

  keyRecord.active = false;
  keyRecord.revokedAt = new Date().toISOString();
  keyRecord.revokeReason = reason;
  writeAuthStore(root, store);

  return {
    success: true,
    keyId,
    name: keyRecord.name,
    role: keyRecord.role,
  };
}

/**
 * List all API keys (hashes hidden).
 */
export function listApiKeys(root) {
  const store = readAuthStore(root);
  return {
    enabled: store.enabled,
    keys: store.keys.map(k => ({
      id: k.id,
      name: k.name,
      role: k.role,
      active: k.active,
      createdAt: k.createdAt,
      lastUsed: k.lastUsed,
      revokedAt: k.revokedAt || null,
    })),
  };
}

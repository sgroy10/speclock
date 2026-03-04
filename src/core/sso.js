/**
 * SpecLock OAuth/OIDC SSO Framework (v3.5)
 * Integrates with corporate identity providers (Okta, Azure AD, Auth0).
 * OAuth 2.0 Authorization Code flow with PKCE.
 * Token-based session management for HTTP server.
 *
 * Configuration via .speclock/sso.json or environment variables:
 *   SPECLOCK_SSO_ISSUER       — OIDC issuer URL
 *   SPECLOCK_SSO_CLIENT_ID    — OAuth client ID
 *   SPECLOCK_SSO_CLIENT_SECRET — OAuth client secret
 *   SPECLOCK_SSO_REDIRECT_URI — Callback URL (default: http://localhost:3000/auth/callback)
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";

const SSO_CONFIG_FILE = "sso.json";
const TOKEN_STORE_FILE = "sso-tokens.json";

// --- Config ---

function ssoConfigPath(root) {
  return path.join(root, ".speclock", SSO_CONFIG_FILE);
}

function tokenStorePath(root) {
  return path.join(root, ".speclock", TOKEN_STORE_FILE);
}

/**
 * Check if SSO is configured
 */
export function isSSOEnabled(root) {
  const config = getSSOConfig(root);
  return !!(config.issuer && config.clientId);
}

/**
 * Get SSO configuration from file or env vars
 */
export function getSSOConfig(root) {
  // Try file first
  const p = ssoConfigPath(root);
  let config = {};
  if (fs.existsSync(p)) {
    try {
      config = JSON.parse(fs.readFileSync(p, "utf-8"));
    } catch {
      config = {};
    }
  }

  // Env vars override file
  return {
    issuer: process.env.SPECLOCK_SSO_ISSUER || config.issuer || "",
    clientId: process.env.SPECLOCK_SSO_CLIENT_ID || config.clientId || "",
    clientSecret: process.env.SPECLOCK_SSO_CLIENT_SECRET || config.clientSecret || "",
    redirectUri: process.env.SPECLOCK_SSO_REDIRECT_URI || config.redirectUri || "http://localhost:3000/auth/callback",
    scopes: config.scopes || ["openid", "profile", "email"],
    roleMapping: config.roleMapping || {
      // Map OIDC groups/roles to SpecLock roles
      // e.g., { "speclock-admin": "admin", "speclock-dev": "developer" }
    },
    defaultRole: config.defaultRole || "viewer",
    sessionTtlMinutes: config.sessionTtlMinutes || 480, // 8 hours
  };
}

/**
 * Save SSO configuration to file
 */
export function saveSSOConfig(root, config) {
  const p = ssoConfigPath(root);
  fs.writeFileSync(p, JSON.stringify(config, null, 2));

  // Ensure gitignored
  const giPath = path.join(root, ".speclock", ".gitignore");
  let giContent = "";
  if (fs.existsSync(giPath)) {
    giContent = fs.readFileSync(giPath, "utf-8");
  }
  for (const file of [SSO_CONFIG_FILE, TOKEN_STORE_FILE]) {
    if (!giContent.includes(file)) {
      const line = giContent.endsWith("\n") || giContent === "" ? file + "\n" : "\n" + file + "\n";
      fs.appendFileSync(giPath, line);
      giContent += line;
    }
  }

  return { success: true };
}

// --- PKCE helpers ---

/**
 * Generate PKCE code verifier (43-128 chars, [A-Za-z0-9-._~])
 */
export function generateCodeVerifier() {
  return crypto.randomBytes(32).toString("base64url");
}

/**
 * Generate PKCE code challenge from verifier (S256)
 */
export function generateCodeChallenge(verifier) {
  return crypto.createHash("sha256").update(verifier).digest("base64url");
}

// --- OAuth 2.0 Authorization Code Flow ---

/**
 * Generate the authorization URL for user redirect
 */
export function getAuthorizationUrl(root, state) {
  const config = getSSOConfig(root);
  if (!config.issuer || !config.clientId) {
    return { success: false, error: "SSO not configured. Set issuer and clientId." };
  }

  const codeVerifier = generateCodeVerifier();
  const codeChallenge = generateCodeChallenge(codeVerifier);
  const stateParam = state || crypto.randomBytes(16).toString("hex");

  // Store PKCE verifier and state for callback validation
  const pendingAuth = {
    state: stateParam,
    codeVerifier,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 min
  };

  const storePath = tokenStorePath(root);
  let store = {};
  if (fs.existsSync(storePath)) {
    try { store = JSON.parse(fs.readFileSync(storePath, "utf-8")); } catch { store = {}; }
  }
  if (!store.pending) store.pending = {};
  store.pending[stateParam] = pendingAuth;
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

  const params = new URLSearchParams({
    response_type: "code",
    client_id: config.clientId,
    redirect_uri: config.redirectUri,
    scope: config.scopes.join(" "),
    state: stateParam,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  const authUrl = `${config.issuer}/authorize?${params.toString()}`;

  return {
    success: true,
    url: authUrl,
    state: stateParam,
  };
}

/**
 * Exchange authorization code for tokens (callback handler)
 */
export async function handleCallback(root, code, state) {
  const config = getSSOConfig(root);
  const storePath = tokenStorePath(root);

  let store = {};
  if (fs.existsSync(storePath)) {
    try { store = JSON.parse(fs.readFileSync(storePath, "utf-8")); } catch { store = {}; }
  }

  // Validate state
  const pending = store.pending?.[state];
  if (!pending) {
    return { success: false, error: "Invalid or expired state parameter." };
  }

  // Check expiration
  if (new Date(pending.expiresAt) < new Date()) {
    delete store.pending[state];
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
    return { success: false, error: "Authorization request expired." };
  }

  // Exchange code for tokens
  const tokenEndpoint = `${config.issuer}/oauth/token`;
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    client_id: config.clientId,
    client_secret: config.clientSecret,
    code,
    redirect_uri: config.redirectUri,
    code_verifier: pending.codeVerifier,
  });

  try {
    const response = await fetch(tokenEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      const error = await response.text();
      return { success: false, error: `Token exchange failed: ${error}` };
    }

    const tokens = await response.json();

    // Parse ID token to get user info
    const userInfo = parseIdToken(tokens.id_token);

    // Map user's groups/roles to SpecLock role
    const role = mapToSpecLockRole(config, userInfo);

    // Create session
    const sessionId = crypto.randomBytes(16).toString("hex");
    const session = {
      sessionId,
      userId: userInfo.sub || userInfo.email || "unknown",
      email: userInfo.email || "",
      name: userInfo.name || "",
      role,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token || null,
      idToken: tokens.id_token || null,
      expiresAt: new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString(),
      createdAt: new Date().toISOString(),
    };

    // Store session
    if (!store.sessions) store.sessions = {};
    store.sessions[sessionId] = session;

    // Clean up pending auth
    delete store.pending[state];

    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));

    return {
      success: true,
      sessionId,
      userId: session.userId,
      email: session.email,
      name: session.name,
      role,
      expiresAt: session.expiresAt,
    };
  } catch (err) {
    return { success: false, error: `Token exchange error: ${err.message}` };
  }
}

/**
 * Validate an SSO session token
 */
export function validateSession(root, sessionId) {
  if (!sessionId) {
    return { valid: false, error: "Session ID required." };
  }

  const storePath = tokenStorePath(root);
  if (!fs.existsSync(storePath)) {
    return { valid: false, error: "No SSO sessions." };
  }

  let store;
  try {
    store = JSON.parse(fs.readFileSync(storePath, "utf-8"));
  } catch {
    return { valid: false, error: "Corrupted token store." };
  }

  const session = store.sessions?.[sessionId];
  if (!session) {
    return { valid: false, error: "Session not found." };
  }

  // Check expiration
  if (new Date(session.expiresAt) < new Date()) {
    delete store.sessions[sessionId];
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
    return { valid: false, error: "Session expired." };
  }

  return {
    valid: true,
    userId: session.userId,
    email: session.email,
    name: session.name,
    role: session.role,
    expiresAt: session.expiresAt,
  };
}

/**
 * Revoke/logout an SSO session
 */
export function revokeSession(root, sessionId) {
  const storePath = tokenStorePath(root);
  if (!fs.existsSync(storePath)) return { success: false, error: "No sessions." };

  let store;
  try { store = JSON.parse(fs.readFileSync(storePath, "utf-8")); } catch { return { success: false }; }

  if (!store.sessions?.[sessionId]) {
    return { success: false, error: "Session not found." };
  }

  delete store.sessions[sessionId];
  fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  return { success: true };
}

/**
 * List active SSO sessions
 */
export function listSessions(root) {
  const storePath = tokenStorePath(root);
  if (!fs.existsSync(storePath)) return { sessions: [], total: 0 };

  let store;
  try { store = JSON.parse(fs.readFileSync(storePath, "utf-8")); } catch { return { sessions: [], total: 0 }; }

  const now = new Date();
  const sessions = Object.values(store.sessions || {})
    .filter(s => new Date(s.expiresAt) > now)
    .map(s => ({
      sessionId: s.sessionId,
      userId: s.userId,
      email: s.email,
      name: s.name,
      role: s.role,
      expiresAt: s.expiresAt,
      createdAt: s.createdAt,
    }));

  return { sessions, total: sessions.length };
}

// --- Token parsing ---

/**
 * Parse JWT ID token payload (without verification — verification done by IdP)
 */
function parseIdToken(idToken) {
  if (!idToken) return {};
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return {};
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf-8"));
    return payload;
  } catch {
    return {};
  }
}

/**
 * Map OIDC user info to a SpecLock role
 */
function mapToSpecLockRole(config, userInfo) {
  const roleMapping = config.roleMapping || {};

  // Check user's groups
  const groups = userInfo.groups || userInfo["cognito:groups"] || [];
  for (const group of groups) {
    if (roleMapping[group]) return roleMapping[group];
  }

  // Check user's roles claim
  const roles = userInfo.roles || userInfo.realm_access?.roles || [];
  for (const role of roles) {
    if (roleMapping[role]) return roleMapping[role];
  }

  // Check email domain mapping
  if (userInfo.email && roleMapping["@" + userInfo.email.split("@")[1]]) {
    return roleMapping["@" + userInfo.email.split("@")[1]];
  }

  return config.defaultRole || "viewer";
}

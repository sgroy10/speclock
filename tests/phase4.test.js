// ===================================================================
// SpecLock Phase 4 Test Suite (v3.5)
// Tests Policy-as-Code, Telemetry, SSO, and Dashboard API.
// Run: node tests/phase4.test.js
// ===================================================================

import fs from "fs";
import path from "path";
import os from "os";
import {
  initPolicy,
  loadPolicy,
  savePolicy,
  addPolicyRule,
  removePolicyRule,
  listPolicyRules,
  evaluatePolicy,
  exportPolicy,
  importPolicy,
  generateNotifications,
} from "../src/core/policy.js";
import {
  isTelemetryEnabled,
  trackToolUsage,
  trackConflict,
  trackFeature,
  trackSession,
  getTelemetrySummary,
  resetTelemetry,
} from "../src/core/telemetry.js";
import {
  isSSOEnabled,
  getSSOConfig,
  saveSSOConfig,
  generateCodeVerifier,
  generateCodeChallenge,
  validateSession,
  revokeSession,
  listSessions,
} from "../src/core/sso.js";
import {
  ensureSpeclockDirs,
  makeBrain,
  writeBrain,
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
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "speclock-p4-test-"));
  ensureSpeclockDirs(tmpDir);
  const brain = makeBrain(tmpDir, false, "main");
  writeBrain(tmpDir, brain);
  return tmpDir;
}

function cleanupTemp(dir) {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch {}
}

// =========================================================
// CATEGORY 1: Policy Initialization
// =========================================================

console.log("\n--- Category 1: Policy Initialization ---");

(() => {
  const root = createTempProject();
  try {
    // Test 1: No policy initially
    const p = loadPolicy(root);
    assert(p === null, "No policy initially");

    // Test 2: Init creates policy
    const result = initPolicy(root);
    assert(result.success === true, "initPolicy succeeds");
    assert(result.policy !== null, "Returns policy object");

    // Test 3: Policy file exists
    const p2 = loadPolicy(root);
    assert(p2 !== null, "Policy loadable after init");
    assert(p2.version === "1.0", "Policy version is 1.0");
    assert(Array.isArray(p2.rules), "Policy has rules array");

    // Test 4: Double init fails
    const result2 = initPolicy(root);
    assert(result2.success === false, "Double init fails");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 2: Policy Rules CRUD
// =========================================================

console.log("\n--- Category 2: Policy Rules CRUD ---");

(() => {
  const root = createTempProject();
  try {
    initPolicy(root);

    // Test 1: Add rule
    const r = addPolicyRule(root, {
      name: "HIPAA PHI Protection",
      description: "Protect patient data files",
      match: { files: ["**/patient/**", "**/medical/**"], actions: ["delete", "modify", "export"] },
      enforce: "block",
      severity: "critical",
      notify: ["security@company.com"],
    });
    assert(r.success === true, "Add policy rule succeeds");
    assert(r.ruleId.startsWith("rule_"), "Rule ID has prefix");
    assert(r.rule.enforce === "block", "Enforce is block");
    assert(r.rule.severity === "critical", "Severity is critical");

    // Test 2: Add second rule
    const r2 = addPolicyRule(root, {
      name: "API Stability",
      match: { files: ["**/api/**"], actions: ["delete"] },
      enforce: "warn",
      severity: "high",
    });
    assert(r2.success === true, "Add second rule succeeds");

    // Test 3: List rules
    const list = listPolicyRules(root);
    assert(list.total === 2, "2 rules total");
    assert(list.active === 2, "2 rules active");

    // Test 4: Remove rule
    const removed = removePolicyRule(root, r.ruleId);
    assert(removed.success === true, "Remove rule succeeds");
    assert(removed.removed.name === "HIPAA PHI Protection", "Correct rule removed");

    // Test 5: List after remove
    const list2 = listPolicyRules(root);
    assert(list2.total === 1, "1 rule after removal");

    // Test 6: Remove nonexistent
    const bad = removePolicyRule(root, "rule_nonexistent");
    assert(bad.success === false, "Remove nonexistent fails");

    // Test 7: Rule without name fails
    const noName = addPolicyRule(root, { match: { files: ["**/*"] } });
    assert(noName.success === false, "Rule without name rejected");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 3: Policy Evaluation
// =========================================================

console.log("\n--- Category 3: Policy Evaluation ---");

(() => {
  const root = createTempProject();
  try {
    initPolicy(root);

    addPolicyRule(root, {
      name: "No patient file deletion",
      match: { files: ["**/patient/**"], actions: ["delete"] },
      enforce: "block",
      severity: "critical",
    });

    addPolicyRule(root, {
      name: "API change warning",
      match: { files: ["src/api/**"], actions: ["modify"] },
      enforce: "warn",
      severity: "medium",
    });

    // Test 1: No violation — unmatched file
    const r1 = evaluatePolicy(root, { files: ["src/utils/helpers.js"], type: "modify" });
    assert(r1.passed === true, "Unmatched file passes");

    // Test 2: Block violation — patient file deletion
    const r2 = evaluatePolicy(root, { files: ["data/patient/records.json"], type: "delete" });
    assert(r2.passed === false, "Patient file deletion caught");
    assert(r2.blocked === true, "Patient deletion blocked");
    assert(r2.violations[0].ruleName === "No patient file deletion", "Correct rule triggered");

    // Test 3: Warning — API modification
    const r3 = evaluatePolicy(root, { files: ["src/api/routes.js"], type: "modify" });
    assert(r3.passed === false, "API modification caught");
    assert(r3.blocked === false, "API modification is warning, not block");

    // Test 4: Wrong action type — no match
    const r4 = evaluatePolicy(root, { files: ["data/patient/records.json"], type: "create" });
    assert(r4.passed === true, "Patient file create not matched (only delete blocked)");

    // Test 5: No rules — always passes
    const emptyRoot = createTempProject();
    const r5 = evaluatePolicy(emptyRoot, { files: ["anything.js"], type: "delete" });
    assert(r5.passed === true, "No policy = pass");
    cleanupTemp(emptyRoot);

    // Test 6: Multiple violations
    const r6 = evaluatePolicy(root, { files: ["src/api/patient/data.js"], type: "delete" });
    // This matches both rules if API pattern matches
    assert(r6.violations.length >= 1, "At least one violation for combined file");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 4: Policy Import/Export
// =========================================================

console.log("\n--- Category 4: Policy Import/Export ---");

(() => {
  const root = createTempProject();
  try {
    initPolicy(root);
    addPolicyRule(root, {
      name: "Security Rule",
      match: { files: ["**/auth/**"], actions: ["modify", "delete"] },
      enforce: "block",
      severity: "critical",
    });

    // Test 1: Export
    const exported = exportPolicy(root);
    assert(exported.success === true, "Export succeeds");
    assert(typeof exported.yaml === "string", "Export returns YAML string");
    assert(exported.yaml.includes("Security Rule"), "YAML contains rule name");

    // Test 2: Import into new project (merge)
    const root2 = createTempProject();
    initPolicy(root2);
    const imp = importPolicy(root2, exported.yaml, "merge");
    assert(imp.success === true, "Import succeeds");
    assert(imp.added === 1, "1 rule imported");

    // Test 3: Merge skips duplicates
    const imp2 = importPolicy(root2, exported.yaml, "merge");
    assert(imp2.added === 0, "Duplicate rule skipped in merge");

    // Test 4: Replace mode
    addPolicyRule(root2, { name: "Extra Rule", match: { files: ["**/*"] }, enforce: "warn" });
    const imp3 = importPolicy(root2, exported.yaml, "replace");
    assert(imp3.added === 1, "Replace imports 1 rule");
    const list = listPolicyRules(root2);
    assert(list.total === 1, "Replace clears existing rules");

    // Test 5: Invalid YAML import
    const imp4 = importPolicy(root2, "not: valid: yaml: [broken");
    // Should not crash — either parse or return error
    assert(imp4 !== undefined, "Invalid YAML handled gracefully");

    cleanupTemp(root2);
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 5: Notifications
// =========================================================

console.log("\n--- Category 5: Notifications ---");

(() => {
  // Test 1: Generate notifications from violations
  const violations = [
    {
      ruleName: "PHI Protection",
      description: "Protect patient data",
      enforce: "block",
      severity: "critical",
      matchedFiles: ["patient/data.json"],
      notify: ["security@company.com", "slack:#alerts"],
    },
    {
      ruleName: "No notification rule",
      enforce: "warn",
      severity: "low",
      notify: [],
    },
  ];

  const notifs = generateNotifications(violations, "TestProject");
  assert(notifs.length === 2, "2 notifications generated (from rule with 2 channels)");
  assert(notifs[0].channel === "security@company.com", "Email channel correct");
  assert(notifs[1].channel === "slack:#alerts", "Slack channel correct");
  assert(notifs[0].severity === "critical", "Severity preserved");
  assert(notifs[0].project === "TestProject", "Project name included");

  // Test 2: No notifications for rules without notify
  const notifs2 = generateNotifications([violations[1]], "Test");
  assert(notifs2.length === 0, "No notifications for rule without channels");
})();

// =========================================================
// CATEGORY 6: Telemetry — Opt-in
// =========================================================

console.log("\n--- Category 6: Telemetry Opt-in ---");

(() => {
  const origEnv = process.env.SPECLOCK_TELEMETRY;
  try {
    // Test 1: Disabled by default
    delete process.env.SPECLOCK_TELEMETRY;
    resetTelemetry();
    assert(!isTelemetryEnabled(), "Telemetry disabled by default");

    // Test 2: Enabled with env var
    process.env.SPECLOCK_TELEMETRY = "true";
    resetTelemetry();
    assert(isTelemetryEnabled(), "Telemetry enabled with env var");

    // Test 3: Disabled with false
    process.env.SPECLOCK_TELEMETRY = "false";
    resetTelemetry();
    assert(!isTelemetryEnabled(), "Telemetry disabled with 'false'");
  } finally {
    if (origEnv) process.env.SPECLOCK_TELEMETRY = origEnv;
    else delete process.env.SPECLOCK_TELEMETRY;
    resetTelemetry();
  }
})();

// =========================================================
// CATEGORY 7: Telemetry — Tracking
// =========================================================

console.log("\n--- Category 7: Telemetry Tracking ---");

(() => {
  const origEnv = process.env.SPECLOCK_TELEMETRY;
  const root = createTempProject();
  try {
    process.env.SPECLOCK_TELEMETRY = "true";
    resetTelemetry();

    // Test 1: Track tool usage
    trackToolUsage(root, "speclock_check_conflict", 150);
    trackToolUsage(root, "speclock_check_conflict", 200);
    trackToolUsage(root, "speclock_add_lock", 50);

    const summary = getTelemetrySummary(root);
    assert(summary.enabled === true, "Summary shows enabled");
    assert(summary.totalCalls === 3, "3 total calls tracked");
    assert(summary.topTools.length >= 2, "At least 2 tools in top list");
    assert(summary.topTools[0].name === "speclock_check_conflict", "Most-used tool first");
    assert(summary.topTools[0].count === 2, "Correct count for top tool");

    // Test 2: Track conflicts
    trackConflict(root, true, true);
    trackConflict(root, true, false);
    trackConflict(root, false, false);

    const s2 = getTelemetrySummary(root);
    assert(s2.conflicts.total === 3, "3 conflicts tracked");
    assert(s2.conflicts.blocked === 1, "1 blocked conflict");
    assert(s2.conflicts.advisory === 1, "1 advisory conflict");

    // Test 3: Track features
    trackFeature(root, "hard_enforcement");
    trackFeature(root, "hard_enforcement");
    trackFeature(root, "encryption");

    const s3 = getTelemetrySummary(root);
    assert(s3.features.length >= 2, "2 features tracked");

    // Test 4: Track sessions
    trackSession(root, "claude-code");
    trackSession(root, "cursor");
    trackSession(root, "claude-code");

    const s4 = getTelemetrySummary(root);
    assert(s4.sessions.total === 3, "3 sessions tracked");
    assert(s4.sessions.tools["claude-code"] === 2, "2 claude-code sessions");

    // Test 5: Daily trend
    assert(s4.dailyTrend.length === 7, "7-day trend available");
    const today = s4.dailyTrend[s4.dailyTrend.length - 1];
    assert(today.calls > 0, "Today has calls");

    // Test 6: Average response time
    assert(s4.avgResponseMs > 0, "Avg response time calculated");
  } finally {
    if (origEnv) process.env.SPECLOCK_TELEMETRY = origEnv;
    else delete process.env.SPECLOCK_TELEMETRY;
    resetTelemetry();
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 8: Telemetry — Disabled Mode
// =========================================================

console.log("\n--- Category 8: Telemetry Disabled Mode ---");

(() => {
  const origEnv = process.env.SPECLOCK_TELEMETRY;
  const root = createTempProject();
  try {
    delete process.env.SPECLOCK_TELEMETRY;
    resetTelemetry();

    // Test 1: Tracking does nothing when disabled
    trackToolUsage(root, "test_tool", 100);
    trackConflict(root, true, false);
    trackFeature(root, "test");
    trackSession(root, "test");

    const summary = getTelemetrySummary(root);
    assert(summary.enabled === false, "Summary shows disabled");
    assert(summary.message.includes("disabled"), "Disabled message present");
  } finally {
    if (origEnv) process.env.SPECLOCK_TELEMETRY = origEnv;
    else delete process.env.SPECLOCK_TELEMETRY;
    resetTelemetry();
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 9: SSO Configuration
// =========================================================

console.log("\n--- Category 9: SSO Configuration ---");

(() => {
  const root = createTempProject();
  try {
    // Test 1: SSO disabled by default
    assert(!isSSOEnabled(root), "SSO disabled by default");

    // Test 2: Get default config
    const config = getSSOConfig(root);
    assert(config.issuer === "", "Default issuer is empty");
    assert(config.defaultRole === "viewer", "Default role is viewer");
    assert(config.scopes.includes("openid"), "Default scopes include openid");

    // Test 3: Save config
    saveSSOConfig(root, {
      issuer: "https://auth.example.com",
      clientId: "speclock-app",
      clientSecret: "secret123",
      defaultRole: "developer",
    });
    assert(isSSOEnabled(root), "SSO enabled after config save");

    // Test 4: Read back config
    const c2 = getSSOConfig(root);
    assert(c2.issuer === "https://auth.example.com", "Issuer saved");
    assert(c2.clientId === "speclock-app", "Client ID saved");
    assert(c2.defaultRole === "developer", "Default role saved");

    // Test 5: Gitignore created for SSO files
    const giPath = path.join(root, ".speclock", ".gitignore");
    const gi = fs.readFileSync(giPath, "utf-8");
    assert(gi.includes("sso.json"), "sso.json gitignored");
    assert(gi.includes("sso-tokens.json"), "sso-tokens.json gitignored");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 10: SSO PKCE
// =========================================================

console.log("\n--- Category 10: SSO PKCE ---");

(() => {
  // Test 1: Code verifier generation
  const v1 = generateCodeVerifier();
  const v2 = generateCodeVerifier();
  assert(typeof v1 === "string" && v1.length >= 30, "Code verifier is long enough");
  assert(v1 !== v2, "Code verifiers are unique");

  // Test 2: Code challenge generation
  const challenge = generateCodeChallenge(v1);
  assert(typeof challenge === "string", "Code challenge is string");
  assert(challenge !== v1, "Challenge differs from verifier");

  // Test 3: Deterministic challenge
  const c2 = generateCodeChallenge(v1);
  assert(challenge === c2, "Same verifier = same challenge");
})();

// =========================================================
// CATEGORY 11: SSO Session Management
// =========================================================

console.log("\n--- Category 11: SSO Session Management ---");

(() => {
  const root = createTempProject();
  try {
    // Test 1: No sessions initially
    const sessions = listSessions(root);
    assert(sessions.total === 0, "No sessions initially");

    // Test 2: Validate nonexistent session
    const v = validateSession(root, "nonexistent");
    assert(v.valid === false, "Nonexistent session invalid");

    // Test 3: Validate null session
    const v2 = validateSession(root, null);
    assert(v2.valid === false, "Null session invalid");

    // Test 4: Revoke nonexistent session
    const r = revokeSession(root, "nonexistent");
    assert(r.success === false, "Cannot revoke nonexistent session");

    // Test 5: Create a manual session for testing
    const tokenStorePath = path.join(root, ".speclock", "sso-tokens.json");
    const testSession = {
      sessions: {
        "test-session-123": {
          sessionId: "test-session-123",
          userId: "user@example.com",
          email: "user@example.com",
          name: "Test User",
          role: "developer",
          accessToken: "fake-token",
          expiresAt: new Date(Date.now() + 3600000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      },
    };
    fs.writeFileSync(tokenStorePath, JSON.stringify(testSession));

    // Test 6: Validate manual session
    const v3 = validateSession(root, "test-session-123");
    assert(v3.valid === true, "Manual session validates");
    assert(v3.role === "developer", "Session role correct");
    assert(v3.email === "user@example.com", "Session email correct");

    // Test 7: List sessions
    const sessions2 = listSessions(root);
    assert(sessions2.total === 1, "1 session listed");

    // Test 8: Revoke session
    const r2 = revokeSession(root, "test-session-123");
    assert(r2.success === true, "Session revoked");

    // Test 9: Session no longer valid
    const v4 = validateSession(root, "test-session-123");
    assert(v4.valid === false, "Revoked session invalid");

    // Test 10: Expired session auto-removed
    const expiredSession = {
      sessions: {
        "expired-123": {
          sessionId: "expired-123",
          userId: "old@user.com",
          email: "old@user.com",
          role: "viewer",
          expiresAt: new Date(Date.now() - 1000).toISOString(),
          createdAt: new Date().toISOString(),
        },
      },
    };
    fs.writeFileSync(tokenStorePath, JSON.stringify(expiredSession));
    const v5 = validateSession(root, "expired-123");
    assert(v5.valid === false, "Expired session rejected");
  } finally {
    cleanupTemp(root);
  }
})();

// =========================================================
// CATEGORY 12: Env-Based SSO Config Override
// =========================================================

console.log("\n--- Category 12: Env Override for SSO ---");

(() => {
  const root = createTempProject();
  const origIssuer = process.env.SPECLOCK_SSO_ISSUER;
  const origClientId = process.env.SPECLOCK_SSO_CLIENT_ID;
  try {
    process.env.SPECLOCK_SSO_ISSUER = "https://env-issuer.example.com";
    process.env.SPECLOCK_SSO_CLIENT_ID = "env-client-123";

    // Test 1: Env vars override file
    const config = getSSOConfig(root);
    assert(config.issuer === "https://env-issuer.example.com", "Env issuer overrides file");
    assert(config.clientId === "env-client-123", "Env client ID overrides file");

    // Test 2: SSO enabled via env
    assert(isSSOEnabled(root), "SSO enabled via env vars");
  } finally {
    if (origIssuer) process.env.SPECLOCK_SSO_ISSUER = origIssuer;
    else delete process.env.SPECLOCK_SSO_ISSUER;
    if (origClientId) process.env.SPECLOCK_SSO_CLIENT_ID = origClientId;
    else delete process.env.SPECLOCK_SSO_CLIENT_ID;
    cleanupTemp(root);
  }
})();

// =========================================================
// SUMMARY
// =========================================================

console.log("\n" + "=".repeat(60));
console.log(`Phase 4 Test Suite: ${passed}/${total} passed, ${failed} failed`);
console.log("=".repeat(60));

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All tests passed!");
  process.exit(0);
}

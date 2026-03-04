/**
 * SpecLock Freemium License System
 * Three tiers: Free, Pro ($19/mo), Enterprise ($99/mo).
 * Graceful degradation — free tier always works.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { speclockDir, readBrain } from "./storage.js";

// Tier definitions
const TIERS = {
  free: {
    name: "Free",
    maxLocks: 10,
    maxDecisions: 5,
    maxEvents: 500,
    features: ["basic_conflict_detection", "context_pack", "session_tracking", "cli", "mcp"],
  },
  pro: {
    name: "Pro",
    maxLocks: Infinity,
    maxDecisions: Infinity,
    maxEvents: Infinity,
    features: [
      "basic_conflict_detection", "context_pack", "session_tracking", "cli", "mcp",
      "llm_conflict_detection", "hmac_audit_chain", "compliance_exports",
      "drift_detection", "templates", "github_actions",
    ],
  },
  enterprise: {
    name: "Enterprise",
    maxLocks: Infinity,
    maxDecisions: Infinity,
    maxEvents: Infinity,
    features: [
      "basic_conflict_detection", "context_pack", "session_tracking", "cli", "mcp",
      "llm_conflict_detection", "hmac_audit_chain", "compliance_exports",
      "drift_detection", "templates", "github_actions",
      "rbac", "encrypted_storage", "sso", "hard_enforcement",
      "semantic_precommit", "multi_project", "priority_support",
    ],
  },
};

const LICENSE_FILE = ".license";

/**
 * Get the current license key from env or file.
 */
function getLicenseKey(root) {
  // 1. Environment variable
  if (process.env.SPECLOCK_LICENSE_KEY) {
    return process.env.SPECLOCK_LICENSE_KEY;
  }

  // 2. License file in .speclock/
  if (root) {
    const licensePath = path.join(speclockDir(root), LICENSE_FILE);
    if (fs.existsSync(licensePath)) {
      return fs.readFileSync(licensePath, "utf8").trim();
    }
  }

  return null;
}

/**
 * Decode a license key to extract tier and expiry.
 * License format: base64(JSON({ tier, expiresAt, signature }))
 * For now, a simple validation — full crypto verification in v3.0.
 */
function decodeLicense(key) {
  if (!key) return null;

  try {
    const decoded = JSON.parse(Buffer.from(key, "base64").toString("utf8"));
    if (!decoded.tier || !decoded.expiresAt) return null;

    // Check expiry
    if (new Date(decoded.expiresAt) < new Date()) {
      return { tier: "free", expired: true, originalTier: decoded.tier };
    }

    // Validate tier name
    if (!TIERS[decoded.tier]) return null;

    return { tier: decoded.tier, expiresAt: decoded.expiresAt, expired: false };
  } catch {
    return null;
  }
}

/**
 * Get the current tier for this project.
 */
export function getTier(root) {
  const key = getLicenseKey(root);
  if (!key) return "free";

  const license = decodeLicense(key);
  if (!license || license.expired) return "free";

  return license.tier;
}

/**
 * Get the limits for the current tier.
 */
export function getLimits(root) {
  const tier = getTier(root);
  return { tier, ...TIERS[tier] };
}

/**
 * Check if a specific feature is available in the current tier.
 * Returns { allowed: bool, tier: string, requiredTier: string|null }
 */
export function checkFeature(root, featureName) {
  const tier = getTier(root);
  const tierConfig = TIERS[tier];

  if (tierConfig.features.includes(featureName)) {
    return { allowed: true, tier, requiredTier: null };
  }

  // Find which tier has this feature
  const requiredTier = Object.entries(TIERS).find(
    ([_, config]) => config.features.includes(featureName)
  );

  return {
    allowed: false,
    tier,
    requiredTier: requiredTier ? requiredTier[0] : null,
    message: requiredTier
      ? `Feature "${featureName}" requires ${requiredTier[1].name} tier. Current: ${tierConfig.name}. Upgrade at https://speclock.dev/pricing`
      : `Unknown feature: ${featureName}`,
  };
}

/**
 * Check if the current project is within its tier limits.
 * Returns { withinLimits: bool, warnings: string[] }
 */
export function checkLimits(root) {
  const tier = getTier(root);
  const limits = TIERS[tier];
  const brain = readBrain(root);
  const warnings = [];

  if (!brain) return { withinLimits: true, warnings: [], tier };

  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active).length;
  const decisions = (brain.decisions || []).length;
  const eventCount = brain.events?.count || 0;

  if (activeLocks >= limits.maxLocks) {
    warnings.push(
      `Lock limit reached (${activeLocks}/${limits.maxLocks}). Upgrade to Pro for unlimited locks.`
    );
  }

  if (decisions >= limits.maxDecisions) {
    warnings.push(
      `Decision limit reached (${decisions}/${limits.maxDecisions}). Upgrade to Pro for unlimited decisions.`
    );
  }

  if (eventCount >= limits.maxEvents) {
    warnings.push(
      `Event limit reached (${eventCount}/${limits.maxEvents}). Upgrade to Pro for unlimited events.`
    );
  }

  return {
    withinLimits: warnings.length === 0,
    warnings,
    tier,
    usage: {
      locks: { current: activeLocks, max: limits.maxLocks },
      decisions: { current: decisions, max: limits.maxDecisions },
      events: { current: eventCount, max: limits.maxEvents },
    },
  };
}

/**
 * Generate a license key (for testing / admin use).
 * In production, keys would be generated server-side.
 */
export function generateLicenseKey(tier, daysValid = 30) {
  if (!TIERS[tier]) throw new Error(`Invalid tier: ${tier}`);

  const expiresAt = new Date(Date.now() + daysValid * 24 * 60 * 60 * 1000).toISOString();
  const payload = { tier, expiresAt, issuedAt: new Date().toISOString() };

  return Buffer.from(JSON.stringify(payload)).toString("base64");
}

/**
 * Get license info for display.
 */
export function getLicenseInfo(root) {
  const key = getLicenseKey(root);
  const tier = getTier(root);
  const limits = checkLimits(root);
  const license = key ? decodeLicense(key) : null;

  return {
    tier: TIERS[tier].name,
    tierKey: tier,
    expiresAt: license?.expiresAt || null,
    expired: license?.expired || false,
    ...limits,
    features: TIERS[tier].features,
  };
}

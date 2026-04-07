/**
 * SpecLock Lock Coverage Audit — Find Unprotected Code
 * Scans the codebase for high-risk patterns and identifies files/areas
 * that have no lock covering them. Auto-suggests missing locks.
 *
 * Like a security scanner, but for AI constraint gaps.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import { readBrain } from "./storage.js";
import { ensureInit } from "./memory.js";

// --- High-risk patterns to detect ---

const RISK_PATTERNS = [
  {
    category: "authentication",
    keywords: ["auth", "login", "signup", "session", "jwt", "token", "oauth", "passport", "credential"],
    filePatterns: ["auth", "login", "signup", "session", "passport", "middleware/auth"],
    severity: "critical",
    suggestedLock: "Never modify authentication or authorization without explicit permission",
  },
  {
    category: "payments",
    keywords: ["payment", "stripe", "billing", "checkout", "subscription", "invoice", "price", "razorpay", "paypal"],
    filePatterns: ["payment", "billing", "checkout", "stripe", "subscription", "invoice"],
    severity: "critical",
    suggestedLock: "Never modify payment processing, billing, or subscription logic without explicit permission",
  },
  {
    category: "database",
    keywords: ["migration", "schema", "model", "prisma", "knex", "sequelize", "typeorm", "drizzle"],
    filePatterns: ["migration", "schema", "model", "prisma", "db", "database", "seed"],
    severity: "high",
    suggestedLock: "Database schema changes must not drop tables or columns — migrations must be additive only",
  },
  {
    category: "secrets",
    keywords: ["env", "secret", "key", "credential", "password", "config"],
    filePatterns: [".env", "config/secret", "credentials"],
    severity: "critical",
    suggestedLock: "Never expose API keys, secrets, or credentials in client-side code, logs, or error messages",
  },
  {
    category: "api-routes",
    keywords: ["route", "endpoint", "api", "controller", "handler"],
    filePatterns: ["routes/", "api/", "controllers/", "handlers/", "app/api/"],
    severity: "high",
    suggestedLock: "Never remove or change existing API endpoints without explicit permission — clients depend on stability",
  },
  {
    category: "security",
    keywords: ["cors", "helmet", "csp", "csrf", "xss", "sanitize", "rate-limit", "rateLimit"],
    filePatterns: ["security", "cors", "helmet", "middleware/rate"],
    severity: "critical",
    suggestedLock: "Security middleware (CORS, CSP, rate limiting) must not be weakened or removed",
  },
  {
    category: "error-handling",
    keywords: ["error", "catch", "exception", "fallback", "boundary"],
    filePatterns: ["error", "boundary", "fallback", "exception"],
    severity: "medium",
    suggestedLock: "Never remove error handling, error boundaries, or fallback logic",
  },
  {
    category: "logging",
    keywords: ["logger", "logging", "log", "monitor", "telemetry", "sentry", "datadog"],
    filePatterns: ["logger", "logging", "monitor", "telemetry"],
    severity: "medium",
    suggestedLock: "Never disable logging, monitoring, or observability — these keep production alive",
  },
  {
    category: "testing",
    keywords: ["test", "spec", "jest", "mocha", "vitest", "cypress", "playwright"],
    filePatterns: ["test", "spec", "__tests__", "e2e", "cypress"],
    severity: "low",
    suggestedLock: "Never delete or skip existing tests — test coverage must not decrease",
  },
];

// Files/dirs to ignore
const IGNORE = [
  "node_modules", ".git", ".speclock", "dist", "build", ".next",
  ".cache", "coverage", ".turbo", ".vercel", ".netlify",
];

/**
 * Scan project and compute lock coverage.
 *
 * @param {string} root - Project root
 * @param {Object} [options]
 * @param {number} [options.maxFiles] - Max files to scan (default: 500)
 * @returns {Object} Coverage analysis
 */
export function computeCoverage(root, options = {}) {
  const brain = ensureInit(root);
  const maxFiles = options.maxFiles || 500;
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);
  const lockTexts = activeLocks.map((l) => (l.text || "").toLowerCase());

  // Scan for source files
  const files = scanFiles(root, maxFiles);

  // Analyze each risk category
  const categories = RISK_PATTERNS.map((pattern) => {
    // Find files matching this category
    const matchingFiles = files.filter((f) => {
      const fileLower = f.toLowerCase();
      return pattern.filePatterns.some((fp) => fileLower.includes(fp));
    });

    // Check if any lock covers this category
    const coveredBy = activeLocks.filter((lock) => {
      const lockLower = (lock.text || "").toLowerCase();
      return pattern.keywords.some((kw) => lockLower.includes(kw));
    });

    const isCovered = coveredBy.length > 0;

    return {
      category: pattern.category,
      severity: pattern.severity,
      filesFound: matchingFiles.length,
      files: matchingFiles.slice(0, 5), // show up to 5
      covered: isCovered,
      coveredBy: coveredBy.map((l) => l.text.substring(0, 80)),
      suggestedLock: !isCovered ? pattern.suggestedLock : null,
    };
  });

  // Only include categories that have files OR are critical
  const relevant = categories.filter(
    (c) => c.filesFound > 0 || c.severity === "critical"
  );

  const totalCategories = relevant.length;
  const coveredCategories = relevant.filter((c) => c.covered).length;
  const coveragePercent = totalCategories > 0
    ? Math.round((coveredCategories / totalCategories) * 100)
    : 0;

  // Unprotected = has files but no lock
  const unprotected = relevant.filter((c) => !c.covered && c.filesFound > 0);
  const suggestions = unprotected
    .sort((a, b) => severityRank(a.severity) - severityRank(b.severity))
    .map((c) => ({
      category: c.category,
      severity: c.severity,
      lock: c.suggestedLock,
      filesAtRisk: c.filesFound,
    }));

  // Grade
  let grade, status;
  if (coveragePercent >= 90) { grade = "A+"; status = "excellent"; }
  else if (coveragePercent >= 75) { grade = "A"; status = "well protected"; }
  else if (coveragePercent >= 60) { grade = "B"; status = "partially protected"; }
  else if (coveragePercent >= 40) { grade = "C"; status = "gaps found"; }
  else if (coveragePercent >= 20) { grade = "D"; status = "mostly unprotected"; }
  else { grade = "F"; status = "no protection"; }

  return {
    coveragePercent,
    grade,
    status,
    totalFiles: files.length,
    totalCategories,
    coveredCategories,
    categories: relevant,
    unprotected,
    suggestions,
    activeLocks: activeLocks.length,
    badge: `![Lock Coverage](https://img.shields.io/badge/lock_coverage-${coveragePercent}%25-${coveragePercent >= 75 ? "brightgreen" : coveragePercent >= 50 ? "yellow" : "red"}.svg)`,
  };
}

function severityRank(s) {
  if (s === "critical") return 0;
  if (s === "high") return 1;
  if (s === "medium") return 2;
  return 3;
}

/**
 * Scan for source files in the project.
 */
function scanFiles(root, maxFiles) {
  const files = [];
  const extensions = new Set([
    ".js", ".ts", ".jsx", ".tsx", ".py", ".rb", ".go",
    ".java", ".rs", ".php", ".vue", ".svelte", ".astro",
    ".mjs", ".cjs", ".mts", ".cts",
  ]);

  function walk(dir, depth) {
    if (depth > 6 || files.length >= maxFiles) return;

    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (files.length >= maxFiles) break;
      const name = entry.name;

      if (IGNORE.some((ig) => name === ig || name.startsWith("."))) continue;

      const fullPath = path.join(dir, name);
      const relPath = path.relative(root, fullPath).replace(/\\/g, "/");

      if (entry.isDirectory()) {
        walk(fullPath, depth + 1);
      } else if (entry.isFile()) {
        const ext = path.extname(name).toLowerCase();
        if (extensions.has(ext)) {
          files.push(relPath);
        }
      }
    }
  }

  walk(root, 0);
  return files;
}

/**
 * Format coverage report for CLI output.
 */
export function formatCoverage(result) {
  const lines = [];

  lines.push(`Lock Coverage: ${result.coveragePercent}% (${result.grade}) — ${result.status}`);
  lines.push(`Files scanned: ${result.totalFiles} | Categories: ${result.coveredCategories}/${result.totalCategories} covered | Active locks: ${result.activeLocks}`);
  lines.push("");

  // Category breakdown
  lines.push("Category Breakdown:");
  lines.push("  " + "-".repeat(55));

  for (const c of result.categories) {
    const icon = c.covered ? "COVERED" : (c.filesFound > 0 ? "EXPOSED" : "N/A");
    const sev = c.severity.toUpperCase().padEnd(8);
    lines.push(`  [${icon.padEnd(7)}] ${sev} ${c.category.padEnd(16)} ${c.filesFound} file(s)`);
    if (c.covered && c.coveredBy.length > 0) {
      lines.push(`            Lock: "${c.coveredBy[0]}"`);
    }
  }

  // Suggestions
  if (result.suggestions.length > 0) {
    lines.push("");
    lines.push("Suggested Locks (ready to apply):");
    lines.push("  " + "-".repeat(55));
    for (let i = 0; i < result.suggestions.length; i++) {
      const s = result.suggestions[i];
      lines.push(`  ${i + 1}. [${s.severity.toUpperCase()}] ${s.category} (${s.filesAtRisk} file(s) at risk)`);
      lines.push(`     speclock lock "${s.lock}"`);
      lines.push("");
    }
  } else {
    lines.push("");
    lines.push("All detected categories are covered by locks.");
  }

  lines.push(`README badge: ${result.badge}`);

  return lines.join("\n");
}

// ===================================================================
// SpecLock Guardian — Zero-Config Protection from AI Rule Files
// Reads existing .cursorrules, CLAUDE.md, AGENTS.md, copilot-instructions.md
// and auto-extracts enforceable constraints. One command. No flags.
//
// "Your AI has rules. SpecLock makes them unbreakable."
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

import fs from "fs";
import path from "path";
import { ensureInit, addLock, addDecision } from "./memory.js";
import { readBrain } from "./storage.js";
import { installHook, isHookInstalled } from "./hooks.js";
import { syncRules } from "./rules-sync.js";
import { generateContext } from "./context.js";

// --- Rule file discovery ---

const RULE_FILES = [
  { file: ".cursorrules", tool: "Cursor" },
  { file: ".cursor/rules/rules.mdc", tool: "Cursor (MDC)" },
  { file: "CLAUDE.md", tool: "Claude Code" },
  { file: "AGENTS.md", tool: "AGENTS.md" },
  { file: ".github/copilot-instructions.md", tool: "GitHub Copilot" },
  { file: ".windsurfrules", tool: "Windsurf" },
  { file: ".windsurf/rules/rules.md", tool: "Windsurf (dir)" },
  { file: "GEMINI.md", tool: "Gemini" },
  { file: ".aider.conf.yml", tool: "Aider" },
  { file: "COPILOT.md", tool: "Copilot (alt)" },
  { file: ".github/instructions.md", tool: "GitHub (alt)" },
];

/**
 * Discover all AI rule files in the project.
 */
export function discoverRuleFiles(root) {
  const found = [];
  for (const entry of RULE_FILES) {
    const fullPath = path.join(root, entry.file);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf-8").trim();
      if (content.length > 0) {
        found.push({
          file: entry.file,
          tool: entry.tool,
          path: fullPath,
          content,
          size: content.length,
          lines: content.split("\n").length,
        });
      }
    }
  }
  return found;
}

// --- Heuristic constraint extraction (no API key needed) ---

// Patterns that signal a constraint/rule
const CONSTRAINT_PATTERNS = [
  // Strong imperative (NEVER, ALWAYS, MUST, DO NOT)
  /^[-*•]\s*(NEVER|ALWAYS|MUST|DO NOT|DON'T|DONT|SHALL NOT|REQUIRED|MANDATORY|CRITICAL|IMPORTANT)\b/i,
  /^(NEVER|ALWAYS|MUST|DO NOT|DON'T|DONT|SHALL NOT)\b/i,
  // "Do not..." / "Don't..." at line start
  /^[-*•]\s*(Do not|Don't|Dont|Never|Always|Must)\b/,
  /^(Do not|Don't|Dont)\b/,
  // Emphasis markers suggesting importance
  /^\*\*(NEVER|ALWAYS|MUST|DO NOT|DON'T|IMPORTANT|CRITICAL|REQUIRED)\*\*/i,
  // "X is required" / "X is mandatory" / "X is non-negotiable"
  /\b(is required|is mandatory|is non-negotiable|is critical|is forbidden|is prohibited)\b/i,
  // "Keep X" / "Preserve X" / "Protect X"
  /^[-*•]\s*(Keep|Preserve|Protect|Maintain|Ensure|Enforce)\b/,
  // Negative imperatives
  /^[-*•]\s*(Avoid|Prevent|Prohibit|Forbid|Restrict|Disallow)\b/i,
  // "should never" / "must never" / "must always"
  /\b(should never|must never|must always|should always|must not|should not|cannot|can not)\b/i,
];

// Patterns that signal a decision/choice
const DECISION_PATTERNS = [
  /^[-*•]\s*(Use|Using|Tech stack|Stack|Framework|We use|Built with|Powered by)\b/i,
  /\b(tech stack|architecture|we chose|we decided|we use|built with)\b/i,
];

// Lines to skip (headers, empty, comments, boilerplate)
const SKIP_PATTERNS = [
  /^#+\s/,                    // Markdown headers
  /^---+$/,                   // Horizontal rules
  /^\s*$/,                    // Empty lines
  /^```/,                     // Code fences
  /^<!--/,                    // HTML comments
  /^>\s/,                     // Blockquotes (context, not rules)
  /^Auto-synced by SpecLock/, // Our own output
  /^Powered by \[SpecLock\]/, // Our own footer
  /^#\s*SpecLock/,            // SpecLock headers
];

/**
 * Extract constraints from raw text using heuristic pattern matching.
 * No API key required — works offline, instantly.
 */
export function extractConstraints(content, sourceFile) {
  const lines = content.split("\n");
  const locks = [];
  const decisions = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const trimmed = raw.trim();

    // Skip non-content lines
    if (SKIP_PATTERNS.some((p) => p.test(trimmed))) continue;

    // Clean up: remove leading bullet/dash, markdown bold
    const cleaned = trimmed
      .replace(/^[-*•]\s*/, "")
      .replace(/\*\*/g, "")
      .trim();

    if (cleaned.length < 10 || cleaned.length > 300) continue;

    // Deduplicate
    const key = cleaned.toLowerCase().replace(/\s+/g, " ");
    if (seen.has(key)) continue;

    // Check for constraint patterns
    if (CONSTRAINT_PATTERNS.some((p) => p.test(trimmed) || p.test(cleaned))) {
      seen.add(key);
      locks.push({
        text: cleaned,
        tags: [sourceFile.replace(/[/.]/g, "_").replace(/^_+|_+$/g, "")],
        source: "guardian",
        line: i + 1,
      });
      continue;
    }

    // Check for decision patterns
    if (DECISION_PATTERNS.some((p) => p.test(trimmed) || p.test(cleaned))) {
      seen.add(key);
      decisions.push({
        text: cleaned,
        tags: [sourceFile.replace(/[/.]/g, "_").replace(/^_+|_+$/g, "")],
        line: i + 1,
      });
    }
  }

  return { locks, decisions };
}

/**
 * Run the full Guardian protect flow:
 * 1. Init SpecLock if needed
 * 2. Discover rule files
 * 3. Extract constraints from each
 * 4. Add as locks (skip duplicates with existing)
 * 5. Install pre-commit hook
 * 6. Sync rules back to all formats
 * 7. Generate context
 *
 * Returns a report object.
 */
export function protect(root, options = {}) {
  const report = {
    discovered: [],
    extracted: { locks: 0, decisions: 0 },
    added: { locks: 0, decisions: 0, skipped: 0 },
    hookInstalled: false,
    hookStatus: "",
    synced: [],
    errors: [],
  };

  // 1. Init
  const brain = ensureInit(root);

  // 2. Discover
  const ruleFiles = discoverRuleFiles(root);
  report.discovered = ruleFiles.map((f) => ({
    file: f.file,
    tool: f.tool,
    lines: f.lines,
    size: f.size,
  }));

  if (ruleFiles.length === 0) {
    report.errors.push(
      "No AI rule files found (.cursorrules, CLAUDE.md, AGENTS.md, etc). " +
      "Create one first, or use 'speclock setup' to start from scratch."
    );
    return report;
  }

  // 3. Extract constraints from each file
  const allLocks = [];
  const allDecisions = [];

  for (const rf of ruleFiles) {
    const result = extractConstraints(rf.content, rf.file);
    allLocks.push(...result.locks);
    allDecisions.push(...result.decisions);
  }

  report.extracted.locks = allLocks.length;
  report.extracted.decisions = allDecisions.length;

  // 4. Add locks (skip duplicates against existing brain locks)
  const existingTexts = new Set(
    (brain.specLock?.items || [])
      .filter((l) => l.active !== false)
      .map((l) => l.text.toLowerCase().replace(/\s+/g, " "))
  );

  for (const lock of allLocks) {
    const normalized = lock.text.toLowerCase().replace(/\s+/g, " ");
    if (existingTexts.has(normalized)) {
      report.added.skipped++;
      continue;
    }
    existingTexts.add(normalized);
    addLock(root, lock.text, lock.tags, lock.source || "guardian");
    report.added.locks++;
  }

  for (const dec of allDecisions) {
    const normalized = dec.text.toLowerCase().replace(/\s+/g, " ");
    if (existingTexts.has(normalized)) {
      report.added.skipped++;
      continue;
    }
    existingTexts.add(normalized);
    addDecision(root, dec.text, dec.tags, "guardian");
    report.added.decisions++;
  }

  // 5. Install pre-commit hook
  if (!options.skipHook) {
    if (isHookInstalled(root)) {
      report.hookInstalled = true;
      report.hookStatus = "already installed";
    } else {
      const hookResult = installHook(root);
      report.hookInstalled = hookResult.success;
      report.hookStatus = hookResult.success
        ? "installed"
        : hookResult.error || "failed";
    }
  } else {
    report.hookStatus = "skipped (--no-hook)";
  }

  // 6. Sync rules to formats that WEREN'T source files (don't overwrite user's originals)
  if (!options.skipSync) {
    const sourceFiles = new Set(ruleFiles.map((f) => f.file));
    try {
      const syncResult = syncRules(root, { format: "all", excludeFiles: sourceFiles });
      report.synced = (syncResult.synced || []).map((s) => s.file || s);
    } catch (e) {
      report.errors.push(`Sync failed: ${e.message}`);
    }
  }

  // 7. Generate context
  try {
    generateContext(root);
  } catch (_) {
    // Non-critical
  }

  return report;
}

/**
 * Format protect report for CLI output.
 */
export function formatProtectReport(report) {
  const lines = [];

  lines.push("");
  lines.push("  SpecLock Protect — Guardian Mode");
  lines.push("  " + "=".repeat(50));
  lines.push("");

  // Discovered files
  if (report.discovered.length > 0) {
    lines.push("  Rule files found:");
    for (const f of report.discovered) {
      lines.push(`    [+] ${f.file} (${f.tool}, ${f.lines} lines)`);
    }
  } else {
    lines.push("  [!] No rule files found.");
  }
  lines.push("");

  // Extracted
  lines.push(`  Extracted: ${report.extracted.locks} constraints, ${report.extracted.decisions} decisions`);

  // Added
  if (report.added.locks > 0 || report.added.decisions > 0) {
    lines.push(`  Added:     ${report.added.locks} new locks, ${report.added.decisions} new decisions`);
  }
  if (report.added.skipped > 0) {
    lines.push(`  Skipped:   ${report.added.skipped} (already existed)`);
  }
  lines.push("");

  // Hook
  if (report.hookStatus === "installed") {
    lines.push("  Pre-commit hook: INSTALLED");
    lines.push("  Every commit will now be checked against your constraints.");
  } else if (report.hookStatus === "already installed") {
    lines.push("  Pre-commit hook: already active");
  } else {
    lines.push(`  Pre-commit hook: ${report.hookStatus}`);
  }
  lines.push("");

  // Sync
  if (report.synced.length > 0) {
    lines.push("  Rules synced to:");
    for (const s of report.synced) {
      lines.push(`    [+] ${s}`);
    }
    lines.push("");
  }

  // Errors
  if (report.errors.length > 0) {
    for (const e of report.errors) {
      lines.push(`  [!] ${e}`);
    }
    lines.push("");
  }

  // Final message
  const total = report.added.locks + report.added.skipped;
  if (total > 0) {
    lines.push("  Your rules are now ENFORCED, not just suggested.");
    lines.push("  AI agents that violate constraints will be blocked.");
  }
  lines.push("");

  return lines.join("\n");
}

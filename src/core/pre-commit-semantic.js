/**
 * SpecLock Semantic Pre-Commit Engine
 * Replaces filename-only pre-commit with actual code-level semantic analysis.
 *
 * Parses git diff output, extracts code changes per file, and runs
 * analyzeConflict() against each change block + active locks.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import fs from "fs";
import path from "path";
import { execSync } from "child_process";
import { readBrain } from "./storage.js";
import { analyzeConflict } from "./semantics.js";
import { getEnforcementConfig } from "./enforcer.js";

const GUARD_TAG = "SPECLOCK-GUARD";
const SPECLOCK_AUTOGEN_MARKER = "SpecLock";
const MAX_LINES_PER_FILE = 500;
const BINARY_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "bmp", "ico", "svg", "webp",
  "mp3", "mp4", "wav", "avi", "mov", "mkv",
  "zip", "tar", "gz", "rar", "7z",
  "pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx",
  "exe", "dll", "so", "dylib", "bin",
  "woff", "woff2", "ttf", "eot", "otf",
  "lock", "map",
]);

// Files / dirs that SpecLock itself auto-creates during `protect` or that
// are just noise for semantic analysis. These are ALWAYS skipped from the
// diff-level semantic audit because matching against them produces nothing
// but false positives (e.g. rules files describe the same concepts the
// locks describe, so they always "conflict" with themselves).
const ALWAYS_SKIP_EXACT = new Set([
  ".cursor/rules/speclock.mdc",
  ".windsurf/rules/speclock.md",
  ".aider.conf.yml",
  ".mcp.json",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "Cargo.lock",
  "poetry.lock",
  "Gemfile.lock",
  "composer.lock",
]);

// Directory prefixes that are always skipped.
const ALWAYS_SKIP_DIR_PREFIXES = [
  ".speclock/",
  "node_modules/",
  "dist/",
  "build/",
  ".next/",
  ".nuxt/",
  "__pycache__/",
  ".venv/",
  "venv/",
  ".cache/",
  "coverage/",
  ".turbo/",
];

// Files that are skipped ONLY if their content carries the SpecLock
// auto-generated marker (so hand-written AGENTS.md etc. still get audited).
// CLAUDE.md is included because `speclock protect` seeds it with the active
// locks — on the initial commit after protect, the file literally IS the
// locks, so every semantic check would produce a false positive.
const CONDITIONAL_SKIP_IF_AUTOGEN = new Set([
  "AGENTS.md",
  "GEMINI.md",
  "CLAUDE.md",
  ".github/copilot-instructions.md",
]);

/**
 * Normalize a path to forward slashes for comparison.
 */
function normalizePath(p) {
  return (p || "").replace(/\\/g, "/");
}

/**
 * Decide whether a file should be skipped by the semantic pre-commit audit.
 * This is the single source of truth for "is this a SpecLock internal file
 * or generated noise we should not audit".
 *
 * @param {string} file - repo-relative path
 * @param {string} root - repo root (to check content of conditional files)
 * @returns {boolean} true if the file should be skipped
 */
export function shouldSkipForSemanticAudit(file, root) {
  const norm = normalizePath(file);

  // 1. Binary extensions
  const ext = path.extname(norm).slice(1).toLowerCase();
  if (BINARY_EXTENSIONS.has(ext)) return true;

  // 2. Exact path matches (lockfiles, auto-generated rules files, .mcp.json)
  if (ALWAYS_SKIP_EXACT.has(norm)) return true;

  // 3. Directory prefix matches
  for (const prefix of ALWAYS_SKIP_DIR_PREFIXES) {
    if (norm === prefix.slice(0, -1) || norm.startsWith(prefix)) return true;
  }

  // 4. Conditionally-skipped files (only if they carry the auto-gen marker)
  if (CONDITIONAL_SKIP_IF_AUTOGEN.has(norm)) {
    try {
      const fullPath = path.join(root, file);
      if (fs.existsSync(fullPath)) {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes(SPECLOCK_AUTOGEN_MARKER)) return true;
      }
    } catch { /* ignore read errors */ }
  }

  return false;
}

/**
 * Parse a unified diff into per-file change blocks.
 * Returns array of { file, addedLines, removedLines, hunks }.
 */
export function parseDiff(diffText) {
  if (!diffText || !diffText.trim()) return [];

  const files = [];
  const fileSections = diffText.split(/^diff --git /m).filter(Boolean);

  for (const section of fileSections) {
    const lines = section.split("\n");

    // Extract filename from "a/path b/path"
    const headerMatch = lines[0]?.match(/a\/(.+?) b\/(.+)/);
    if (!headerMatch) continue;

    const file = headerMatch[2];
    const ext = path.extname(file).slice(1).toLowerCase();

    // Skip binary files
    if (BINARY_EXTENSIONS.has(ext)) continue;
    if (section.includes("Binary files")) continue;

    const addedLines = [];
    const removedLines = [];
    const hunks = [];
    let currentHunk = null;
    let lineCount = 0;

    for (const line of lines) {
      if (lineCount >= MAX_LINES_PER_FILE) break;

      if (line.startsWith("@@")) {
        // New hunk
        const hunkMatch = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)/);
        if (hunkMatch) {
          currentHunk = {
            oldStart: parseInt(hunkMatch[1]),
            newStart: parseInt(hunkMatch[3]),
            context: hunkMatch[5]?.trim() || "",
            changes: [],
          };
          hunks.push(currentHunk);
        }
        continue;
      }

      if (!currentHunk) continue;

      if (line.startsWith("+") && !line.startsWith("+++")) {
        const content = line.substring(1).trim();
        if (content) {
          addedLines.push(content);
          currentHunk.changes.push({ type: "add", content });
          lineCount++;
        }
      } else if (line.startsWith("-") && !line.startsWith("---")) {
        const content = line.substring(1).trim();
        if (content) {
          removedLines.push(content);
          currentHunk.changes.push({ type: "remove", content });
          lineCount++;
        }
      }
    }

    if (addedLines.length > 0 || removedLines.length > 0) {
      files.push({ file, addedLines, removedLines, hunks });
    }
  }

  return files;
}

/**
 * Get the staged diff from git.
 */
export function getStagedDiff(root) {
  try {
    return execSync("git diff --cached --unified=3", {
      cwd: root,
      encoding: "utf-8",
      maxBuffer: 5 * 1024 * 1024, // 5MB
      timeout: 10000,
    });
  } catch {
    return "";
  }
}

/**
 * Build a semantic summary of changes in a file for conflict checking.
 * Combines added/removed lines into meaningful phrases.
 */
function buildChangeSummary(fileChanges) {
  const summaries = [];

  // Summarize removals (deletions are more dangerous)
  if (fileChanges.removedLines.length > 0) {
    const sample = fileChanges.removedLines.slice(0, 10).join(" ");
    summaries.push(`Removing code: ${sample}`);
  }

  // Summarize additions
  if (fileChanges.addedLines.length > 0) {
    const sample = fileChanges.addedLines.slice(0, 10).join(" ");
    summaries.push(`Adding code: ${sample}`);
  }

  // Add hunk contexts (function names, class names)
  for (const hunk of fileChanges.hunks) {
    if (hunk.context) {
      summaries.push(`In context: ${hunk.context}`);
    }
  }

  return summaries.join(". ");
}

/**
 * Run semantic pre-commit audit.
 * Parses the staged diff, analyzes each file's changes against locks.
 */
export function semanticAudit(root) {
  const brain = readBrain(root);
  if (!brain) {
    return {
      passed: true,
      violations: [],
      filesChecked: 0,
      activeLocks: 0,
      mode: "advisory",
      message: "SpecLock not initialized. Audit skipped.",
    };
  }

  const config = getEnforcementConfig(brain);
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

  if (activeLocks.length === 0) {
    return {
      passed: true,
      violations: [],
      filesChecked: 0,
      activeLocks: 0,
      mode: config.mode,
      message: "No active locks. Semantic audit passed.",
    };
  }

  // Get staged diff
  const diff = getStagedDiff(root);
  if (!diff) {
    return {
      passed: true,
      violations: [],
      filesChecked: 0,
      activeLocks: activeLocks.length,
      mode: config.mode,
      message: "No staged changes. Semantic audit passed.",
    };
  }

  // Parse diff into per-file changes, then drop SpecLock-internal / generated
  // files so we don't flood the user with false positives from files that
  // SpecLock itself creates or manages.
  const allFileChanges = parseDiff(diff);
  const fileChanges = allFileChanges.filter(
    (fc) => !shouldSkipForSemanticAudit(fc.file, root)
  );
  const skippedCount = allFileChanges.length - fileChanges.length;
  const violations = [];

  for (const fc of fileChanges) {
    // Check 1: Guard tag violation
    const fullPath = path.join(root, fc.file);
    if (fs.existsSync(fullPath)) {
      try {
        const content = fs.readFileSync(fullPath, "utf-8");
        if (content.includes(GUARD_TAG)) {
          violations.push({
            file: fc.file,
            lockId: null,
            lockText: "(file-level guard)",
            confidence: 100,
            level: "HIGH",
            reason: "File has SPECLOCK-GUARD header — it is locked and must not be modified",
            source: "guard",
          });
          continue; // Don't double-report guarded files
        }
      } catch { /* file read error, continue */ }
    }

    // Check 2: Semantic analysis of code changes against each lock
    const changeSummary = buildChangeSummary(fc);
    if (!changeSummary) continue;

    // Prepend file path for context
    const fullSummary = `Modifying file ${fc.file}: ${changeSummary}`;

    for (const lock of activeLocks) {
      const result = analyzeConflict(fullSummary, lock.text);

      if (result.isConflict) {
        violations.push({
          file: fc.file,
          lockId: lock.id,
          lockText: lock.text,
          confidence: result.confidence,
          level: result.level,
          reason: result.reasons.join("; "),
          source: "semantic",
          addedLines: fc.addedLines.length,
          removedLines: fc.removedLines.length,
        });
      }
    }
  }

  // Deduplicate: keep highest confidence per file+lock pair
  const dedupKey = (v) => `${v.file}::${v.lockId || v.lockText}`;
  const bestByKey = new Map();
  for (const v of violations) {
    const key = dedupKey(v);
    const existing = bestByKey.get(key);
    if (!existing || v.confidence > existing.confidence) {
      bestByKey.set(key, v);
    }
  }
  const uniqueViolations = [...bestByKey.values()];

  // Sort by confidence descending
  uniqueViolations.sort((a, b) => b.confidence - a.confidence);

  // In hard mode, check if any violation meets the block threshold
  const blocked = config.mode === "hard" &&
    uniqueViolations.some((v) => v.confidence >= config.blockThreshold);

  const passed = uniqueViolations.length === 0;
  let message;
  if (passed) {
    message = `Semantic audit passed. ${fileChanges.length} file(s) analyzed against ${activeLocks.length} lock(s).`;
  } else if (blocked) {
    message = `BLOCKED: ${uniqueViolations.length} violation(s) detected in ${fileChanges.length} file(s). Hard enforcement active — commit rejected.`;
  } else {
    message = `WARNING: ${uniqueViolations.length} violation(s) detected in ${fileChanges.length} file(s). Advisory mode — review before proceeding.`;
  }

  return {
    passed,
    blocked,
    violations: uniqueViolations,
    filesChecked: fileChanges.length,
    filesSkipped: skippedCount,
    activeLocks: activeLocks.length,
    mode: config.mode,
    threshold: config.blockThreshold,
    message,
  };
}

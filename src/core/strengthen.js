/**
 * SpecLock Lock Strengthener — Grade and Improve Weak Locks
 * Analyzes each lock's specificity, scope, and detection power.
 * Suggests stronger versions that catch more violations.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import { readBrain } from "./storage.js";
import { ensureInit } from "./memory.js";

// --- Weakness patterns ---

const WEAKNESS_RULES = [
  {
    id: "too_short",
    test: (text) => text.split(/\s+/).length < 4,
    issue: "Too vague — short locks miss edge cases",
    fix: (text) => `${text} — no modifications, refactoring, or rewriting allowed without explicit permission`,
  },
  {
    id: "no_action_verb",
    test: (text) => {
      const lower = text.toLowerCase();
      return !["never", "don't", "do not", "must not", "cannot", "must", "always", "no "].some(
        (v) => lower.includes(v)
      );
    },
    issue: "No enforcement verb — AI may interpret as suggestion rather than rule",
    fix: (text) => `Never ${text.charAt(0).toLowerCase() + text.slice(1)}`,
  },
  {
    id: "no_scope",
    test: (text) => {
      const lower = text.toLowerCase();
      const hasScope = ["file", "module", "function", "endpoint", "route", "table",
        "column", "field", "component", "page", "api", "database", "schema",
        "auth", "payment", "config", "secret", "key", "middleware"].some(
        (s) => lower.includes(s)
      );
      return !hasScope;
    },
    issue: "No specific scope — doesn't target files, modules, or components",
    fix: (text) => text, // Can't auto-fix without context
  },
  {
    id: "no_consequence",
    test: (text) => {
      const lower = text.toLowerCase();
      return !["because", "reason", "will break", "will fail", "causes", "leads to",
        "depends on", "clients depend", "users expect", "production", "critical"].some(
        (c) => lower.includes(c)
      );
    },
    issue: "No consequence explained — AI may override without understanding impact",
    fix: null, // Needs context
  },
  {
    id: "ambiguous_touch",
    test: (text) => {
      const lower = text.toLowerCase();
      return lower.includes("touch") && !lower.includes("modify") && !lower.includes("change");
    },
    issue: '"Touch" is ambiguous — does it mean read, write, or delete?',
    fix: (text) => text.replace(/touch/gi, "modify, refactor, or delete"),
  },
  {
    id: "missing_euphemism_guard",
    test: (text) => {
      const lower = text.toLowerCase();
      const hasDelete = lower.includes("delete") || lower.includes("remove");
      const hasCleanup = lower.includes("clean") || lower.includes("simplif") || lower.includes("reorganiz");
      return hasDelete && !hasCleanup;
    },
    issue: 'Doesn\'t guard against euphemisms like "clean up" or "simplify" which often mean deletion',
    fix: (text) => `${text}. This includes euphemisms like "clean up", "simplify", "modernize", or "reorganize" — these often mask destructive changes`,
  },
];

/**
 * Analyze all locks and suggest improvements.
 *
 * @param {string} root - Project root
 * @returns {Object} Strength analysis
 */
export function analyzeLockStrength(root) {
  const brain = ensureInit(root);
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

  if (activeLocks.length === 0) {
    return {
      totalLocks: 0,
      avgStrength: 0,
      locks: [],
      summary: "No active locks to analyze. Add constraints first.",
    };
  }

  const analyzed = activeLocks.map((lock) => {
    const text = lock.text || "";
    const weaknesses = [];
    const suggestions = [];

    for (const rule of WEAKNESS_RULES) {
      if (rule.test(text)) {
        weaknesses.push({ id: rule.id, issue: rule.issue });
        if (rule.fix) {
          const fixed = rule.fix(text);
          if (fixed !== text) {
            suggestions.push({ id: rule.id, improved: fixed });
          }
        }
      }
    }

    // Score: start at 100, deduct per weakness
    const deductions = {
      too_short: 25,
      no_action_verb: 20,
      no_scope: 15,
      no_consequence: 10,
      ambiguous_touch: 15,
      missing_euphemism_guard: 10,
    };

    let strength = 100;
    for (const w of weaknesses) {
      strength -= deductions[w.id] || 10;
    }
    strength = Math.max(0, strength);

    let grade;
    if (strength >= 90) grade = "A";
    else if (strength >= 75) grade = "B";
    else if (strength >= 60) grade = "C";
    else if (strength >= 40) grade = "D";
    else grade = "F";

    return {
      id: lock.id,
      text: text.substring(0, 100),
      fullText: text,
      strength,
      grade,
      weaknesses,
      suggestions: suggestions.slice(0, 2), // top 2 suggestions
    };
  });

  const avgStrength = Math.round(
    analyzed.reduce((sum, l) => sum + l.strength, 0) / analyzed.length
  );

  const weak = analyzed.filter((l) => l.strength < 60);
  const strong = analyzed.filter((l) => l.strength >= 80);

  return {
    totalLocks: analyzed.length,
    avgStrength,
    avgGrade: avgStrength >= 90 ? "A" : avgStrength >= 75 ? "B" : avgStrength >= 60 ? "C" : avgStrength >= 40 ? "D" : "F",
    strongCount: strong.length,
    weakCount: weak.length,
    locks: analyzed,
    summary: `${analyzed.length} locks analyzed. Average strength: ${avgStrength}/100 (${weak.length} weak, ${strong.length} strong).`,
  };
}

/**
 * Format strength analysis for CLI output.
 */
export function formatStrength(result) {
  if (result.totalLocks === 0) return result.summary;

  const lines = [];

  lines.push(`Lock Strength: ${result.avgStrength}/100 (${result.avgGrade}) — ${result.strongCount} strong, ${result.weakCount} weak`);
  lines.push("");

  // Sort weakest first
  const sorted = [...result.locks].sort((a, b) => a.strength - b.strength);

  for (const lock of sorted) {
    const icon = lock.strength >= 80 ? "STRONG" : lock.strength >= 60 ? "OK" : "WEAK";
    lines.push(`[${icon.padEnd(6)}] ${lock.strength}/100 (${lock.grade})  "${lock.text}"`);

    if (lock.weaknesses.length > 0) {
      for (const w of lock.weaknesses) {
        lines.push(`          Issue: ${w.issue}`);
      }
    }
    if (lock.suggestions.length > 0) {
      lines.push(`          Suggested: "${lock.suggestions[0].improved.substring(0, 100)}"`);
    }
    lines.push("");
  }

  lines.push(result.summary);
  return lines.join("\n");
}

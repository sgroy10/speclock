/**
 * SpecLock Drift Score — Project Integrity Metric
 * Measures how much a project has drifted from the founder's original intent.
 * 0 = perfect alignment, 100 = complete drift.
 *
 * Signals:
 *   - Lock violations (blocked + warned)
 *   - Override frequency
 *   - Revert detections
 *   - Lock churn (locks removed)
 *   - Session continuity gaps
 *   - Decision stability
 *
 * Only SpecLock can compute this because only SpecLock knows
 * what was INTENDED vs what was DONE.
 *
 * Developed by Sandeep Roy (https://github.com/sgroy10)
 */

import { readBrain, readEvents } from "./storage.js";
import { ensureInit } from "./memory.js";

/**
 * Compute drift score for the project.
 *
 * @param {string} root - Project root
 * @param {Object} [options]
 * @param {number} [options.days] - Look back N days (default: 30)
 * @returns {Object} Drift analysis
 */
export function computeDriftScore(root, options = {}) {
  const brain = ensureInit(root);
  const days = options.days || 30;
  const cutoff = new Date(Date.now() - days * 86400000).toISOString();

  const allEvents = readEvents(root, {});
  const recentEvents = allEvents.filter((e) => e.at >= cutoff);
  const activeLocks = (brain.specLock?.items || []).filter((l) => l.active !== false);

  // --- Signal 1: Violation Rate (0-30 points) ---
  // How often did the AI hit constraints?
  const violations = recentEvents.filter(
    (e) => e.type === "conflict_blocked" || e.type === "conflict_warned" ||
           (e.summary && (e.summary.includes("CONFLICT") || e.summary.includes("BLOCK")))
  );
  const checks = recentEvents.filter(
    (e) => e.type === "conflict_checked" || e.type === "conflict_blocked" ||
           e.type === "conflict_warned"
  );
  const violationRate = checks.length > 0
    ? (violations.length / checks.length) * 100
    : 0;
  // 0% violations = 0 drift, 50%+ = 30 drift
  const violationScore = Math.min(30, Math.round(violationRate * 0.6));

  // --- Signal 2: Override Frequency (0-20 points) ---
  // Overrides mean someone bypassed a constraint — that's drift
  const overrides = recentEvents.filter((e) => e.type === "override_applied");
  const overrideScore = Math.min(20, overrides.length * 5);

  // --- Signal 3: Revert Detections (0-15 points) ---
  // Reverts indicate instability — code going back and forth
  const reverts = recentEvents.filter((e) => e.type === "revert_detected");
  const revertScore = Math.min(15, reverts.length * 3);

  // --- Signal 4: Lock Churn (0-15 points) ---
  // Locks being removed means constraints are weakening
  const locksRemoved = recentEvents.filter((e) => e.type === "lock_removed");
  const locksAdded = recentEvents.filter((e) => e.type === "lock_added");
  const churnRatio = locksAdded.length > 0
    ? locksRemoved.length / locksAdded.length
    : locksRemoved.length > 0 ? 1 : 0;
  const churnScore = Math.min(15, Math.round(churnRatio * 15));

  // --- Signal 5: Goal Stability (0-10 points) ---
  // Frequent goal changes indicate lack of direction
  const goalChanges = recentEvents.filter((e) => e.type === "goal_updated");
  const goalScore = Math.min(10, goalChanges.length > 1 ? (goalChanges.length - 1) * 5 : 0);

  // --- Signal 6: Session Gaps (0-10 points) ---
  // Many short sessions without summaries indicate fragmented work
  const sessions = brain.sessions.history.filter((s) => s.startedAt >= cutoff);
  const unsummarized = sessions.filter(
    (s) => !s.summary || s.summary === "Session auto-closed (new session started)"
  );
  const gapRatio = sessions.length > 0 ? unsummarized.length / sessions.length : 0;
  const gapScore = Math.min(10, Math.round(gapRatio * 10));

  // --- Total ---
  const totalScore = violationScore + overrideScore + revertScore +
                     churnScore + goalScore + gapScore;
  const driftScore = Math.min(100, totalScore);

  // --- Grade ---
  let grade, status;
  if (driftScore <= 10) { grade = "A+"; status = "excellent"; }
  else if (driftScore <= 20) { grade = "A"; status = "healthy"; }
  else if (driftScore <= 35) { grade = "B"; status = "minor drift"; }
  else if (driftScore <= 50) { grade = "C"; status = "moderate drift"; }
  else if (driftScore <= 70) { grade = "D"; status = "significant drift"; }
  else { grade = "F"; status = "severe drift"; }

  // --- Per-session drift breakdown ---
  const sessionDrift = sessions.map((s) => {
    const sessionEvents = recentEvents.filter(
      (e) => e.at >= s.startedAt && (s.endedAt ? e.at <= s.endedAt : true)
    );
    const sessionViolations = sessionEvents.filter(
      (e) => e.type === "conflict_blocked" || e.type === "conflict_warned" ||
             (e.summary && e.summary.includes("CONFLICT"))
    );
    const sessionOverrides = sessionEvents.filter(
      (e) => e.type === "override_applied"
    );
    return {
      id: s.id,
      tool: s.toolUsed,
      date: s.startedAt.substring(0, 10),
      events: sessionEvents.length,
      violations: sessionViolations.length,
      overrides: sessionOverrides.length,
      impact: sessionViolations.length * 3 + sessionOverrides.length * 5,
    };
  }).sort((a, b) => b.impact - a.impact);

  // --- Trend ---
  // Compare first half vs second half of the period
  const midpoint = new Date(Date.now() - (days / 2) * 86400000).toISOString();
  const firstHalf = recentEvents.filter((e) => e.at < midpoint);
  const secondHalf = recentEvents.filter((e) => e.at >= midpoint);
  const firstViolations = firstHalf.filter(
    (e) => e.type === "conflict_blocked" || e.type === "conflict_warned"
  ).length;
  const secondViolations = secondHalf.filter(
    (e) => e.type === "conflict_blocked" || e.type === "conflict_warned"
  ).length;

  let trend;
  if (firstViolations === 0 && secondViolations === 0) trend = "stable";
  else if (secondViolations > firstViolations) trend = "worsening";
  else if (secondViolations < firstViolations) trend = "improving";
  else trend = "stable";

  return {
    score: driftScore,
    grade,
    status,
    trend,
    period: `${days} days`,
    signals: {
      violations: { score: violationScore, max: 30, count: violations.length, total: checks.length },
      overrides: { score: overrideScore, max: 20, count: overrides.length },
      reverts: { score: revertScore, max: 15, count: reverts.length },
      lockChurn: { score: churnScore, max: 15, removed: locksRemoved.length, added: locksAdded.length },
      goalStability: { score: goalScore, max: 10, changes: goalChanges.length },
      sessionGaps: { score: gapScore, max: 10, total: sessions.length, unsummarized: unsummarized.length },
    },
    activeLocks: activeLocks.length,
    topDriftSessions: sessionDrift.slice(0, 5),
    badge: `![SpecLock Drift Score](https://img.shields.io/badge/drift_score-${driftScore}%2F100-${driftScore <= 20 ? "brightgreen" : driftScore <= 50 ? "yellow" : "red"}.svg)`,
  };
}

/**
 * Format drift score for CLI output.
 */
export function formatDriftScore(result) {
  const lines = [];

  lines.push(`Drift Score: ${result.score}/100 (${result.grade}) — ${result.status}`);
  lines.push(`Trend: ${result.trend} | Period: ${result.period} | Active locks: ${result.activeLocks}`);
  lines.push("");
  lines.push("Signal Breakdown:");
  lines.push("  " + "-".repeat(50));

  const s = result.signals;
  lines.push(`  Violations:     ${pad(s.violations.score)}/${s.violations.max}  (${s.violations.count} violations in ${s.violations.total} checks)`);
  lines.push(`  Overrides:      ${pad(s.overrides.score)}/${s.overrides.max}  (${s.overrides.count} overrides)`);
  lines.push(`  Reverts:        ${pad(s.reverts.score)}/${s.reverts.max}  (${s.reverts.count} reverts detected)`);
  lines.push(`  Lock churn:     ${pad(s.lockChurn.score)}/${s.lockChurn.max}  (${s.lockChurn.removed} removed, ${s.lockChurn.added} added)`);
  lines.push(`  Goal stability: ${pad(s.goalStability.score)}/${s.goalStability.max}  (${s.goalStability.changes} goal change(s))`);
  lines.push(`  Session gaps:   ${pad(s.sessionGaps.score)}/${s.sessionGaps.max}  (${s.sessionGaps.unsummarized}/${s.sessionGaps.total} unsummarized)`);

  if (result.topDriftSessions.length > 0) {
    lines.push("");
    lines.push("Top Drift Sessions:");
    for (const ds of result.topDriftSessions) {
      if (ds.impact === 0) continue;
      lines.push(`  ${ds.date}  ${ds.tool.padEnd(12)}  ${ds.violations} violation(s), ${ds.overrides} override(s)  [impact: ${ds.impact}]`);
    }
  }

  lines.push("");
  lines.push(`README badge: ${result.badge}`);

  return lines.join("\n");
}

function pad(n) {
  return String(n).padStart(2, " ");
}

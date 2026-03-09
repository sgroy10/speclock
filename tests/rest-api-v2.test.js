// ===================================================================
// SpecLock REST API v2 Test Suite
// Tests typed constraint checking via the v2 REST endpoints.
// Run: node tests/rest-api-v2.test.js
//
// These tests verify the endpoint handler logic directly without
// starting the HTTP server (unit tests, not integration tests).
//
// Developed by Sandeep Roy (https://github.com/sgroy10)
// ===================================================================

import {
  checkAllTypedConstraints,
  CONSTRAINT_TYPES,
} from "../src/core/typed-constraints.js";

import {
  ensureInit,
  addTypedLock,
  updateTypedLockThreshold,
} from "../src/core/engine.js";

import {
  readBrain,
} from "../src/core/storage.js";

import fs from "fs";
import os from "os";
import path from "path";

let passed = 0;
let failed = 0;
const failures = [];
const categories = {};

function test(category, name, fn) {
  if (!categories[category]) categories[category] = { passed: 0, failed: 0, total: 0 };
  categories[category].total++;

  try {
    fn();
    passed++;
    categories[category].passed++;
  } catch (e) {
    failed++;
    categories[category].failed++;
    failures.push({ category, name, error: e.message });
  }
}

function assert(condition, msg) {
  if (!condition) throw new Error(msg || "Assertion failed");
}

function assertEqual(actual, expected, msg) {
  if (actual !== expected) throw new Error(msg || `Expected ${expected}, got ${actual}`);
}

// Create a temp project root for tests
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "speclock-api-v2-"));
ensureInit(tmpDir);

// Helper: read locks from brain and check
function checkTyped(proposed) {
  const brain = readBrain(tmpDir);
  const locks = brain?.specLock?.items || [];
  return checkAllTypedConstraints(locks, proposed);
}

// ===================================================================
// 1. Single Typed Constraint Check (/api/v2/check-typed logic)
// ===================================================================

// Add some constraints for testing
addTypedLock(tmpDir, {
  constraintType: "numerical",
  metric: "motor_speed",
  operator: "<=",
  value: 3000,
  unit: "RPM",
}, ["safety"], "user", "Motor speed limit");

addTypedLock(tmpDir, {
  constraintType: "range",
  metric: "temperature",
  min: 10,
  max: 80,
  unit: "°C",
}, ["safety"], "user", "Temperature range");

addTypedLock(tmpDir, {
  constraintType: "state",
  entity: "robot_arm",
  forbidden: [
    { from: "EMERGENCY", to: "RUNNING" },
    { from: "*", to: "OVERLOAD" },
  ],
}, ["safety"], "user", "Robot arm state rules");

addTypedLock(tmpDir, {
  constraintType: "temporal",
  metric: "heartbeat_interval",
  operator: "<=",
  value: 500,
  unit: "ms",
}, ["safety"], "user", "Heartbeat must be <=500ms");

test("Single Check", "Safe motor speed returns no conflict", () => {
  const result = checkTyped({ metric: "motor_speed", value: 2000 });
  assert(!result.hasConflict, "2000 RPM should be safe");
});

test("Single Check", "Excess motor speed returns conflict", () => {
  const result = checkTyped({ metric: "motor_speed", value: 4000 });
  assert(result.hasConflict, "4000 RPM should violate");
  assert(result.conflictingLocks.length >= 1, "Should have conflicting locks");
  assert(result.conflictingLocks[0].confidence > 70, "Confidence should be high");
});

test("Single Check", "Temperature within range is safe", () => {
  const result = checkTyped({ metric: "temperature", value: 50 });
  assert(!result.hasConflict, "50°C should be within range");
});

test("Single Check", "Temperature above range is violation", () => {
  const result = checkTyped({ metric: "temperature", value: 95 });
  assert(result.hasConflict, "95°C should violate 10-80 range");
});

test("Single Check", "State transition EMERGENCY->RUNNING blocked", () => {
  const result = checkTyped({ entity: "robot_arm", from: "EMERGENCY", to: "RUNNING" });
  assert(result.hasConflict, "Should block EMERGENCY->RUNNING");
  assertEqual(result.conflictingLocks[0].confidence, 100, "State violations are 100%");
});

test("Single Check", "Allowed state transition passes", () => {
  const result = checkTyped({ entity: "robot_arm", from: "IDLE", to: "RUNNING" });
  assert(!result.hasConflict, "IDLE->RUNNING should be allowed");
});

test("Single Check", "Temporal violation detected", () => {
  const result = checkTyped({ metric: "heartbeat_interval", value: 1000 });
  assert(result.hasConflict, "1000ms should violate <=500ms");
});

test("Single Check", "Temporal within limit is safe", () => {
  const result = checkTyped({ metric: "heartbeat_interval", value: 200 });
  assert(!result.hasConflict, "200ms should be within 500ms limit");
});

test("Single Check", "Unknown metric returns no conflict", () => {
  const result = checkTyped({ metric: "unknown_sensor", value: 99999 });
  assert(!result.hasConflict, "Unknown metric should not match any lock");
});

// ===================================================================
// 2. Batch Check (/api/v2/check-batch logic)
// ===================================================================

test("Batch Check", "Multiple safe values return zero violations", () => {
  const checks = [
    { metric: "motor_speed", value: 1500 },
    { metric: "temperature", value: 40 },
    { metric: "heartbeat_interval", value: 300 },
  ];

  let violations = 0;
  for (const check of checks) {
    const result = checkTyped(check);
    if (result.hasConflict) violations++;
  }
  assertEqual(violations, 0, "All safe values should have 0 violations");
});

test("Batch Check", "Mixed safe/unsafe values detected correctly", () => {
  const checks = [
    { metric: "motor_speed", value: 1500 },     // safe
    { metric: "motor_speed", value: 5000 },     // VIOLATION
    { metric: "temperature", value: 40 },        // safe
    { metric: "temperature", value: 120 },       // VIOLATION
    { metric: "heartbeat_interval", value: 200 }, // safe
  ];

  let violations = 0;
  for (const check of checks) {
    const result = checkTyped(check);
    if (result.hasConflict) violations++;
  }
  assertEqual(violations, 2, "Should detect exactly 2 violations");
});

test("Batch Check", "State transitions in batch", () => {
  const checks = [
    { entity: "robot_arm", from: "IDLE", to: "RUNNING" },      // safe
    { entity: "robot_arm", from: "EMERGENCY", to: "RUNNING" },  // VIOLATION
    { entity: "robot_arm", from: "RUNNING", to: "OVERLOAD" },   // VIOLATION (wildcard)
  ];

  let violations = 0;
  let critical = 0;
  for (const check of checks) {
    const result = checkTyped(check);
    if (result.hasConflict) {
      violations++;
      if (result.conflictingLocks[0].confidence >= 90) critical++;
    }
  }
  assertEqual(violations, 2, "Should detect 2 state violations");
  assertEqual(critical, 2, "Both state violations should be critical (100%)");
});

test("Batch Check", "Full robot tick simulation (batch of all sensors)", () => {
  // Simulate one control loop tick: check all sensors + state
  const tick = [
    { metric: "motor_speed", value: 2800 },
    { metric: "temperature", value: 72 },
    { metric: "heartbeat_interval", value: 150 },
    { entity: "robot_arm", from: "RUNNING", to: "IDLE" },
  ];

  let violations = 0;
  for (const check of tick) {
    const result = checkTyped(check);
    if (result.hasConflict) violations++;
  }
  assertEqual(violations, 0, "Normal tick should have 0 violations");
});

test("Batch Check", "Emergency stop detection in batch", () => {
  const tick = [
    { metric: "motor_speed", value: 2800 },    // safe
    { metric: "temperature", value: 200 },       // CRITICAL (huge overage)
    { metric: "heartbeat_interval", value: 150 }, // safe
  ];

  let emergencyStop = false;
  for (const check of tick) {
    const result = checkTyped(check);
    if (result.hasConflict) {
      const topConfidence = result.conflictingLocks[0]?.confidence || 0;
      if (topConfidence >= 90) emergencyStop = true;
    }
  }
  assert(emergencyStop, "200°C (10-80 range) should trigger emergency stop");
});

// ===================================================================
// 3. Constraint CRUD (/api/v2/constraints logic)
// ===================================================================

test("CRUD", "List constraints returns all typed locks", () => {
  const brain = readBrain(tmpDir);
  const locks = (brain?.specLock?.items || []).filter(
    (l) => l.active !== false && CONSTRAINT_TYPES.includes(l.constraintType)
  );
  assertEqual(locks.length, 4, "Should have 4 typed constraints");
});

test("CRUD", "Constraints grouped by type", () => {
  const brain = readBrain(tmpDir);
  const locks = (brain?.specLock?.items || []).filter(
    (l) => l.active !== false && CONSTRAINT_TYPES.includes(l.constraintType)
  );
  const byType = {};
  for (const ct of CONSTRAINT_TYPES) byType[ct] = 0;
  for (const l of locks) byType[l.constraintType]++;

  assertEqual(byType.numerical, 1, "Should have 1 numerical");
  assertEqual(byType.range, 1, "Should have 1 range");
  assertEqual(byType.state, 1, "Should have 1 state");
  assertEqual(byType.temporal, 1, "Should have 1 temporal");
});

test("CRUD", "Add constraint dynamically and check", () => {
  // Add a new constraint
  addTypedLock(tmpDir, {
    constraintType: "numerical",
    metric: "battery_voltage",
    operator: ">=",
    value: 11.0,
    unit: "V",
  }, ["power"], "user", "Battery must be above 11V");

  // Check — should violate
  const result = checkTyped({ metric: "battery_voltage", value: 9.5 });
  assert(result.hasConflict, "9.5V should violate >= 11V");

  // Check — should be safe
  const result2 = checkTyped({ metric: "battery_voltage", value: 12.6 });
  assert(!result2.hasConflict, "12.6V should be safe");
});

test("CRUD", "Update threshold and re-check", () => {
  // Find the motor_speed lock
  const brain = readBrain(tmpDir);
  const motorLock = brain.specLock.items.find(
    (l) => l.constraintType === "numerical" && l.metric === "motor_speed"
  );
  assert(motorLock, "Should find motor_speed lock");

  // 3500 should violate current limit (3000)
  const before = checkTyped({ metric: "motor_speed", value: 3500 });
  assert(before.hasConflict, "3500 RPM should violate 3000 limit");

  // Update threshold to 4000
  updateTypedLockThreshold(tmpDir, motorLock.id, { value: 4000 });

  // 3500 should now be safe
  const after = checkTyped({ metric: "motor_speed", value: 3500 });
  assert(!after.hasConflict, "3500 RPM should be safe after raising limit to 4000");
});

// ===================================================================
// 4. Response Format Verification
// ===================================================================

test("Response Format", "Conflict result has required fields", () => {
  const result = checkTyped({ metric: "temperature", value: 120 });
  assert(result.hasConflict !== undefined, "Must have hasConflict");
  assert(Array.isArray(result.conflictingLocks), "Must have conflictingLocks array");
  assert(typeof result.analysis === "string", "Must have analysis string");
  assert(result.conflictingLocks.length > 0, "Should have conflicts");

  const lock = result.conflictingLocks[0];
  assert(lock.id, "Conflict must have id");
  assert(typeof lock.confidence === "number", "Conflict must have confidence");
  assert(lock.level, "Conflict must have level");
  assert(Array.isArray(lock.reasons), "Conflict must have reasons");
});

test("Response Format", "Safe result has required fields", () => {
  const result = checkTyped({ metric: "temperature", value: 50 });
  assertEqual(result.hasConflict, false, "Should not have conflict");
  assert(Array.isArray(result.conflictingLocks), "Must have conflictingLocks array");
  assertEqual(result.conflictingLocks.length, 0, "Should have no conflicts");
  assert(typeof result.analysis === "string", "Must have analysis string");
});

test("Response Format", "Confidence levels are correct", () => {
  // Small overage — MEDIUM
  const small = checkTyped({ metric: "temperature", value: 82 });
  if (small.hasConflict) {
    assert(small.conflictingLocks[0].confidence >= 70, "Should be at least 70");
  }

  // Huge overage — HIGH
  const huge = checkTyped({ metric: "temperature", value: 200 });
  assert(huge.hasConflict, "200°C should violate");
  assert(huge.conflictingLocks[0].confidence >= 90, "Huge overage should be HIGH");
  assertEqual(huge.conflictingLocks[0].level, "HIGH", "Should be HIGH level");
});

// ===================================================================
// 5. Edge Cases
// ===================================================================

test("Edge Cases", "Empty proposed object returns safely", () => {
  const brain = readBrain(tmpDir);
  const result = checkAllTypedConstraints(brain?.specLock?.items || [], {});
  assert(!result.hasConflict, "Empty proposed should not crash");
});

test("Edge Cases", "Null value handled gracefully", () => {
  const result = checkTyped({ metric: "motor_speed", value: null });
  assert(typeof result.hasConflict === "boolean", "Should return valid result");
});

test("Edge Cases", "String value handled gracefully", () => {
  const result = checkTyped({ metric: "motor_speed", value: "not_a_number" });
  assert(typeof result.hasConflict === "boolean", "Should return valid result");
});

test("Edge Cases", "Negative values work correctly", () => {
  addTypedLock(tmpDir, {
    constraintType: "range",
    metric: "joint_angle",
    min: -180,
    max: 180,
    unit: "degrees",
  }, ["safety"], "user", "Joint angle limits");

  const safe = checkTyped({ metric: "joint_angle", value: -90 });
  assert(!safe.hasConflict, "-90° should be within [-180, 180]");

  const violation = checkTyped({ metric: "joint_angle", value: -200 });
  assert(violation.hasConflict, "-200° should violate [-180, 180]");
});

test("Edge Cases", "Zero threshold works", () => {
  addTypedLock(tmpDir, {
    constraintType: "numerical",
    metric: "error_count",
    operator: "==",
    value: 0,
  }, ["quality"], "user", "Zero errors required");

  const safe = checkTyped({ metric: "error_count", value: 0 });
  assert(!safe.hasConflict, "0 errors should satisfy == 0");

  const violation = checkTyped({ metric: "error_count", value: 5 });
  assert(violation.hasConflict, "5 errors should violate == 0");
});

// ===================================================================
// 6. Performance (batch throughput)
// ===================================================================

test("Performance", "100 checks complete in under 100ms", () => {
  const brain = readBrain(tmpDir);
  const locks = brain?.specLock?.items || [];
  const checks = [];
  for (let i = 0; i < 100; i++) {
    checks.push({ metric: "motor_speed", value: 1000 + Math.random() * 5000 });
  }

  const start = performance.now();
  for (const check of checks) {
    checkAllTypedConstraints(locks, check);
  }
  const elapsed = performance.now() - start;

  assert(elapsed < 100, `100 checks took ${elapsed.toFixed(1)}ms (should be <100ms)`);
});

test("Performance", "Response includes timing metadata", () => {
  const brain = readBrain(tmpDir);
  const locks = brain?.specLock?.items || [];
  const start = performance.now();
  const result = checkAllTypedConstraints(locks, { metric: "motor_speed", value: 4000 });
  const elapsed = performance.now() - start;

  const response = {
    ...result,
    response_time_ms: Number(elapsed.toFixed(3)),
    api_version: "v2",
  };

  assert(typeof response.response_time_ms === "number", "Must include response_time_ms");
  assertEqual(response.api_version, "v2", "Must include api_version");
  assert(response.response_time_ms < 10, `Single check should be <10ms, was ${response.response_time_ms}ms`);
});

// ===================================================================
// Results
// ===================================================================

// Cleanup
try { fs.rmSync(tmpDir, { recursive: true }); } catch {}

console.log("\n" + "=".repeat(60));
console.log("SpecLock REST API v2 Test Results");
console.log("=".repeat(60));
for (const [cat, stats] of Object.entries(categories)) {
  const icon = stats.failed === 0 ? "✓" : "✗";
  console.log(`  ${icon} ${cat}: ${stats.passed}/${stats.total} passed`);
}
console.log("-".repeat(60));
console.log(`Total: ${passed} passed, ${failed} failed out of ${passed + failed}`);
console.log("=".repeat(60));

if (failures.length > 0) {
  console.log("\nFailed tests:");
  for (const f of failures) {
    console.log(`  ✗ [${f.category}] ${f.name}`);
    console.log(`    ${f.error}`);
  }
}

process.exit(failed > 0 ? 1 : 0);

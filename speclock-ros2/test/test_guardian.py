"""
SpecLock ROS2 — Guardian Node Tests

Tests constraint loading, violation detection, and emergency stop logic
without requiring a full ROS2 environment.

Run: python speclock-ros2/test/test_guardian.py

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import json
import os
import sys
import tempfile
import time
import traceback
import yaml

# Add parent paths for imports
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "..", "speclock-py"))

from speclock import SpecLock
from speclock.constraints import (
    validate_typed_lock,
    check_typed_constraint,
    check_all_typed_constraints,
    CONSTRAINT_TYPES,
    OPERATORS,
)

# ============================================================
# Test runner
# ============================================================
passed = 0
failed = 0
errors = []


def test(name, fn):
    global passed, failed
    try:
        fn()
        passed += 1
        print(f"  PASS  {name}")
    except Exception as e:
        failed += 1
        errors.append((name, e))
        print(f"  FAIL  {name}: {e}")
        traceback.print_exc()


# ============================================================
# Helper: Convert YAML constraint to SDK format
# ============================================================
def yaml_to_sdk(c):
    """Convert YAML constraint dict to SDK's internal format.

    YAML uses friendlier names (type, threshold, forbidden_transitions, max_interval).
    SDK uses brain.json names (constraintType, value, forbidden, operator+value).
    """
    ct = c.get("type")
    result = {"constraintType": ct}

    if ct == "numerical":
        result["metric"] = c["metric"]
        result["operator"] = c["operator"]
        result["value"] = c.get("threshold", c.get("value"))
        if c.get("unit"):
            result["unit"] = c["unit"]
    elif ct == "range":
        result["metric"] = c["metric"]
        result["min"] = c["min"]
        result["max"] = c["max"]
        if c.get("unit"):
            result["unit"] = c["unit"]
    elif ct == "state":
        result["entity"] = c["entity"]
        result["forbidden"] = c.get("forbidden_transitions", c.get("forbidden", []))
        if c.get("requires_approval"):
            result["requireApproval"] = True
    elif ct == "temporal":
        result["metric"] = c["metric"]
        # Convert max_interval/min_interval to operator+value format
        if "max_interval" in c:
            result["operator"] = "<="
            result["value"] = c["max_interval"]
        elif "min_interval" in c:
            result["operator"] = ">="
            result["value"] = c["min_interval"]
        else:
            result["operator"] = c.get("operator", "<=")
            result["value"] = c.get("value", 0)
        if c.get("unit"):
            result["unit"] = c["unit"]
    return result


# ============================================================
# 1. YAML Constraint Loading
# ============================================================
print("\n--- YAML Constraint Loading ---")


def _test_yaml_load():
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "constraints.yaml")
    with open(config_path) as f:
        config = yaml.safe_load(f)
    assert "constraints" in config, "YAML must have 'constraints' key"
    assert len(config["constraints"]) >= 10, f"Expected >=10 constraints, got {len(config['constraints'])}"


test("YAML config loads successfully", _test_yaml_load)


def _test_yaml_constraint_types():
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "constraints.yaml")
    with open(config_path) as f:
        config = yaml.safe_load(f)
    types_found = set()
    for c in config["constraints"]:
        types_found.add(c["type"])
    assert "numerical" in types_found, "Missing numerical constraints"
    assert "range" in types_found, "Missing range constraints"
    assert "state" in types_found, "Missing state constraints"
    assert "temporal" in types_found, "Missing temporal constraints"
    assert "text" in types_found, "Missing text constraints"


test("YAML has all 5 constraint types", _test_yaml_constraint_types)


def _test_yaml_to_typed_locks():
    """Load YAML constraints and validate them as typed locks."""
    config_path = os.path.join(os.path.dirname(__file__), "..", "config", "constraints.yaml")
    with open(config_path) as f:
        config = yaml.safe_load(f)

    valid_count = 0
    for c in config["constraints"]:
        ct = c.get("type")
        if ct in ("numerical", "range", "state", "temporal"):
            sdk_lock = yaml_to_sdk(c)
            result = validate_typed_lock(sdk_lock)
            assert result["valid"], f"Constraint '{c.get('description', ct)}' failed validation: {result.get('error')}"
            valid_count += 1
    assert valid_count >= 8, f"Expected >=8 valid typed constraints, got {valid_count}"


test("YAML typed constraints all validate", _test_yaml_to_typed_locks)

# ============================================================
# 2. Guardian Violation Detection (simulated)
# ============================================================
print("\n--- Guardian Violation Detection ---")


def _test_joint_position_violation():
    """Simulate joint position exceeding range constraint."""
    lock = {
        "constraintType": "range",
        "metric": "joint_position_shoulder",
        "min": -3.14,
        "max": 3.14,
    }
    # Within range — safe
    result = check_typed_constraint(lock, {"value": 1.5})
    assert not result["has_conflict"], "1.5 rad should be within range"

    # Outside range — violation
    result = check_typed_constraint(lock, {"value": 4.0})
    assert result["has_conflict"], "4.0 rad should violate shoulder range"
    assert result["confidence"] > 70, f"Confidence should be >70, got {result['confidence']}"


test("Joint position range violation detected", _test_joint_position_violation)


def _test_velocity_limit_violation():
    """Simulate velocity exceeding numerical constraint."""
    lock = {
        "constraintType": "numerical",
        "metric": "linear_velocity_x",
        "operator": "<=",
        "value": 1.0,
    }
    # Within limit — safe
    result = check_typed_constraint(lock, {"value": 0.5})
    assert not result["has_conflict"], "0.5 m/s should be within limit"

    # Exceeds limit — violation
    result = check_typed_constraint(lock, {"value": 1.5})
    assert result["has_conflict"], "1.5 m/s should violate velocity limit"


test("Velocity limit violation detected", _test_velocity_limit_violation)


def _test_effort_limit_violation():
    """Simulate joint effort exceeding constraint."""
    lock = {
        "constraintType": "numerical",
        "metric": "joint_effort_shoulder",
        "operator": "<=",
        "value": 50.0,
    }
    # At limit — safe
    result = check_typed_constraint(lock, {"value": 50.0})
    assert not result["has_conflict"], "50 Nm (at limit) should be safe"

    # Over limit — violation
    result = check_typed_constraint(lock, {"value": 75.0})
    assert result["has_conflict"], "75 Nm should violate effort limit"
    assert result["confidence"] >= 85, f"50% overage should give high confidence, got {result['confidence']}"


test("Joint effort violation with high confidence", _test_effort_limit_violation)


def _test_angular_velocity_violation():
    lock = {
        "constraintType": "numerical",
        "metric": "angular_velocity_z",
        "operator": "<=",
        "value": 1.5,
    }
    result = check_typed_constraint(lock, {"value": 3.0})
    assert result["has_conflict"], "3.0 rad/s should violate angular velocity limit"


test("Angular velocity violation detected", _test_angular_velocity_violation)


# ============================================================
# 3. State Machine Violations
# ============================================================
print("\n--- State Machine Violations ---")


def _test_forbidden_state_transition():
    """EMERGENCY -> RUNNING should be forbidden."""
    lock = {
        "constraintType": "state",
        "entity": "robot_arm",
        "forbidden": [{"from": "EMERGENCY", "to": "RUNNING"}],
    }
    # Forbidden transition
    result = check_typed_constraint(lock, {"from": "EMERGENCY", "to": "RUNNING"})
    assert result["has_conflict"], "EMERGENCY->RUNNING should be forbidden"
    assert result["confidence"] == 100, f"State violations should be 100% confidence, got {result['confidence']}"

    # Allowed transition
    result = check_typed_constraint(lock, {"from": "EMERGENCY", "to": "IDLE"})
    assert not result["has_conflict"], "EMERGENCY->IDLE should be allowed"


test("Forbidden state transition EMERGENCY->RUNNING blocked", _test_forbidden_state_transition)


def _test_gripper_safety():
    """Gripper cannot go from HOLDING to SHUTDOWN."""
    lock = {
        "constraintType": "state",
        "entity": "gripper",
        "forbidden": [{"from": "HOLDING", "to": "SHUTDOWN"}],
    }
    result = check_typed_constraint(lock, {"from": "HOLDING", "to": "SHUTDOWN"})
    assert result["has_conflict"], "HOLDING->SHUTDOWN should be forbidden for gripper"


test("Gripper HOLDING->SHUTDOWN blocked", _test_gripper_safety)


def _test_different_entity_ignored():
    """Constraint for robot_arm should not affect gripper.
    Note: check_typed_constraint doesn't filter by entity — it checks any state proposed.
    Entity filtering happens in check_all_typed_constraints. So at the single-constraint
    level, any from/to match will conflict regardless of proposed entity.
    This test verifies the bulk checker filters correctly.
    """
    locks = [
        {
            "id": "lock-arm",
            "constraintType": "state",
            "entity": "robot_arm",
            "forbidden": [{"from": "EMERGENCY", "to": "RUNNING"}],
        },
    ]
    # Checking for gripper entity — robot_arm constraint should not apply
    result = check_all_typed_constraints(locks, {"entity": "gripper", "from": "EMERGENCY", "to": "RUNNING"})
    assert not result["has_conflict"], "robot_arm constraint should not affect gripper"


test("Entity-specific constraints don't cross-fire", _test_different_entity_ignored)


def _test_wildcard_state():
    """Wildcard * should match any state."""
    lock = {
        "constraintType": "state",
        "entity": "motor",
        "forbidden": [{"from": "*", "to": "OVERLOAD"}],
    }
    result = check_typed_constraint(lock, {"from": "RUNNING", "to": "OVERLOAD"})
    assert result["has_conflict"], "Any state -> OVERLOAD should be forbidden"

    result = check_typed_constraint(lock, {"from": "IDLE", "to": "OVERLOAD"})
    assert result["has_conflict"], "IDLE -> OVERLOAD should also be forbidden"

    result = check_typed_constraint(lock, {"from": "RUNNING", "to": "IDLE"})
    assert not result["has_conflict"], "RUNNING -> IDLE should be fine"


test("Wildcard state transitions work", _test_wildcard_state)


# ============================================================
# 4. Bulk Constraint Checking (simulates Guardian loop)
# ============================================================
print("\n--- Bulk Constraint Checking (Guardian Simulation) ---")


def _test_bulk_check_mixed_constraints():
    """Simulate Guardian checking multiple constraints at once."""
    locks = [
        {
            "id": "lock-1",
            "constraintType": "numerical",
            "metric": "linear_velocity_x",
            "operator": "<=",
            "value": 1.0,
        },
        {
            "id": "lock-2",
            "constraintType": "range",
            "metric": "joint_position_shoulder",
            "min": -3.14,
            "max": 3.14,
        },
        {
            "id": "lock-3",
            "constraintType": "numerical",
            "metric": "angular_velocity_z",
            "operator": "<=",
            "value": 1.5,
        },
        {
            "id": "lock-4",
            "constraintType": "state",
            "entity": "robot_arm",
            "forbidden": [{"from": "EMERGENCY", "to": "RUNNING"}],
        },
    ]

    # Check velocity — should trigger lock-1
    result = check_all_typed_constraints(locks, {"metric": "linear_velocity_x", "value": 2.0})
    assert result["has_conflict"], "Should detect velocity violation"
    assert any(c["id"] == "lock-1" for c in result["conflicting_locks"]), "lock-1 should fire"

    # Check joint position — safe
    result = check_all_typed_constraints(locks, {"metric": "joint_position_shoulder", "value": 1.0})
    assert not result["has_conflict"], "1.0 rad should be safe"


test("Bulk check detects correct violations", _test_bulk_check_mixed_constraints)


def _test_multiple_violations_single_message():
    """A single sensor reading could violate multiple constraints."""
    locks = [
        {
            "id": "soft-limit",
            "constraintType": "numerical",
            "metric": "temperature",
            "operator": "<=",
            "value": 80.0,
        },
        {
            "id": "hard-limit",
            "constraintType": "numerical",
            "metric": "temperature",
            "operator": "<=",
            "value": 100.0,
        },
    ]
    # Exceeds both
    result = check_all_typed_constraints(locks, {"metric": "temperature", "value": 120.0})
    assert result["has_conflict"], "Should detect temperature violation"
    assert len(result["conflicting_locks"]) == 2, f"Both limits should fire, got {len(result['conflicting_locks'])}"


test("Multiple constraints on same metric fire independently", _test_multiple_violations_single_message)


# ============================================================
# 5. Emergency Stop Logic
# ============================================================
print("\n--- Emergency Stop Logic ---")


def _test_estop_threshold():
    """Violations above threshold should trigger e-stop."""
    violation_threshold = 90

    # Moderate violation (small overage) — below threshold
    lock = {
        "constraintType": "numerical",
        "metric": "velocity",
        "operator": "<=",
        "value": 1.0,
    }
    result = check_typed_constraint(lock, {"value": 1.05})
    assert result["has_conflict"], "Should detect violation"
    should_estop = result["confidence"] >= violation_threshold
    assert not should_estop, f"5% overage confidence {result['confidence']} should NOT trigger e-stop"

    # Severe violation (huge overage) — above threshold
    result = check_typed_constraint(lock, {"value": 5.0})
    assert result["has_conflict"], "Should detect violation"
    should_estop = result["confidence"] >= violation_threshold
    assert should_estop, f"400% overage confidence {result['confidence']} should trigger e-stop"


test("E-stop fires only for severe violations", _test_estop_threshold)


def _test_state_violation_always_estop():
    """State violations are always 100% confidence → always trigger e-stop."""
    lock = {
        "constraintType": "state",
        "entity": "robot_arm",
        "forbidden": [{"from": "EMERGENCY", "to": "RUNNING"}],
    }
    result = check_typed_constraint(lock, {"from": "EMERGENCY", "to": "RUNNING"})
    assert result["confidence"] == 100, "State violations must be 100% confidence"
    assert result["confidence"] >= 90, "State violations must always trigger e-stop"


test("State violations always trigger e-stop (100% confidence)", _test_state_violation_always_estop)


# ============================================================
# 6. SpecLock Integration (end-to-end)
# ============================================================
print("\n--- SpecLock Integration ---")


def _test_speclock_integration():
    """Full SpecLock workflow: init → add typed lock → check → violation."""
    with tempfile.TemporaryDirectory() as tmpdir:
        sl = SpecLock(tmpdir)
        sl.init()

        # Add robot safety constraints (using SDK field names: value, forbidden)
        sl.add_typed_lock("numerical", metric="velocity", operator="<=", value=1.0,
                          description="Max velocity 1.0 m/s", tags=["safety"])
        sl.add_typed_lock("range", metric="joint_position", min=-3.14, max=3.14,
                          description="Joint position limits", tags=["safety"])
        sl.add_typed_lock("state", entity="robot_arm",
                          forbidden=[{"from": "EMERGENCY", "to": "RUNNING"}],
                          description="No EMERGENCY to RUNNING", tags=["safety"])

        # Verify locks exist
        typed_locks = sl.list_typed_locks()
        assert len(typed_locks) >= 3, f"Expected >=3 typed locks, got {len(typed_locks)}"

        # Check safe value
        result = sl.check_typed(metric="velocity", value=0.5)
        assert not result.has_conflict, "0.5 m/s should be safe"

        # Check violation
        result = sl.check_typed(metric="velocity", value=2.0)
        assert result.has_conflict, "2.0 m/s should violate"
        assert len(result.conflicting_locks) >= 1

        # Check state violation (check_typed auto-maps from_state/to_state → from/to)
        result = sl.check_typed(entity="robot_arm", from_state="EMERGENCY", to_state="RUNNING")
        assert result.has_conflict, "EMERGENCY->RUNNING should be blocked"

        # Check state allowed
        result = sl.check_typed(entity="robot_arm", from_state="IDLE", to_state="RUNNING")
        assert not result.has_conflict, "IDLE->RUNNING should be allowed"


test("End-to-end SpecLock + typed constraints", _test_speclock_integration)


def _test_brain_json_compatibility():
    """Typed locks stored in brain.json must be cross-platform compatible."""
    with tempfile.TemporaryDirectory() as tmpdir:
        sl = SpecLock(tmpdir)
        sl.init()

        sl.add_typed_lock("numerical", metric="temperature", operator="<=", value=100.0,
                          description="Max temp", tags=["safety"])

        # Read raw brain.json
        brain_path = os.path.join(tmpdir, ".speclock", "brain.json")
        assert os.path.exists(brain_path), "brain.json must exist"

        with open(brain_path) as f:
            brain = json.load(f)

        # Find the typed lock
        typed_locks = [l for l in brain.get("specLock", {}).get("items", [])
                       if l.get("constraintType") == "numerical"]
        assert len(typed_locks) >= 1, "Should find numerical lock in brain.json"

        lock = typed_locks[0]
        assert lock.get("metric") == "temperature"
        assert lock.get("operator") == "<="
        assert lock.get("value") == 100.0
        assert "safety" in lock.get("tags", [])


test("brain.json stores typed locks correctly", _test_brain_json_compatibility)


# ============================================================
# 7. Temporal Constraints
# ============================================================
print("\n--- Temporal Constraints ---")


def _test_temporal_max_interval():
    lock = {
        "constraintType": "temporal",
        "metric": "heartbeat",
        "operator": "<=",
        "value": 0.5,
    }
    # Interval within limit
    result = check_typed_constraint(lock, {"value": 0.3})
    assert not result["has_conflict"], "0.3s interval should be within 0.5s max"

    # Interval exceeds limit
    result = check_typed_constraint(lock, {"value": 1.0})
    assert result["has_conflict"], "1.0s interval should violate 0.5s max"


test("Temporal max interval constraint", _test_temporal_max_interval)


def _test_temporal_min_interval():
    lock = {
        "constraintType": "temporal",
        "metric": "publish_rate",
        "operator": ">=",
        "value": 0.01,
    }
    # Too fast
    result = check_typed_constraint(lock, {"value": 0.001})
    assert result["has_conflict"], "0.001s should violate 0.01s min interval"

    # Acceptable
    result = check_typed_constraint(lock, {"value": 0.05})
    assert not result["has_conflict"], "0.05s should be within min interval"


test("Temporal min interval constraint", _test_temporal_min_interval)


# ============================================================
# 8. Edge Cases
# ============================================================
print("\n--- Edge Cases ---")


def _test_metric_mismatch_ignored():
    """Constraint for metric A should not check metric B.
    Note: check_typed_constraint doesn't filter by metric.
    Metric filtering happens in check_all_typed_constraints.
    At single-constraint level, the proposed value is checked regardless.
    This test verifies bulk checker filters correctly.
    """
    locks = [
        {
            "id": "temp-lock",
            "constraintType": "numerical",
            "metric": "temperature",
            "operator": "<=",
            "value": 100.0,
        },
    ]
    result = check_all_typed_constraints(locks, {"metric": "velocity", "value": 999.0})
    assert not result["has_conflict"], "temperature constraint should not fire on velocity metric"


test("Metric mismatch correctly ignored", _test_metric_mismatch_ignored)


def _test_zero_value():
    lock = {
        "constraintType": "numerical",
        "metric": "velocity",
        "operator": ">=",
        "value": 0.1,
    }
    result = check_typed_constraint(lock, {"value": 0.0})
    assert result["has_conflict"], "0.0 should violate >= 0.1"


test("Zero value handled correctly", _test_zero_value)


def _test_negative_values():
    lock = {
        "constraintType": "range",
        "metric": "joint_position",
        "min": -3.14,
        "max": 3.14,
    }
    result = check_typed_constraint(lock, {"value": -5.0})
    assert result["has_conflict"], "-5.0 should violate range [-3.14, 3.14]"

    result = check_typed_constraint(lock, {"value": -2.0})
    assert not result["has_conflict"], "-2.0 should be within range"


test("Negative values handled correctly", _test_negative_values)


def _test_exact_boundary():
    lock = {
        "constraintType": "range",
        "metric": "angle",
        "min": 0.0,
        "max": 180.0,
    }
    result = check_typed_constraint(lock, {"value": 0.0})
    assert not result["has_conflict"], "Exact min should be safe"

    result = check_typed_constraint(lock, {"value": 180.0})
    assert not result["has_conflict"], "Exact max should be safe"


test("Exact boundary values are safe", _test_exact_boundary)


# ============================================================
# 9. ROS2 Message Simulation
# ============================================================
print("\n--- ROS2 Message Simulation ---")


def _test_joint_state_multi_joint():
    """Simulate checking all joints from a single JointState message."""
    locks = [
        {"id": "shoulder-pos", "constraintType": "range", "metric": "joint_position_shoulder", "min": -3.14, "max": 3.14},
        {"id": "elbow-pos", "constraintType": "range", "metric": "joint_position_elbow", "min": -2.35, "max": 2.35},
        {"id": "wrist-pos", "constraintType": "range", "metric": "joint_position_wrist", "min": -1.57, "max": 1.57},
        {"id": "shoulder-vel", "constraintType": "numerical", "metric": "joint_velocity_shoulder", "operator": "<=", "value": 2.0},
    ]

    # Simulated JointState message
    joints = {
        "shoulder": {"position": 1.0, "velocity": 1.5},
        "elbow": {"position": 0.5, "velocity": 0.8},
        "wrist": {"position": 2.0, "velocity": 0.3},  # wrist exceeds 1.57 max
    }

    violations = []
    for name, data in joints.items():
        pos_result = check_all_typed_constraints(locks, {"metric": f"joint_position_{name}", "value": data["position"]})
        if pos_result["has_conflict"]:
            violations.extend(pos_result["conflicting_locks"])
        vel_result = check_all_typed_constraints(locks, {"metric": f"joint_velocity_{name}", "value": data["velocity"]})
        if vel_result["has_conflict"]:
            violations.extend(vel_result["conflicting_locks"])

    assert len(violations) == 1, f"Expected 1 violation (wrist position), got {len(violations)}"
    assert violations[0]["id"] == "wrist-pos", f"Expected wrist-pos violation, got {violations[0]['id']}"


test("Multi-joint state checking (simulated JointState)", _test_joint_state_multi_joint)


def _test_cmd_vel_full_check():
    """Simulate checking all 6 velocity components from a Twist message."""
    locks = [
        {"id": "lin-x", "constraintType": "numerical", "metric": "linear_velocity_x", "operator": "<=", "value": 1.0},
        {"id": "lin-y", "constraintType": "numerical", "metric": "linear_velocity_y", "operator": "<=", "value": 0.5},
        {"id": "ang-z", "constraintType": "numerical", "metric": "angular_velocity_z", "operator": "<=", "value": 1.5},
    ]

    # Simulated Twist message — only angular z exceeds
    vel_data = {
        "linear_velocity_x": 0.8,
        "linear_velocity_y": 0.3,
        "linear_velocity_z": 0.0,
        "angular_velocity_x": 0.0,
        "angular_velocity_y": 0.0,
        "angular_velocity_z": 2.5,  # exceeds 1.5
    }

    violations = []
    for metric, value in vel_data.items():
        result = check_all_typed_constraints(locks, {"metric": metric, "value": value})
        if result["has_conflict"]:
            violations.extend(result["conflicting_locks"])

    assert len(violations) == 1, f"Expected 1 violation (ang-z), got {len(violations)}"
    assert violations[0]["id"] == "ang-z"


test("Full Twist message checking (simulated cmd_vel)", _test_cmd_vel_full_check)


def _test_state_transition_message_parse():
    """Simulate parsing a state transition message like the Guardian does."""
    msg_data = "robot_arm:EMERGENCY->RUNNING"

    locks = [
        {
            "id": "no-emergency-run",
            "constraintType": "state",
            "entity": "robot_arm",
            "forbidden": [{"from": "EMERGENCY", "to": "RUNNING"}],
        },
    ]

    # Parse "entity:FROM->TO"
    parts = msg_data.split(":")
    entity = parts[0].strip()
    transition = parts[1].strip().split("->")
    from_state = transition[0].strip()
    to_state = transition[1].strip()

    result = check_all_typed_constraints(locks, {"entity": entity, "from": from_state, "to": to_state})
    assert result["has_conflict"], "EMERGENCY->RUNNING should be caught"
    assert result["conflicting_locks"][0]["id"] == "no-emergency-run"


test("State transition message parsing + checking", _test_state_transition_message_parse)


# ============================================================
# Results
# ============================================================
print(f"\n{'='*50}")
print(f"Results: {passed} passed, {failed} failed out of {passed + failed}")
print(f"{'='*50}")

if errors:
    print("\nFailed tests:")
    for name, err in errors:
        print(f"  - {name}: {err}")

sys.exit(1 if failed > 0 else 0)

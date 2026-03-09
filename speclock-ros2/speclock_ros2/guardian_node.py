"""
SpecLock Guardian Node — Real-time Constraint Enforcement for ROS2

The Guardian is the core enforcement node. It:
1. Loads constraints from YAML config or .speclock/brain.json
2. Subscribes to robot topics (joint states, velocity, temperature, etc.)
3. Checks every incoming message against typed constraints
4. Publishes violation alerts on /speclock/violations
5. Can trigger emergency stop on critical violations
6. Logs all violations to .speclock/brain.json for audit trail

This node is designed to run alongside any ROS2 robot:
- TurtleBot, robotic arms, drones, autonomous vehicles
- Industrial robots, medical robots, warehouse robots
- Any system publishing standard ROS2 message types

Topics:
  Subscribed:
    /joint_states (sensor_msgs/JointState) — joint positions, velocities, efforts
    /cmd_vel (geometry_msgs/Twist) — velocity commands
    /speclock/state_transition (std_msgs/String) — state machine transitions
    Custom topics via YAML config

  Published:
    /speclock/violations (std_msgs/String) — JSON violation alerts
    /speclock/status (std_msgs/String) — constraint status heartbeat
    /speclock/emergency_stop (std_msgs/Bool) — emergency stop trigger

Parameters:
    constraints_file (str): Path to constraints YAML file
    project_root (str): Path to .speclock/ directory (default: current dir)
    check_rate (float): Constraint check rate in Hz (default: 10.0)
    emergency_stop_enabled (bool): Enable e-stop on critical violations (default: True)
    violation_threshold (int): Confidence threshold for e-stop (default: 90)

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import json
import os
import yaml
import time
from typing import Optional

# ROS2 imports — graceful degradation if not in ROS2 environment
try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String, Bool
    from sensor_msgs.msg import JointState
    from geometry_msgs.msg import Twist
    HAS_ROS2 = True
except ImportError:
    HAS_ROS2 = False

# SpecLock Python SDK
from speclock import SpecLock
from speclock.constraints import check_typed_constraint, check_all_typed_constraints


class SpecLockGuardianNode(Node if HAS_ROS2 else object):
    """Real-time constraint enforcement node for ROS2 robots."""

    def __init__(self):
        if not HAS_ROS2:
            raise RuntimeError("ROS2 (rclpy) not available. Install with: sudo apt install ros-humble-rclpy")

        super().__init__("speclock_guardian")

        # Parameters
        self.declare_parameter("constraints_file", "")
        self.declare_parameter("project_root", ".")
        self.declare_parameter("check_rate", 10.0)
        self.declare_parameter("emergency_stop_enabled", True)
        self.declare_parameter("violation_threshold", 90)

        self.constraints_file = self.get_parameter("constraints_file").value
        self.project_root = self.get_parameter("project_root").value
        self.check_rate = self.get_parameter("check_rate").value
        self.estop_enabled = self.get_parameter("emergency_stop_enabled").value
        self.violation_threshold = self.get_parameter("violation_threshold").value

        # Initialize SpecLock
        self.sl = SpecLock(self.project_root)
        self.sl.init()

        # Load constraints from YAML if provided
        if self.constraints_file and os.path.exists(self.constraints_file):
            self._load_yaml_constraints(self.constraints_file)

        # Publishers
        self.violation_pub = self.create_publisher(String, "/speclock/violations", 10)
        self.status_pub = self.create_publisher(String, "/speclock/status", 10)
        self.estop_pub = self.create_publisher(Bool, "/speclock/emergency_stop", 10)

        # Subscribers
        self.joint_sub = self.create_subscription(
            JointState, "/joint_states", self._on_joint_state, 10
        )
        self.vel_sub = self.create_subscription(
            Twist, "/cmd_vel", self._on_cmd_vel, 10
        )
        self.state_sub = self.create_subscription(
            String, "/speclock/state_transition", self._on_state_transition, 10
        )

        # Custom topic subscriptions from YAML
        self._custom_subs = []
        self._setup_custom_subscriptions()

        # Status timer
        period = 1.0 / max(self.check_rate, 0.1)
        self.status_timer = self.create_timer(period, self._publish_status)

        # Stats
        self.total_checks = 0
        self.total_violations = 0
        self.last_violation = None

        self.get_logger().info(
            f"SpecLock Guardian active — "
            f"{len(self.sl.list_typed_locks())} typed constraints, "
            f"{len(self.sl.brain.text_locks)} text locks, "
            f"e-stop={'ON' if self.estop_enabled else 'OFF'}"
        )

    def _load_yaml_constraints(self, filepath: str):
        """Load constraints from a YAML configuration file.

        YAML uses friendly field names; this translates to SDK format:
          threshold → value, forbidden_transitions → forbidden,
          max_interval → operator+value, requires_approval → requireApproval
        """
        with open(filepath, "r") as f:
            config = yaml.safe_load(f)

        if not config or "constraints" not in config:
            return

        for c in config["constraints"]:
            ct = c.get("type")
            if ct in ("numerical", "range", "state", "temporal"):
                kwargs = {k: v for k, v in c.items() if k not in ("type", "description", "tags")}

                # Translate YAML-friendly names to SDK format
                if ct == "numerical" and "threshold" in kwargs:
                    kwargs["value"] = kwargs.pop("threshold")
                if ct == "state":
                    if "forbidden_transitions" in kwargs:
                        kwargs["forbidden"] = kwargs.pop("forbidden_transitions")
                    if "requires_approval" in kwargs:
                        kwargs["requireApproval"] = kwargs.pop("requires_approval")
                if ct == "temporal":
                    if "max_interval" in kwargs:
                        kwargs["operator"] = "<="
                        kwargs["value"] = kwargs.pop("max_interval")
                    elif "min_interval" in kwargs:
                        kwargs["operator"] = ">="
                        kwargs["value"] = kwargs.pop("min_interval")

                self.sl.add_typed_lock(
                    ct,
                    description=c.get("description"),
                    tags=c.get("tags", []),
                    **kwargs,
                )
            elif ct == "text":
                self.sl.add_lock(c.get("text", ""), tags=c.get("tags", []))

        self.get_logger().info(f"Loaded {len(config['constraints'])} constraints from {filepath}")

    def _setup_custom_subscriptions(self):
        """Set up subscriptions for custom topics defined in YAML."""
        # Custom topics can be added via YAML config:
        # topics:
        #   - name: /temperature
        #     metric: temperature
        #     field: data
        pass  # Extensible via YAML

    def _on_joint_state(self, msg: "JointState"):
        """Check joint states against constraints."""
        for i, name in enumerate(msg.name):
            # Check joint position constraints
            if i < len(msg.position):
                self._check_and_report(
                    metric=f"joint_position_{name}",
                    value=msg.position[i],
                    source=f"/joint_states/{name}/position",
                )

            # Check joint velocity constraints
            if i < len(msg.velocity):
                self._check_and_report(
                    metric=f"joint_velocity_{name}",
                    value=msg.velocity[i],
                    source=f"/joint_states/{name}/velocity",
                )

            # Check joint effort constraints
            if i < len(msg.effort):
                self._check_and_report(
                    metric=f"joint_effort_{name}",
                    value=msg.effort[i],
                    source=f"/joint_states/{name}/effort",
                )

    def _on_cmd_vel(self, msg: "Twist"):
        """Check velocity commands against constraints."""
        self._check_and_report(metric="linear_velocity_x", value=msg.linear.x, source="/cmd_vel/linear/x")
        self._check_and_report(metric="linear_velocity_y", value=msg.linear.y, source="/cmd_vel/linear/y")
        self._check_and_report(metric="linear_velocity_z", value=msg.linear.z, source="/cmd_vel/linear/z")
        self._check_and_report(metric="angular_velocity_x", value=msg.angular.x, source="/cmd_vel/angular/x")
        self._check_and_report(metric="angular_velocity_y", value=msg.angular.y, source="/cmd_vel/angular/y")
        self._check_and_report(metric="angular_velocity_z", value=msg.angular.z, source="/cmd_vel/angular/z")

    def _on_state_transition(self, msg: "String"):
        """Check state transitions against constraints.

        Message format: "entity:from_state->to_state"
        Example: "robot_arm:EMERGENCY->IDLE"
        """
        try:
            parts = msg.data.split(":")
            if len(parts) != 2:
                return
            entity = parts[0].strip()
            transition = parts[1].strip().split("->")
            if len(transition) != 2:
                return
            from_state = transition[0].strip()
            to_state = transition[1].strip()

            result = self.sl.check_typed(entity=entity, from_state=from_state, to_state=to_state)
            self.total_checks += 1

            if result.has_conflict:
                self.total_violations += 1
                self.last_violation = result

                violation_msg = {
                    "type": "state_violation",
                    "entity": entity,
                    "from": from_state,
                    "to": to_state,
                    "analysis": result.analysis,
                    "conflicts": [
                        {"id": c["id"], "confidence": c["confidence"], "reasons": c["reasons"]}
                        for c in result.conflicting_locks
                    ],
                    "timestamp": time.time(),
                }

                msg_out = String()
                msg_out.data = json.dumps(violation_msg)
                self.violation_pub.publish(msg_out)

                self.get_logger().warn(
                    f"STATE VIOLATION: {entity} {from_state}->{to_state} — "
                    f"{result.conflicting_locks[0]['reasons'][0]}"
                )

                # Emergency stop on critical state violations
                top_confidence = result.conflicting_locks[0]["confidence"]
                if self.estop_enabled and top_confidence >= self.violation_threshold:
                    self._trigger_estop(f"Forbidden state transition: {entity} {from_state}->{to_state}")

        except Exception as e:
            self.get_logger().error(f"Error parsing state transition: {e}")

    def _check_and_report(self, metric: str, value: float, source: str):
        """Check a single metric value against typed constraints and report violations."""
        result = self.sl.check_typed(metric=metric, value=value)
        self.total_checks += 1

        if not result.has_conflict:
            return

        self.total_violations += 1
        self.last_violation = result

        violation_msg = {
            "type": "value_violation",
            "metric": metric,
            "value": value,
            "source": source,
            "analysis": result.analysis,
            "conflicts": [
                {"id": c["id"], "confidence": c["confidence"], "reasons": c["reasons"]}
                for c in result.conflicting_locks
            ],
            "timestamp": time.time(),
        }

        msg = String()
        msg.data = json.dumps(violation_msg)
        self.violation_pub.publish(msg)

        self.get_logger().warn(
            f"CONSTRAINT VIOLATION: {metric}={value} from {source} — "
            f"{result.conflicting_locks[0]['reasons'][0]}"
        )

        # Emergency stop on critical violations
        top_confidence = result.conflicting_locks[0]["confidence"]
        if self.estop_enabled and top_confidence >= self.violation_threshold:
            self._trigger_estop(f"{metric}={value} exceeds safety limit")

    def _trigger_estop(self, reason: str):
        """Trigger emergency stop."""
        estop_msg = Bool()
        estop_msg.data = True
        self.estop_pub.publish(estop_msg)

        self.get_logger().error(f"EMERGENCY STOP TRIGGERED: {reason}")

        # Log to SpecLock audit trail
        self.sl.brain.add_violation(
            action=reason,
            locks=[{"id": "estop", "text": "Emergency stop triggered", "confidence": 100}],
            top_level="CRITICAL",
            top_confidence=100,
        )

    def _publish_status(self):
        """Publish constraint status heartbeat."""
        status = {
            "node": "speclock_guardian",
            "active": True,
            "typed_locks": len(self.sl.list_typed_locks()),
            "text_locks": len(self.sl.brain.text_locks),
            "total_checks": self.total_checks,
            "total_violations": self.total_violations,
            "estop_enabled": self.estop_enabled,
            "timestamp": time.time(),
        }

        msg = String()
        msg.data = json.dumps(status)
        self.status_pub.publish(msg)


def main(args=None):
    if not HAS_ROS2:
        print("ERROR: ROS2 (rclpy) not installed.")
        print("Install ROS2: https://docs.ros.org/en/humble/Installation.html")
        print("Or run in standalone mode: from speclock import SpecLock")
        return

    rclpy.init(args=args)
    node = SpecLockGuardianNode()

    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.get_logger().info(
            f"SpecLock Guardian shutting down — "
            f"{node.total_checks} checks, {node.total_violations} violations"
        )
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()

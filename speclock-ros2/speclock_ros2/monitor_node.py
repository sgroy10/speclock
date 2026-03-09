"""
SpecLock Monitor Node — Constraint Dashboard for ROS2

Lightweight monitoring node that:
1. Subscribes to /speclock/violations and /speclock/status
2. Aggregates violation statistics
3. Publishes dashboard data on /speclock/dashboard
4. Provides service for querying constraint status

Run alongside the Guardian node for complete observability.

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import json
import time
from collections import defaultdict

try:
    import rclpy
    from rclpy.node import Node
    from std_msgs.msg import String
    HAS_ROS2 = True
except ImportError:
    HAS_ROS2 = False


class SpecLockMonitorNode(Node if HAS_ROS2 else object):
    """Dashboard and monitoring node for SpecLock constraints."""

    def __init__(self):
        if not HAS_ROS2:
            raise RuntimeError("ROS2 (rclpy) not available")

        super().__init__("speclock_monitor")

        # State
        self.violations = []
        self.violation_counts = defaultdict(int)
        self.guardian_status = None
        self.last_violation_time = None

        # Subscribers
        self.violation_sub = self.create_subscription(
            String, "/speclock/violations", self._on_violation, 10
        )
        self.status_sub = self.create_subscription(
            String, "/speclock/status", self._on_status, 10
        )

        # Publisher
        self.dashboard_pub = self.create_publisher(String, "/speclock/dashboard", 10)

        # Dashboard timer (1 Hz)
        self.timer = self.create_timer(1.0, self._publish_dashboard)

        self.get_logger().info("SpecLock Monitor active — listening for violations")

    def _on_violation(self, msg: String):
        try:
            data = json.loads(msg.data)
            self.violations.append(data)
            if len(self.violations) > 1000:
                self.violations = self.violations[-500:]

            metric = data.get("metric") or data.get("entity", "unknown")
            self.violation_counts[metric] += 1
            self.last_violation_time = time.time()

            self.get_logger().warn(f"Violation #{len(self.violations)}: {data.get('analysis', 'unknown')[:100]}")
        except json.JSONDecodeError:
            pass

    def _on_status(self, msg: String):
        try:
            self.guardian_status = json.loads(msg.data)
        except json.JSONDecodeError:
            pass

    def _publish_dashboard(self):
        dashboard = {
            "monitor": "speclock_monitor",
            "guardian_active": self.guardian_status is not None,
            "guardian": self.guardian_status,
            "total_violations_seen": len(self.violations),
            "violation_counts_by_metric": dict(self.violation_counts),
            "last_violation_time": self.last_violation_time,
            "recent_violations": self.violations[-10:],
            "timestamp": time.time(),
        }

        msg = String()
        msg.data = json.dumps(dashboard)
        self.dashboard_pub.publish(msg)


def main(args=None):
    if not HAS_ROS2:
        print("ERROR: ROS2 (rclpy) not installed.")
        return

    rclpy.init(args=args)
    node = SpecLockMonitorNode()

    try:
        rclpy.spin(node)
    except KeyboardInterrupt:
        pass
    finally:
        node.get_logger().info(f"Monitor: saw {len(node.violations)} violations total")
        node.destroy_node()
        rclpy.shutdown()


if __name__ == "__main__":
    main()

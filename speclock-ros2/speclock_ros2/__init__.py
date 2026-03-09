"""
SpecLock ROS2 — AI Constraint Engine for Robot Safety

Real-time constraint enforcement for autonomous systems.
Monitors robot topics, enforces safety limits, blocks forbidden
state transitions, and triggers emergency stops on violations.

Nodes:
- speclock_guardian: Main enforcement node. Subscribes to robot topics,
  checks constraints, publishes violation alerts, can trigger e-stop.
- speclock_monitor: Dashboard node. Publishes constraint status and
  violation history for visualization.

Usage:
    ros2 run speclock_ros2 speclock_guardian --ros-args -p constraints_file:=constraints.yaml
    ros2 launch speclock_ros2 speclock_launch.py

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

__version__ = "5.0.0"

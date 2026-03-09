"""
SpecLock ROS2 Launch File — Complete Safety System

Launches both the Guardian (enforcement) and Monitor (dashboard) nodes
with configurable parameters.

Usage:
    ros2 launch speclock_ros2 speclock_launch.py
    ros2 launch speclock_ros2 speclock_launch.py constraints_file:=/path/to/constraints.yaml
    ros2 launch speclock_ros2 speclock_launch.py emergency_stop_enabled:=false

Developed by Sandeep Roy (https://github.com/sgroy10)
"""

import os
from launch import LaunchDescription
from launch.actions import DeclareLaunchArgument
from launch.substitutions import LaunchConfiguration
from launch_ros.actions import Node


def generate_launch_description():
    # Declare arguments
    constraints_file_arg = DeclareLaunchArgument(
        "constraints_file",
        default_value="",
        description="Path to constraints YAML file",
    )

    project_root_arg = DeclareLaunchArgument(
        "project_root",
        default_value=".",
        description="Path to .speclock/ project directory",
    )

    check_rate_arg = DeclareLaunchArgument(
        "check_rate",
        default_value="10.0",
        description="Constraint check rate in Hz",
    )

    estop_arg = DeclareLaunchArgument(
        "emergency_stop_enabled",
        default_value="true",
        description="Enable emergency stop on critical violations",
    )

    violation_threshold_arg = DeclareLaunchArgument(
        "violation_threshold",
        default_value="90",
        description="Confidence threshold (0-100) for triggering emergency stop",
    )

    # Guardian Node — main enforcement
    guardian_node = Node(
        package="speclock_ros2",
        executable="speclock_guardian",
        name="speclock_guardian",
        parameters=[
            {
                "constraints_file": LaunchConfiguration("constraints_file"),
                "project_root": LaunchConfiguration("project_root"),
                "check_rate": LaunchConfiguration("check_rate"),
                "emergency_stop_enabled": LaunchConfiguration("emergency_stop_enabled"),
                "violation_threshold": LaunchConfiguration("violation_threshold"),
            }
        ],
        output="screen",
    )

    # Monitor Node — dashboard & statistics
    monitor_node = Node(
        package="speclock_ros2",
        executable="speclock_monitor",
        name="speclock_monitor",
        output="screen",
    )

    return LaunchDescription([
        constraints_file_arg,
        project_root_arg,
        check_rate_arg,
        estop_arg,
        violation_threshold_arg,
        guardian_node,
        monitor_node,
    ])

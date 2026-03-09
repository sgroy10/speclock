from setuptools import setup, find_packages

package_name = "speclock_ros2"

setup(
    name=package_name,
    version="5.0.0",
    packages=find_packages(),
    data_files=[
        ("share/ament_index/resource_index/packages", ["resource/speclock_ros2"]),
        ("share/" + package_name, ["package.xml"]),
        ("share/" + package_name + "/launch", ["launch/speclock_launch.py"]),
        ("share/" + package_name + "/config", ["config/constraints.yaml"]),
    ],
    install_requires=[
        "setuptools",
        "speclock>=5.0.0",
    ],
    zip_safe=True,
    maintainer="Sandeep Roy",
    maintainer_email="sgroy10@gmail.com",
    description="SpecLock ROS2 — AI Constraint Engine for Robot Safety",
    license="MIT",
    entry_points={
        "console_scripts": [
            "speclock_guardian = speclock_ros2.guardian_node:main",
            "speclock_monitor = speclock_ros2.monitor_node:main",
        ],
    },
)

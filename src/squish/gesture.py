"""Small, testable pieces of SQUISH!'s gesture and animation logic."""

from __future__ import annotations

from dataclasses import dataclass
from math import cos, hypot, sin
from typing import Protocol, Sequence


class PointLike(Protocol):
    x: float
    y: float


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def remap_clamped(
    value: float,
    in_low: float,
    in_high: float,
    out_low: float = 0.0,
    out_high: float = 1.0,
) -> float:
    """Map a value between ranges, clamping at both ends."""
    if in_high == in_low:
        return out_low
    unit = clamp((value - in_low) / (in_high - in_low))
    return out_low + unit * (out_high - out_low)


def distance(a: PointLike, b: PointLike) -> float:
    return hypot(a.x - b.x, a.y - b.y)


def hand_openness(landmarks: Sequence[PointLike]) -> float:
    """Return a 0..1 estimate: 0 is a fist, 1 is an open hand.

    The estimate compares each fingertip with its lower finger joint relative to
    the palm centre. Distances are normalised by palm width, so moving closer to
    the camera does not dramatically change the reading.
    """
    if len(landmarks) < 21:
        raise ValueError("MediaPipe Hands supplies 21 landmarks")

    palm_ids = (0, 5, 9, 13, 17)
    palm_x = sum(landmarks[i].x for i in palm_ids) / len(palm_ids)
    palm_y = sum(landmarks[i].y for i in palm_ids) / len(palm_ids)

    @dataclass(frozen=True)
    class Point:
        x: float
        y: float

    palm = Point(palm_x, palm_y)
    palm_width = max(distance(landmarks[5], landmarks[17]), 1e-5)

    # thumb tip/IP, then fingertip/PIP pairs for the other four fingers
    finger_pairs = ((4, 3), (8, 6), (12, 10), (16, 14), (20, 18))
    extensions = []
    for tip_id, joint_id in finger_pairs:
        tip_distance = distance(landmarks[tip_id], palm) / palm_width
        joint_distance = distance(landmarks[joint_id], palm) / palm_width
        # Positive when the tip extends beyond its lower joint.
        extension = tip_distance - joint_distance
        extensions.append(remap_clamped(extension, 0.02, 0.62))

    # The thumb is naturally shorter and more variable, so give the other
    # fingers slightly more influence.
    return clamp(extensions[0] * 0.12 + sum(extensions[1:]) * 0.22)


def two_hand_squish(hand_a: Sequence[PointLike], hand_b: Sequence[PointLike]) -> float:
    """Return 0..1 pressure from the direct gap between two palms.

    MediaPipe coordinates are normalised to the camera frame. Hands far apart
    release the toy; bringing their palm centres together compresses it.
    """
    if len(hand_a) < 21 or len(hand_b) < 21:
        raise ValueError("Each MediaPipe hand supplies 21 landmarks")
    palm_ids = (0, 5, 9, 13, 17)
    centre_a = (
        sum(hand_a[i].x for i in palm_ids) / len(palm_ids),
        sum(hand_a[i].y for i in palm_ids) / len(palm_ids),
    )
    centre_b = (
        sum(hand_b[i].x for i in palm_ids) / len(palm_ids),
        sum(hand_b[i].y for i in palm_ids) / len(palm_ids),
    )
    gap = hypot(centre_a[0] - centre_b[0], centre_a[1] - centre_b[1])
    # A wider active range reaches useful pressure sooner while still leaving
    # room for a clear release when the hands move apart.
    return 1.0 - remap_clamped(gap, 0.18, 0.66)


def compression_direction(angle: float) -> str:
    """Name the visible force direction represented by an undirected axis."""
    horizontal = abs(cos(angle))
    vertical = abs(sin(angle))
    if horizontal > 0.87:
        return "side"
    if vertical > 0.87:
        return "top/bottom"
    return "diagonal"


def palm_centre(landmarks: Sequence[PointLike]) -> tuple[float, float]:
    """Return a stable normalised palm centre for motion tracking."""
    if len(landmarks) < 21:
        raise ValueError("Each MediaPipe hand supplies 21 landmarks")
    palm_ids = (0, 5, 9, 13, 17)
    return (
        sum(landmarks[i].x for i in palm_ids) / len(palm_ids),
        sum(landmarks[i].y for i in palm_ids) / len(palm_ids),
    )


def two_hand_roll_motion(
    previous: tuple[tuple[float, float], tuple[float, float]],
    current: tuple[tuple[float, float], tuple[float, float]],
) -> float:
    """Estimate a 0..1 two-palm rolling motion between consecutive frames.

    A rolling gesture moves the two palms in opposite directions. Common camera
    movement moves both palms together and therefore mostly cancels out here.
    Palm identities must stay in the same order between the two frames.
    """
    previous_a, previous_b = previous
    current_a, current_b = current
    a_dx = current_a[0] - previous_a[0]
    a_dy = current_a[1] - previous_a[1]
    b_dx = current_b[0] - previous_b[0]
    b_dy = current_b[1] - previous_b[1]
    axis_x = current_b[0] - current_a[0]
    axis_y = current_b[1] - current_a[1]
    axis_length = max(hypot(axis_x, axis_y), 1e-5)
    tangent_x, tangent_y = -axis_y / axis_length, axis_x / axis_length
    relative_dx = a_dx - b_dx
    relative_dy = a_dy - b_dy
    # Only relative motion across the force axis counts as rubbing. Relative
    # motion along the force axis is the squeeze itself and must not roll.
    motion = abs(relative_dx * tangent_x + relative_dy * tangent_y)
    return remap_clamped(motion, 0.004, 0.042)


def is_pull_apart_tear(
    peak_pressure: float, current_pressure: float, target_pressure: float
) -> bool:
    """Detect a deliberate squeeze-then-release gesture for opening a packet."""
    return (
        peak_pressure > 0.72
        and peak_pressure - current_pressure > 0.27
        and target_pressure < 0.42
    )


def pressure_band(pressure: float) -> str:
    """Name the three equal-status pressure qualities used by Ripple Jelly."""
    pressure = clamp(pressure)
    if pressure < 0.34:
        return "light"
    if pressure < 0.70:
        return "medium"
    return "deep"


def incompressible_deformation(pressure: float) -> tuple[float, float]:
    """Return horizontal and vertical scales for a side-compressed soft sphere.

    Hydrogel is treated as approximately incompressible: squeezing the x axis
    displaces material into the two perpendicular axes. The returned scales
    preserve ellipsoid volume because x_scale * y_scale**2 is approximately 1.
    """
    compression = 1.0 - clamp(pressure) * 0.44
    expansion = 1.0 / (compression**0.5)
    return compression, expansion


def update_burst_charge(charge: float, pressure: float, dt: float) -> float:
    """Accumulate a delayed burst only while near-maximum pressure is held."""
    dt = max(0.0, min(dt, 0.1))
    if pressure >= 0.93:
        charge += dt / 1.25
    else:
        charge -= dt * 1.35
    return clamp(charge)


@dataclass
class SpringValue:
    """A soft spring used for deformation and rebound."""

    value: float = 0.0
    velocity: float = 0.0
    stiffness: float = 28.0
    damping: float = 8.0

    def update(self, target: float, dt: float) -> float:
        dt = min(max(dt, 0.0), 0.05)
        acceleration = (target - self.value) * self.stiffness
        self.velocity += acceleration * dt
        self.velocity *= max(0.0, 1.0 - self.damping * dt)
        self.value += self.velocity * dt
        self.value = clamp(self.value, -0.08, 1.08)
        return self.value

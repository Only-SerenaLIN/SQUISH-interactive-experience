"""Small, testable pieces of SQUISH!'s gesture and animation logic."""

from __future__ import annotations

from dataclasses import dataclass
from math import hypot
from typing import Protocol, Sequence


class PointLike(Protocol):
    x: float
    y: float


def clamp(value: float, low: float = 0.0, high: float = 1.0) -> float:
    return max(low, min(high, value))


def remap_clamped(
    value: float, in_low: float, in_high: float, out_low: float = 0.0, out_high: float = 1.0
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
    """Return 0..1 horizontal pressure from the gap between two palms.

    MediaPipe coordinates are normalised to the camera frame. Hands far apart
    release the toy; bringing their palm centres together compresses it.
    """
    if len(hand_a) < 21 or len(hand_b) < 21:
        raise ValueError("Each MediaPipe hand supplies 21 landmarks")
    palm_ids = (0, 5, 9, 13, 17)
    centre_a = sum(hand_a[i].x for i in palm_ids) / len(palm_ids)
    centre_b = sum(hand_b[i].x for i in palm_ids) / len(palm_ids)
    gap = abs(centre_a - centre_b)
    return 1.0 - remap_clamped(gap, 0.13, 0.58)


def is_pull_apart_tear(peak_pressure: float, current_pressure: float, target_pressure: float) -> bool:
    """Detect a deliberate squeeze-then-release gesture for opening a packet."""
    return peak_pressure > 0.72 and peak_pressure - current_pressure > 0.27 and target_pressure < 0.42


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


from dataclasses import dataclass

import pytest

from squish.gesture import SpringValue, clamp, hand_openness, remap_clamped, two_hand_squish


@dataclass
class Point:
    x: float
    y: float


def make_hand(open_hand: bool) -> list[Point]:
    points = [Point(0.5, 0.8) for _ in range(21)]
    # Stable palm geometry.
    points[0] = Point(0.5, 0.82)
    points[5] = Point(0.38, 0.60)
    points[9] = Point(0.47, 0.56)
    points[13] = Point(0.56, 0.59)
    points[17] = Point(0.65, 0.66)

    pairs = ((4, 3), (8, 6), (12, 10), (16, 14), (20, 18))
    x_values = (0.28, 0.37, 0.47, 0.57, 0.67)
    for (tip, joint), x in zip(pairs, x_values):
        points[joint] = Point(x, 0.52)
        points[tip] = Point(x, 0.15 if open_hand else 0.56)
    return points


def test_clamp_and_remap() -> None:
    assert clamp(-2) == 0
    assert clamp(2) == 1
    assert remap_clamped(5, 0, 10) == pytest.approx(0.5)


def test_open_hand_scores_higher_than_fist() -> None:
    assert hand_openness(make_hand(True)) > 0.75
    assert hand_openness(make_hand(False)) < 0.25


def test_invalid_landmark_count_is_clear() -> None:
    with pytest.raises(ValueError, match="21 landmarks"):
        hand_openness([Point(0, 0)])


def test_spring_moves_toward_target() -> None:
    spring = SpringValue()
    values = [spring.update(1.0, 1 / 60) for _ in range(20)]
    assert values[-1] > values[0]
    assert 0 <= values[-1] <= 1.08


def shifted_hand(offset: float) -> list[Point]:
    return [Point(point.x + offset, point.y) for point in make_hand(True)]


def test_two_hands_get_more_pressure_as_they_move_together() -> None:
    left = shifted_hand(-0.25)
    far_right = shifted_hand(0.25)
    near_right = shifted_hand(-0.05)
    assert two_hand_squish(left, near_right) > two_hand_squish(left, far_right)


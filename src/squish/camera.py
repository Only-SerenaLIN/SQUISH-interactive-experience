"""Optional webcam hand tracking for SQUISH!."""

from __future__ import annotations

import time
from dataclasses import dataclass

from .gesture import hand_openness, two_hand_squish


@dataclass
class TrackingResult:
    openness: float | None
    horizontal_squish: float | None
    hands_visible: int
    message: str


class HandCamera:
    """Owns OpenCV capture and a MediaPipe Hands landmarker.

    Imports happen lazily so the toy can still run in fallback mode if a camera
    package or device is unavailable.
    """

    def __init__(self, camera_index: int = 0) -> None:
        self.camera_index = camera_index
        self.capture = None
        self.hands = None
        self.cv2 = None
        self.enabled = False
        self.error = "Camera is off"
        self._last_seen = 0.0
        self._smoothed = 1.0
        self._smoothed_horizontal = 0.0

    def start(self) -> bool:
        if self.enabled:
            return True
        try:
            import cv2
            import mediapipe as mp

            capture = cv2.VideoCapture(self.camera_index)
            capture.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
            capture.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
            if not capture.isOpened():
                capture.release()
                raise RuntimeError("No webcam could be opened")

            hands = mp.solutions.hands.Hands(
                static_image_mode=False,
                max_num_hands=2,
                model_complexity=0,
                min_detection_confidence=0.55,
                min_tracking_confidence=0.5,
            )
            self.cv2 = cv2
            self.capture = capture
            self.hands = hands
            self.enabled = True
            self.error = ""
            return True
        except Exception as exc:  # fallback mode is intentional
            self.error = f"Camera unavailable: {exc}"
            self.stop()
            return False

    def read(self) -> TrackingResult:
        if not self.enabled or self.capture is None or self.hands is None:
            return TrackingResult(None, None, 0, self.error or "Camera is off")

        ok, frame = self.capture.read()
        if not ok:
            self.error = "Camera frame could not be read"
            return TrackingResult(None, None, 0, self.error)

        rgb = self.cv2.cvtColor(self.cv2.flip(frame, 1), self.cv2.COLOR_BGR2RGB)
        rgb.flags.writeable = False
        result = self.hands.process(rgb)
        if not result.multi_hand_landmarks:
            elapsed = time.monotonic() - self._last_seen
            message = "Show one hand to the camera" if elapsed > 0.35 else "Tracking…"
            return TrackingResult(None, None, 0, message)

        if len(result.multi_hand_landmarks) >= 2:
            raw = two_hand_squish(
                result.multi_hand_landmarks[0].landmark,
                result.multi_hand_landmarks[1].landmark,
            )
            self._smoothed_horizontal += (raw - self._smoothed_horizontal) * 0.25
            self._last_seen = time.monotonic()
            return TrackingResult(None, self._smoothed_horizontal, 2, "Two-hand side squeeze")

        raw = hand_openness(result.multi_hand_landmarks[0].landmark)
        self._smoothed += (raw - self._smoothed) * 0.28
        self._last_seen = time.monotonic()
        return TrackingResult(self._smoothed, None, 1, "One hand detected")

    def toggle(self) -> bool:
        if self.enabled:
            self.stop()
            self.error = "Camera paused"
            return False
        return self.start()

    def stop(self) -> None:
        if self.capture is not None:
            self.capture.release()
        if self.hands is not None:
            self.hands.close()
        self.capture = None
        self.hands = None
        self.enabled = False


# Archived Python Prototype

This directory preserves the early desktop experiments that preceded the final browser-based SQUISH experience.

It is included only as development history. **Markers do not need Python, Pygame, OpenCV, MediaPipe, or uv to run the submitted project.** The assessed version is the browser experience in [`../../web/`](../../web/), using the instructions in the repository's main [`README.md`](../../README.md).

## Historical contents

- `run_squish.py` — desktop prototype entry point
- `src/squish/` — Pygame drawing, camera capture, and gesture calculations
- `tests/test_gesture.py` — tests for the archived gesture calculations
- `docs/` — screenshots from the stress-toy, ramen, ripple, and 3D gel experiments
- `.python-version`, `pyproject.toml`, and `uv.lock` — historical Python version and frozen dependencies for reproducing the archive

## Optional historical run instructions

These commands are not required for the final assignment. To reproduce the archived prototype, use Python 3.11 or 3.12 and [uv](https://docs.astral.sh/uv/):

```bash
cd archive/python-prototype
uv sync
uv run python run_squish.py
```

Archived tests:

```bash
uv run pytest
```

Camera behavior depends on OpenCV, MediaPipe, operating-system camera permission, and compatible Python packages. The final browser version provides its own mouse fallback and should be used for assessment.

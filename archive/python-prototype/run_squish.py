"""Stable project entry point used by `uv run python run_squish.py`."""

from __future__ import annotations

import sys
from pathlib import Path


SOURCE_DIRECTORY = Path(__file__).resolve().parent / "src"
sys.path.insert(0, str(SOURCE_DIRECTORY))

from squish.app import main  # noqa: E402  (path is prepared above)


if __name__ == "__main__":
    main()

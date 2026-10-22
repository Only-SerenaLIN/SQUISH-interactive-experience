# SQUISH!

**SQUISH!** is a small interactive digital stress toy. Open your hand in front of the webcam to let the character rebound; close your fist to squash it. If the camera is unavailable, the complete interaction still works with the keyboard or mouse.

This is a deliberately manageable Assignment 3 prototype: one clear interaction, immediate visual feedback, a strong visual identity, and enough technical depth to demonstrate webcam-based embodied input without turning the project into a large game.

![SQUISH preview](docs/preview.png)

## 中文三步启动

1. 在 Codex 中选择 **Open Folder**，打开这个 `SQUISH` 文件夹，再打开内置终端。
2. 第一次运行 `uv sync`，等待依赖安装完成。
3. 运行 `uv run python run_squish.py`。看到摄像头权限提示时选择允许；张开手会让角色回弹，握拳会把它压扁。

如果暂时不想开摄像头，运行 `uv run python run_squish.py --no-camera`，然后按住空格键或鼠标左键。按 `C` 可暂停或重试摄像头，按 `H` 隐藏说明，按 `Esc` 退出。遇到问题时直接看下面的 **Troubleshooting**，不会因为摄像头不可用而无法完成演示。

## What the prototype includes

- Live one-hand tracking with OpenCV and MediaPipe
- Hand-open / hand-closed estimation, normalised for hand size
- Soft spring deformation and visible rebound
- A squish meter, tracking status, expressive face, and celebratory particles
- Automatic keyboard/mouse fallback
- Resizable Pygame window
- No photos or video frames are saved

## Quick start with `uv`

### 1. Open the project in Codex

Open this `SQUISH` folder as your project. In Codex, use **Open Folder** and choose the folder containing this README. Then open the built-in terminal.

### 2. Install everything

Run this once from the `SQUISH` folder:

```bash
uv sync
```

`uv` creates an isolated `.venv` and installs Python 3.12 plus the tested OpenCV 4.x / MediaPipe 0.10.21 combination, Pygame, and the test tools. You do not need to activate the environment manually.

If `uv` is not installed, install it from [docs.astral.sh/uv](https://docs.astral.sh/uv/) or run `brew install uv` on macOS.

### 3. Start SQUISH!

```bash
uv run python run_squish.py
```

The first camera launch on macOS may show a privacy prompt. Choose **Allow**. If no prompt appears and the camera stays unavailable, enable camera access for Codex (or Terminal) in **System Settings → Privacy & Security → Camera**, then restart the app.

To test without a camera:

```bash
uv run python run_squish.py --no-camera
```

## Controls

| Input | Result |
|---|---|
| Open hand | Release and rebound |
| Closed fist | Squish |
| Hold `Space` or left mouse | Manual squish |
| Arrow keys | Gradually adjust squish |
| `C` | Pause or restart camera |
| `H` | Hide/show instructions |
| `R` | Reset the blob |
| `Esc` or `Q` | Quit |

Keyboard and mouse input temporarily take priority over the camera, so you can demonstrate both modes during one run.

## Troubleshooting

**The camera status says “unavailable.”** The app is still usable. Try `C`, check macOS camera permission, close other camera apps, or run `uv run python run_squish.py --camera-index 1` if you have a second camera.

**The hand signal feels jumpy.** Keep one hand visible, face the palm toward the camera, use even lighting, and keep your wrist and fingertips inside the frame. The prototype smooths the reading but intentionally stays responsive.

**The wrong gesture is detected.** Start with a clearly open palm, then make a clear fist. This version estimates openness from fingertip distances; unusual hand angles can confuse it. That limitation is documented honestly in `PROCESS.md`.

**A package fails to install.** Confirm that `uv run python --version` reports Python 3.11 or 3.12. The project intentionally excludes Python 3.13 because MediaPipe wheel support varies by platform.

## Check that the code works

```bash
uv run pytest
```

These tests cover the gesture score, range mapping, invalid input, and spring movement without needing a webcam or display.

## Project map

```text
SQUISH/
├── src/squish/app.py       # Pygame window, drawing, input and animation
├── src/squish/camera.py    # OpenCV camera and MediaPipe tracking
├── src/squish/gesture.py   # Gesture maths and rebound spring
├── run_squish.py           # Reliable beginner-friendly launch file
├── tests/test_gesture.py   # Camera-free logic tests
├── PROCESS.md              # Design process and honest trial template
├── CREDITS.md              # Libraries, references, and authorship notes
└── pyproject.toml          # Python and dependency setup
```

## Sensible next steps

Keep the submitted version focused. If the core interaction is reliable, one optional extension is to let the user choose between two blob colours. Avoid adding accounts, saved galleries, multiple scenes, or complex menus before the hand interaction has been observed with real users.

## Git checkpoint plan

The repository uses small, explainable checkpoints. Continue in this style:

1. `chore: set up uv project and pure interaction logic`
2. `feat: add webcam tracking and squishy visual experience`
3. `docs: add beginner guide process template and credits`
4. After a real trial: `docs: record user trial observations`
5. After improvements: `fix: tune gesture thresholds from trial feedback`

Do not claim steps 4 or 5 until they actually happen.


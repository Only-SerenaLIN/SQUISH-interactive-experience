# SQUISH!

Public repository: <https://github.com/Only-SerenaLIN/SQUISH-interactive-experience>

**SQUISH!** is a small interactive digital stress-toy collection. With one hand, close your fist to squash the selected toy and open it to release. With two hands, move your palms together to squeeze it from both sides and move them apart to rebound. If the camera is unavailable, the complete interaction still works with the keyboard or mouse.

This is a deliberately manageable Assignment 3 prototype: one clear interaction, immediate visual feedback, a strong visual identity, and enough technical depth to demonstrate webcam-based embodied input without turning the project into a large game.

![SQUISH preview](docs/preview.png)

Two-hand mode changes the deformation direction: the toy narrows horizontally and bulges upward as both hands move together.

![Cyber Apple in two-hand side-squeeze mode](docs/two-hand-preview.png)

The crispy variety has staged feedback: fine cracks appear under pressure, the shell bursts to reveal a soft core, and releasing the toy regrows its shell.

![Crispy Peach after the shell breaks](docs/crispy-preview.png)

The supermarket ramen pack adds an audio-visual payoff: light squeezes crinkle the wrapper, then a strong two-hand squeeze arms the seam. Pulling the hands apart tears it open with a generated pop sound and a random surprise. Possible results include double noodles, a seasoning storm, an empty bag, a golden noodle, and a rare Cyber Apple cameo. No downloaded sound file is needed.

![Ramen pack under pressure](docs/ramen-preview.png)

![Ramen pack after it pops](docs/ramen-burst-preview.png)

The enhanced supermarket interaction adds anticipation before the burst and a different result after it.

![Ramen pack armed and waiting for a pull-apart gesture](docs/ramen-tear-preview.png)

![Random double-noodle surprise](docs/ramen-surprise-preview.png)

## 中文三步启动

1. 在 Codex 中选择 **Open Folder**，打开这个 `SQUISH` 文件夹，再打开内置终端。
2. 第一次运行 `uv sync`，等待依赖安装完成。
3. 运行 `uv run python run_squish.py`。看到摄像头权限提示时选择允许；张开手会让角色回弹，握拳会把它压扁。

如果暂时不想开摄像头，运行 `uv run python run_squish.py --no-camera`，然后按住空格键或鼠标左键。按 `C` 可暂停或重试摄像头，按 `H` 隐藏说明，按 `Esc` 退出。遇到问题时直接看下面的 **Troubleshooting**，不会因为摄像头不可用而无法完成演示。

## What the prototype includes

- Live one-hand and two-hand tracking with OpenCV and MediaPipe
- Hand-open / hand-closed estimation, normalised for hand size
- Horizontal two-palm distance mapped to side pressure
- Four tactile variations built around the same interaction: slow **Cyber Apple**, bouncy **Soft Blob**, breakable **Crispy Peach**, and noisy **Ramen Pack**
- Per-toy spring deformation, staged cracking, wrapper crinkles, fragments, visible rebound, and automatic repair
- Procedurally generated crinkle and pop sounds, with mute and audio-unavailable feedback
- Squeeze-then-pull two-hand packet opening, pre-burst warning, screen shake, flash, random contents, changing flavours, and a session pop counter
- A squish meter, tracking status, expressive faces, and celebratory particles
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
| Two hands moving together/apart | Horizontal squeeze/release; on Ramen Pack, squeeze until prompted and pull apart to tear |
| Hold `Space` or left mouse | Manual squish |
| Hold, then release `Shift + Space` | Manual horizontal squeeze; tears an armed Ramen Pack |
| Arrow keys | Gradually adjust squish |
| `1`, `2`, `3`, `4` | Select Cyber Apple, Soft Blob, Crispy Peach, or Ramen Pack |
| `Tab` | Move to the next toy |
| `M` | Mute/unmute sound |
| `C` | Pause or restart camera |
| `H` | Hide/show instructions |
| `R` | Reset the current toy |
| `Esc` or `Q` | Quit |

Keyboard and mouse input temporarily take priority over the camera, so you can demonstrate both modes during one run.

## Troubleshooting

**The camera status says “unavailable.”** The app is still usable. Try `C`, check macOS camera permission, close other camera apps, or run `uv run python run_squish.py --camera-index 1` if you have a second camera.

**The hand signal feels jumpy.** Keep one hand visible, face the palm toward the camera, use even lighting, and keep your wrist and fingertips inside the frame. The prototype smooths the reading but intentionally stays responsive.

**The wrong gesture is detected.** For one-hand mode, start with a clearly open palm, then make a clear fist. For two-hand mode, keep both palms visible and move them horizontally together or apart. Unusual angles, overlap, or a hand leaving the frame can confuse tracking. That limitation is documented honestly in `PROCESS.md`.

**A package fails to install.** Confirm that `uv run python --version` reports Python 3.11 or 3.12. The project intentionally excludes Python 3.13 because MediaPipe wheel support varies by platform.

**There is no sound.** Press `M` and check the control panel for `sound ON`. If it says `sound unavailable`, the computer did not provide an audio output device; the complete visual interaction still works.

## Check that the code works

```bash
uv run pytest
```

These tests cover the one-hand gesture score, two-hand distance mapping, deliberate pull-apart detection, range mapping, invalid input, and spring movement without needing a webcam or display.

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

## Assignment fit (15 marks)

| Criterion | Evidence in this repository |
|---|---|
| Interaction and design — 5 | One-hand closure controls vertical squish; two-hand distance controls horizontal compression and a squeeze-then-pull gesture opens the ramen pack. The meter, prompts, expression, cracks, particles, generated sound, random reveal, and rebound make the result legible. |
| Working implementation — 4 | Reproducible `uv` setup, pinned compatible camera libraries, camera-free fallback, automated logic tests, and documented limitations. |
| Usability and iteration — 3 | Visible controls, camera status, reset/quit paths, denied-camera fallback, and a trial procedure in `PROCESS.md`. **The real user trial is still required.** |
| Process and communication — 3 | README screenshots, process decisions, AI-use record, credits, and a multi-commit Git history. |

The work is due **Sunday 1 November 2026 at 23:59 Hong Kong time**. Before submitting, conduct the required real user trial, record one evidence-based decision in `PROCESS.md`, push that commit, and test the public GitHub URL while signed out.

## Sensible next steps

Keep the submitted version focused. The four varieties change the tactile response but do not add separate scenes, scores, accounts, or menus. Prioritise the required user trial and tuning over adding more toys.

## Git checkpoint plan

The repository uses small, explainable checkpoints. Continue in this style:

1. `chore: set up uv project and pure interaction logic`
2. `feat: add webcam tracking and squishy visual experience`
3. `docs: add beginner guide process template and credits`
4. After a real trial: `docs: record user trial observations`
5. After improvements: `fix: tune gesture thresholds from trial feedback`

Do not claim steps 4 or 5 until they actually happen.


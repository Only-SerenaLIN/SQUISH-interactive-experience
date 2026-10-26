# SQUISH!

Public repository: <https://github.com/Only-SerenaLIN/SQUISH-interactive-experience>

**SQUISH!** is a webcam-based augmented-reality co-creation experience built around a glossy, translucent 3D hydrogel ball. The mirrored live camera becomes the background and the ball follows the midpoint between two detected palms. Bring the palms together to flatten it, rub them in opposite vertical directions to roll it round again, and release pressure to create a visual ripple and generated musical chord.

The default **Ripple Jelly** mode is the focused Assignment 3 experience. Earlier Cyber Apple, Soft Blob, Crispy Peach, and Ramen Pack studies remain available as development experiments. If the camera is unavailable, the complete main interaction still works with the keyboard or mouse.

![Camera Gel during a squeeze in privacy-safe fallback mode](docs/ripple-jelly-squeeze.png)

Three collaborators produce different coloured layers. Light, medium, and deep pressure create equal-status wave qualities rather than a score hierarchy.

![Camera Gel after releasing a shared wave](docs/ripple-jelly-release.png)

The documentation screenshots use the camera-free fallback background so no person's image is committed to the public repository. During normal use, this background is replaced by the mirrored live camera feed; frames are never saved or uploaded.

![3D jelly flattened by pressure](docs/3d-jelly-flatten.png)

![3D jelly rolled back into a sphere](docs/3d-jelly-roll-round.png)

At maximum pressure, the gel bursts into water droplets and rotating translucent diamond fragments. Releasing the gesture reforms the ball, so the effect cannot retrigger continuously.

![Maximum-pressure diamond splash](docs/diamond-splash.png)

This is a calming interactive artwork, not a medical or therapeutic product.

## Main interaction

```text
two palms approach → jelly flattens → release → ripple and chord
        ↑                                      ↓
        └── opposite rubbing motion → roll round again ─────┘
```

- **Light pressure:** thin ripples and a bright, airy chord
- **Medium pressure:** layered connecting waves and a warm chord
- **Deep pressure:** broad slow waves and a low resonant chord
- Press `N` to hand the experience to collaborator A, B, or C; recent waves overlap on one shared composition
- White palm markers and a connecting line confirm where the system sees the hands; the ball follows their midpoint.

## Earlier tactile studies

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
3. 运行 `uv run python run_squish.py`。看到摄像头权限提示时选择允许；两手靠近把球捏扁，两手上下反向搓动把球搓圆，松手释放波纹和音乐。

如果暂时不想开摄像头，运行 `uv run python run_squish.py --no-camera`，按住空格键捏扁、松开生成波纹，按住 `G` 把球搓圆。按 `N` 交给下一位共创者，按 `C` 暂停或重试摄像头，按 `H` 隐藏说明，按 `Esc` 退出。遇到问题时直接看下面的 **Troubleshooting**，不会因为摄像头不可用而无法完成演示。

## What the prototype includes

- Live one-hand and two-hand tracking with OpenCV and MediaPipe
- Mirrored live-camera background with a 3D ball anchored between the detected palms
- Hand-open / hand-closed estimation, normalised for hand size
- Horizontal two-palm distance mapped to side pressure
- Opposing two-palm motion detection that separates rolling from shared camera drift and horizontal squeezing
- A software-rendered 3D **Ripple Jelly** with rotating projected surface lines, coloured rim, transmitted light, specular highlights, persistent flattening, and roll-to-round recovery
- A one-shot maximum-pressure water splash with rotating faceted diamond fragments, flash, deep ripple, and reform-on-release feedback
- A persistent eight-layer co-creation canvas for three sequential collaborators
- Three pressure qualities mapped to distinct wave geometry and generated ambient chords
- Four earlier tactile studies: **Cyber Apple**, **Soft Blob**, **Crispy Peach**, and **Ramen Pack**
- Per-toy spring deformation, staged cracking, wrapper crinkles, fragments, visible rebound, and automatic repair
- Procedurally generated crinkle and pop sounds, with mute and audio-unavailable feedback
- Squeeze-then-pull two-hand packet opening, pre-burst warning, screen shake, flash, random contents, changing flavours, and a session pop counter
- A squish meter, tracking status, expressive faces, and celebratory particles
- Automatic keyboard/mouse fallback
- Resizable Pygame window
- Camera frames are displayed and processed locally in memory but are never recorded, uploaded, or saved

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
| Open hand | Release, rebound, and leave a wave in Ripple Jelly mode |
| Closed fist | Build pressure while deforming the jelly |
| Two palms moving horizontally together/apart | Flatten/release; on Ramen Pack, squeeze until prompted and pull apart to tear |
| Two palms rubbing vertically in opposite directions | Rotate and roll Ripple Jelly back into a sphere |
| Hold `Space` or left mouse | Manual flatten/squish |
| Hold `G` | Manual roll-round gesture for Ripple Jelly |
| Hold, then release `Shift + Space` | Manual horizontal squeeze; tears an armed Ramen Pack |
| Arrow keys | Gradually adjust squish |
| `1`, `2`, `3`, `4`, `5` | Select Cyber Apple, Soft Blob, Crispy Peach, Ramen Pack, or Ripple Jelly |
| `Tab` | Move to the next toy |
| `N` | Pass Ripple Jelly to the next collaborator |
| `M` | Mute/unmute sound |
| `C` | Pause or restart camera |
| `H` | Hide/show instructions |
| `R` | Reset the current toy; clears the shared Ripple Jelly canvas |
| `Esc` or `Q` | Quit |

Keyboard and mouse input temporarily take priority over the camera, so you can demonstrate both modes during one run.

## Troubleshooting

**The camera status says “unavailable.”** The app is still usable. Try `C`, check macOS camera permission, close other camera apps, or run `uv run python run_squish.py --camera-index 1` if you have a second camera.

**The hand signal feels jumpy.** Keep one hand visible, face the palm toward the camera, use even lighting, and keep your wrist and fingertips inside the frame. The prototype smooths the reading but intentionally stays responsive.

**The ball does not reach the diamond splash.** Keep both palms facing the camera and bring their centres to roughly one hand-width apart. The wider v0.9 pressure range is intentionally more responsive, but very angled palms may still make the measured gap look larger.

**The wrong gesture is detected.** For one-hand mode, start with a clearly open palm, then make a clear fist. To flatten, keep both palms visible and move them horizontally together. To roll round, hold the gap fairly steady while moving one palm up as the other moves down. Unusual angles, overlap, or a hand leaving the frame can confuse tracking. That limitation is documented honestly in `PROCESS.md`.

**A package fails to install.** Confirm that `uv run python --version` reports Python 3.11 or 3.12. The project intentionally excludes Python 3.13 because MediaPipe wheel support varies by platform.

**There is no sound.** Press `M` and check the control panel for `sound ON`. If it says `sound unavailable`, the computer did not provide an audio output device; the complete visual interaction still works.

## Check that the code works

```bash
uv run pytest
```

These tests cover the one-hand gesture score, two-hand distance mapping, opposite-motion roll detection, deliberate pull-apart detection, pressure bands, range mapping, invalid input, and spring movement without needing a webcam or display.

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
| Interaction and design — 5 | Hand closure builds pressure in a translucent jelly; release generates visibly different persistent ripples and musical chords. Breathing prompts, deformation, pressure text, collaborator identity, wave count, sound, and rebound make the loop legible. |
| Working implementation — 4 | Reproducible `uv` setup, pinned compatible camera libraries, camera-free fallback, automated logic tests, and documented limitations. |
| Usability and iteration — 3 | Visible controls, camera status, reset/quit paths, denied-camera fallback, and a trial procedure in `PROCESS.md`. **The real user trial is still required.** |
| Process and communication — 3 | README screenshots, process decisions, AI-use record, credits, and a multi-commit Git history. |

The work is due **Sunday 1 November 2026 at 23:59 Hong Kong time**. Before submitting, conduct the required real user trial, record one evidence-based decision in `PROCESS.md`, push that commit, and test the public GitHub URL while signed out.

## Sensible next steps

Keep the submitted version focused on Camera Gel. The four earlier varieties document exploration but should not replace testing and refining hand alignment, gesture thresholds, release feedback, sound balance, and collaborator handoff.

## Git checkpoint plan

The repository uses small, explainable checkpoints. Continue in this style:

1. `chore: set up uv project and pure interaction logic`
2. `feat: add webcam tracking and squishy visual experience`
3. `docs: add beginner guide process template and credits`
4. After a real trial: `docs: record user trial observations`
5. After improvements: `fix: tune gesture thresholds from trial feedback`

Do not claim steps 4 or 5 until they actually happen.


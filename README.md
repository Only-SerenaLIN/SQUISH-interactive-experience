# Jellyfish Grove（水母之森）

一个浏览器里的温柔深海生态缸。巨大的母水母位于世界顶部，发光触须向下生长为整座栖息地的中央树干；小水母会自由漫游、轮流休息和玩耍，把产生的浮光缓慢送回母体。玩家用浮光让贝壳、滑梯和新的小水母逐步生长出来。

这是按照 `JELLYFISH_GROVE_PLAN.md` 完成的第一阶段核心版本。它使用原生 HTML、CSS 和 Canvas，不需要安装第三方前端依赖。

## 一分钟启动

```bash
cd web
python3 -m http.server 4173
```

然后在浏览器打开 <http://127.0.0.1:4173/>。直接双击 `index.html` 也能显示页面，但建议使用本地服务器，以确保 ES Module 正常加载。

## 第一阶段怎么玩

- 初始有 35 点浮光和一只蓝水母；浮光会随时间自动增加。
- 花费 30 点建造贝壳休息台，解锁粉色害羞水母。
- 花费 150 点建造水母滑梯，解锁金色活泼水母。
- 母水母每次消耗 50 点浮光孕育一只新水母。
- 拖动画面探索纵向世界；滚轮平移，`Ctrl/⌘ + 滚轮` 或工具按钮缩放。
- 点击小水母会触发凹陷、回弹和性格反应；拖动它到栖息地可安排游玩。
- 进度每 5 秒保存到浏览器，本次也包含最多四小时的离线浮光收益。

## 浏览器项目结构

- `web/index.html`：游戏界面与 HUD
- `web/styles.css`：玻璃质感界面与响应式布局
- `web/config.js`：经济数值、品种和栖息地配置
- `web/app.js`：生态状态机、绘制、输入、存档和声音
- `JELLYFISH_GROVE_PLAN.md`：阶段清单和后续范围

原有 Python 摄像头作品仍保留在 `src/`、`tests/` 和 `run_squish.py` 中，本次没有删除；网页入口已更新为新的水母之森第一阶段。

---

## Legacy SQUISH prototype

Public repository: <https://github.com/Only-SerenaLIN/SQUISH-interactive-experience>

## 浏览器作品：《不可触摸的柔软》

项目现在包含一个独立的浏览器水母缸。用本地静态服务器打开 `web/index.html`，无需安装 Python。上层捏动粉色母水母，拉出不同品种的幼体；下潜到连成一体的珊瑚乐园，看小水母轮流在贝壳、滑梯和月光拱门玩耍。它们散发的微光像海中萤火虫，缓缓飘回母体；微光可以培育栖息地、增加缸中容量。

**鼠标／触屏：** 拖动母体并松开生出幼体，触碰幼体会回弹；双指拖动画面下潜，双指张合缩放地图，也可用「母水母 · 上层／栖息地 · 下潜」按钮导航。点击栖息地底部的培育按钮升级。首次进入会显示手势教程，「存档」可立即保存、导出或导入进度；平时每 4 秒自动存档。

**可选摄像头：** 单手拇指与食指捏合后拖出幼体，或夹住幼体移动；伸出食指逗弄它们及母体触须。双手同时入镜可缩放、平移地图。开启摄像头时可在深海背景与实时画面之间自由切换。Handsfree.js 8.5.1 和手部模型需要联网加载；视频只在浏览器本地处理，不录制、不保存、不上传。实际识别效果受光线与摄像头角度影响。

- `web/index.html`：网页作品入口
- `web/assets/connected-reef.png`：一体化珊瑚乐园插画
- `WEB_ART_DIRECTION.md`：完整艺术设计与交互规格
- 网页快捷键：`Space` 按压、`C` 摄像头、`M` 静音、`R` 清除触碰记忆

网页版本与下方的 Python 摄像头版本彼此独立，不会改变原有演示的运行方式。

**SQUISH!** is a webcam-based augmented-reality co-creation experience built around a glossy, translucent 3D hydrogel ball. The mirrored live camera becomes the background and the ball follows the midpoint between two detected palms. Bring the palms together from any angle to compress it along the palm-to-palm line, rub them in opposite directions across that line to roll it round again, and release pressure to create a visual ripple and generated musical chord.

The default **Ripple Jelly** mode is the focused Assignment 3 experience. Earlier Cyber Apple, Soft Blob, Crispy Peach, and Ramen Pack studies remain available as development experiments. If the camera is unavailable, the complete main interaction still works with the keyboard or mouse.

![Camera Gel during a squeeze in privacy-safe fallback mode](docs/ripple-jelly-squeeze.png)

The gel is treated as approximately incompressible. Pressure shortens the live force axis while displaced volume expands perpendicular to it and into the implied depth axis; a pressure-dependent superellipse creates flatter contact patches against the palms. The outline, projected 3D mesh, refraction, and rim all follow this axis. One-hand, two-hand, mouse, and keyboard input feed the same deformation model.

| Side compression | Top/bottom compression | Diagonal compression |
|---|---|---|
| ![Gel narrowed by side pressure](docs/squeeze-horizontal.png) | ![Gel flattened by top and bottom pressure](docs/squeeze-vertical.png) | ![Gel compressed on a diagonal axis](docs/squeeze-diagonal.png) |

Three collaborators produce different coloured layers. Light, medium, and deep pressure create equal-status wave qualities rather than a score hierarchy.

![Camera Gel after releasing a shared wave](docs/ripple-jelly-release.png)

The documentation screenshots use the camera-free fallback background so no person's image is committed to the public repository. During normal use, this background is replaced by the mirrored live camera feed; frames are never saved or uploaded.

![3D jelly flattened by pressure](docs/3d-jelly-flatten.png)

![3D jelly rolled back into a sphere](docs/3d-jelly-roll-round.png)

The gel does not burst immediately at maximum pressure. Pressure must remain above 93% for about 1.25 seconds while a pink crystallisation bar fills. Dropping the pressure makes that progress retreat; a full release resets it. Only a completed hold produces water droplets and rotating translucent diamond fragments.

![Delayed crystallisation before the burst](docs/crystallising-delay.png)

![Maximum-pressure diamond splash](docs/diamond-splash.png)

This is a calming interactive artwork, not a medical or therapeutic product.

## Main interaction

```text
palm-to-palm axis + approach → directional squash → release → ripple and chord
              ↑                                           ↓
              └── tangential opposite rubbing → roll round again ─────┘
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
3. 运行 `uv run python run_squish.py`。看到摄像头权限提示时选择允许；两手从左右、上下或斜向靠近，球会沿两手连线被压短并向受力轴的垂直方向鼓起。沿受力轴的切线方向反向搓动可把球搓圆，松手释放波纹和音乐。

如果暂时不想开摄像头，运行 `uv run python run_squish.py --no-camera`，按住空格键捏扁、松开生成波纹，按住 `G` 把球搓圆。按 `N` 交给下一位共创者，按 `C` 暂停或重试摄像头，按 `H` 隐藏说明，按 `Esc` 退出。遇到问题时直接看下面的 **Troubleshooting**，不会因为摄像头不可用而无法完成演示。

## What the prototype includes

- Live one-hand and two-hand tracking with OpenCV and MediaPipe
- Mirrored live-camera background with a 3D ball anchored between the detected palms
- Hand-open / hand-closed estimation, normalised for hand size
- Direct two-palm distance mapped to pressure at any hand angle
- Live palm-to-palm force-axis tracking with smoothed side, top/bottom, and diagonal deformation
- Tangential opposing-palm motion detection that separates rolling from camera drift and radial squeezing
- A software-rendered 3D **Ripple Jelly** with rotating projected surface lines, coloured rim, transmitted light, specular highlights, volume-preserving directional compression, flat contact patches, and roll-to-round recovery
- A 1.25-second near-maximum-pressure hold before the one-shot water splash, with visible crystallisation progress, rollback on lost pressure, rotating faceted diamonds, and reform-on-release feedback
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
| Two palms moving together/apart from any angle | Compress along the line between the palms, then release; on Ramen Pack, squeeze until prompted and pull apart to tear |
| Two palms rubbing in opposite directions across their connecting line | Rotate and roll Ripple Jelly back into a sphere |
| Hold `Space` or left mouse | Manual top/bottom compression |
| Hold `G` | Manual roll-round gesture for Ripple Jelly |
| Hold, then release `Shift + Space` | Manual side compression; tears an armed Ramen Pack |
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

**The ball does not reach the diamond splash.** Keep both palms facing the camera and bring their centres to roughly one hand-width apart. When `HOLD STEADY` appears, maintain the pressure until crystallisation reaches 100%. Moving below 93% makes the progress retreat, so an unstable or angled pose may need adjustment.

**The wrong gesture is detected.** For one-hand mode, start with a clearly open palm, then make a clear fist. With two hands, keep both palm centres visible and move them together along their connecting line. To roll round, hold the gap fairly steady while moving both palms in opposite directions perpendicular to that line. Overlap or a hand leaving the frame can confuse tracking. That limitation is documented honestly in `PROCESS.md`.

**A package fails to install.** Confirm that `uv run python --version` reports Python 3.11 or 3.12. The project intentionally excludes Python 3.13 because MediaPipe wheel support varies by platform.

**There is no sound.** Press `M` and check the control panel for `sound ON`. If it says `sound unavailable`, the computer did not provide an audio output device; the complete visual interaction still works.

## Check that the code works

```bash
uv run pytest
```

These tests cover the one-hand gesture score, angle-independent two-hand distance mapping, direction labels, tangent-versus-radial roll detection, volume-preserving deformation, delayed burst charging and rollback, deliberate pull-apart detection, pressure bands, range mapping, invalid input, and spring movement without needing a webcam or display.

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
| Interaction and design — 5 | Hand pressure reshapes a translucent 3D jelly; release generates visibly different persistent ripples and musical chords. Palm guides, physical deformation, delayed crystallisation, pressure text, collaborator identity, wave count, sound, and rebound make the loop legible. |
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


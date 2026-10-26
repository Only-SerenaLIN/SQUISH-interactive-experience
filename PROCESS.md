# SQUISH! — Process Journal

> This file separates completed work from planned work. The user-trial section is intentionally blank because no user test has been conducted yet.

## 1. Concept

SQUISH! turns breathing and a familiar stress-toy gesture into a shared visual composition. A participant follows a gentle prompt, closes one hand to compress a translucent jelly, and opens it to release a pressure-shaped ripple and musical chord. The next participant adds another layer to the same canvas.

### One-sentence pitch

Breathe with a translucent jelly, squeeze it gently, and leave a ripple for the next person.

### Target audience

- Students taking short breaks while working at a computer
- Exhibition visitors who should understand the interaction without a tutorial
- People curious about playful, low-stakes camera interaction

This is a calming creative prototype, not a medical or therapeutic product.

## 2. Design goals

1. **Immediate legibility:** the blob should visibly follow the user's hand within a fraction of a second.
2. **Satisfying motion:** compression should feel elastic, with overshoot and rebound rather than a rigid resize.
3. **Calm personality:** translucency, slow breathing motion, persistent waves, and gentle chords should communicate an instrument rather than a game.
4. **Graceful failure:** camera problems should never prevent someone from trying the core experience.
5. **Manageable scope:** one polished interaction is more important than many unfinished features.

## 3. Core interaction loop

```text
show hand(s) → system estimates openness or palm gap → toy deforms → status confirms input
     ↑                                                   ↓
     └──────────── user changes hand after feedback ─────┘
```

With one hand, the program calculates an openness value from 0 to 1 and inverts it into a pressure target. A spring animation eases the jelly toward the target. The highest pressure in a squeeze determines the released wave's amplitude, ring count, line weight, and chord register. The wave persists and overlaps contributions from collaborators A, B, and C. Earlier modes also retain the two-hand horizontal-distance experiment.

## 4. Visual direction

- Pale atmospheric background with cyan, violet, and pink collaborator colours
- Layered alpha surfaces create a translucent jelly body with internal light points
- Breathing makes the body rise and expand before pressure deformation begins
- A pressure meter exposes the otherwise invisible gesture value
- Wavy elliptical contours persist and overlap instead of rewarding a high score

## 5. Implemented feature scope

### Must-have — completed

- [x] Pygame window and responsive layout
- [x] OpenCV webcam capture
- [x] MediaPipe single-hand landmarks
- [x] Hand openness estimate
- [x] Smoothed gesture signal
- [x] Spring-based deformation and rebound
- [x] On-screen input/status feedback
- [x] Keyboard and mouse fallback
- [x] Camera pause/retry control
- [x] Camera-free automated tests for core maths
- [x] Four selectable tactile responses using the same input loop
- [x] Progressive cracks, shell burst, soft core, and automatic repair
- [x] Two-hand horizontal squeeze with distinct deformation feedback
- [x] `Shift + Space` camera-free demonstration of two-hand mode
- [x] Supermarket ramen pack with pressure wrinkles, burst state, and noodle debris
- [x] Procedurally generated crinkle/pop audio, mute control, and silent fallback
- [x] Squeeze-then-pull two-hand packet opening with a camera-free keyboard equivalent
- [x] Pre-burst warning, shake/flash feedback, changing flavours, random contents, and pop counter
- [x] Default Ripple Jelly breathing and co-creation mode
- [x] Translucent deforming jelly with internal glow and floating light points
- [x] Light, medium, and deep pressure-to-wave mappings
- [x] Three procedurally generated chord registers that can overlap
- [x] 4-2-6 breathing guide with non-punitive wording
- [x] Three-person sequential handoff and persistent eight-wave canvas

### Optional — not implemented

- [ ] Colour selection
- [ ] User-adjustable sound volume

These remain optional so that testing and refinement can focus on the main gesture.

## 6. Technical decisions

| Decision | Reason | Trade-off |
|---|---|---|
| MediaPipe Hands | Provides landmarks without training a model | Extreme angles and low light can reduce accuracy |
| Distance-based openness | Simple enough to explain and tune | Less robust than a trained gesture classifier |
| Exponential signal smoothing | Reduces landmark jitter | Adds a small amount of lag |
| Spring animation | Creates a soft rebound from a single number | Needs careful tuning to avoid excessive wobble |
| Lazy camera imports/fallback | Keeps the artwork usable when camera access fails | Camera errors are shown as status text rather than a setup wizard |
| Generated sound in memory | Adds tactile feedback without borrowed assets or missing files | It is deliberately short and synthetic rather than realistic |
| Sequential co-creation | Works with one camera and keeps each contribution visible | Participants take turns rather than appearing simultaneously |
| Three equal pressure qualities | Makes different gestures expressive without rewarding force | Thresholds may need tuning for different hands |

### Privacy note

Camera frames are processed in memory and are not displayed, recorded, uploaded, or saved by this project.

## 7. Development log

### Prototype 0.1 — implemented

- Created a Python package managed with `uv`.
- Isolated gesture calculation and spring motion so they can be tested without a camera.
- Added live camera tracking with clear state messages.
- Drew the character procedurally in Pygame, avoiding external artwork dependencies.
- Added manual controls so the interaction can always be demonstrated.
- Added beginner-facing setup and troubleshooting guidance.

### Prototype 0.2 — implemented after visual-reference discussion

- Reframed the original purple blob as a small tactile collection without changing the core loop.
- Added a glossy green apple with slower, calmer rebound.
- Added a crispy peach whose shell visibly cracks in three stages before bursting.
- Added a soft inner core and an automatic repair state when the user releases.
- Added number-key selection and distinct stiffness/damping for each variety.
- Kept all visuals procedural; no imagery was copied from the reference post.

### Prototype 0.3 — two-hand interaction

- Increased MediaPipe tracking from one to two hands.
- Mapped the normalised distance between palm centres to side pressure.
- Made horizontal pressure visibly narrow and raise the toy instead of reusing the one-hand flattening animation.
- Added a dedicated status message, meter label, on-screen instruction, keyboard fallback, screenshot, and automated mapping test.

### Prototype 0.4 — supermarket ramen and sound

- Added a fourth toy shaped like a supermarket instant-noodle packet.
- Connected increasing pressure to visible wrapper wrinkles and three short crinkle sounds.
- Added a higher burst threshold that tears the packet open, reveals a drawn noodle cake, launches crumbs, and plays a pop/crunch sound.
- Generated all audio from code at launch instead of adding a downloaded recording.
- Added `M` mute control and visible `sound unavailable` feedback so audio-device failure never blocks the experience.

### Prototype 0.5 — anticipation and surprise

- Changed the two-hand ramen interaction from an automatic pressure threshold into a short sequence: squeeze until the seam is armed, then pull both hands apart to tear it open.
- Added explicit `PULL HANDS APART!` feedback and a `Shift + Space` equivalent so the sequence is demonstrable without a camera.
- Added increasingly nervous expressions, screen shake, a flash, and a brief reward label to make the moment of rupture easier to anticipate and read.
- Added rotating fictional supermarket flavours and weighted random contents: normal noodles remain common, while double noodles, seasoning, an empty packet, a golden noodle, and a Cyber Apple cameo are surprises.
- Added a small `PACKS POPPED` counter and a replacement packet that slides onto the shelf after release. This encourages repetition without introducing scoring or a win/lose state.
- Added an automated test for the pull-apart detector. Visual states were checked in camera-free mode; live participant testing is still outstanding.

### Prototype 0.6 — Breathe & Ripple co-creation

- Reframed the primary experience around a translucent jelly instrument rather than object destruction.
- Added a repeating inhale, comfortable hold, and exhale prompt; timing variation never produces a failure state.
- Mapped the strongest pressure in each squeeze to light, medium, or deep wave geometry and to a generated chord register.
- Kept the eight most recent waves visible so three sequential collaborators can build one shared composition.
- Added `N` handoff, collaborator colours, a shared-wave count, keyboard fallback, and a clear-canvas reset.
- Retained the four earlier toys as visible development experiments while making Ripple Jelly the launch default.
- **0.6.1 material polish:** replaced the misty oval jelly with a rounder hydrogel-ball treatment after reviewing a user-supplied material reference. A saturated rim, transparent centre, sharp offset highlights, lower refraction colour, and a soft contact shadow make the squeeze response read more clearly. The reference image itself is not included or copied into the program.
- Added automated tests for pressure classification and breathing phase timing.

### Prototype 0.7 — 3D roll and flatten

- Rebuilt the jelly presentation as a software-projected 3D volume. A sparse front-facing sphere mesh rotates beneath the translucent material, so the ball communicates depth without adding an OpenGL dependency.
- Added a second two-hand relationship: horizontal palm distance flattens the ball, while opposite vertical palm movement is recognised as rolling it round.
- Reduced false rolling triggers by largely ignoring opposite horizontal motion, since that motion belongs to the flatten gesture.
- Added short-lived shape memory: a flattened ball relaxes only slowly, while a deliberate rolling gesture restores its roundness quickly.
- Added visible `FLATTENING` and `ROLLING ROUND` feedback plus a form-roundness percentage.
- Added `G` as the camera-free roll-round control and kept `Space` as the flatten/release control.
- Added an automated comparison proving that opposite palm motion scores highly while shared camera drift does not. Live participant testing is still outstanding.

### AI collaboration record

OpenAI Codex was used to scaffold the Python project, implement and test the camera/fallback loop, propose visual feedback, and draft documentation. A suggestion that was **kept** was separating the gesture maths from the Pygame drawing code, because it makes the input-to-response logic testable without a webcam. An early suggestion to add only simple colour choices was **changed** after the student supplied tactile references: later variants change rebound, fracture, ripple geometry, and sound rather than decoration alone. A first proposal to omit audio was later **rejected** after the student requested sound; the revised design generates sounds in memory and preserves a silent fallback. A points-based game direction was **rejected** in favour of equal-status pressure qualities and a shared generative canvas, because the student wanted a calmer co-creative experience.

The student must review this account, edit it into their own voice, and ensure it matches the final work before submission.

### Known limitations before user testing

- Hand openness is heuristic and may vary with hand angle, lighting, and distance.
- Two-hand distance is measured horizontally and rolling is estimated from frame-to-frame opposite vertical motion, so overlap, low frame rate, or strong camera angles can confuse it.
- Sound depends on the computer providing an output device; visual feedback remains complete without it.
- The breathing prompt offers a visual rhythm but is not health guidance; participants can release at any time.
- Co-creation is sequential on one device, not networked or simultaneous.
- Camera access must be granted to the app that launches the Python process.
- The visual design has been checked programmatically and by the developer, not evaluated by external users.
- The brittle shell and ramen burst are playful simulations, not physically realistic.

## 8. User trial — not conducted yet

**Status:** No participant session has been conducted. Do not replace this statement with invented evidence.

### Suggested lightweight procedure

1. Ask one participant to start the program using only the README.
2. Do not explain the gesture for the first 20 seconds.
3. Ask them to make one full squish and release.
4. If the camera fails, observe whether they discover the fallback.
5. Ask three short questions: “What did you think your hand controlled?”, “What felt satisfying or confusing?”, and “What would you change first?”
6. Record observations, not assumptions.

### Trial record template

- Date:
- Participant code (no real name needed):
- Device / lighting conditions:
- Was camera permission already granted?:
- Could the participant start the program without help?:
- Could the participant discover the main gesture?:
- Could the participant recover if tracking failed?:
- Direct observation notes:
- Participant comments (quote only with permission):
- Most important issue:
- Change proposed from the evidence:

### Results

_Intentionally left blank until a real trial is completed._

### Required iteration commit after the trial

After recording the observation, make one justified change (or clearly explain why the evidence supports keeping the design) and commit it separately, for example: `fix: make crispy shell reset clearer after user trial`. This commit does not exist yet.

## 9. Assignment submission checklist

- [x] Working source and procedural assets are included.
- [x] Exact `uv` setup and run commands are documented.
- [x] Camera denial/unavailability has a keyboard and mouse fallback.
- [x] README includes screenshots, intended audience, interaction, and limitations.
- [x] AI assistance, kept/changed suggestions, and credits are documented.
- [x] Development history contains multiple meaningful commits.
- [ ] At least one other person has tried the experience.
- [ ] Observation and one resulting decision are recorded above.
- [ ] The post-trial change/decision is committed and pushed.
- [ ] The public GitHub repository opens while signed out.
- [ ] The repository URL is submitted to Canvas before 23:59 HKT on 1 November 2026.

## 10. Reflection prompts for submission

After the real trial, answer these in your own voice:

- Which visual detail most helped the interaction feel “squishy”?
- Where did the participant's mental model differ from the program?
- What did you simplify, and why did that improve the project?
- What would you test next if you had one more week?


# SQUISH! — Process Journal

> This file separates completed work from planned work. The user-trial section is intentionally blank because no user test has been conducted yet.

## 1. Concept

SQUISH! turns a familiar physical stress-relief action into a screen-based interaction. A person opens and closes one hand; a soft character releases and compresses in response. The project aims to make computer vision feel playful and immediately understandable rather than technical.

### One-sentence pitch

Squeeze a cheerful digital blob with your hand, then watch it wobble back into shape.

### Target audience

- Students taking short breaks while working at a computer
- Exhibition visitors who should understand the interaction without a tutorial
- People curious about playful, low-stakes camera interaction

This is a creative prototype, not a medical or therapeutic product.

## 2. Design goals

1. **Immediate legibility:** the blob should visibly follow the user's hand within a fraction of a second.
2. **Satisfying motion:** compression should feel elastic, with overshoot and rebound rather than a rigid resize.
3. **Calm personality:** soft colours, rounded shapes, a reactive face, and gentle particles should communicate “toy,” not “tool.”
4. **Graceful failure:** camera problems should never prevent someone from trying the core experience.
5. **Manageable scope:** one polished interaction is more important than many unfinished features.

## 3. Core interaction loop

```text
show hand → system estimates openness → blob deforms → status confirms input
     ↑                                                   ↓
     └──────────── user changes hand after feedback ─────┘
```

The program calculates an openness value from 0 to 1. It inverts that value into a squish target, then a spring animation eases the blob toward the target. A closed hand therefore compresses the blob; an open hand lets it rebound.

## 4. Visual direction

- Lavender background with mint and pink accent shapes
- Thick dark outline, like a tactile sticker or vinyl toy
- Face compresses with the body
- Squish meter exposes the otherwise invisible gesture value
- Small colour burst rewards a strong squeeze without becoming a game score

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

### Optional — not implemented

- [ ] Colour selection
- [ ] Sound and haptic-like audio feedback
- [ ] A second squishy character

These remain optional so that testing and refinement can focus on the main gesture.

## 6. Technical decisions

| Decision | Reason | Trade-off |
|---|---|---|
| MediaPipe Hands | Provides landmarks without training a model | Extreme angles and low light can reduce accuracy |
| Distance-based openness | Simple enough to explain and tune | Less robust than a trained gesture classifier |
| Exponential signal smoothing | Reduces landmark jitter | Adds a small amount of lag |
| Spring animation | Creates a soft rebound from a single number | Needs careful tuning to avoid excessive wobble |
| Lazy camera imports/fallback | Keeps the artwork usable when camera access fails | Camera errors are shown as status text rather than a setup wizard |

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

### Known limitations before user testing

- Hand openness is heuristic and may vary with hand angle, lighting, and distance.
- The app tracks one hand only.
- Visual feedback is the only sensory output; there is no sound in this version.
- Camera access must be granted to the app that launches the Python process.
- The visual design has been checked programmatically and by the developer, not evaluated by external users.

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

## 9. Reflection prompts for submission

After the real trial, answer these in your own voice:

- Which visual detail most helped the interaction feel “squishy”?
- Where did the participant's mental model differ from the program?
- What did you simplify, and why did that improve the project?
- What would you test next if you had one more week?


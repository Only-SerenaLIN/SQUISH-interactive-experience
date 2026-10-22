# SQUISH! — Process Journal

> This file separates completed work from planned work. The user-trial section is intentionally blank because no user test has been conducted yet.

## 1. Concept

SQUISH! turns a familiar physical stress-relief action into a screen-based interaction. A person opens and closes one hand; a selected digital toy releases and compresses in response. The project aims to make computer vision feel playful and immediately understandable rather than technical.

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
show hand(s) → system estimates openness or palm gap → toy deforms → status confirms input
     ↑                                                   ↓
     └──────────── user changes hand after feedback ─────┘
```

With one hand, the program calculates an openness value from 0 to 1 and inverts it into a squish target. With two hands, it maps the horizontal gap between palm centres to side pressure. A spring animation eases the toy toward either target. The deformation direction itself is feedback: one hand makes the toy wider/flatter, while two hands make it narrower/taller.

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
- [x] Three selectable tactile responses using the same input loop
- [x] Progressive cracks, shell burst, soft core, and automatic repair
- [x] Two-hand horizontal squeeze with distinct deformation feedback
- [x] `Shift + Space` camera-free demonstration of two-hand mode

### Optional — not implemented

- [ ] Colour selection
- [ ] Sound and haptic-like audio feedback
- [ ] Sound feedback (deliberately deferred)

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

### AI collaboration record

OpenAI Codex was used to scaffold the Python project, implement and test the camera/fallback loop, propose visual feedback, and draft documentation. A suggestion that was **kept** was separating the gesture maths from the Pygame drawing code, because it makes the input-to-response logic testable without a webcam. An early suggestion to add only simple colour choices was **changed** after the student supplied a tactile reference: the final variants change rebound and fracture behaviour, not just decoration. Procedural crack audio was considered and **rejected for this version** because sound-device failure would add setup risk; staged visual cracks and fragments provide the required feedback more reliably.

The student must review this account, edit it into their own voice, and ensure it matches the final work before submission.

### Known limitations before user testing

- Hand openness is heuristic and may vary with hand angle, lighting, and distance.
- The app tracks one hand only.
- Visual feedback is the only sensory output; there is no sound in this version.
- Camera access must be granted to the app that launches the Python process.
- The visual design has been checked programmatically and by the developer, not evaluated by external users.
- The brittle shell is a visual simulation; audio is not included.

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


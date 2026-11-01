# SQUISH — Process Journal

## 1. Starting idea

SQUISH began as an exploration of why soft squeeze toys feel comforting and whether that sensation could become a digital interaction. The first concept, *Softness Without Touch*, asked how a screen could suggest pressure, stretch, delayed movement, and elastic recovery even though the player cannot physically touch the material.

The final project is a browser-based interactive artwork. A player meets a translucent mother jellyfish in a quiet deep-sea environment and can touch, locally squash, and stretch its bell using a mouse, touch screen, or camera-tracked hand. Pulling the bell far enough nurtures a baby jellyfish that separates and begins to swim independently.

### Intended user

The experience is for one person using a desktop browser who wants a short, calm, playful break. It is deliberately not score-driven and is not presented as a medical or therapeutic product.

### Core loop

```text
player touches or pulls
          ↓
the contacted area deforms
          ↓
motion, expression, sound, and text confirm the result
          ↓
the player releases, tries another pressure, or plays with a baby
```

The most important design goal was making the relationship between input and response readable. Local deformation is therefore more important than adding many separate game systems.

## 2. Design development

### Soft material and visual direction

Early versions used a circular gel object surrounded by rings and fingerprint-like marks. The scene gradually changed into a deep-sea world because a jellyfish could unify the translucent material, slow breathing motion, soft tentacles, and autonomous floating.

The final visual direction keeps:

- a pink-purple translucent mother bell;
- small eyes and changing expressions;
- a horizontal flower-like mark on the mother's crown;
- soft tentacles and restrained glow;
- a dark blue sea with limited decorative particles;
- baby jellyfish that share the same visual family while varying in colour and expression.

Strong spinning rings and hard light trails were removed because they made the scene feel layered and visually tiring instead of soft and cohesive.

### Interaction changes

The birth interaction went through several revisions. A baby originally appeared separately or followed a bright connecting line. This felt artificial. The final motion stretches a local piece of the mother's bell, releases it with a small pop, briefly presents the new baby upside down facing the mother, then turns it upright and grows its tentacles. Pull strength also affects baby size.

Mouse and camera input were later converted into the same world-coordinate pointer state. This allows both modes to use the same deformation and baby behavior rather than maintaining two different interaction systems. Camera permission is optional; mouse and touch remain available when tracking fails.

## 3. Important code and design decisions

| Decision | Reason | Trade-off |
|---|---|---|
| Spring-based local bell contour | A contact point can dent and stretch without scaling the whole character | More tuning than a simple CSS transform |
| One unified pointer state | Mouse, touch, and camera gestures produce consistent behavior | Camera coordinates need smoothing and mirroring |
| Procedural Web Audio | Soft feedback works without shipping borrowed audio files | Sound is synthetic and varies by browser |
| Generated deep-sea ambience | The atmosphere can continue indefinitely without an external music asset | It starts only after browser user activation |
| LocalStorage save with backup | Refreshing does not erase babies or discoveries | Saves remain tied to one browser unless exported |
| Personality and memory per baby | The same player action can produce different reactions | More state must be validated and saved |
| Camera background as an optional toggle | Players can place the jellyfish in their own environment without blocking the deep-sea artwork | Live video can reduce contrast and requires permission |
| No networked multiplayer in this submission | Keeps the project reproducible, private, and stable for assessment | Multiple people cannot interact from separate devices simultaneously |

## 4. Iteration summary

### Soft-body prototype

- Built the mother jellyfish from a deformable contour.
- Added local press, drag direction, delayed body response, and spring recovery.
- Preserved facial features and allowed interaction to change expressions.

### Birth and autonomous babies

- Changed birth from a separate appearance into a visible separation from the mother.
- Added the upside-down newborn pose, quick turn, tentacle growth, size variation, and a soft pop.
- Added independent floating, blinking, touch response, and spacing between babies.

### Gesture input and failure handling

- Added optional hand tracking through Handsfree.js.
- Used thumb–index pinching for squish and birth, one finger for gentle contact, and a fist gesture for one bubble.
- Smoothed landmarks and separated pinch-start and pinch-end thresholds to reduce accidental release.
- Kept mouse interaction fully functional when camera permission or the tracking library is unavailable.

### Emotion, behavior, and social systems

- Gave each baby a Calm, Shy, or Playful personality.
- Added emotion values, temporary expressions, trust, stress, energy, and short-term interaction memory.
- Added follow, flee, orbit, sleep, separation steering, and player-interaction priority.
- Added occasional greeting, gentle bump, synchronized floating, shy retreat, and playful orbit between babies.

### Collection and save

- Assigned every baby an ID, nickname, colour, top pattern, personality, memory, and birth time.
- Matched the pattern drawn on a baby with its collection record.
- Added autosave, backup recovery, import/export, confirmation for destructive actions, and a collection archive.

### Interface and sound

- Simplified the interface into an English deep-sea presentation.
- Replaced the long action-gated tutorial with a short guide because the camera tutorial felt slow and overly complicated.
- Added generated ambient music and mute support.
- Added Deep Sea and Live Camera background modes.

## 5. User trial

### Trial record

- **Date:** 1 November 2026
- **Participant code:** P01
- **Method:** The participant tried the browser experience while the student observed.
- **Evidence:** [Original user-trial photograph (HEIC, 2.9 MB)](docs/user-trial-01.HEIC)
- **Privacy:** The student explicitly chose to include the original photograph in the public repository. No camera frame is captured or saved by the SQUISH program itself.

### Observation and feedback

The participant wanted the jellyfish to appear over the live camera image and suggested that multiple people should be able to interact with it. The first request revealed a discoverability problem: a camera-background mode already existed, but the short labels **Deep Sea** and **Live View** did not clearly communicate that they were two background choices.

The multiplayer suggestion was understood in two possible ways:

1. several people standing in front of one camera; or
2. several remote players interacting from different devices.

The current hand-tracking library and interaction model are designed around one tracked participant. Adding reliable multi-person or networked synchronization would substantially increase the technical and privacy scope of this assignment.

### Change made from the trial

The background control was renamed from **Deep Sea / Live View** to **BG · Deep Sea / BG · Live Camera**. This small interface change makes the existing camera-background feature visible without adding another tutorial panel.

Networked or simultaneous multi-person interaction was not added for this submission. The decision keeps the main squish interaction stable, preserves camera privacy, and follows the assignment advice that one polished interaction is stronger than several unfinished features. Multi-person input remains a future direction.

## 6. Handling mistakes and interruptions

- Camera permission can be denied without blocking mouse or touch.
- Lost hand tracking pauses the current camera gesture rather than completing it accidentally.
- An incomplete stretch rebounds without creating a duplicate baby.
- Population limits prevent uncontrolled object growth.
- Invalid imported saves are rejected, and a damaged local save offers backup recovery.
- Audio can be muted, and visual feedback remains sufficient when sound is unavailable.
- The game saves when the page becomes hidden and returns autonomous behavior to a safe state.

## 7. Testing

The project includes 35 browser-independent tests covering:

- emotion and memory independence;
- stat limits and expression priority;
- mouse/camera pointer normalization;
- follow, flee, orbit, recovery, and separation steering;
- social pairing, interruption, cooldowns, and missing partners;
- save validation, backup recovery, import/export, and discovery history.

The main browser flow was also checked manually: squish, rebound, edge birth, baby interaction, background switching, camera denial fallback, collection display, and save restoration after refresh.

## 8. AI collaboration

OpenAI ChatGPT and Codex were used to discuss interaction ideas, implement and refactor HTML/CSS/JavaScript, diagnose gesture behavior, create automated tests, and draft documentation. The student directed the visual and interaction revisions through repeated critique and supplied reference images.

One AI suggestion that was **kept** was separating emotion, behavior, social, and save logic into testable modules. This made the autonomous systems easier to verify without a camera.

One direction that was **changed** was the initial tutorial state machine. A six-step gesture tutorial was implemented, but the student found it slow and too complicated. It was replaced with a concise written guide and optional controls.

One direction that was **rejected** was expanding the final submission into a home-building or economy game. It distracted from the relationship between touch, deformation, feedback, and recovery that the assignment is assessing.

The student should review this account in their own voice before final submission and confirm that the photograph is appropriate to share publicly.

## 9. Known limitations and future work

- Hand tracking depends on lighting, framing, device speed, and the CDN-hosted model.
- The camera system is designed for one participant and does not identify multiple people.
- There is no networked multiplayer or shared remote sea.
- Saves use browser localStorage and require export/import to move between devices.
- HEIC trial evidence may need to be downloaded on browsers that do not preview the format.
- The interface is optimized for desktop presentation rather than small phones.

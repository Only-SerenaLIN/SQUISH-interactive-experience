# Credits and Attribution

## Project authorship

**SQUISH — A Soft Jellyfish Interaction Experience**

- Concept, creative direction, interaction design, visual decisions, testing, and final project review: **LIN Ziqing**
- HTML, CSS, Canvas 2D, JavaScript systems, documentation, and automated tests: developed by LIN Ziqing with assistance from OpenAI ChatGPT and Codex
- Repository: <https://github.com/Only-SerenaLIN/SQUISH-interactive-experience>

LIN Ziqing directed the project through repeated visual and interaction revisions, supplied reference material, evaluated prototypes, requested changes, and is responsible for the submitted work.

## Open-source software

### Handsfree.js

The optional camera-gesture mode uses [Handsfree.js 8.5.1](https://handsfreejs.netlify.app/) by Oz Ramos, distributed under the [Apache License 2.0](https://github.com/MIDIBlocks/handsfree/blob/master/LICENSE).

The browser loads the Handsfree.js stylesheet, script, and model assets from the unpkg CDN:

```text
https://unpkg.com/handsfree@8.5.1/
```

Handsfree.js provides browser hand landmarks and pinch-state data. SQUISH converts those results into its own smoothed pointer, squish, nurture, touch, and bubble interactions. The main experience remains usable with mouse or touch when this library, its models, or camera permission are unavailable.

### Browser platform APIs

The project uses standard browser technologies without a build framework:

- HTML5 and CSS
- Canvas 2D API for the jellyfish world and visual effects
- Web Audio API for generated ambience and interaction sounds
- MediaDevices / `getUserMedia()` for optional live camera input
- LocalStorage and File APIs for saving, backup recovery, and JSON import/export

These browser APIs are platform features rather than bundled third-party media or source libraries.

## Visual and audio material

The final deep-sea scene, mother jellyfish, baby jellyfish, facial expressions, top patterns, tentacles, bubbles, particles, highlights, deformation, and collection thumbnails are drawn procedurally by the project code.

The ambient deep-sea sound and interaction feedback are synthesized at runtime with oscillators, filtered noise, and gain envelopes through the Web Audio API. No downloaded song or prerecorded sound effect is included.

The interface uses system fonts and does not redistribute a commercial font.

The repository contains some earlier prototype screenshots and generated visual experiments in `docs/` and `web/assets/`. They document development history and are not required by the final Canvas experience.

## References supplied during development

The following materials informed the project's general visual and interaction direction:

- User-supplied photographs of translucent blue, purple, and pink jellyfish
- A user-supplied drawing describing the orientation of a newborn jellyfish during separation
- User-supplied screenshots and annotations exploring flower-like crown patterns, facial placement, and jellyfish proportions
- Handsfree.js installation documentation: <https://handsfreejs.netlify.app/#installing>

These references were used for observation and discussion. Their photographs and artwork were not copied into the final Canvas rendering or redistributed as game assets.

## User-trial evidence

The original user-trial photograph is stored at [`docs/user-trial-01.HEIC`](docs/user-trial-01.HEIC), with a browser-friendly preview at [`docs/user-trial-01-preview.jpg`](docs/user-trial-01-preview.jpg). The image was supplied by LIN Ziqing and added to the public repository at the author's explicit request. The author is responsible for confirming that the participants shown have agreed to public sharing.

The SQUISH application itself does not record, upload, or save live camera frames.

## AI-use disclosure

OpenAI ChatGPT and Codex were used to:

- discuss and refine interaction concepts;
- draft and revise HTML, CSS, and JavaScript;
- diagnose gesture-recognition and animation behavior;
- help organize emotion, behavior, social, and save modules;
- create and run automated tests;
- help draft the README and process documentation.

The student supplied the project direction and references, reviewed each iteration, requested substantial changes, tested the experience, and chose which suggestions to keep, change, or reject. Specific examples and the user-trial response are documented in [`PROCESS.md`](PROCESS.md).

No generative AI service is called by the finished SQUISH webpage at runtime.

## Privacy

Live camera frames are mirrored and processed locally in the browser for optional hand tracking or display as a background. The program does not transmit or save those frames. Camera access can be denied or disabled without preventing mouse and touch interaction.

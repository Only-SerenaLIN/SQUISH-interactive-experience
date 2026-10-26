# Credits and Attribution

## Project authorship

Project concept and direction: **student author — add your name here before submission**.

The first working prototype was developed with assistance from OpenAI Codex. Before submitting, the student should review the code, run it, make at least one personally directed change, and describe the collaboration according to the course's AI-use policy.

Suggested disclosure (edit to match what actually happened):

> I used OpenAI Codex to help structure the Python project, draft the first implementation, and explain setup and testing. I directed the concept and requirements, reviewed the generated code, ran the prototype, and remain responsible for the final design and submission.

Do not use this wording if it does not accurately describe the final process.

## Open-source libraries

- [Python](https://www.python.org/) — programming language; Python Software Foundation License.
- [Pygame](https://www.pygame.org/) — window, drawing, and input; GNU LGPL v2.1.
- [OpenCV](https://opencv.org/) — webcam capture and image conversion; Apache 2.0 License.
- [MediaPipe](https://ai.google.dev/edge/mediapipe/solutions/guide) — hand landmark tracking; Apache 2.0 License.
- [uv](https://docs.astral.sh/uv/) — Python project and dependency manager; Apache 2.0 / MIT License.
- [pytest](https://pytest.org/) — development tests; MIT License.

Library versions used for a particular submission are recorded in `uv.lock` after `uv sync`.

## Visual and media assets

All shapes, character graphics, projected 3D jelly geometry, translucent material layers, pressure waves, supermarket elements, particles, interface elements, and short sound effects are generated procedurally by the Python code. There are no downloaded images, fonts, sounds, prerecorded camera clips, or third-party visual assets in prototype version 0.7.0.

## Interaction references

- A user-supplied Xiaohongshu post titled “捏一下赛博青苹果来哄自己开心” inspired the green-apple theme and the request for more tactile variation. The short link could not be fetched in the development environment, so no imagery, code, audio, or text was copied from it: <https://xhslink.cn/o/6Nkve3BQzjj>
- CBNData's article on crispy squishies was consulted for general context about progressive breaking and immediate sensory feedback: <https://www.cbndata.com/information/295843>
- User-supplied screenshots of gesture-controlled music, breathing-oriented generative artwork, and coloured hydrogel stress balls informed the translucent jelly, breathing prompts, musical feedback, collaborative pressure waves, and glossy material treatment. No imagery, interface, text, music, or code was copied from those screenshots.

These are interaction references, not source assets.

## Data and privacy

No training dataset was created or included. Live webcam frames are processed locally in memory and are not saved by the project.


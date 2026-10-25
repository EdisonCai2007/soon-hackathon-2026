## Context

See [the proposal](proposal.md). Step 2 of [the ROAM roadmap](https://github.com/EdisonCai2007/soon-hackathon-2026/pull/3), which owns the project-level decisions this change inherits: one placement path for every figure, a pre-cut alpha clip rather than live segmentation, HRTF panners on the built-in Web Audio graph, and select-to-watch as a small state machine.

What exists, shipped by `roam-scan-on-site`: `app/src/apps/roam/` with `RoomViewer.tsx` (a `useEffect` owning the `WebGLRenderer`, `SparkRenderer`, `SplatMesh` and `PovControls`, with a `setAnimationLoop`), `scene.ts` (zod-checked `scene.json`, `displayQuaternion`, `poseFor`, `applyPose`), `pov-controls.ts`, and `viewer-state.ts`. The scan is `app/public/apps/roam/room.spz` (173,224 splats) with `scene.json` (22 source cameras, bounds, `cutHeight`).

Constraints: [mini apps](../../../wiki/stack/mini-apps.md) — own folders, no CSS file, every line tested; no new packages wanted; **the demo is today**.

### The scan's units are not metres

`scene.json` bounds span about 4.6 × 2.4 × 4.5 and every camera `eye` sits at y ≈ 0.18–0.35 while the lower bound is y = −1.27. A phone is held about 1.5 m up, so one scan unit is roughly 1 m ÷ 0.2 ≈ 5 m, and the lower bound is below the floor (stray splats). **Nothing may hardcode a metre.** The floor plane and the figure's height are both derived from the camera heights: `floor = median(eye.y) − eyeHeight`, with the figure `eyeHeight` tall, where `eyeHeight` is a single tuned constant in scan units. The same median gives the path its height, so the figure walks the floor the camera walked.

## Goals / Non-Goals

**Goals:** the complete demo moment on one page with no network — a figure walking the filmed route, its voice placed by distance and direction, click-to-watch with a restored pose, and a full-screen room. A placeholder figure that the real clip replaces without touching code.

**Non-Goals:** the network room, phones, WebRTC, live background removal, more than one figure, recording, and occlusion of the figure by room geometry (step 6).

## Decisions

- **`FigureSource` is the seam, and the only one.** An interface `{ id, poseAt(seconds): FigurePose }` where `FigurePose = { x, y, z, yaw }`. The scripted path implements it today; the network room (step 4) and a phone (step 5) implement it later without the renderer changing. Keeping the seam at *pose over time* rather than *pose now* makes it pure and testable with no clock.
  - *Alternative:* push poses into the scene directly from a driver. Rejected: it makes the scripted demo a different code path from the live one, which is exactly what the roadmap's spine-first order exists to avoid.
- **The path is a loop through the source-camera positions, resampled.** Take each camera's `eye`, project to the floor height, drop waypoints closer together than a threshold, and walk the polyline at a constant speed with the yaw facing the direction of travel. The 22 cameras are a recorded walk, so this *is* the filmed route. Interpolation is linear between waypoints with an eased turn, because a spline through noisy pose estimates wanders into walls.
- **The figure is a camera-facing plane, not a sprite.** A `PlaneGeometry` with a `MeshBasicMaterial` (`transparent`, `depthWrite: false`, `toneMapped: false`), re-oriented each frame to face the camera's position in the horizontal plane only, so it never tips over when you fly above it. A `Sprite` would also face the camera but scales with distance in a way that fights the splat scale.
- **The placeholder is a generated texture, not an asset.** A `CanvasTexture` drawn once — a flat person-shaped silhouette in the app's accent colour with the figure's name under it. It needs no file, so there is nothing to forget to ship, and the real clip's arrival deletes the function. Audio's placeholder is one generated `OscillatorNode` through the same panner, so the spatial path is identical.
  - *Alternative:* ship a placeholder PNG and a tone WAV. Rejected: two more assets to carry and strip out later, for no gain.
- **Audio is a graph per figure, built once, driven by numbers from a pure module.** `source → GainNode → PannerNode(HRTF) → destination`, with the `AudioListener` position and orientation set from the camera each frame. `audio.ts` exports pure `gainFor(distance)` and the listener vectors from a camera pose; the wrapper only assigns them. Distance uses an inverse law with a reference and max distance expressed in **scan units scaled from the eye height**, not metres.
- **Unlock on the first pointer down, once, and remember it in state.** (The graph in full is [below](#how-the-sound-is-built).) `AudioContext` starts `suspended` in Chrome; the page already asks for a click to take keyboard focus, so the unlock rides the gesture the demo already performs. The *sound off* tag is the honest signal until `state === 'running'`.
- **Selection raycasts against the figure planes only.** A `Raycaster` from normalised pointer coordinates against the figure meshes, never the splats; Spark's splat mesh has no useful intersection. A click that hits nothing does nothing, so clicking to focus the scene stays safe. `figures.ts` holds the pointer-to-ray maths so it is tested without a canvas.
- **Watching is a state machine over the existing pose mechanism.** `watch-state.ts`: `{ mode: 'room' } | { mode: 'watching', id, saved: Pose }`. Entering saves the live camera pose; leaving dispatches it back through the `pose` prop `RoomViewer` already applies. No new camera path — the restore reuses the code the camera presets use, so it is already proven.
  - *Alternative:* fly the camera to the figure before the overlay. Rejected for today: it is an animation to tune under deadline, and the overlay is the moment.
- **The watch overlay is a DOM video over the canvas, not a texture.** The figure's own `<video>` element, shown full-size in an absolutely positioned card with a close button. Rendering it in 3D would cost a second decode; the element is already decoding for the texture.
- **Full screen is `requestFullscreen` on the view's box**, with the button reflecting `document.fullscreenElement`. The box is already `relative` and absolutely positioned inside, so it fills correctly with no layout change.
- **Every line of maths is a plain module; the 3D and audio wrappers stay thin.** `figure-source.ts`, `figures.ts`, `audio.ts` and `watch-state.ts` import nothing but `three`'s maths types and are unit-tested directly; `RoomViewer.tsx` and the overlay are tested with `three` and Web Audio mocked, as `RoomViewer.test.tsx` already mocks Spark.

### How the sound is built

Four nodes per figure, built once when the figure is created and torn down with it. Web Audio does the spatialisation; the only thing this change owns is the numbers fed to it.

```text
source → GainNode → PannerNode (HRTF) → destination
```

- **`PannerNode` with `panningModel: 'HRTF'`** does the work: inter-aural level and time difference and the head-shadow filtering that places a voice behind or beside the listener. Its `positionX/Y/Z` are set from the figure's pose each frame. `distanceModel` is left at its default but contributes nothing, because `refDistance` is set past `maxDistance` for the panner itself — the gain node owns loudness, so the curve is ours and testable.
- **The listener is the camera.** `context.listener` takes a position and forward and up vectors; `listenerFrom(cameraPose)` in `audio.ts` returns all three from the camera's world matrix, and the wrapper assigns them inside the existing `setAnimationLoop`. Turning the camera therefore moves the voice with no left/right logic of our own. Assign through `AudioParam.setValueAtTime` where `positionX` exists, falling back to the deprecated `setPosition`/`setOrientation` for Safari.
- **`gainFor(distance)` is an inverse law**, `1 / (1 + rolloff × (d − ref) / ref)` clamped to `[floor, 1]`, with a non-zero `floor` so a figure across the room is faint rather than absent — the viewer needs to hear which way to walk. Applied with `setTargetAtTime` and a short time constant, not a bare assignment, so flying fast does not click.
- **Every distance is in scan units, derived from `eyeHeight`** ([the scale problem](#the-scans-units-are-not-metres)): `ref = eyeHeight × 2`, `max = sceneExtent`. A literal metre here either silences the figure two steps away or flattens the falloff to nothing, and it is the single most likely thing to get wrong.
- **The source is an `OscillatorNode` today** — a low tone, detuned slightly per figure — and becomes `createMediaElementSource(video)` on the figure's own `<video>` when the clip lands. Nothing downstream changes, which is the same swap the figure's texture makes.
- **The context starts suspended.** Chrome's autoplay policy blocks it until a gesture; the first `pointerdown` on the scene calls `resume()` once, guarded by the `'blocked' | 'running'` state so a second click does nothing. That gesture is the click the demo already makes to take keyboard focus, so no extra step appears on stage. The *sound off* tag is shown until the state is `running`.
- **Tests cover the arithmetic, not the audio:** `gainFor` at zero, at `ref`, past `max`, and that it never rises with distance; `listenerFrom` for a camera looking along each axis and straight down; and the unlock transition. The node wiring is asserted against a mocked Web Audio, as `RoomViewer.test.tsx` already mocks Spark.

## Risks / Trade-offs

- [The clip never arrives before the demo] → The placeholder figure and tone are the shipped default, not a stub: the demo stands on its own. Swapping in the clip touches one module.
- [The figure walks through a wall] → The path follows recorded camera positions, which were physically walked, so it cannot. Resampling only shortens the straight lines between them.
- [The scan's scale is misjudged and the figure is a giant or an ant] → One constant, `eyeHeight`, in one module, checked by eye on the preview and adjustable in seconds.
- [Chrome blocks the audio and the tag is missed on stage] → The unlock rides the click the demo already makes to control the camera; the tag is visible until it lands.
- [Every-line coverage of the new 3D and audio code] → Pure modules carry the tests; the wrappers are thin and mocked, following the shipped `RoomViewer.test.tsx` pattern.
- [Full screen hides the page's controls on a projector] → The view buttons and *Full screen* sit inside the box that goes full screen, so they stay reachable.
- [A second decode for the overlay costs frames] → The overlay reuses the figure's own element, and the room keeps rendering behind it at the same cost.

## Migration Plan

Additive inside the existing mini app; no binding, no schema, no package. Previews at `/apps/roam/` and publishes through the normal gate. Rollback is removing the new modules and the figure block from `RoomViewer.tsx`; `roam-scene`'s shipped behaviour is untouched either way.

## Open Questions

None. The clip's arrival is a later swap, not a blocker.

## UX

### Use-case brief

- **Who:** a judge or a remote guest on a **laptop**, with the page cast to a projector. The team drives it on stage.
- **The job:** *be in the room with someone who isn't here.*
- **Done looks like:** they walked across the room toward a person, heard that person get louder and shift to one side as they turned, clicked them, and saw their face fill the screen.
- **Context of use:** one-off, on stage, under time pressure, possibly on a venue network that may be unreliable — so nothing in this moment needs the network after the page loads.
- **Common case:** walk and listen. **Edge cases:** sound still blocked before the first click; a click that hits no one.
- **Frequency:** demoed a handful of times today, then kept as the fallback for every later step.

The closest existing screen is step 1's room viewer, which this extends rather than replaces.

### Flow

Open ROAM → the room loads → click the scene (sound starts, the *sound off* tag goes) → walk toward the person → click them → watch full screen → close → back exactly where you stood.

### Hierarchy

**The person in the room is the one primary target** — everything else is secondary and muted: the view buttons, the camera list, *Full screen*, and the *sound off* tag. In the watch overlay the one primary action is *Close*. No new control competes with the room itself.

### Components

Shared, already in the app: `Button` (outline and ghost), `Badge`, `Card`, `Label`, `NativeSelect`, `Skeleton`, `Loading`. New: the figure plane and its placeholder texture, the audio graph, and the watch overlay card. No new CSS file; Tailwind classes as in `App.tsx`.

### Review

See [review.html](review.html). What Changes item 1 sketches the room with the figure and the *sound off* tag; item 3 sketches the watch flow.

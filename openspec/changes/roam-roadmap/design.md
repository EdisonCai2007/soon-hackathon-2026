## Context

See [the proposal](proposal.md). This roadmap replaces the unsaved `roam-presence` plan in workspace `uneven-gopher` and keeps its capability split, its build-a-spine-first order, and its lessons from the Orbis Engine (Apache-2.0).

What exists: Edison's draft PR #1 (`origin/codex/room-gaussian-scan-pov`) with a 173,224-splat room scan, a vanilla Three.js 0.180 + Spark 2.4 viewer, `PovControls`, 22 source-camera presets, and the processing pipeline. Step 1 is planned as [`roam-scan-on-site`](../roam-scan-on-site/design.md), which owns the scene decisions: reuse the vanilla viewer in a React wrapper (no react-three-fiber), compress the PLY to SPZ under the 25 MiB asset limit, and keep `scene.ts` and the viewer state as pure tested helpers.

Constraints: [mini apps](../../../wiki/stack/mini-apps.md) (own folders, no CSS file, every line tested), Cloudflare primitives for realtime, and a demo today or tomorrow.

## Goals / Non-Goals

**Goals:** a demo that works with no network or phone (steps 1–3), then live liveness and phones on the same spine (steps 4–6).

**Non-Goals:** in-app scanning, a native app, scale beyond 2–3 streamers and a few viewers, recording, and new sign-in.

## Decisions

- **Spine first, then swap stand-ins for real inputs.** Each later step replaces one faked input on a demo that already works; never debug the experience and the plumbing at once.
- **One placement path for every figure.** A `FigureSource` yields `{id, x, y, z, yaw, video, audio}`. The scripted path, the network room, and a live phone all feed it, so the scripted demo also exercises live placement, and serves as the deterministic test harness (the Orbis fake-pose driver idea).
- **Pre-cut the stand-in clip offline.** A teammate records 30–60 s talking and walking against a plain wall. Remove the background ahead of time (for example with `rembg`/`backgroundremover`, or MediaPipe in a script) and export VP9 WebM with alpha, plus an HEVC-with-alpha MP4 for Safari. The figure is a `VideoTexture` on a camera-facing plane with alpha blending. This gives a real cut-out on stage without live segmentation.
  - *Alternative:* live MediaPipe segmentation in a Web Worker. Deferred to step 6: GPU-heavy, and only needed for live phones.
- **Path near the capture route.** The scripted path's waypoints come from the source-camera `eye` positions in `scene.json`, at floor height, because splats stretch away from where the video was filmed.
- **Spatial audio with built-in Web Audio.** One HRTF `PannerNode` per figure, fed from its `<video>` element. The `AudioListener` follows the camera each frame. Unlock on the first pointer down, with a visible *sound off* tag before then. No package.
- **Select-to-watch as a small state machine** (`room → watching → room`) that saves and restores the camera pose. Raycast against figure planes on click.
- **Full screen via the Fullscreen API on the viewer's container**, so the app's frame stays as it is and needs no Layout change.
- **Shared room: a Durable Object over hibernatable WebSockets**, one per room id, relaying positions, presence, and WebRTC signaling. Pure message handlers carry the unit tests.
- **Phone: WebXR AR on Android for position, WebRTC for video, a printed marker for one-time alignment.** WebXR image tracking where available, else stand on the marker's spot and tap. Video uses a WebRTC mesh at demo scale; Cloudflare Realtime SFU is the scale path later.
- **Every step is its own change**, planned from this roadmap when its turn comes, so each preview stays quick to check.

## Risks / Trade-offs

- [No clip recorded in time] → Step 2 can start with a placeholder colored figure and a tone; swap the clip in when ready.
- [Alpha video unsupported in one browser] → Ship both WebM-alpha and HEVC-alpha; the demo laptop runs Chrome.
- [Splats break up off the capture route] → The path and the starting views stay on the route; keep the demo walk near it.
- [Venue network blocks WebRTC] → Steps 1–3 need no network beyond loading the page; for 4–5, test early and plan a TURN relay (Cloudflare Realtime TURN).
- [WebXR is Android-only] → The scripted figure stays the guaranteed demo.
- [Every-line coverage of WebGL and audio code] → Thin wrappers over pure, tested modules; mock `three`, Spark, and Web Audio.
- [The site is down or slow at the venue] → Step 3 keeps a local build of the app on the demo laptop as an offline backup.

## Migration Plan

New mini app only; each step previews at `/apps/roam/` and publishes through the normal gate. Step 4 adds a Durable Object binding and its migration tag in `wrangler.jsonc`; rollback removes the binding and the app folders.

## Open Questions

- How many Android phones does the team have? This decides whether step 5 is tried at all.
- Who records the clip, and when? (Agreed: a teammate, now.)

## UX

### Use-case brief

- **Viewer:** a judge or remote guest on a **laptop**, cast to a projector. The job: *be in the room with someone*. Done = they walked up to the person, heard them, and watched them up close. Common case: walk and listen. Edge cases: sound blocked until a click, or a stream dropping.
- **Phone streamer (step 5):** a teammate in the room, **on an Android phone**. The job: line up once, go live, then forget the phone. Edge case: trying to go live before lining up.

The closest screen is step 1's room viewer, which this extends.

### Flow

Open ROAM → room loads → click (sound starts) → walk toward the person → click them → watch full screen → close → back where you were.

### Hierarchy

The people are the primary target; the view buttons, *Full screen*, and the *sound off* tag are secondary and muted. The phone page has one primary action, *Go live*, enabled after lining up.

### Review

See [review.html](review.html). What Changes item 2 sketches the viewer with a figure; item 3 sketches the watch flow.

### Components

Shared: `button`, `tag`, `card`, `Skeleton`. New: figure planes, the audio graph, the watch overlay, and (step 5) the phone page, built from shared parts and phone-width.

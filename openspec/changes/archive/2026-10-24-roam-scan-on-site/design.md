## Context

See [the proposal](proposal.md). Edison's draft PR #1 (`origin/codex/room-gaussian-scan-pov`, `experiments/room-scan/`) holds a working static viewer: vanilla Three.js 0.180.0 + Spark 2.4.0 (vendored), `PovControls` with six `node:test` tests, `splat_scene.json` (rotation, translation, bounds, `cutHeight`, 22 camera presets with `eye`/`target`/`up`/`fov_y`), and `room_splats.ply` (40,882,341 bytes, 173,224 splats with spherical harmonics).

The full ROAM roadmap is the unsaved `roam-presence` change in workspace `uneven-gopher`. This change covers only its tasks 1.1–1.3, and changes one renderer decision (below).

Constraints: [mini apps](../../../wiki/stack/mini-apps.md) are React + TypeScript in `app/src/apps/<name>/`, with no CSS file, own-folder imports only, every line tested, and knip and jscpd passing. Cloudflare Workers static assets cap one file at 25 MiB. The app's assets run behind `run_worker_first`, so the same Worker serves the scan and the page.

## Goals / Non-Goals

**Goals:** the real scan walkable at `/apps/roam/` on a preview link; loading, failure, and no-WebGL states; the asset under the limit; the full suite green.

**Non-Goals:** the scripted figure, spatial audio, selection, realtime room, phone capture, and segmentation (all later `roam-presence` phases); the ceiling cutaway and point-cloud comparison; a full-bleed layout outside the shared frame; editing Edison's PR.

## Decisions

- **Wrap the vanilla viewer in one React component, not react-three-fiber.** `RoomViewer.tsx` creates the `WebGLRenderer`, `SparkRenderer`, and `SplatMesh` in a `useEffect`. It attaches the canvas to a ref'd container sized to the content frame (`ResizeObserver`, not `window`) and disposes everything on unmount. It reuses the proven code path almost line for line.
  - *Alternative:* an r3f `<Canvas>` hosting Spark, as `roam-presence` planned. Rejected for now: two more packages and a new integration to debug on a one-day deadline. Later phases can still add r3f if the scene grows.
- **Use npm packages, not the vendored files.** `three@0.180.x` and `@sparkjsdev/spark@2.4.x` match the vendored versions, so behavior stays the same while Vite bundles them and knip sees them.
- **Port `PovControls` to TypeScript as `pov-controls.ts`.** Keep its behavior and the six test cases, rewritten for vitest.
- **Put the testable logic in pure helpers.** `scene.ts` parses and validates `scene.json`, builds the rotation quaternion, and computes the Overview, Top, and source-camera poses from the bounds and presets. A `viewer-state.ts` reducer holds `loading | ready | error | no-webgl`. The GPU path stays a thin wrapper, tested with `three` and Spark mocked, as the `roam-presence` design already chose.
- **Compress to SPZ with Spark's own transcoder.** A Node script, `scripts/roam-ply-to-spz.mjs`, reads the PLY and writes `room.spz` with Spark's exported `transcodeSpz`, keeping the SH degree. The fallback is Niantic's `spz` CLI. Expect it to come out roughly 10× smaller, about 4–6 MB. The script runs once by hand, and its output is committed.
- **Assets live at `app/public/apps/roam/`** (`room.spz`, `scene.json`) and are fetched by relative URL, so they ship with the app's normal assets.
- **The canvas fills the mini app's content frame.** The view buttons and camera select sit above it, built from the shared `button` and `select` parts, with the key hint as muted text. There's no CSS file, only Tailwind classes.

## Risks / Trade-offs

- [Spark's transcoder needs browser-only APIs in Node] → Run it with a small shim, or fall back to Niantic's `spz` CLI. Either way, check the output size and that it looks the same.
- [SPZ quantization softens colors] → Before saving, compare the same source camera side by side with Edison's viewer. Keep the SH.
- [Spark's WASM or worker code doesn't bundle under Vite 8] → Check the build in the first task. If it fails, load Spark through `?url` or exclude it from dependency pre-bundling.
- [Every-line coverage of WebGL code] → Keep the wrapper thin and mock `three` and Spark in tests. Log any loosened check in the Decision log.
- [The Worker-served scan is slow on first load] → SPZ's smaller size covers it, and the loading state shows progress.
- [The content frame is small on a laptop] → Acceptable for this step. Full-bleed is a later Layout decision.

## Migration Plan

New mini app only. Preview at `/apps/roam/`, then publish through the normal gate. Rollback removes the app folder, the asset folder, the script, and the two packages.

## Open Questions

None blocking. Later: whether the demo needs full screen, decided when the fake person lands.

## UX

### Use-case brief

A hackathon judge or teammate on a **laptop**, often cast to a big screen. The job: *step into the room and look around*. Done = they've moved through the room and seen it from a couple of angles. Common case: open the link, click, walk. Edge cases: a machine without WebGL, or a slow network while the scan loads. Frequency: a handful of demo runs.

The closest screen is Edison's viewer. This one mirrors its controls and view buttons inside the app's usual frame, the way Hello sits in a card.

### Flow

Open `/apps/roam/` → placeholder while loading → room at the first camera → click the scene → walk and look → jump to another view with a button.

### Hierarchy

The scene is the content. The view buttons and camera select are secondary, grouped in one row above it, and the key hint is muted text. No primary button competes with the scene.

### Review

See [review.html](review.html). What Changes item 1 sketches the screen; item 2 covers the loading and failure states.

### Components

Shared: `button` (view buttons, *Try again*), `select` (camera; add it from shadcn if missing), `Skeleton` via `Loading.tsx`, and `card` for the failure message. New: `RoomViewer`, the canvas host, which is the app's own TypeScript code.

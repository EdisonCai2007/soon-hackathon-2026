## 1. Scan asset

- [ ] 1.1 Write `scripts/roam-ply-to-spz.mjs` with Spark's `transcodeSpz` (fallback: Niantic's `spz` CLI). Run it on `room_splats.ply` from `origin/codex/room-gaussian-scan-pov` to write `app/public/apps/roam/room.spz`, and copy `splat_scene.json` to `app/public/apps/roam/scene.json`. Confirm the SPZ is under 25 MiB and keeps the spherical harmonics.

## 2. App scaffold and packages

- [ ] 2.1 Add `three@0.180.x`, `@sparkjsdev/spark@2.4.x`, and `@types/three` to `app/package.json`, then install. Confirm `npm run build` still passes with Spark imported (WASM/worker bundling).
- [ ] 2.2 Create `app/src/apps/roam/` from `hello/`: `app.json` (title "ROAM", a one-line description) and `App.tsx`. No worker folder.

## 3. Viewer logic and page

- [ ] 3.1 Port `PovControls` to `pov-controls.ts`. Port its six tests to vitest, and add any needed for every-line coverage.
- [ ] 3.2 Write `scene.ts`: parse and validate `scene.json`, build the display rotation, and compute the Room, Overview, Top, and source-camera poses. Unit-test each.
- [ ] 3.3 Write the viewer state (`loading`, `ready`, `error`, `no-webgl`) and its tests.
- [ ] 3.4 Write `RoomViewer.tsx`. In an effect, create the renderer, Spark, and the `SplatMesh` from `room.spz`; apply the rotation; resize with the container; report load progress; dispose on unmount. Test it with `three` and Spark mocked.
- [ ] 3.5 Build `App.tsx`: the view buttons and camera select above the canvas, the key hint, the loading skeleton, and the error/no-WebGL card with *Try again*. Test each state and button.

## 4. Verification

- [ ] 4.1 From `app/`, run the full suite (`npm test`), then `npm run test:checks`, since packages changed. All must be green. Log any loosened check as a `Check:` bullet in the Decision log.
- [ ] 4.2 Confirm every file under `app/public/apps/roam/` is under 25 MiB.
- [ ] 4.3 `/save`, then preview from the agent host and open `/apps/roam/`. Check that the room renders, that W/A/S/D, Q/E and drag work, that each view button and a source camera move the camera, and that it looks the same as Edison's viewer at the same camera.

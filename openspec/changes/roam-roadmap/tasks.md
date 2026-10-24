## 1. Scan on the site

- [ ] 1.1 Build [`roam-scan-on-site`](../roam-scan-on-site/tasks.md) and publish it. Its tasks live there.

## 2. The demo moment (offline)

- [ ] 2.1 Record the stand-in clip (team): 30–60 s of a teammate walking and talking against a plain wall.
- [ ] 2.2 Remove the clip's background and export WebM-alpha and HEVC-alpha MP4 under `app/public/apps/roam/`, keeping the script that does it.
- [ ] 2.3 Write `FigureSource` and the scripted path from the source-camera positions; unit-test path interpolation and placement.
- [ ] 2.4 Render the figure as a camera-facing alpha video plane; test placement and facing with `three` mocked.
- [ ] 2.5 Build the spatial audio graph with the first-click unlock and *sound off* tag; unit-test the gain and pan curves and the unlock state.
- [ ] 2.6 Build select-to-watch (raycast, full-screen video, return to the saved pose) and the 3D full-screen button; test the state machine.
- [ ] 2.7 Run the full suite, then `/save` and walk the preview: the figure walks, the voice moves with you, and click-to-watch and full screen work.

## 3. Demo prep

- [ ] 3.1 Rehearse on the demo laptop and venue network: the scan loads, sound starts on a click, the figure runs cleanly, and full screen fills the projector.
- [ ] 3.2 Keep an offline backup: a local build of the app that runs with no internet.

## 4. Shared room (stretch)

- [ ] 4.1 Add the ROAM Durable Object with hibernatable WebSockets and its binding; write pure message handlers (join, leave, position, presence, signal) with unit tests.
- [ ] 4.2 List the room routes in `app/worker/apps/roam/api.ts` and test the wiring, including a disconnect removing a participant.
- [ ] 4.3 Feed the figure's position from the room; show other guests as soft markers, and a reconnecting marker on a drop. Test each.

## 5. Real phone (stretch)

- [ ] 5.1 Build the phone page: camera capture, WebXR position each frame, WebRTC video and position into the room.
- [ ] 5.2 Add one-time marker alignment and block *Go live* until aligned; test the transform and the guard. Add the printable marker.
- [ ] 5.3 Test on the venue network; record the TURN decision in the Decision log.

## 6. Polish (after the demo)

- [ ] 6.1 Live background removal in a Web Worker for phone video.
- [ ] 6.2 Let room geometry hide figures behind it, with feathered edges.
- [ ] 6.3 Lower splat detail before input lags with several figures; harden audio for overlapping voices and drift.

## 7. Verification

- [ ] 7.1 Each step's change runs the full suite (`npm test`, plus `npm run test:checks` when packages change) and is checked on its preview at `/apps/roam/` before it publishes.

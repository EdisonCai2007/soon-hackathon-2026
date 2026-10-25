## 1. The frame-rate check

- [x] 1.1 Put a throwaway page on the owner's Android phone that loads the real `room.spz`, hands an `immersive-ar` session to `renderer.xr`, draws the scan placed against each marked spot, and reports the frame rate with and without the splats
- [x] 1.2 Done, and it changed the plan: full detail runs at 2–66 fps and loses the 3D view; the scan off holds 88–90
- [x] 1.3 Step the probe through `lod` with a 250k, 120k and 60k splat budget, with the pixel ratio and `maxStdDev` behind each, and keep the frame rate for each setting; confirm three.js's own camera moves on the frames `getViewerPose` answers with nothing
- [x] 1.4 Measured, lightest first and stepping by itself, because a lost context is permanent and a setting nobody turned on measures nothing: **60k holds 65–80 fps**, 120k 25–64, 250k 60–62 then lost the view. `getViewerPose` answered nothing on 92% of frames while three.js's own camera moved
- [x] 1.5 One pass with the anchor taken from a camera pose rather than a marked spot, which is how a guest's session is placed, added to the probe and ready on the same page
- [x] 1.6 Recorded in the proposal's Decision log: the setting to ship, the context loss that survived LOD, and that **no trimmed copy of the file is needed**
- [ ] 1.7 Final phone acceptance in section 12: verify a remote guest's steps and turns at the 60k setting. Alignment against the scanned home's real walls is outside the confirmed priority scope

## 2. What reading a face costs

- [x] 2.1 Earlier laptop probe measured the face reader alone and beside the scan; the Decision log records both rather than treating a standalone model cost as a combined result
- [x] 2.2 The user chose to cut leaning after those measurements; no face reader or leaning control is part of this delivery

## 3. Placing the scan against a spot

- [x] 3.1 `app/src/apps/roam/ar-place.ts`: the two-group transform — inner position `(-anchor.x, -anchor.floor, -anchor.z)`, outer `rotation.y = -anchor.yaw` and `scale = 1 / unitsPerMetre(scene)` — as one pure function over plain objects, taking any `Anchor` so a taped spot and a camera pose both place it
- [x] 3.2 `ar-place.test.ts`: the spot lands at the origin; its facing becomes the session's forward; one real metre is one metre of scan; a pose through `toScanPose` and back through this transform returns to where it started; an anchor built from a camera pose places the same way; every branch covered

## 4. One way to load a scan

- [x] 4.1 `app/src/apps/roam/splat-scene.ts`: build a `SplatMesh` from a scene and a splat URL with the scene's upright rotation and translation applied, as the one place both the laptop and the phone use; the mesh's own options pass straight through, so the phone asks for `lod` and a budget where the laptop asks for neither
- [x] 4.2 `splat-scene.test.ts` covering it, and `RoomViewer.tsx` changed to use it with its existing tests still passing

## 5. Drawing the scan in the session

- [x] 5.1 `app/src/apps/roam/ar-view.ts`: owns the `WebGLRenderer` with `xr.enabled`, the `SparkRenderer`, the placed scan group and the animation loop; `take(session)` sets the reference space type and hands the session to `renderer.xr`; `lineUp(anchor, scene)` places the scan; `show(on)` turns the placed group's `visible` on and off; `dispose()` tears the lot down. Whether it starts shown is the caller's, since the walk screen starts off and a guest starts on. The detail settings the probe measured are named constants in this one module — `lod: true` on the mesh, `enableLod` on the renderer, `lodSplatCount` 60,000, `lodRenderScale` 4, pixel ratio 0.6 and `maxStdDev` 2 — and the pose each frame comes from `renderer.xr.getCamera()`, not a second `getViewerPose`
- [x] 5.2 The rolling frame-rate watch in the same module: below the floor for the set number of seconds, report it once and let the caller decide what to do about it — the walk screen turns the scan off, a guest's walk ends; a `webglcontextlost` listener reports the same way, since the phone did lose the context at full detail
- [x] 5.3 `ar-session.ts`: `startAr(hooks, overlay, view?)` — with a `view`, skip the dummy layer, hand the session over, and read each pose inside the view's frame; with no `view`, behave exactly as today
- [x] 5.4 `ar-view.test.ts` and the added cases in `ar-session.test.ts`: taking the session, placing on line-up, turning the scan on and off, the frame-rate floor firing and not firing, a failed renderer, tracking lost, stopping, and the unchanged no-`view` path; every branch covered

## 6–7. Capture-screen work excluded

The user chose the remote guest's walk, not a scan overlay in the real home. The earlier capture lifecycle refactor and *Scan on/off* work are outside this delivery; `Phone.tsx` and `Leave.tsx` stay unchanged. The Decision log retains that scope choice.

## 8. A thumb to move with

- [x] 8.1 `app/src/apps/roam/thumb-pad.ts`: a pure function from a press origin and a current point to `{ forward, side }`, with a dead zone, a linear ramp to a fixed radius and a clamp; the radius and dead zone are named constants here
- [x] 8.2 `pov-controls.ts`: one added `push(forward, side)` that feeds the vector `update(dt)` already builds, cleared each frame, so the keys and the pad share the speed, the `Shift` boost and the `dt` clamp and nothing else touches `camera.position`
- [x] 8.3 `thumb-pad.test.ts` and the added `pov-controls.test.ts` cases: the dead zone, the ramp, the clamp, a push with no keys, a push with keys, the push clearing itself, and `sync()` dropping it; every branch covered
- [x] 8.4 `ThumbPad.tsx` and its place in `RoomViewer.tsx`: shown once a `pointerdown` on the view reports `pointerType` of `touch`, captures its own pointer, sits in the lower corner, and is labelled for a screen reader
- [x] 8.5 `RoomViewer.tsx` tests: the pad appears after a touch and not before, holding it moves the camera, letting go stops it, and a press begun on the pad picks nobody

## 9. The view keeps up

- [x] 9.1 `app/src/apps/roam/detail.ts`: the settings the view may draw at, heaviest first, and a watch that gives up one step after two seconds under the floor, ignoring a warm-up and never climbing back; the floor, the patience and the warm-up are named constants, and the softest step is the phone's measured setting
- [x] 9.2 `detail.test.ts`: the warm-up spared, a drop after sustained slowness, a dip forgiven, the walk down to the softest step, and no climb back; every branch covered
- [x] 9.3 `RoomViewer.tsx`: apply a step to the renderer and Spark, ask the mesh for the detail tree, and run the watch each frame
- [x] 9.4 `RoomViewer.test.tsx`: full detail while the rate holds, and the budget, the splat size and the pixel ratio all lowered when it does not
- [ ] 9.5 Record the remaining load-cost and unchanged-detail observations during the final verification phase, section 12

## 10. Priority: the joined phone follows its owner

- [x] 10.1 Author failing regressions in `ar-place.test.ts`, `use-room-ar.test.ts` and `scene.test.ts` for a nonzero initial XR position and yaw, preserved eye height, forward and sideways steps, a turn in place, and stopping without a 180-degree reversal; use actual camera direction vectors rather than only pose-shaped mocks
- [x] 10.2 Implement a guest pose mapping and matching rendered-world inverse in the placement surface, anchored at the saved scan eye position and first valid tracked pose. Use both in `ar-view.ts` and `use-room-ar.ts`; keep capture-only placement semantics unchanged
- [x] 10.3 Make carrying on update the raw origin and reached scan pose together; author rendered-transform and hook regressions for repeated recentering after translation and turning, with no jump in position, height or heading
- [x] 10.4 In `Scan.tsx` and `RoomViewer.tsx`, give the active movement mode sole ownership of local stance and outgoing poses. Suspend ordinary rendering/controls while walking where practical, and restore the reached pose before ordinary callbacks can publish. Author integration tests that inject stale ordinary callbacks during start, walk and exit
- [x] 10.5 Inspect the installed Three.js validity/update contract; implement tracking waiting/loss states without a second competing pose read or frame loop. Stop publishing invalid poses, recover only with continuity, and exit sustained loss/reference resets safely. Author tests for null/emulated tracking, loss/recovery and unusable reference frames
- [x] 10.6 Harden `use-room-ar.ts` and session setup against cancellation while starting, missing DOM overlay, partial setup failure, late callbacks from old sessions, repeated start/stop and context loss; author tests proving sessions, renderers and pending meshes are released and state/timestamps are reset
- [x] 10.7 Preserve main's existing *Walk it* pill and touch controls. Request the session directly from its tap; show waiting, loading and lost tracking within the existing walking status paragraph, and refusal in the existing alert. Do not add the older branch's idle-screen rows or toolbar

## 11. Source review

- [x] 11.1 Read the integrated diff against the design: guest mapping and rendered inverse agree for arbitrary starting poses; eye height and negative-Z camera heading survive start/recenter/stop; one movement source reports; no competing frame loop exists; ended sessions release their resources; capture-only behavior and main's UI, tools and person models are preserved; both renderers keep the shared detail settings

## 12. Wiki and final verification

- [x] 12.1 `wiki/development/ar-in-the-browser.md`: a section on drawing in a session — handing it to `renderer.xr`, the camera belonging to the phone so the world moves instead, the frame rate each setting held, and what a page can and cannot do with the camera while a session runs
- [x] 12.2 `wiki/stack/live-rooms.md`: what a phone and a laptop in a room can move with, and that the view gives up detail to keep up
- [x] 12.3 Extend the existing wiki notes with verified tracking validity, shared origin/inverse and negative-Z heading behavior, the explicit walk entry and pose-source ownership. Preserve existing edits and distinguish old probe evidence from the joined-phone check
- [ ] 12.4 Run the targeted regressions first, then `npm run lint`, `tsc -b`, the ROAM coverage checks, `npm test`, `knip`, `jscpd` and project pre-checks without weakening checks; confirm no capture-path regression
- [ ] 12.5 After implementation and review, `/save` and verify the applicable gate, then open the HTTPS staging room on the user's Android Chrome phone from elsewhere and a second participant's laptop. Record the tested URL/version, device/browser and permissions; do not substitute a stand-alone probe
- [ ] 12.6 Start from a non-default scan view while the phone faces an arbitrary direction. Verify no initial jump or height drop; walk one measured metre forward, sideways and back, and turn 90 and 180 degrees without stepping. Compare the phone's view with its relayed position and heading on the second participant; note scale uncertainty separately from transform correctness
- [ ] 12.7 Recenter after moving and turning; verify the next stationary frame and shared pose do not jump. Stop, restart, refuse permission where reproducible, temporarily interrupt tracking, and background/return; verify clear status, no stale-position overwrite, no reversed exit heading and working touch controls
- [ ] 12.8 Record frame rate and front-camera stream continuity during the joined walk, detail-tree load cost on the laptop, and unchanged desktop controls, tools, person models and hand signs. Keep any unavailable physical check explicitly open rather than declaring the feature working
- [ ] 12.9 Record acceptance evidence and any measured-scale follow-up in the Decision log; no real-room calibration, scale-constant change or new iPhone tracking engine belongs in this priority fix
- [ ] 12.10 Verify the integration against latest main: no layout, styling, font, cover, tool or person-rendering regression, and no restored note UI; use main's current controls and compare the final diff before shipping
- [ ] 12.11 Deploy the authorized public test Worker `soon-hackathon-2026-phone-walk` with its own room namespace and the existing staging database, and check the actual reported URL. Version URLs are unavailable for this Durable Object Worker; do not publish a guessed address or rely on `preview_urls`

## 1. The frame-rate check

- [x] 1.1 Put a throwaway page on the owner's Android phone that loads the real `room.spz`, hands an `immersive-ar` session to `renderer.xr`, draws the scan placed against each marked spot, and reports the frame rate with and without the splats
- [x] 1.2 Done, and it changed the plan: full detail runs at 2–66 fps and loses the 3D view; the scan off holds 88–90
- [x] 1.3 Step the probe through `lod` with a 250k, 120k and 60k splat budget, with the pixel ratio and `maxStdDev` behind each, and keep the frame rate for each setting; confirm three.js's own camera moves on the frames `getViewerPose` answers with nothing
- [x] 1.4 Measured, lightest first and stepping by itself, because a lost context is permanent and a setting nobody turned on measures nothing: **60k holds 65–80 fps**, 120k 25–64, 250k 60–62 then lost the view. `getViewerPose` answered nothing on 92% of frames while three.js's own camera moved
- [x] 1.5 One pass with the anchor taken from a camera pose rather than a marked spot, which is how a guest's session is placed, added to the probe and ready on the same page
- [x] 1.6 Recorded in the proposal's Decision log: the setting to ship, the context loss that survived LOD, and that **no trimmed copy of the file is needed**
- [ ] 1.7 Still owed by the owner's eyes, not by a number: whether the scan sits on the real walls at the 60k setting and holds there over a few metres, judged on a walk

## 2. What reading a face costs

- [x] 2.1 Throwaway page on a laptop: the real `room.spz` drawing with `RoomViewer`'s own settings, and MediaPipe's `FaceLandmarker` reading the laptop camera at the hands' 66 ms cadence; keep the frame rate with the face reader off, on, and on beside the hand reader
- [x] 2.2 First pass, and it is not conclusive: a read cost **289 ms** against the 66 ms it needs, with the drawing itself at 2–28 fps. A *Pause the drawing* pass was added to the probe to separate a slow model from a starved one
- [x] 2.3 Measured: **33 ms a read paused, 347 ms while drawing**, and the drawing fell to 0–6 fps with the reader on. The model fits the cadence alone and cannot share the GPU with the scan, so leaning is not affordable as measured

## 3. Can a phone be the room's camera and its tracker at once

- [x] 3.1 Throwaway page on the owner's phone: open the front camera, start an `immersive-ar` session, and report whether the video track stays live and its pictures keep arriving while poses come in
- [x] 3.2 Measured on the owner's phone, and the answer is **both at once**: the front camera stayed live, not muted and enabled throughout, sending 957 pictures over 32 seconds while 919 of 957 frames carried a pose and 375 showed the phone had moved. So the phone in the real home can be the room's camera and say where it is standing, and nothing about it needs building

## 4. Placing the scan against a spot

- [x] 4.1 `app/src/apps/roam/ar-place.ts`: the two-group transform — inner position `(-anchor.x, -anchor.floor, -anchor.z)`, outer `rotation.y = -anchor.yaw` and `scale = 1 / unitsPerMetre(scene)` — as one pure function over plain objects, taking any `Anchor` so a taped spot and a camera pose both place it
- [x] 4.2 `ar-place.test.ts`: the anchor lands at the origin; its facing becomes the session's forward; one real metre is one metre of scan; a pose through `toScanPose` and back returns to where it started, from a spot and from a view alike; every branch covered

## 5. One way to load a scan

- [x] 5.1 `app/src/apps/roam/splat-scene.ts`: build a `SplatMesh` from a scene and a splat URL with the scene's upright rotation and translation applied, as the one place both the laptop and the phone use; the mesh's own options pass straight through, so a phone asks for `lod` and a budget where the laptop asks for neither
- [x] 5.2 `splat-scene.test.ts` covering it, and `RoomViewer.tsx` changed to use it with its existing tests still passing

## 6. Drawing the scan in a session

- [x] 6.1 `app/src/apps/roam/ar-view.ts`: owns the `WebGLRenderer` with `xr.enabled`, the `SparkRenderer`, the placed scan group and the animation loop; `take(session)` sets the reference space type and hands the session to `renderer.xr`; `lineUp(anchor, scene)` places the scan and loads it once; `show(on)`; `dispose()`. The measured phone setting comes from `detail.ts`, and the pose each frame comes from `renderer.xr.getCamera()`, not a second `getViewerPose`
- [x] 6.2 The rolling frame-rate watch and a `webglcontextlost` listener, both reporting once to the caller, which is what ends a guest's walk
- [x] 6.3 `ar-session.ts`: `startAr(hooks, overlay, drawing?)` — with a drawing, skip the dummy layer and hand the session over; with none, behave exactly as today, which is the path both phone screens keep
- [x] 6.4 `ar-view.test.ts` and the added `ar-session.test.ts` case: taking the session, placing on line-up, loading once, turning the scan on and off, the frame-rate floor, a lost context, a scan that will not load, disposal, and the unchanged no-drawing path; every branch covered

## 7. A thumb to move with

- [x] 7.1 `app/src/apps/roam/thumb-pad.ts`: a pure function from a press origin and a current point to `{ forward, side }`, with a dead zone, a linear ramp to a fixed reach and a clamp; the numbers are named constants here
- [x] 7.2 `pov-controls.ts`: one added `push(forward, side)` feeding the vector `update(dt)` already builds, cleared each frame, so the keys and the pad share the speed, the `Shift` boost and the `dt` clamp
- [x] 7.3 `thumb-pad.test.ts` and the added `pov-controls.test.ts` cases: the dead zone, the ramp, the clamp, a push with and without keys, the push clearing itself, and a view jump dropping it; every branch covered
- [x] 7.4 `ThumbPad.tsx` and its place in `RoomViewer.tsx`: shown once a `pointerdown` on the view reports `pointerType` of `touch`, keeping its own pointer, in the lower corner, labelled for a screen reader
- [x] 7.5 `RoomViewer.test.tsx`: the pad appears after a touch and not before, holding it moves the camera, letting go stops it, and a press begun on the pad picks nobody

## 8. The guest's walk

- [x] 8.1 `app/src/apps/roam/use-room-ar.ts`: the guest's lifecycle — `arSupported()` deciding whether to offer it, the anchor built from where the view already stood, the session started with the drawing and the page's own overlay, the place relayed ten times a second, and the renderer disposed when it ends
- [x] 8.2 Carrying on: re-anchor from the place reached and make where the phone now stands the new origin, keeping the facing. `fromOrigin` in `placement.ts` is the maths, tested on its own
- [x] 8.3 Ending: the frame-rate floor, a lost 3D view, *Stop* and the session's own end all return to the page's view looking where the walk reached, with a plain line for the two that are failures
- [x] 8.4 `Scan.tsx`: *Walk it* in the bar once the viewer says where it stands, and while walking *Carry on from here* and *Stop* on the session's own overlay, with the line that says the phone could not carry it
- [x] 8.5 `use-room-ar.test.ts` and the added `Scan.test.tsx` cases: the offer appearing and not appearing, the anchor taken from the view, the place relayed on a gate, carrying on keeping the place, each way out, and nothing holding a renderer afterwards; every branch covered

## 9. The view keeps up on the machine you are on

- [x] 9.1 `app/src/apps/roam/detail.ts`: the settings the view may draw at, heaviest first, and a watch that gives up one step after two seconds under the floor, ignoring a warm-up and never climbing back; the floor, the patience and the warm-up are named constants, and the softest step is the phone's measured setting
- [x] 9.2 `detail.test.ts`: the warm-up spared, a drop after sustained slowness, a dip forgiven, the walk down to the softest step, and no climb back; every branch covered
- [x] 9.3 `RoomViewer.tsx`: apply a step to the renderer and Spark, ask the mesh for the detail tree, and run the watch each frame
- [x] 9.4 `RoomViewer.test.tsx`: full detail while the rate holds, and the budget, the splat size and the pixel ratio all lowered when it does not
- [ ] 9.5 On the walk, record what the detail tree costs at load on a laptop, and whether a machine that holds the floor still looks exactly as it did

## 10. Source review

- [ ] 10.1 Read the whole diff against the design: the placing transform is the inverse of `toScanPose`, no second animation loop exists, nothing holds a renderer after a session ends, the no-drawing path in `ar-session.ts` is untouched, `Phone.tsx` and `Leave.tsx` are untouched, one vector still moves the camera, and both the laptop and the phone take their settings from the one table

## 11. Wiki and checks

- [x] 11.1 `wiki/development/ar-in-the-browser.md`: a section on drawing in a session — handing it to `renderer.xr`, the camera belonging to the phone so the world moves instead, the frame rate each setting held, and what a page can and cannot do with the camera while a session runs
- [x] 11.2 `wiki/stack/live-rooms.md`: what a phone and a laptop in a room can move with, and that the view gives up detail to keep up
- [ ] 11.3 `npm run lint`, `tsc -b`, the ROAM tests at 100% of lines, branches, functions and statements, `npm test`, `knip`, `jscpd`
- [ ] 11.4 `/save`, then walk it on staging: from an Android phone joined to a room, the pad moves you and the others see it, *Walk it* puts you in the scan and your steps move you, carrying on keeps your place, and stopping returns you to the page
- [ ] 11.5 On the same deploy, from the laptop: the room holds a steady rate without stuttering, and a note, a room and the hand signs all behave as they did
- [ ] 11.6 Record the frame rates and the alignment seen on the walk, and whether `PHONE_HEIGHT_M` now needs changing, as a follow-up rather than inside this change

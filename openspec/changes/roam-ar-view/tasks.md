## 1. The frame-rate check

- [ ] 1.1 Put a throwaway page on the owner's Android phone that loads the real `room.spz`, hands an `immersive-ar` session to `renderer.xr`, draws the scan placed against each marked spot, and reports the frame rate with and without the splats
- [ ] 1.2 Done, and it changed the plan: full detail runs at 2–66 fps and loses the 3D view; the scan off holds 88–90
- [ ] 1.3 Step the probe through `lod` with a 250k, 120k and 60k splat budget, with the pixel ratio and `maxStdDev` behind each, and keep the frame rate for each setting; confirm three.js's own camera moves on the frames `getViewerPose` answers with nothing
- [ ] 1.4 Add one pass with the anchor taken from a made-up camera pose rather than a marked spot, which is how a guest's session is placed, and keep its frame rate beside the others
- [ ] 1.5 Record in the proposal's Decision log: the setting that holds a usable rate, whether the scan sat on the real walls at it, and whether a trimmed copy of the file is needed after all

## 2. What reading a face costs

- [ ] 2.1 Throwaway page on a laptop: the real `room.spz` drawing with `RoomViewer`'s own settings, and MediaPipe's `FaceLandmarker` reading the laptop camera at the hands' 66 ms cadence; keep the frame rate with the face reader off, on, and on beside the hand reader
- [ ] 2.2 Record in the Decision log what it cost. If the scan cannot spare it, drop section 9 from this change, say so there, and leave everything else as planned

## 3. Placing the scan against a spot

- [ ] 3.1 `app/src/apps/roam/ar-place.ts`: the two-group transform — inner position `(-anchor.x, -anchor.floor, -anchor.z)`, outer `rotation.y = -anchor.yaw` and `scale = 1 / unitsPerMetre(scene)` — as one pure function over plain objects, taking any `Anchor` so a taped spot and a camera pose both place it
- [ ] 3.2 `ar-place.test.ts`: the spot lands at the origin; its facing becomes the session's forward; one real metre is one metre of scan; a pose through `toScanPose` and back through this transform returns to where it started; an anchor built from a camera pose places the same way; every branch covered

## 4. One way to load a scan

- [ ] 4.1 `app/src/apps/roam/splat-scene.ts`: build a `SplatMesh` from a scene and a splat URL with the scene's upright rotation and translation applied, and dispose it, as the one place both the laptop and the phone use; it takes the detail settings so the phone asks for `lod` and a budget where the laptop asks for neither
- [ ] 4.2 `splat-scene.test.ts` covering it, and `RoomViewer.tsx` changed to use it with its existing tests still passing

## 5. Drawing the scan in the session

- [ ] 5.1 `app/src/apps/roam/ar-view.ts`: owns the `WebGLRenderer` with `xr.enabled`, the `SparkRenderer`, the placed scan group and the animation loop; `take(session)` sets the reference space type and hands the session to `renderer.xr`; `lineUp(anchor, scene)` places the scan; `show(on)` turns the placed group's `visible` on and off; `dispose()` tears the lot down. Whether it starts shown is the caller's, since the note screen starts off and a guest starts on. The detail settings the probe chose — the splat budget, `lodRenderScale`, the pixel ratio and `maxStdDev` — are named constants in this one module, and the pose each frame comes from `renderer.xr.getCamera()`, not a second `getViewerPose`
- [ ] 5.2 The rolling frame-rate watch in the same module: below the floor for the set number of seconds, report it once and let the caller decide what to do about it — the note screen turns the scan off, a guest's walk ends; a `webglcontextlost` listener reports the same way, since the phone did lose the context at full detail
- [ ] 5.3 `ar-session.ts`: `startAr(hooks, overlay, view?)` — with a `view`, skip the dummy layer, hand the session over, and read each pose inside the view's frame; with no `view`, behave exactly as today
- [ ] 5.4 `ar-view.test.ts` and the added cases in `ar-session.test.ts`: taking the session, placing on line-up, turning the scan on and off, the frame-rate floor firing and not firing, a failed renderer, tracking lost, stopping, and the unchanged no-`view` path; every branch covered

## 6. One phone-AR lifecycle for both screens

- [ ] 6.1 Pin today's behaviour first: `Phone.test.tsx` and `Leave.test.tsx` pass unchanged before anything moves, and keep passing unchanged after
- [ ] 6.2 `app/src/apps/roam/use-phone-ar.ts`: one hook owning what `Phone.tsx` and `Leave.tsx` each write by hand today — the `checking`/`unsupported` step, the `arSupported()` answer, the scene load from `/apps/<app>/scene.json`, the session ref stopped on unmount, the tracking-lost flag and the overlay element — with each screen passing in its pose handler, where a session's end returns to, and whether a live session is reused
- [ ] 6.3 `use-phone-ar.test.ts` covering it, and both screens moved onto it: `Phone.tsx` stays on the no-`view` `startAr` path, so its behaviour is identical
- [ ] 6.4 Compare the two screens before and after. If neither reads more plainly, put the hook back, keep the rest of this change, and say why in the Decision log

## 7. The phone's note screen

- [ ] 7.1 `Leave.tsx`: build the view when a spot is picked, place it again on *Line up again*, dispose it when the session ends, and keep the existing spot picker, walking bar and compose panel unchanged
- [ ] 7.2 The *Scan on* / *Scan off* button beside the primary one with a tag saying which state it is in, starting off, and the line that appears when the phone could not carry the drawing
- [ ] 7.3 Keep the module under the complexity the linter allows: the view's own lifecycle goes into its own hook beside the session hook from section 6, not inline
- [ ] 7.4 `Leave.test.tsx`: the view is built and placed on picking a spot, placed again on lining up again, turned on and off by the button, turned off by the frame-rate floor with notes still working, and disposed when the session ends

## 8. A thumb to move with

- [ ] 8.1 `app/src/apps/roam/thumb-pad.ts`: a pure function from a press origin and a current point to `{ forward, side }`, with a dead zone, a linear ramp to a fixed radius and a clamp; the radius and dead zone are named constants here
- [ ] 8.2 `pov-controls.ts`: one added `push(forward, side)` that feeds the vector `update(dt)` already builds, cleared each frame, so the keys and the pad share the speed, the `Shift` boost and the `dt` clamp and nothing else touches `camera.position`
- [ ] 8.3 `thumb-pad.test.ts` and the added `pov-controls.test.ts` cases: the dead zone, the ramp, the clamp, a push with no keys, a push with keys, the push clearing itself, and `sync()` dropping it; every branch covered
- [ ] 8.4 `ThumbPad.tsx` and its place in `Scan.tsx`: shown once a `pointerdown` on the view reports `pointerType` of `touch`, captures its own pointer, sits in the lower corner, and is labelled for a screen reader
- [ ] 8.5 `Scan.tsx` and `RoomViewer.tsx` tests: the pad appears after a touch and not before, holding it moves the camera, dragging the view still looks, and a press begun on the pad picks nobody even when it ends over a figure

## 9. Leaning towards the view

- [ ] 9.1 Vendor the face model beside the hand model with the existing script, and check the file is under Cloudflare's 25 MiB asset limit
- [ ] 9.2 `app/src/apps/roam/face.ts`: MediaPipe's `FaceLandmarker` behind the same `make` seam `hands.ts` uses, read at `EVERY_MS`, over the stream the room already opened — the only file that imports it
- [ ] 9.3 `app/src/apps/roam/head-offset.ts`: a pure function from a face's position and apparent size in the frame to a small `{ x, y, z }` in metres, scaled by `unitsPerMetre(scene)`, clamped to the named limit and smoothed; the limit and the smoothing live here
- [ ] 9.4 `head-offset.test.ts`: a centred face offers nothing, a lean each way offers the right sign, a face nearer the camera moves in, the clamp holds at the extremes, a lost face returns to nothing rather than sticking, and the smoothing settles; every branch covered
- [ ] 9.5 `RoomViewer.tsx`: add the offset to the camera immediately before `renderer.render` and take it off immediately after, so `stanceOf`, the sound listener and picking all read the base position
- [ ] 9.6 `Scan.tsx`: a *Lean to look* button beside *Hands on*, off until pressed, with a tag while it is on and a plain line where the browser cannot read a face
- [ ] 9.7 `RoomViewer.test.tsx` and `Scan.test.tsx`: the drawn camera is offset and the reported stance is not, the offset is removed after drawing, turning it off restores the view exactly, and a browser that cannot read a face says so and changes nothing

## 10. The guest's walk

- [ ] 10.1 `app/src/apps/roam/use-room-ar.ts`: the guest's own lifecycle over `use-phone-ar`'s parts and `ar-view` — `arSupported()` deciding whether to offer it at all, the anchor built from `stanceOf(camera)` at the press, the session started with the view, the scan shown from the first frame, and the renderer disposed when it ends
- [ ] 10.2 Carrying on: re-anchor from the current drawn pose and reset the session's origin to where the phone now is, keeping the place reached in the scan and the current facing
- [ ] 10.3 Ending: the frame-rate floor, a lost 3D view, the person's *Stop* and the session's own end all return to the page's view, looking from where they had walked to, with a plain line for the two that are failures
- [ ] 10.4 `Scan.tsx`: *Walk it* in the bar beside *Hands on*, offered only where the phone can track; while walking, *Carry on* and *Stop* over the view with a tag saying it is walking, and the line that says the phone could not carry it
- [ ] 10.5 `use-room-ar.test.ts` and the added `Scan.test.tsx` cases: the offer appearing and not appearing, the anchor taken from where the view stood, walking relaying the place to the room, carrying on keeping the place and moving the origin, each of the four ways out, and nothing holding a renderer afterwards; every branch covered

## 11. Source review

- [ ] 11.1 Read the whole diff against the design: the transform is the inverse of `toScanPose`, no second animation loop exists, nothing holds a renderer after a session ends, the no-`view` path is untouched, neither phone screen still keeps its own copy of the session lifecycle, one vector still moves the camera, and the head offset reaches nothing but the drawn frame

## 12. Wiki and checks

- [ ] 12.1 `wiki/development/ar-in-the-browser.md`: a section on drawing in a session — handing it to `renderer.xr`, the camera belonging to the phone so the world moves instead, the frame rate the owner's phone actually held, and the difference between placing against a taped spot and placing against where a guest's view already stood
- [ ] 12.2 `wiki/stack/live-rooms.md` and `wiki/stack/hand-signs.md`: what a phone and a laptop in a room can move with, and that the face reader shares the camera the hands already use
- [ ] 12.3 `npm run lint`, `tsc -b`, the ROAM tests at 100% of lines, branches, functions and statements, `npm test`, `knip`, `jscpd`
- [ ] 12.4 `/save`, then walk it on staging from the Android phone: the scan appears over the real home, holds its place over a few metres, turns off and on again, lines up again on each floor, and a note still lands where it was left
- [ ] 12.5 On the same staging deploy, join the room from a second phone and a laptop: the pad moves the guest and the others see it, *Walk it* puts them in the scan and their steps move them, carrying on keeps their place, stopping returns them to the page, and leaning shifts the laptop's view without moving the figure anybody else sees
- [ ] 12.6 Record the frame rates and the alignment seen on both walks, and whether `PHONE_HEIGHT_M` now needs changing, as a follow-up rather than inside this change

## 1. The figure source and the scripted path

- [ ] 1.1 Write `app/src/apps/roam/figure-source.ts`: the `FigurePose = { x, y, z, yaw }` and `FigureSource = { id, name, poseAt(seconds) }` types, `floorHeight(scene)` and `eyeHeight` from the median camera `eye.y` ([why not metres](design.md#the-scans-units-are-not-metres)), and `scriptedSource(scene, options)` — waypoints from each camera `eye` projected to the floor, waypoints closer than a threshold dropped, a closed polyline walked at a constant speed, yaw from the direction of travel with an eased turn.
- [ ] 1.2 Write `figure-source.test.ts`: the floor and eye heights from a fixture scene, waypoint thinning, a pose exactly on a waypoint, a pose between two, wrap-around past the end of the loop, yaw facing travel, a degenerate single-waypoint scene, and that no pose leaves the scene's bounds.

## 2. Placement, selection, and the audio curves

- [ ] 2.1 Write `figures.ts`: `billboardYaw(figure, cameraPosition)` turning the plane to face the camera in the horizontal plane only, the plane's size from `eyeHeight`, and `pointerRay(event, bounds)` giving normalised pointer coordinates for a raycast.
- [ ] 2.2 Write `figures.test.ts`: facing from several camera positions including directly above and directly below, a camera at the figure's own position, and pointer coordinates at each corner and the centre of a non-square box.
- [ ] 2.3 Write `audio.ts` by [the graph](design.md#how-the-sound-is-built): `gainFor(distance)` on the inverse law clamped to a non-zero floor with `ref` and `max` derived from `eyeHeight` and the scene extent, `listenerFrom(cameraPose)` giving the listener position and forward/up vectors, and the unlock state (`'blocked' | 'running'`).
- [ ] 2.4 Write `audio.test.ts`: gain at zero, at `ref`, and beyond `max` (faint, never zero), that it never rises with distance, listener vectors for a camera looking along each axis and straight down, and the unlock transition including a second click changing nothing.
- [ ] 2.5 Write `watch-state.ts`: `{ mode: 'room' } | { mode: 'watching', id, saved }` with `watch(id, pose)` and `close()`, and `watch-state.test.ts` covering watch, close restoring the saved pose, watching a second figure while watching one, and closing when nothing is watched.

## 3. The viewer and the overlay

- [ ] 3.1 Add the figure to `RoomViewer.tsx`: build the plane and its material once, draw the placeholder with a `CanvasTexture` person silhouette, advance the pose from the source each frame of the existing `setAnimationLoop`, apply the billboard facing, and dispose geometry, material and texture on unmount.
- [ ] 3.2 Build the audio graph in `RoomViewer.tsx` by [the graph](design.md#how-the-sound-is-built): an `OscillatorNode` placeholder through `GainNode → PannerNode(HRTF) → destination`, the listener set from the camera each frame via `listenerFrom` (`setValueAtTime` where the params exist, else `setPosition`/`setOrientation`), the gain applied with `setTargetAtTime` so fast movement does not click, `resume()` once on the first pointer down, and full teardown on unmount.
- [ ] 3.3 Add selection: a `Raycaster` against the figure planes only on click, reporting the hit figure and the live camera pose upward; a click that hits nothing reports nothing.
- [ ] 3.4 Extend `RoomViewer.test.tsx` with `three` and Web Audio mocked, as the shipped tests mock Spark: the figure is added and disposed, its pose advances with the frame clock, the listener follows the camera, the gain changes with distance, unlock happens once on the first pointer down, a click on the plane reports the figure, and a click on nothing reports nothing.
- [ ] 3.5 Add the watch overlay and the *sound off* tag to `App.tsx`: the overlay card over the canvas holding the figure's video with *Close* as its one primary action, the tag shown until audio is running, and the saved pose dispatched back through the existing `pose` prop on close.
- [ ] 3.6 Add *Full screen* to `App.tsx`: `requestFullscreen` on the view's box, the button's label following `document.fullscreenElement`, and exit restoring the page.
- [ ] 3.7 Extend `App.test.tsx`: the tag appears and goes, the overlay opens on a reported figure and closes restoring the pose, *Full screen* enters and leaves, and the loading, error, and no-WebGL states still render as they do today.

## 4. Verification

- [ ] 4.1 From `app/`, run the full suite (`npm test`): lint, types, every-line coverage, runtime tests, knip, jscpd, key and action checks — all green. Log any loosened check as a `Check:` bullet in the Decision log.
- [ ] 4.2 Confirm no new package was added and every file under `app/public/apps/roam/` is still under 25 MiB.
- [ ] 4.3 `/save`, then preview from the agent host and open `/apps/roam/`: the figure walks the filmed route, the first click starts the sound and clears the tag, the voice grows and shifts as you walk and turn, clicking the figure fills the view and closing returns you to the same spot, and *Full screen* fills the display. Judge the figure's size and the path by eye and tune `eyeHeight` if it looks wrong.
- [ ] 4.4 Walk the demo once end to end as it will be performed on stage, from a cold page load, and note anything that needs a second look before it is shown.

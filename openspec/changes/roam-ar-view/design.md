## Context

ROAM's phone screen, `app/src/apps/roam/Leave.tsx`, runs an `immersive-ar` session purely to know where the phone is. `startAr` in `ar-session.ts` attaches a render layer that nothing ever draws into, reads `getViewerPose` once a frame, and hands the page's buttons to the browser as a DOM overlay. The person sees their own camera view and our controls, and nothing else. `toScanPose` turns the pose into a place in the scan so a note lands there; nothing in the scan is ever drawn on the phone.

The scan itself is drawn only on a laptop, by `RoomViewer.tsx`: a `WebGLRenderer`, a `PerspectiveCamera` the page moves, a `SparkRenderer` and one `SplatMesh` loaded from `app/public/apps/roam/room.spz` — two floors, 546,977 splats, 11.6 MB, with its upright rotation, translation and both floor heights in `scene.json`.

Checked while planning, so this is a supported path rather than a hack: the installed `@sparkjsdev/spark` already reads `renderer.xr.isPresenting`, draws with `renderer.xr.getCamera()` and respects the session's own layer. `SplatMesh` also carries a whole-mesh `opacity`, should a fade ever be wanted alongside turning the scan off.

The other half of this change is the guest's side of the same room. `Room.tsx` → `Scan.tsx` → `RoomViewer.tsx` puts a joiner in that same laptop viewer, and the camera there is driven entirely by `pov-controls.ts`: a `keydown`/`keyup` set over `KeyW`/`KeyA`/`KeyS`/`KeyD`/`KeyQ`/`KeyE`/`Shift`, a pointer drag that sets yaw and pitch, and a wheel that moves along the view direction. `update(dt)` turns the held keys into one movement vector and adds it to `camera.position`. On a touch screen the drag works and **the key set is unreachable**, so a phone guest today can look from one spot and nothing more. `RoomViewer` already sends `stanceOf(camera)` ten times a second, so whatever moves that camera moves the figure everybody else sees, with no protocol change. `placement.ts` already holds `unitsPerMetre(scene)`, the one number that turns real metres into scan units, and `anchorAt`/`toScanPose` already place a phone's tracked pose into the scan.

Constraints that carry over from [AR in the browser](../../../wiki/development/ar-in-the-browser.md), all measured on the owner's Android phone (Chrome 155):

- A session with no render layer answers every frame with no pose. Three.js attaches a real one, so this becomes true by construction rather than by the dummy layer `attachLayer` makes today.
- `domOverlayState.type` reads `screen`, and presses reach the page. The overlay element must stay in the page so React keeps owning it.
- The camera belongs to ARCore while a session runs; `getUserMedia({ video })` is refused. Nothing here needs it — the camera's picture is the backdrop the compositor draws for us.
- Android Chrome only. An iPhone has no WebXR and keeps today's fallback.

## Goals / Non-Goals

**Goals:**

- The scanned home drawn over the real one through the phone's AR session, placed against the marked spot the person lined up on.
- The view moving with the phone's real pose, with no page-driven camera.
- The scan turned on and off by one press, so alignment and scale can be judged by eye against the real room.
- Notes left and notes already here, both visible in the same session.
- A phone that cannot carry the drawing left with today's working note screen.
- A guest who joined the room from anywhere walking the scan by walking their own floor, at life size, on a phone that can track.
- Some way for every touch screen to move through the scan, which none has today.
- A laptop's own camera shifting the view as the viewer leans, as a window does.

**Non-Goals:**

- Live figures of other people drawn over the real room. The scan is what is placed; people are a separate piece of work on the `roam-body` branch.
- Occluding the scan behind real walls. There is no depth handling anywhere in ROAM and WebXR depth sensing is its own change.
- A new way to line up. The taped spots stay; image targets need a Chrome flag.
- Changing `PHONE_HEIGHT_M` as part of this change. This change is what makes the right value *visible*; setting it is a one-line follow-up once the owner has looked.
- Any server, schema or storage change.
- Reading a phone's orientation sensors (`DeviceOrientationEvent`). It would give every phone, iPhones included, turn-to-look for a few lines — and it was the recommendation — but it was not chosen, and adding it beside the pad and the session would be a third way to aim one camera.
- Amplifying anything: a real step is one scan metre, and a lean is a lean.
- Leaning as a way to travel, or head tracking on a phone.
- Drawing other people's figures inside a guest's AR session. The figures are `roam-body`'s; this change places the guest's own view only.

## Decisions

**Three.js owns the session; the scan is moved to meet it.** `renderer.xr.enabled = true`, `renderer.xr.setReferenceSpaceType('local-floor')`, then `renderer.xr.setSession(session)`. From there `renderer.render(world, camera)` inside `renderer.setAnimationLoop` draws through `renderer.xr.getCamera()`, which is driven by the phone. The camera therefore cannot be positioned by the page, so the splat scan is positioned, turned and scaled instead, such that the lined-up spot sits at the session's origin. The alternative — keeping our own camera and setting it from `getViewerPose` each frame — loses the per-eye projection, the correct field of view and the compositor's reprojection, and fights Spark's existing XR path for no gain.

**The placing transform is its own pure module.** Two nested groups, so the maths is a few assignments and every line is testable without a GPU:

| | Set to | Why |
|---|---|---|
| inner group | position `(-anchor.x, -anchor.floor, -anchor.z)` | puts the taped spot at the origin, standing on its own floor |
| outer group | `rotation.y = -anchor.yaw` | turns the scan so the spot's facing is the session's forward |
| outer group | `scale = 1 / unitsPerMetre(scene)` | one real metre becomes one metre of scan |

This is exactly the inverse of `toScanPose`, which is the point: the same anchor and the same `unitsPerMetre` place both the view and the notes, so they cannot disagree. A test asserts that round trip — a pose through `toScanPose`, then through this transform, lands back where it started.

**The scan is turned on and off by one button, and it starts off.** The placed group's `visible` is the whole mechanism, so an off scan costs nothing to draw — which also makes it the way back when the frame rate is too low, with no second mechanism to keep working. Starting off means the person sees the real room first and turns the scan on where they meant to, rather than being dropped into a half-aligned overlay.

The earlier choice was a fade slider over `SplatMesh.opacity`, which exists on the mesh and would have worked. The toggle replaced it: flicking between the real wall and the scanned wall shows a misalignment at least as plainly as blending them, it is one thumb press while walking rather than a drag, and an off scan draws nothing where a half-faded one still costs full fill rate on the one device with none to spare. `opacity` stays available if a fade is ever wanted back.

**`ar-session.ts` gains a drawing partner rather than a second loop.** `startAr(hooks, overlay, view?)`. With no `view` it behaves exactly as today, including the dummy layer, which is what `Phone.tsx` keeps using. With a `view` it skips the dummy layer, calls `view.take(session)`, and reads each pose inside the view's frame callback, so the session has one animation loop and one pose reader. Two loops on one session is legal and wasteful, and makes "which frame did this pose come from" unanswerable.

**Both phone screens share one session lifecycle, before this change touches `Leave.tsx`.** `Phone.tsx` and `Leave.tsx` each hold their own copy of the same lifecycle: the `checking`/`unsupported` step, the effect that asks `arSupported()` and loads `scene.json` and stops the session on unmount, the tracking-lost flag, the overlay ref, and `startAr` in a `try`/`catch` that falls back to *unsupported*. Commit `79e7363`, which added the second screen, already had to reach back into the first and pull `PhoneStart.tsx` out of it, and the two copies have since drifted — `Leave` reuses a live session and clears the ref when it ends, `Phone` does neither. `jscpd` cannot see it, because the copies share a shape rather than tokens. So `use-phone-ar.ts` comes first, with both screens on it and their existing tests unchanged, and only then does this change grow the drawing on top. Doing it afterwards would mean reshaping a screen twice; doing it in a separate change would collide with this one over the same file.

**Loading a scan moves to one module.** `RoomViewer.tsx` and the AR view both build a renderer, a `SparkRenderer` and a `SplatMesh` with the scene's rotation and translation. The common part becomes `splat-scene.ts`, used by both, so the upright transform cannot drift between the laptop and the phone — and because the duplicate-code check would refuse the second copy anyway.

**A frame-rate floor drops the drawing, not the session.** The loop keeps a one-second rolling frame rate. Below a floor for several seconds running, the scan is turned off by the same mechanism the button uses, the button goes away and a line says the phone could not carry it; tracking, walking and leaving notes go on untouched. A stuttering overlay while someone is trying to leave a note is worse than no overlay. The floor and the number of seconds are constants in one place.

**The session starts before the scan has arrived.** Measured while planning: the 12.5 MB scan came off Cloudflare's edge at 268 KB/s, about three quarters of a minute. So picking a spot starts the session and tracking at once, the download's progress is said on the overlay, and the scan appears when it lands. Waiting for the file before the session would leave someone standing in their hallway looking at a blank page. The file is served with an immutable cache header already, so it is a first-visit cost.

**The scan is drawn through Spark's level of detail, with a budget.** Measured on the owner's phone: the whole scan at full detail runs at 2–66 frames a second and loses the WebGL context, against 88–90 with the scan off. So a budget is not an optimisation, it is the only way this works at all.

Spark already has the machinery — a level-of-detail tree with a target splat count, which it defaults to 500–750k *for WebXR*. It only applies when a mesh is built with `lod`, which ROAM's never has been, so the phone was drawing every splat with nothing culled. The settings that matter, in the order they are worth reaching for:

| Lever | What it does |
|---|---|
| `lod: true` on the mesh | turns the level-of-detail tree on at all; without it none of the rest applies |
| `lodSplatCount` on the renderer | the target number of splats drawn, whatever the file holds |
| `lodRenderScale` | the smallest a drawn splat may be in pixels; raising it stops capacity going on splats smaller than a pixel |
| `renderer.setPixelRatio` | splat drawing is fill-rate bound, so fewer pixels is close to a linear saving |
| `maxStdDev` on the renderer | how far out each Gaussian is drawn; lower trades a little softness for a lot of fill rate |

Which combination ships is measured, not chosen here: the probe steps through four settings and keeps the frame rate for each. The laptop keeps today's full-detail path, because it holds 90 frames a second already.

**A trimmed copy of the file is the fallback, not the first move.** If the budget alone cannot hold a usable rate, a second smaller `.spz` is generated for phones — one build step and one public file. It is second because it costs a pipeline step and a file to keep in step with the scan, where the budget costs one constructor option.

**Both floors are drawn.** Once the scan is placed against a spot, the other floor sits above or below where it really is. Hiding it would need a cut plane and would hide the stairs, which is the one place the two floors meet and the one place a misalignment shows up plainly.

### The guest's own device moves them

**One movement vector, three sources.** `pov-controls.ts` already builds exactly one vector per frame in `update(dt)` and adds it to the camera. The pad and the keys both feed *that*, through one added method — `push(forward, side)`, cleared each frame — rather than either touching `camera.position`. The head offset is the one thing that is not movement, and it is applied separately, below. Two code paths moving one camera is how a drift between touch and keyboard would start, and it would show up as the two disagreeing about `speed`, the `Shift` boost and the `dt` clamp.

**The thumb pad is a plain function plus a thin control.** `thumb-pad.ts` turns a press origin and a current point into a `{ forward, side }` pair: a dead zone inside a few pixels, linear out to a fixed radius, clamped to one. That is the whole of the maths and it is tested with no DOM. `ThumbPad.tsx` is a positioned element in `Scan.tsx` that captures its own pointer and calls it — so the existing drag-to-look, which listens on the canvas, never sees the pad's pointer, and the click-to-pick handler cannot fire from a press that began on the pad. Shown when the view is touched rather than by sniffing the device: a `pointerdown` whose `pointerType` is `touch` reveals it, so a laptop with a touch screen gets it when it is used and never otherwise.

**A guest's session is the same two modules, anchored differently.** `ar-view.ts` and `ar-place.ts` do not change for this. What differs is where the anchor comes from: standing in the real home it is a taped spot from `markedSpots`; joined from elsewhere there is no taped spot and no real room to line up with, so **the anchor is the camera's own pose at the press** — position, floor under it, and yaw from `stanceOf(camera)`. The person keeps the view they had and starts walking from it. One consequence worth stating: `ar-place.ts` therefore takes an `Anchor`, which `anchorAt` and `stanceOf` can both produce, and nothing in it knows which.

**Carrying on walking re-anchors, it does not teleport.** *Carry on* (the guest's one extra press) takes where they have reached in the scan and makes where they are now physically standing the new origin, by re-anchoring with the current drawn pose and resetting the session's reference space offset. So a two-metre hallway at home crosses the whole home in a few presses, with nothing lost in between. The alternative, returning them to the middle of the home, throws away the only thing they were trying to keep. Jumping deliberately across the home is already the camera chooser's job.

**For a guest the scan starts drawn, and failure ends the session.** Opposite to the note screen, and for one reason: a guest turning the scan off is left looking at their own living room through their own camera, which is not a view of anything. So there is no *Scan off* button in a room, the scan is on from the first drawn frame, and the frame-rate floor and `webglcontextlost` **end the session** and return them to the ordinary page view, where the pad and the drag still work. The same watch, two different last resorts.

**Leaning is an offset on the drawn camera, never the camera's place.** `head-offset.ts` turns a face's position and apparent size in the frame into a small `{ x, y, z }` in metres — side to side, up and down, and nearer or further — scaled by `unitsPerMetre(scene)`, clamped to a few centimetres of scan, and smoothed so a jumpy read does not shake the view. `RoomViewer` adds it to the camera just before `renderer.render` and takes it off after, so:

| Reads the camera | Sees |
|---|---|
| the drawn frame | the leaned position |
| `stanceOf`, sent to the room | the base position, so no figure jitters |
| notes, picking, the sound listener | the base position, so a lean never moves what you hear or hit |

That ordering is the decision. An offset that leaked into the stance would be relayed ten times a second and every other page would wobble.

**The face reader copies the hand reader exactly.** `face.ts` owns `FaceLandmarker` and nothing else, behind the same `make` seam `hands.ts` uses, so everything above it is tested with no camera: one module imports MediaPipe, read at the hands' own `EVERY_MS` cadence, over the stream the room already opened for the person's figure — no second permission and no second device, as [hand signs](../../../wiki/stack/hand-signs.md#reading-hands-is-a-camera-the-page-already-has) already establishes. The model file is vendored to our own origin by the same script that vendors the hand model. It is off until asked for, because it costs the camera and CPU, and it is measured before it is built: if a laptop cannot read a face and draw the splats at once, leaning is dropped from this change rather than shipped slow.

## UX

**Who and the job.** The owner, or whoever is handing the home over, standing inside the real home with an Android phone. The job: see the scanned copy of the home sitting on the real one, walk through it, and leave a note knowing it landed on the thing it describes. Done looks like a note left and its marker visibly on the right object. This is the common case; the edge case is a phone that cannot draw it, which must still leave notes. The owner expects to do this in bursts — a walk round the home, several notes — not continuously.

The closest existing screen is the one being changed: `Leave.tsx`, whose spot picker, walking bar and compose panel all stay. The job is done on a phone, so the phone layout is the only layout.

**The shortest flow.** Open the link → pick the taped spot you are standing on → the scan appears over the room → walk to the thing → *Leave a note here* → write, say or photograph it → *Leave it*. The same number of presses as today; the drawing appears at the step where the session already starts.

**Hierarchy.** One primary action per step, unchanged: *Pick a spot*, then *Leave a note here*, then *Leave it*. *Scan on* / *Scan off* is a secondary button beside the primary one, with a tag saying which state it is in, so there is no doubt whether a blank view means the scan is off or the drawing has failed. The frame-rate line, the tracking-lost tag and the lined-up tag are status, not actions.

**Component inventory.** All existing: `Card`, `Button`, `Badge`, `Input`, `Label`, plus the DOM overlay container already in `Leave.tsx`. No new control and no new component — turning the scan on and off is one more `Button` beside the others.

### The guest in the room

**Who and the job.** Somebody sent the link and joined from wherever they are — a sofa, a desk, a train — on a phone or a laptop. The job: get around the home and see it, without being told to hold keys they may not have. Done looks like having been somewhere: they walked into a room and looked at a thing. The common case is a phone, because that is what a shared link gets opened on, and the phone is exactly the case that cannot move today.

**The shortest flow.** Open the link → say your name → you are in the room → press the pad to walk, drag to look. On an Android phone, *Walk it* instead, and then it is your feet; *Carry on* when the real floor runs out; *Stop* to come back to the page. On a laptop, *Lean to look* if they want the view to follow their head.

**Hierarchy.** The view fills the screen and the controls stay out of its way. The pad sits in the lower corner of the view, under a thumb, and appears on the first touch. *Walk it*, *Hands on* and *Lean to look* are the same weight as each other, in the bar that already holds *Hands on* and the camera chooser. Inside a session there is one primary — *Carry on* — with *Stop* beside it, and a line saying the scan could not be carried if that is why the session ended. Nothing new is a dialog.

```screen
<div class="card col gap phone">
  <div class="row gap"><span class="tag">walking · the lobby</span><span class="grow"></span><span class="tag-outline">Stop</span></div>
  <div class="bar">the scanned home, filling the view</div>
  <div class="row gap"><button class="btn-primary">Carry on</button><span class="grow"></span><span class="bar">turn your body to look</span></div>
</div>
```

**Component inventory.** All existing: `Button`, `Badge`, and the bar in `Scan.tsx` that already holds *Hands on*. One new control, the pad, which is a plain positioned element rather than a component anything else reuses.

### Review

The review page is [`review.html`](review.html). The *What Changes* items that sketch the screens are **One button turns the scan on and off**, which sketches the phone while a session runs, **The scan appears over the real room, and stays put as you walk**, which shows the before and after of what the phone displays, and **Every phone in a room can finally move**, which sketches the guest's view with the pad on it.

## Risks / Trade-offs

- **The phone cannot draw half a million splats — measured at 2 fps and a lost context** → so it does not: the mesh asks for `lod` and the renderer is given a splat budget, with the pixel ratio and `maxStdDev` behind it. The probe picks the numbers before any of this is built, and the frame-rate floor still hides the drawing if the chosen setting fails on another phone.
- **Losing the WebGL context mid-session leaves a dead view and a live session** → `webglcontextlost` turns the scan off and says so, exactly as the frame-rate floor does; the session, tracking and notes carry on. `RoomViewer.tsx` already has this listener to copy.
- **A lower pixel ratio and a lower `maxStdDev` make the scan look softer than the laptop's** → accepted, and the comparison nobody makes: a phone held at arm's length in a real room is not judged against a desktop window. What matters is whether the scanned wall sits on the real wall.
- **The scale constant is still a guess, so the scan may sit visibly off the real walls** → that is the point of turning it off and on; this change makes the error visible and a one-line follow-up fixes it. Said plainly on the screen is better than a note landing wrong in silence.
- **Tracking drifts over a long walk, so the overlay slides off the room** → *Line up again* already exists and now has a visible effect; the drift is obvious rather than silent.
- **Three.js taking the session over could break the DOM overlay or the existing pose reporting** → checked on the phone: the overlay still reads `screen` and takes presses, and the scan drew. But four frames in five answered our own `getViewerPose` with nothing while three.js held the session, which the note screen depends on for where a note lands → the page takes its pose from `renderer.xr.getCamera()`, the camera three.js has already moved, rather than asking the frame a second time. The next run confirms that camera moves on the frames the direct query comes back empty on; the no-`view` path, which has no three.js camera, keeps reading the frame as it does today.
- **A WebGL context is created on a phone that may already be short of memory** → the renderer is built only when a spot is picked and disposed when the session ends, not held for the life of the page.
- **`Leave.tsx` is already near the complexity the linter allows** → the AR view's lifecycle lives in its own module and its own hook, not inline.
- **A guest's AR session composites their own room behind the scan, and there is no way to stop it** → a phone browser has no VR mode to ask for, so where the splats are thin or absent — a ceiling, a gap in the scan — the guest sees their own living room through the home. Accepted, and said plainly in the walking bar rather than hidden; the splat budget's `maxStdDev` also decides how much shows through, so the probe is the place it gets judged.
- **Walking a real floor while looking at somewhere else is how people hit furniture** → the session says *turn your body to look* and nothing invites a long walk; *Carry on* is the design's answer to a small room, so there is no reason to cross one. Nothing software can do removes this, and it is the same bargain every AR page makes.
- **A guest's walk-through has never been measured — only the note screen's drawing has** → it draws the same scan through the same module, so the measured budget carries over, but the probe adds the guest's anchor to its passes before any of it is built.
- **Reading a face may cost more than the splats can spare on a laptop** → measured first, off by default, and dropped from this change rather than shipped slow. The hands already prove the shape works at 66 ms; the face model is a second model and a second cost, and the two may not be wanted at once.
- **Leaning could sicken somebody, since the view moves without them asking** → it is off until turned on, it is clamped to a few centimetres, and it follows the head rather than leading it, which is the direction that does not fight the inner ear. Turning it off is the same press that turned it on.
- **The pad could swallow a press meant for a person or a note** → the pad owns its own pointer through `setPointerCapture`, so the canvas never sees that press at all; the test for it is a press starting on the pad and ending over a figure, which must pick nobody.
- **A phone's tracking reports the real floor, so a guest walking a flat room stays at one height in a scan with stairs** → that is correct and worth naming: the stairs are climbed by the pad or the camera chooser, not by walking at home.

## Migration Plan

Additive and reversible. No migration, no schema, no stored data, no route change. The phone screen keeps its current behaviour when the browser has no AR, when the renderer fails to build, and when the frame rate is too low — three separate ways back to exactly today. In a room, the keyboard and the drag keep working untouched, the pad is added rather than replacing anything, walking and leaning are both off until pressed, and ending either returns to the ordinary view. Rolling back is reverting the branch.

## Open Questions

- Whether the full scan holds a usable frame rate on the owner's phone. Out on the phone now; it picks between shipping the scan as it is and adding a trimmed copy, and does not change the code.
- What reading a face costs on a laptop while the splats draw. Measured in the same way, before the leaning is built; a cost the scan cannot spare drops the leaning from this change and nothing else moves.

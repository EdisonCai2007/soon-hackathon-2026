## Context

ROAM's room viewer, `Room.tsx` → `Scan.tsx` → `RoomViewer.tsx`, is how anybody who did not travel to the home is in it: a `WebGLRenderer`, a `PerspectiveCamera` the page moves, a `SparkRenderer` and one `SplatMesh` from `app/public/apps/roam/room.spz` — two floors, 546,977 splats, 11.6 MB, with its upright rotation, translation and both floor heights in `scene.json`. The camera is driven entirely by `pov-controls.ts`: a `keydown`/`keyup` set over `KeyW`/`KeyA`/`KeyS`/`KeyD`/`KeyQ`/`KeyE`/`Shift`, a pointer drag for looking, and a wheel along the view direction. `update(dt)` turns the held keys into one movement vector and adds it to `camera.position`.

Two measured facts set this change's shape:

- **On a touch screen the key set is unreachable**, so a phone guest can look from one spot and do nothing else.
- **On the owner's own laptop the scan draws at 2 to 28 fps** at those settings. An earlier note here claimed 90; that was a different machine.

`RoomViewer` already sends `stanceOf(camera)` ten times a second, so whatever moves that camera moves the figure everybody else sees, with no protocol change. `placement.ts` holds `unitsPerMetre(scene)`, the one number that turns real metres into scan units, and `anchorAt`/`toScanPose` place a tracked pose into the scan.

The phone standing in the real home is deliberately **not** in scope: `Phone.tsx` streams its camera and reports its position, `Leave.tsx` leaves notes from where it stands, and neither draws the scan. An earlier version of this change drew the scanned home over the real one there; that is dropped, because somebody in the home can already see the home. One thing about that phone is still unknown and is being measured: an `immersive-ar` session holds the camera exclusively ([AR in the browser](../../../wiki/development/ar-in-the-browser.md#what-a-page-can-reach-while-a-session-runs)), so whether it can stream its camera *and* report where it is at the same time decides what it can do at all.

Checked while planning, so a guest's walk is a supported path rather than a hack: the installed `@sparkjsdev/spark` already reads `renderer.xr.isPresenting`, draws with `renderer.xr.getCamera()` and respects the session's own layer.

Constraints that carry over from [AR in the browser](../../../wiki/development/ar-in-the-browser.md), measured on the owner's Android phone (Chrome 155):

- A session with no render layer answers every frame with no pose. Three.js attaches a real one, so this becomes true by construction.
- `domOverlayState.type` reads `screen`, and presses reach the page. The overlay element must stay in the page so React keeps owning it.
- Android Chrome only. An iPhone has no WebXR and is offered no walk.

## Goals / Non-Goals

**Goals:**

- Some way for every touch screen to move through the scan, which none has today.
- A view that keeps a usable frame rate on the machine it is actually on.
- A guest who joined from anywhere walking the scan by walking their own floor, at life size, on a phone that can track.

**Non-Goals:**

- The phone in the real home drawing anything at all. It is a camera and a position.
- The view following the viewer's head. Measured and cut: a face read costs 33 ms with the machine to itself but 347 ms beside the splats, dropping the view to 0–6 fps, which is the headroom the frame-rate step-down exists to win back.
- Notes, how they are left, or how they are read. `Leave.tsx` is untouched.
- Occluding the scan behind real walls, in a guest's session or anywhere else.
- Drawing other people's figures inside a guest's walking session. The figures are `roam-body`'s.
- Reading a phone's orientation sensors (`DeviceOrientationEvent`). It would give every phone turn-to-look for a few lines — and it was the recommendation — but it was not chosen, and it would be a third way to aim one camera.
- Amplifying anything: a real step is one scan metre.
- Changing `PHONE_HEIGHT_M`. A guest's walk is what makes the right value visible; setting it is a one-line follow-up.
- Any server, schema or storage change.

## Decisions

**Three.js owns the session; the scan is moved to meet it.** `renderer.xr.enabled = true`, `renderer.xr.setReferenceSpaceType('local-floor')`, then `renderer.xr.setSession(session)`. From there `renderer.render(world, camera)` inside `renderer.setAnimationLoop` draws through `renderer.xr.getCamera()`, which is driven by the phone. The camera therefore cannot be positioned by the page, so the splat scan is positioned, turned and scaled instead, such that the lined-up spot sits at the session's origin. The alternative — keeping our own camera and setting it from `getViewerPose` each frame — loses the per-eye projection, the correct field of view and the compositor's reprojection, and fights Spark's existing XR path for no gain.

**The original placing transform is its own pure module.** The existing capture-oriented transform uses two nested groups:

| | Set to | Why |
|---|---|---|
| inner group | position `(-anchor.x, -anchor.floor, -anchor.z)` | puts the taped spot at the origin, standing on its own floor |
| outer group | `rotation.y = -anchor.yaw` | turns the scan so the spot's facing is the session's forward |
| outer group | `scale = 1 / unitsPerMetre(scene)` | one real metre becomes one metre of scan |

This is the inverse of `toScanPose`, but not of the guest hook's additional `fromOrigin` step. The priority correction below gives guests a complete transform and inverse, including the actual initial pose; keep the capture-only behavior unchanged.

**`ar-session.ts` gains a drawing partner rather than a second loop.** `startAr(hooks, overlay, view?)`. With no `view` it behaves exactly as today, including the dummy layer, which is what `Phone.tsx` keeps using. With a `view` it skips the dummy layer, calls `view.take(session)`, and reads each pose inside the view's frame callback, so the session has one animation loop and one pose reader. Two loops on one session is legal and wasteful, and makes "which frame did this pose come from" unanswerable.

**Loading a scan moves to one module.** `RoomViewer.tsx` and the AR view both build a renderer, a `SparkRenderer` and a `SplatMesh` with the scene's rotation and translation. The common part becomes `splat-scene.ts`, used by both, so the upright transform cannot drift between the laptop and the phone — and because the duplicate-code check would refuse the second copy anyway.

**A frame-rate floor ends a guest's walk.** The loop keeps a one-second rolling frame rate. Below the floor for long enough to matter, the walk ends, a line says the phone could not carry it, and the person is back in the room view with the pad and the drag working. There is nothing gentler to fall back to: turning the scan off inside a session would leave a guest looking at their own living room through their own camera, which is a view of nothing. The floor and the patience are constants in `detail.ts`, shared with the laptop's step-down.

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

Which combination ships is measured, not chosen here: the probe steps through four settings and keeps the frame rate for each. Measured on the owner's phone, a 60,000-splat budget at 0.6 pixel ratio and `lodRenderScale` 4 holds 65–80 fps, the same as drawing nothing, so that is the phone's setting and the file ships as it is.

**The laptop does not keep full detail either, and it is not given a constant.** The line that used to sit here — that the laptop holds 90 frames a second — was measured on a different machine. On the owner's own laptop the same scan at the same settings draws at **2 to 28 fps**. Three known machines differ by about forty times, so any constant is wrong for two of them, and the room viewer therefore finds its own setting:

| | |
|---|---|
| `detail.ts` | the settings, heaviest first: everything, then 250k, 120k and 60k splats, each with its own `lodRenderScale`, pixel ratio and `maxStdDev` |
| the watch | a rolling frame rate per second; two seconds under 24 fps gives up one step |
| warm-up | the first two seconds are the upload and the first sort, and are never counted |
| one way | it never climbs back, because a view flickering between two settings is worse to look at than a softer one that holds |

The top step is Spark's own defaults (`maxStdDev` of `Math.sqrt(8)`, `lodRenderScale` of 1), so a machine that holds the floor draws exactly what it drew before. The phone's AR view reads the same table rather than keeping its own numbers, pinned to the measured step instead of watching for one — on a phone there is no spare frame to discover it with.

One cost, taken deliberately: the mesh now always asks for the level-of-detail tree, because turning it on later would mean loading the 11 MB file again. That cost 4–5 seconds in a worker on the phone and is unmeasured on a laptop.

**A trimmed copy of the file is the fallback, not the first move.** If the budget alone cannot hold a usable rate, a second smaller `.spz` is generated for phones — one build step and one public file. It is second because it costs a pipeline step and a file to keep in step with the scan, where the budget costs one constructor option.

**Both floors are drawn.** Once the scan is placed against a spot, the other floor sits above or below where it really is. Hiding it would need a cut plane and would hide the stairs, which is the one place the two floors meet and the one place a misalignment shows up plainly.

### The guest's own device moves them

**One movement vector for keys and touch.** `pov-controls.ts` builds one vector per frame in `update(dt)` and adds it to the camera. The pad and keys feed that through `push(forward, side)`, cleared each frame. Physical walking owns the view and its reported position only while the XR session is active; head-reading remains excluded.

**The thumb pad is a plain function plus a thin control.** `thumb-pad.ts` turns a press origin and a current point into a `{ forward, side }` pair: a dead zone inside a few pixels, linear out to a fixed radius, clamped to one. That is the whole of the maths and it is tested with no DOM. `ThumbPad.tsx` is a positioned element in `Scan.tsx` that captures its own pointer and calls it — so the existing drag-to-look, which listens on the canvas, never sees the pad's pointer, and the click-to-pick handler cannot fire from a press that began on the pad. Shown when the view is touched rather than by sniffing the device: a `pointerdown` whose `pointerType` is `touch` reveals it, so a laptop with a touch screen gets it when it is used and never otherwise.

**A guest's session uses a paired pose transform.** Capture the ordinary camera's position, including eye height, and its yaw at the start tap, then capture the first valid XR pose as the source origin. A guest mapping converts raw XR positions to scan positions by subtracting that origin, rotating by the difference in facing, applying `unitsPerMetre(scene)`, and adding the saved scan position. Height is the saved eye height plus the tracked height difference, not floor plus that difference. The inverse mapping places the rendered scan into XR space using the same inputs. Keep this math pure in the guest placement surface and use it for both rendering and reporting; do not change the capture-only `anchorAt`/`toScanPose` contract.

The first valid tracked pose maps exactly to the saved scan position and yaw. Regression tests use real Three.js camera directions, nonzero x/z/yaw origins, two floor heights, sideways and negative-Z-forward steps, and multiple turns. Assert the round trip and the actual rendered-world transform, not just mocked `lineUp` calls. Preserve tracked pitch and roll in the XR view; heading uses the camera's negative-Z-forward yaw convention. Returning to the ordinary view must use that convention too: the current `poseFacing` target uses positive Z and can reverse the heading. Change that conversion or use an explicitly guest-specific conversion after checking all callers.

**Carrying on walking re-anchors, it does not teleport.** Capture the last valid raw XR pose and its mapped scan pose together, then replace both sides of the mapping atomically. With the phone still, the next rendered frame and reported position must be unchanged in x/y/z and facing. Apply the same reference to the drawing and reporting rather than resetting only the hook's origin. This does not create physical space or suppress the person's later steps back; larger travel remains available through touch controls and the camera chooser.

**One movement mode owns the shared pose.** During starting, walking and stopping, `Scan.tsx` arbitrates the source; ignore ordinary-view callbacks while XR owns it, and update the local stance from valid XR poses as well as relaying them. Suspend the ordinary viewer's drawing and controls where practical without losing its scene or ready state. On exit, apply the last valid scan pose before re-enabling ordinary pose publication, preventing a stale callback from moving the peer back. Reset timestamps and raw/origin state for each new session; late callbacks from an ended session cannot mutate a newer one.

**Read tracking validity without treating a stale camera as a new pose.** Keep one XR frame owner and read the camera Three.js already updates. Before implementation, inspect the installed Three.js frame/update contract and choose a validity signal that does not reintroduce the measured second-`getViewerPose` failure. Missing or emulated positional tracking must not publish invented movement. Pause reporting with a visible status until valid poses resume; end prolonged loss or a reference-space reset that cannot preserve continuity, returning to the last good view. Cover session refusal, no overlay, setup failure after session creation, pending start cancelled by Stop, context loss, and repeated start/stop with cleanup. This validity path needs device verification; the existing successful probe did not test it.

**An obvious entry, not automatic sensor permission.** In the joined phone flow, show checking/loading before the scan and initial stance are ready, then promote *Walk it* above secondary actions with phone-specific instructions. Invoke `requestSession` from that explicit tap, before asynchronous work can lose user activation. Use capability detection, not an Android name check. Unsupported browsers keep working touch controls and a plain explanation. The start is not labelled walking until a valid pose arrives; wire scan-load progress to the overlay if loading remains. Denial gets a retry without changing the saved viewpoint.

**The scan starts drawn, and failure ends the session.** There is no button to turn it off, for one reason: a guest who turned the scan off would be left looking at their own living room through their own camera, which is a view of nothing. So the scan is on from the first drawn frame, and the frame-rate floor and `webglcontextlost` both **end the session** and return them to the ordinary page view, where the pad and the drag still work.

## UX

### Use-case brief

The priority user joins from somewhere other than the scanned home on Android Chrome. They want their steps and turns to control the scan and their shared place. Mirror the existing `Scan` screen at phone width, with the current thumb pad as the fallback. Assume one start per visit and occasional recentering; these are design assumptions, not measured usage. The common case is a supported phone and an explicit start tap; refusal, missing tracking and an interrupted session are visible recovery states.

### Flow

Open the link → say your name → scan loads → *Walk it* → waiting for valid tracking → steps and turns move the view. Touch remains an alternative. *Carry on from here* preserves the view while recentering; *Stop* restores ordinary controls at the reached position and heading. Missing tracking pauses movement; refusal or unrecoverable tracking loss returns to the saved view with an explanation.

### Hierarchy

*Walk it* is the ready phone screen's primary action, not an unexplained peer of *Hands on*. Keep camera choices and hands secondary, and replace keyboard-only guidance on touch screens. During a walk, *Carry on from here* is primary and *Stop* remains easily reachable. Loading and tracking status use text and accessible status announcements, not color alone. Tracking loss leaves Stop available. No new dialog is needed.

### Components

Reuse `Button`, `Badge`, `Loading`, `Skeleton`, the existing bar, overlay and thumb pad. Extend the walk's state and status rather than introducing a second tracking widget.

### Review

The review page is [`review.html`](review.html). The proposal sketches the before/after joined-phone entry in **After joining, starting the walk is obvious**, the active overlay in **Starting, carrying on and stopping never jump you elsewhere**, and loading, waiting, loss, refusal and unsupported states in **The page says when it cannot follow you**.

## Risks / Trade-offs

- **A phone cannot draw half a million splats — measured at 2 fps and a lost context** → so it does not: a guest's session asks for `lod` and the measured 60k budget, with the pixel ratio and `maxStdDev` behind it. The frame-rate floor still ends the walk if that setting fails on another phone.
- **Losing the WebGL context mid-session leaves a dead view and a live session** → `webglcontextlost` ends the walk and says so, exactly as the frame-rate floor does, and hands the person back to the page.
- **A guest's AR session composites their own room behind the scan, and there is no way to stop it** → a phone browser has no VR mode to ask for, so where the splats are thin or absent the guest sees their own living room through the home. Accepted and said plainly rather than hidden.
- **Walking a real floor while looking at somewhere else is how people hit furniture** → the session says *turn your body to look* and nothing invites a long walk; *Carry on from here* is the answer to a small room, so there is no reason to cross one. Nothing software can do removes this, and it is the bargain every AR page makes.
- **The scale constant is a guess, so a guest's step may not cover a real metre of home** → a walk is what makes the error visible for the first time, and the fix is one line once the owner has looked.
- **Tracking drifts over a long walk** → recentering preserves the current place but cannot discover absolute drift from an unscanned remote room. Do not promise real-room localization; end safely if the reference frame cannot be preserved.
- **A phone's tracking reports the real floor, so a guest walking a flat room stays at one height in a scan with stairs** → correct and worth naming: the stairs are climbed by the pad or the camera chooser, not by walking at home.
- **The pad could swallow a press meant for a person or a note** → the pad owns its own pointer through `setPointerCapture`, so the canvas never sees that press; the test is a press starting on the pad and ending over a figure, which must pick nobody.
- **A weak machine's view now softens without anybody asking it to** → accepted, and the comparison is not a crisp view but the stutter it replaces: the owner's laptop drew at 2 fps at its worst. A machine that holds 24 fps sees no change at all.
- **The level-of-detail tree is now built on every machine, including those that never use it** → taken deliberately, because switching it on later means loading the file again. 4–5 seconds in a worker on the phone; unmeasured on a laptop and checked on the walk.
- **The watch could give up detail over a stall that was not the drawing's fault**, such as a tab returning from the background → the warm-up covers the start, and two seconds of sustained slowness is a long stall; the worst case is a softer view until the page is opened again.
- **A phone that cannot be both a camera and a tracker breaks the person in the home, not this change** → named here because it is being measured now: if a session kills the camera stream, `Phone.tsx`'s two jobs cannot coexist and that is its own piece of work, with nothing in this change depending on the answer.

## Migration Plan

Additive and reversible. No migration, no schema, no stored data, no route change, and nothing at all for the phone in the real home: `Phone.tsx` and `Leave.tsx` are untouched. In a room the keyboard and the drag keep working, the pad is added rather than replacing anything, walking is off until pressed, and every way a walk ends returns to the ordinary view. Rolling back is reverting the branch.

## Open Questions

- None outstanding. Measured and settled: a phone can stream its camera and report where it stands at once, the 60k budget holds 65–80 fps on a phone, and leaning costs more than the scan can spare.
- The joined flow has not been reproduced on the user's phone. Acceptance is a remote guest's steps, turns and stable handoffs, observed locally and on a second participant, not alignment with real scanned walls.
- Device evidence is still needed for the validity signal, camera streaming alongside the complete joined scan, and suspension of the ordinary renderer. These are implementation checks, not unanswered user preferences.

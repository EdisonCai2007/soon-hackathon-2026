# Everyone moves through the room, on the device they have

**Status:** in-progress — priority implementation is built; isolating its save and preparing the authorized staging-only deployment. Real-phone acceptance remains open.
**Branch:** roam-ar-view (branched from `roam-notes`, so the notes work sits underneath it)
**Open questions:** no unanswered scope choices. The user's Android Chrome phone must still prove the joined walk, including starting, turning, carrying on and stopping; a previous probe is not proof of this complete flow.

## Why

The priority is a person who joins from somewhere else on Android Chrome: walking and turning with their phone must move their view through the scan, and everyone else must see them in that same place. The walking feature exists in this workspace, but joining still leaves them using touch controls, and the starting point used for the picture and the shared position can disagree.

The person standing in the real home needs none of that. They can see the home with their eyes. What the room needs from them is their camera and where they are standing, which is what their phone already sends.

So this change is about moving through the room, for whoever is away from it: a way to walk on every device, a view that keeps up on the machine it is on, and — on an Android phone away from the home — walking the scan by walking your own floor.

## What Changes

- **After joining, starting the walk is obvious.** Once the scan is ready, a supported phone gets one clear *Walk it* action with a short explanation. Tap it to allow tracking; just opening the room does not silently start the camera-based walk. Touch controls remain available instead.
  ```screen
  <div class="col gap">
    <div class="card col gap phone">
      <h3>Before</h3><div class="bar">the scanned home</div>
      <div class="row gap"><button class="btn-ghost">Hands on</button><button class="btn-ghost">Walk it</button></div>
      <p class="muted">Keyboard instructions, with no explanation of phone movement.</p>
    </div>
    <div class="card col gap phone">
      <h3>Move with your phone</h3>
      <div class="bar">the scanned home</div>
      <p>Turn to look and take a step to move. Check the space around you first.</p>
      <button class="btn-primary">Walk it</button>
      <p class="muted">Or use the thumb pad and drag to look.</p>
    </div>
  </div>
  ```

- **Your picture and your place agree as you move and turn.** Start from the view you already chose, at the same height and facing. A step forward or sideways moves that way in the scan, and turning turns your view without shifting your position. The same movement is sent to everyone else, rather than an old stationary position competing with it.
  ```mermaid
  flowchart TD
    phone["phone position and facing"] --> place["one starting point"]
    place --> view["your view in the scan"]
    place --> people["where others see you"]
  ```

- **Starting, carrying on and stopping never jump you elsewhere.** *Carry on from here* resets the tracking reference without moving or turning the view. *Stop* returns to touch controls at the place and facing you reached. This is not a promise that recentering creates more physical floor space.
  ```screen
  <div class="card col gap phone">
    <span class="tag">walking</span><div class="bar">the scanned home</div>
    <p>Turn to look. Stay within a clear space.</p>
    <button class="btn-primary">Carry on from here</button>
    <button class="btn-ghost">Stop</button>
  </div>
  ```

- **The page says when it cannot follow you.** Loading and waiting for tracking are visible. If tracking is lost, no invented movement is sent; it resumes only from a valid position, or the walk ends with an explanation. A phone that cannot start keeps its touch controls and says why.
  ```screen
  <div class="col gap">
    <div class="card col gap phone"><h3>Getting ready</h3><div class="skeleton">Loading the scan</div><p class="muted">Movement starts when the scan is ready.</p></div>
    <div class="card col gap phone"><h3>Starting your walk</h3><p>Waiting for the phone to find its position…</p><button class="btn-ghost">Stop</button></div>
    <div class="card col gap phone"><h3>Tracking paused</h3><p>Hold still while the phone finds its position.</p><button class="btn-primary">Stop</button></div>
    <div class="card col gap phone"><h3>Could not start the walk</h3><p>Your view has not moved. You can still use touch controls.</p><button class="btn-primary">Try again</button></div>
    <div class="card col gap phone"><h3>Walking is unavailable</h3><p>This browser cannot track your position. Use the thumb pad and drag to look.</p><div class="bar">the scanned home with touch controls</div></div>
  </div>
  ```

- **Every phone in a room can finally move.** A thumb pad sits in the corner of the view: press it to walk, drag anywhere else to look. Today a phone guest can only look around from one spot, because moving needs keys a phone does not have. The pad is there whether or not the phone can do the walking version.
  ```screen
  <div class="card col gap phone">
    <div class="row gap"><span class="tag">in the room · 3 people</span><span class="grow"></span><span class="tag-outline">Walk it</span></div>
    <div class="bar">the scanned home</div>
    <div class="row gap"><span class="tag-outline">thumb pad</span><span class="grow"></span><span class="bar">drag to look</span></div>
  </div>
  ```

- **The view keeps up on the machine you are on, whatever it is.** Measured on the owner's own laptop, the scanned home drew at 2 to 28 frames a second — the plan had assumed ninety, from a different machine. So the view now watches its own frame rate and gives up detail until it holds: full detail where that works, fewer and larger splats where it does not. Nobody is asked to choose, and the softening is barely visible beside the stutter it replaces.
  | Frames a second | What is drawn |
  |---|---|
  | over 24 | every splat, exactly as today |
  | under 24 for two seconds | 250,000 splats, then 120,000, then 60,000 |
  | once softened | it stays there, rather than flickering between two settings |

- **The phone in the real home keeps doing exactly what it does today.** It sends its camera and where it is standing, and draws nothing. It was going to show the scanned home over the real one; that is dropped, because somebody standing in the home can already see the home. The note screen is untouched.

Non-goals: the phone in the home drawing anything, turning a drawing on and off there, notes seen as markers over the real room, an iPhone walking by its own movement (its browser cannot tell where it is — it gets the thumb pad), the view following the viewer's head at all, measured and cut, making a step cover more ground than a step, drawing other people's figures inside a walking guest's session, scanning the home again to show what changed, and changing how notes are stored, left or read.

## Capabilities

### New Capabilities

None beyond the existing walking capability.

### Modified Capabilities

- `roam-ar-view`: make the existing guest walk discoverable and consistent across the drawn view and shared pose, preserve position and heading at every handoff, and expose tracking readiness and loss.
- `roam-scene`: how a person moves through the scan grows beyond the keyboard — a thumb pad on a touch screen and the phone's own movement in a session. Head-following remains cut.

## Impact

- The ROAM mini app gains a module that hands an AR session to Three.js (`renderer.xr`) and draws the scan inside it, plus a plain module for the placing transform, both used only by a guest's walk. `ar-session.ts` gains one optional argument so a caller can take the session over rather than only being told poses; with no drawing it behaves exactly as it does today, which is the path `Phone.tsx` and `Leave.tsx` keep using.
- `RoomViewer.tsx` and that AR view both load a scan and draw splats; the shared part is one module, `splat-scene.ts`, so the laptop and the phone cannot drift apart on how the home is stood upright.
- The room view's movement grows in `pov-controls.ts`, which gains a second source of the same movement vector the keys already produce, fed by a thumb pad drawn over the view. `Scan.tsx` gains the pad, *Walk it*, *Carry on from here* and *Stop*.
- `detail.ts` holds the settings the view may draw at and the watch that steps down through them; `RoomViewer.tsx` applies one and a guest's session pins the measured phone setting, so one table serves both.
- **Nothing about the phone in the home changes.** `Phone.tsx` and `Leave.tsx` are untouched, notes are left the way they are left today, and the earlier plan to grow a canvas on the note screen is dropped.
- **No new packages.** Three.js already carries WebXR, the installed Spark already draws through `renderer.xr.getCamera()`, and MediaPipe's vision tasks are already a dependency for hands.
- No server side, no migration, no schema change. A guest's place in the room still goes up as the same position ten times a second, whatever moved them, so nobody else's page changes at all.
- Worth knowing: the `roam-body` branch (pull request 10) is open against `RoomViewer.tsx` and `Scan.tsx`, the two files the room's movement touches. Different intent, same files.
- Priority corrections touch the guest's transform and its inverse, the `use-room-ar.ts` lifecycle, the walking entry in `Scan.tsx`, and arbitration with `RoomViewer.tsx`. Preserve the capture-only transforms used by `Phone.tsx` and `Leave.tsx`. Existing uncommitted local-development and unrelated plan edits stay intact.

## Decision log

- **2026-10-25** — Asked where the scan-over-the-room view should live → chose the note screen gains it, so there is one session, one line-up, and a note can be seen landing on the thing it describes.
- **2026-10-25** — Asked how much of the real room should show through → chose a fade slider from the camera alone to the scan alone, because lining up by eye needs both halves of the misalignment visible.
- **2026-10-25** — Asked again, after the slider: chose one button that turns the scan on and off instead, starting off. Flicking between the real wall and the scanned wall shows a misalignment at least as plainly as blending them, and it is one press with a thumb while walking rather than a drag.
- **2026-10-25** — Asked how the two floors should behave once one is lined up → chose drawing the whole scan, so the floor above or below sits where it really is rather than being hidden.
- **2026-10-25** — Assumed: Three.js owns the session through `renderer.xr.setSession`, and the scan is moved to meet the session's origin rather than the camera being moved to meet the scan, because an XR camera is driven by the phone and cannot be set from the page.
- **2026-10-25** — Assumed: the existing marked spots and `toScanPose` scale carry the placing, with no new alignment gesture, because the spots are already taped and the same numbers must place the view and the notes or they will disagree.
- **2026-10-25** — Assumed: a frame-rate floor drops the drawing and leaves the note screen working, rather than letting the page stutter, because a stuttering overlay is worse than none while a note is being left.
- **2026-10-25** — Found while planning: the installed Spark already reads `renderer.xr.isPresenting` and draws with `renderer.xr.getCamera()`, so splats in an XR session is a supported path rather than a hack.
- **2026-10-25** — Checked on the owner's Android phone (Chrome 155): handing the session to `renderer.xr` works. The overlay still reads `screen` and takes presses, the first drawn frame arrived after 145 empty ones, and all four marked spots placed the scan without a reload. So the shape of this change is confirmed on the device it has to run on.
- **2026-10-25** — Measured on that phone, and it changes the plan: the whole scan drawn at full detail runs at **2 to 66 frames a second and loses the 3D view altogether**, against 88 to 90 with it off. So drawing all 546,977 splats is not an option, and the trimmed scan stops being a possible follow-on and becomes part of this change.
- **2026-10-25** — Found while reading Spark, and the likely answer: Spark has a level-of-detail system with a splat budget, and its own default budget for WebXR is 500–750k — but it only applies when a mesh asks for `lod`, which ours never did, so the phone was drawing every splat with no culling. The next run steps through four settings (no LOD, then 250k, 120k and 60k budgets with fewer pixels) and keeps the frame rate for each, so the setting is chosen on evidence rather than guessed.
- **2026-10-25** — Found on the same run: four frames in five answered our own `getViewerPose` with nothing while three.js held the session. The page should take its pose from the camera three.js has already moved, rather than asking the frame a second time — the next run confirms that camera is moving on those frames.
- **2026-10-25** — Measured while planning: the scan is 12.5 MB and came off Cloudflare's edge at 268 KB/s, so it takes about three quarters of a minute to arrive before anything can be drawn. So the session starts and tracks while the scan is still downloading, with the progress said out loud, and the trimmed copy of the scan is wanted for the wait as well as for the frame rate.
- **2026-10-25** — Asked whether the copied AR session lifecycle in the two phone screens should be its own change or a step in this one → chose a step in this one, because both would edit the same screen and this change reshapes it anyway.
- **2026-10-25** — Found by `/improve-code`: the two phone screens each write the same AR session lifecycle by hand, the copies have already drifted, and no check can see it. It is now the step before the drawing is added, with today's tests as the pin and an undo if neither screen reads more plainly.
- **2026-10-25** — Asked what moving the device should do for somebody who joined a room on a phone → chose real walking through an AR session, over the cheaper turn-to-look from the phone's orientation sensors. Walking is the stronger moment; the cost is that it is Android only and rests on this change's splat budget to run at all.
- **2026-10-25** — Asked what phones without AR get, every iPhone among them → chose a thumb pad for walking, and no use of their sensors. So looking stays a drag everywhere, and the pad is the one movement control every touch screen has.
- **2026-10-25** — Asked how far one real step should carry you in the scan → chose life size, with a press to carry on walking when the real floor runs out. A step that covered several metres would make the home feel wrong, and the press costs one button.
- **2026-10-25** — Asked how strong the laptop's head reading should be → chose subtle parallax: leaning shifts the view a little, like a window, and the keys and mouse still do the travelling. Amplified looking was the alternative and was rejected as twitchy; leaning to walk as tiring and easy to trigger by accident.
- **2026-10-25** — Asked whether the guest's walk-through should be its own change or part of this one → chose part of this one, because it needs this change's session handling, splat budget and shared scan loading, and a separate plan would sit blocked behind it.
- **2026-10-25** — Assumed: carrying on walking keeps where you are in the scan and makes where you now physically stand the new starting point, rather than returning you to the middle of the home, because the point of the press is to cross a house two metres at a time without losing your place. The camera choices already there are how somebody jumps across the home deliberately.
- **2026-10-25** — Assumed: the scan starts drawn for a guest, where it starts off for somebody standing in the real home, because a guest turning it off would be left looking at their own living room. For the same reason a frame rate a guest's phone cannot hold ends the session and returns them to the ordinary page view, rather than leaving the camera's picture behind it.
- **2026-10-25** — Assumed: a leaning head moves the drawn view only, and the place sent to everybody else stays the one the keys and the pad put you at, because a head wobble relayed ten times a second would make a figure jitter for everyone watching.
- **2026-10-25** — Assumed: the thumb pad feeds the same movement the keys produce rather than its own path through the camera, because two ways to move one camera is how they drift apart.
- **2026-10-25** — Evidence gap, named rather than assumed away: nothing here has measured what reading a face costs beside the splats on a laptop, or what the guest walk-through holds on a phone. Both get a measured probe before they are built, and the laptop's leaning is dropped rather than shipped slow if the cost is too high.
- **2026-10-25** — Checkpointed the plan on its own branch, `roam-ar-view`, off the notes branch it builds on. Nothing is built yet: the next step is the two measurements, which can change sections 9 and 10 before any of it is written.
- **2026-10-25** — Built sections 4 and 8: the one way to load a scan, and the thumb pad with the push it feeds `pov-controls`. Found while building: the pad belongs in `RoomViewer.tsx`, not `Scan.tsx`, because the viewer owns both the controls the push goes to and the box the pad sits over; putting it a level up would mean handing the controls out. The task now says so.
- **2026-10-25** — Found while building: section 3's `ar-place.ts` cannot land before section 5, because `ar-view` is its only caller and the unused-export check refuses an export nothing uses. So the placing transform is written with the session that uses it, not before, and section 5 waits on the frame-rate measurement.
- **2026-10-25** — Changed while building, in `pov-controls.update`: the movement vector is scaled by its own length capped at one, rather than always normalised. A key is all or nothing so nothing about the keyboard changes, and a half-pulled pad now walks at half speed instead of full.
- **2026-10-25** — Measured on the owner's own laptop, and it contradicts this plan: the scan at today's viewer settings draws at **2 to 28 frames a second**, where the design said the laptop holds ninety. That number came from a different machine. So "the laptop keeps today's full-detail path" is withdrawn.
- **2026-10-25** — Asked to fix it, and chose a frame-rate watch that steps down through named settings at runtime over a measured constant for the laptop. Three machines are known and they differ by about forty times, so any single constant is wrong for two of them; the cost is that a weak machine's view softens without being asked, which is what a stutter already does less kindly.
- **2026-10-25** — Assumed: the softening never climbs back up, because a view flickering between two settings is harder to look at than a softer one that holds, and the person never chose either.
- **2026-10-25** — Found while building: the top step's numbers are Spark's own defaults (`maxStdDev` of `Math.sqrt(8)`, `lodRenderScale` of 1), so a machine that holds the floor draws exactly what it drew before this change.
- **2026-10-25** — Assumed: the splat mesh now always asks for the level-of-detail tree, even on a machine that never uses it, because turning it on later would mean loading the 11 MB file again. What that costs at load is unmeasured and is checked on the walk.
- **2026-10-25** — Measured on the laptop, first pass: a face read took **289 ms** on average against the 66 ms it needs, and drawing plus face plus hands fell to 0–7 fps. Not yet conclusive, because the drawing was itself at 2–28 fps and may have been starving the reader; a second pass with the drawing paused separates the two. Leaning stays unbuilt until it answers.
- **2026-10-25** — Built sections 3, 5 and 10 on the phone's measured setting: the placing transform, the session view, and the guest's walk with *Carry on from here* and *Stop*. The phone draws at the table's softest step, which is the 60k setting the probe chose.
- **2026-10-25** — Found while building: a guest's session must ask for a DOM overlay of its own. Without one the session owns the whole screen and *Carry on* and *Stop* are invisible, so the walk could only be left by ending the session from the phone's own gesture.
- **2026-10-25** — Changed while building: the walk is offered wherever the phone can track, in a room or walking the scan alone, because the page keeps where the walker stands either way. The room viewer is now always told that place rather than only inside a room, which is one condition fewer and what the lone walker needs to start from. `App.test.tsx`'s expectation that walking alone reports nothing was updated to match, with the reason in the test.
- **2026-10-25** — Removed while building, after coverage showed them dead: two "is the view still here" guards in `ar-view`. Disposing detaches both the lost-context listener and the frame loop, so neither could ever run afterwards, and a guard no test can reach is a guard that is lying.
- **2026-10-25** — **Measured on the owner's phone, and it settles the open question: the scan ships as it is.** With Spark's LOD asked for and the renderer's `enableLod` set, a **60,000-splat budget at 0.6 pixel ratio and `lodRenderScale` 4 holds 65–80 fps** — the same range the phone reaches drawing nothing. 120k at ¾ pixels holds 25–64, and 250k 60–62. So the budget is the lever, the aggressive setting is the one to ship, and **no trimmed copy of the file is needed**: the LOD tree is computed in a worker from the same `room.spz` in 4–5 seconds, so nothing changes about what is served.
- **2026-10-25** — Found on the same run, and worth a guard rather than a shrug: the 3D view was **still lost at the 250k setting**, after three LOD trees had been built in one session. Production builds one setting once and never switches, so this is probably the probe's own churn — but the `webglcontextlost` path stays in the plan and the renderer keeps only one mesh at a time, because a phone that lost the context three runs out of three is not a phone to take chances with.
- **2026-10-25** — Confirmed on the same run, third time over: `getViewerPose` answered nothing on **92%** of frames while three.js held the session, yet three.js's own camera moved on 67 of them. Reading `renderer.xr.getCamera()` is now evidence, not a hunch, and asking the frame a second time is the thing not to build.
- **2026-10-25** — Asked, and it reverses this change's own premise: the phone standing in the real home does **not** need the scan drawn over the real room. It needs to be a camera and a position, because whoever is in the home can already see the home, and the person who joined from somewhere else is the one the scan exists for. So the drawing on the note screen, the on-and-off button, the markers over the real room and the lifecycle refactor that was groundwork for them are all dropped, and `Leave.tsx` stays as it is. What survives is movement for whoever is away: the pad, the frame rate, and a guest's own walk.
- **2026-10-25** — Asked what becomes of the guest's walk now → chose to keep it: it is written, tested and green, it costs nothing while nobody presses it, and it is the one place a drawn scan still earns its keep.
- **2026-10-25** — Found while re-scoping, and worth measuring before anything else is promised about the phone in the home: an AR session holds the camera exclusively, so *streaming the camera* and *reporting where the phone is* may not be possible at once. `Phone.tsx` opens the camera first and then starts the session, which may survive, but nobody has checked whether the pictures keep coming. A probe is on the owner's phone now.
- **2026-10-25** — Withdrawn from the specs as part of this: the requirements that said the scan is drawn over the real room, turned on and off by the person, and placed again on lining up. They were reconciled into the main specs at an earlier checkpoint and described behaviour nobody will now build, so they are gone from `roam-ar-view` and `roam-capture` rather than left as a promise.
- **2026-10-25** — **Measured on the owner's phone, and it settles the phone in the home: it can do both at once.** With the front camera opened first and an `immersive-ar` session started over it, the camera stayed live, not muted and enabled for the whole 32-second run, sending 957 pictures, while 919 of 957 frames carried a pose and 375 showed the phone had moved. So streaming the camera and reporting where it stands do not fight each other, `Phone.tsx`'s existing order is right, and nothing about the person in the real home needs building.
- **2026-10-25** — Found in the same run, and it sharpens the earlier warning rather than contradicting it: when the **page** owns the frame loop and attaches its own layer, only 4% of frames came back without a pose, against 92% when three.js held the session. So `getViewerPose` is reliable on the path `Phone.tsx` and `Leave.tsx` use, and the camera three.js has moved is the thing to read only inside a drawing session.
- **2026-10-25** — **Measured on the laptop, paused pass, and it names the cause: contention, not a slow model.** A face read costs **33 ms with the machine to itself** (worst 199 ms) against **347 ms while the splats draw** (worst 6,734 ms), and the drawing fell to 0–6 fps with the reader on, against 1–60 without. The model would fit the 66 ms cadence alone; it cannot share this GPU with the scan.
- **2026-10-25** — Named rather than glossed: the probe drew at the viewer's old full-detail settings, which is a setting nobody will run now that the view steps down to 250k, 120k or 60k splats. So face-reading beside a *stepped-down* scan is still unmeasured, and that is the only configuration leaning would live in.
- **2026-10-25** — Asked, on those numbers → **cut the leaning.** The model fits the cadence alone, but beside the splats it costs 347 ms a read and drops the view to 0–6 fps, which is the exact headroom the frame-rate step-down was built to win back. Reading a face beside a stepped-down scan was offered as a fairer measurement and declined; the `face:` line was also never confirmed to track a leaning head, so the signal itself was unproven. The laptop keeps the keys, the mouse and a view that holds up.
- **2026-10-25** — Asked which phone and browser the priority fix must serve → chose Android Chrome.
- **2026-10-25** — Asked whether the person is in the scanned room or somewhere else → chose somewhere else. This is the joined guest's view, not the real-room camera calibration in `roam-tracking`.
- **2026-10-25** — Asked where to continue given overlapping walking work → chose keep going here; leave the other workspace's changes untouched.
- **2026-10-25** — Asked what to do after exploring the priority fix → chose Plan it. No implementation or publishing is authorized by this answer.
- **2026-10-25** — Assumed: update this existing walking plan rather than create another, because the requested behavior and affected guest flow are already its responsibility.
- **2026-10-25** — Assumed: keep one explicit tracking-start tap after the joined scan is ready, but make it prominent, because the browser requires user activation and joining alone cannot be advertised as tracking.
- **2026-10-25** — Assumed: regression tests must cover nonzero starting position and yaw, eye height, and stopping after a turn. Source inspection found that reported poses subtract an origin but the drawn scan does not, the first reported height becomes the floor, and `poseFacing` uses positive-Z forward while the camera's Euler yaw uses negative-Z forward. These observations are not a reproduction on the user's phone.
- **2026-10-25** — Assumed: only the active movement mode may publish a pose. `Scan.tsx` currently wires both the ordinary viewer and the walk to `tell`; whether both loops run on a particular phone is unmeasured, so correctness must not depend on browser suspension.
- **2026-10-25** — Assumed: the physical acceptance walk is from another location and checks view-to-peer agreement, not alignment with real scanned walls, because the user's answer makes real-room calibration out of scope.
- **2026-10-25** — Asked whether to build the reviewed priority fix → chose “build it.” Implementation is authorized; production publishing was not requested.
- **2026-10-25** — Verified before fixing: three new hook assertions failed on the original code. The first and returning eye height fell by 1.2 scan units, and the returned camera direction was exactly opposite the expected direction.
- **2026-10-25** — Built: the rendered transform now includes the same raw origin used for reported poses; guest anchors retain eye height; the return-view conversion adapts camera Euler yaw to the existing scan-bearing convention without changing capture-only placement. Repeated recentering after steps and turns preserves all four pose fields.
- **2026-10-25** — Built: the walk owns outgoing poses while active; ordinary drawing and inputs pause, and old callbacks stay blocked until the reached view is restored. Start cancellation, late callbacks, missing overlay, reference reset, lost tracking, setup failure and repeated stop are covered.
- **2026-10-25** — Assumed: use `XRFrame.getPose(viewerSpace, referenceSpace)` only for validity in the renderer-owned loop, because installed Three.js r180 retains a stale camera when its own viewer-pose read fails. It avoids a second `getViewerPose` call. The mocked tests prove null/emulated handling; the complete phone flow still owes device evidence.
- **2026-10-25** — Source review: pending scan initialization must finish before disposing that mesh; disposing early clears fields its loader still needs. A load-in-progress flag prevents recentering from starting duplicate loads, and success or failure after stopping releases the pending mesh. Self-review completed; no independent reviewer was run.
- **2026-10-25** — Local evidence: the ROAM suite passed 319 tests across 40 files with 100% lines, branches, functions and statements. An additional repeated-recenter regression was then added and all 19 hook tests passed. Type checking and the app build passed; seven runtime tests, unused-code, duplicate-code, app-key and skill-action checks passed.
- **2026-10-25** — Check limits: the last whole-app run passed 908 tests and failed four. Three failures are Windows path-separator assumptions in unchanged style/Worker guard tests; the fourth was the rendering setting/test mismatch, subsequently resolved by the concurrent task and confirmed by the passing ROAM suite. The repository wrapper cannot spawn npm on this Windows host and its wiki link checker reports existing links as absent. A later lint run failed on a three-line comment added concurrently in `detail.ts`; this task did not edit that file or weaken any check.
- **2026-10-25** — Delivery remains open: no saved revision, shared check result, deployed preview, screenshots or real-phone walk is claimed. Test-deployment authorization is needed before pushing/deploying; physical acceptance, camera continuity and measured scale remain unticked. Concurrent local-development edits were preserved.
- **2026-10-25** — Asked to finish the checks and prepare a test deployment → approved fixing the comment-lint error, committing and pushing for shared checks, and deploying to staging only. Production stays unchanged.
- **2026-10-25** — Another task switched the shared checkout to `roam-local-dev` before anything was committed here. Asked how to isolate the work → approved a separate checkout. Copied the movement changes into the existing `roam-ar-view` branch in an isolated worktree; the shared checkout was left untouched.
- **2026-10-25** — Retained the concurrent rendering correction and its paired assertion because this walk depends on a visible scan: `detail.ts` keeps Spark's LOD path enabled for its LOD-loaded mesh. Its comment had already been shortened by the other task; this checkpoint removes the reference to that task's uncommitted wiki page. The separate local-development scripts, configuration, tests, plan and wiki pages are not part of this checkpoint.
- **2026-10-25** — The isolated checkout passed lint, type checking and all 320 ROAM tests with 100% lines, branches, functions and statements. Its first run exposed a timing-sensitive App test: it queried a single status while capability checking and scan loading were both visible. The helper now waits for capability checking to finish before making the unchanged loading assertions; no check was removed.

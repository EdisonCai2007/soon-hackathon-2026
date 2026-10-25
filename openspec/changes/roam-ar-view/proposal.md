# The scanned home, drawn over the real one — and your own body moving you through it

**Status:** part built — the thumb pad works and the scan loads from one place. The frame rate is now measured and the answer is yes, at a 60,000-splat budget. The laptop's leaning still waits on its own measurement.
**Branch:** roam-ar-view (branched from `roam-notes`, so the notes work sits underneath it)
**Open questions:** what reading a face off the laptop's camera costs while the scan is drawing, which decides whether leaning works on an ordinary laptop or only a fast one. And, from the owner's own eyes rather than a number, whether the scan sits on the real walls at the setting that is fast enough.

## Why

Standing in the real home, the phone shows the real camera view with our buttons over it. It never draws the scan at all, so moving the phone moves nothing and there is no way to tell whether a note landed on the thing it describes — or whether the scan's scale is right at all. Drawing the scan over the real room as you walk makes both of those visible in a second, and it is the moment that stops being a video call: the home you are standing in and the copy of it line up, and stay lined up as you move.

The same thing is missing on the other side of the room. Someone who joins the room from anywhere else moves by holding W/A/S/D and dragging with a mouse, so on a phone they cannot move at all — there are no keys to hold — and on a laptop moving your own body does nothing. Once a phone can draw the scan and follow its own movement, the person who joined from a sofa can walk the home by walking their own floor, every phone gets something to walk with, and a laptop can at least lean.

## What Changes

- **The scan appears over the real room, and stays put as you walk.** Line up on a marked spot and the scanned home is drawn on top of the real one — its walls on your walls, its stairs on your stairs. Walk and it holds its place, because the phone's own tracking moves the view.
  ```svg
  <svg viewBox="0 0 220 96">
    <rect x="8" y="10" width="92" height="64" fill="none" stroke="subtle"/>
    <text x="14" y="26" fill="muted">today</text>
    <text x="14" y="46" fill="fg">camera view</text>
    <text x="14" y="62" fill="muted">+ our buttons</text>
    <path d="M106 42h14" fill="none" stroke="line"/>
    <rect x="124" y="10" width="88" height="64" fill="none" stroke="line"/>
    <text x="130" y="26" fill="muted">after</text>
    <text x="130" y="46" fill="fg">the scan, over it</text>
    <text x="130" y="62" fill="muted">moving as you move</text>
    <text x="8" y="90" fill="muted">one session, one line-up, both</text>
  </svg>
  ```

- **One button turns the scan on and off.** It starts off, so you see the real room and turn the scan on when you are standing where you meant to be. Flicking it off and on is also how you judge whether it lines up: the real wall, then the scanned wall, in the same place or not.
  ```screen
  <div class="card col gap phone">
    <div class="row gap"><span class="tag">lined up · the lobby</span><span class="grow"></span><span class="tag-outline">scan on</span></div>
    <div class="bar">the scanned home, drawn over the real one</div>
    <div class="row gap"><button class="btn-primary">Leave a note here</button><button class="btn-ghost">Scan off</button></div>
    <div class="row gap"><button class="btn-ghost">Line up again</button><button class="btn-ghost">Stop</button></div>
  </div>
  ```

- **It is the same screen you already leave notes from.** No second page and no second line-up: the note screen gains the drawing. So you walk up to the boiler, see the scanned boiler sitting on the real one, press *Leave a note here*, and watch the marker land exactly where you stood.

- **Notes already left show up as you walk past them.** The markers are drawn in the scan, so standing in the real home you see what other people left, on the thing they left it on.

- **The phone draws as much of the home as it can carry, not all of it.** Measured on the owner's own phone, drawing every one of the scan's 546,977 splats runs at two frames a second and kills the view, so the phone is given a budget and draws what is nearest and largest within it. The laptop keeps the full detail it already holds ninety frames a second at.

- **If the phone still cannot draw it, it says so and keeps working.** A phone without the browser's AR support, one that loses the 3D view, or one that cannot hold a usable frame rate falls back to the note screen as it is today rather than a stuttering picture.

- **Joined from anywhere on an Android phone, you walk the home by walking your own floor.** Press *Walk it* in the room and you are inside the scan: turn your body to look, take a step and you take a step in the home, at life size. When you run out of real floor, one press lets you carry on walking from where you got to. Everyone else in the room sees your figure walk as you do, with nothing new to set up.
  ```mermaid
  flowchart LR
    walk["press Walk it"] --> step["your steps move you"]
    step --> again["press Carry on"] --> step
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

- **On a laptop, leaning shifts the view, like leaning towards a window.** Turn on *Lean to look* and the laptop's own camera watches your head: lean left and you see a little further round the left of the doorway. It is a small, calm effect that makes the room feel like a place rather than a picture — not a way to get around, so the keys and the mouse stay exactly as they are. It starts off, because it uses the camera and some of the laptop's effort.
  ```svg
  <svg viewBox="0 0 220 84">
    <rect x="10" y="14" width="78" height="52" fill="card" stroke="line"/>
    <text x="18" y="34" fill="fg">lean left</text>
    <text x="18" y="52" fill="muted">head moves</text>
    <path d="M96 40h26m-8-6 8 6-8 6" fill="none" stroke="fg"/>
    <rect x="130" y="14" width="80" height="52" fill="card" stroke="line"/>
    <text x="138" y="34" fill="fg">see round</text>
    <text x="138" y="52" fill="muted">the doorway</text>
  </svg>
  ```

Non-goals: drawing people's live figures over the real room, hiding the scan behind real walls where it should be out of sight, lining up by looking at a marker instead of standing on a taped spot, an iPhone walking by its own movement (its browser cannot tell where it is — it gets the thumb pad), leaning as a way to travel rather than to peer, making a step cover more ground than a step, scanning the home again to show what changed, and changing how notes are stored or read on a laptop.

## Capabilities

### New Capabilities

- `roam-ar-view`: the scan drawn through a phone's AR session — over the real room for whoever is standing in it, and as the whole view for whoever joined the room from elsewhere — placed against a marked spot or against where their view already stood, moving with the phone's own pose, and stepping aside when the phone cannot carry it.

### Modified Capabilities

- `roam-capture`: the phone's page draws the scan over the real room while it tracks, rather than only reporting where it is.
- `roam-scene`: how a person moves through the scan grows beyond the keyboard — a thumb pad on a touch screen, the phone's own movement in a session, and the laptop camera's reading of where the viewer's head is.

## Impact

- The ROAM mini app gains an AR rendering module that hands the session to Three.js (`renderer.xr`) and places the splat scan against the lined-up spot, plus a plain module for that placing transform. `Leave.tsx` grows the canvas, the scan's on-and-off button and the frame-rate fallback; `ar-session.ts` changes so a caller can take the session over rather than only being told poses.
- `RoomViewer.tsx` and the new AR view both load a scan and draw splats; the shared part moves to one module so the two do not drift apart.
- The two phone screens, `Phone.tsx` and `Leave.tsx`, stop keeping their own copies of the same AR session lifecycle and share one `use-phone-ar.ts`. Nothing about either screen changes for the person; it happens first so the note screen is reshaped once rather than twice.
- The room view's own movement grows in `pov-controls.ts`, which gains a second source of the same movement vector the keys already produce, fed by a thumb pad drawn over the view and by a head offset read from the camera. `Scan.tsx` gains the pad, *Walk it* and *Lean to look*; `RoomViewer.tsx` hands the controls the offset each frame.
- Reading a head reuses the hand reader's shape exactly — one module that owns MediaPipe and nothing else — and adds its face model to the files the app serves itself, by the same vendoring script. That file must stay under Cloudflare's 25 MiB asset limit, which it does.
- `detail.ts` holds the settings the view may draw at and the watch that steps down through them; `RoomViewer.tsx` applies one. The phone's AR view takes its budget from the same table, so the laptop and the phone cannot disagree about what a setting means.
- **No new packages.** Three.js already carries WebXR, the installed Spark already draws through `renderer.xr.getCamera()`, and MediaPipe's vision tasks are already a dependency for hands.
- No server side, no migration, no schema change. A guest's place in the room still goes up as the same position ten times a second, whatever moved them, so nobody else's page changes at all. Notes, rooms and walking the scan with the keyboard behave exactly as they do today.
- Possible follow-on, decided by the frame-rate check: a trimmed copy of the scan served to phones, which would add one build step and one more public file.
- Worth knowing before the build: the `roam-body` branch (pull request 10) is open against `RoomViewer.tsx` and `Scan.tsx`, the two files the room's movement touches. Different intent, same files.

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

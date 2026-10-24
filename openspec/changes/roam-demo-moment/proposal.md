# The demo moment

**Status:** planned
**Branch:** roam-demo-moment
**Open questions:** none

## Why

Today the ROAM page is an empty room you can walk around. The demo is today, and the thing that wins it is the moment someone is *in* the room with you: a person standing over there, their voice getting louder as you walk up, and their face filling the screen when you reach them. This change adds that moment, driven entirely from the page itself, so it works with no network, no phone, and nothing to go wrong on stage.

## What Changes

- **A person is in the room, and they walk around it.** They stand on the floor, face you wherever you look from, and move along the route the room was filmed from, so they stay where the room looks its best. Until the real clip of a teammate is cut out, they show as a plain coloured figure — everything else works the same, and swapping the clip in later changes nothing else.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">22 video views · 173,224 splats</span><span class="grow"></span><button class="btn-ghost">Room view</button><button class="btn-ghost">Full screen</button></div>
    <div class="bar">the scanned room — Sam walks past the window</div>
    <div class="row gap"><span class="muted">Click the scene, then W/A/S/D to move · drag to look</span><span class="grow"></span><span class="tag-outline">sound off</span></div>
  </div>
  ```

- **You hear them from where they stand.** Their voice is quiet across the room and loud up close, and it moves to your left or right as you turn. Sound can't start until you click the page — browsers forbid it — so a *sound off* tag shows until your first click, then goes.
  ```svg
  <svg viewBox="0 0 220 86">
    <circle cx="66" cy="44" r="36" fill="none" stroke="subtle"/>
    <circle cx="66" cy="44" r="19" fill="none" stroke="line"/>
    <circle cx="66" cy="44" r="4" fill="fg"/>
    <text x="52" y="70" fill="muted">you</text>
    <circle cx="82" cy="36" r="4" fill="fg"/>
    <text x="90" y="34" fill="fg">close · loud · to your right</text>
    <circle cx="196" cy="58" r="3" fill="muted"/>
    <text x="150" y="78" fill="muted">far · faint</text>
  </svg>
  ```

- **Click the person and you watch them up close; close it and you are back exactly where you stood.** Walking away is never needed — the room remembers your spot.
  ```mermaid
  flowchart LR
    room["walk the room"] --> near["reach the person"]
    near --> watch["click to watch"]
    watch -->|close| room
  ```

- **A *Full screen* button makes the room fill the screen**, so it fills a projector instead of sitting in a page.

Non-goals: no live phones, no shared room with other guests, no background removal in the browser, and no second person — all of those are later steps. The figure's clip is prepared outside the app, not recorded in it.

## Capabilities

### New Capabilities

- `roam-figures`: a person placed in the scan by position and facing, driven by one shared source that the scripted stand-in, and later the network and a live phone, all feed; plus click-to-watch and return.
- `roam-spatial-audio`: each figure's voice placed by distance and direction from the viewer, with the first-gesture unlock the browser requires.

### Modified Capabilities

- `roam-scene`: adds a requirement that the room view can fill the screen.

## Impact

- The ROAM mini app `app/src/apps/roam/` gains `figure-source.ts` (the shared `{id, x, y, z, yaw}` feed and the scripted path), `figures.ts` (placement and raycast selection maths), `audio.ts` (the gain and pan curves and the unlock state), `watch-state.ts` (room → watching → room with the saved pose), and the parts that render them. No worker side.
- `RoomViewer.tsx` gains the figure planes, the per-frame listener update, and a click handler; `viewer-state.ts` is untouched.
- **No new packages.** Three.js draws the figure planes and the built-in Web Audio `PannerNode` places the sound.
- A placeholder figure texture and a short looping tone ship under `app/public/apps/roam/`; the real alpha-video clip replaces them in place when it is cut.
- Nothing is deleted and nothing becomes unavailable; the room, its controls, and its camera presets behave exactly as they do now.

## Decision log

- **2026-10-24** — Asked how the team gets the roadmap to review → chose a pull request, opened as #3 off current `main`.
- **2026-10-24** — Asked how step 2 should handle the figure's video and voice, since the stand-in clip is not recorded → chose to build on a placeholder now and swap the clip in later.
- **2026-10-24** — Asked how much step 2 should deliver in one go → chose the whole demo moment: the walking figure, the moving voice, click-to-watch, and full screen together.
- **2026-10-24** — Asked when the demo is → chose today, so the plan takes the shortest safe path and nothing optional is built.
- **2026-10-24** — Assumed: the figure's path waypoints come from the source-camera positions in the scan's details, because the splats hold together along the route the video was filmed and break up away from it (carried from the roadmap).
- **2026-10-24** — Assumed: the figure's height and the floor come from the recorded camera heights, not from real-world metres, because the scan's units are not metres — its cameras sit about 0.35 units above the floor, so a 1.7-unit figure would be a giant.
- **2026-10-24** — Assumed: the placeholder voice is a short looping tone rather than silence, because the moving sound is the heart of the demo and silence would leave it unproven until the clip arrives.
- **2026-10-24** — Assumed: one figure, not two, because the roadmap's step 2 names one and a second adds no new code path, only load.
- **2026-10-24** — Assumed: the room's own `Full screen` uses the browser's full-screen mode on the view's box, so the app's page frame needs no change (carried from the roadmap).
- **2026-10-24** — Asked from the review page for more detail on how the sound gets built → added the full node chain, the distance curve and its floor, the scan-unit scaling, the Safari fallback, and what the tests cover to the design.
- **2026-10-24** — Assumed: all the new maths lands in plain modules with their own tests, and only thin wrappers touch 3D and audio, because every line of this app is tested and 3D and audio cannot be exercised in tests directly (carried from the roadmap).

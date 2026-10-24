# ROAM: the whole project

**Status:** planned
**Branch:** roam-roadmap-review
**Open questions:** none

## Why

When you can't be in the room, you get a flat video window propped on a chair. ROAM gives the room back: you step inside a 3D scan of a real place, walk up to the person you came for, and hear them from where they stand. The demo is today or tomorrow, so this plan puts the dependable demo first and the live-phone work after it.

## What Changes

- **Step 1: the room scan opens on the site and you walk through it.** It's planned on its own as [`roam-scan-on-site`](../archive/2026-10-24-roam-scan-on-site/proposal.md), and it shipped.
  ```mermaid
  flowchart TD
    s1["1 · scan"] --> s2["2 · demo moment"] --> s3["3 · prep"]
    s3 -.-> s4["4–6 · stretch"]
  ```
- **Step 2: a fake person walks through the room, and you hear them where they are.** They're a cut-out of a real teammate, prepared ahead of time, so there's no floating rectangle. Their voice gets louder as you get close and moves left or right as you turn. Sound starts on your first click.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">Sam · by the desk</span><span class="grow"></span><button>Full screen</button></div>
    <div class="bar">the room — Sam walks past the window, voice on your left</div>
    <div class="row gap"><span class="muted">Click Sam to watch</span><span class="grow"></span><span class="tag-outline">sound on</span></div>
  </div>
  ```
- **Step 2 also adds watching up close.** Click the person to watch their video full screen, then go back to where you were. A full-screen button makes the 3D view fill a projector.
  ```mermaid
  flowchart LR
    walk["walk the room"] --> near["get near Sam"] --> watch["click to watch"]
    watch -->|close| walk
  ```
- **Step 3: get ready for the demo.** A run-through checklist on the demo laptop and the venue network, with a backup that works with no internet.
- **Step 4 (stretch): a shared room.** Two people in different browsers see each other inside the room as soft markers, and the fake person's position comes over the network.
- **Step 5 (stretch, likely after the demo): a real phone joins.** An Android phone streams its video and where it stands, lined up with the room using a printed marker.
- **Step 6 (after the demo): polish.** Background removal on live video, walls hiding people behind them, and steady sound with several people talking.

Non-goals: scanning inside the app, an iPhone app, recording sessions, large audiences, and a new sign-in.

## Capabilities

### New Capabilities

- `roam-figures`: people shown in the scan as cut-out figures placed by position, the scripted stand-in, select-to-watch, and full screen.
- `roam-spatial-audio`: each figure's voice placed by distance and direction from the viewer.
- `roam-presence`: a realtime room (Durable Object over WebSockets) that relays positions, shows other guests, and carries video signaling.
- `roam-capture`: the phone page that streams video and its own position, aligned to the scan with a marker.

### Modified Capabilities

None. `roam-scene` (the scan itself) belongs to `roam-scan-on-site`.

## Impact

- The ROAM mini app `app/src/apps/roam/` grows in each step; `app/worker/apps/roam/` and a Durable Object binding arrive in step 4.
- Step 2 assets: a prepared video of a teammate with a transparent background (WebM with alpha, plus an MP4/HEVC fallback for Safari) under `app/public/apps/roam/`.
- Step 5: WebXR (Android only), WebRTC, possibly a TURN relay. Step 6: a browser segmentation model.
- Each step ships as its own change, planned from this roadmap when its turn comes.

## Decision log

- **2026-10-24** — Asked how to save the project plan → chose to save it here as the roadmap, leaving the old `roam-presence` plan in the other workspace untouched.
- **2026-10-24** — Asked who records the fake person's clip → chose a teammate, recorded now.
- **2026-10-24** — Asked when the demo is → chose today or tomorrow, so steps 1–3 are the demo and steps 4–6 are stretch work.
- **2026-10-24** — Asked how to build the 3D view → chose to reuse Edison's working viewer instead of a React 3D library.
- **2026-10-24** — Assumed: cut the fake person out of their background when preparing the clip, not live in the browser, because it gives the demo a real cut-out figure without building live background removal.
- **2026-10-24** — Assumed: tell the story inside one room, not a whole house, because the scan is one room and splats break up away from where the video was filmed.
- **2026-10-24** — Assumed: each step becomes its own change when its turn comes, because small changes keep each preview quick to check before the deadline.
- **2026-10-24** — Asked to save the plans on a new branch → saved on `roam-plans`, plans only, no code.

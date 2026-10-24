# Put the room scan on the site

**Status:** planned
**Branch:** roam-plans
**Open questions:** none

## Why

ROAM, the winning hackathon idea, starts from the real room scan. Today it only opens on one laptop with a hand-run server. Putting it on the site first gives the team a link anyone can open, and it surfaces the risks that could sink a demo tomorrow (the file is too big, the 3D code may not build, and the site's testing rules) on the smallest possible step.

## What Changes

- **A new ROAM page on the site opens the real scanned room, and you walk through it.** It has the same controls as Edison's viewer: W/A/S/D to move, Q/E to go down and up, drag to look, Shift to go faster. Buttons jump to a room view, an overview, a top view, or one of the video's camera spots.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">173,224 splats</span><span class="grow"></span><button>Room view</button><button>Overview</button><button>Top view</button></div>
    <div class="bar">the scanned room — click, then W/A/S/D to walk, drag to look</div>
    <div class="row gap"><span class="muted">Camera</span><span class="tag-outline">View 1</span><span class="grow"></span><span class="muted">Hide ceiling</span></div>
  </div>
  ```
- **While the room loads you see a placeholder; if it can't load, you see why and a way to try again.** A computer without 3D support also gets a plain message instead of a blank page.
- **The scan is shrunk to fit the site.** It's about 39 MB today, and the site serves files up to 25 MB. A compressed copy keeps the same look and loads faster.
  ```text
  room scan   39 MB  ──compress──▶  well under 25 MB
  ```
- **The home page lists ROAM** like any other app.

Non-goals: the fake person, spatial audio, click-to-watch, live phones, the shared live room and cut-out people all come in later changes. Hiding the ceiling and the point-cloud comparison stay in Edison's viewer, not here. The page stays inside the site's usual frame, not full screen.

## Capabilities

### New Capabilities

- `roam-scene`: the ROAM mini app at `/apps/roam/` loads the compressed Gaussian-splat scan and lets the viewer walk it with first-person controls and camera presets.

### Modified Capabilities

None.

## Impact

- New mini app `app/src/apps/roam/` (page, viewer wrapper, POV controls, scene-metadata helpers, tests). No server side.
- New packages in `app/package.json`: `three` (0.180.x) and `@sparkjsdev/spark` (2.4.x), with `@types/three`.
- New static assets under `app/public/apps/roam/`: `room.spz` and `scene.json`.
- A one-off conversion script for PLY → SPZ, run once and kept so the next scan can be converted the same way.
- Source: Edison's draft PR #1 (`origin/codex/room-gaussian-scan-pov`), left as is.

## Decision log

- **2026-10-24** — Asked where to plan the first step → chose to plan it here, from the ROAM plan in the other workspace.
- **2026-10-24** — Asked what the first step should deliver → chose the scan on the site, walkable, on a preview link.
- **2026-10-24** — Asked how to build the 3D view → chose to reuse Edison's working viewer, wrapped in the app, without a React 3D library.
- **2026-10-24** — Asked when the demo is → chose today or tomorrow: the offline demo comes first, and live phones only if time is left.
- **2026-10-24** — Assumed: compress the scan to Spark's `.spz` format, because Cloudflare serves static files up to 25 MiB and the PLY is 40.9 MB. R2 is off on this account, so another host would add setup.
- **2026-10-24** — Assumed: leave out the ceiling cutaway and the point-cloud comparison, because the demo needs neither, and each adds code the site's every-line-tested rule must cover.
- **2026-10-24** — Assumed: name this change `roam-scan-on-site`, and leave the full `roam-presence` plan in the other workspace as the roadmap for later changes.
- **2026-10-24** — Asked to save the plans on a new branch → saved on `roam-plans`, plans only, no code.
- **2026-10-24** — Asked how to fix Overview and Top view showing the ceiling (no cutaway) → chose to leave them as they are.
- **2026-10-24** — Assumed: task 4.1 passes on CI, the gate, though `npm test` fails locally on Windows-only line-ending and path issues in untouched files.
- **2026-10-24** — Assumed: task 4.3 passes on the preview (room renders; W, E, drag, Overview, Top view, Room view and camera 26s all move the camera). The look was judged by eye against the source, not side by side with Edison's viewer.

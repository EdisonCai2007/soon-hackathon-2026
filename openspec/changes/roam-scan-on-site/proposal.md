# Put the room scan on the site

**Status:** in-progress
**Branch:** local-roam-app
**Open questions:** none

## Why

ROAM, the winning hackathon idea, starts from the real room scan. Today it only opens on one laptop with a hand-run server. Putting it on the site first gives the team a link anyone can open, and it surfaces the risks that could sink a demo tomorrow (the file is too big, the 3D code may not build, and the site's testing rules) on the smallest possible step.

## What Changes

- **A new ROAM page on the site opens the real scanned room, and you walk through it.** It has the same controls as Edison's viewer: W/A/S/D to move, Q/E to go down and up, drag to look, Shift to go faster. Buttons jump to a room view, an overview, a top view, or one of the video's camera spots.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">396,264 splats</span><span class="grow"></span><button>Room view</button><button>Overview</button><button>Top view</button></div>
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
- **The scan now covers the whole walk, not one room.** A second walkthrough (`IMG_1251.MOV`) adds the hallway, the WC and a second bedroom; a short clip (`IMG_1252.MOV`) fills the second bedroom. The door between the old bedroom and the hallway is removed, and the second bedroom's people and floor clutter are painted out. The old bedroom is the original sharp scan, spliced back in.
  ```text
  old bedroom (original scan) ─ hallway ─ WC
                                   └── second bedroom (people and clutter removed)
  ```

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
- New scan-update steps in `experiments/room-scan/pipeline/`: `select_frames.py`, `stitch_chunks.py`, `prepare_update.py`, `edit_scene.py`, `cleanup_splats.py`, `splice_room.py` (plus `fit_path.py` and `remove_people.py`, tried and not used). `reconstruct.py` and `export_splats.py` now take several videos. Videos, weights and work files stay in the ignored `work/` folder.
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
- **2026-10-24** — Asked to add a second walkthrough on top of the scan, with the newest state winning and people removed → one geometry run over both videos smeared the hallway and WC, so each room was reconstructed on its own (old bedroom, hallway, WC, second bedroom) and stitched through shared frames. A forced fit to the hand-drawn floor map bent the hallway, so the shared-frame stitch was kept as is. Held-out quality rose from 15 dB (single joint run) to 21.6 dB.
- **2026-10-24** — Asked to remove the old bedroom's door and the second bedroom's people and clutter → door outlined by hand in five frames, masked in training and cut after; people and small objects by Mask R-CNN, floor clutter by colour against the carpet, both painted over before training. A smear stayed where the open door had hidden the wall.
- **2026-10-24** — Asked to bring back the original old-room scan and keep the new rooms → spliced: the new model's splats inside the old bedroom's footprint were replaced by the original's, with its closed door cut. This also removed the door smear. Previous app scans are kept under `work/update/backup-*` (ignored).
- **2026-10-24** — Asked to keep every scan version and pick one from a dropdown → to be planned as its own change.
- **2026-10-24** — Check: `experiments/room-scan/vendor/three.core.js` turns ESLint off for one generated block (`/* eslint-disable */`), because it is the unmodified upstream Three.js 0.180.0 build, vendored for the standalone viewer; editing it would fork the library.
- **2026-10-24** — Check: `experiments/room-scan/vendor/three.module.js` turns off ESLint's `compat/compat` on two lines, because it is the unmodified upstream Three.js 0.180.0 build, vendored for the standalone viewer; editing it would fork the library.
- **2026-10-27** — Asked to save the newest scan and the new pipeline scripts → saved the multi-floor `room.spz` and `scene.json` (with floor heights from `export_splats.py --floors`) and the scripts the "Add another floor" steps use. Training runs and every earlier scan version stay in the ignored `work/` folder: too big for git.

# Sharpen the scan: best upstairs, rebuilt stairs

**Status:** ready-to-ship
**Branch:** roam-best-rooms
**Open questions:** none

## Why

The upstairs hallway and the stairs looked wrong on the live scan. Scoring every saved version of each room against the real video showed why: the cleanups and the bedroom splice applied to the upstairs scan, and the rules that joined the new floor, had each cut away good splats. The hallway lost 8.6 dB on the way to what is live. Now that the scores show which version is best, the site should get it.

## What Changes

- **Upstairs goes back to its best version.** Every room now comes from the full 307-view upstairs fit with only the door cut out, which beat every cleaned and spliced version in every room, including the original bedroom scan.
- **The stairs are rebuilt from 2.6 times as many frames.** One frame every 0.3 s down the stairs and back up, 210 in all, replaces 81.
- **Both floors are fine-tuned together,** so the stairwell, where the two scans meet, is decided by every view that sees it instead of a cut-off rule.
  ```text
  room (held-out PSNR, dB)   live    new
  upstairs hallway           16.5    24.8
  hall at the stairs top     15.7    21.6
  old bedroom                17.2    20.9
  WC                         20.2    22.8
  second bedroom             16.9    19.0
  stairs                  17.3–20.4  22.5–23.0
  downstairs hall, lobby   about the same
  ```
- **The scan builder gains a scorer and a fine-tune,** documented in the pipeline README under *Score before you splice*.

Non-goals: no viewer or live-room change. The lobby and downstairs hallway stay as sharp as before, no sharper.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None: the scan is better, but what the site does is unchanged.

## Impact

- `app/public/apps/roam/room.spz` (11.5 MB, 546,977 splats) and `scene.json` (665 camera views); tests that pin the scan's counts and size.
- `experiments/room-scan/pipeline/`: `score_rooms.py`, `finetune.py`, `combine_datasets.py`, and `prepare_floor.py --width`; README.

## Decision log

- 2026-10-24: Chose versions by score, not by eye. `score_rooms.py` renders each model at frames its training held out and compares with the real video. Upstairs, the raw 307-view model with only the door cut won every room, so the later cleanups and the original-bedroom splice are dropped.
- 2026-10-24: Joined the floors by a short fine-tune on both floors' training frames instead of deletion rules. Every rule scored worse somewhere: keeping upstairs splats fogged the stairs, and removing them cost the upstairs hall up to 4.7 dB. The fine-tune kept upstairs within 0.3 dB of its best and cleared the stairwell.
- 2026-10-24: The downstairs hallway and lobby can't be compared on frames that neither split held out, because there are none. Each model scores 19.1–19.9 dB on its own held-out frames, so they count as unchanged.
- 2026-10-24: Saved as its own version after Edison walked the local build; the branch carries only the splat scan, its pinned tests and the scan-builder scripts.
- 2026-10-24: Archived for shipping; the walk ran on the local build, since this site has no preview deploy.

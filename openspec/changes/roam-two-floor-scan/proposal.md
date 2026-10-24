# Add the first floor to the room scan

**Status:** in-progress
**Branch:** roam-two-floor-scan
**Open questions:** none

## Why

The site still shows the first single-room scan. Since then Edison filmed the upstairs walk and, today, three videos of the floor below: down the stairs, the hallway to the left, and the lobby to the right. Walking both floors is the real ROAM demo, so the site should show it now, as a new version that replaces the old scan.

## What Changes

- **The scan now covers two floors.** Upstairs keeps the bedrooms, hallway and WC. Downstairs adds the staircase, the long hallway to Bedroom 3 and the lobby (the SOON room), joined at the bottom of the stairs through a mirror corner every video films.
  ```text
  upstairs:   bedroom ─ hallway ─ WC ─ second bedroom
                           │
                        stairs (down one storey)
                           │
  downstairs: hallway ─ mirror corner ─ lobby
  ```
- **People are gone.** People are masked in every frame before training, including people seen in the mirror; anyone who sat still the whole time is deleted afterwards.
- **The camera menu lists the new videos** as *Stairs video*, *Hallway video* and *Lobby video*, so a viewer can jump straight downstairs.
- **People in a shared room stand on the floor under them.** The scan's description now lists its floor heights, so a guest downstairs stands on the downstairs floor, and figures keep their size. Before, every figure stood on the lowest point of the scan, which would have put everyone downstairs at about three times their size.
- **The scan builder can add a floor.** New scripts stitch new videos onto an existing scan, mask people, clear haze one scan sees through, and join two separately trained scans.

Non-goals: no other change to the viewer, the live room or phones. The downstairs is softer than upstairs; sharpening it, and splicing each room's best earlier scan, come next.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: the scan covers both floors, joined by the stairs, with people removed, and figures stand on the floor under them.

## Impact

- `app/src/apps/roam/placement.ts` and `scene.ts`: the floor under a height, from the description's optional `floors`; a scan without it keeps one floor at its lowest point.
- `app/public/apps/roam/room.spz` (11.6 MB, 613,872 splats) and `scene.json` (551 camera views) replace the single-room scan; both stay under the 25 MiB file limit.
- `experiments/room-scan/pipeline/` carries the builder scripts and their README; `app/scripts/roam-ply-to-spz.mjs` compresses a scan for the site.
- Source videos, model weights and training data stay outside git.

## Decision log

- 2026-10-24: Saved as a new branch from `main` instead of the open upstairs pull request, which conflicts with the live room. This change carries the two-floor scan, superseding that one's single-floor scan; the old version stays in git history.
- 2026-10-24: Trained the new floor on its own and joined it, instead of retraining both floors, so the upstairs splats stay exactly as they were. Above the upstairs floor plane the old scan wins; below it the new one; at the top of the stairs only the new scan stays, because the old one filled the stairwell with haze.
- 2026-10-24: The live room took its floor and figure scale from the scan's lowest point. With two floors that is the downstairs floor, so the description now lists `floors` and placement uses the highest floor at or below a height. Optional, so a one-floor scan reads as before.

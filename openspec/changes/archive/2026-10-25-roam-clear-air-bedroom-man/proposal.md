# Clear floating haze and add a man doing jumping jacks

**Status:** ready-to-ship
**Branch:** roam-bedroom-man
**Open questions:** none

## Why

Walking the scan, Edison found nine spots where haze and stray splats hung in the air: the upstairs bedroom and hallway, the long downstairs hallway, the stairs and the party room. He also made a fourth animated clip, a man doing jumping jacks, for the old bedroom.

## What Changes

- **Less haze at Edison's nine spots.** 6,405 floating splats are gone; the bedroom, the downstairs hallway's doors and floor, and the party room read through where fog hung before. Floors and ceilings are untouched: only a slice at each spot's eye height was cleared.
- **A man does jumping jacks in the old bedroom**, beside the bed facing the door, looping forever. He is in view as the page opens.
- **The scan builder can clear haze at chosen views** with `clear_views.py`.

Non-goals: haze down the stairwell and right beside the stairs (two of the nine spots) stays, since it lies outside those spots' eye-height slices.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: the scan shows a fourth filmed clip, in the old bedroom, and less floating haze.

## Impact

- `app/public/apps/roam/room.spz` (16.1 MB, 757,543 splats) and `scene.json` replace the scan; `bedroom.glb` (0.77 MB) is new.
- `app/src/apps/roam/people.ts` adds the bedroom clip to `CLIPS`; the pinned splat count and room width follow the new scan in `scene.test.ts`, `App.test.tsx` and `placement.test.ts`.
- `experiments/room-scan/pipeline/clear_views.py` and a README section.

## Decision log

- 2026-10-25: Haze is judged by the training videos, not by opacity or density: a splat goes when frames see past it at least as often as they land on it. Opacity and density tests also deleted the scan's faint white walls and left black holes.
- 2026-10-25: Clearing stays inside a slice 0.6 above and below each spot's eye height, as Edison asked, so floors and ceilings can never be removed.
- 2026-10-25: The jumping-jacks man stands halfway between Edison's first two spots, at his choice, facing the door from his first copied heading; from the opening view his legs meet the bed's side rail, which Edison has seen.
- 2026-10-25: Archived for shipping. The walk ran on a local build of the same files, since this site has no preview deploy.

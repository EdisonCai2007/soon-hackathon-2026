# Add the lobby's other half and two filmed people

**Status:** ready-to-ship
**Branch:** roam-lobby-half
**Open questions:** none

## Why

The scan's ground floor stopped at the living-room half of the lobby: the big party room behind the stairs, with the tables, TV, piano and foosball, was blank. Edison filmed it in one night walk (`IMG_1265.MOV`) that starts and ends at the mirror at the foot of the stairs. He also made an animated clip of himself and a friend on the living-room couch, to show people in the scan.

## What Changes

- **The lobby is whole.** The party room joins the scan, from seconds 8–172 of the night walk; the living room, hallway and stairs stay exactly as they were.
  ```text
  ground floor:  hallway ─ mirror ─ stairs ─ party room (new)
                              │
                         living room (unchanged)
  ```
- **Party lights calmed.** Disco lights tinted the walls purple and threw coloured spots; each frame is white-balanced to its white walls and the spots are left out of training, so the room reads white.
- **The floor is whole.** The floor and furniture were retrained with walls and ceiling frozen, and floor nobody filmed is filled from the floor around it.
- **Two people play on the couch.** An animated model of Edison and a friend stands and sits at the spot Edison chose in the living room, replaying its 7-second clip forever.
- **The camera menu lists the night walk** as *Lobby night video*.
- **The scan builder can add half a storey.** New scripts level a new walk, close its loop, calm party lights, fill floors, and join it without touching the old half.

Non-goals: no change to movement, the live room or phones. The party room's furniture stays soft up close.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: the ground floor covers the whole lobby, and a filmed clip of people plays in the scan.

## Impact

- `app/public/apps/roam/room.spz` (16.2 MB, 763,948 splats) and `scene.json` (1,199 camera views) replace the scan; `people.glb` (1.35 MB) is new. All stay under the 25 MiB file limit.
- `app/src/apps/roam/people.ts` loads and places the clip; `RoomViewer.tsx` adds it after the room and advances it each frame.
- Pinned numbers in `scene.test.ts`, `placement.test.ts` and `App.test.tsx` follow the new scan.
- `experiments/room-scan/pipeline/`: `calm_lights.py`, `level_floor.py` and `fill_floor.py` are new; `extend_scan.py`, `merge_floor.py`, `detect_people.py` and `export_splats.py` gain options; the README documents the steps.

## Decision log

- 2026-10-25: Built on the live scan and kept every old splat outside the new half: on the ground floor each place belongs to whichever scan's cameras came nearest, so the living room filmed in daylight is not replaced by night footage. Edison asked for this twice.
- 2026-10-25: Masked tables and chairs at first to clear clutter, but that left the floor behind them empty; Edison preferred furniture to holes, so the lower 1.2 m was retrained with furniture in view and walls and ceiling frozen.
- 2026-10-25: The first join put the new half 4° off level and 40 cm low across the room; a mirror patch pins position but not tilt. Leveled the walk to the old floor before training.
- 2026-10-25: Compressed the people model from 34 MB to 1.35 MB (meshopt geometry, WebP textures at 1024 px), under the site's 25 MiB file limit. Edison re-exported it with the body hidden under the clothes, which removed a skin-through-cloth workaround.
- 2026-10-25: Saved as a new branch from `main`, where the position readout shipped; the older local branch lacked it.
- 2026-10-25: Archived for shipping. The walk ran on a local build of the same files, since this site has no preview deploy.

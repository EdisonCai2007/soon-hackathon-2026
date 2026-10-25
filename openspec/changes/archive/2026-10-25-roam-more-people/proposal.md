# Two more filmed pairs, and eyes with pupils

**Status:** ready-to-ship
**Branch:** roam-fireplace-people
**Open questions:** none

## Why

The scan plays one animated clip, Edison and a friend on the living-room couch. Edison made two more: a man and a woman talking in front of the fireplace, and a man and a woman seated by the white desk under the stairs. He also re-exported the couch clip, and noticed that every model's eyes showed no pupils.

## What Changes

- **Two more pairs play in the scan.** The fireplace pair stands in front of the living-room fireplace, the man in the blue hooded jacket and the woman in the headscarf each on a spot Edison copied. The seated pair sits by the white desk under the stairs, in front of the SOON posters. Both loop forever, like the couch clip.
- **The couch clip is Edison's new export**, with the same rig and placement.
- **Eyes show their pupils.** The models' clear cornea was drawn solid over the iris; it is now left out, on every clip.
- **All clips are visible from anywhere**, loaded together once the room is in, whichever camera is picked.

Non-goals: no chairs are added under the seated pair, and the models keep the two plain lights.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: three filmed clips play in the scan, and their eyes show pupils.

## Impact

- `app/public/apps/roam/fireplace.glb` (1.74 MB) and `chairs.glb` (1.47 MB) are new; `people.glb` (1.34 MB) is replaced. All are meshopt- and WebP-compressed, under the 25 MiB file limit.
- `app/src/apps/roam/people.ts` lists the clips in `CLIPS`, loads them together under one pair of lights, and skips the cornea in each model's eye material; `people.test.ts` covers every clip's placement, looping and the eyes.

## Decision log

- 2026-10-25: Each clip is placed by one person's copied spot, turned so the second person's copied spot or facing fits as well as the clip allows. For the fireplace the two spots were 1.34 apart against the clip's 1.31, so both land within a few centimetres; for the chairs the spots were 0.42 apart against 1.15, so the woman sits on hers and the man faces within 3° of his facing.
- 2026-10-25: The seated pair moved half a body (0.4 scan units) toward the white desk, as Edison asked after seeing it.
- 2026-10-25: Pupils were in the eye texture all along: MakeHuman wraps a clear cornea 2.5 mm over each eyeball, mapped to the texture's bottom-right corner, and the export draws it solid. The eye material now discards that corner instead of needing a re-export.
- 2026-10-25: Archived for shipping. The walk ran on a local build of the same files, since this site has no preview deploy.

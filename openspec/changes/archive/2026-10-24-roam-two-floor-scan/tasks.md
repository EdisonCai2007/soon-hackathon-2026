# Tasks

## 1. Build the two-floor scan

- [x] 1.1 Reconstruct the four new pieces with Pi3X and stitch them to the upstairs scan; verify each fit's shared-frame error is under 10 cm in `stitch_report.json`.
- [x] 1.2 Mask people in every chosen frame with `detect_people.py`; verify on a contact sheet of the lobby's masks, mirror included.
- [x] 1.3 Train the new floor, delete leftover people and see-through haze, and join it to the upstairs scan with `merge_floor.py`; verify in the local viewer that the stairs, hallway and lobby cameras show the floor and the lobby shows no seated person.
- [x] 1.4 Export `room.spz` and `scene.json` to `app/public/apps/roam/`; verify the file is under 25 MiB and the camera menu lists the stairs, hallway and lobby videos.
- [x] 1.5 List the floor heights in `scene.json` and stand figures on the floor under them; verify with `npx vitest run src/apps/roam` (placement, scene and app tests).
- [x] 1.6 Document adding a floor in `experiments/room-scan/pipeline/README.md`; verify the scripts compile with `python3 -m py_compile experiments/room-scan/pipeline/*.py`.

## 2. Verification

- [x] 2.1 `/save` passes its checks, and a walk of `/apps/roam/` (local build; this site has no preview deploy) opens upstairs, and the stairs, hallway and lobby cameras reach the floor below.

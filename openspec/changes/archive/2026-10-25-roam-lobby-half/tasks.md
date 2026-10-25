# Tasks

## 1. Build the lobby's other half

- [x] 1.1 Reconstruct the night walk in six Pi3X pieces tied to the stairs video's mirror frames, close its loop and level it; verify every piece's floor sits within 2 cm of -3.95.
- [x] 1.2 Calm the party lights with `calm_lights.py`; verify on contact sheets that walls read white and banners keep their colour.
- [x] 1.3 Train the party room, retrain the floor and furniture with walls and ceiling frozen, and fill unfilmed floor with `fill_floor.py`; verify renders from the training cameras show an unbroken floor.
- [x] 1.4 Join with `merge_floor.py --split-below -1.35` and export `room.spz` and `scene.json` to `app/public/apps/roam/`; verify both are under 25 MiB and the camera menu lists *Lobby night video*.
- [x] 1.5 Document the steps in `experiments/room-scan/pipeline/README.md`; verify the scripts compile with `python3 -m py_compile experiments/room-scan/pipeline/*.py`.

## 2. Play the people clip

- [x] 2.1 Compress the clip to `app/public/apps/roam/people.glb` and load it in `people.ts` from `RoomViewer.tsx`, placed at Edison's spot and looping; cover the placement in `people.test.ts`.
- [x] 2.2 Update the pinned scan numbers in `scene.test.ts`, `placement.test.ts` and `App.test.tsx`; verify with `npx vitest run src/apps/roam`.

## 3. Verification

- [x] 3.1 `/save` passes its checks, and a walk of `/apps/roam/` (local build; this site has no preview deploy) shows the party room from a *Lobby night video* camera and both people on the couch from *Lobby video 16.4s*.

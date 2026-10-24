# Tasks

## 1. Pick and rebuild

- [x] 1.1 Score every saved upstairs version per room with `score_rooms.py`; verify the chosen base wins or ties in every room.
- [x] 1.2 Re-run the stairs at one frame every 0.3 s in three Pi3X pieces and stitch them; verify each fits its parent within 10 cm in `stitch_report.json`.
- [x] 1.3 Train the downstairs on the denser stairs, join it to the door-cut upstairs, fine-tune both floors together and remove leftover people; verify held-out scores beat the live scan upstairs and on the stairs, and hold on the downstairs hall and lobby.
- [x] 1.4 Export to `app/public/apps/roam/` and update the tests that pin the scan's counts and size; verify `npx vitest run src/apps/roam` passes.
- [x] 1.5 Document scoring and the fine-tune in `experiments/room-scan/pipeline/README.md`; verify the scripts compile.

## 2. Verification

- [x] 2.1 Walk the local build: the upstairs hallway, the top of the stairs, the flight down, the bottom of the stairs and the lobby render cleanly, with no person on the lobby chair.

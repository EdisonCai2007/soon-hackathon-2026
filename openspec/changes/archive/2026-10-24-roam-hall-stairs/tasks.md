# Tasks

## 1. Rebuild the hall and stairs

- [x] 1.1 Reconstruct the hall from `IMG_1258.MOV` (0–45 s, a frame every 0.25 s) in two Pi3X pieces and stitch them; verify each fits within 3 cm.
- [x] 1.2 Train the hall and stairs on both walks at 1008 px and remove leftover people; verify held-out scores beat live on the stairs video's hall frames.
- [x] 1.3 Swap the space in with `region_swap.py` and blend the seam with `finetune.py --freeze-first`; verify the kept splats are byte-identical, and the bedrooms, WC and first floor score within 0.3 dB of live.
- [x] 1.4 Bring figures up to date before a pick in `stage.ts`; verify the picking tests pass with the new scan.
- [x] 1.5 Clear head-height air between the walls with `clear_air.py`; verify off-walk renders before and after, and that only the new splats change.
- [x] 1.6 Clear the hanging clouds over the old bed and in the WC doorway, keeping walls; verify renders from Edison's spots before and after, with no holes.
- [x] 1.7 Export with the hall cameras, update the tests that pin the scan's counts and size, and document the swap; verify `npx vitest run src/apps/roam` passes.

## 2. Position line

- [x] 2.1 Report the camera's pose from `RoomViewer` through an optional `onWhere`, on the stance gate; verify with a `RoomViewer.test.tsx` case that a drawn frame reports the camera's position.
- [x] 2.2 Show the position and facing under the camera choice in `Scan.tsx`, with a Copy button that writes the one-line text; verify with an `App.test.tsx` case that the line appears once the room is ready and Copy writes it to the clipboard.

## 3. Verification

- [x] 3.1 Walk the local build: the hall from the old-bedroom door to the stairs, down the stairs, and the older video's hall views render cleanly, and the position line follows the camera and copies.

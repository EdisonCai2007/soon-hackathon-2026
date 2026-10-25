# Tasks

## 1. Clear haze at the nine views

- [x] 1.1 Write `clear_views.py`, deleting candidates in each view's eye-height slice that training frames see past; verify before-and-after renders of the nine views show no new holes.
- [x] 1.2 Export the cleared scan to `app/public/apps/roam/` and update the pinned splat count and room width in the tests; verify with `npx vitest run src/apps/roam`.
- [x] 1.3 Document it in `experiments/room-scan/pipeline/README.md`; verify with `python3 -m py_compile experiments/room-scan/pipeline/*.py`.

## 2. Add the bedroom clip

- [x] 2.1 Compress the clip to `app/public/apps/roam/bedroom.glb` and add `BEDROOM` to `CLIPS`; verify in the local app that the opening camera shows him beside the bed.

## 3. Verification

- [x] 3.1 `/save` passes its checks with full coverage.

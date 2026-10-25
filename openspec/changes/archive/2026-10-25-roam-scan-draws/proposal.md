# Draw the scan on laptops, and take out the placing tools

**Status:** ready-to-ship
**Branch:** roam-scan-draws
**Open questions:** none

## Why

Edison opened ROAM on his laptop and saw a blank room: the filmed people drew, the scan behind them did not. He also wants the placing tools gone for good: the camera position line, the camera dropdown and the video-view and splat counts.

## What Changes

- **The scan draws at full detail.** The laptop's first detail step keeps level-of-detail drawing on, with no splat cap, so the scan shows instead of a dark room.
    ```mermaid
    flowchart LR
      load["detail tree"] --> full["LOD on, no cap"] --> room["room drawn"]
    ```
- **No placing tools.** The counts, the camera dropdown and the position line with Copy are removed, along with the `?tools` address that showed them.
    ```screen
    ROAM          [room view|overview|top view]        [full screen]

                  (the scanned room, with its people)

    Click the scene, then W/A/S/D to move …           [start a room]
    ```

Non-goals: no change to the scan, the people, or how detail drops when the frame rate falls.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: the scan draws at full detail; the placing tools are removed.

## Impact

- `app/src/apps/roam/detail.ts`: the first step turns LOD on; `RoomViewer.test.tsx` checks it.
- `app/src/apps/roam/Scan.tsx`, `invite.ts`: the tools and `toolsOn` are gone; `Tools.tsx` is deleted; `App.test.tsx` checks nothing shows even with `?tools`.

## Decision log

- 2026-10-25: Spark draws a scan built as a level-of-detail tree only through its LOD path. The first step (`lod: false`) left the room blank until a slow frame rate dropped to the next step, which is why it sometimes appeared. Same fix as Wingho's unmerged PR #20 (`roam-local-dev`), taken alone so it ships now.
- 2026-10-25: Edison asked for the tools removed outright, not hidden behind `?tools`, so the code, its tests and the spec requirements go together.
- 2026-10-25: Archived for shipping. Checked on a local build: the room draws and stays drawn at the plain address and at `?tools`, with no tools shown.
- 2026-10-25: Archive checkpoint: saved on branch roam-scan-draws, cut from main at a963b2b (Alice's iteration 4 look with Edison's scan and people).

# Design

## Context

See the [proposal](proposal.md). The hall and stairs work is done. This design covers the position line. `RoomViewer` already reads the camera ten times a second to tell a live room where the person stands (`stanceOf`, `dueToSend`).

## Goals / Non-Goals

**Goals:** a readout of the camera's position and facing that stays current, and a one-press copy.

**Non-Goals:** picking a point on a surface; editing the scan from the page.

## Decisions

- **The viewer reports its pose on the stance gate.** `RoomViewer` takes an optional `onWhere(pose)` and calls it with `cameraPose(camera)` on the same `dueToSend` gate it already uses, so the page re-renders a few times a second, not every frame.
- **Viewer coordinates, three decimals.** The camera's world position is already in the coordinates `scene.json` uses for its cameras, because the splats carry the display rotation and translation. The facing is the unit look direction. The copied text is one line: `x 1.234 y 0.312 z -0.451 facing 0.71 -0.10 -0.70`.
- **Copy uses the clipboard API** and says *Copied* until the camera moves to a new spot. Where the browser refuses, the line stays selectable to copy by hand.

## UX

- The line sits under the camera choice, in small muted text, so it never covers the room.
- Numbers keep a fixed width (tabular figures) and do not jump as they change.
- On a phone the line wraps under the camera choice; Copy stays a full-size button.

## Risks / Trade-offs

- [A re-render a few times a second could slow the page] → only the small line re-renders; the 3D view lives in refs.

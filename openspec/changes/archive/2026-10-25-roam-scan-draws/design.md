# Design

## Context

`detail.ts` lists the laptop's detail steps, heaviest first; `RoomViewer.tsx` applies one to Spark's renderer. The scan loads as a level-of-detail tree, which Spark draws only while `enableLod` is on. The placing tools lived in `Tools.tsx`, shown by `Scan.tsx` when `toolsOn()` read `?tools` from the address.

## Goals / Non-Goals

**Goals:** the room draws on a laptop from the first frame; no placing tools anywhere.

**Non-Goals:** changing how detail drops when the frame rate falls, or the scan itself.

## Decisions

- **LOD on at the first step, with no cap.** `splats: 0` keeps it drawing everything, so a fast machine sees what it did before. Rebuilding the scan without a tree was the alternative; it would cost the lower steps their cheap drawing.
- **Delete the tools, not hide them.** Edison asked for them gone; the `?tools` switch and its spec requirements go too. `RoomViewer`'s `onWhere` prop stays, unused by the page, to keep this change small.

## Risks / Trade-offs

- [Spark's LOD path at no cap may draw a little differently from plain drawing] → seen locally: the room looks as before.

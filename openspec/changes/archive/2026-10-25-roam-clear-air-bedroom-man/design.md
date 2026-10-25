# Design

## Context

The live scan comes from `work/lobby2/merged3/` (outside git); its `reconstruction.npz` holds every training frame's camera and Pi3X depth in the scan's own coordinates. Edison copied nine views from the viewer's *You are at* line. The bedroom clip is a one-person MakeHuman export whose hips start at the model's origin.

## Goals / Non-Goals

**Goals:** remove air haze at the nine views without touching floors, ceilings or walls; play the bedroom clip like the others.

**Non-Goals:** a scan-wide haze pass; clearing outside each view's slice.

## Decisions

- **Candidates by view.** A splat is a candidate when it lies within 3.5 ahead of a view, inside a 50° half-angle wedge, and within 0.6 of the view's eye height.
- **Evidence from the footage.** For each candidate, every training frame projects it and compares its depth with that frame's own depth there: about equal is a landing, well short is a see-through. Candidates seen through at least twice and at least as often as landed on are deleted. Walls stop the frames' depth, so they stay.
- **One more clip in the list.** `BEDROOM` anchors the man's start at the origin on Edison's spot; `CLIPS` loads it with the others.

## Risks / Trade-offs

- [Views 4 and 5 barely changed: their haze is below the slice or is the near wall] → a view at the haze's own height clears it.
- [A thin real object seen past from many frames, such as a lamp stem, could go] → none seen in the nine views' renders.

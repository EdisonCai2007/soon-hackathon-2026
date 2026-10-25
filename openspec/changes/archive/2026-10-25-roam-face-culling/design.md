# Design

## Context

`people.ts` loads each clip with `GLTFLoader` into the world. Three.js culls each mesh against the view by a bounding sphere; for a skinned mesh it measures that sphere once, in the pose of the first frame it is tested.

## Goals / Non-Goals

**Goals:** no part of a person disappears while it is on screen.

**Non-Goals:** saving draw calls on people out of view.

## Decisions

- **Turn culling off for the clips' parts.** Every object under a loaded clip gets `frustumCulled = false`. The four clips hold about 30 small meshes, which the GPU skips cheaply when off screen.
- **Not re-measuring bounds every frame.** Recomputing skinned bounds walks every vertex each frame, costing more than drawing the parts.

## Risks / Trade-offs

- [People behind the camera are still sent to the GPU] → negligible at this size.

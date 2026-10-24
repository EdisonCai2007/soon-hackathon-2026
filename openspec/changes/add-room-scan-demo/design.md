# Room scan handoff design

## Context

See [the proposal](proposal.md). The working scan is an existing static experiment; importing it does not introduce a main-app route or change the application shell.

## Goals / Non-Goals

**Goals:** retain a runnable artifact, first-person controls, the original PLY, dependency licenses, tests, and portable processing scripts.

**Non-Goals:** main-app integration, deployment, collision geometry, merging, source-video redistribution, or shipping model weights.

## Decisions

- Store the demo under `experiments/room-scan/`, served with a localhost-only static server. Rewriting it as a React mini app would expand the user's artifact-transfer request.
- Vendor the pinned Three.js and Spark modules so viewing the included scan needs no external CDN or build step.
- Preserve the PLY's raw world coordinates and apply the recorded rigid transform in SplatMesh; this preserves directional spherical harmonics.
- Use a dedicated POV controller. Mouse look changes orientation only; W/A/S/D move on the horizontal plane, Q/E change height, and lost focus clears held keys.
- Include camera presets and the original point cloud for comparison. The original footage and large training weights remain outside Git.
- Create the PR directly as a draft, as the user requested; do not run a delivery command that creates a ready-for-review PR or merges it.

## Risks / Trade-offs

- A binary PLY increases repository size → include the one requested cleaned model, not checkpoints or raw footage.
- Incomplete capture creates holes or stretching → document the limits and offer source-camera presets.
- Native MPS sampling crashes → include the isolated CPU sampling/count workaround and pinned trainer revision.
- The demo is not a deployed app route → document the exact local serve command.

## Migration Plan

No application migration or deployment. Review the draft PR; deleting the experiment reverses the import.

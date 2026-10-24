# Room scan demo

**Status:** in-progress
**Branch:** codex/room-gaussian-scan-pov
**Open questions:** none

## Why

Keep the completed room scan and its working viewer in the hackathon repository so teammates can run it and review the reconstruction work.

## What Changes

- Add the fitted room scan, a local viewer, movement tests, and the scripts used to reconstruct it.
- Let viewers move with W/A/S/D, go down/up with Q/E, and drag to turn from their current position.
  ```text
  Room view    Overview    Top view
  +------------------------------+
  |      Gaussian-splat room     |
  |    move and look from here   |
  +------------------------------+
  Ceiling   Render mode   Camera
  ```
- Document the original scan, local processing, dependencies, and known limitations.

Non-goals: integrate the experiment into the main app, deploy it, merge the PR, or include the source video or model weights.

## Capabilities

### New Capabilities

- `room-scan-demo`: a self-contained local Gaussian-splat viewer and reproducible processing handoff.

### Modified Capabilities

None.

## Impact

Adds `experiments/room-scan/` only, plus this change record. The existing application and deployment configuration remain untouched. The PLY is about 39 MiB; vendor files include their upstream licenses.

## Decision log

- **2026-10-24** — Asked: the user confirmed the public `EdisonCai2007/soon-hackathon-2026` repository as the destination for the scan and viewer, and requested a new branch and draft PR.
- **2026-10-24** — Assumed: transfer the already-built viewer as a self-contained experiment, because the request is to save and review this artifact rather than build a new page in the main app.
- **2026-10-24** — Assumed: retain the original PLY in Git and omit the source video, training caches, and model weights; this makes the requested artifact reviewable without shipping the training environment.

- **2026-10-24** — Check: `experiments/room-scan/vendor/three.core.js` retains upstream lint-disable comments because this is the unmodified, pinned Three.js distribution; no project lint or test configuration is weakened.
- **2026-10-24** — Check: `experiments/room-scan/vendor/three.module.js` retains upstream lint-disable comments for the same unmodified vendor distribution, rather than editing third-party code to satisfy a text scan.

- **2026-10-24** — Assumed: readiness is supported by all six POV tests, successful portable preparation/export against the original scan, Python compilation, strict OpenSpec validation, browser POV checks, and `LOCAL_CHECKS=pass`. Review found and reproduced a custom-timestamp filename error; indexed filenames resolve it.

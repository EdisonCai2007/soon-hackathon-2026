# Keep the people's faces and hair drawn up close

**Status:** ready-to-ship
**Branch:** roam-face-culling
**Open questions:** none

## Why

Edison noticed that up close, his own standing model by the couch lost its eyes, mouth and hair, while the other models stayed whole.

## What Changes

- **Every part of every filmed person is always drawn**, wherever its animation takes it, so faces and hair no longer vanish up close.

Non-goals: no change to where the clips stand or how they move.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: the filmed people stay whole however close the viewer comes.

## Impact

- `app/src/apps/roam/people.ts` turns off view culling for every part of each loaded clip; `people.test.ts` checks it.

## Decision log

- 2026-10-25: Three.js skips a skinned part when bounds measured on its first frame leave the view, and never re-measures them. Edison's rig walks 0.52 m during his clip (the jumping-jacks man 0.66 m) while the others move at most 0.20 m, so only his small head parts were judged at a spot he had left. Drawing every part always costs little for about 30 small parts; re-measuring each frame would cost more. The glitch did not reproduce in the agent's browser, whose walk controls stopped short of his face.
- 2026-10-25: Archived for shipping. The walk ran on a local build of the same files, since this site has no preview deploy.

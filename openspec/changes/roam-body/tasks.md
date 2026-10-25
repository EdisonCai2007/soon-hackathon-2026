# Tasks

## 1. The rig's arithmetic

- [x] 1.1 Add `rigParts(scene)` to `app/src/apps/roam/placement.ts`: the head, torso and hand sizes and rest positions, and the face's radius, every number a fraction of `figureSize(scene).height` as [the design's table](design.md#the-rig-as-fractions-of-h) sets them, with the head's top at that height.
- [x] 1.2 Add `facePlacement(bodyYaw, viewerYaw, radius)` to the same file: the face's local yaw and its `x, z` on the circle about the head's centre.
- [x] 1.3 Add `handSwing(walked, pace, now)` to the same file: phase from distance walked, amplitude from pace, opposite offsets for the two hands, the small lift, and the drift that never stops.
- [x] 1.4 Extend `placement.test.ts`: the rig's top sits at the figure's height and no part escapes its width; the face reads square to a viewer from each side and from straight above, where `billboardYaw` is `0`; the hands swing opposite one another, fade to the drift at rest, and repeat over one stride.

## 2. The bodies on the stage

- [x] 2.1 Rework `app/src/apps/roam/stage.ts` to build a `Group` per person — head, torso, two hands, face plane — over four geometries made once, one material in the member's colour for the body and one for the face, with the group's origin on the floor at their position.
- [x] 2.2 Move the video and voice onto the new parts: the stream's texture goes on the face material, and `hear` is given the head's world position.
- [x] 2.3 Turn the group by the reported yaw each frame, place the face through `facePlacement`, and move the hands through `handSwing`, accumulating `walked` and smoothing `pace` from the interpolated position.
- [x] 2.4 Make `pick` test every part, answering `{ kind: 'peer', id }` for the owning person while the note markers keep answering `note`, and make `remove` and `dispose` clear the group, both materials, the texture and the shared geometries.
- [x] 2.5 Rewrite the figure half of `stage.test.ts` against the group, leaving the note-marker tests as they are: a body per person added and removed, the parts in their places on the floor, the face turned to the viewer while the body holds its own facing, the video landing on the face only once, the hands moving as a person crosses the room and settling when they stop, and a press on a hand or the torso naming that person.
- [x] 2.6 Match the picking and figure-height expectations in `RoomViewer.test.tsx` to the new parts.

## 3. What shipped

- [x] 3.1 Update the figures paragraph in `wiki/stack/live-rooms.md#what-the-browser-side-owns` to say what a person is drawn as, in one line, and note that hands are derived from movement until a headset can send them.
- [x] 3.2 Run `npm test` in `app/` and fix what it reports.
- [ ] 3.3 Walk the preview: stand near someone, walk around them, watch someone cross the room, and look down from the top camera — the face reads from every angle and the hands swing with the walking. `(outward — needs a second person or a second browser)`

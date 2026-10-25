## Context

`app/src/apps/roam/stage.ts` draws one `Mesh` per person: a `PlaneGeometry` sized by `figureSize(scene)`, a `MeshBasicMaterial` carrying either the member's colour or a `VideoTexture`, positioned at `standing(pose, scene)` with `height / 2` added, and rotated by `billboardYaw` so it always faces the camera. The same mesh is the raycast target for click-to-watch, and its position is where `audio.ts` places that person's voice.

Three constraints shape the work:

- **The scan is not in metres.** Every size derives from `figureSize(scene).height`, itself the median height the room was filmed at above the floor under each camera (`placement.ts`). The rig gets no absolute number; `H = figureSize(scene).height` is the only unit, and `W = 0.38H` stays the figure's width.
- **The wire carries four numbers.** `{ x, y, z, yaw }` ten times a second (`messages.ts`), interpolated by `pose-feed.ts`. Hands have no source, so their motion must be derived from the interpolated pose alone, inside the frame loop.
- **The rules are pure functions, the stage is the shell.** `placement.ts` and `audio.ts` are tested without a GPU; `stage.ts` is tested in jsdom against a stand-in `Object3D` world and a stand-in sound card. The rig's geometry and motion belong in `placement.ts` so they stay arithmetic.

## Goals / Non-Goals

**Goals:**

- A head, a torso and two hands per person, drawn from one `Group`, with the video on a face that always reads.
- Hand motion derived from the distance a person actually travels, settling at rest.
- The same picking, the same voices, the same lifecycle, and no change to any message.
- Hands positioned so a later headset change can set them from real input and delete nothing else.

**Non-Goals:**

- An `immersive-vr` session, hand or controller input, or any new field on the wire.
- Arms, legs, elbows, or inverse kinematics.
- Per-person appearance beyond the colour the room already assigns.

## Decisions

### A `Group` per person, with shared geometry

`makeStage` creates the four geometries once — head cube, torso box, hand cube, face plane — and reuses them for everybody, as it reuses one `PlaneGeometry` today. Per person it creates a `Group`, one `MeshBasicMaterial` in their colour shared by head, torso and both hands, and a second material for the face. `Figure` grows from one mesh to `{ group, head, torso, hands: [left, right], face, bodyMaterial, faceMaterial, … }`.

The group's origin sits on the floor at the person's position, so every part's `y` is read straight from the rig table below rather than offset by `height / 2`. The group carries the body's yaw; parts never rotate individually except the face.

Alternative considered: one merged geometry per person, rebuilt as hands move. Rejected — it moves vertices every frame for five boxes, where five transforms cost nothing.

### The rig, as fractions of `H`

A new `rigParts(scene)` in `placement.ts` returns sizes and rest positions, all derived:

| part | size | centre (x, y, z) |
|-|-|-|
| head | cube `0.26H` | `0, 0.87H, 0` |
| torso | `W × 0.34H × 0.22H` | `0, 0.57H, 0` |
| hand | cube `0.11H` | `±0.27H, 0.50H, 0.06H` |
| face | plane `0.24H` square | on a circle of radius `0.19H` about the head's centre |

The head's top lands at `H`, so the rig is exactly as tall as today's rectangle and `rangeFor` in `audio.ts` keeps its meaning. Nothing fills the space under the torso: that gap is the VR look, not an omission.

### The face is a plane orbiting the head, not a painted face

Painting the video on the head's front face would hide it whenever someone looks away — the thing the chosen behaviour rules out — and a plane fixed inside the head would intersect it as it turned. So the face is a child of the group that orbits the head's centre at radius `0.19H`, just clear of the cube's half-diagonal (`0.26H × √2 ⁄ 2 ≈ 0.184H`).

`facePlacement(bodyYaw, viewerYaw, radius)` returns the local yaw `viewerYaw − bodyYaw` and the local `x, z` on that circle, so the stage sets one rotation and one position. Because it is a child of a group already rotated by `bodyYaw`, the plane ends up square to the viewer in world terms. The function is pure arithmetic and tested alone: facing the viewer from each side, and from directly above, where `billboardYaw` already degrades to `0`.

### Hands swing on distance travelled, not on the clock

Swinging on time would leave a stationary person windmilling. Each frame the stage adds the distance the interpolated position moved to that figure's `walked`, and smooths a `pace` (units per second) toward the frame's own speed with the same kind of exponential smoothing the voices use.

`handSwing(walked, pace, now)` in `placement.ts` returns a fraction for each hand:

- phase `π × walked / (0.9H)` — one swing per step, a step being a little under the figure's own width-to-height ratio;
- amplitude `clamp01(pace / paceFull)`, so the swing fades in as someone sets off and fades out as they stop;
- forward offset `sin(phase) × 0.12H`, opposite for the two hands, with a small lift of `|sin(phase)| × 0.02H`;
- a drift of `0.004H × sin(now / 900)` added always, so hands at rest are not frozen.

Both the swing and the drift are applied in the group's local space, so they follow the body's facing for free.

Alternative considered: deriving the swing from the reported pose history in `pose-feed.ts`. Rejected — the frame loop already has the interpolated position, and putting motion state in the feed would make every reader of a pose carry it.

### Picking and disposal follow the parts

`pick` already answers `{ kind: 'peer' | 'note', id }` and tests the note markers left in the place beside the figures. Its figure side grows from one mesh each to every part of every group, with the id found by the part's owning group, so clicking a hand, the torso or the face watches that person, the markers keep answering `note`, and a click past everything still answers nothing. The `updateWorldMatrix` pass before the raycast must now cover the parts, whose world matrices come from their group.

`dispose` removes the group, disposes both materials and the video texture, and the four shared geometries are disposed once with the stage, beside the marker geometry already there.

### The voice moves to the head

`hear` is given the head's world position instead of the rectangle's centre — a few tenths of `H` higher. `audio.ts` is untouched; only the point handed to it changes.

## Risks / Trade-offs

- **The face is a lie, and from directly above it is a visible one.** → The same lie the billboarded rectangle tells today; the overview and top cameras already look down on faces that have turned to meet them.
- **Five meshes per person instead of one.** → A room's cap is a handful of people, so thirty extra transforms a frame against a splat scan that costs orders of magnitude more. No instancing is worth the complexity at this size.
- **Swing constants are guesses until seen.** → They are named fractions in one table in `placement.ts`, tested for behaviour (opposite hands, settling at rest) rather than for exact numbers, so tuning them on the preview breaks nothing.
- **Existing tests assert `world.children[0]` is a `Mesh` with a material.** → `stage.test.ts` and the picking test in `RoomViewer.test.tsx` are rewritten against the group in the same pass, not left to fail.
- **A person who teleports — a view jump, a lost AR anchor — would spin their hands.** → The pace smoothing caps the amplitude at full swing, and the phase advances continuously, so the worst case is one fast swing rather than a blur.

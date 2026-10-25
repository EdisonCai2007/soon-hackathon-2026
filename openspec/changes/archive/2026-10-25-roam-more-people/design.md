# Design

## Context

`people.ts` placed one clip: a MakeHuman export of two rigged people sharing one origin, turned to a copied heading, scaled from metres into scan units, and shifted so one person's starting hips land on a copied spot. Edison's new clips have the same shape: `clip1_two_people_animated.glb` (fireplace, 11.7 s) and `clip3_two_people_animated.glb` (seated, 3.6 s).

## Goals / Non-Goals

**Goals:** three clips playing at once in their places, and eyes with pupils.

**Non-Goals:** per-clip lighting, or furniture for the seated pair.

## Decisions

- **One list of placements.** `CLIPS` holds every clip; `addPeople` loads them in parallel and adds them under one hemisphere and one directional light. One failed load fails them all, which leaves the room as it was.
- **Anchor the person whose spot is surest, turn for the other.** A placement anchors one person's hips; its heading is solved so the other person's copied spot or facing fits best. A clip's spacing is fixed, so when two copied spots disagree with it, the anchor wins.
- **Skip the cornea by texture position.** MakeHuman's eyes are two shells in one `<body>.high-poly` mesh: the eyeball, mapped to the iris and pupil, and a clear cornea 2.5 mm in front, mapped to the texture's corner beyond 0.87 in both axes. The eye material's fragment shader discards that corner, so the painted pupil shows on any MakeHuman export.

## Risks / Trade-offs

- [The seated pair sits on no visible chair] → accepted; the scan's chairs there are faint.
- [A future export that maps the eyes differently would lose part of the eyeball] → the test pins the corner the shader skips; check the eye texture of a new rig.

# Design

## Context

The live scan joins upstairs, the stairs, the hallway and the living-room half of the lobby ([pipeline README](../../../experiments/room-scan/pipeline/README.md)). The night walk `IMG_1265.MOV` (201 s) starts and ends facing the mirror at the foot of the stairs, which the stairs video `IMG_1258.MOV` also films. The party room had disco lights on and was full of tables and chairs.

## Goals / Non-Goals

**Goals:** the party room in the scan, the living room untouched, white walls despite the lights, a whole floor, and the people clip playing on the couch.

**Non-Goals:** sharp furniture, or rescanning the living room at night.

## Decisions

- **Six pieces, one loop.** Pi3X ran on six pieces of about 95 frames, 10 shared. The first and last pieces add 11 of the stairs video's mirror frames: the first ties the walk to the scan (5 cm), the last measures the loop's drift (20 cm), spread back along the walk by time.
- **Level after stitching.** The mirror patch left the walk tilted 4°. `level_floor.py` fits the floor as the densest band of low points and turns it flat about the mirror; every piece then sits within 1 cm of the old floor height.
- **Lights as data, not colour.** `calm_lights.py` white-balances each frame to its brightest, least coloured pixels, drains faint tint from near-white surfaces, and marks light spots transparent: small patches more saturated than their surroundings and no darker. Banners, balloons and wood fail that test and keep their colour.
- **Walls once, floor twice.** The first training masked people and furniture, which gave clean walls and an empty floor. A second, 4,000-step run froze every splat more than 1.2 m above the floor and relearned the rest with only people masked. `fill_floor.py` then lays floor splats only where no floor splat reaches, just under the real floor.
- **Each place to its nearest filmer.** `merge_floor.py --split-below -1.35` gives ground-floor places to the scan whose cameras came nearest; night cameras within 1 m of an old one are passing through and claim nothing.
- **People placed by one person's spot.** The clip's two rigs share one origin. `people.ts` turns the model to Edison's heading, scales it from metres into scan units, and shifts it so his starting hip position lands on his copied spot, on the floor under it; the friend's seat follows from the clip. Its animation loops forever.

## Risks / Trade-offs

- [The party room's middle is soft and streaky up close] → accepted for now; retraining at full resolution would sharpen it at about four times the training time.
- [The living room's own couch is faint, so the people stand where Edison chose rather than on a visible seat] → `COUCH` in `people.ts` holds the spot and heading for a nudge.
- [The model is lit by two plain lights, not the room's light] → accepted; the clip reads clearly.

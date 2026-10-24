# Design

## Context

The upstairs scan was built from several walkthroughs stitched into one coordinate frame and trained once ([pipeline README](../../../experiments/room-scan/pipeline/README.md)). The new floor comes from three phone videos: `IMG_1258.MOV` (from the upstairs hall down the stairs), `IMG_1254.MOV` (the hallway to the left) and `IMG_1253.MOV` (the lobby to the right). All three film the same mirror corner at the foot of the stairs.

## Goals / Non-Goals

**Goals:** both floors in one walkable scan, upstairs unchanged, people removed.

**Non-Goals:** sharpening the new floor or swapping rooms for earlier scans; those follow in their own change.

## Decisions

- **Pieces, then stitching.** Pi3X runs on four pieces of under 110 frames each: the stair top mixed with 16 frames the upstairs scan already has, the stairs, the hallway and the lobby. Each fits to its parent through shared frames (about 4–9 cm apart). One run over all frames would smear, as it did upstairs.
- **The mirror corner is the join.** The hallway and lobby pieces each include the stairs video's mirror frames (98.5–103.5 s), so both fit to the stairs piece directly instead of through each other.
- **Train the new floor alone, then join.** Retraining everything risks the upstairs. A separate fit in the same coordinates keeps its splats unchanged; the join decides who owns each place: above the upstairs floor plane the old scan, below it the new one, and only the new one inside a circle at the top of the stairs.
- **People masked before training.** Mask R-CNN masks are dilated and trained as transparent pixels. Splats that the training views mostly see inside a mask are deleted after training, which catches a person who sat still.

## Risks / Trade-offs

- [The new floor is softer than upstairs: held-out PSNR 19.6 dB against about 21.5 dB] → a follow-up change re-trains the stairs and splices the best scan of each room.
- [From the upstairs hall, the stair opening shows rough patches where the old scan showed a false wall] → accepted: the opening is real; the follow-up improves it.
- [The floors are tilted about 3° in the scan's frame, as upstairs already was] → none needed for walking; the free camera has no floor collision.

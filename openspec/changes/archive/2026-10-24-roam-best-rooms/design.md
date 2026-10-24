# Design

## Context

See the [proposal](proposal.md). Every upstairs version shares one coordinate frame, so any of them can be scored at the same frames and joined to the downstairs.

## Goals / Non-Goals

**Goals:** the best splats for each room by measured score; sharper stairs; no room worse than live.

**Non-Goals:** sharpening the downstairs hallway and lobby, which need more footage.

## Decisions

- **Score on held-out frames.** Each model renders at frames its training left out (every eighth), masked where people were, and is compared with the real frame. Visual judgement had picked the original bedroom scan; scores showed it 4 dB worse even in the bedroom.
- **Fine-tune instead of deleting.** The trainer starts from the joined splats, not from points, and runs 5,000 steps on both floors' training frames with a low position rate. The frames held out for scoring stay out of it.
- **More stairs frames, same stitching.** Three Pi3X pieces at 0.3 s spacing each share about 15 frames with the first stairs piece, so they fit to it the same way the other pieces fit.

## Risks / Trade-offs

- [PSNR rewards matching the frames, not looking sharp from new angles] → each choice was also checked by eye in the local viewer.
- [Downstairs hall and lobby have no common held-out frames] → each is compared on its own held-out frames, and called unchanged.

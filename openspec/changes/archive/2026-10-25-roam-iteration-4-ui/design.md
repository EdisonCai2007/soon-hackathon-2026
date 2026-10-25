# Design

## Context

ROAM's screens were built from the workspace's shared parts inside `Layout`'s framed page: `Scan` stacked the bar, counts, camera picker, position line, viewer and people card top to bottom. See proposal.md for why it changes.

## Goals / Non-Goals

**Goals:** the board's look on every ROAM screen, built on the existing parts, and the placing tools kept whole for Edison.

**Non-Goals:** no change to `Layout` or the other mini apps; no new behavior in the viewer, room or sound.

## Decisions

- **ROAM covers the window itself.** `Screen` is a fixed full-window layer above the workspace bar, instead of an edit to `Layout`: the bar stays for the other pages, and ROAM owns its own surface.
- **One pill recipe.** `pill-look.ts` holds the pill and bubble classes; `Pill` wraps the shared `Button` with them, and `Joined` draws the board's pinched neck between pills as SVG. Chips use the same recipe without hover or the pointer, since they are read, not pressed.
- **Screentone as a field, not shapes.** `halftone.ts` gives each dot on a fixed 9 px grid one of three sizes from a slowly folding sum of bent sine waves, so clouds reshape as they drift. `Halftone` draws it on a canvas each frame, once under reduced motion, and resizes the canvas only when its box changes. A canvas over CSS dots because the dot sizes change every frame.
- **Tools by address.** `toolsOn()` in `invite.ts` reads `?tools` from the page's own address, beside the other address readers; it does not use the router, because `Room` renders outside one. `Tools.tsx` holds the counts, the camera choice and the position line; `Scan` shows them, and asks the viewer for its position, only when tools are on.

## Risks / Trade-offs

- [The screentone redraws tens of thousands of dots a frame] → it shows only on screens with no room behind them; reduced motion draws it once.
- [A visitor with `?tools` sees Edison's tools] → accepted: they change nothing for anyone else in the room.
- [The views and *who's in* share one row on a phone] → the row moves below the wordmark at phone width; check it on the preview.

## UX

### Use-case brief
A visitor, often on a laptop at the demo, opens ROAM to walk the scanned house and, with a room's link, to meet the others in it. Done is standing in the room, seeing who is there. Common: walking and switching views. Edge: no WebGL, a failed load, a full room. Edison, rarely and on a laptop, places filmed people with the `?tools` address. Mirrors the iteration 4 board, not an existing workspace screen.

### Flow
Open the link → join with a name → the room loads over the screentone → walk; *who's in* opens the list when wanted.

### Hierarchy
Room screen: walking the room is the primary act, so the viewer fills the window and every control floats at its edges; *start a room* is the one loud pill. Join screen: *go live*. Placing tools are hidden by default.

### Review
[review.html](review.html): What Changes #1 sketches the room screen before and after, and #4 the join screen.

### Components
Existing: `Button`, `Input`, `Label`, `NativeSelect`, `CopyText`, `Loading`. New, ROAM-only: `Pill`, `Joined`, `IconPill`, `Chip` (the board's pills), `Screen`, `Centered`, `Halftone` (the full-window surface and its screentone), `Wordmark`.

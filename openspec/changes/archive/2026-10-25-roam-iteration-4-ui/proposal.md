# Restyle ROAM to the iteration 4 board

**Status:** ready-to-ship
**Branch:** roam-iteration-4-ui
**Open questions:** none

## Why

ROAM still looked like the workspace's plain pages: the room sat in a frame under the workspace bar, with every tool Edison uses for placing people stacked around it. The iteration 4 board gives ROAM its own look, and a visitor should see the room and only the controls they need to walk it.

## What Changes

- **The room fills the whole window, with its controls floating over it.** The workspace bar is gone on ROAM pages. The red ROAM wordmark sits top left; the three views and a *who's in* pill sit together top centre; the sound-off icon and full screen sit top right; the directions sit bottom left in plain white text, and *start a room* bottom right.
  ```screen
  <div class="row gap">
    <div class="card col gap">
      <span class="muted">Before</span>
      <div class="row gap"><h3>ROAM</h3><span class="tag">1199 views · splats</span><span class="grow"/><button class="btn-ghost">Room view</button><button class="btn-ghost">Overview</button><button class="btn-ghost">Top view</button></div>
      <button class="btn-primary">Start a room</button>
      <div class="row gap"><span class="tag-outline">Camera ▾</span><span class="muted">You are at x y z</span><button class="btn-ghost">Copy</button></div>
      <div class="skeleton"></div>
      <div class="card col gap"><h3>Who's in</h3><div class="bar"></div></div>
    </div>
    <div class="card col gap">
      <span class="muted">After</span>
      <div class="row gap"><h3>ROAM</h3><span class="grow"/><button class="btn-ghost">room view</button><button class="btn-ghost">overview</button><button class="btn-ghost">top view</button><button class="btn-ghost">who's in · 3 ▾</button><span class="grow"/><span class="tag-outline">🔇</span><span class="tag-outline">⤢</span></div>
      <div class="skeleton"></div>
      <div class="row gap"><span class="muted">W/A/S/D to move · drag to look</span><span class="grow"/><button class="btn-primary">start a room</button></div>
    </div>
  </div>
  ```
- **Buttons are the board's pills.** Cream pills with red edges and red lowercase labels; filled blue pills for the main action. Under the pointer a pill fills blue with white text, and the views and *who's in* fill red. Buttons show the usual pointing hand.
- **Who's in folds into a dropdown.** The list of people, with the host's *remove* buttons and the room's link, opens under the *who's in* pill and closes again from it.
- **The join, loading and phone screens use the board's cards.** A red-edged cream card with a big red lowercase title, over yellow screentone clouds that slowly swell, merge and drift. The name field keeps a blue edge; the loading bar is blue. With reduced motion asked for, the clouds hold still.
  ```screen
  <div class="card col gap phone">
    <h3>ROAM</h3>
    <h3>join the room</h3>
    <span class="muted">your name</span>
    <input placeholder="What the others see">
    <span class="muted">Your camera and voice go straight to the others in the room. Nothing is recorded.</span>
    <div class="row gap"><button class="btn-primary">go live</button><button class="btn-ghost">i'm in the room itself</button></div>
  </div>
  ```
- **The placing tools move out of everyone's way.** The splat and view counts, the choice of filmed camera, and the *you are at* position with Copy now show only when the address ends in `?tools`. Edison keeps every tool; nobody else sees them. The counts now link to the scan's files.

Non-goals: the room, its people and its sound behave as before; the workspace's other pages keep their bar and look.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-scene`: the splat and view counts, the source-camera choice and the camera's position show only with the placing tools, which the address turns on.

## Impact

- `app/src/apps/roam/`: new `Pill.tsx`, `pill-look.ts`, `Screen.tsx`, `Wordmark.tsx`, `halftone.ts`, `Tools.tsx`; `Scan.tsx`, `Host.tsx`, `Join.tsx`, `Phone.tsx`, `Room.tsx`, `Watch.tsx`, `App.tsx` restyled; `invite.ts` reads `?tools`.
- `app/src/index.css` adds ROAM-only colours and fonts; `app/package.json` adds `@fontsource/archivo` and `@fontsource/arimo`.
- Tests: `App.test.tsx`, `Room.test.tsx`, new `halftone.test.ts` and `Screen.test.tsx`.

## Decision log

- **2026-10-25** — Assumed: build on the restyle a cloud session made against an older `main`, because it applied unchanged to the current one: the fireplace and desk change (#16) touched none of its files.
- **2026-10-25** — Asked whether to remove the workspace bar everywhere or only on ROAM → chose ROAM only, since the bar's theme switch and sign out still serve the other pages.
- **2026-10-25** — Asked what the splat and view counts should link to → chose their source files: `scene.json` for the views and `room.spz` for the splats.
- **2026-10-25** — Assumed: a loud pill keeps its blue edge rather than a red one, because a red ring around a blue fill reads as a second shape.
- **2026-10-25** — Assumed: the screentone moves by changing each fixed dot's size from a slowly folding field, because the board asked for clouds that flow, not stamped shapes that slide.
- **2026-10-25** — Asked whether to delete the placing tools for good, keep them behind `?tools`, or hold the ship for Edison → chose `?tools`: everything removed from the regular view was for tooling only.
- **2026-10-25** — Asked whether to review before going live → chose to ship through `/ship`, with CI as the gate.
- **2026-10-25** — Assumed: archived for shipping with the placing tools behind `?tools`, after bringing in `main`'s bedroom, haze and faces work, because `main`'s new scan changes the splat count the tools test reads.
- **2026-10-25** — Assumed: `main`'s new hand reading, body walking and phone walk screens take the board's look too, the hands and *walk it* as pills top right beside sound and full screen, because a visitor meets them on the same screens.
- **2026-10-25** — Assumed: the *who's in* list opens centred under the middle of the bar and is measured against the room, not the screen, because the frame rule keeps every page inside its frame.

# The home remembers

**Status:** planned
**Branch:** roam-notes
**Open questions:** none

## Why

The scanned home is a place you can walk, but nothing in it can be touched and nothing stays there, so showing it still feels like a video call with better scenery. What a video call cannot do is hold something in place: a note by the boiler, a photo where the leak was, a voice by the fusebox. This change makes the home keep what people leave in it, so someone can open one link weeks later, walk in, and be shown round by people who are not there.

## What Changes

- **Standing in the real home, you leave a note where you stand.** Open the home's link on an Android phone, line up on a marked spot, then walk. At the thing you want to talk about, press *Leave a note here* and write a line, say a few words, or take a photo. It lands in the scan at the spot you were standing, on the floor you are on.
  ```screen
  <div class="card col gap phone">
    <div class="row gap"><h3>Leave a note</h3><span class="tag">3 left</span></div>
    <div class="bar">you're lined up — walk to the thing, then leave a note</div>
    <div class="row gap"><button class="btn-primary">Leave a note here</button></div>
    <div class="row gap"><button class="btn-ghost">Line up again</button></div>
  </div>
  ```

- **Write it, say it, or photograph it.** Three kinds, one at a time, each saved where you stood.
  ```screen
  <div class="card col gap phone">
    <h3>A note here</h3>
    <div class="row gap"><button class="btn-primary">Write</button><button class="btn-ghost">Record</button><button class="btn-ghost">Photo</button></div>
    <input placeholder="The boiler's reset is behind this panel">
    <div class="row gap"><span class="grow"></span><button class="btn-ghost">Cancel</button><button class="btn-primary">Leave it</button></div>
  </div>
  ```

- **Anyone who opens the home's link finds them in place.** Walking the scan you see a marker at each note. Press one and it opens: the words, the photo, or a voice you hear from the spot it was left — louder as you walk up to it, fading as you walk away. Nobody has to be online, and nothing expires.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">9 notes left here</span><span class="grow"></span><button class="btn-ghost">Full screen</button></div>
    <div class="bar">the scanned home — a marker by the boiler, one at the fusebox</div>
    <div class="card col gap">
      <div class="row gap"><span class="tag-outline">voice</span><span class="muted">Sam · yesterday</span><span class="grow"></span><button class="btn-ghost">Close</button></div>
      <div class="row gap"><button class="btn-primary">Play from here</button><button class="btn-ghost">Remove</button></div>
    </div>
  </div>
  ```

- **A few marked spots keep the phone honest across both floors.** A phone's tracking drifts the further you walk and knows nothing about which floor it climbed to, so the home has a handful of taped spots taken from the scan's own camera positions. Press *Line up again*, pick the one you are standing on, and the drift is gone.
  ```svg
  <svg viewBox="0 0 220 96">
    <rect x="8" y="8" width="204" height="36" fill="none" stroke="subtle"/>
    <rect x="8" y="52" width="204" height="36" fill="none" stroke="subtle"/>
    <text x="14" y="24" fill="muted">upstairs</text>
    <text x="14" y="68" fill="muted">downstairs</text>
    <circle cx="150" cy="26" r="4" fill="fg"/>
    <text x="160" y="30" fill="fg">stairs top</text>
    <circle cx="60" cy="70" r="4" fill="fg"/>
    <text x="70" y="74" fill="fg">front door</text>
    <circle cx="170" cy="70" r="4" fill="fg"/>
    <text x="110" y="90" fill="muted">each spot is a place the scan already knows</text>
  </svg>
  ```

- **Whoever left a note can take it back, and whoever keeps the home can remove any of them.** The home has one keeper, claimed once from their own browser. Removing a note cannot be undone.

Non-goals: leaving a note from inside the scan on a laptop, an iPhone leaving notes at all (its browser has no movement tracking), pinning a note onto the exact surface of an object rather than the spot you stood, hiding a marker behind a wall, scanning the home again to show what changed, and any sign-in or moderation beyond the keeper's removal.

## Capabilities

### New Capabilities

- `roam-notes`: a lasting place whose notes — written, spoken, photographed — are kept at a position in the scan, found by anyone who opens its address, heard from where they were left, and removed by their author or the place's keeper.

### Modified Capabilities

- `roam-capture`: the phone also lines up again, mid-walk, at any of several marked spots, and can line up and leave notes with no live room running.

## Impact

- The ROAM mini app gains the phone's note-leaving screen and the note panel beside the scan, plus plain modules for the notes' rules, the kept author secrets, the marked spots, and a clip played through a panner. `stage.ts` grows a marker group and its pick returns what kind of thing was hit; `Scan.tsx`, `RoomViewer.tsx`, `invite.ts` and `App.tsx` change; `placement.ts` gains a note's pose.
- A server side appears beside the room's: five bare handlers in `app/worker/apps/roam/` over the shared `DB` binding, with the notes' rules in their own file, and `ids.ts` gains a note id and a keeper key.
- One additive migration in `schema/migrations/` adds the notes table and the places table; `schema/seed.sql` gains sample notes so a preview and a check start from real rows.
- Media is kept in D1 beside the row, capped well under its per-value limit, because R2 needs a payment method this account has not set.
- **No new packages.** The browser's AR session, `getUserMedia`, a canvas and Web Audio cover recording, photographing and playing; Three.js draws the markers.
- Nothing is removed. The live room, the figures, the voices and walking the scan alone all behave exactly as they do now; a home with no notes looks like today's page.

## Decision log

- **2026-10-24** — Asked what to build next, given the app feels like a glorified video call → chose the lasting notes first and scanning the home again to show what changed second.
- **2026-10-24** — Asked what someone can leave behind → chose all three: written, spoken, photographed.
- **2026-10-24** — Asked who finds the notes and whether they last → chose a lasting place anyone with the address can open, kept for good.
- **2026-10-24** — Asked where a note is left from → chose standing in the real home on the phone, not from the scan on a laptop.
- **2026-10-24** — Asked what the place is, for the demo → chose a home being handed over: where things are and how they work.
- **2026-10-24** — Asked how the phone stays lined up now the scan covers two floors → chose a handful of marked spots to pick from, each taken from the scan's own cameras, so drift resets and the floor is settled.
- **2026-10-24** — Asked how to treat the relay work waiting in this workspace → chose to commit it on its own branch and start this change from the default branch.
- **2026-10-24** — Assumed: a voice note plays when its marker is pressed rather than on its own as you walk past, because an open place where anyone can leave a clip would otherwise all play at once; it stays placed in space once playing, which is the part that matters.
- **2026-10-24** — Assumed: a note sits where the person stood, at the height the phone was held, rather than on the surface of the thing they faced, because finding a surface in a cloud of splats is its own piece of work and standing beside something reads as pointing at it.
- **2026-10-24** — Assumed: the author's one-time secret is kept in their own browser and the place's keeper key is claimed once, mirroring the room's host key, because a place with no sign-in has no other way to tell people apart.
- **2026-10-24** — Assumed: media is kept in the app's own database rather than object storage, because R2 needs a payment method this account has not set and a short clip or a shrunken photo sits far below what a database value holds.
- **2026-10-24** — Assumed: caps on what anyone may leave — a short line of text, a few seconds of voice, a shrunken photo, and a limit per place — because the address is open to anyone who has it.
- **2026-10-24** — Found while planning: the default branch now carries a two-floor scan and a reconstruction pipeline that already aligns a fresh scan onto the existing one, so the later change that shows what changed is cheaper than it looked, and this change plans against the bigger home.

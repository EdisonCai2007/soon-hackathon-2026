# Take notes out of ROAM

**Status:** shipped — archived.
**Branch:** remove-notes
**Open questions:** none

## Why

ROAM no longer leaves notes in the scanned home. Leaving them, showing them and removing them is a whole feature to keep working and explain, and it is not what the home is for now. The phone's walk through the scan grew up inside the note screen, so it has to keep working after the notes go.

## What Changes

- **The phone stops leaving notes, and keeps the walk.** The same link still opens a phone screen. You pick the taped spot you stand on, line up, and walk; the scan drawn over the real room lands on this screen when that work is built. The name field, *Leave a note here*, the three kinds and the count all go.
  ```screen
  <div class="row gap">
    <div class="card col gap phone">
      <div class="row gap"><h3>Leave a note</h3><span class="tag">3 left</span></div>
      <div class="bar">Lined up at the hall. Walk to the thing you want to talk about.</div>
      <button class="btn-primary">Leave a note here</button>
      <button class="btn-ghost">Line up again</button>
      <button class="btn-ghost">Stop</button>
    </div>
    <div class="card col gap phone">
      <div class="row gap"><h3>Walk the home</h3></div>
      <div class="bar">Lined up at the hall. Walk around.</div>
      <button class="btn-primary">Line up again</button>
      <button class="btn-ghost">Stop</button>
    </div>
  </div>
  ```

- **Picking a spot asks for no name.** Nothing is left behind, so nobody has to say who they are.
  ```screen
  <div class="card col gap phone">
    <h3>Walk the home</h3>
    <div class="muted">Stand on one of the taped spots, facing its arrow, and press it.</div>
    <button class="btn-ghost">Hall · floor 1</button>
    <button class="btn-ghost">Kitchen · floor 1</button>
    <button class="btn-ghost">Top of the stairs · floor 2</button>
  </div>
  ```

- **The scan shows no markers and no note count.** Walking the home on a laptop or phone looks as it did before notes: the room, the people in it, and the bar without *9 notes left here*.
  ```screen
  <div class="row gap">
    <div class="card col gap">
      <div class="row gap"><h3>ROAM</h3><span class="tag">9 notes left here</span><span class="grow"></span><button class="btn-ghost">Full screen</button></div>
      <div class="bar">the scanned home, with a marker by the boiler</div>
    </div>
    <div class="card col gap">
      <div class="row gap"><h3>ROAM</h3><span class="grow"></span><button class="btn-ghost">Full screen</button></div>
      <div class="bar">the scanned home</div>
    </div>
  </div>
  ```

- **Every note already left is deleted.** The notes, their photos and voice clips, and the keeper's claim on the place go from the database. This can't be undone.
  ```mermaid
  flowchart LR
    notes["notes, photos, clips"] --> gone["deleted"]
    claim["keeper claim"] --> gone
  ```

- **The note pages go from the wiki.** The page on lasting places and notes is removed and unlinked. What the phone check found about AR stays, because it holds for any AR work.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `roam-notes`: retired; every requirement removed.
- `roam-ar-view`: the scan over the real room no longer mentions notes; it is drawn on the walk screen, and a phone that cannot carry it keeps lining up and walking.
- `roam-gestures`: a technique's "changes nothing" list no longer names notes.
- `roam-scene`: a press that starts on the movement control lands on no person, with no marker left to name.

## Impact

- Browser: `Leave.tsx` becomes the walk screen; `NotePanel.tsx`, `notes.ts`, `note-sound.ts`, `capture.ts` and their tests are deleted; `stage.ts`, `RoomViewer.tsx`, `Scan.tsx`, `invite.ts` and `App.tsx` lose their note paths. `spots.ts`, `PhoneStart.tsx`, `placement.ts`, `ar-session.ts` and its render-layer and overlay fixes stay.
- Worker: `note-routes.ts` and `notes.ts` are deleted; the five note routes leave `api.ts`; `ids.ts` and `wire.ts` keep only what the room uses.
- Data: a new migration drops `roam_notes` and `roam_places`; `schema/seed.sql` loses its sample notes.
- Plans: the in-progress `roam-notes` change is removed; `roam-ar-view` tasks that build on the note screen are reworded for the walk screen.
- Wiki: `wiki/stack/places-and-notes.md` is deleted and unlinked from `wiki/stack/README.md` and `wiki/stack/live-rooms.md`.
- Overlap: the main checkout's `roam-ar-view` branch sits on top of the notes work and will need this change merged in.

## Decision log

- **2026-10-25** — Asked what "remove notes" should do → chose taking the feature out entirely, over hiding it, dropping only the sample notes, or adding a clear-all button.
- **2026-10-25** — Asked where the phone's walk through the scan should live once the note screen goes → chose its own phone screen on the same link, over merging it into the live-room camera screen or removing it too, because it is the least rework and the walk keeps working.
- **2026-10-25** — Assumed: a new migration drops both tables with `IF EXISTS`, and the migration that made them stays, because the test site has likely already applied it and a migration history is only ever added to. This works whether or not it was applied.
- **2026-10-25** — Assumed: the `/leave` address stays, because the walk screen keeps the same link and nothing printed points elsewhere. Renaming it is cheap later.
- **2026-10-25** — Assumed: the `roam-notes` plan folder is deleted rather than archived, because archiving would record it as shipped, and it never reached the live site. Its spec is retired through this change instead, so the record of removal stays.
- **2026-10-25** — Assumed: the AR fixes found while building notes stay — the render layer that makes a pose arrive, the overlay that makes buttons reachable, and `pick` updating matrices before it hits anything — because the camera screen and the walk need them.
- **2026-10-25** — Evidence gap: the test site's database could not be read from here, so whether the note tables exist there is unknown. The drop migration covers both cases.
- **2026-10-25** — Saved the plan alone on `remove-notes`, with nothing built. The deltas are not reconciled into `openspec/specs/` yet, because the code still has notes and the main specs say what the code does; the save after the build reconciles them (task 5.2).
- **2026-10-25** — Found while building: `roam-scene`'s movement-control scenario still named a note marker, so a `roam-scene` delta now drops it. Nothing it describes changes.
- **2026-10-25** — Built and checked locally: the ROAM tests at full coverage, types, lint, knip, jscpd and the key and action checks pass. The 30 other failures in `npm test` are outside ROAM (Windows path separators, CRLF and slow-machine timeouts in `access`, `inbox`, `style` and two Worker source scans), and the wiki check fails across untouched pages on this machine; CI is the gate. The deltas are reconciled into `openspec/specs/` and `roam-notes` is retired there by hand, so the archive skips specs.
- **2026-10-25** — Asked whether to publish this branch, which also carries the unfinished `roam-ar-view` and `roam-gestures` work → chose shipping all of it on purpose.
- **2026-10-25** — Checked on staging: `GET /apps/roam/api/notes` answers 404 and `/apps/roam/leave` loads. The Android walk needs the owner in the home, and `roam-ar-view` task 13.4 already walks this screen from the phone, so it is left to that task rather than held here.
- **2026-10-25** — Archived on `remove-notes` to publish, carrying the unfinished `roam-ar-view` and `roam-gestures` work with it on purpose.

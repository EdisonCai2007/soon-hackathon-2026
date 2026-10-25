## Context

`roam-notes` added a lasting place to ROAM: a phone in the real home lines up on a taped spot and leaves a written, spoken or photographed note at its own pose; the scan shows a marker per note with a panel to read, play or remove it; the Worker keeps notes in D1 (`roam_notes`, `roam_places`) behind five routes. It is on this branch and its pushed descendants (`roam-gestures`, `roam-ar-view`, `roam-body`, `roam-techniques`), not on `main`. Its spec was already reconciled into `openspec/specs/roam-notes/`.

Building it also fixed things that were never about notes: `ar-session.ts` now attaches a render layer (without it no pose arrives) and takes a DOM overlay (without it the camera screen's Stop is unreachable), and `stage.ts`'s `pick` updates candidate matrices before raycasting. `roam-ar-view` plans to draw the scan over the real room on the note screen (its section 7) and already shares `spots.ts`, `placement.ts` and `PhoneStart.tsx`.

## Goals / Non-Goals

**Goals:**
- No way to leave, see, play or remove a note, in the browser or the Worker.
- The phone screen at `/leave` keeps picking a spot, lining up, walking, *Line up again* and *Stop*, as the home for `roam-ar-view`'s drawing.
- Existing note data is dropped from every database the migration reaches.
- Nothing left only notes used: knip, jscpd and 100% coverage over both roam folders still pass.

**Non-Goals:**
- Building `roam-ar-view`'s drawing on the walk screen; that change still owns it.
- Renaming the `/leave` address or the `Leave` component file.
- Touching the live-room camera screen (`Phone.tsx`) beyond what its shared helpers need.

## Decisions

- **Reshape `Leave.tsx` in place, rather than a new `Walk.tsx`.** `roam-ar-view` tasks 6 and 7 name `Leave.tsx`; keeping the file keeps those tasks pointing at something real and the diff small. The component's exported name and title change to say what it does (*Walk the home*); the file name is cheap to change later.
- **Drop the tables with a new migration, `schema/migrations/20261027120000_drop_roam_notes.sql`, `DROP TABLE IF EXISTS` for both.** Deleting `20261026120000_roam_notes.sql` instead would leave the tables behind wherever it already ran, and D1 tracks migrations by name, so history stays append-only. Alternative rejected: editing the old migration, which an applied database never re-runs.
- **Retire `roam-notes` through this change's delta** (`retire_capabilities: true`, every requirement REMOVED), and delete `openspec/changes/roam-notes/`. Archiving that change would claim it shipped.
- **`roam-ar-view` delta:** "The scan is drawn over the real room" loses its note scenario, so it is REMOVED and ADDED back under a new name, as [the CLI contract](../../../.agents/skills/plan/references/openspec-cli.md#validate-and-archive) requires for a dropped scenario. The two requirements that say "leaving notes" or "taking notes" are MODIFIED to say lining up and walking. The spec's Purpose paragraph is not part of a delta, so `/save` rewrites it by hand when it reconciles.
- **`stage.ts` keeps `pick`, returning a peer id.** With markers gone the `Picked` kind has one value; collapsing it to the id removes a branch callers would otherwise carry untested.
- **Worker helpers.** `noteId`, `noteSecret`, `keeperKey`, `isNoteId` and `hashed` leave `ids.ts`; `readPose` stops being exported from `wire.ts` if only `notes.ts` imported it. knip is the check; each removal is whatever it then reports unused.

## Risks / Trade-offs

- [Descendant branches conflict] `roam-ar-view` and others are stacked on these files → this change lands on this branch first and they merge it in; the proposal's Impact names the overlap.
- [The walk screen does little until the drawing lands] Lining up and walking with no scan drawn shows only a status line → accepted, because the user chose to keep it as the drawing's home; `roam-ar-view` section 7 fills it.
- [Data loss] Any real note on the test site is deleted → accepted and said in the proposal; the feature never reached the live site.

## Migration Plan

Deploy runs `cf-build.sh --migrate`, which applies the drop to whichever database it targets. Rollback is reverting the commit and adding a migration that recreates the tables empty; dropped rows do not come back.

## UX

### Use-case brief

**Who, and the job.** Someone standing in the real home with an Android phone, lining up so the scan can be laid over the room. **Done** is: lined up on a spot, walking, with the scan (once `roam-ar-view` lands it) sitting on the real walls. **Context:** on a phone, standing, one-handed, inside an AR session; phone layout only. **Common case:** pick one spot, walk. **Edge cases:** no AR (the existing *Walk the home instead* fallback), tracking lost (the existing *no tracking* tag). It mirrors today's note screen minus its note controls. **Frequency:** a few times, while setting up or showing the home.

### Flow

Open `/leave` → pick a taped spot → walk. *Line up again* returns to the spots; *Stop* ends the session. No AR → the existing fallback page.

### Hierarchy

Spot list: each spot is the action, no other input. Walking: *Line up again* becomes the primary button, since it is the one thing to do when the scan drifts; *Stop* stays ghost.

### Review

[review.html](review.html); the first two What Changes items sketch the phone screen, the third the scan's bar.

### Components

Existing only: `Card`, `Button`, `Badge`, `CannotFollow` and `Checking` from `PhoneStart.tsx`. Nothing new.

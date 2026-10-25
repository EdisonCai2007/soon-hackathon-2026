# Tasks

## 1. The phone's walk screen

- [x] 1.1 `app/src/apps/roam/Leave.tsx`: remove the name field, `Compose`, the recording and photo paths, the count and the refused-cap messages; keep `checking`/`unsupported`/`spots`/`walking`, `lineUp`, *Line up again* (now primary) and *Stop*. Title it *Walk the home*, rename the component `Walk` and its no-AR advice to say the phone can't follow you, not that it can't leave a note. `Phone.tsx` and the AR fixes in `ar-session.ts` stay untouched.
- [x] 1.2 `Leave.test.tsx`: drop every note case; cover picking a spot, lining up, tracking lost, *Line up again*, *Stop*, the session ending on its own, and no AR.
- [x] 1.3 Delete `capture.ts` and `capture.test.ts`. Update the `leave` comments in `invite.ts` and `App.tsx` to say the phone walks the home; `leaveLink` and the `/leave` address stay.

## 2. The scan without notes

- [x] 2.1 Delete `NotePanel.tsx`, `notes.ts`, `notes.test.ts`, `note-sound.ts` and `note-sound.test.ts`.
- [x] 2.2 `stage.ts`: remove the marker group, `show` and the marker colours; `pick` returns a peer id or nothing, keeping its matrix update. Update `stage.test.ts`.
- [x] 2.3 `RoomViewer.tsx`: remove the `notes` and `voice` props and their effects; a press on a figure still watches it. Update `RoomViewer.test.tsx`.
- [x] 2.4 `Scan.tsx`: remove `NoteCount`, `useNoteVoice`, the notes fetch, the opened note, the panel and the remove path. Update `Scan.test.tsx` and `App.test.tsx` so no note request or screen is expected.

## 3. The server and the data

- [x] 3.1 Delete `app/worker/apps/roam/note-routes.ts`, `note-routes.test.ts`, `notes.ts` and `notes.test.ts`; remove the five note routes and the import from `api.ts`.
- [x] 3.2 `ids.ts`: remove `noteId`, `noteSecret`, `keeperKey`, `isNoteId` and `hashed`, and their tests in `ids.test.ts`; keep `sameKey`. `wire.ts`: stop exporting `readPose` if nothing else imports it.
- [x] 3.3 Add `schema/migrations/20261027120000_drop_roam_notes.sql`: a header comment saying it takes out ROAM's notes, then `DROP TABLE IF EXISTS roam_notes;` and `DROP TABLE IF EXISTS roam_places;`. Keep `20261026120000_roam_notes.sql`.
- [x] 3.4 Remove the `roam_notes` and `roam_places` inserts from `schema/seed.sql`.

## 4. Plans and wiki

- [x] 4.1 Delete `openspec/changes/roam-notes/`.
- [x] 4.2 `openspec/changes/roam-ar-view/`: reword the proposal, design, tasks (6.1–6.2, 7.1, 7.4, 13.4) and its spec delta where they build on the note screen or say a note lands, so they name the walk screen and lining up instead. Change nothing it plans to build.
- [x] 4.3 Delete `wiki/stack/places-and-notes.md`; remove its line from `wiki/stack/README.md` and its link from `wiki/stack/live-rooms.md`. Run `memory.mjs areas wiki/stack/places-and-notes.md` and fix every link it lists.
- [x] 4.4 `grep -rni "note" app/src/apps/roam app/worker/apps/roam` and read each hit: none may be about leaving notes.

## 5. Verification

- [x] 5.1 From `app/`, run `npm test`: lint, types, 100% coverage over both roam folders, the runtime tests, knip, jscpd, and the key and action checks. Report any failure already there on a clean tree.
- [x] 5.2 `openspec validate roam-drop-notes --strict --no-interactive`, then `/save`, which reconciles the deltas, retires `openspec/specs/roam-notes/` and rewrites the `roam-ar-view` Purpose to name the walk screen.
- [x] 5.3 On the staging Worker after `/save`: `GET /apps/roam/api/notes` answers 404 and `/apps/roam/leave` loads. The Android walk from a taped spot moved to `roam-ar-view` task 13.4, which already walks this screen on staging from the phone.

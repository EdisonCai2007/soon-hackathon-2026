# A lasting place in a mini app

A page where what people leave behind outlives every session — notes kept at a position in a 3D scan, found later by anyone with the address — runs on rows in the app's own database, not on the [Durable Object a live room uses](live-rooms.md). The ROAM app at `app/worker/apps/roam/` is the worked example: `note-routes.ts` holds the statements and `notes.ts` the rules.

## A place is not a room

They look alike and belong in different stores, so start by telling them apart:

| | A live room | A lasting place |
|---|---|---|
| Lives in | one Durable Object per link | rows in the shared `DB` binding |
| Named by | a long random id nobody guesses | a short name in a fixed list |
| Lasts | while somebody is in it | for good |
| Reached by | whoever holds the link | anyone who holds the app's own address |

A place belongs in [D1](d1-pipeline.md) because its data has to reach the things a Durable Object cannot: an additive migration, `schema/seed.sql`, and a staging reset. Sample rows are what make a place demonstrable on a preview at all — an empty place looks identical to a broken one.

Keep the place's name a **column from the first migration**, even while one place exists. A second scan then adds a name to a list, not a schema change.

## Without object storage, bytes live beside the row

R2 needs a payment method, which an account may not have ([without R2](../development/memory.md#without-r2)). A short clip and a shrunken photo fit in D1 instead: it holds a single value up to about 2 MB, so caps in the low hundreds of kilobytes sit far below the limit.

- **Serve bytes from their own route**, never inlined in the list, so walking a place downloads only what somebody opens. Its answer is cached for good (`immutable`): the id is random and the bytes behind it never change.
- **D1 hands a `BLOB` back as an array of byte values**, not as an `ArrayBuffer`. `new Response(row.media)` on that array answers 200, with the right content type, and nothing in it. Convert before answering, and test both shapes: a local SQLite stand-in returns the bytes themselves, so only a deployed check catches this.
- **Take the upload's own word for nothing.** Refuse on `Content-Length` before reading, then on the bytes actually read.

## An open address needs caps, not trust

Where the address is the only way in and anybody may write, every limit is the defence: the words' length, a file's size, the file types each kind may carry, and how many rows one place holds. Refuse past a cap with a named reason rather than storing it, and keep the caps in the rules file beside the checks, so a route cannot quietly disagree with a screen.

## Telling people apart with no sign-in

A place with no login still has to know who may remove what. Two secrets, mirroring [the room's host key](live-rooms.md#the-shape):

- **The author's own secret**, minted when a note is left, returned once, and kept in that browser's `localStorage` — the browser that left a note is the one that can take it back.
- **The place's keeper key**, minted by the first claim and refused to every later one, which removes anything.

Keep only the **SHA-256 of each**, compared in constant time, so a leaked row removes nobody's note. A browser with no storage still leaves notes; it just forgets how to take them back, which is better than refusing to write at all.

## Reading a place inside the scan

The viewer already draws people and picks them; notes join the same two places:

- **One marker per note**, at the note's own height rather than on the floor, turned to face the viewer like a figure. A press returns *what kind of thing it hit* — somebody in the room, or something left here — so one handler serves both.
- **A raycast reads the world matrix the last frame left behind.** A press can land between frames, so bring the candidates' matrices up to date inside the pick; without it a marker is judged to sit wherever its object last rendered, which on a fresh page is the middle of the room.
- **A spoken note plays through its own panner** at the note's position, reusing the room's distance curve, so walking while it plays changes what reaches the ears. The press that starts it is also the gesture browsers demand before any sound.

Part of [the Cloudflare stack](README.md). For the people in the place at the same time, see [live rooms](live-rooms.md); for the phone that leaves a note while standing in the real room, see [AR in the browser](../development/ar-in-the-browser.md).

# Tasks

## 1. Measure the cost before building on it

- [ ] 1.1 Add `@mediapipe/tasks-vision@1.1.1` to `app/package.json` and a script that copies its `wasm/` files and `hand_landmarker.task` into `app/public/apps/roam/`, run from the build. Pin the version; take the stable release, not a candidate.
- [ ] 1.2 In a throwaway page in the running app, start a `HandLandmarker` over a webcam stream while the scan renders, and record the frame rate with it off and on, plus how long the model takes to load from the app's own origin. Set the reading rate in [the design](design.md#the-pieces) from what is measured, and write the numbers into `wiki/development/ar-in-the-browser.md` beside what a page can reach. Delete the throwaway page.

## 2. The rules, as plain modules

- [ ] 2.1 Write `app/src/apps/roam/signs.ts`: the landmark geometry for each sign in [the design's table](design.md#decisions), scaled by hand size, plus the hold-and-cooldown state machine that turns a stream of frames into at most one fired sign.
- [ ] 2.2 Write `signs.test.ts`: each sign recognised from recorded landmark frames and each near-miss refused, a sign crossed but not held firing nothing, a sign held twice in a row firing once, and the readout naming what is currently seen.
- [ ] 2.3 Write `app/src/apps/roam/techniques.ts` and its test: the list — domain, hollow purple, blue — each with its life, its wait, and a function from age to what is drawn and heard, with the ends of each life pinned by tests so the dome, the orb and the pull are checked without a GPU.

## 3. The room relays a cast

- [ ] 3.1 Add the `cast` message to `app/worker/apps/roam/wire.ts`: one incoming and one outgoing shape, an unknown technique refused, a cast sooner than the wait refused against a per-member timestamp, and `relay` fanning it to everyone else as it does a position. Extend `wire.test.ts` for each case.
- [ ] 3.2 Carry the per-member last-cast time in `app/worker/apps/roam/room.ts` and extend `room.test.ts`: a cast reaches the others, a too-soon one reaches nobody and disconnects nobody.
- [ ] 3.3 Add `cast` to `app/src/apps/roam/messages.ts` and the live casts to `presence.ts` — a cast recorded against the peer who made it, cleared when its life ends or when they leave — and extend both tests, including a cast about somebody who is not in the room changing nothing.

## 4. Reading the hands

- [ ] 4.1 Expose the room's own local stream from `app/src/apps/roam/live-room.ts` and extend `live-room.test.ts`; no second `getUserMedia` anywhere.
- [ ] 4.2 Write `app/src/apps/roam/hands.ts`: the landmarker over a video element, started on demand, stopped on command, with the landmarker injected so a test drives it with recorded frames and no WebAssembly. The only file in the app that imports MediaPipe.
- [ ] 4.3 Write `hands.test.ts`: frames reported through the callback, a failed start reported as such rather than thrown, and everything released on stop.
- [ ] 4.4 Write `app/src/apps/roam/casting.ts` and its test: the hook joining reader, signs and room — on and off, the model's loading state, a fired sign told to the room, this page's own cast shown without waiting for the relay, and the live casts aged out.

## 5. Seeing and hearing it

- [ ] 5.1 Write `app/src/apps/roam/casting-stage.ts` and its test: a three.js group of its own holding the dome, the gathering points, the orb and the flash, each placed and shaped from `techniques.ts` given a cast's age and its caster's position, and every mesh and material disposed on teardown. `stage.ts` and `placement.ts` are not edited.
- [ ] 5.2 Write `app/src/apps/roam/technique-sound.ts` and its test: each technique's sound built from oscillators and a noise buffer, put through a panner at the caster's position reusing `gainFor` and the room's listener, and disconnected when it ends. No audio file.
- [ ] 5.3 Give `RoomViewer.tsx` one `casts` prop and the three lines in the frame loop that update the group and the listener, and extend `RoomViewer.test.tsx` — keeping the edit small, since pull request #10 also touches this file.
- [ ] 5.4 Add *Hands on* / *Hands off*, the live tag and the seen-sign readout to `Scan.tsx`'s bar, wire them to `casting.ts`, and extend the screen's tests: hands off by default, the loading state, the browser-cannot-read state, and a cast drawn for a peer.

## 6. What people are told

- [ ] 6.1 Write `wiki/stack/hand-signs.md` — the signs and their geometry, where the model and its WebAssembly live and why they are vendored, the hold and the wait, and the measured frame cost — and link it from `wiki/stack/README.md` and from [live rooms](../../../wiki/stack/live-rooms.md).

## 7. Verification

- [ ] 7.1 From `app/`, run `npm test`: lint, types, every-line coverage over both roam folders, the runtime tests, knip (the new package must be seen as used), repeated code, and the key and action checks. Report any failure that was already there on a clean tree.
- [ ] 7.2 `/save`, then on the deployed staging Worker's own address — [a room costs the app its version previews](../../../wiki/stack/live-rooms.md#a-room-costs-the-app-its-version-previews) — turn hands on, fire each of the three signs, and confirm each is drawn and heard where the caster stands.
- [ ] 7.3 With two browsers in one room, confirm a cast from one is seen and heard by the other at the caster's position, that the sound grows and fades as the other walks toward and away, and that nothing about the figures, the notes or walking changes while it runs.
- [ ] 7.4 Confirm the refusals on the live app: a wave fires nothing, holding a sign fires once rather than continuously, and hands off stops the reading.

# Make the sign, and the room answers

**Status:** planned — the plan is written and saved; nothing built yet.
**Branch:** roam-gestures (branched from `roam-notes`, so the notes work sits underneath it)
**Open questions:** none

## Why

ROAM puts people inside a scan of a real room, and once they are in it there is nothing to do with their hands. This is the fun one: hold up the sign Gojo makes and your domain expands across the room, bring your hands together and a purple orb crosses it — and because everyone in the room is watching the same scan, they see it happen where you are standing. It is also the first thing in the app that reads a person's body rather than their keyboard, which is the part worth having beyond the joke.

## What Changes

- **Press *Hands on*, and the room starts watching your hands.** Your camera is already on, drawing your figure for the others, so nothing new is asked for. A tag in the bar says when your hands are being read, and a small readout says which sign it can see, so you can tell why a sign is not firing.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">hands on</span><span class="tag-outline">seeing: open palm</span><span class="grow"></span><button class="btn-ghost">Hands off</button></div>
    <div class="bar">the scanned room — your figure, and everyone else's</div>
  </div>
  ```

- **Thumb to middle finger, hand up: your domain expands.** The room darkens from where you stand, a dome sweeps out past the walls, the colours invert for a moment, and it falls away. It lasts a few seconds and cannot be fired again until it has.
  ```svg
  <svg viewBox="0 0 220 86">
    <rect x="4" y="4" width="212" height="56" fill="none" stroke="subtle"/>
    <circle cx="60" cy="32" r="6" fill="fg"/>
    <circle cx="60" cy="32" r="18" fill="none" stroke="line"/>
    <circle cx="60" cy="32" r="30" fill="none" stroke="muted"/>
    <circle cx="60" cy="32" r="44" fill="none" stroke="subtle"/>
    <text x="118" y="28" fill="fg">the dome passes</text>
    <text x="118" y="44" fill="muted">the walls, then fades</text>
    <text x="8" y="78" fill="muted">you are the middle of it</text>
  </svg>
  ```

- **Both hands in front, index fingers out, then brought together: hollow purple.** A red point gathers at one hand and a blue one at the other; close your hands and they meet into a purple orb that crosses the room ahead of you and bursts.
  ```svg
  <svg viewBox="0 0 220 76">
    <circle cx="24" cy="24" r="7" fill="danger"/>
    <circle cx="56" cy="24" r="7" fill="fg"/>
    <path d="M32 24h16" fill="none" stroke="muted"/>
    <path d="M70 24h26m-7-5 7 5-7 5" fill="none" stroke="fg"/>
    <circle cx="120" cy="24" r="11" fill="fg"/>
    <path d="M136 24h30m-7-5 7 5-7 5" fill="none" stroke="fg"/>
    <circle cx="190" cy="24" r="4" fill="muted"/>
    <text x="8" y="56" fill="muted">red and blue gather</text>
    <text x="104" y="56" fill="muted">they meet</text>
    <text x="168" y="56" fill="muted">it crosses</text>
  </svg>
  ```

- **An open palm pulled toward you is the blue, a third technique on the same list.** A blue pull that draws the room's light in on itself for a second. The three are one list, so a fourth sign later is one entry on it, not a rebuild.
  | Sign | Technique | What you see |
  |---|---|---|
  | Thumb and middle finger joined, hand up | Domain expansion | A dark dome sweeps the room from where you stand |
  | Two hands, index fingers out, brought together | Hollow purple | Red and blue meet into a purple orb that crosses the room |
  | Open palm pulled toward you | Blue | The light near you draws inward, then releases |

- **Everyone in the room sees it, where you are standing, and hears it from there.** The room passes on what you cast the same way it passes on where you stand, so everybody draws the same thing around your figure. The sound is made on the spot — a low rumble into a crack, a hum on the orb — placed in the room like a voice, so a domain opening across the scan sounds like it is over there. There is no anime audio in it.
  ```mermaid
  flowchart LR
    sign["sign held"] --> room["the room"] --> all["everyone sees it"]
    sign -->|too soon| no["ignored"]
  ```

- **It stays off until you ask for it, and a bad one is ignored.** Hands off is the starting state and one press turns it off again; a sign has to be held for a moment before it counts, so a wave does nothing; and a page that casts faster than a person could is ignored by the room rather than relayed.

Non-goals: firing a technique from a phone standing in the real room (the AR session holds the camera, so a phone watches), a technique that touches anybody or anything in the room, a score, any image or sound taken from the anime, hands read from anybody's video but your own, and saving what was cast.

## Capabilities

### New Capabilities

- `roam-gestures`: hands read from the person's own camera, held signs turned into named techniques, each drawn in the scan where the caster stands and heard from there, with the reading off until it is asked for, a hold before a sign counts, and a wait between casts.

### Modified Capabilities

- `roam-presence`: the room also relays what somebody cast to everyone else, and ignores one that is unknown or sent faster than the wait allows.

## Impact

- The ROAM mini app gains plain modules for the sign rules, the technique list and its timeline, and the cast gate, plus a three.js group of its own for drawing and a Web Audio voice for the sound. `RoomViewer.tsx` gains one prop and a few lines in its frame loop; `Scan.tsx` passes it through and gains the bar's controls. **`stage.ts` and `placement.ts` are not touched**, so this does not collide with the figures work waiting on pull request #10.
- `app/worker/apps/roam/wire.ts` gains one incoming and one outgoing message with its own validation and rate limit; `messages.ts` and `presence.ts` gain the same message on the page's side. `room.ts` relays it through the existing path and needs no new route.
- One new package, `@mediapipe/tasks-vision`, with its WebAssembly and its hand model vendored under `app/public/apps/roam/` beside the scan, so a demo does not depend on a content delivery network. The model adds roughly 8 MB to the first load of a room that turns hands on, and nothing to one that does not.
- No database table, no migration, no seed rows, and no saved key: a cast exists for as long as it is on screen.
- Nothing is removed. A room with hands off behaves exactly as it does today.

## Decision log

- **2026-10-24** — Asked where the gesture effects should live → chose inside ROAM, with everyone in the room seeing them, over a standalone mini app or a local-only effect.
- **2026-10-24** — Asked how many gestures → chose Gojo's sign plus a couple more on a list, over the one sign alone.
- **2026-10-24** — Asked about sound → chose synthesized sound, since the anime's audio cannot ship.
- **2026-10-24** — Asked how to treat the unpublished `roam-notes` work in this workspace, with Paseo not installed → chose to build this on the same branch.
- **2026-10-24** — Asked to avoid creating a conflict → the effects get their own three.js group and their own files, and `stage.ts`, `placement.ts` and the worker's note routes are left alone, because pull request #10 rewrites those.
- **2026-10-24** — Assumed: the three signs are all Gojo's — the domain sign, hollow purple, and the blue — rather than unrelated palms and fists, because the request named his techniques and a themed list reads as one thing.
- **2026-10-24** — Assumed: hands are read from the camera the room already opened for the person's figure, because a second camera stream would need a second permission and the first one is pointed at them already.
- **2026-10-24** — Assumed: reading starts off and is turned on with a press, because a page that watches a camera for gestures the moment it loads is a surprise, and the press is also the gesture the browser needs before any sound.
- **2026-10-24** — Assumed: the effect is drawn around the caster's reported position rather than aimed where they point, because the room already relays that position ten times a second and aiming needs a direction nobody sends yet.
- **2026-10-24** — Assumed: a cast carries only a technique name, with the position taken from where the room already knows the caster is, because a page that could name its own position could draw a domain in somebody else's face.
- **2026-10-24** — Found while planning: everyone in a room already has their user-facing camera open — `useLiveRoom` asks for video and audio to draw their figure — so hand reading costs no new permission, but a phone in an AR session cannot have the camera at all, which is why a phone watches rather than casts.
- **2026-10-24** — Found while planning: the stable `@mediapipe/tasks-vision` is 1.1.1, published 2026-10-14, so it clears the seven-day rule on a new package without taking a release candidate.
- **2026-10-24** — Asked where to save the plan, since `roam-notes` already has an open pull request whose description a checkpoint would overwrite → chose a branch of its own, `roam-gestures`, cut from the `roam-notes` head, so pull request #9 keeps reading as the notes plan and the notes work still sits underneath this one.
- **2026-10-24** — Checkpoint: the plan alone. No code, no package, no vendored model yet; task 1.2's frame measurement is the next thing and gates the reading rate.

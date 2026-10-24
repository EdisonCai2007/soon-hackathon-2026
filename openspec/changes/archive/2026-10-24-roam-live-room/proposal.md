# The live room

**Status:** shipped
**Branch:** roam-live-room
**Open questions:** none

## Why

The room on the site is a place one person walks alone. What makes it worth showing is other people being in it with you: someone across the room who moves as they really move, whose voice grows as you walk up, and whose face you can look straight at. This change makes the room shared. A host sends a link, people click it, and everyone is in the same scanned room at once — each from their own point of view.

## What Changes

- **A host starts a room and shares a link.** One press gives them an address to send; the page lists who is in and the host can remove anyone.
  ```screen
  <div class="card col gap">
    <div class="row gap"><h3>ROAM</h3><span class="tag">3 people</span><span class="grow"></span><button class="btn-ghost">Full screen</button></div>
    <input value="https://roam.example/apps/roam/r/8f2c1b">
    <div class="row gap"><button class="btn-primary">Copy the link</button><span class="muted">anyone with it can join</span></div>
    <div class="bar">Sam · Alex · Jo (you, host)</div>
  </div>
  ```

- **Anyone who clicks the link becomes their own person in the room.** They give a name, allow the camera and microphone, and press *Go live*. From then on they walk the room from their own point of view and the others see them where they stand.
  ```screen
  <div class="card col gap phone">
    <h3>Join the room</h3>
    <input placeholder="Your name">
    <div class="skeleton"></div>
    <div class="row gap"><span class="grow"></span><button class="btn-primary">Go live</button></div>
    <div class="muted">Your camera and voice go to the others in the room. Nothing is recorded.</div>
  </div>
  ```

- **You hear each person from where they stand**, quiet across the room and loud up close, moving to your left or right as you turn. Sound cannot start until you click the page, so a *sound off* tag shows until then.
  ```svg
  <svg viewBox="0 0 220 86">
    <circle cx="66" cy="44" r="36" fill="none" stroke="subtle"/>
    <circle cx="66" cy="44" r="19" fill="none" stroke="line"/>
    <circle cx="66" cy="44" r="4" fill="fg"/>
    <text x="52" y="70" fill="muted">you</text>
    <circle cx="82" cy="36" r="4" fill="fg"/>
    <text x="90" y="34" fill="fg">close · loud · to your right</text>
    <circle cx="196" cy="58" r="3" fill="muted"/>
    <text x="150" y="78" fill="muted">far · faint</text>
  </svg>
  ```

- **Someone standing in the real room joins from an Android phone and their figure walks as they walk.** They stand on a marked spot, tap once to line up, and then forget the screen: the phone follows its own movement, so their place in the scan is their place in the room. Their screen is the camera and a *You're live* state, with no controls to drive — they move with their legs.
  ```screen
  <div class="card col gap phone">
    <h3>Be the camera</h3>
    <div class="bar">stand on the marked spot, facing the arrow</div>
    <div class="row gap"><span class="grow"></span><button class="btn-primary">I'm here</button></div>
    <div class="muted">Then walk the room normally. People watching see you where you are.</div>
  </div>
  ```

- **Click a person and you watch them up close; close it and you are back exactly where you stood.** Walking away is never needed.
  ```mermaid
  flowchart LR
    live["go live"] --> room["walk the room"]
    room --> watch["watch someone"]
    watch -->|close| room
  ```

- **A *Full screen* button makes the room fill the screen**, so it fills a projector instead of sitting in a page.

- **When someone leaves, they go.** No stale figure, no silent voice left behind. A seventh person is told the room is full rather than joining a room that stutters.

Non-goals: nothing is recorded or kept, there is no sign-in, nobody's background is cut out of their video, an iPhone cannot be the in-room camera, and the room does not scale past a handful of people.

## Capabilities

### New Capabilities

- `roam-presence`: a room people join from a link, one shared place per link, relaying each person's position and reflecting joins, leaves, a capacity limit and the host's removal.
- `roam-figures`: a person drawn in the scan at a position and facing, fed by one shared source that both a remote guest and a live phone supply, plus click-to-watch and return.
- `roam-spatial-audio`: each person's voice placed by distance and direction from the viewer, with the first-gesture unlock browsers require.
- `roam-capture`: a phone that reports its own position in the real room, lined up with the scan once by hand, and refuses to go live before it is lined up.

### Modified Capabilities

- `roam-scene`: adds that the room view can fill the screen, and that the app's address can carry a room.

## Impact

- The ROAM mini app `app/src/apps/roam/` gains its screens (`Host.tsx`, `Join.tsx`, `Phone.tsx`) and the plain modules behind them: `invite.ts`, `messages.ts`, `presence.ts`, `placement.ts`, `pose-feed.ts`, `audio.ts`, `mesh.ts`, plus the thin wrappers `room-socket.ts`, `peer-media.ts`, `ar-session.ts`. `App.tsx` and `RoomViewer.tsx` change; `scene.ts`, `pov-controls.ts` and `viewer-state.ts` do not.
- A server side appears at `app/worker/apps/roam/`: `api.ts`, `room.ts` (the room, one Durable Object per link), `wire.ts` and `ids.ts`.
- `app/wrangler.jsonc` gains the Durable Object binding, repeated per environment because such bindings are not inherited, and one `exports` entry with SQLite storage. `app/worker/index.ts` gains one re-export, which is how a Durable Object class reaches the runtime. `app/worker-configuration.d.ts` is regenerated.
- The runtime suite's harness gains the same binding so a real room can be opened in a test.
- **No new packages.** WebSockets, WebRTC, WebXR and Web Audio are all built into the browser; Three.js draws the figures.
- Nothing is deleted. Opening `/apps/roam/` with no room in the address still walks the scan alone, exactly as it does now.

## Decision log

- **2026-10-24** — Asked whether the live room goes on top of the scripted figure (step 2) or instead of it → chose live only: real people replace the stand-in, and its audio and watch design is reused here.
- **2026-10-24** — Asked what a joiner shares with the others → chose live video and voice, not a marker.
- **2026-10-24** — Asked how the video should travel → chose browser-to-browser, with Cloudflare's relay left as a later step.
- **2026-10-24** — Asked what "start the recording" meant → chose going live only: nothing is saved.
- **2026-10-24** — Asked whether phones must work → chose yes, and the person corrected the shape: someone in the real room moves with their legs, so a phone reports its own position instead of being steered on screen.
- **2026-10-24** — Asked what the host can do that a joiner cannot → chose removing someone.
- **2026-10-24** — Asked how to handle AR tracking needing Android → chose to prove it before planning. Checked on the day: a plain page on the phone to hand tracked a real walk in metres.
- **2026-10-24** — Asked how the phone lines up with the scan → chose standing on a taped spot and tapping, after finding that marker detection needs a browser flag.
- **2026-10-24** — Assumed: six people to a room, because each browser sends its video to every other one, so the cost grows with the square of the room and a seventh would cost more than it adds.
- **2026-10-24** — Assumed: the link is the only way in and carries a long random room id, because the people joining are guests with no sign-in and the demo is minutes long.
- **2026-10-24** — Assumed: a person's video shows as a plain rectangle, because cutting a background out live is a separate piece of work and the moment reads without it.
- **2026-10-24** — Assumed: the host's power to remove rides a key kept only in their own browser, because a room with no sign-in has no other way to tell the host apart.
- **2026-10-24** — Assumed: one tuned constant carries the scan's scale, checked by eye on the preview, because the scan's units are not metres and no file states what they are.
- **2026-10-24** — Assumed: a Durable Object class written as a plain class, not extending the runtime's base class, so the test suite can open a room without the Worker runtime.
- **2026-10-24** — Assumed, while building: a dropped room is not reconnected behind the person's back; the page says so and offers *Try again*. A silent reconnect hides whether anyone can still hear you, and the room is minutes long.
- **2026-10-24** — Assumed, while building: `viewer-state.ts` gains one event after all, so the camera can go back to the pose watching saved. The plan said that file was untouched; restoring a saved pose had nowhere else to live.
- **2026-10-24** — Check: `npm test` passes for everything this change touches — lint, types, 100% coverage over both new folders, the real-room runtime test, knip, repeated code, and the key and action checks. Three tests unrelated to this change fail on this Windows machine before it (`src/style.test.ts`, `worker/checked-caller.test.ts`, `worker/fetch-redirect.test.ts`, each comparing a forward-slash path against `readdirSync`'s backslashes), and the Access app's heaviest screens time out under the full suite's parallel load while passing on their own. CI is the gate.
- **2026-10-24** — Check: the local dev server does not start on this machine, before this change as well as after (`Denied ID .../scripts/employee-bootstrap.mjs?raw`), so the browser walk waits for a deployed preview.
- **2026-10-24** — Found while publishing: Cloudflare generates no version preview address for an app that holds a Durable Object, and a new room class must be deployed once before any version can bind it. The change was walked on the staging Worker's own address instead. Written up in [live rooms in a mini app](../../../wiki/stack/live-rooms.md#a-room-costs-the-app-its-version-previews).
- **2026-10-24** — Check: two people in one room verified on the deployed app from two browsers with stand-in cameras — presence, a live stream across the mesh, the host's removal, and the capacity refusal. **Not verified:** the voice moving with distance and turning, click-to-watch and return, and the Android phone on its taped spot, because each needs a person in the room. Asked, and the person chose to publish before that walk; the phone's scale is one constant tuned by eye afterwards.
- **2026-10-24** — Archived at the checkpoint that publishes it from branch `roam-live-room`.

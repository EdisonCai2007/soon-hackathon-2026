## Context

See [the proposal](proposal.md). This is the live half of [the ROAM roadmap](https://github.com/EdisonCai2007/soon-hackathon-2026/pull/3) — its steps 4 and 5 — built directly onto the shipped scan viewer, [`roam-scan-on-site`](../archive/2026-10-24-roam-scan-on-site/design.md). The scripted-figure change, [`roam-demo-moment`](../roam-demo-moment/design.md), is not built first: its `FigureSource` seam, HRTF audio graph and watch state machine are carried over here, driven by real people instead of a path.

What exists: `/apps/roam/` loads `room.spz` and `scene.json`, renders them with Spark inside a React wrapper, and walks with `PovControls`. `scene.ts` parses the scan's details and computes camera poses; `viewer-state.ts` holds the reducer. All three stay as they are.

Constraints: [mini apps](../../../wiki/stack/mini-apps.md) (own folders, no CSS file, every line tested, no import outside the app), Cloudflare primitives only, and a demo under time pressure.

## Goals / Non-Goals

**Goals:** several people in one scan at once from a link, each with their own view, seen and heard where they stand; one of them physically in the room with a phone.

**Non-Goals:** recording, sign-in, background removal, an iPhone as the in-room camera, more than a handful of people, a relay server, and occlusion of a person by room geometry.

## Decisions

- **One Durable Object per room, keyed by the room id, over hibernatable WebSockets.** It owns the member list, relays poses, carries the connection handshake between two named members, enforces the cap and the host's removal. Media never passes through it. Rooms are independent, so one stuck room cannot touch another.
  - *Alternative:* poll a D1 table. Rejected: positions move ten times a second and a room is minutes long; a socket is both cheaper and simpler than a table that needs cleaning up.
- **The class is plain TypeScript implementing the global `DurableObject` interface, not a subclass of the runtime's base class.** It never imports `cloudflare:workers`, so the Node-side suite constructs it with a fake state and fake sockets. That is what the app's every-line coverage requires over code whose real runtime is workerd. The hibernation handlers (`webSocketMessage`, `webSocketClose`, `webSocketError`) are called by name, so a plain class is enough.
- **Every rule the room follows is a pure function in `wire.ts`.** Joining, leaving, removing, the cap, which socket a message is relayed to, and whether a message is well-formed are decided by functions that take state and a message and return the next state and what to send. `room.ts` is the shell that holds sockets and calls them.
- **The socket is a bare handler on the app's own API.** `GET /apps/roam/api/room` upgrades; the shared dispatcher hands a function route's response straight back, so the 101 reaches the browser untouched. `POST /apps/roam/api/room` creates a room and returns its id with a host key; that key is kept only in the host's browser and sent back to remove someone.
- **Video is a mesh, and exactly one side of each pair offers.** `shouldOffer(selfId, peerId)` compares ids, so two browsers never offer at once and no lock is needed. Cloudflare's public STUN address is the only outside service; there is no TURN, so a network that blocks direct connections loses the video while positions and names keep working.
- **One `FigureSource` feeds the renderer, whatever drives it.** `{ id, name, pose, stream }` where a pose is `{ x, y, z, yaw }` in scan units. A remote guest's pose is their own camera; a phone's is its tracking mapped into the scan. The renderer cannot tell them apart, so both paths are exercised by the same code.
- **A remote guest's figure stands where their camera is**, lowered to the floor: they are a walking point of view, and that point of view is where the others should see them.
- **Poses are sent on a gate and smoothed on arrival.** Ten a second up, `lerpPose` between the last two on the way in, so a figure glides instead of stepping. Both are pure and tested with no clock.
- **The phone reports its own position; nothing is read from its picture.** An `immersive-ar` WebXR session with a `local-floor` reference space gives a pose per frame in metres. This works on Android Chrome and nowhere else that matters: iOS Safari has no WebXR at all, confirmed on the day, so an iPhone joins as a guest.
- **Lining up is one tap on a known spot, not a marker.** Marker detection exists in Chrome but only behind the `#webxr-incubations` flag, so it cannot be relied on. `anchor(scene, cameraIndex)` takes the spot's pose from the scan's own source cameras, and every later AR pose is turned into a scan pose relative to it. Going live is refused until the tap, because an unanchored phone would put a person in the wrong place, which is worse than no person.
- **The sound is the step-2 graph, one chain per person:** `stream → GainNode → PannerNode(HRTF) → destination`, the listener set from the camera each frame, `gainFor(distance)` an inverse law clamped to a non-zero floor so a far voice is faint rather than absent, applied with `setTargetAtTime` so fast movement does not click. A remote stream is also attached to a muted `<audio>` element, which Chrome needs before Web Audio will pull from it.
- **The watch overlay is a DOM video over the canvas**, reusing the peer's own element, and the camera pose is saved and restored through the `pose` prop `RoomViewer` already applies. No new camera path.
- **A dropped room is reported, not papered over.** The socket does not reconnect by itself: the page says the connection dropped and offers *Try again*, because a silent reconnect leaves a person unsure whether anyone can still see or hear them.
- **The room lives in the address, so a link is all anyone needs.** `/apps/roam/` alone is today's single walk; `/apps/roam/r/<id>` joins; `/apps/roam/phone/<id>` is the camera role. The app's route already ends in `*`, so no router change is needed, and `invite.ts` parses the tail.

### The scan's units are not metres

`scene.json` spans 4.60 × 2.43 × 4.49 with its lower bound at y = −1.27, and the median source camera sits at y = 0.31, which is 1.58 above that bound. No file says what a unit is, and the two readings differ by a factor of five. **Nothing hardcodes a metre.** One constant, `PHONE_HEIGHT_M`, says how high above the floor a phone is held while filming; `unitsPerMetre(scene)` divides the median camera's height above the floor by it, and every distance — the figure's height, the audio's reference distance, the phone's movement — is scaled by that one number. If the figures come out as giants or ants on the preview, one constant changes and everything follows. The same median gives the floor the figures stand on.

### Capacity

Each browser sends its own video to every other one, so a room of `n` costs each person `n − 1` uploads and the room `n(n − 1)` connections. Six is the cap: it is the point where a laptop is still comfortable while decoding those streams on top of 173,224 splats. The cap is enforced in the room, not the page, so a second tab cannot talk past it, and the refusal is a plain message rather than a dropped socket.

### A room is walked on staging, not on a version alias

Cloudflare generates no Version URL for a Worker that implements a Durable Object, so the aliased preview this repo uploads is unreachable from the first room onwards: the upload succeeds, `has_preview` comes back `false`, and the alias answers 404. The class also has to be deployed once before any version can bind it — a first upload fails with *declared in `exports` but not yet provisioned*. So this change was walked on the staging Worker's own address after `wrangler deploy --env staging`. Written up in [live rooms in a mini app](../../../wiki/stack/live-rooms.md#a-room-costs-the-app-its-version-previews).

## Risks / Trade-offs

- [The venue network blocks direct connections] → Positions, names and presence still work; the video does not. Early testing on the venue network, and Cloudflare's relay as a later change.
- [Six video textures on top of the splats costs frames] → Measured on the preview; the fallbacks are a smaller texture and a lower frame rate, neither of which changes the shape of the code.
- [The phone is lined up carelessly] → Their figure is off by however far they stood from the tape. The tap can be repeated, and the tape and arrow make it a two-second job.
- [Every-line coverage over sockets, WebRTC, WebXR and Web Audio] → Each one is a thin wrapper over pure, tested modules, mocked as the shipped viewer's tests already mock Spark and Three.js.
- [The scan's scale is misjudged] → One constant, checked by eye, adjustable in seconds.
- [Two people in the same real room both unmuted] → Feedback. The phone keeps its own audio silent locally and the stage uses headphones.
- [A link leaks] → The host removes that person, and the room id is long enough not to be guessed in a demo's lifetime.

The shape of this is now [live rooms in a mini app](../../../wiki/stack/live-rooms.md), and what a phone can know about where it stands is [AR in the browser](../../../wiki/development/ar-in-the-browser.md).

## Migration Plan

Additive. The Durable Object binding and its `exports` entry are new; a rollback removes them, the one re-export in `app/worker/index.ts`, the app's server folder, and the new modules, leaving the shipped single-person viewer untouched. Previews at `/apps/roam/` and publishes through the normal gate. No schema, no package, no stored data: a room exists only while people are in it.

## UX

### Use-case brief

- **The host:** a teammate on a **laptop**, casting to a projector. The job: *get everyone into the room in one go*. Done = the link is sent and people are appearing. Common case: start, copy, share. Edge case: someone they do not want is in.
- **A remote guest:** a judge on a **laptop**, or anyone on a phone. The job: *be in the room with whoever is there*. Done = they walked up to a person, heard them get louder, and saw their face up close. Edge cases: sound still blocked before the first click, the room full, the connection dropping.
- **The in-room camera:** a teammate in the scanned room on an **Android phone**. The job: *line up once, then forget the phone*. Done = people watching see them where they really are. Edge case: trying to go live before lining up.
- **Frequency:** a handful of times on the day, then kept as the thing the project is shown by.

The closest existing screen is the shipped room viewer, which this extends rather than replaces.

### Flow

Host presses *Start a room* → copies the link → a guest opens it, names themselves, allows camera and microphone, presses *Go live* → the room loads and the others are in it → walk, hear, click someone, watch, close → back where they stood.

A phone opens the same link, chooses *Be the camera*, stands on the spot, taps *I'm here*, and is live.

### Hierarchy

**The people in the room are the primary target.** On the host screen the one primary action is *Copy the link*; on the join screen, *Go live*; on the phone, *I'm here*, and it is disabled until the phone is ready; in the watch overlay, *Close*. Everything else — the camera list, *Full screen*, the *sound off* tag, the people list — is secondary and muted.

### Components

Shared, already in the app: `Button`, `Badge`, `Card`, `Label`, `NativeSelect`, `Skeleton`, `Loading`, `CopyText`. New: the figure planes and their video textures, the audio chain per person, the watch overlay, and the three screens, built from those parts and phone-width where a phone is the point. No new CSS file.

### Review

See [review.html](review.html). What Changes item 1 sketches the host screen, item 2 the join screen, item 4 the phone screen, and item 5 the watch flow.

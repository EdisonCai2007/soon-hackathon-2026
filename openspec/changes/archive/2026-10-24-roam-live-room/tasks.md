## 1. The room's server side

- [x] 1.1 Write `app/worker/apps/roam/wire.ts`: the member and room types, the envelope check (a known type, a member id, finite pose numbers inside the scan's bounds), and the pure rules — `join`, `leave`, `remove`, the capacity decision, and `relayTo(state, message)` giving the members a message goes to ([why pure](design.md#decisions)).
- [x] 1.2 Write `app/worker/apps/roam/ids.ts`: room id, member id and host key from `crypto.getRandomValues`, and a comparison of the host key that does not leak its length.
- [x] 1.3 Write `app/worker/apps/roam/room.ts`: the `RoamRoom` class implementing the global `DurableObject` interface with no `cloudflare:workers` import — `fetch` accepts the upgrade through `state.acceptWebSocket`, the hibernation handlers drive `wire.ts` and send, a removal closes that one socket with a reason, and a close or error drops the member and tells the others.
- [x] 1.4 Write `app/worker/apps/roam/api.ts`: `POST room` (create, answering with the room id and host key), `GET room` (the socket upgrade), and `GET members` for the host's list, as bare handlers so the upgrade's response passes through the shared dispatcher untouched.
- [x] 1.5 Write `wire.test.ts`, `ids.test.ts`, `room.test.ts` and `api.test.ts`: a join seen by those already in, a pose relayed to everyone but its sender, a handshake message reaching only the member it names, a leave removing the figure, the seventh joiner refused with a reason, removal refused without the host key and accepted with it, a malformed or oversized message ignored without dropping the socket, and a pose outside the scan's bounds refused.

## 2. The binding

- [x] 2.1 Add the Durable Object to `app/wrangler.jsonc`: the `ROAM_ROOMS` binding for class `RoamRoom`, repeated under `env.staging` and `env.local` because such bindings are not inherited, and one top-level `exports` entry with `"storage": "sqlite"`.
- [x] 2.2 Re-export `RoamRoom` from `app/worker/index.ts`, which is how the runtime finds a Durable Object class, and regenerate `app/worker-configuration.d.ts` with `npm run cf-typegen`.
- [x] 2.3 Give the runtime harness the same binding in `app/tests/runtime/setup.ts`, and add a case to `app/tests/runtime/runtime.test.ts`: two sockets join one real room, each sees the other, a pose crosses between them, and a leave is reflected.

## 3. The plain modules in the page

- [x] 3.1 Write `app/src/apps/roam/invite.ts`: the address's tail parsed into alone, guest or camera with its room id, the shareable link built from an origin and an id, and a room id checked.
- [x] 3.2 Write `messages.ts`: what the page accepts off the socket, checked with zod, shaped for reading rather than mirroring the server's envelope check.
- [x] 3.3 Write `presence.ts`: the reducer over room messages — self, the others, who holds the host key, the room-full and disconnected states — and the events the screens dispatch.
- [x] 3.4 Write `placement.ts`: `floorHeight(scene)` and the median camera height, `unitsPerMetre(scene)` from the one `PHONE_HEIGHT_M` constant ([the scale problem](design.md#the-scans-units-are-not-metres)), `anchor(scene, cameraIndex)` for the taped spot, `toScanPose(arPose, anchor, scale)` turning a phone's metres into the scan, `billboardYaw(figure, cameraPosition)` and the figure plane's size.
- [x] 3.5 Write `pose-feed.ts`: the ten-a-second send gate and `lerpPose` between two received poses, both with the clock passed in.
- [x] 3.6 Write `audio.ts`: `gainFor(distance)` on an inverse law clamped to a non-zero floor with its reference and maximum derived from the scan's scale, `listenerFrom(cameraPose)` giving the listener's position and forward and up vectors, and the unlock state.
- [x] 3.7 Write `mesh.ts`: `shouldOffer(selfId, peerId)`, the peer set's additions and removals as data, and the connection settings including the STUN address.
- [x] 3.8 Write the test beside each of 3.1–3.7: tails that parse and tails that do not, a link round-tripped, the reducer over join, leave, pose, full and dropped, the floor and scale from the real `scene.json`, a phone pose at the anchor and a few steps from it, the gate letting one send through per interval, `lerpPose` at both ends and the middle, gain at zero, at the reference and past the maximum and never rising with distance, listener vectors looking along each axis and straight down, and exactly one side of each pair offering.

## 4. The wrappers, the viewer and the screens

- [x] 4.1 Write `room-socket.ts`: connect, send, reconnect with a growing wait, and each parsed message dispatched into `presence.ts`.
- [x] 4.2 Write `peer-media.ts`: the camera and microphone asked for once, one connection per member driven by `mesh.ts`, each remote stream exposed for its member and attached to a muted `<audio>` element so Chrome lets Web Audio pull from it, and everything closed on leave.
- [x] 4.3 Write `ar-session.ts`: an `immersive-ar` session with a `local-floor` space, a pose per frame reported upward, *not supported* said plainly, and the session ended on unmount.
- [x] 4.4 Extend `RoomViewer.tsx`: a figure plane per member built once with its video texture, advanced from the smoothed pose inside the existing animation loop, turned to face the camera, the Web Audio listener set from the camera each frame with a gain and HRTF panner per member, a click raycast against the figure planes alone reporting the member and the live camera pose, and every plane, texture, material and audio node disposed on leave and unmount.
- [x] 4.5 Write `Host.tsx`, `Join.tsx` and `Phone.tsx` from the shared parts, phone-width where a phone is the point, each with the one primary action [the hierarchy](design.md#hierarchy) names.
- [x] 4.6 Extend `App.tsx`: the screen chosen from `invite.ts`, today's viewer and controls kept, the watch overlay over the canvas, the *sound off* tag until sound is running, *Full screen* on the view's box, and the people list with the host's *Remove*.
- [x] 4.7 Extend `RoomViewer.test.tsx` and `App.test.tsx` and write the new screens' tests, with Three.js, Spark, Web Audio, `RTCPeerConnection`, `getUserMedia`, `navigator.xr` and the socket all stood in: a member's figure appears, moves and is disposed on leave; the listener follows the camera and the gain falls with distance; sound unlocks once on the first press; a click on a figure watches it and closing restores the pose; a click on nothing does nothing; the phone refuses to go live before it is lined up; the room-full and dropped states show; and the loading, load-error and no-WebGL states still render as they do now.

## 5. Verification

- [x] 5.1 From `app/`, run the full suite (`npm test`): lint, types, every-line coverage, runtime tests, knip, repeated-code, key and action checks — all green. Log any loosened check as a `Check:` bullet in the Decision log.
- [x] 5.2 Confirm no package was added and every file under `app/public/apps/roam/` is still under 25 MiB.
- [x] 5.3 Two people in one room on the deployed app, driven from here with stand-in cameras: both listed in *Who's in*, a live audio-and-video stream arriving across the mesh, the host's *Remove* ending the other person's room, and a seventh joiner refused with six still in.
- [x] 5.4 Hand the rest to the person at the room: the voice moving while walking and turning, clicking a person and coming back, and the Android phone on its taped spot — none of which a browser on this machine can judge. Recorded in the Decision log, with the phone's scale a one-constant change afterwards.

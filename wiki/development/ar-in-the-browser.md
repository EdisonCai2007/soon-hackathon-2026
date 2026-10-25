# AR in the browser

What a web page can and can not learn about where a phone is in a real room, checked on real devices in October 2026. A page can always read which way a phone faces, from its sensors. **Where** it is standing is the hard part, and the answer differs by platform.

## Android Chrome has it; iOS Safari does not

- **Android Chrome:** `navigator.xr.requestSession('immersive-ar')` with a `local-floor` reference space gives a pose per frame, in metres, from ARCore. Nothing to install, no third party, no key. This is the path to take whenever an Android phone can be the one in the room.
- **iOS Safari:** no WebXR at all. [caniuse](https://caniuse.com/webxr) shows it unsupported through iOS 27, and Apple states that `immersive-ar` sessions "are not supported on visionOS or iOS" and the Settings flag is non-functional ([Apple Developer Forums](https://developer.apple.com/forums/thread/756850)). An iPhone joins such an experience as an ordinary viewer.

Two ways round the iPhone, neither free of cost:

- **[8th Wall](https://8thwall.org)**, which became free and open in February 2026, ships its tracking engine as a binary on npm (`@8thwall/engine-binary`) under a limited-use licence, including SLAM and image targets. It does the tracking itself in WebAssembly, so it runs in iOS Safari 16.4+ with no app key and no account. It loads and runs there; getting it to start tracking took more than a short spike, so treat it as a day's work, not an afternoon's.
- **[Variant Launch](https://launch.variant3d.com)** gets real WebXR on iOS by opening the page inside an App Clip viewer. It works, at the price of an Apple prompt in front of the experience and a paid tier past 3k views a month.

## A session with no layer reports no position at all

Checked on a real Android phone (Chrome 155) in October 2026: `requestSession('immersive-ar')` succeeds, frames arrive, and **`getViewerPose` answers `null` on every one of them** until the session has something to draw into. Eight hundred frames in a row returned nothing; attaching a layer made the first pose arrive within fifty.

```js
const gl = document.createElement('canvas').getContext('webgl', { xrCompatible: true });
await gl.makeXRCompatible();
await session.updateRenderState({ baseLayer: new XRWebGLLayer(session, gl) });
```

Nothing is ever drawn into that layer — the camera's own picture is the view. It exists so the session has a render state, which is what makes a pose computable. A page that only wants to know *where the phone is* still needs it, and the failure is silent: no error, no warning, just a position that never comes.

## The page's own controls live over the camera view

An `immersive-ar` session takes over the display, so the page's buttons are gone unless the session is asked for a DOM overlay. Chrome Android grants it:

```js
await navigator.xr.requestSession('immersive-ar', {
  requiredFeatures: ['local-floor'],
  optionalFeatures: ['dom-overlay'],
  domOverlay: { root: element },
});
```

`session.domOverlayState.type` then reads `screen`, the element draws over the camera, and presses reach the page normally. Read the `type` rather than logging the object: the field is a prototype getter, so `JSON.stringify` prints `{}` and looks like a failure. Keep the overlay element in the page (hidden until the session starts) rather than building it on the fly, so React still owns it.

## What a page can reach while a session runs

Same phone, same session, measured rather than assumed:

| | Result |
|---|---|
| `getUserMedia({ audio: true })` | Granted. `MediaRecorder` gives `audio/webm;codecs=opus` at roughly 15 KB a second, so a 15-second clip is about 220 KB. |
| `getUserMedia({ video: … })` | **Refused** — `NotReadableError: Could not start video source`. ARCore holds the camera, and it is not shared. |

So a photograph taken during a session comes from `<input type="file" accept="image/*" capture="environment">`, which hands the job to the system camera. Capture the pose at the press, before the camera app opens: the session may be suspended or ended behind it, and the position is the one thing that cannot be recovered afterwards.

## Lining a phone up with a scan needs a known spot

A phone's tracking is relative to wherever the session started, so it has to be tied to the real room once.

- **Image tracking is not available on stable Chrome.** The WebXR image-tracking feature is [gated behind `#webxr-incubations`](https://github.com/chromium/chromium/commit/cdd4527accb10c34735b16c05b564bd4373d3855) — it works with the flag on, which is fine for a phone you own and useless for anyone else's.
- **So mark the floor.** Tape a spot and an arrow, have the person stand there and confirm, and take that spot's position and facing from the scan's own data. Every later pose is placed against it. The accuracy is however carefully they stood, which is close enough to put a person in a room and cheap enough to repeat.

## Drawing something in the session

Three.js can own the session, which is the supported path and much less work than driving the frames by hand: `renderer.xr.enabled = true`, `renderer.xr.setReferenceSpaceType('local-floor')`, then `await renderer.xr.setSession(session)`, and from there `renderer.render(world, camera)` inside `renderer.setAnimationLoop`. The installed `@sparkjsdev/spark` already reads `renderer.xr.isPresenting` and draws through `renderer.xr.getCamera()`, so Gaussian splats in a session need no special handling.

**The camera belongs to the phone, so move the world instead.** An XR camera is driven by the device and cannot be positioned by the page. To put a scanned place where somebody is standing, position, turn and scale the *scene* so that place lands on the session's origin — two nested groups is enough, and the maths is the exact inverse of whatever turns a tracked pose into a place in the scan.

**Read the pose from the camera three.js moved, not from the frame.** Measured twice on the owner's phone: while three.js held the session, `getViewerPose` answered with nothing on **92%** of frames, yet `renderer.xr.getCamera()` had moved on the frames it ignored. On a page that owns its own frame loop and attaches its own layer, the same call is empty on only **4%** of frames. So the rule is about who owns the loop, not about the phone.

**A phone cannot draw a whole scan, and a budget is the only lever that matters.** All on the same phone (Chrome 155), drawing a 546,977-splat scan:

| Setting | Frames a second |
|---|---|
| every splat | 2–66, then the WebGL context was lost |
| 250,000 splats | 60–62, then the context was lost |
| 120,000 splats, ¾ of the pixels | 25–64 |
| 60,000 splats, 0.6 of the pixels, `lodRenderScale` 4 | **65–80** — the same as drawing nothing |

Spark's level-of-detail tree only applies when the mesh is built with `lod: true` *and* the renderer is given `enableLod` with an `lodSplatCount`; miss either and every splat is drawn with nothing culled, which is what 2 frames a second looks like. The tree is computed in a worker from the same file in 4–5 seconds, so a trimmed copy of the scan is not needed.

## Keep the tracked and drawn starting points identical

A guest walking from somewhere else needs two saved poses: the scan viewpoint at the start tap, and the first valid phone pose. Subtract the phone origin, rotate by the difference in heading, scale into scan units, then add the saved scan position. Draw the world with the inverse of that same mapping. Recenter both together. Keeping an origin only in the reported position makes the picture disagree with everybody else's view.

Preserve the saved **eye height**, not just the floor beneath it. A tracked height difference starts at zero; adding it to floor height puts the returning camera on the floor. Camera Euler yaw also looks along **negative Z**, while a bearing built from `target - position` looks along positive Z. Converting between those conventions needs a half turn. The [placement tests](../../app/src/apps/roam/ar-place.test.ts) and [camera-direction tests](../../app/src/apps/roam/use-room-ar.test.ts) check the actual transforms, not just callback arguments.

Three.js r180 keeps the last camera pose when it has no new viewer pose. A moving camera is therefore not a tracking-validity signal, nor is a stationary one proof of failure. The guest renderer checks `XRFrame.getPose(viewerSpace, referenceSpace)` for a non-emulated position in the same frame loop, without a second `getViewerPose` call. This path is covered by [renderer tests](../../app/src/apps/roam/ar-view.test.ts); its behavior on the complete joined-phone flow still needs device confirmation. Earlier frame-rate probes did not verify it.

## Trying it on a real phone

A page that asks for the camera needs HTTPS, so a laptop's dev server is not reachable from a phone as-is. `cloudflared tunnel --url http://localhost:<port>` gives a public HTTPS address in seconds with no account. Two things to get right in a throwaway test page: wait for the engine or session to be ready before enabling the button, since a phone connection can take a while over mobile data, and print the error rather than a generic failure — "it doesn't work" and "the script hadn't loaded yet" look identical otherwise.

Part of [development](README.md). For the room these phones stream into, see [live rooms](../stack/live-rooms.md).

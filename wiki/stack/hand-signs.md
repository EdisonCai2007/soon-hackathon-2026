# Hands read in the browser

How a page reads a person's hands from their own camera and turns a held sign into something everyone in a [live room](live-rooms.md) sees. Built for ROAM's techniques, but the shape is general: a landmarker in a seam, geometry in pure functions, and a held sign before anything fires.

## Landmarks, not a trained classifier

[MediaPipe](https://ai.google.dev/edge/mediapipe) `HandLandmarker` gives twenty-one points per hand, up to two hands, from a `<video>` element. Each sign is then a predicate over distances between named points — thumb tip to middle tip, index tip to index tip — divided by the hand's own size (its wrist to its middle knuckle), so how far the person sits from the camera does not matter.

That beats a trained classifier here for one reason: when a sign does not fire, the predicate can be read out loud. The bar names the sign it currently sees, so a person adjusts their hand rather than guessing. A model would need data nobody has and could not explain itself.

Landmark numbers worth knowing: `0` the wrist, `9` the middle finger's knuckle, and the tips at `4` thumb, `8` index, `12` middle, `16` ring, `20` little. The joint below each tip sits two back from it.

## The package is pinned and its files are served from the app

`@mediapipe/tasks-vision` needs two things at runtime that are not JavaScript: its WebAssembly, and a `.task` model file.

- **The WebAssembly comes from the pinned package**, copied into `app/public/apps/roam/hands/wasm/` by [`roam-vendor-hands.mjs`](../../app/scripts/roam-vendor-hands.mjs), which runs before `dev` and before a build. It is **not** in git: each file is over 12 MB.
- **The model is committed**, `app/public/apps/roam/hands/hand_landmarker.task`, about 7.8 MB, beside the room scan. So a build needs npm and nothing else, and a demo never waits on `storage.googleapis.com`.
- **Nothing is downloaded until hand reading is turned on.** A room nobody casts in pays nothing.

If the model is ever replaced, take the float16 one from Google's `mediapipe-models/hand_landmarker` bucket and keep the path.

## A held sign, then a wait

Every shape a sign tests for is crossed in passing by an ordinary wave, so recognising a shape is not enough:

- **Held.** The same sign has to survive four reads in a row before it counts.
- **Waited.** Nothing fires again until the last technique's life and its own wait have passed. The page keeps that time, and the room keeps its own copy: a cast arriving sooner than the shortest life and wait on the list is relayed to nobody, like any message the room cannot trust.
- **Pulled.** A sign that depends on movement — an open palm pulled toward the camera — compares the hand's size across the last six reads rather than within one.

## What it costs, and the one dial

Reading runs on a timer over the video element, not inside the render loop, so it never blocks a frame of the scan. `EVERY_MS` in [`hands.ts`](../../app/src/apps/roam/hands.ts) is the dial: 66 ms, about fifteen reads a second, which is plenty for a sign that must be held for four of them.

**The frame cost of reading beside a 600,000-splat scene has not been measured on a real machine yet.** It is the open task on the change that added this, to be taken on the preview with the readout on; if the scan stutters, this number goes up before anything else changes.

## Where the pieces live

| File | Holds |
|---|---|
| [`hands.ts`](../../app/src/apps/roam/hands.ts) | The landmarker over the room's own camera; the only MediaPipe import in the app |
| [`signs.ts`](../../app/src/apps/roam/signs.ts) | The geometry of each sign, and the hold-and-wait state machine |
| [`techniques.ts`](../../app/src/apps/roam/techniques.ts) | The list of techniques, each life and wait, and what each looks like at an age |
| [`casting.ts`](../../app/src/apps/roam/casting.ts) | Turning reading on and off, telling the room, and each cast's sound |
| [`casting-stage.ts`](../../app/src/apps/roam/casting-stage.ts) | The three.js group that draws them, kept out of `stage.ts` |
| [`technique-sound.ts`](../../app/src/apps/roam/technique-sound.ts) | Each sound, built from oscillators and noise and placed by a panner |

Two rules that keep all of this testable with no camera and no GPU: the landmarker is passed in, so a test drives it with recorded landmarks, and every judgment is a pure function of those landmarks and a clock.

## Reading hands is a camera the page already has

In a live room, every browser has already opened its user-facing camera for the person's own figure, so hand reading asks no second permission and opens no second device. A phone standing in the real room is the exception: an `immersive-ar` session holds the camera exclusively ([AR in the browser](../development/ar-in-the-browser.md#what-a-page-can-reach-while-a-session-runs)), so a phone watches and a laptop casts.

Part of [the Cloudflare stack](README.md). For the room these signs are seen in, see [live rooms](live-rooms.md).

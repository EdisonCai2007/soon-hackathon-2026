# Level of detail in the scan

How ROAM draws fewer splats on a machine that cannot draw them all, and the one way it can draw none at all.

## Two switches, and both have to be on

Spark (`@sparkjsdev/spark` 2.4.0) has level of detail in two places:

- **On the mesh:** `new SplatMesh({ url, lod: true })` builds a level-of-detail tree from the file as it loads. `loadSplats` in `app/src/apps/roam/splat-scene.ts` passes it, for the laptop's viewer and the phone's AR view alike.
- **On the renderer:** `spark.enableLod`, `spark.lodSplatCount`, `spark.lodRenderScale` and `spark.lodDirty = true` say how much of that tree to draw. `app/src/apps/roam/detail.ts` holds the steps, measured on real machines: the whole scan runs at 2 fps on the owner's phone and 65–80 fps at the lightest step.

**A mesh built as a tree is drawn only through the LOD path.** With `lod: true` on the mesh and `enableLod` off on the renderer, Spark draws nothing: the view is the box's own dark background, the file is never requested, the WebGL context is healthy, and no error is raised anywhere. That is what the laptop's first detail step did until this was found — `everything` turned `enableLod` off, meaning "draw it all", and drew none of it. Every step now keeps `enableLod` on; `everything` sets no cap, and Spark's own desktop default of 2.5 million splats is more than any scan here.

## How to tell it apart from a loading failure

A scan that fails to load shows the page's *Try again* message. A scan drawn through the wrong path shows nothing and says nothing, so check in this order:

1. `performance.getEntriesByType('resource')` in the console: if `room.spz` is absent while `scene.json` is there, it is this, not the file.
2. `document.querySelector('canvas').getContext('webgl2').isContextLost()`: `false` rules out the GPU.
3. Move the camera (*Top view*): still black rules out the pose.

## What a stand-in cannot see

The tests stand in for `SplatMesh` and `SparkRenderer` and assert which options were passed. That proves the flags, not the picture: nothing in the suite can notice that a combination of flags draws an empty view, and nothing in CI starts a browser. So a change to `detail.ts`'s steps, or to what `loadSplats` passes, is walked by a person opening `/apps/roam/`, as [running locally](../development/running-locally.md) says.

## Spark's own tool for a prebuilt tree

Spark ships `build-lod`, a Rust tool, for building a level-of-detail file ahead of time rather than in the browser on each load, and `PagedSplats` for streaming it in pages. Nothing here uses either yet; a scan that grows past what the browser can tree on load is when to look at them.

Part of [the Cloudflare stack](README.md). For the room the scan is drawn in, see [live rooms](live-rooms.md).

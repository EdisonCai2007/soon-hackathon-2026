# Room Gaussian-splat scan

A self-contained Three.js + Spark experiment reconstructed from a room walkthrough. The original PLY and working first-person viewer are included; this is not integrated into the main application.

## Run locally

From the repository root:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory experiments
```

Open [the room viewer](http://127.0.0.1:8765/room-scan/). No Node install or build is needed. All viewer dependencies are served locally.

- Click the scene, then use **W/A/S/D** to move and **Q/E** to go down/up.
- **Drag** to look from the camera's current position; **scroll** to move forward/back.
- Hold **Shift** for faster movement. This is a free camera, without collision geometry.
- **Room view**, **Overview**, and **Top view** restore useful camera positions.
- **Camera** revisits the source footage's camera positions.
- **Hide ceiling** and **Cutaway height** expose the interior.
- **Render** compares the fitted splats with the original point cloud at the same camera position.

## What is included

| File | Purpose |
| --- | --- |
| `room_splats.ply` | 173,224 cleaned, trained Gaussians in standard INRIA PLY format; about 39 MiB |
| `splat_scene.json` | Display rotation/translation, bounds, source camera presets, and fitted field of view |
| `splat-viewer.js` | Spark rendering, cutaway, camera presets, and point-cloud comparison |
| `pov-controls.js` | First-person translation and in-place mouse look |
| `baseline_*.bin` | Original point-cloud comparison in the same display coordinates |
| `pipeline/` | Portable geometry preparation/export scripts and upstream compatibility patches |
| `vendor/` | Pinned Three.js 0.180.0 and Spark 2.4.0, with MIT license texts |

The PLY retains the reconstruction's original world coordinates. Apply the rotation and translation in `splat_scene.json` to reproduce the viewer orientation. SplatMesh applies that transform while preserving directional appearance.

## How this scan was made

The input was a roughly 62-second, 1920 × 1080, 30 fps room video recorded using a 0.5× phone lens. Twenty-two overlapping frames were selected. Pi3X estimated geometry and camera poses at 336 × 196; larger source images at 672 × 392 supplied training appearance. The pinhole camera fit had a median internal reprojection residual of 0.28 pixels at the geometry resolution; this is not a real-world accuracy guarantee.

The geometry initialized 110,000 points. metal-gauss trained against 19 views and evaluated three held-out views for 3,000 steps, growing to 180,000 splats. The fit took 149.8 seconds on the local Apple GPU and reached held-out PSNR 20.83 dB. Cleanup retained 173,224 splats. A small MPS random-sampling workaround moved sampling/count bookkeeping to CPU while rasterization and fitting remained on the GPU.

The source video, geometry tensors, checkpoints, model weights, local caches, and credentials are not included. Pi3X weights have separate upstream usage restrictions and must be obtained from the upstream project. Nothing here generates unseen parts of the room. Soft textures, moving-object ghosts, and stretching or gaps from unrecorded viewpoints remain possible; dimensions are unverified.

## Checks

```sh
node --test experiments/room-scan/pov-controls.test.mjs
python3 -m py_compile experiments/room-scan/pipeline/*.py
```

The control tests cover position-preserving look, horizontal movement, strafing, elevation, normalized diagonal movement, lost-focus stopping, and ignoring form fields and modifier shortcuts. Browser checks covered source cameras, POV drag, cutaway, overview/top views, comparison mode, and renderer errors.

See [the processing instructions](pipeline/README.md) to reconstruct from footage. This static experiment is not part of the Cloudflare app deployment; serve it locally as above.

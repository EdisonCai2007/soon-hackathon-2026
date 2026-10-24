# Reconstructing the scan

This handoff preserves the working Apple Silicon pipeline. It requires a source video supplied separately, local disk space for the Pi3X weights, and a compatible PyTorch/MPS environment. Run all commands from the repository root. Keep generated data under the ignored `experiments/room-scan/work/` directory.

## Dependencies and pinned upstream code

```sh
python3 -m venv experiments/room-scan/.venv
experiments/room-scan/.venv/bin/pip install -r experiments/room-scan/pipeline/requirements.txt
mkdir -p experiments/room-scan/work
git clone https://github.com/yyfz/Pi3.git experiments/room-scan/work/Pi3
git -C experiments/room-scan/work/Pi3 checkout 9fa3ddb3f8d53041f8b2738df404f62223bbaa7b
git -C experiments/room-scan/work/Pi3 apply ../../pipeline/pi3-meta-init.patch
git clone https://github.com/nandometzger/metal-gauss.git experiments/room-scan/work/metal-gauss
git -C experiments/room-scan/work/metal-gauss checkout 7f59ff80bda79a8b817cae269fce18b8760be1d6
git -C experiments/room-scan/work/metal-gauss apply ../../pipeline/metal-gauss-mps-sampling.patch
```

Obtain `model.safetensors` for [Pi3X](https://huggingface.co/yyfz233/Pi3X) and store it under the ignored work directory. Follow the upstream model's usage terms. The patches keep scalar configuration on CPU during meta initialization and avoid the reproduced MPS multinomial crash during Gaussian growth.

## Geometry and camera preparation

Replace `/path/to/room.MOV` with your video. The default selected times reproduce this scan; pass `--times 0,2,4,...` to choose a different comma-separated timestamp list appropriate to another video.

```sh
experiments/room-scan/.venv/bin/python experiments/room-scan/pipeline/reconstruct.py \
  --video /path/to/room.MOV \
  --checkpoint experiments/room-scan/work/model.safetensors \
  --pi3-path experiments/room-scan/work/Pi3 \
  --output experiments/room-scan/work
experiments/room-scan/.venv/bin/python experiments/room-scan/pipeline/prepare_splat_data.py \
  --video /path/to/room.MOV --workdir experiments/room-scan/work
```

The geometry runner uses query-chunked attention and frame-chunked output heads to reduce peak memory. Camera-to-world and world-to-camera round trips are checked when preparing the COLMAP-format training dataset. Pi3X ray predictions provide estimated intrinsics; the model uses a pinhole approximation rather than a separate wide-angle distortion calibration.

## Fit Gaussians

```sh
PYTHONPATH=experiments/room-scan/work/metal-gauss \
TORCH_EXTENSIONS_DIR=experiments/room-scan/work/torch_extensions \
experiments/room-scan/.venv/bin/python -u -m metal_gauss.train \
  --colmap experiments/room-scan/work/splat_dataset/sparse/0 \
  --images experiments/room-scan/work/splat_dataset/images \
  --steps 3000 --budget 180000 --start-active 110000 \
  --max-resolution 672 --num-downscales 1 --resolution-schedule 1200 \
  --eval-every 500 --export-every 500 --no-fused-adam \
  --export experiments/room-scan/work/room_trained.ply \
  --out experiments/room-scan/work/splat_training.pt \
  --report experiments/room-scan/work/splat_training_report.json
```

## Export for the viewer

```sh
experiments/room-scan/.venv/bin/python experiments/room-scan/pipeline/export_splats.py \
  --workdir experiments/room-scan/work --viewer experiments/room-scan
```

This replaces `room_splats.ply` and `splat_scene.json`. It preserves the trainer's coordinate system and directional spherical harmonics and writes the display transform separately. The bundled point comparison belongs to the original scan; replace its `baseline_*.bin` files with an aligned cloud or remove that comparison when processing a different room.

## Add another walkthrough

A long walk through several rooms smears when Pi3X sees it in one run, so reconstruct each room on its own and stitch the pieces through frames they share. Transcode phone video to 1080p at 30 fps first (`ffmpeg -vf scale=1920:1080,fps=30`); 4K60 only costs time.

1. **Pick frames:** `select_frames.py` keeps the sharpest frame per window.
2. **Reconstruct per room:** run `reconstruct.py` once per room, each with a couple of seconds of overlap at the doorways. Repeat `--video`/`--times` to mix videos in one run, such as the old scan's frames with the new walk's first seconds, so the first room ties to the existing scan.
3. **Stitch:** `stitch_chunks.py --plan plan.json` fits each piece to its parent through the shared frames' points and writes one `reconstruction.npz` in the existing scan's coordinates. The plan names each piece's videos and parent, and which piece owns each time span.
4. **Edit:** `edit_scene.py` takes hand-drawn door outlines (masked in training, cut after by a box) and paints out people, small objects and floor clutter in the rooms you name.
5. **Train:** `prepare_update.py --no-masks --edits edits.npz` writes the dataset, then train as above.
6. **Finish:** `cleanup_splats.py` drops splats the footage sees through near the door and clutter left on the floor; `splice_room.py` swaps one room for an earlier, sharper scan of it; `export_splats.py`, then `app/scripts/roam-ply-to-spz.mjs`.

## Add another floor

A new floor trains on its own and joins the existing splats, so the scanned floor stays as it is. Start one video where the scan already reaches (the top of the stairs), and film one shared spot, such as a mirror corner, at the start or end of every other video.

1. **Pick frames:** `select_frames.py --window 0.5 --step 0.1` per video, then thin to one frame every 0.6–1 s. Keep each Pi3X run under about 110 frames on a 16 GB Mac.
2. **Reconstruct per piece:** one run that mixes frames the scan already has (same video, same seconds) with the new video's first stretch; then the stairs; then one run per room, each with the shared spot's frames from the stairs video.
3. **Stitch:** `extend_scan.py --plan plan.json` fits each piece to its parent through the shared frames and appends the new frames to the existing `reconstruction.npz`. Each owner names a video by file name.
4. **Mask people:** `detect_people.py` caches a dilated Mask R-CNN mask per frame; it also catches people in mirrors.
5. **Train:** `prepare_floor.py --chunk <pieces>` writes the dataset with people as transparent pixels, then train as above.
6. **Clean:** `drop_people.py` deletes splats the training views mostly see inside a person mask, such as someone sitting still. `see_through.py` deletes splats newer footage sees straight past: run it on the old scan with the stairs video, and on the new floor with the old hall video.
7. **Join:** `merge_floor.py --upper-floor a,b,c --prefer-floor x,z,r` keeps the old scan above its floor plane and the new floor below it; inside the circle at the top of the stairs only the new floor stays, because the old scan filled the stairwell with haze it glimpsed from above. Then `export_splats.py --workdir <merge output> --source <merge output>/room_merged.ply`, then `app/scripts/roam-ply-to-spz.mjs`.

`fit_path.py` (fitting pieces to a hand-drawn floor map) and `remove_people.py` were tried and not used: a sketched map's proportions bent the hallway, and painting before training removed people better than deleting splats after.

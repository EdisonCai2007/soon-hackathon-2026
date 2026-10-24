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

import os, sys, time, json, functools, argparse
os.environ.setdefault('PYTORCH_ENABLE_MPS_FALLBACK', '1')
from pathlib import Path
parser=argparse.ArgumentParser(description='Estimate room geometry with Pi3X on Apple GPU or CPU.')
parser.add_argument('--video', type=Path, required=True)
parser.add_argument('--checkpoint', type=Path, required=True)
parser.add_argument('--pi3-path', type=Path, required=True)
parser.add_argument('--output', type=Path, required=True)
parser.add_argument('--times', help='Comma-separated frame timestamps in seconds; defaults to this scan selection.')
args=parser.parse_args()
ROOT=args.output.resolve();ROOT.mkdir(parents=True,exist_ok=True)
sys.path.insert(0,str(args.pi3_path.resolve()))
import cv2
import numpy as np
import torch
from safetensors import safe_open
from pi3.models.pi3x import Pi3X
from pi3.models.layers import attention
from torch.nn.attention import SDPBackend

torch.set_num_threads(6)
torch.set_num_interop_threads(2)
start = time.monotonic()
def log(s): print(f'[{time.monotonic()-start:.1f}s] {s}', flush=True)

# Split only the query axis: every query still attends to every key. This
# preserves the model calculation while bounding temporary attention matrices.
original_attention = torch.nn.functional.scaled_dot_product_attention
def chunked_attention(q,k,v,attn_mask=None,dropout_p=0.0,**kwargs):
    if q.shape[-2] <= 512:
        return original_attention(q,k,v,attn_mask=attn_mask,dropout_p=dropout_p,**kwargs)
    chunks=[]
    for a in range(0,q.shape[-2],512):
        m=attn_mask
        if m is not None and m.shape[-2] != 1: m=m[...,a:a+512,:]
        chunks.append(original_attention(q[...,a:a+512,:],k,v,attn_mask=m,dropout_p=dropout_p,**kwargs))
    return torch.cat(chunks,dim=-2)
attention.scaled_dot_product_attention = chunked_attention

log('Constructing model without allocating placeholder weights')
with torch.device('meta'):
    model = Pi3X(use_multimodal=False)
with safe_open(str(args.checkpoint.resolve()), framework='pt', device='cpu') as f:
    wanted = set(model.state_dict())
    state = {k: f.get_tensor(k) for k in f.keys() if k in wanted}
    loaded = model.load_state_dict(state, strict=True, assign=True)
del state
model.eval()
device = 'mps' if torch.backends.mps.is_available() else 'cpu'
model = model.to(device)
log(f'Using device: {device}')
model._chunked_conv_head = functools.partial(model._chunked_conv_head, chunk_size=1)
log(f'Loaded {sum(p.numel() for p in model.parameters()):,} parameters')

times = [float(t) for t in args.times.split(',')] if args.times else [0,2,8,10,12,14,16,18,20,22,24,26,32,34,36,38,40,42,44,46,48,50]
cap = cv2.VideoCapture(str(args.video.resolve()))
frames = []
frame_dir = ROOT / 'frames'
frame_dir.mkdir(exist_ok=True)
for sec in times:
    cap.set(cv2.CAP_PROP_POS_MSEC, sec * 1000)
    ok, bgr = cap.read()
    if not ok: raise RuntimeError(f'Failed to read frame at {sec}s')
    rgb = cv2.cvtColor(bgr, cv2.COLOR_BGR2RGB)
    rgb = cv2.resize(rgb, (336,196), interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(frame_dir / f'{len(frames):03d}.jpg'), cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR))
    frames.append(rgb)
cap.release()
rgb = np.stack(frames)
imgs = torch.from_numpy(rgb).permute(0,3,1,2).float()[None] / 255
imgs = imgs.to(device)
log(f'Prepared {len(times)} views at 336 x 196')

for name in ['encoder', 'point_decoder', 'camera_decoder', 'metric_decoder', 'conf_decoder', 'point_head', 'conf_head']:
    getattr(model,name).register_forward_hook(lambda mod, inp, out, label=name: log(f'Finished {label}'))
for i, block in enumerate(model.decoder):
    if i % 6 == 5:
        block.register_forward_hook(lambda mod, inp, out, n=i+1: log(f'Decoder {n}/36'))

log(f'Starting {device} inference')
inference_start = time.monotonic()
with torch.inference_mode():
    result = model(imgs)
if device == 'mps': torch.mps.synchronize()
inference_seconds = time.monotonic() - inference_start
log(f'Inference complete in {inference_seconds:.1f}s')
arrays = {k:v.detach().cpu().numpy() for k,v in result.items()}
arrays['rgb'] = rgb
arrays['times'] = np.array(times)
np.savez_compressed(ROOT / 'reconstruction.npz', **arrays)
meta = {'model':'Pi3X','device':device,'views':len(times),'resolution':[336,196], 'inference_seconds':inference_seconds,'total_seconds':time.monotonic()-start,'source':args.video.name,'sample_seconds':times}
(ROOT / 'run_metadata.json').write_text(json.dumps(meta,indent=2))
log('Saved reconstruction arrays')

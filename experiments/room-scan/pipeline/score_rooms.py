from pathlib import Path
import json,argparse,math
import numpy as np
import torch
from metal_gauss.api import render
from metal_gauss.dataset import load_scene
from metal_gauss.io import load_ply
parser=argparse.ArgumentParser(description='Score splat models per room: PSNR against the real frames, people and masked pixels ignored. Run with PYTHONPATH pointing at metal-gauss.')
parser.add_argument('--dataset',type=Path,required=True,help='splat_dataset folder; image NNN.png is frame NNN of --reconstruction.')
parser.add_argument('--reconstruction',type=Path,required=True,help='reconstruction.npz whose chunks name each frame\'s room.')
parser.add_argument('--model',action='append',required=True,help='name=path to a PLY in the same coordinates; repeat.')
parser.add_argument('--every',type=int,default=8,help='Score every n-th frame: 8 scores exactly the frames training held out.')
parser.add_argument('--output',type=Path)
args=parser.parse_args()
dev='mps' if torch.backends.mps.is_available() else 'cpu'
scene=load_scene(args.dataset/'sparse/0',args.dataset/'images',max_resolution=672,eval_split_every=args.every)
chunks=np.load(args.reconstruction)['chunks']
room=lambda v:str(chunks[int(Path(v.name).stem)])
scores={}
for spec in args.model:
    name,path=spec.split('=',1);s=load_ply(path,device=dev)
    per={}
    with torch.no_grad():
        for v in scene.heldout:
            H,W=v.image.shape[:2]
            rgb,_,_=render(s.means,s.quats,s.scales,s.opacities,s.sh,v.K,v.viewmat,W,H,sh_degree=s.sh_degree,backend='metal')
            gt=v.image.to(dev).float()/255
            keep=gt[...,3]>.5 if gt.shape[-1]==4 else torch.ones(gt.shape[:2],dtype=torch.bool,device=dev)
            mse=((rgb.clamp(0,1)-gt[...,:3])**2).mean(-1)[keep].mean().item()
            per.setdefault(room(v),[]).append(-10*math.log10(max(mse,1e-10)))
    scores[name]={r:round(float(np.mean(p)),2) for r,p in sorted(per.items())}
    print(name,json.dumps(scores[name]),flush=True)
counts={}
for v in scene.heldout:counts[room(v)]=counts.get(room(v),0)+1
print('frames scored per room',json.dumps(counts))
if args.output:args.output.write_text(json.dumps({'frames':counts,'psnr':scores},indent=2))

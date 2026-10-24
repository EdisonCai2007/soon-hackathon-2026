from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Delete splats that newer footage sees straight past: haze an older scan left where it only glimpsed a space, such as a stairwell from the top.')
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--workdir',type=Path,required=True,help='Workdir whose reconstruction.npz holds the newer views, in the same coordinates.')
parser.add_argument('--sources',default='',help='Comma-separated source indices to use; all when empty.')
parser.add_argument('--min-through',type=int,default=3)
parser.add_argument('--ratio',type=float,default=2,help='Views seeing past it, per view landing on it.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
d=PlyData.read(str(args.source))['vertex'].data;X=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64)
z=np.load(args.workdir/'reconstruction.npz');src=z['sources'];conf=expit(z['conf'][0,...,0]);loc=z['local_points'][0];poses=z['camera_poses'][0]
use=np.isin(src,[int(s) for s in args.sources.split(',')]) if args.sources else np.ones(len(src),bool)
depth=loc[...,2];N,H,W=depth.shape;good=(conf>.3)&(depth>0)
y,x=np.mgrid[:H,:W];K={}
for v in np.unique(src):
    l=loc[src==v];ray=l[...,:2]/l[...,2:3];mk=(conf[src==v]>.3)&np.isfinite(ray).all(-1)
    XX=np.broadcast_to(x,mk.shape)[mk];YY=np.broadcast_to(y,mk.shape)[mk]
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][mk],np.ones(mk.sum())],-1),XX,rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][mk],np.ones(mk.sum())],-1),YY,rcond=None)[0];K[v]=(fx,fy,cx,cy)
through=np.zeros(len(X),np.int32);hit=np.zeros(len(X),np.int32)
for j in np.flatnonzero(use):
    vm=np.linalg.inv(poses[j]);c=X@vm[:3,:3].T+vm[:3,3];fx,fy,cx,cy=K[src[j]]
    with np.errstate(divide='ignore',invalid='ignore'):u=np.round(c[:,0]/c[:,2]*fx+cx);v=np.round(c[:,1]/c[:,2]*fy+cy)
    ok=(c[:,2]>.05)&(u>=0)&(u<W)&(v>=0)&(v<H);u=np.where(ok,u,0).astype(int);v=np.where(ok,v,0).astype(int)
    ok&=good[j][v,u];D=depth[j][v,u];zc=c[:,2]
    hit+=ok&(np.abs(D-zc)<.1*zc+.05);through+=ok&(D>zc*1.15+.1)
drop=(through>=args.min_through)&(through>=args.ratio*hit)
PlyData([PlyElement.describe(d[~drop].copy(),'vertex')],text=False).write(str(args.output))
print(json.dumps({'input':len(X),'seen_through':int(drop.sum()),'kept':int((~drop).sum())}))

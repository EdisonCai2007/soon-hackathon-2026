from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Drop Gaussians that sit where people were seen, using the masks from prepare_update.py.')
parser.add_argument('--workdir',type=Path,required=True)
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--share',type=float,default=.4,help='Remove when at least this share of the views that see a Gaussian show a person there.')
args=parser.parse_args()
ROOT=args.workdir.resolve()
d=PlyData.read(str(args.source))['vertex'].data
P=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64)
raw=np.load(ROOT/'reconstruction.npz');people=np.load(ROOT/'masks.npz')['people']
poses=raw['camera_poses'][0];depth=raw['local_points'][0][...,2];conf=expit(raw['conf'][0,...,0])
cams=[l.split() for l in (ROOT/'splat_dataset/sparse/0/cameras.txt').read_text().splitlines() if l and not l.startswith('#')]
N,H,W=depth.shape;seen=np.zeros(len(P),int);person=np.zeros(len(P),int)
for i in range(N):
    fx,fy,cx,cy=map(float,cams[i][4:8]);w,h=int(cams[i][2]),int(cams[i][3])
    vm=np.linalg.inv(poses[i]);c=P@vm[:3,:3].T+vm[:3,3];z=c[:,2]
    with np.errstate(divide='ignore',invalid='ignore'):
        u=np.floor(c[:,0]/z*fx+cx+.5);v=np.floor(c[:,1]/z*fy+cy+.5)
    ok=(z>.05)&(u>=0)&(u<w)&(v>=0)&(v<h);u=np.where(ok,u,0).astype(int);v=np.where(ok,v,0).astype(int)
    # Visible unless the geometry for that pixel (people included) is clearly in front of it,
    # so a wall behind someone is not blamed for them.
    gu,gv=u*W//w,v*H//h;D=depth[i][gv,gu]
    m=people[i][v,u];vis=ok&(conf[i][gv,gu]>=.45)&(z<D*1.12+.06)
    seen+=vis;person+=vis&m
drop=(person>=2)&(person>=args.share*seen)
PlyData([PlyElement.describe(d[~drop].copy(),'vertex')],text=False).write(str(args.output))
print(json.dumps({'input':len(P),'removed':int(drop.sum()),'kept':int((~drop).sum()),'opacity_of_removed_median':float(np.median(expit(d['opacity'][drop]))) if drop.any() else None}))

from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Delete splats floating in the air ahead of chosen views, at each view\'s own height only, so floors and ceilings are never candidates. A splat is air when the source videos keep seeing straight past it.')
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--scene',type=Path,required=True,help='The exported scene.json: the viewer transform the views are given in.')
parser.add_argument('--workdir',type=Path,required=True,help='Workdir whose reconstruction.npz holds the training frames, in the same coordinates as --source.')
parser.add_argument('--view',action='append',required=True,help='x,y,z,fx,fy,fz as the viewer\'s "You are at" line gives them; repeat.')
parser.add_argument('--band',type=float,default=.6,help='Half-height of the slice around the view\'s eye that is cleared.')
parser.add_argument('--reach',type=float,default=3.5,help='How far ahead of the view is cleared.')
parser.add_argument('--cone',type=float,default=45,help='Half-angle in degrees of the wedge ahead of the view that is cleared.')
parser.add_argument('--min-through',type=int,default=3)
parser.add_argument('--ratio',type=float,default=1.5,help='Frames seeing past a splat, per frame landing on it.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
s=json.loads(args.scene.read_text());A=np.array(s['rotation']);b=np.array(s['translation'])
d=PlyData.read(str(args.source))['vertex'].data;X=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64);V=X@A.T+b

inside=np.zeros(len(d),bool);slices=[]
for spec in args.view:
    x,y,z,fx,_,fz=map(float,spec.split(','))
    ahead=np.array([fx,fz])/np.hypot(fx,fz);rel=V[:,[0,2]]-[x,z];dist=np.linalg.norm(rel,axis=1);along=rel@ahead
    here=(np.abs(V[:,1]-y)<args.band)&(along>.1)&(dist<args.reach)&(along>=dist*np.cos(np.radians(args.cone)))
    inside|=here;slices.append(here)
cand=np.flatnonzero(inside);C=X[cand]

# Each training frame's own depth: a splat it lands on is a surface; one it sees well past is in the air.
z=np.load(args.workdir/'reconstruction.npz');src=z['sources'];conf=expit(z['conf'][0,...,0]);loc=z['local_points'][0];poses=z['camera_poses'][0]
depth=loc[...,2];N,H,W=depth.shape;good=(conf>.3)&(depth>0);yy,xx=np.mgrid[:H,:W];K={}
for v in np.unique(src):
    l=loc[src==v];ray=l[...,:2]/l[...,2:3];mk=(conf[src==v]>.3)&np.isfinite(ray).all(-1)
    PX=np.broadcast_to(xx,mk.shape)[mk];PY=np.broadcast_to(yy,mk.shape)[mk]
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][mk],np.ones(mk.sum())],-1),PX,rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][mk],np.ones(mk.sum())],-1),PY,rcond=None)[0];K[v]=(fx,fy,cx,cy)
through=np.zeros(len(C),np.int32);hit=np.zeros(len(C),np.int32)
for j in range(N):
    vm=np.linalg.inv(poses[j]);c=C@vm[:3,:3].T+vm[:3,3];fx,fy,cx,cy=K[src[j]]
    with np.errstate(divide='ignore',invalid='ignore'):u=np.round(c[:,0]/c[:,2]*fx+cx);v=np.round(c[:,1]/c[:,2]*fy+cy)
    ok=(c[:,2]>.05)&(u>=0)&(u<W)&(v>=0)&(v<H);u=np.where(ok,u,0).astype(int);v=np.where(ok,v,0).astype(int)
    ok&=good[j][v,u];D=depth[j][v,u];zc=c[:,2]
    hit+=ok&(np.abs(D-zc)<.1*zc+.05);through+=ok&(D>zc*1.15+.1)
air=np.zeros(len(d),bool);air[cand[(through>=args.min_through)&(through>=args.ratio*hit)]]=True
PlyData([PlyElement.describe(d[~air].copy(),'vertex')],text=False).write(str(args.output))
print(json.dumps({'views':[{'view':spec,'in_slice':int(here.sum()),'air':int((here&air).sum())} for spec,here in zip(args.view,slices)],
                  'removed':int(air.sum()),'kept':int((~air).sum())},indent=1))

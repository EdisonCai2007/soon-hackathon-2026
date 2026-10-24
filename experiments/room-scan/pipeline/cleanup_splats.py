from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Delete trained splats that the footage sees through near a removed door, and leftover clutter on a room floor.')
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--stitched',type=Path,required=True,help='reconstruction.npz the model was trained from (same coordinates).')
parser.add_argument('--edits',type=Path,required=True,help='edits.npz from edit_scene.py.')
parser.add_argument('--metadata',type=Path,required=True,help='The existing scan\'s splat_dataset/metadata.json (viewer transform).')
parser.add_argument('--declutter-chunk',default='bedroom2,bedroom2b')
parser.add_argument('--door-radius',type=float,default=1.3)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
d=PlyData.read(str(args.source))['vertex'].data
z=np.load(args.stitched);E=np.load(args.edits);m=json.loads(args.metadata.read_text());A=np.array(m['viewer_rotation']);b=np.array(m['viewer_translation'])
X=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64);V=X@A.T+b
P=z['points'][0];conf=expit(z['conf'][0,...,0]);loc=z['local_points'][0];depth=loc[...,2];poses=z['camera_poses'][0]
src=z['sources'];ch=z['chunks'];N,H,W,_=P.shape;good=(conf>.2)&np.isfinite(P).all(-1)&(depth>0)
y,x=np.mgrid[:H,:W];K={}
for v in np.unique(src):
    l=loc[src==v];ray=l[...,:2]/l[...,2:3];mk=(conf[src==v]>.3)&np.isfinite(ray).all(-1)
    XX=np.broadcast_to(x,mk.shape)[mk];YY=np.broadcast_to(y,mk.shape)[mk]
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][mk],np.ones(mk.sum())],-1),XX,rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][mk],np.ones(mk.sum())],-1),YY,rcond=None)[0];K[v]=(fx,fy,cx,cy)

# Door ghost: near the doorway, a splat that unmasked frames see straight past is not there.
boxes=E['door_boxes'];near=np.zeros(len(X),bool)
for bx in boxes:near|=np.linalg.norm((V-bx[:3])[:,[0,2]],axis=1)<args.door_radius
floor=float(E['floor']);near&=(V[:,1]>floor+.05)&(V[:,1]<floor+2.1)
idx=np.flatnonzero(near);through=np.zeros(len(idx),int);seen=np.zeros(len(idx),int)
for j in range(N):
    vm=np.linalg.inv(poses[j]);c=X[idx]@vm[:3,:3].T+vm[:3,3];fx,fy,cx,cy=K[src[j]]
    with np.errstate(divide='ignore',invalid='ignore'):u=np.round(c[:,0]/c[:,2]*fx+cx);v=np.round(c[:,1]/c[:,2]*fy+cy)
    ok=(c[:,2]>.05)&(u>=0)&(u<W)&(v>=0)&(v<H);u=np.where(ok,u,0).astype(int);v=np.where(ok,v,0).astype(int)
    ok&=good[j][v,u]&~E['door'][j][v,u]
    D=depth[j][v,u];zc=c[:,2];seen+=ok&(np.abs(D-zc)<.1*zc+.05);through+=ok&(D>zc*1.1+.08)
ghost=np.zeros(len(X),bool);ghost[idx]=(through>=3)&(through>=seen)
print(f'door area: {len(idx)} splats checked, {int(ghost.sum())} seen through',flush=True)

# Floor clutter: low, not carpet-coloured, not under furniture (furniture height per floor cell, ceiling ignored).
room=np.isin(ch,args.declutter_chunk.split(','));rp=P[room][good[room]]@A.T+b
rfloor=float(E['room_floor']);rp=rp[rp[:,1]-rfloor<1.2];g=.08
cell=lambda q:np.floor(q[:,[0,2]]/g).astype(np.int64)@np.array([1,1<<24])
keys=cell(rp);o=np.argsort(keys);ks,st=np.unique(keys[o],return_index=True)
top=np.array([np.quantile(s,.9) for s in np.split(rp[o][:,1]-rfloor,st[1:])])
kk=cell(V);pos=np.clip(np.searchsorted(ks,kk),0,len(ks)-1);inroom=ks[pos]==kk
h=V[:,1]-rfloor;rgb=np.clip(.5+.28209479*np.stack([d[f'f_dc_{i}'] for i in range(3)],-1),0,1)
lowzone=inroom&(top[pos]<.5)&(h<.45)
carpet=np.median(rgb[lowzone&(h<.06)],0);diff=np.linalg.norm(rgb-carpet,axis=1)
clutter=lowzone&(h>-.05)&(diff>.18)
print(f'floor: carpet {np.round(carpet*255)}, {int(lowzone.sum())} low splats, {int(clutter.sum())} not carpet-coloured',flush=True)
drop=ghost|clutter
PlyData([PlyElement.describe(d[~drop].copy(),'vertex')],text=False).write(str(args.output))
print(json.dumps({'input':len(X),'door_ghost':int(ghost.sum()),'floor_clutter':int(clutter.sum()),'kept':int((~drop).sum())}))

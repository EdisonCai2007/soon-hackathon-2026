from pathlib import Path
import json,argparse
import numpy as np
from scipy.spatial import cKDTree
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Replace one walk\'s space, such as a hall and its stairs, with a model trained on that walk; every splat outside it stays byte for byte.')
parser.add_argument('--base',type=Path,required=True,help='The scan to keep.')
parser.add_argument('--patch',type=Path,required=True,help='The model of the walk, same coordinates.')
parser.add_argument('--reconstruction',type=Path,required=True,help='Extended reconstruction.npz holding the walk\'s frames and the rooms\' frames.')
parser.add_argument('--metadata',type=Path,required=True,help='splat_dataset/metadata.json with the viewer transform.')
parser.add_argument('--path',action='append',required=True,help='chunks:from-to:radius[:upstairs], the walk\'s frames that mark the space; repeat. upstairs keeps it above --plane.')
parser.add_argument('--rooms',required=True,help='Comma-separated chunks of the rooms that must not change.')
parser.add_argument('--plane',default='-0.0014,-0.0715,-1.2',help='a,b,c of the upstairs floor y = a x + b z + c.')
parser.add_argument('--bottom',type=float,default=-4.15,help='Nothing below this height counts.')
parser.add_argument('--room-gap',type=float,default=1.0,help='Room cameras closer than this to the walk are passing through it, not inside a room.')
parser.add_argument('--min-views',type=int,default=2,help='Frames of the walk that must see a splat for it to be in the space.')
parser.add_argument('--show',type=Path,help='Also write the base splats the space replaces, to look at.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
m=json.loads(args.metadata.read_text());A=np.array(m['viewer_rotation']);b=np.array(m['viewer_translation'])
z=np.load(args.reconstruction);ch=z['chunks'];t=z['times'];poses=z['camera_poses'][0];loc=z['local_points'][0];conf=expit(z['conf'][0,...,0]);src=z['sources']
cam=poses[:,:3,3]@A.T+b;pa,pb,pc=map(float,args.plane.split(','))
plane=lambda p:pa*p[:,0]+pb*p[:,2]+pc
paths=[]
for spec in args.path:
    parts=spec.split(':');names=parts[0].split(',');lo,hi=map(float,parts[1].split('-'));r=float(parts[2])
    sel=np.flatnonzero(np.isin(ch,names)&(t>=lo)&(t<=hi));paths.append((sel,r,len(parts)>3 and parts[3]=='upstairs'))
walk=np.concatenate([s for s,_,_ in paths])
# Room cameras well inside their rooms, so a doorway shot does not claim the hall.
room=np.flatnonzero(np.isin(ch,args.rooms.split(',')))
room=room[cKDTree(cam[walk][:,[0,2]]).query(cam[room][:,[0,2]])[0]>args.room_gap]
roomtree=cKDTree(cam[room][:,[0,2]])

# Pinhole per video from the predicted rays, for the visibility test.
H,W=conf.shape[1:];y,x=np.mgrid[:H,:W];K={}
for v in np.unique(src[walk]):
    l=loc[src==v];ray=l[...,:2]/l[...,2:3];mk=(conf[src==v]>.3)&np.isfinite(ray).all(-1)
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][mk],np.ones(mk.sum())],-1),np.broadcast_to(x,mk.shape)[mk],rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][mk],np.ones(mk.sum())],-1),np.broadcast_to(y,mk.shape)[mk],rcond=None)[0];K[v]=(fx,fy,cx,cy)

def inside(d):
    X=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64);V=X@A.T+b
    near=np.zeros(len(V),bool);dw=np.full(len(V),np.inf)
    for sel,r,upstairs in paths:
        dist=cKDTree(cam[sel][:,[0,2]]).query(V[:,[0,2]])[0];ok=dist<r
        ok&=(V[:,1]>plane(V)-.15) if upstairs else (V[:,1]>args.bottom)
        near|=ok;dw=np.minimum(dw,np.where(ok,dist,np.inf))
    near&=dw<roomtree.query(V[:,[0,2]])[0]
    # Seen by the walk: in front of, or on, the surface its depth shows.
    idx=np.flatnonzero(near);seen=np.zeros(len(idx),np.int32)
    for j in walk:
        vm=np.linalg.inv(poses[j]);c=X[idx]@vm[:3,:3].T+vm[:3,3];fx,fy,cx,cy=K[src[j]]
        with np.errstate(divide='ignore',invalid='ignore'):u=np.round(c[:,0]/c[:,2]*fx+cx);v=np.round(c[:,1]/c[:,2]*fy+cy)
        ok=(c[:,2]>.05)&(u>=0)&(u<W)&(v>=0)&(v<H);u=np.where(ok,u,0).astype(int);v=np.where(ok,v,0).astype(int)
        ok&=conf[j][v,u]>.2;seen+=ok&(c[:,2]<=loc[j][v,u,2]*1.08+.06)
    out=np.zeros(len(V),bool);out[idx]=seen>=args.min_views;return out
B=PlyData.read(str(args.base))['vertex'].data;P=PlyData.read(str(args.patch))['vertex'].data
assert B.dtype.names==P.dtype.names,'The two PLYs have different splat layouts'
ib=inside(B);ip=inside(P)
PlyData([PlyElement.describe(np.concatenate([B[~ib],P[ip]]),'vertex')],text=False).write(str(args.output))
if args.show:PlyData([PlyElement.describe(B[ib],'vertex')],text=False).write(str(args.show))
print(json.dumps({'base':len(B),'base_replaced':int(ib.sum()),'patch_used':int(ip.sum()),'patch_left_out':int((~ip).sum()),'total':int((~ib).sum()+ip.sum())}))

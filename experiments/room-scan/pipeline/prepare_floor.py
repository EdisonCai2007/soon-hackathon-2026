from pathlib import Path
import json,argparse
import cv2
import numpy as np
from scipy.spatial.transform import Rotation
from scipy.special import expit
parser=argparse.ArgumentParser(description='Write a training dataset for some pieces of an extended scan, with people masked out, in the existing scan\'s coordinates.')
parser.add_argument('--extended',type=Path,required=True,help='Workdir of extend_scan.py.')
parser.add_argument('--chunk',required=True,help='Comma-separated pieces to train.')
parser.add_argument('--video',action='append',required=True,help='name=path for each video the pieces use, name as in the people masks.')
parser.add_argument('--people',type=Path,required=True,help='detect_people.py output.')
parser.add_argument('--metadata',type=Path,required=True,help='The existing scan\'s splat_dataset/metadata.json.')
parser.add_argument('--max-people',type=float,default=.3,help='Skip a frame when people cover more of it than this.')
parser.add_argument('--seeds',type=int,default=250000)
parser.add_argument('--width',type=int,default=672,help='Training image width; 1344 trains sharper from 1080p video, at four times the cost per step.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
OUT=args.output.resolve();sparse=OUT/'splat_dataset/sparse/0';images=OUT/'splat_dataset/images';review=OUT/'masks'
for d in (sparse,images,review):d.mkdir(parents=True,exist_ok=True)
Z=dict(np.load(args.extended/'reconstruction.npz'));rep=json.loads((args.extended/'stitch_report.json').read_text());allv=rep['videos']
paths={};names={}
for v in args.video:
    n,p=v.split('=',1);paths[allv.index(Path(p).name)]=Path(p).expanduser();names[allv.index(Path(p).name)]=n
people_all=np.load(args.people)
pick=np.flatnonzero(np.isin(Z['chunks'],args.chunk.split(',')))
src=Z['sources'][pick];times=Z['times'][pick]
pts=Z['points'][0][pick];local=Z['local_points'][0][pick];conf=expit(Z['conf'][0][pick][...,0]);poses=Z['camera_poses'][0][pick]
N,H,W,_=pts.shape;depth=local[...,2];good=(conf>.2)&np.isfinite(pts).all(-1)&(depth>0)
people=np.stack([people_all[f'{names[s]}:{t:g}'] for s,t in zip(src,times)])
cover=people.mean((1,2));use=cover<=args.max_people
print(f'{N} frames, {int((~use).sum())} skipped for people: '+', '.join(f'{names[s]}:{t:g}' for s,t in zip(src[~use],times[~use])),flush=True)
small=lambda m:cv2.resize(m.astype(np.uint8),(W,H),interpolation=cv2.INTER_NEAREST)>0
good&=~np.stack([small(m) for m in people])

# One pinhole per video from the predicted rays: same phone lens throughout.
y,x=np.mgrid[:H,:W];lens={}
for v in np.unique(src):
    ray=local[src==v][...,:2]/local[src==v][...,2:3];m=(conf[src==v]>.3)&np.isfinite(ray).all(-1)
    X=np.broadcast_to(x,m.shape)[m];Y=np.broadcast_to(y,m.shape)[m]
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][m],np.ones(m.sum())],-1),X,rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][m],np.ones(m.sum())],-1),Y,rcond=None)[0]
    assert fx>0 and fy>0;lens[v]=(fx,fy,cx,cy);print(f'{names[v]} lens',np.round(lens[v],1),flush=True)

IW=args.width;IH=round(args.width*392/672)
caps={v:cv2.VideoCapture(str(p)) for v,p in paths.items()};cams=[];ims=[];kept=[]
for i in np.flatnonzero(use):
    cap=caps[src[i]];cap.set(cv2.CAP_PROP_POS_MSEC,float(times[i])*1000);ok,bgr=cap.read();assert ok
    frame=cv2.resize(bgr,(IW,IH),interpolation=cv2.INTER_AREA);n=len(kept)+1;name=f'{n-1:03d}.png'
    person=cv2.resize(people[i].astype(np.uint8),(IW,IH),interpolation=cv2.INTER_NEAREST)>0
    cv2.imwrite(str(images/name),np.dstack([frame,(~person).astype(np.uint8)*255]))
    tint=frame.copy();tint[person]=tint[person]//2+[0,0,127];cv2.imwrite(str(review/f'{n-1:03d}.jpg'),tint)
    fx,fy,cx,cy=lens[src[i]];sx=IW/W;sy=IH/H
    cams.append(f'{n} PINHOLE {IW} {IH} {fx*sx} {fy*sy} {(cx+.5)*sx-.5} {(cy+.5)*sy-.5}\n')
    vm=np.linalg.inv(poses[i]);q=Rotation.from_matrix(vm[:3,:3]).as_quat()[[3,0,1,2]]
    ims.append(f'{n} '+' '.join(map(str,[*q,*vm[:3,3]]))+f' {n} {name}\n\n');kept.append(i)
(sparse/'cameras.txt').write_text(''.join(cams));(sparse/'images.txt').write_text(''.join(ims))

seed=good.copy();seed[~use]=False;p=pts[seed];c=Z['rgb'][pick][seed]
lo,hi=np.quantile(p,[.002,.998],axis=0);inside=np.all((p>=lo)&(p<=hi),axis=1);p,c=p[inside],c[inside]
voxel=np.max(hi-lo)/500;_,ix=np.unique(np.floor(p/voxel).astype(np.int32),axis=0,return_index=True)
if len(ix)>args.seeds:ix=np.random.default_rng(4).choice(ix,args.seeds,replace=False)
with (sparse/'points3D.txt').open('w') as f:
    for k,(point,color) in enumerate(zip(p[ix],c[ix])):f.write(f'{k+1} '+' '.join(map(str,[*point,*color,0.0]))+'\n')

# Same layout as a single-video workdir, so export_splats.py works unchanged.
kept=np.array(kept);sub={k:(v[:,pick[kept]] if v.ndim>1 and v.shape[0]==1 and k!='rgb' else v[pick[kept]]) for k,v in Z.items()}
np.savez_compressed(OUT/'reconstruction.npz',**sub)
meta=json.loads(args.metadata.read_text())
meta.update(views=len(kept),seedPoints=len(ix),source_times=times[kept].tolist(),sources=src[kept].tolist(),videos=allv)
(OUT/'splat_dataset/metadata.json').write_text(json.dumps(meta,indent=2))
print(json.dumps({'views':len(kept),'seeds':len(ix),'people_pixels':float(people[use].mean())},indent=2))

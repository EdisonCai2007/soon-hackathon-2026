from pathlib import Path
import json,argparse
import cv2
import numpy as np
import torch,torchvision
from scipy.spatial.transform import Rotation
from scipy.special import expit
parser=argparse.ArgumentParser(description='Align a combined old+new reconstruction to the existing scan, mask people and outdated pixels, and write a training dataset.')
parser.add_argument('--joint',type=Path,required=True,help='Workdir of reconstruct.py run on the old video first, then the new one.')
parser.add_argument('--base',type=Path,required=True,help='Workdir of the existing scan (reconstruction.npz, splat_dataset/metadata.json).')
parser.add_argument('--video',type=Path,action='append',required=True,help='Same videos, same order as the joint run.')
parser.add_argument('--output',type=Path,required=True)
parser.add_argument('--seeds',type=int,default=250000)
parser.add_argument('--edits',type=Path,help='edits.npz from edit_scene.py: door pixels to drop, clutter to paint over.')
parser.add_argument('--no-masks',action='store_true',help='Skip person detection and the outdated-pixel check.')
args=parser.parse_args()
OUT=args.output.resolve();sparse=OUT/'splat_dataset/sparse/0';images=OUT/'splat_dataset/images';review=OUT/'masks'
for d in (sparse,images,review):d.mkdir(parents=True,exist_ok=True)
J=dict(np.load(args.joint/'reconstruction.npz'));B=np.load(args.base/'reconstruction.npz')
src=J['sources'];times=J['times'];old=np.flatnonzero(src==0);new=np.flatnonzero(src>0)

# Similarity from the joint frame onto the existing scan, fitted on the old video's camera centres.
a=J['camera_poses'][0][old,:3,3];b=B['camera_poses'][0][:len(old),:3,3]
ma,mb=a.mean(0),b.mean(0);U,S,Vt=np.linalg.svd((b-mb).T@(a-ma))
D=np.diag([1,1,np.sign(np.linalg.det(U@Vt))]);R=U@D@Vt;s=(S*np.diag(D)).sum()/((a-ma)**2).sum();t=mb-s*R@ma
fit=np.linalg.norm((s*a@R.T+t)-b,axis=1)
rot_err=[np.degrees(Rotation.from_matrix((R@J['camera_poses'][0][i,:3,:3]).T@B['camera_poses'][0][k,:3,:3]).magnitude()) for k,i in enumerate(old)]
pts=s*J['points'][0]@R.T+t;local=s*J['local_points'][0];conf=expit(J['conf'][0,...,0])
poses=J['camera_poses'][0].copy();poses[:,:3,:3]=R@poses[:,:3,:3];poses[:,:3,3]=s*poses[:,:3,3]@R.T+t
N,H,W,_=pts.shape;depth=local[...,2]
# Confidence runs lower when more views share the model; .2 matches the original point export.
good=(conf>.2)&np.isfinite(pts).all(-1)&(depth>0)

# People and pets, from COCO Mask R-CNN on the full frame.
cache=OUT/'people.npy';cached=np.load(cache) if cache.exists() else np.zeros((N,392,672),bool) if args.no_masks else None
model=None if cached is not None else torchvision.models.detection.maskrcnn_resnet50_fpn_v2(weights='DEFAULT').eval()
caps=[cv2.VideoCapture(str(v.resolve())) for v in args.video]
frames=[];people=np.zeros((N,392,672),bool) if cached is None else cached
for i in range(N):
    cap=caps[src[i]];cap.set(cv2.CAP_PROP_POS_MSEC,float(times[i])*1000);ok,bgr=cap.read();assert ok
    bgr=cv2.resize(bgr,(1344,784),interpolation=cv2.INTER_AREA)
    if cached is not None:
        frames.append(cv2.resize(bgr,(672,392),interpolation=cv2.INTER_AREA));continue
    with torch.inference_mode():
        r=model([torch.from_numpy(bgr[...,::-1].copy()).permute(2,0,1).float()/255])[0]
    keep=(r['scores']>.4)&torch.isin(r['labels'],torch.tensor([1,17,18]))
    m=(r['masks'][keep,0]>.4).any(0).numpy() if keep.any() else np.zeros(bgr.shape[:2],bool)
    m=cv2.dilate(m.astype(np.uint8),np.ones((25,25),np.uint8))>0
    people[i]=cv2.resize(m.astype(np.uint8),(672,392),interpolation=cv2.INTER_NEAREST)>0
    frames.append(cv2.resize(bgr,(672,392),interpolation=cv2.INTER_AREA))
    print(f'frame {i} ({times[i]}s, video {src[i]}): people {people[i].mean():.1%}',flush=True)
if not args.no_masks:np.save(cache,people)
small=lambda m:cv2.resize(m.astype(np.uint8),(W,H),interpolation=cv2.INTER_NEAREST)>0
people_g=np.stack([small(m) for m in people]);good&=~people_g

# One pinhole per video from the predicted rays: same phone lens throughout, and single low-confidence frames fit badly.
y,x=np.mgrid[:H,:W];lens={}
for v in np.unique(src):
    ray=local[src==v][...,:2]/local[src==v][...,2:3];m=(conf[src==v]>.3)&np.isfinite(ray).all(-1)
    X=np.broadcast_to(x,m.shape)[m];Y=np.broadcast_to(y,m.shape)[m]
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][m],np.ones(m.sum())],-1),X,rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][m],np.ones(m.sum())],-1),Y,rcond=None)[0]
    assert fx>0 and fy>0;lens[v]=(fx,fy,cx,cy);print(f'video {v} lens',np.round(lens[v],1),flush=True)
K=[lens[v] for v in src]
def project(P,j):
    vm=np.linalg.inv(poses[j]);c=P@vm[:3,:3].T+vm[:3,3];fx,fy,cx,cy=K[j]
    with np.errstate(divide='ignore',invalid='ignore'):
        u=np.round(c[:,0]/c[:,2]*fx+cx).astype(np.int64,copy=False) if len(c) else np.zeros(0,int)
        v=np.round(c[:,1]/c[:,2]*fy+cy).astype(np.int64,copy=False) if len(c) else np.zeros(0,int)
    ok=(c[:,2]>.05)&(u>=0)&(u<W)&(v>=0)&(v<H);return u,v,c[:,2],ok

# Old pixels the new video contradicts: the new video sees through them (gone), or sees a surface in front of them (added).
changed=np.zeros((N,H,W),bool)
tol=lambda z:.12*z+.06
for i in ([] if args.no_masks else old):
    ys,xs=np.nonzero(good[i]);P=pts[i][ys,xs];gone=np.zeros(len(P),int)
    for j in new:
        u,v,z,ok=project(P,j);ok[ok]&=good[j][v[ok],u[ok]]
        gone[ok]+=depth[j][v[ok],u[ok]]>z[ok]+tol(z[ok])
    added=np.zeros((H,W),int)
    for j in new:
        Q=pts[j][good[j]];u,v,z,ok=project(Q,i);u,v,z=u[ok],v[ok],z[ok]
        hit=good[i][v,u]&(depth[i][v,u]>z+tol(z));np.add.at(added,(v[hit],u[hit]),1)
    c=np.zeros((H,W),bool);c[ys,xs]=gone>=2;c|=added>=3
    c=cv2.morphologyEx(c.astype(np.uint8),cv2.MORPH_OPEN,np.ones((3,3),np.uint8))
    changed[i]=cv2.dilate(c,np.ones((5,5),np.uint8))>0
    print(f'old frame {i}: {changed[i].mean():.1%} outdated',flush=True)

paint=np.zeros((N,392,672),bool)
if args.edits:
    E=np.load(args.edits);changed|=E['door'];paint=E['paint'];good&=~E['drop']

# Training images carry the mask as alpha; review images tint people red and outdated pixels blue.
cams=[];ims=[]
for i in range(N):
    big=cv2.resize(changed[i].astype(np.uint8),(672,392),interpolation=cv2.INTER_NEAREST)>0
    if paint[i].any():
        # Painted-over clutter trains as plain floor or wall instead of leaving a hole.
        frames[i]=cv2.inpaint(frames[i],paint[i].astype(np.uint8)*255,9,cv2.INPAINT_TELEA)
    keep=~(people[i]|big);name=f'{i:03d}.png'
    cv2.imwrite(str(images/name),np.dstack([frames[i],keep.astype(np.uint8)*255]))
    tint=frames[i].copy();tint[people[i]]=tint[people[i]]//2+[0,0,127];tint[big]=tint[big]//2+[127,0,0]
    cv2.imwrite(str(review/f'{i:03d}.jpg'),tint)
    fx,fy,cx,cy=K[i];sx=672/W;sy=392/H
    cams.append(f'{i+1} PINHOLE 672 392 {fx*sx} {fy*sy} {(cx+.5)*sx-.5} {(cy+.5)*sy-.5}\n')
    vm=np.linalg.inv(poses[i]);q=Rotation.from_matrix(vm[:3,:3]).as_quat()[[3,0,1,2]]
    ims.append(f'{i+1} '+' '.join(map(str,[*q,*vm[:3,3]]))+f' {i+1} {name}\n\n')
(sparse/'cameras.txt').write_text(''.join(cams));(sparse/'images.txt').write_text(''.join(ims))

# Seeds from surfaces still present: no people, no outdated old pixels.
seed=good&~changed;p=pts[seed];c=J['rgb'][seed]
lo,hi=np.quantile(p,[.002,.998],axis=0);inside=np.all((p>=lo)&(p<=hi),axis=1);p,c=p[inside],c[inside]
voxel=np.max(hi-lo)/400;_,ix=np.unique(np.floor(p/voxel).astype(np.int32),axis=0,return_index=True)
if len(ix)>args.seeds:ix=np.random.default_rng(4).choice(ix,args.seeds,replace=False)
with (sparse/'points3D.txt').open('w') as f:
    for k,(point,color) in enumerate(zip(p[ix],c[ix])):f.write(f'{k+1} '+' '.join(map(str,[*point,*color,0.0]))+'\n')

# Same layout as a single-video workdir, in the existing scan's coordinates, so export_splats.py works unchanged.
aligned=dict(J);aligned['points']=pts[None];aligned['local_points']=local[None];aligned['camera_poses']=poses[None]
np.savez_compressed(OUT/'reconstruction.npz',**aligned);np.savez_compressed(OUT/'masks.npz',people=people,changed=changed)
meta=json.loads((args.base/'splat_dataset/metadata.json').read_text())
meta.update(views=int(N),seedPoints=len(ix),source_times=times.tolist(),sources=src.tolist(),
            alignment={'scale':float(s),'centre_error_median':float(np.median(fit)),'centre_error_max':float(fit.max()),'rotation_error_median_deg':float(np.median(rot_err))})
(OUT/'splat_dataset/metadata.json').write_text(json.dumps(meta,indent=2))
print(json.dumps({'views':int(N),'seeds':len(ix),'alignment':meta['alignment'],'people_pixels':float(people.mean()),'outdated_old_pixels':float(changed[old].mean())},indent=2))

from pathlib import Path
import json,sys,argparse
import cv2
import numpy as np
from scipy.spatial.transform import Rotation
from scipy.special import expit
parser=argparse.ArgumentParser(description='Prepare Pi3X geometry and source video for Gaussian fitting.')
parser.add_argument('--video',type=Path,required=True)
parser.add_argument('--workdir',type=Path,required=True)
args=parser.parse_args()
ROOT=args.workdir.resolve()
out=ROOT/'splat_dataset'
sparse=out/'sparse/0';images=out/'images'
sparse.mkdir(parents=True,exist_ok=True);images.mkdir(exist_ok=True)
d=np.load(ROOT/'reconstruction.npz')
pts=d['points'][0];local=d['local_points'][0];conf=expit(d['conf'][0,...,0])
poses=d['camera_poses'][0];times=d['times'];rgb=d['rgb']
N,H,W,_=pts.shape
y,x=np.mgrid[:H,:W];cams=[];ims=[];residuals=[]
cap=cv2.VideoCapture(str(args.video.resolve()))
for i,sec in enumerate(times):
    ray=local[i,...,:2]/local[i,...,2:3]
    mask=(conf[i]>.45)&np.isfinite(ray).all(-1)
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][mask],np.ones(mask.sum())],-1),x[mask],rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][mask],np.ones(mask.sum())],-1),y[mask],rcond=None)[0]
    residual=np.sqrt(np.mean((ray[...,0][mask]*fx+cx-x[mask])**2+(ray[...,1][mask]*fy+cy-y[mask])**2))
    residuals.append(float(residual))
    assert fx>0 and fy>0
    # Larger source images preserve texture; geometry rays were inferred at 336x196.
    w,h=672,392;sx=w/W;sy=h/H
    cams.append(f'{i+1} PINHOLE {w} {h} {fx*sx} {fy*sy} {(cx+.5)*sx-.5} {(cy+.5)*sy-.5}\n')
    vm=np.linalg.inv(poses[i])
    q=Rotation.from_matrix(vm[:3,:3]).as_quat();q=q[[3,0,1,2]]
    t=vm[:3,3]
    name=f'{i:03d}.png'
    ims.append(f'{i+1} '+ ' '.join(map(str,[*q,*t]))+f' {i+1} {name}\n\n')
    # A camera/point round trip is a useful check on OpenCV vs OpenGL conventions.
    back=pts[i]@vm[:3,:3].T+vm[:3,3]
    np.testing.assert_allclose(back,local[i],atol=2e-4,rtol=2e-4)
    cap.set(cv2.CAP_PROP_POS_MSEC,float(sec)*1000);ok,bgr=cap.read()
    assert ok,f'No source image at {sec}'
    bgr=cv2.resize(bgr,(w,h),interpolation=cv2.INTER_AREA)
    cv2.imwrite(str(images/name),bgr)
cap.release()
(sparse/'cameras.txt').write_text(''.join(cams));(sparse/'images.txt').write_text(''.join(ims))
# Seed surfaces densely instead of initializing a room from random particles.
mask=(conf>.45)&np.isfinite(pts).all(-1)&(local[...,2]>0)
p=pts[mask];c=rgb[mask]
lo,hi=np.quantile(p,[.005,.995],axis=0)
good=np.all((p>=lo)&(p<=hi),axis=1);p=p[good];c=c[good]
voxel=np.max(hi-lo)/240
_,ix=np.unique(np.floor(p/voxel).astype(np.int32),axis=0,return_index=True)
if len(ix)>110000:ix=np.random.default_rng(4).choice(ix,110000,replace=False)
p=p[ix];c=c[ix]
with (sparse/'points3D.txt').open('w') as f:
    for i,(point,color) in enumerate(zip(p,c)):
        f.write(f'{i+1} '+' '.join(map(str,[*point,*color,0.0]))+'\n')
up=-poses[:,:3,1].mean(0);up/=np.linalg.norm(up)
right=poses[0,:3,0].copy();right-=up*np.dot(right,up);right/=np.linalg.norm(right)
forward=np.cross(up,right);basis=np.stack([right,forward,up],axis=1)
center=np.median(pts[mask]@basis,axis=0)
A=np.array([[1,0,0],[0,0,1],[0,-1,0]])@basis.T
b=-np.array([center[0],center[2],-center[1]])
meta={'views':int(N),'seedPoints':len(p),'intrinsic_rms_pixels':residuals,'viewer_rotation':A.tolist(),'viewer_translation':b.tolist(),'source_times':times.tolist()}
(out/'metadata.json').write_text(json.dumps(meta,indent=2))
print(json.dumps({'views':int(N),'seedPoints':len(p),'intrinsic_rms_median_px':float(np.median(residuals)),'intrinsic_rms_max_px':float(max(residuals))},indent=2))

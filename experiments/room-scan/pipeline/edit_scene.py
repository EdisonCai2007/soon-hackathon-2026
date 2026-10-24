from pathlib import Path
import json,argparse
import cv2
import numpy as np
import torch,torchvision
from scipy.special import expit
parser=argparse.ArgumentParser(description='Mark pixels to drop (a door that changed between videos) or paint over (people and floor clutter in a room) before training.')
parser.add_argument('--stitched',type=Path,required=True)
parser.add_argument('--metadata',type=Path,required=True,help='The existing scan\'s splat_dataset/metadata.json (viewer transform).')
parser.add_argument('--video',type=Path,action='append',required=True,help='Videos in source order.')
parser.add_argument('--door',type=Path,required=True,help='JSON {"video:seconds": [[x,y],...]}: door outlines in geometry-frame pixels.')
parser.add_argument('--door-radius',type=float,default=1.4)
parser.add_argument('--door-until',type=float,default=16,help='New-video frames after this never see that door.')
parser.add_argument('--declutter-chunk',default='bedroom2,bedroom2b',help='Comma-separated pieces to declutter.')
parser.add_argument('--declutter-from',type=float,default=57.6,help='Also detect people in new-video frames from here on: they look into the room.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
z=np.load(args.stitched);m=json.loads(args.metadata.read_text());A=np.array(m['viewer_rotation']);b=np.array(m['viewer_translation'])
P=z['points'][0];V=P@A.T+b;conf=expit(z['conf'][0,...,0]);depth=z['local_points'][0][...,2];poses=z['camera_poses'][0]
t=z['times'];src=z['sources'];ch=z['chunks'];N,H,W,_=P.shape
good=(conf>.2)&np.isfinite(P).all(-1)&(depth>0)
y,x=np.mgrid[:H,:W];K={}
for v in np.unique(src):
    loc=z['local_points'][0][src==v];ray=loc[...,:2]/loc[...,2:3];mk=(conf[src==v]>.3)&np.isfinite(ray).all(-1)
    X=np.broadcast_to(x,mk.shape)[mk];Y=np.broadcast_to(y,mk.shape)[mk]
    fx,cx=np.linalg.lstsq(np.stack([ray[...,0][mk],np.ones(mk.sum())],-1),X,rcond=None)[0]
    fy,cy=np.linalg.lstsq(np.stack([ray[...,1][mk],np.ones(mk.sum())],-1),Y,rcond=None)[0];K[v]=(fx,fy,cx,cy)
def project(Q,j):
    vm=np.linalg.inv(poses[j]);c=Q@vm[:3,:3].T+vm[:3,3];fx,fy,cx,cy=K[src[j]]
    with np.errstate(divide='ignore',invalid='ignore'):
        u=np.round(c[:,0]/c[:,2]*fx+cx);v=np.round(c[:,1]/c[:,2]*fy+cy)
    ok=(c[:,2]>.05)&(u>=0)&(u<W)&(v>=0)&(v<H);return np.where(ok,u,0).astype(int),np.where(ok,v,0).astype(int),c[:,2],ok
voxel=lambda q,s:np.floor(q/s).astype(np.int64)@np.array([1,1<<20,1<<40])
def in_voxels(keys,s,grow=1):
    """Every pixel whose point falls in (or next to) a marked voxel, in every frame."""
    near=set()
    for dx in range(-grow,grow+1):
        for dy in range(-grow,grow+1):
            for dz in range(-grow,grow+1):near.update((keys+dx+(dy<<20)+(dz<<40)).tolist())
    flat=voxel(V.reshape(-1,3),s);hit=np.isin(flat,np.fromiter(near,np.int64)).reshape(N,H,W);return hit&good

# Door: outlined by hand in a few frames, then every frame's pixels that land on the same 3D cells.
outlines={k:v for k,v in json.loads(args.door.read_text()).items() if not k.startswith('_')}
picked=np.zeros((N,H,W),bool)
for key,poly in outlines.items():
    v,sec=key.split(':');i=int(np.flatnonzero((src==int(v))&np.isclose(t,float(sec)))[0])
    mk=np.zeros((H,W),np.uint8);cv2.fillPoly(mk,[np.array(poly,np.int32)],1);picked[i]=(mk>0)&good[i]
centre=V[picked].mean(0);floor=np.quantile(V[src==0][...,1][good[src==0]],.03)
region=(np.linalg.norm(V[...,[0,2]]-centre[[0,2]],axis=-1)<args.door_radius)&(V[...,1]>floor+.04)&(V[...,1]<floor+2.15)
dk=np.unique(voxel(V[picked&region],.05));door=in_voxels(dk,.05,grow=0)&region
door[((src==1)&(t>args.door_until))|(src>=2)]=False
# Thin boxes around the closed door (old video) and the open leaf (new video), for cutting trained splats.
boxes=[]
for v in (0,1):
    q=V[picked&region&(src==v)[:,None,None]]
    if len(q)<100:continue
    c=np.median(q,0);_,_,Vt=np.linalg.svd(q-c,full_matrices=False);loc=(q-c)@Vt.T
    lo,hi=np.quantile(loc,[.03,.97],0);mid=(lo+hi)/2;half=(hi-lo)/2+[.04,.04,0];half[2]=max(half[2],.07)
    boxes.append(np.concatenate([c+mid@Vt,Vt.ravel(),half]))
    print(f'door box video {v}: centre {np.round(c+mid@Vt,2)} half-size {np.round(half,2)}',flush=True)
boxes=np.array(boxes)
print(f'door: {len(dk)} voxels, {door.sum()} pixels over {np.count_nonzero(door.any((1,2)))} frames',flush=True)

# Declutter: detected people/objects (bed kept) plus anything low on the floor that is not furniture or wall.
room=np.flatnonzero(np.isin(ch,args.declutter_chunk.split(',')));look=np.flatnonzero(((src==1)&(t>=args.declutter_from))|(src>=2))
# People and pets at any size; small carried things only (COCO ids): furniture, doors and lights stay.
PEOPLE={1,17,18};SMALL={27,28,31,32,33,37,44,46,47,73,74,75,76,77,84,87,88,89,90}
cache=args.output.with_name('detections.npz');det=dict(np.load(cache,allow_pickle=True)) if cache.exists() else {}
model=None
caps=[cv2.VideoCapture(str(v.resolve())) for v in args.video]
objects=np.zeros((N,392,672),bool)
for i in look:
    key=f'{src[i]}:{t[i]:g}'
    if key not in det:
        model=model or torchvision.models.detection.maskrcnn_resnet50_fpn_v2(weights='DEFAULT').eval()
        cap=caps[src[i]];cap.set(cv2.CAP_PROP_POS_MSEC,float(t[i])*1000);ok,bgr=cap.read();assert ok
        bgr=cv2.resize(bgr,(1344,784),interpolation=cv2.INTER_AREA)
        with torch.inference_mode():r=model([torch.from_numpy(bgr[...,::-1].copy()).permute(2,0,1).float()/255])[0]
        ms=(r['masks'][:,0]>.4).numpy()
        ms=np.stack([cv2.resize(x.astype(np.uint8),(672,392),interpolation=cv2.INTER_NEAREST)>0 for x in ms]) if len(ms) else np.zeros((0,392,672),bool)
        det[key]=np.empty(3,dtype=object);det[key][0],det[key][1],det[key][2]=r['labels'].numpy(),r['scores'].numpy(),ms
    labels,scores,ms=det[key]
    for l,s_,mk in zip(labels,scores,ms):
        if s_>.4 and (l in PEOPLE or (l in SMALL and mk.mean()<.08)):objects[i]|=mk
    objects[i]=cv2.dilate(objects[i].astype(np.uint8),np.ones((11,11),np.uint8))>0
    print(f'frame {i} ({t[i]}s): objects {objects[i].mean():.1%}',flush=True)
np.savez_compressed(cache,**det)
small=np.stack([cv2.resize(o.astype(np.uint8),(W,H),interpolation=cv2.INTER_NEAREST)>0 for o in objects])
rp=good[room]&~small[room];pts=V[room][rp];rfloor=np.quantile(pts[:,1],.03);g=.06
# Furniture height per floor cell, ignoring the ceiling above it.
pts=pts[pts[:,1]-rfloor<1.2]
cell=lambda q:np.floor(q[:,[0,2]]/g).astype(np.int64)@np.array([1,1<<24])
keys=cell(pts);hgt=pts[:,1]-rfloor;order=np.argsort(keys);ks,starts=np.unique(keys[order],return_index=True)
top=np.array([np.quantile(s,.9) for s in np.split(hgt[order],starts[1:])])
# Depth is too smooth to see a slipper on the carpet, so floor clutter is anything near the floor
# that is not carpet-coloured, away from furniture and walls (tall columns).
lab=np.stack([cv2.cvtColor(z['rgb'][i],cv2.COLOR_RGB2LAB).astype(np.float32) for i in room])
floorish=np.zeros((len(room),H,W),bool);hs=[];talls=[]
for k,i in enumerate(room):
    q=V[i];h=q[...,1]-rfloor;kk=cell(q.reshape(-1,3));pos=np.clip(np.searchsorted(ks,kk),0,len(ks)-1)
    known=(ks[pos]==kk).reshape(H,W);tall=top[pos].reshape(H,W)
    floorish[k]=good[i]&known&(h<.45)&(tall<.5)&~small[i];hs.append(h)
low=np.zeros((N,H,W),bool)
for k,i in enumerate(room):
    # Carpet colour per frame: white balance drifts as the phone turns.
    base=floorish[k]&(hs[k]<.06)
    if base.sum()<200:continue
    carpet=np.median(lab[k][base],0);diff=np.linalg.norm((lab[k]-carpet)*[.6,1,1],axis=-1)
    c=(floorish[k]&(diff>16)).astype(np.uint8)
    c=cv2.morphologyEx(c,cv2.MORPH_OPEN,np.ones((3,3),np.uint8));c=cv2.morphologyEx(c,cv2.MORPH_CLOSE,np.ones((7,7),np.uint8))
    low[i]=c>0
    if k%15==0:print(f'frame {i} ({t[i]}s): floor-ish {floorish[k].mean():.0%}, carpet {np.round(carpet)}, clutter {low[i].mean():.1%}',flush=True)
paint=objects.copy()
for i in room:
    lw=cv2.resize(low[i].astype(np.uint8),(672,392),interpolation=cv2.INTER_NEAREST)
    paint[i]|=cv2.dilate(lw,np.ones((9,9),np.uint8))>0
drop=door|small|low
print(f'declutter: {small.sum()+low.sum()} geometry pixels, painted {paint.mean():.2%} of image area',flush=True)
np.savez_compressed(args.output,door_boxes=boxes,door=door,paint=paint,drop=drop,floor=floor,room_floor=rfloor,door_centre=centre)
print(json.dumps({'door_centre':centre.round(2).tolist(),'door_pixels':int(door.sum()),'painted_frames':int(paint.any((1,2)).sum()),'dropped_points':int(drop.sum())}))

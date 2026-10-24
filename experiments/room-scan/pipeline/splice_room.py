from pathlib import Path
import json,argparse
import cv2
import numpy as np
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Swap one room of a trained model for an earlier, sharper scan of that room (same coordinates).')
parser.add_argument('--model',type=Path,required=True,help='The combined model.')
parser.add_argument('--room',type=Path,required=True,help='The earlier single-room scan.')
parser.add_argument('--metadata',type=Path,required=True,help='splat_dataset/metadata.json with the shared viewer transform.')
parser.add_argument('--cut',type=Path,help='edits.npz: door_boxes[0] is cut out of the room scan.')
parser.add_argument('--door-scale',default='1.3,1.2,1.5',help='Grow the door box along its axes (height, width, thickness).')
parser.add_argument('--margin',type=float,default=-.05,help='Grow (+) or shrink (-) the room footprint, in metres.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
m=json.loads(args.metadata.read_text());A=np.array(m['viewer_rotation']);b=np.array(m['viewer_translation'])
M=PlyData.read(str(args.model))['vertex'].data;R=PlyData.read(str(args.room))['vertex'].data
view=lambda d:np.stack([d[k] for k in 'xyz'],-1).astype(np.float64)@A.T+b
VM,VR=view(M),view(R)
# The room's footprint: rotated rectangle around the earlier scan's solid splats, on the floor plane.
solid=VR[expit(R['opacity'])>.3][:,[0,2]];lo,hi=np.quantile(solid,[.01,.99],0);solid=solid[np.all((solid>=lo)&(solid<=hi),1)]
(cx,cz),(w,h),ang=cv2.minAreaRect(solid.astype(np.float32));w+=2*args.margin;h+=2*args.margin
box=cv2.boxPoints(((cx,cz),(w,h),ang)).astype(np.float32)
inside=lambda V:np.array([cv2.pointPolygonTest(box,(float(x),float(z)),False)>=0 for x,z in V[:,[0,2]]])
in_m=inside(VM);in_r=inside(VR)
print(f'room footprint {w:.2f} x {h:.2f} m at ({cx:.2f}, {cz:.2f}), {ang:.1f} deg',flush=True)
door=np.zeros(len(R),bool)
if args.cut:
    bx=np.load(args.cut)['door_boxes'][0];ctr,ax,half=bx[:3],bx[3:12].reshape(3,3),bx[12:]*np.array(args.door_scale.split(','),float)
    door=np.all(np.abs((VR-ctr)@ax.T)<=half,1)
    print(f'door box half-size {np.round(half,2)}: {int(door.sum())} splats of the closed door',flush=True)
keep_r=in_r&~door
out=np.concatenate([M[~in_m],R[keep_r]])
PlyData([PlyElement.describe(out,'vertex')],text=False).write(str(args.output))
print(json.dumps({'model_removed':int(in_m.sum()),'room_added':int(keep_r.sum()),'total':len(out)}))

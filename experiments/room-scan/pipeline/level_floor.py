from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
parser=argparse.ArgumentParser(description='Level the pieces extend_scan.py added: fit their floor, tilt it flat about the anchor frame\'s spot, and put it at the scan\'s floor height. A small shared patch (a mirror corner) pins position well but tilt poorly.')
parser.add_argument('--extended',type=Path,required=True,help='extend_scan.py workdir; rewritten in place.')
parser.add_argument('--chunk',required=True,help='Comma-separated pieces to level, all moved together.')
parser.add_argument('--metadata',type=Path,required=True,help='The existing scan\'s splat_dataset/metadata.json (viewer transform).')
parser.add_argument('--floor',type=float,required=True,help='Floor height in viewer coordinates.')
parser.add_argument('--eye',type=float,default=.6,help='Points this far below the cameras or more count as floor candidates.')
args=parser.parse_args()
m=json.loads(args.metadata.read_text());A=np.array(m['viewer_rotation']);b=np.array(m['viewer_translation'])
Z=dict(np.load(args.extended/'reconstruction.npz'));sel=np.flatnonzero(np.isin(Z['chunks'],args.chunk.split(',')))
P=Z['points'][0][sel];cam=Z['camera_poses'][0][sel][:,:3,3]@A.T+b
c=expit(Z['conf'][0][sel][:,::4,::4,0]).ravel();p=P[:,::4,::4].reshape(-1,3)[c>.5]@A.T+b
p=p[p[:,1]<np.median(cam[:,1])-args.eye]
X=np.c_[p[:,0],p[:,2],np.ones(len(p))];keep=np.ones(len(p),bool)
# The floor is the densest band of low points: steps, rugs and table tops fall outside it.
for _ in range(6):
    co=np.linalg.lstsq(X[keep],p[keep,1],rcond=None)[0];r=p[:,1]-X@co
    h,e=np.histogram(r,bins=np.arange(-.5,.5,.01));keep=np.abs(r-e[np.argmax(h)]-.005)<.05
n=np.array([-co[0],1,-co[1]]);n/=np.linalg.norm(n);up=np.array([0,1,0.])
v=np.cross(n,up);s=np.linalg.norm(v);K=np.array([[0,-v[2],v[1]],[v[2],0,-v[0]],[-v[1],v[0],0]])
R=np.eye(3)+K+K@K*((1-n@up)/s**2)
first=cam[np.argmin(Z['times'][sel])];pivot=np.array([first[0],co[0]*first[0]+co[1]*first[2]+co[2],first[2]])
target=pivot.copy();target[1]=args.floor
# viewer: v' = R (v - pivot) + target; model p = A^T (v - b)
Rm=A.T@R@A;tm=A.T@(R@(b-pivot)+target-b)
Z['points'][0][sel]=Z['points'][0][sel]@Rm.T+tm
poses=Z['camera_poses'][0][sel];poses[:,:3,:3]=Rm@poses[:,:3,:3];poses[:,:3,3]=poses[:,:3,3]@Rm.T+tm;Z['camera_poses'][0][sel]=poses
np.savez_compressed(args.extended/'reconstruction.npz',**Z)
print(json.dumps({'frames':len(sel),'floor_inliers':round(float(keep.mean()),2),'tilt_degrees':round(float(np.degrees(np.arccos(n@up))),2),'floor_at_anchor':round(float(pivot[1]),3)}))

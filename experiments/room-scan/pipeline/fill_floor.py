from pathlib import Path
import json,argparse
import numpy as np
from scipy.ndimage import binary_closing,binary_fill_holes
from scipy.spatial import cKDTree
from scipy.spatial.transform import Rotation
from scipy.special import expit,logit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Lay flat floor splats where a cleared room has none: under the tables and chairs taken out, which no frame saw.')
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--workdir',type=Path,required=True,help='prepare_floor.py output: its frames\' points give the room\'s footprint.')
parser.add_argument('--metadata',type=Path,required=True,help='splat_dataset/metadata.json with the viewer transform.')
parser.add_argument('--floor',type=float,required=True,help='Floor height in viewer coordinates.')
parser.add_argument('--cell',type=float,default=.05)
parser.add_argument('--close',type=float,default=1.5,help='Gaps in the footprint narrower than this, in metres, are floor under furniture.')
parser.add_argument('--under',type=float,default=.02,help='Fill this far below the floor, so real floor shows wherever it exists.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
m=json.loads(args.metadata.read_text());A=np.array(m['viewer_rotation']);b=np.array(m['viewer_translation'])
d=PlyData.read(str(args.source))['vertex'].data;V=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64)@A.T+b;op=expit(d['opacity'])
z=np.load(args.workdir/'reconstruction.npz');conf=expit(z['conf'][0][:,::2,::2,0]).ravel()
P=z['points'][0][:,::2,::2].reshape(-1,3)[conf>.3]@A.T+b
# Footprint: wherever a frame saw floor, closed over the furniture that hid the rest.
key=lambda X:np.floor(X[:,[0,2]]/args.cell).astype(np.int64)
fp=P[np.abs(P[:,1]-args.floor)<.06];k=key(fp);k0=k.min(0)-2;shape=k.max(0)-k0+3
grid=np.zeros(shape,bool);grid[tuple((k-k0).T)]=True
r=int(args.close/args.cell/2);yy,xx=np.mgrid[-r:r+1,-r:r+1]
room=binary_fill_holes(binary_closing(grid,structure=xx**2+yy**2<=r*r))
# A white floor trains as few, wide splats: a cell has floor when any floor splat's footprint reaches it.
onfloor=(np.abs(V[:,1]-args.floor)<.05)&(op>.3);has=np.zeros(shape,bool)
rad=np.clip(np.exp(np.stack([d[f'scale_{i}'] for i in range(3)],-1)[onfloor]).max(-1)*1.5,args.cell/2,.5)
for (cx,cz),rr in zip(V[onfloor][:,[0,2]],rad):
    lo=np.floor((np.array([cx,cz])-rr)/args.cell).astype(int)-k0;hi=np.floor((np.array([cx,cz])+rr)/args.cell).astype(int)-k0+1
    lo=np.maximum(lo,0);hi=np.minimum(hi,shape)
    if (hi>lo).all():
        gx,gz=np.mgrid[lo[0]:hi[0],lo[1]:hi[1]]
        has[gx,gz]|=((gx+k0[0]+.5)*args.cell-cx)**2+((gz+k0[1]+.5)*args.cell-cz)**2<=rr*rr
miss=np.argwhere(room&~has)
centre=np.c_[(miss[:,0]+k0[0]+.5)*args.cell,np.full(len(miss),args.floor-args.under),(miss[:,1]+k0[1]+.5)*args.cell]
# Colour from the nearest real floor: the median of its 30 nearest solid floor splats.
solid=onfloor&(op>.5);_,near=cKDTree(V[solid][:,[0,2]]).query(centre[:,[0,2]],30)
dc=np.stack([d[f'f_dc_{i}'] for i in range(3)],-1)[solid];col=np.median(dc[near],1)
new=np.zeros(len(miss),d.dtype)
pos=(centre-b)@A;new['x'],new['y'],new['z']=pos.T
for i in range(3):new[f'f_dc_{i}']=col[:,i]
# A flat disc: wide along the floor's two axes, thin along viewer up, in model coordinates.
q=Rotation.from_matrix(A.T).as_quat();new['rot_0'],new['rot_1'],new['rot_2'],new['rot_3']=q[3],q[0],q[1],q[2]
w=np.log(args.cell*.75);new['scale_0'],new['scale_1'],new['scale_2']=w,np.log(.004),w
new['opacity']=logit(.95)
PlyData([PlyElement.describe(np.concatenate([d,new]),'vertex')],text=False).write(str(args.output))
print(json.dumps({'footprint_cells':int(room.sum()),'had_floor':int((room&has).sum()),'filled':len(new)}))

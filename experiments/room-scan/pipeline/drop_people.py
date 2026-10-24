from pathlib import Path
import json,argparse
import cv2
import numpy as np
from scipy.spatial.transform import Rotation
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Delete trained splats that the training views mostly see inside a person mask: someone the detector missed in a few frames, or who sat still.')
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--dataset',type=Path,required=True,help='splat_dataset folder whose images carry the people mask as alpha.')
parser.add_argument('--share',type=float,default=.4,help='Drop when at least this share of the views that see a splat put it in a mask.')
parser.add_argument('--min-views',type=int,default=3)
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
d=PlyData.read(str(args.source))['vertex'].data;X=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64)
cams={l.split()[0]:list(map(float,l.split()[4:8])) for l in (args.dataset/'sparse/0/cameras.txt').read_text().splitlines() if l and not l.startswith('#')}
lines=[l for l in (args.dataset/'sparse/0/images.txt').read_text().splitlines() if l and not l.startswith('#')]
seen=np.zeros(len(X),np.int32);masked=np.zeros(len(X),np.int32)
for l in lines:
    f=l.split();q=np.array(list(map(float,f[1:5])));t=np.array(list(map(float,f[5:8])))
    R=Rotation.from_quat(q[[1,2,3,0]]).as_matrix();fx,fy,cx,cy=cams[f[8]]
    alpha=cv2.imread(str(args.dataset/'images'/f[9]),cv2.IMREAD_UNCHANGED)[...,3];H,W=alpha.shape
    c=X@R.T+t
    with np.errstate(divide='ignore',invalid='ignore'):u=np.round(c[:,0]/c[:,2]*fx+cx);v=np.round(c[:,1]/c[:,2]*fy+cy)
    ok=(c[:,2]>.1)&(u>=0)&(u<W)&(v>=0)&(v<H);u=np.where(ok,u,0).astype(int);v=np.where(ok,v,0).astype(int)
    seen+=ok;masked+=ok&(alpha[v,u]<128)
drop=(masked>=args.min_views)&(masked>=args.share*np.maximum(seen,1))
PlyData([PlyElement.describe(d[~drop].copy(),'vertex')],text=False).write(str(args.output))
print(json.dumps({'input':len(X),'dropped':int(drop.sum()),'kept':int((~drop).sum())}))

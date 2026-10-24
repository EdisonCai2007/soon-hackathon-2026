from pathlib import Path
import json,sys,argparse
import numpy as np
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Clean a fitted PLY and export Three.js camera metadata.')
parser.add_argument('--workdir',type=Path,required=True)
parser.add_argument('--viewer',type=Path,required=True)
parser.add_argument('--source',type=Path)
args=parser.parse_args()
ROOT=args.workdir.resolve()
source=args.source.resolve() if args.source else ROOT/'room_trained.ply'
d=PlyData.read(str(source))['vertex'].data
p=np.stack([d[k] for k in ['x','y','z']],-1)
s=np.exp(np.stack([d[f'scale_{i}'] for i in range(3)],-1))
op=expit(d['opacity'])
raw=np.load(ROOT/'reconstruction.npz')
initial=raw['points'][0].reshape(-1,3)
lo,hi=np.quantile(initial,[.005,.995],axis=0)
keep=np.isfinite(p).all(-1)&np.isfinite(s).all(-1)&(op>.035)&(s.max(-1)<.65)&np.all((p>lo-.3)&(p<hi+.3),axis=1)
d=d[keep].copy();p=p[keep]
assert len(p)>1000,'Splat fit contains too few usable Gaussians'
out=args.viewer.resolve();out.mkdir(parents=True,exist_ok=True)
PlyData([PlyElement.describe(d,'vertex')],text=False).write(str(out/'room_splats.ply'))
metadata=json.loads((ROOT/'splat_dataset/metadata.json').read_text())
A=np.array(metadata['viewer_rotation']);b=np.array(metadata['viewer_translation'])
viewer=p@A.T+b
bound=np.quantile(viewer,[.005,.995],axis=0)
poses=raw['camera_poses'][0]
camera_views=[]
calibrations=[line.split() for line in (ROOT/'splat_dataset/sparse/0/cameras.txt').read_text().splitlines() if line and not line.startswith('#')]
for i,pose in enumerate(poses):
    eye=A@pose[:3,3]+b;forward=A@pose[:3,2];up=-A@pose[:3,1]
    calibration=calibrations[i]
    fov_y=float(np.degrees(2*np.arctan(float(calibration[3])/(2*float(calibration[5])))))
    camera_views.append({'eye':eye.tolist(),'target':(eye+forward*2).tolist(),'up':up.tolist(),'fov_y':fov_y,'name':f'Video {int(raw["times"][i])}s'})
reportpath=ROOT/'splat_training_report.json'
report=json.loads(reportpath.read_text()) if reportpath.exists() else {}
report={k:report[k] for k in ['steps','budget','wall_clock_s','final_psnr'] if k in report}
meta={'splats':len(p),'views':len(poses),'bounds':bound.tolist(),'cutHeight':float(np.quantile(viewer[:,1],.72)),
      'rotation':A.tolist(),'translation':b.tolist(),'cameras':camera_views,'source':source.name,
      'opacity_quantiles':np.quantile(op,[.1,.5,.9]).tolist(),'training_report':report}
(out/'splat_scene.json').write_text(json.dumps(meta,indent=2))
print(json.dumps({'source':source.name,'input':len(keep),'exported':len(p),'bounds':bound.tolist()},indent=2))

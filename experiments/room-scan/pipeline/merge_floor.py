from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Add a separately trained floor to the existing splats, keeping the existing ones where both cover a place, and write an export workdir for both.')
parser.add_argument('--existing',type=Path,required=True,help='Existing scan PLY (cleaned).')
parser.add_argument('--existing-workdir',type=Path,required=True,help='Workdir the existing PLY was trained from.')
parser.add_argument('--floor',type=Path,required=True,help='New floor PLY, same coordinates.')
parser.add_argument('--floor-workdir',type=Path,required=True,help='prepare_floor.py output.')
parser.add_argument('--cell',type=float,default=.15,help='Grid size in metres for deciding who covers a place.')
parser.add_argument('--min-existing',type=int,default=20,help='Existing splats in a cell for it to count as covered.')
parser.add_argument('--prefer-floor',help='x,z,radius in viewer coordinates: inside this circle only the floor\'s splats stay, such as the top of the stairs, which the old scan filled with haze it glimpsed from above.')
parser.add_argument('--upper-floor',help='a,b,c of the existing floor\'s plane y = a x + b z + c in viewer coordinates, when the new floor lies below it: over the existing floor, splats above it are the existing scan\'s and splats below it the new floor\'s.')
parser.add_argument('--output',type=Path,required=True,help='Workdir with room_merged.ply, for export_splats.py --source.')
args=parser.parse_args()
OUT=args.output.resolve();(OUT/'splat_dataset/sparse/0').mkdir(parents=True,exist_ok=True)
meta=json.loads((args.existing_workdir/'splat_dataset/metadata.json').read_text());A=np.array(meta['viewer_rotation'])
E=PlyData.read(str(args.existing))['vertex'].data;F=PlyData.read(str(args.floor))['vertex'].data
assert E.dtype.names==F.dtype.names,'The two PLYs have different splat layouts'
# Everything in viewer axes, so cells sit square to the floor.
b=np.array(meta['viewer_translation'])
view=lambda d:np.stack([d[k] for k in 'xyz'],-1).astype(np.float64)@A.T+b
pe,pf=view(E),view(F);key=lambda p:np.floor(p/args.cell).astype(np.int64)
cells,counts=np.unique(key(pe[expit(E['opacity'])>.2]),axis=0,return_counts=True)
covered={tuple(c) for c in cells[counts>=args.min_existing]}
drop=np.array([tuple(k) in covered for k in key(pf)]);lose=np.zeros(len(E),bool);stair=np.zeros(len(F),bool)
if args.prefer_floor:
    x,z,r=map(float,args.prefer_floor.split(','))
    lose=np.hypot(pe[:,0]-x,pe[:,2]-z)<r;stair=np.hypot(pf[:,0]-x,pf[:,2]-z)<r;drop&=~stair
if args.upper_floor:
    a,bz,c=map(float,args.upper_floor.split(','))
    he=pe[:,1]-(a*pe[:,0]+bz*pe[:,2]+c);hf=pf[:,1]-(a*pf[:,0]+bz*pf[:,2]+c)
    # The existing floor's footprint: cells where its splats lie on the plane.
    cell=lambda p:np.floor(p[:,[0,2]]/.3).astype(np.int64)@np.array([1,1<<24])
    fc,fn=np.unique(cell(pe[np.abs(he)<.05]),return_counts=True)
    lose|=he<-.15;drop|=np.isin(cell(pf),fc[fn>=10])&(hf>-.05)&~stair
merged=np.concatenate([E[~lose],F[~drop]])
PlyData([PlyElement.describe(merged,'vertex')],text=False).write(str(OUT/'room_merged.ply'))
# The export reads cameras and initial points from both scans, in order: existing frames, then the floor's.
a=dict(np.load(args.existing_workdir/'reconstruction.npz'));b=dict(np.load(args.floor_workdir/'reconstruction.npz'))
rec={k:np.concatenate([a[k],b[k]],axis=1 if k in ('points','local_points','conf','camera_poses') else 0) for k in ('points','local_points','conf','camera_poses','rgb','times','sources')}
np.savez_compressed(OUT/'reconstruction.npz',**rec)
cams=lambda w:[l for l in (w/'splat_dataset/sparse/0/cameras.txt').read_text().splitlines() if l and not l.startswith('#')]
(OUT/'splat_dataset/sparse/0/cameras.txt').write_text('\n'.join(cams(args.existing_workdir)+cams(args.floor_workdir))+'\n')
(OUT/'splat_dataset/metadata.json').write_text(json.dumps(meta,indent=2))
print(json.dumps({'existing':len(E),'floor':len(F),'floor_dropped_as_covered':int(drop.sum()),'existing_dropped_for_floor':int(lose.sum()),'merged':len(merged)}))

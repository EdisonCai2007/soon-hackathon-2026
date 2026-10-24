from pathlib import Path
import json,argparse
import numpy as np
from scipy.optimize import least_squares
parser=argparse.ArgumentParser(description='Fit each stitched piece so its camera trail follows a walking path drawn on a floor map.')
parser.add_argument('--stitched',type=Path,required=True,help='reconstruction.npz from stitch_chunks.py (without --adjust).')
parser.add_argument('--metadata',type=Path,required=True,help='The existing scan\'s splat_dataset/metadata.json (viewer transform).')
parser.add_argument('--path',type=Path,required=True,help='JSON: anchor (fixed piece), wall_angle (degrees of the anchor room\'s walls in viewer x/z), legs [{video, from, to, start:[x,y], end:[x,y]}] in map pixels.')
parser.add_argument('--output',type=Path,required=True,help='adjust.json for stitch_chunks.py, plus a report.')
args=parser.parse_args()
z=np.load(args.stitched);m=json.loads(args.metadata.read_text());A=np.array(m['viewer_rotation']);b=np.array(m['viewer_translation'])
spec=json.loads(args.path.read_text())
cam=(z['camera_poses'][0][:,:3,3]@A.T+b)[:,[0,2]];t=z['times'];src=z['sources'];ch=z['chunks']
# Where each camera should be on the map: linear along the leg for its time.
obs=[]
for leg in spec['legs']:
    for i in np.flatnonzero((src==leg['video'])&(t>=leg['from'])&(t<leg['to'])):
        f=(t[i]-leg['from'])/max(leg['to']-leg['from'],1e-6)
        obs.append((i,(1-f)*np.array(leg['start'],float)+f*np.array(leg['end'],float),leg.get('weight',1.0)))
idx=np.array([o[0] for o in obs]);target=np.stack([o[1] for o in obs]);wt=np.array([o[2] for o in obs])
pieces=[p for p in dict.fromkeys(ch[idx]) if p!=spec['anchor']]
centre={p:cam[ch==p].mean(0) for p in pieces}
rot=lambda a:np.array([[np.cos(a),-np.sin(a)],[np.sin(a),np.cos(a)]])

def unpack(x,mirror):
    k,phi,tx,ty=x[:4];G=lambda q:(k*(q*[1,mirror])@rot(phi).T)+[tx,ty]
    per={p:x[4+4*j:8+4*j] for j,p in enumerate(pieces)};return G,per
def moved(x,mirror):
    G,per=unpack(x,mirror);out=cam[idx].copy()
    for p,(th,dx,dz,ls) in per.items():
        sel=ch[idx]==p;out[sel]=np.exp(ls)*(out[sel]-centre[p])@rot(th).T+centre[p]+[dx,dz]
    return G,out
def residual(x,mirror,phi0):
    G,out=moved(x,mirror);r=(out-G(target))*wt[:,None]
    # Map walls follow the anchor room's walls; pieces keep their size unless the path insists.
    reg=[3*np.sin(2*(x[1]-phi0))]+[.5*x[7+4*j] for j in range(len(pieces))]
    return np.concatenate([r.ravel(),reg])
best=None
anchor=ch==spec['anchor'];span=np.ptp(cam[anchor],0).max()
for mirror in (1,-1):
    for quarter in range(4):
        phi0=np.radians(spec['wall_angle']+90*quarter)
        # Scale guess: anchor cameras spread vs. their map targets, else ~ map pixels per unit from the room size.
        k0=spec.get('units_per_pixel',.005)
        a_obs=ch[idx]==spec['anchor']
        T0=cam[idx][a_obs].mean(0)-k0*(target[a_obs].mean(0)*[1,mirror])@rot(phi0).T if a_obs.any() else cam.mean(0)
        x0=np.concatenate([[k0,phi0,*T0],np.zeros(4*len(pieces))])
        lo=[k0/3,-np.inf,-np.inf,-np.inf]+[-np.inf,-np.inf,-np.inf,np.log(.6)]*len(pieces)
        hi=[k0*3,np.inf,np.inf,np.inf]+[np.inf,np.inf,np.inf,np.log(1.4)]*len(pieces)
        r=least_squares(residual,x0,args=(mirror,phi0),bounds=(lo,hi))
        print(f'mirror {mirror:+d} quarter {quarter}: cost {r.cost:.4f}',flush=True)
        if best is None or r.cost<best[0].cost:best=(r,mirror,quarter)
r,mirror,quarter=best;G,out=moved(r.x,mirror);_,per=unpack(r.x,mirror)
err=np.linalg.norm(out-G(target),axis=1)
adjust={}
for p,(th,dx,dz,ls) in per.items():
    # stitch_chunks rotates about the piece's own owned-camera centre; same centre used here.
    adjust[p]=[float(np.degrees(-th)),float(dx),float(dz),float(np.exp(ls))]
args.output.write_text(json.dumps(adjust,indent=2))
report={'mirror':mirror,'map_rotation_deg':float(np.degrees(r.x[1])),'units_per_map_pixel':float(r.x[0]),
        'error_median':float(np.median(err)),'error_by_piece':{p:float(np.median(err[ch[idx]==p])) for p in dict.fromkeys(ch[idx])},
        'map_to_viewer':{'k':float(r.x[0]),'phi':float(r.x[1]),'t':r.x[2:4].tolist(),'mirror':mirror},'adjust':adjust}
args.output.with_name('fit_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

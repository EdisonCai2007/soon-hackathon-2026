from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
parser=argparse.ArgumentParser(description='Stitch per-room Pi3X chunks into the existing scan\'s coordinates through their shared frames.')
parser.add_argument('--chunks',type=Path,required=True,help='Folder with one reconstruct.py workdir per chunk.')
parser.add_argument('--plan',type=Path,required=True,help='JSON: chunks (name, videos, parent, optional from_chunk to reuse another run as a separately placed piece), owners (video, from, to, chunk).')
parser.add_argument('--base',type=Path,required=True,help='Workdir of the existing scan; the chunk without a parent aligns to it.')
parser.add_argument('--adjust',type=Path,help='JSON {chunk: [degrees, dx, dz, scale?]}: a floor-plane nudge in viewer coordinates, applied after stitching.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
plan=json.loads(args.plan.read_text());OUT=args.output.resolve();OUT.mkdir(parents=True,exist_ok=True)
meta=json.loads((args.base/'splat_dataset/metadata.json').read_text());A=np.array(meta['viewer_rotation']);b=np.array(meta['viewer_translation'])

def umeyama(a,b):
    ma,mb=a.mean(0),b.mean(0);U,S,Vt=np.linalg.svd((b-mb).T@(a-ma))
    D=np.diag([1,1,np.sign(np.linalg.det(U@Vt))]);R=U@D@Vt;s=(S*np.diag(D)).sum()/((a-ma)**2).sum()
    return s,R,mb-s*R@ma
def robust(a,b,rounds=4):
    keep=np.ones(len(a),bool)
    for _ in range(rounds):
        s,R,t=umeyama(a[keep],b[keep]);r=np.linalg.norm(s*a@R.T+t-b,axis=1);keep=r<=np.quantile(r,.7)
    return s,R,t,r
apply=lambda T,p:T[0]*p@T[1].T+T[2]
def compose(T2,T1):  # T2 after T1
    return (T2[0]*T1[0],T2[1]@T1[1],T2[0]*T2[1]@T1[2]+T2[2])

# Each chunk's frames, keyed by (video, time) so shared frames match across chunks.
C={}
for c in plan['chunks']:
    z=np.load(args.chunks/c.get('from_chunk',c['name'])/'reconstruction.npz')
    keys=[(c['videos'][int(s)],round(float(t),3)) for s,t in zip(z['sources'],z['times'])]
    C[c['name']]=dict(z=z,keys=keys,index={k:i for i,k in enumerate(keys)},conf=expit(z['conf'][0,...,0]),parent=c.get('parent'))
T={};report={}
def place(name):
    if name in T:return T[name]
    c=C[name]
    if c['parent'] is None:
        base=np.load(args.base/'reconstruction.npz');old=[i for i,k in enumerate(c['keys']) if k[0]==0]
        s,R,t,r=robust(c['z']['camera_poses'][0][old,:3,3],base['camera_poses'][0][:len(old),:3,3],rounds=1)
        T[name]=(s,R,t);report[name]={'anchor':'existing scan','frames':len(old),'residual_median':float(np.median(r))};return T[name]
    P=place(c['parent']);p=C[c['parent']];shared=[k for k in c['keys'] if k in p['index']]
    assert len(shared)>=2,f'{name} shares too few frames with {c["parent"]}'
    a=[];bb=[]
    for k in shared:
        i,j=c['index'][k],p['index'][k]
        m=(c['conf'][i]>.2)&(p['conf'][j]>.2)
        a.append(c['z']['points'][0][i][m]);bb.append(apply(P,p['z']['points'][0][j][m]))
    a=np.concatenate(a);bb=np.concatenate(bb);sub=np.random.default_rng(0).choice(len(a),min(len(a),200000),replace=False)
    s,R,t,r=robust(a[sub],bb[sub]);T[name]=(s,R,t)
    report[name]={'anchor':c['parent'],'shared_frames':len(shared),'points':int(len(sub)),'residual_median':float(np.median(r)),'scale':float(s)}
    return T[name]
for name in C:place(name)

# Every frame comes from the chunk that owns its time span.
def owner(k):
    for o in plan['owners']:
        if o['video']==k[0] and o['from']<=k[1]<o['to']:return o['chunk']

# Optional hand placement from the floor map: rotate about the cameras the piece owns, on the floor, then shift.
adjust=json.loads(args.adjust.read_text()) if args.adjust else {}
for name,(deg,dx,dz,*rest) in adjust.items():
    sc=rest[0] if rest else 1.0
    c=C[name];own=[i for i,k in enumerate(c['keys']) if owner(k)==name]
    centre=(apply(T[name],c['z']['camera_poses'][0][own,:3,3])@A.T+b).mean(0)
    th=np.radians(deg);Ry=np.array([[np.cos(th),0,np.sin(th)],[0,1,0],[-np.sin(th),0,np.cos(th)]])
    # viewer = A x + b; nudge in viewer space, then express it back in scan space.
    Rv=A.T@Ry@A;tv=A.T@(sc*Ry@(b-centre)+centre+np.array([dx,0,dz])-b)
    T[name]=compose((sc,Rv,tv),T[name]);report.setdefault(name,{})['adjust']=[deg,dx,dz,sc]

rows=[]
for name,c in C.items():
    for i,k in enumerate(c['keys']):
        if owner(k)==name:rows.append((k,name,i))
rows.sort(key=lambda r:r[0])
out={k:[] for k in ['points','local_points','conf','camera_poses','rgb']};times=[];sources=[];chunk=[]
for k,name,i in rows:
    z=C[name]['z'];s,R,t=T[name]
    out['points'].append(apply(T[name],z['points'][0][i]));out['local_points'].append(s*z['local_points'][0][i]);out['conf'].append(z['conf'][0][i])
    pose=z['camera_poses'][0][i].copy();pose[:3,:3]=R@pose[:3,:3];pose[:3,3]=apply(T[name],pose[:3,3]);out['camera_poses'].append(pose)
    out['rgb'].append(z['rgb'][i]);times.append(k[1]);sources.append(k[0]);chunk.append(name)
arrays={k:np.stack(v)[None] for k,v in out.items() if k!='rgb'};arrays['rgb']=np.stack(out['rgb'])
arrays.update(times=np.array(times),sources=np.array(sources),chunks=np.array(chunk))
np.savez_compressed(OUT/'reconstruction.npz',**arrays)
report['frames']={n:chunk.count(n) for n in C}
(OUT/'stitch_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

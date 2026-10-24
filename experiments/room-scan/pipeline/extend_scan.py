from pathlib import Path
import json,argparse
import numpy as np
from scipy.special import expit
parser=argparse.ArgumentParser(description='Add new Pi3X pieces to an already stitched scan, each fitted to its parent through the frames they share.')
parser.add_argument('--parent',type=Path,required=True,help='Stitched reconstruction.npz the new pieces join.')
parser.add_argument('--parent-videos',required=True,help='Comma-separated video file names, in the parent\'s source order.')
parser.add_argument('--chunks',type=Path,required=True,help='Folder with one reconstruct.py workdir per piece.')
parser.add_argument('--plan',type=Path,required=True,help='JSON: chunks (name, parent: "base" or a piece), owners (video file name, from, to, chunk).')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
plan=json.loads(args.plan.read_text());OUT=args.output.resolve();OUT.mkdir(parents=True,exist_ok=True)

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

# Frames are keyed by (video file name, seconds), so a frame shared by two runs matches.
base=dict(np.load(args.parent));videos=args.parent_videos.split(',')
key=lambda names,s,t:(names[int(s)],round(float(t),3))
C={'base':dict(z=base,keys=[key(videos,s,t) for s,t in zip(base['sources'],base['times'])],conf=expit(base['conf'][0,...,0]))}
for c in plan['chunks']:
    z=dict(np.load(args.chunks/c['name']/'reconstruction.npz'))
    names=json.loads((args.chunks/c['name']/'run_metadata.json').read_text())['source']
    C[c['name']]=dict(z=z,keys=[key(names,s,t) for s,t in zip(z['sources'],z['times'])],conf=expit(z['conf'][0,...,0]),parent=c['parent'])
for c in C.values():c['index']={k:i for i,k in enumerate(c['keys'])}
T={'base':(1.0,np.eye(3),np.zeros(3))};report={}
def place(name):
    if name in T:return T[name]
    c=C[name];P=place(c['parent']);p=C[c['parent']];shared=[k for k in c['keys'] if k in p['index']]
    assert len(shared)>=2,f'{name} shares too few frames with {c["parent"]}'
    a=[];bb=[]
    for k in shared:
        i,j=c['index'][k],p['index'][k];m=(c['conf'][i]>.2)&(p['conf'][j]>.2)
        a.append(c['z']['points'][0][i][m]);bb.append(apply(P,p['z']['points'][0][j][m]))
    a=np.concatenate(a);bb=np.concatenate(bb);sub=np.random.default_rng(0).choice(len(a),min(len(a),200000),replace=False)
    s,R,t,r=robust(a[sub],bb[sub]);T[name]=(s,R,t)
    # Camera centres of the shared frames, as a second opinion on the fit.
    cam=np.linalg.norm(apply(T[name],np.stack([c['z']['camera_poses'][0][c['index'][k],:3,3] for k in shared]))
                       -apply(P,np.stack([p['z']['camera_poses'][0][p['index'][k],:3,3] for k in shared])),axis=1)
    report[name]={'anchor':c['parent'],'shared_frames':len(shared),'residual_median':float(np.median(r)),'scale':float(s),'camera_gap_median':float(np.median(cam))}
    return T[name]
for c in plan['chunks']:place(c['name'])

def owner(k):
    for o in plan['owners']:
        if o['video']==k[0] and o['from']<=k[1]<o['to']:return o['chunk']
allv=list(videos)
for c in plan['chunks']:
    for n in json.loads((args.chunks/c['name']/'run_metadata.json').read_text())['source']:
        if n not in allv:allv.append(n)
out={k:[base[k][0][i] for i in range(len(base['times']))] for k in ['points','local_points','conf','camera_poses']}
out['rgb']=list(base['rgb']);times=list(base['times']);sources=list(base['sources']);chunk=list(base['chunks']) if 'chunks' in base else ['base']*len(times)
added={}
for c in plan['chunks']:
    name=c['name'];z=C[name]['z'];s,R,t=T[name]
    for i,k in enumerate(C[name]['keys']):
        if owner(k)!=name:continue
        out['points'].append(apply(T[name],z['points'][0][i]));out['local_points'].append(s*z['local_points'][0][i]);out['conf'].append(z['conf'][0][i])
        pose=z['camera_poses'][0][i].copy();pose[:3,:3]=R@pose[:3,:3];pose[:3,3]=apply(T[name],pose[:3,3]);out['camera_poses'].append(pose)
        out['rgb'].append(z['rgb'][i]);times.append(k[1]);sources.append(allv.index(k[0]));chunk.append(name);added[name]=added.get(name,0)+1
arrays={k:np.stack(v)[None] for k,v in out.items() if k!='rgb'};arrays['rgb']=np.stack(out['rgb'])
arrays.update(times=np.array(times),sources=np.array(sources),chunks=np.array(chunk))
np.savez_compressed(OUT/'reconstruction.npz',**arrays)
report['frames_added']=added;report['videos']=allv
(OUT/'stitch_report.json').write_text(json.dumps(report,indent=2));print(json.dumps(report,indent=2))

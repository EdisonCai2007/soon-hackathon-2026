from pathlib import Path
import argparse,shutil
parser=argparse.ArgumentParser(description='Join training datasets in the same coordinates into one, leaving out the frames each one held out, so they still score a fine-tune fairly.')
parser.add_argument('--dataset',type=Path,action='append',required=True,help='splat_dataset folders; repeat.')
parser.add_argument('--held-out-every',type=int,default=8,help='The split the datasets were trained with: every n-th frame, by name, stays out.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
sparse=args.output/'sparse/0';images=args.output/'images';sparse.mkdir(parents=True,exist_ok=True);images.mkdir(parents=True,exist_ok=True)
cams=[];ims=[];pts=[];n=0;p=0
for k,d in enumerate(args.dataset):
    cam={l.split()[0]:l.split()[1:] for l in (d/'sparse/0/cameras.txt').read_text().splitlines() if l and not l.startswith('#')}
    rows=[l.split() for l in (d/'sparse/0/images.txt').read_text().splitlines() if l.strip() and not l.startswith('#')]
    rows.sort(key=lambda r:r[9])
    for j,r in enumerate(rows):
        if j%args.held_out_every==0:continue
        n+=1;name=f'{k}_{r[9]}';shutil.copy(d/'images'/r[9],images/name)
        cams.append(f'{n} '+' '.join(cam[r[8]])+'\n');ims.append(f'{n} '+' '.join(r[1:8])+f' {n} {name}\n\n')
    for l in (d/'sparse/0/points3D.txt').read_text().splitlines():
        if l and not l.startswith('#'):p+=1;pts.append(f'{p} '+' '.join(l.split()[1:])+'\n')
(sparse/'cameras.txt').write_text(''.join(cams));(sparse/'images.txt').write_text(''.join(ims));(sparse/'points3D.txt').write_text(''.join(pts))
print(f'{n} training frames, {p} points')

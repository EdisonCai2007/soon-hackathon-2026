from pathlib import Path
import json,argparse,re
import numpy as np
from scipy.ndimage import binary_dilation
from scipy.spatial import cKDTree
from scipy.special import expit
from plyfile import PlyData,PlyElement
parser=argparse.ArgumentParser(description='Delete splats floating at head height between a hall\'s walls. Walls stack many splats on one spot of floor; air between them does not.')
parser.add_argument('--source',type=Path,required=True)
parser.add_argument('--from-index',type=int,default=0,help='Only splats from this index on are candidates, such as a swapped-in hall after the kept scan.')
parser.add_argument('--scene',type=Path,required=True,help='The exported scene.json: viewer transform and the walk\'s cameras.')
parser.add_argument('--cameras',default='Stairs video',help='Name prefix of the walk\'s cameras; their eye height sets head height.')
parser.add_argument('--until',type=float,default=94,help='Walk cameras up to this second, the bottom of the stairs.')
parser.add_argument('--band',default='-0.35,0.45',help='Head height, relative to the nearest walk camera\'s eye: below it is the handrail, above it the ceiling light.')
parser.add_argument('--cell',type=float,default=.05)
parser.add_argument('--wall',type=float,default=40,help='Opacity-weighted splats in a floor cell, at head height, that make it a wall.')
parser.add_argument('--keep-near',type=int,default=2,help='Cells next to a wall stay: its edge, door frames, switches.')
parser.add_argument('--picture',type=Path,help='Top view: walls black, removed air red.')
parser.add_argument('--output',type=Path,required=True)
args=parser.parse_args()
s=json.loads(args.scene.read_text());A=np.array(s['rotation']);b=np.array(s['translation'])
cams=[c for c in s['cameras'] if c['name'].startswith(args.cameras) and float(re.search(r'([\d.]+)s',c['name'][len(args.cameras):]).group(1))<=args.until]
eye=np.array([c['eye'] for c in cams]);lo_b,hi_b=map(float,args.band.split(','))
d=PlyData.read(str(args.source))['vertex'].data;V=np.stack([d[k] for k in 'xyz'],-1).astype(np.float64)@A.T+b
cand=np.zeros(len(d),bool);cand[args.from_index:]=True
_,near=cKDTree(eye[:,[0,2]]).query(V[:,[0,2]]);h=V[:,1]-eye[near,1]
head=(h>lo_b)&(h<hi_b);band=cand&head
# Walls in the top view: floor cells where head-height splats pile up, counting every splat, so a wall the room
# behind it also shows counts in full.
key=np.floor(V[:,[0,2]]/args.cell).astype(np.int64);k0=key[band].min(0);k=key-k0
shape=key[band].max(0)-k0+1;grid=np.zeros(shape)
inb=head&np.all((k>=0)&(k<shape),1);np.add.at(grid,(k[inb,0],k[inb,1]),expit(d['opacity'][inb]))
inb&=cand
wall=binary_dilation(grid>=args.wall,iterations=args.keep_near)
on_wall=np.zeros(len(d),bool);on_wall[inb]=wall[k[inb,0],k[inb,1]]
air=band&~on_wall
if args.picture:
    import cv2
    img=np.full((shape[1],shape[0],3),255,np.uint8);img[grid.T>0]=(200,200,200);img[wall.T]=(0,0,0)
    ka=k[air];img[ka[:,1],ka[:,0]]=(0,0,230);cv2.imwrite(str(args.picture),cv2.resize(img,None,fx=3,fy=3,interpolation=cv2.INTER_NEAREST))
PlyData([PlyElement.describe(d[~air].copy(),'vertex')],text=False).write(str(args.output))
print(json.dumps({'candidates':int(cand.sum()),'head_height':int(band.sum()),'wall_cells':int((grid>=args.wall).sum()),'air_removed':int(air.sum()),'kept':int((~air).sum())}))

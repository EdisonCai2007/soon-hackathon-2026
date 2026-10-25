# People and pets (or other clutter) per frame, from COCO Mask R-CNN on the full frame, cached by (video, seconds).
import argparse,json
from pathlib import Path
import cv2,numpy as np,torch,torchvision
ap=argparse.ArgumentParser(description='Mask people in chosen frames before training.')
ap.add_argument('--video',type=Path,action='append',required=True)
ap.add_argument('--times',action='append',required=True,help='Comma-separated seconds, one per --video.')
ap.add_argument('--name',action='append',required=True,help='Key for each video in the output, such as 1258.')
ap.add_argument('--output',type=Path,required=True,help='npz of masks at 672 x 392, keyed name:seconds; existing keys are kept.')
ap.add_argument('--threads',type=int,default=3)
ap.add_argument('--labels',default='1,17,18',help='COCO category ids to mask: people and pets by default; add chairs (62), tables (67), laptops (73) and the like to clear a cluttered room.')
a=ap.parse_args()
torch.set_num_threads(a.threads)
out=dict(np.load(a.output)) if a.output.exists() else {}
model=torchvision.models.detection.maskrcnn_resnet50_fpn_v2(weights='DEFAULT').eval()
report={}
for video,listed,name in zip(a.video,a.times,a.name):
    cap=cv2.VideoCapture(str(video))
    for sec in [float(t) for t in listed.split(',')]:
        key=f'{name}:{sec:g}'
        if key in out:continue
        cap.set(cv2.CAP_PROP_POS_MSEC,sec*1000);ok,bgr=cap.read();assert ok,key
        bgr=cv2.resize(bgr,(1344,784),interpolation=cv2.INTER_AREA)
        with torch.inference_mode():r=model([torch.from_numpy(bgr[...,::-1].copy()).permute(2,0,1).float()/255])[0]
        keep=(r['scores']>.35)&torch.isin(r['labels'],torch.tensor([int(x) for x in a.labels.split(',')]))
        m=(r['masks'][keep,0]>.35).any(0).numpy() if keep.any() else np.zeros(bgr.shape[:2],bool)
        # Generous margin: a person's edge or shadow left in trains as a ghost.
        m=cv2.dilate(m.astype(np.uint8),np.ones((31,31),np.uint8))>0
        out[key]=cv2.resize(m.astype(np.uint8),(672,392),interpolation=cv2.INTER_NEAREST)>0
        report[key]=round(float(out[key].mean()),4)
        if report[key]:print(key,f'{report[key]:.1%}',flush=True)
    np.savez_compressed(a.output,**out)
print(json.dumps({'frames':len(out),'with_people':int(sum(v.any() for v in out.values()))}))

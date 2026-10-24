# Pick the sharpest frame in each window of a walkthrough video.
import argparse,json
import cv2,numpy as np
ap=argparse.ArgumentParser(description='Choose sharp, evenly spaced frames from a video.')
ap.add_argument('--video',required=True);ap.add_argument('--window',type=float,default=2.0)
ap.add_argument('--step',type=float,default=0.2);ap.add_argument('--out',required=True)
a=ap.parse_args()
cap=cv2.VideoCapture(a.video);fps=cap.get(cv2.CAP_PROP_FPS);n=int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
every=max(1,round(fps*a.step));scores=[]
for i in range(n):
    if not cap.grab():break
    if i%every:continue
    ok,bgr=cap.retrieve()
    g=cv2.cvtColor(cv2.resize(bgr,(640,360),interpolation=cv2.INTER_AREA),cv2.COLOR_BGR2GRAY)
    scores.append((i/fps,float(cv2.Laplacian(g,cv2.CV_64F).var())))
cap.release()
picked=[]
for w in np.arange(0,scores[-1][0],a.window):
    c=[s for s in scores if w<=s[0]<w+a.window]
    if c:picked.append(max(c,key=lambda s:s[1]))
json.dump({'times':[round(t,3) for t,_ in picked],'sharpness':[round(s,1) for _,s in picked]},open(a.out,'w'),indent=1)
print(len(picked),'frames; median sharpness',np.median([s for _,s in picked]))

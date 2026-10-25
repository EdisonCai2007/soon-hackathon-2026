# Even out party lighting in a training dataset: white-balance each frame and hide coloured light spots.
import argparse,json
from pathlib import Path
import cv2,numpy as np
ap=argparse.ArgumentParser(description='Rewrite a splat_dataset\'s images in place: neutral white balance and steady exposure per frame, and disco-light spots made transparent so other views fill them.')
ap.add_argument('--images',type=Path,required=True,help='splat_dataset/images, RGBA PNGs from prepare_floor.py.')
ap.add_argument('--spot',type=float,default=.16,help='Saturation above the surrounding surface that makes a pixel a light spot.')
ap.add_argument('--drain',type=float,default=.3,help='Colour kept on near-white surfaces, 0 to 1.')
ap.add_argument('--target',type=float,default=.82,help='Brightness of the room\'s white surfaces after the exposure gain.')
ap.add_argument('--review',type=Path,help='Folder for before/after pictures, spots tinted red.')
a=ap.parse_args()

def calm(bgr,alpha):
    f=bgr.astype(np.float32)/255;ok=alpha>127
    # White patch: the brightest, least coloured surfaces are the white walls and ceiling.
    hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV);s,v=hsv[...,1],hsv[...,2]
    ref=ok&(v>np.quantile(v[ok],.6))&(s<np.quantile(s[ok],.5))
    white=np.median(f[ref],0) if ref.sum()>500 else f[ok].mean(0)
    f=f*np.clip(white.mean()/np.maximum(white,1e-3),.5,2.2)
    f=np.clip(f*np.clip(a.target/max(np.quantile(f[ok].max(-1),.9),1e-3),.6,2.5),0,1)
    # The light's tint lingers on white walls as a faint wash: drain colour from faintly coloured
    # pixels and leave strongly coloured ones (banners, wood) as they are.
    s=cv2.cvtColor(f,cv2.COLOR_BGR2HSV)[...,1];keep=np.clip((s-.15)/.25,0,1)[...,None]*(1-a.drain)+a.drain
    g=f.mean(-1,keepdims=True);f=g+(f-g)*keep
    # Spots: small patches more saturated than the surface around them and no darker. Banners are
    # large, so the surrounding median follows them; balloons, ribbons and wood are darker than
    # the wall behind them, and warm lamplight through a doorway is orange, which the lights never are.
    hsv=cv2.cvtColor(f,cv2.COLOR_BGR2HSV);h,s,v=hsv[...,0],hsv[...,1],hsv[...,2]
    around=lambda c:cv2.resize(cv2.medianBlur(cv2.resize((c*255).astype(np.uint8),None,fx=.25,fy=.25),31),c.shape[::-1])/255
    spot=(s-around(s)>a.spot)&(v>.25)&(v>=around(v)-.03)&~((h>=15)&(h<=60))
    spot=cv2.dilate(cv2.morphologyEx(spot.astype(np.uint8),cv2.MORPH_OPEN,np.ones((2,2),np.uint8)),np.ones((7,7),np.uint8))>0
    return (f*255).astype(np.uint8),spot

report=[]
for p in sorted(a.images.glob('*.png')):
    im=cv2.imread(str(p),cv2.IMREAD_UNCHANGED);bgr,alpha=im[...,:3],im[...,3]
    out,spot=calm(bgr,alpha);alpha=np.where(spot,0,alpha).astype(np.uint8)
    cv2.imwrite(str(p),np.dstack([out,alpha]));report.append(float(spot.mean()))
    if a.review:
        a.review.mkdir(parents=True,exist_ok=True);t=out.copy();t[spot]=t[spot]//2+[0,0,127]
        cv2.imwrite(str(a.review/(p.stem+'.jpg')),np.hstack([bgr,out,t]))
print(json.dumps({'images':len(report),'spot_share_median':round(float(np.median(report)),4),'spot_share_max':round(max(report),4)}))

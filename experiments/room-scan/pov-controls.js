import {Euler,Vector3} from './vendor/three.module.js';

/** Free camera: rotation never changes position or orbits a target. */
export class PovControls {
 constructor(camera,element,{keyboardTarget=globalThis.window,speed=.85}={}){
  this.camera=camera;this.element=element;this.speed=speed;this.keys=new Set();
  this.euler=new Euler(0,0,0,'YXZ');this.motion=new Vector3();this.listeners=[];
  this.pointer=null;this.sync();element.tabIndex=0;element.style&&(element.style.cursor='grab');
  const on=(target,name,fn,options)=>{if(!target)return;target.addEventListener(name,fn,options);this.listeners.push(()=>target.removeEventListener(name,fn,options));};
  const movement=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ShiftLeft','ShiftRight']);
  const clear=()=>{this.keys.clear();this.pointer=null;if(element.style)element.style.cursor='grab';};
  on(keyboardTarget,'keydown',e=>{
   if(e.defaultPrevented||e.metaKey||e.ctrlKey||e.altKey||e.target?.closest?.('input,select,textarea,button,[contenteditable="true"]'))return;
   if(movement.has(e.code)){e.preventDefault();this.keys.add(e.code);}
  });
  on(keyboardTarget,'keyup',e=>this.keys.delete(e.code));
  on(keyboardTarget,'blur',clear);on(element,'blur',clear);
  on(element.ownerDocument,'visibilitychange',clear);
  on(element,'pointerdown',e=>{
   if(e.button!==0)return;
   element.focus({preventScroll:true});element.setPointerCapture?.(e.pointerId);
   this.pointer={id:e.pointerId,x:e.clientX,y:e.clientY};if(element.style)element.style.cursor='grabbing';
  });
  on(element,'pointermove',e=>{
   const p=this.pointer;if(!p||p.id!==e.pointerId)return;
   this.look(e.clientX-p.x,e.clientY-p.y);p.x=e.clientX;p.y=e.clientY;
  });
  const release=()=>{this.pointer=null;if(element.style)element.style.cursor='grab';};
  on(element,'pointerup',release);on(element,'pointercancel',release);on(element,'lostpointercapture',release);
  on(element,'wheel',e=>{
   e.preventDefault();const unit=e.deltaMode===1?16:e.deltaMode===2?element.clientHeight:1;
   const distance=-Math.max(-100,Math.min(100,e.deltaY*unit))*.002;
   camera.getWorldDirection(this.motion);camera.position.addScaledVector(this.motion,distance);
  },{passive:false});
  on(element,'contextmenu',e=>e.preventDefault());
 }
 sync(){
  this.euler.setFromQuaternion(this.camera.quaternion,'YXZ');
  this.yaw=this.euler.y;this.pitch=Math.max(-Math.PI/2+.015,Math.min(Math.PI/2-.015,this.euler.x));
  this.keys.clear();
 }
 look(dx,dy){
  this.yaw-=dx*.0025;this.pitch=Math.max(-Math.PI/2+.015,Math.min(Math.PI/2-.015,this.pitch-dy*.0025));
  this.camera.quaternion.setFromEuler(this.euler.set(this.pitch,this.yaw,0,'YXZ'));
 }
 update(dt){
  const k=this.keys,forward=Number(k.has('KeyW'))-Number(k.has('KeyS'));
  const side=Number(k.has('KeyD'))-Number(k.has('KeyA')),vertical=Number(k.has('KeyE'))-Number(k.has('KeyQ'));
  this.motion.set(-Math.sin(this.yaw)*forward+Math.cos(this.yaw)*side,vertical,-Math.cos(this.yaw)*forward-Math.sin(this.yaw)*side);
  if(this.motion.lengthSq()>0){
   const boost=k.has('ShiftLeft')||k.has('ShiftRight')?3:1;
   this.camera.position.addScaledVector(this.motion.normalize(),this.speed*boost*Math.max(0,Math.min(dt,.1)));
  }
 }
 dispose(){this.keys.clear();this.listeners.forEach(off=>off());this.listeners=[];}
}

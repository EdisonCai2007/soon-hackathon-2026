import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from './vendor/three.module.js';
let PovControls;
try { ({PovControls}=await import('./pov-controls.js')); } catch {}
test('first-person controller is available',()=>assert.equal(typeof PovControls,'function'));
const setup=()=>{
 const camera=new THREE.PerspectiveCamera();camera.position.set(2,3,4);camera.lookAt(2,3,3);
 const canvas=new EventTarget();canvas.focus=()=>{};
 const keyboard=new EventTarget();
 const controls=new PovControls(camera,canvas,{keyboardTarget:keyboard,speed:1});
 const key=(type,code)=>{const e=new Event(type,{cancelable:true});Object.assign(e,{code});keyboard.dispatchEvent(e);};
 return {camera,canvas,keyboard,controls,key};
};
test('looking changes direction without moving the camera',()=>{
 const {camera,controls}=setup();const p=camera.position.clone(),q=camera.quaternion.clone();
 controls.look(160,-60);assert.ok(camera.position.equals(p));assert.ok(camera.quaternion.angleTo(q)>.1);
 controls.dispose();
});
test('W moves forward horizontally and S reverses it',()=>{
 const {camera,controls,key}=setup();key('keydown','KeyW');controls.update(.1);key('keyup','KeyW');
 assert.ok(Math.abs(camera.position.z-3.9)<1e-6);assert.equal(camera.position.y,3);
 key('keydown','KeyS');controls.update(.1);assert.ok(Math.abs(camera.position.z-4)<1e-6);controls.dispose();
});
test('A/D strafe and Q/E move down/up',()=>{
 const {camera,controls,key}=setup();key('keydown','KeyD');controls.update(.1);key('keyup','KeyD');
 assert.ok(Math.abs(camera.position.x-2.1)<1e-6);
 key('keydown','KeyA');controls.update(.1);key('keyup','KeyA');assert.ok(Math.abs(camera.position.x-2)<1e-6);
 key('keydown','KeyQ');controls.update(.1);key('keyup','KeyQ');assert.ok(Math.abs(camera.position.y-2.9)<1e-6);
 key('keydown','KeyE');controls.update(.1);assert.ok(Math.abs(camera.position.y-3)<1e-6);controls.dispose();
});
test('diagonal motion is normalized and blur stops movement',()=>{
 const {camera,controls,key,keyboard}=setup();const p=camera.position.clone();
 key('keydown','KeyW');key('keydown','KeyD');controls.update(.1);assert.ok(Math.abs(camera.position.distanceTo(p)-.1)<1e-6);
 keyboard.dispatchEvent(new Event('blur'));const stopped=camera.position.clone();controls.update(.1);
 assert.ok(camera.position.equals(stopped));controls.dispose();
});
test('form focus and command shortcuts do not move the camera',()=>{
 const {camera,controls,keyboard}=setup();const p=camera.position.clone();
 const shortcut=new Event('keydown');Object.assign(shortcut,{code:'KeyW',metaKey:true});keyboard.dispatchEvent(shortcut);
 const field=new EventTarget();field.closest=()=>true;
 const input=new Event('keydown');Object.assign(input,{code:'KeyE'});Object.defineProperty(input,'target',{value:field});keyboard.dispatchEvent(input);
 controls.update(.1);assert.ok(camera.position.equals(p));controls.dispose();
});

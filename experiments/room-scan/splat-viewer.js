import * as THREE from 'three';
import {PovControls} from './pov-controls.js';
import {SparkRenderer,SplatMesh,SplatEdit,SplatEditSdf,SplatEditSdfType} from './vendor/spark.module.js';

const $=s=>document.querySelector(s);
const status=$('#status');
try {
 const renderer=new THREE.WebGLRenderer({antialias:false,powerPreference:'high-performance'});
 renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));renderer.setSize(innerWidth,innerHeight);
 renderer.setClearColor('#10151c');renderer.outputColorSpace=THREE.SRGBColorSpace;
 renderer.localClippingEnabled=true;
 $('#viewport').appendChild(renderer.domElement);
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.03,100);
 const controls=new PovControls(camera,renderer.domElement);
 const spark=new SparkRenderer({renderer});scene.add(spark);
 const response=await fetch('splat_scene.json');if(!response.ok)throw Error('The fitted scan is unavailable. Reload to try again.');
 const meta=await response.json();
 const splats=new SplatMesh({url:'room_splats.ply',onProgress:e=>{if(e.total)status.textContent=`Loading Gaussian splats… ${Math.round(e.loaded/e.total*100)}%`;}});
 const A=meta.rotation;
 const rotation=new THREE.Matrix4().set(A[0][0],A[0][1],A[0][2],0,A[1][0],A[1][1],A[1][2],0,A[2][0],A[2][1],A[2][2],0,0,0,0,1);
 splats.quaternion.setFromRotationMatrix(rotation);splats.position.fromArray(meta.translation);scene.add(splats);
 await splats.initialized;
 const cutEdit=new SplatEdit({name:'Ceiling cutaway',softEdge:.015});
 const cutPlane=new SplatEditSdf({type:SplatEditSdfType.PLANE,opacity:0});
 cutPlane.rotation.x=Math.PI/2;cutPlane.position.y=meta.cutHeight;cutEdit.add(cutPlane);scene.add(cutEdit);
 const height=$('#height'),ceiling=$('#ceiling');
 const bounds=meta.bounds,center=new THREE.Vector3().fromArray(bounds[0]).add(new THREE.Vector3().fromArray(bounds[1])).multiplyScalar(.5);
 const extent=Math.max(bounds[1][0]-bounds[0][0],bounds[1][2]-bounds[0][2]);
 height.value=Math.round((meta.cutHeight-bounds[0][1])/(bounds[1][1]-bounds[0][1])*100);
 let pointCloud=null,pointMaterial=null,currentMode='splats';
 function clipping(){
  const y=bounds[0][1]+Number(height.value)/100*(bounds[1][1]-bounds[0][1]);
  cutPlane.position.y=y;cutEdit.visible=ceiling.checked;cutEdit.updateMatrixWorld(true);
  height.disabled=!ceiling.checked;
  if(pointMaterial){pointMaterial.clippingPlanes=ceiling.checked?[new THREE.Plane(new THREE.Vector3(0,-1,0),y)]:[];pointMaterial.needsUpdate=true;}
 }
 height.oninput=clipping;ceiling.onchange=clipping;
 function snap(index){const v=meta.cameras[index];$('#view').value=String(index);camera.fov=v.fov_y??55;camera.updateProjectionMatrix();camera.up.fromArray(v.up);camera.position.fromArray(v.eye);camera.lookAt(new THREE.Vector3().fromArray(v.target));controls.sync();}
 function room(){ceiling.checked=false;clipping();snap(0);}
 function overview(){ceiling.checked=true;clipping();camera.fov=55;camera.updateProjectionMatrix();camera.up.set(0,1,0);const target=center.clone();target.y=(bounds[0][1]+meta.cutHeight)/2;camera.position.copy(target).add(new THREE.Vector3(-.68,.72,.86).multiplyScalar(extent));camera.lookAt(target);controls.sync();}
 function top(){ceiling.checked=true;clipping();camera.fov=55;camera.updateProjectionMatrix();camera.up.set(0,0,-1);camera.position.copy(center).add(new THREE.Vector3(0,extent*1.6,.001));camera.lookAt(center);controls.sync();}
 $('#reset').onclick=room;$('#overview').onclick=overview;$('#top').onclick=top;
 const viewSelect=$('#view');
 meta.cameras.forEach((v,i)=>{const option=document.createElement('option');option.value=i;option.textContent=v.name;viewSelect.appendChild(option);});
 viewSelect.onchange=()=>{ceiling.checked=false;clipping();snap(Number(viewSelect.value));};
 $('#mode').onchange=async e=>{
  const mode=e.target.value;e.target.disabled=true;
  try{
   if(mode==='points'&&!pointCloud){
    const rs=await Promise.all(['baseline_positions.bin','baseline_colors.bin'].map(p=>fetch(p)));
    if(rs.some(r=>!r.ok))throw Error('The original point cloud could not be loaded.');
    const buffers=await Promise.all(rs.map(r=>r.arrayBuffer()));
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(buffers[0]),3));g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(buffers[1]),3));
    pointMaterial=new THREE.PointsMaterial({size:.025,vertexColors:true});
    pointMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif(distance(gl_PointCoord,vec2(0.5))>0.5) discard;');};
    pointCloud=new THREE.Points(g,pointMaterial);scene.add(pointCloud);
   }
   currentMode=mode;splats.visible=mode==='splats';spark.visible=mode==='splats';if(pointCloud)pointCloud.visible=mode==='points';
   clipping();$('#facts').textContent=mode==='splats'?`${meta.views} video views · ${meta.splats.toLocaleString()} fitted Gaussian splats`:'Original point-cloud reconstruction';
  }catch(error){status.hidden=false;status.textContent=error.message;e.target.value=currentMode;}
  finally{e.target.disabled=false;}
 };
 $('#facts').textContent=`${meta.views} video views · ${meta.splats.toLocaleString()} fitted Gaussian splats`;
 let previousTime=null;
 renderer.setAnimationLoop(time=>{const dt=previousTime===null?0:(time-previousTime)/1000;previousTime=time;controls.update(dt);renderer.render(scene,camera);});
 addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();status.hidden=false;status.textContent='The 3D view paused. Reload to restore the room.';});
 room();status.hidden=true;
 window.roomViewer={scene,camera,renderer,controls,splats,spark,meta};
}catch(error){console.error(error);status.hidden=false;status.textContent=`Couldn’t open the room. ${error.message}`;}

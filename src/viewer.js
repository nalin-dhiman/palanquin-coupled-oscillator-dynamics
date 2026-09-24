import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {viewParameters} from './simulation.js';
import {quaternion} from './walking.js';
const COLORS=['#376574','#b46f37','#398074','#80628e'];
export class Viewer {
 constructor(element){
  this.element=element;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#edf1eb');this.scene.up.set(0,0,1);
  this.camera=new THREE.PerspectiveCamera(34,1,.01,100);this.camera.up.set(0,0,1);
  this.renderer=new THREE.WebGLRenderer({antialias:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;element.appendChild(this.renderer.domElement);
  this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=1.4;this.controls.maxDistance=40;
  this.scene.add(new THREE.AmbientLight(0xffffff,1.6));
  for(const [color,intensity,pos] of [[0xfff4df,3,[4,-5,7]],[0xe6efff,1.8,[-4,3,4]]]){const light=new THREE.DirectionalLight(color,intensity);light.position.set(...pos);this.scene.add(light);}
  this.pose=new THREE.Group();this.pose.name='DisplayedPose';this.scene.add(this.pose);
  this.visual=new THREE.Group();this.pose.add(this.visual);this.model=new THREE.Group();this.pose.add(this.model);
  const box=new THREE.BoxGeometry(1,1,1);this.block=new THREE.Mesh(box,new THREE.MeshStandardMaterial({color:'#759da0',roughness:.7,transparent:true,opacity:.65}));this.model.add(this.block);
  this.com=new THREE.Mesh(new THREE.SphereGeometry(.025,16,12),new THREE.MeshStandardMaterial({color:'#b04e42'}));this.model.add(this.com);
  this.neutral=new THREE.LineSegments(new THREE.EdgesGeometry(box),new THREE.LineBasicMaterial({color:'#a2afa5',transparent:true,opacity:.6}));this.scene.add(this.neutral);
  this.points=[];this.refs=[];this.arrows=[];
  for(let i=0;i<4;i++){
   const sphere=new THREE.Mesh(new THREE.SphereGeometry(.026,16,12),new THREE.MeshStandardMaterial({color:COLORS[i]}));this.model.add(sphere);this.points.push(sphere);
   const ref=new THREE.Mesh(new THREE.CylinderGeometry(.012,.012,.22,16),new THREE.MeshStandardMaterial({color:COLORS[i]}));ref.rotation.z=Math.PI/2;this.scene.add(ref);this.refs.push(ref);
   const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),.2,new THREE.Color(COLORS[i]).getHex(),.04,.025);this.scene.add(arrow);this.arrows.push(arrow);
  }
  this.mode='rath';this.setMode('rath');this.setCamera('three-quarter',1.5);
  this.ready=new GLTFLoader().loadAsync('./assets/rath.glb').then(g=>{this.gltf=g;this.asset=g.scene;this.asset.rotation.x=Math.PI/2;this.visual.add(this.asset);document.querySelector('#asset-status').textContent='';return g;}).catch(error=>{document.querySelector('#asset-status').textContent='Rath illustration unavailable. Use the contact model view.';this.setMode('model');throw error;});
  new ResizeObserver(()=>this.resize()).observe(element);this.resize();
 }
 resize(){const w=this.element.clientWidth,h=this.element.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.cameraMode)this.setCamera(this.cameraMode,this.referenceZ);}
 setCamera(mode,z=1.5){
  this.cameraMode=mode;this.referenceZ=z;const p=this.params??{a:.5,l:.75,h:.15};
  const bounds=this.mode==='rath'?{half:new THREE.Vector3(1.65,.43,.7),center:z+.35}:{half:new THREE.Vector3(Math.max(.5,p.l+.15),p.a+.2,Math.max(.55,Math.abs(p.h)+.35)),center:z-p.h/2};
  const target=new THREE.Vector3(0,0,bounds.center),dirs={'three-quarter':[5.2,-6.8,3.4],front:[1,0,.07],side:[0,-1,.07],top:[.0001,0,1]},dir=new THREE.Vector3(...(dirs[mode]??dirs['three-quarter'])).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize();const tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));let distance=1;
  for(const x of [-1,1])for(const y of [-1,1])for(const zsign of [-1,1]){const corner=new THREE.Vector3(x*bounds.half.x,y*bounds.half.y,zsign*bounds.half.z),depth=corner.dot(dir);distance=Math.max(distance,depth+Math.abs(corner.dot(up))/tan,depth+Math.abs(corner.dot(right))/(tan*this.camera.aspect));}
  this.camera.position.copy(target).addScaledVector(dir,distance*1.22);this.controls.target.copy(target);this.controls.update();
 }
 setMode(mode){this.mode=mode;this.visual.visible=mode==='rath';this.model.visible=mode==='model';this.neutral.visible=mode==='model';for(const o of [...this.refs,...this.arrows])o.visible=mode==='model';if(this.cameraMode)this.setCamera(this.cameraMode,this.referenceZ);}
 update(sample,config,{gain=1}={}){
  const p=viewParameters(config);this.params=p;this.gain=gain;this.sample=sample;
  const q=gain===1?sample.quaternion:quaternion(sample.roll*gain,(sample.pitch??0)*gain);
  this.pose.position.set(0,0,p.z0+gain*(sample.z-p.z0));this.pose.quaternion.set(q[1],q[2],q[3],q[0]);
  this.block.scale.set(p.walking?2*p.l+.1:.55,2*p.a+.1,.3);this.neutral.scale.copy(this.block.scale);this.neutral.position.set(0,0,p.z0);
  const count=p.walking&&!p.collapsed?4:2;
  const base=p.walking?p.z0-p.h+config.parameters.mass*config.parameters.gravity/(4*config.parameters.stiffness):p.z0-p.h+config.parameters.mass_kg*config.parameters.gravity_m_s2/(2*config.parameters.stiffness_N_m);
  for(let i=0;i<4;i++){
   const shown=i<count;this.points[i].visible=shown;this.refs[i].visible=shown&&this.mode==='model';this.arrows[i].visible=false;if(!shown)continue;
   const x=count===4?(i<2?p.l:-p.l):0,y=(i%2?-1:1)*-p.a;
   this.points[i].position.set(x,y,-p.h);
   const contact=new THREE.Vector3(x,y,-p.h).applyQuaternion(this.pose.quaternion).add(this.pose.position);
   this.refs[i].position.set(contact.x,contact.y,base+gain*(sample.support[i]-base));
   const force=p.collapsed?sample.force[i]+sample.force[i+2]:sample.force[i];
   this.points[i].material.color.set(force>1e-9?COLORS[i]:'#bd4545');
   const length=Math.max(.001,force*.00075);this.arrows[i].position.set(contact.x,contact.y,contact.z-length);this.arrows[i].setLength(length,Math.min(.045,length*.25),Math.min(.025,length*.15));this.arrows[i].visible=this.mode==='model'&&force>1e-9;
  }
  this.pose.updateMatrixWorld(true);
 }
 render(){this.controls.update();this.renderer.render(this.scene,this.camera);}
}

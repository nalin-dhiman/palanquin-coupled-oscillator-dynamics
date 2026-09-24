import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
export class Viewer {
 constructor(element) {
  this.element=element;this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#edf1eb');this.scene.up.set(0,0,1);
  this.camera=new THREE.PerspectiveCamera(34,1,.01,100);this.camera.up.set(0,0,1);
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.25;
  element.appendChild(this.renderer.domElement);this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.minDistance=1.4;this.controls.maxDistance=14;
  this.scene.add(new THREE.AmbientLight(0xffffff,1.6));const key=new THREE.DirectionalLight(0xfff4df,3);key.position.set(4,-5,7);this.scene.add(key);const fill=new THREE.DirectionalLight(0xe6efff,1.8);fill.position.set(-4,3,4);this.scene.add(fill);
  this.pose=new THREE.Group();this.pose.name='NumericalPose';this.scene.add(this.pose);this.visual=new THREE.Group();this.pose.add(this.visual);
  this.model=new THREE.Group();this.pose.add(this.model);this.block=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial({color:'#759da0',roughness:.7,metalness:0}));this.model.add(this.block);
  this.points=[];this.refs=[];this.arrows=[];
  for(let i=0;i<2;i++){const color=i===0?'#376574':'#b46f37';const sphere=new THREE.Mesh(new THREE.SphereGeometry(.022,16,12),new THREE.MeshStandardMaterial({color:'#263e3b'}));this.model.add(sphere);this.points.push(sphere);
   const ref=new THREE.Mesh(new THREE.CylinderGeometry(.009,.009,.65,20),new THREE.MeshStandardMaterial({color}));ref.rotation.z=Math.PI/2;this.scene.add(ref);this.refs.push(ref);
   const arrow=new THREE.ArrowHelper(new THREE.Vector3(0,0,1),new THREE.Vector3(),.2,new THREE.Color(color).getHex(),.04,.025);this.scene.add(arrow);this.arrows.push(arrow);}
  this.mode='rath';this.setMode('rath');this.setCamera('three-quarter',1.5);
  this.ready=new GLTFLoader().loadAsync('./assets/rath.glb').then(g=>{this.gltf=g;this.asset=g.scene;this.asset.rotation.x=Math.PI/2;this.visual.add(this.asset);document.querySelector('#asset-status').textContent='';return g;}).catch(e=>{document.querySelector('#asset-status').textContent='Rath asset unavailable. The analytical view and solver still work.';this.setMode('model');throw e;});
  new ResizeObserver(()=>this.resize()).observe(element);this.resize();
 }
 resize(){const w=this.element.clientWidth,h=this.element.clientHeight;this.renderer.setSize(w,h);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();if(this.cameraMode)this.setCamera(this.cameraMode,this.referenceZ);}
 setCamera(mode,z=1.5){
  this.cameraMode=mode;this.referenceZ=z;const p=this.params??{half_span_m:.5,com_height_above_support_m:.15};
  const bounds=this.mode==='rath'?{half:new THREE.Vector3(1.65,.43,.58),center:z+.40}:{half:new THREE.Vector3(.40,p.half_span_m+.10,(p.com_height_above_support_m+.65)/2),center:z+(.15-p.com_height_above_support_m-.50)/2};
  const target=new THREE.Vector3(0,0,bounds.center),dirs={'three-quarter':[5.2,-6.8,3.4],front:[1,0,.07],side:[0,-1,.07],top:[.0001,0,1]},dir=new THREE.Vector3(...dirs[mode]).normalize();
  const right=new THREE.Vector3().crossVectors(new THREE.Vector3(0,0,1),dir).normalize(),up=new THREE.Vector3().crossVectors(dir,right).normalize();const tan=Math.tan(THREE.MathUtils.degToRad(this.camera.fov/2));let distance=1;
  for(const x of [-1,1])for(const y of [-1,1])for(const zsign of [-1,1]){const corner=new THREE.Vector3(x*bounds.half.x,y*bounds.half.y,zsign*bounds.half.z),depth=corner.dot(dir);distance=Math.max(distance,depth+Math.abs(corner.dot(up))/tan,depth+Math.abs(corner.dot(right))/(tan*this.camera.aspect));}
  this.camera.position.copy(target).addScaledVector(dir,distance*1.22);this.controls.target.copy(target);this.controls.update();
 }
 setMode(mode){this.mode=mode;this.visual.visible=mode==='rath';this.model.visible=mode==='model';for(const o of [...this.refs,...this.arrows])o.visible=mode==='model';if(this.cameraMode)this.setCamera(this.cameraMode,this.referenceZ);}
 update(sample,p){this.params=p;this.pose.position.set(0,0,sample.z);this.pose.quaternion.set(sample.quaternion[1],sample.quaternion[2],sample.quaternion[3],sample.quaternion[0]);this.block.scale.set(.55,2*p.half_span_m+.1,.3);
  for(let i=0;i<2;i++){this.points[i].position.set(0,(i===0?-1:1)*p.half_span_m,-p.com_height_above_support_m);this.refs[i].position.set(0,sample.lever[i],sample.support[i]);const len=Math.max(.001,sample.force[i]*.00075);this.arrows[i].position.set(0,sample.lever[i],sample.contact[i]-len);this.arrows[i].setLength(len,Math.min(.045,len*.25),Math.min(.025,len*.15));this.arrows[i].visible=this.mode==='model'&&sample.force[i]>1e-9;}
  this.pose.updateMatrixWorld(true);
 }
 render(){this.controls.update();this.renderer.render(this.scene,this.camera);}
}

// Walking-informed four-contact model. Independent port of python/walking_model.py.
// x forward, y lateral, z up; R = Ry(pitch) Rx(roll); quaternions are w,x,y,z.
// Walking is prescribed shoulder motion, not solved foot-ground or route dynamics.
export const PARAMETERS={mass:40,inertia_roll:8,inertia_pitch:16,inertia_yaw:20,
 half_width:.5,half_length:.75,com_height:.15,stiffness:4000,damping:125,gravity:9.81,z0:1.5};
export const CONTACT_NAMES=['Front left','Front right','Rear left','Rear right'];
const DEG=Math.PI/180;
export function preset(name='G90'){
 const c={schema_version:2,model:'walking',mode:'full',parameters:{...PARAMETERS},
  gait:{step_hz:[2,2],vertical_m:[.02,.02],tilt_rad:[1.5*DEG,1.5*DEG],stride_phase_rad:[0,Math.PI/2],
   phase_mod_rad:[0,0],phase_mod_hz:.25,phase_mod_offset_rad:[0,0],ramp_s:2},
  initial:{roll_rad:0,pitch_rad:0},numerics:{duration_s:120,dt_s:.001,sample_dt_s:.01,analysis_start_s:8}};
 if(['G0','heave','roll'].includes(name))c.gait.stride_phase_rad=[0,0];
 if(['G180','Gstress'].includes(name))c.gait.stride_phase_rad=[0,Math.PI];
 if(name==='Gvar')Object.assign(c.gait,{step_hz:[2,2.04],vertical_m:[.020,.016],tilt_rad:[1.5*DEG,1.2*DEG],phase_mod_rad:[.08,.08],phase_mod_offset_rad:[0,Math.PI/3]});
 if(name==='Gstress')Object.assign(c.gait,{step_hz:[2.33,2.33],vertical_m:[.035,.035],tilt_rad:[3*DEG,3*DEG]});
 if(name==='G90slow')c.gait.step_hz=[1.83,1.83];
 if(name==='G90fast')c.gait.step_hz=[2.33,2.33];
 if(['heave','pitch'].includes(name))c.gait.tilt_rad=[0,0];
 if(name==='roll')c.gait.vertical_m=[0,0];
 return c;
}
export function derived(p){
 const staticForce=p.mass*p.gravity/4,compression=staticForce/p.stiffness;
 const rollStiffness=4*p.stiffness*p.half_width**2-p.mass*p.gravity*p.com_height;
 const pitchStiffness=4*p.stiffness*p.half_length**2-p.mass*p.gravity*p.com_height;
 return {staticForce,staticSideForce:2*staticForce,compression,supportHeight:p.z0-p.com_height+compression,
  rollStiffness,pitchStiffness,heaveFrequency:Math.sqrt(4*p.stiffness/p.mass)/(2*Math.PI),
  rollFrequency:Math.sqrt(rollStiffness/p.inertia_roll)/(2*Math.PI),pitchFrequency:Math.sqrt(pitchStiffness/p.inertia_pitch)/(2*Math.PI)};
}
export function validate(c){
 if(!c||c.schema_version!==2||c.model!=='walking'||!c.parameters||!c.gait||!c.numerics||!c.initial)throw Error('Use a version 2 walking configuration with parameters, gait, initial state and numerics.');
 if(!['full','pitch_locked','collapsed'].includes(c.mode))throw Error('Choose free pitch, locked pitch or two resultants.');
 const {parameters:p,gait:g,numerics:n}=c;
 for(const key of Object.keys(PARAMETERS))if(!Number.isFinite(p[key]))throw Error(`${key} must be a finite number.`);
 for(const key of Object.keys(PARAMETERS).filter(k=>!['damping','com_height'].includes(k)))if(p[key]<=0)throw Error(`${key} must be positive.`);
 if(p.damping<0)throw Error('Damping cannot be negative.');
 if(Math.max(p.inertia_roll,p.inertia_pitch,p.inertia_yaw)*2>p.inertia_roll+p.inertia_pitch+p.inertia_yaw)throw Error('Principal inertias must satisfy the triangle inequality: none can exceed the sum of the other two.');
 const d=derived(p);if(d.rollStiffness<=0||d.pitchStiffness<=0)throw Error('The upright equilibrium is unstable: increase spacing/stiffness or reduce the centre-of-mass offset.');
 if(!Object.values(d).every(Number.isFinite))throw Error('Derived parameters overflow; use finite physical scales.');
 for(const key of ['step_hz','vertical_m','tilt_rad','stride_phase_rad','phase_mod_rad','phase_mod_offset_rad'])if(!Array.isArray(g[key])||g[key].length!==2||!g[key].every(Number.isFinite))throw Error(`${key} needs two finite front/rear values.`);
 if(g.step_hz.some(x=>x<=0||x>5))throw Error('Step cadence must be in (0, 5] steps/s.');
 if(g.vertical_m.some(x=>x<0||x>.1)||g.tilt_rad.some(x=>x<0||x>15*DEG))throw Error('Use shoulder amplitudes up to 100 mm and torso tilt up to 15 degrees. These are explorer limits, not measured human limits.');
 if(!Number.isFinite(g.ramp_s)||g.ramp_s<=0||!Number.isFinite(g.phase_mod_hz)||g.phase_mod_hz<0||g.phase_mod_hz>5)throw Error('Use a positive ramp duration and phase-variation frequency from 0 to 5 Hz.');
 if(g.step_hz.some((f,j)=>Math.PI*f<=2*Math.PI*g.phase_mod_hz*Math.abs(g.phase_mod_rad[j])))throw Error('Phase variation reverses the stride phase. Reduce its amplitude or frequency.');
 for(const key of ['roll_rad','pitch_rad'])if(!Number.isFinite(c.initial[key])||Math.abs(c.initial[key])>30*DEG)throw Error('Initial angles must be within ±30 degrees.');
 if(c.mode!=='full'&&c.initial.pitch_rad!==0)throw Error('A pitch-locked model needs zero initial pitch.');
 for(const key of ['duration_s','dt_s','sample_dt_s','analysis_start_s'])if(!Number.isFinite(n[key]))throw Error(`${key} must be finite.`);
 if(n.duration_s<=0||n.duration_s>180||n.dt_s<.00005||n.dt_s>.002||n.sample_dt_s<n.dt_s||n.sample_dt_s>.1)throw Error('Use up to 180 s, a 0.05–2 ms integration step, and an output interval up to 100 ms.');
 if(n.analysis_start_s<0||n.analysis_start_s>=n.duration_s)throw Error('Analysis must begin before the run ends.');
 for(const v of [n.duration_s/n.dt_s,n.sample_dt_s/n.dt_s,n.duration_s/n.sample_dt_s])if(Math.abs(v-Math.round(v))>1e-6)throw Error('Duration and output interval must contain whole integration steps; duration must contain whole output intervals.');
 if(n.duration_s/n.dt_s>1500000||n.duration_s/n.sample_dt_s>100000)throw Error('Run exceeds the browser work limit; shorten it or increase the integration/output step.');
 const omega=2*Math.PI*Math.max(d.heaveFrequency,d.rollFrequency,d.pitchFrequency);
 const decay=Math.max(4*p.damping/p.mass,4*p.damping*p.half_width**2/p.inertia_roll,4*p.damping*p.half_length**2/Math.min(p.inertia_pitch,p.inertia_yaw));
 if(n.dt_s*omega>.1||n.dt_s*decay>.2)throw Error('The step is too large for these stiffness, damping and inertia values. Reduce the integration step.');
 return c;
}
export function drive(t,p,g){
 let r=1,rd=0;if(t<=0){r=0;}else if(t<g.ramp_s){const a=Math.PI*t/g.ramp_s;r=.5*(1-Math.cos(a));rd=.5*Math.PI/g.ramp_s*Math.sin(a);}
 const b=[],bd=[],phase=[],base=derived(p).supportHeight,wmod=2*Math.PI*g.phase_mod_hz;
 for(let j=0;j<2;j++){
  const alpha=Math.PI*g.step_hz[j]*t+g.stride_phase_rad[j]+g.phase_mod_rad[j]*Math.sin(wmod*t+g.phase_mod_offset_rad[j]);
  const av=Math.PI*g.step_hz[j]+g.phase_mod_rad[j]*wmod*Math.cos(wmod*t+g.phase_mod_offset_rad[j]);phase.push(alpha);
  const v=g.vertical_m[j]*Math.cos(2*alpha),vd=-2*g.vertical_m[j]*av*Math.sin(2*alpha);
  const psi=g.tilt_rad[j]*Math.sin(alpha),psid=g.tilt_rad[j]*av*Math.cos(alpha);
  for(const s of [-p.half_width,p.half_width]){const raw=v+s*Math.sin(psi);b.push(base+r*raw);bd.push(rd*raw+r*(vd+s*Math.cos(psi)*psid));}
 }
 return {support:b,velocity:bd,phase};
}
export function geometry(y,p){
 const [z,phi,theta]=y,sp=Math.sin(phi),cp=Math.cos(phi),st=Math.sin(theta),ct=Math.cos(theta);
 const points=[],jacobian=[];
 for(let i=0;i<4;i++){
  const x=i<2?p.half_length:-p.half_length,side=i%2?p.half_width:-p.half_width,u=side*sp-p.com_height*cp;
  points.push([x*ct+u*st,side*cp+p.com_height*sp,z-x*st+u*ct]);
  jacobian.push([1,ct*(side*cp+p.com_height*sp),-x*ct-u*st]);
 }
 return {points,jacobian};
}
export function contacts(t,y,c){
 const p=c.parameters,s=drive(t,p,c.gait),geo=geometry(y,p);
 if(c.mode==='collapsed')for(let side=0;side<2;side++){const b=(s.support[side]+s.support[side+2])/2,bd=(s.velocity[side]+s.velocity[side+2])/2;s.support[side]=s.support[side+2]=b;s.velocity[side]=s.velocity[side+2]=bd;}
 const force=[],compression=[];let dissipation=0;
 for(let i=0;i<4;i++){
  const delta=s.support[i]-geo.points[i][2],j=geo.jacobian[i],dd=s.velocity[i]-y[3]-j[1]*y[4]-j[2]*y[5];
  const elastic=p.stiffness*Math.max(0,delta),f=delta>0?Math.max(0,elastic+p.damping*dd):0;
  force.push(f);compression.push(delta);if(delta>0)dissipation+=(f-elastic)*dd;
 }
 return {...s,...geo,force,compression,dissipation};
}
export function rhs(t,y,c){
 const p=c.parameters,s=contacts(t,y,c),cp=Math.cos(y[1]),sp=Math.sin(y[1]);
 const J=p.inertia_pitch*cp**2+p.inertia_yaw*sp**2,Jp=2*(p.inertia_yaw-p.inertia_pitch)*sp*cp;
 let f=0,roll=0,pitch=0,power=0;
 for(let i=0;i<4;i++){f+=s.force[i];roll+=s.jacobian[i][1]*s.force[i];pitch+=s.jacobian[i][2]*s.force[i];power+=s.force[i]*s.velocity[i];}
 return [y[3],y[4],c.mode==='full'?y[5]:0,(f-p.mass*p.gravity)/p.mass,
  (roll+.5*Jp*y[5]**2)/p.inertia_roll,c.mode==='full'?(pitch-Jp*y[4]*y[5])/J:0,power,s.dissipation];
}
export function step(t,y,dt,c){
 const add=(a,scale)=>y.map((v,i)=>v+scale*a[i]);
 const a=rhs(t,y,c),b=rhs(t+dt/2,add(a,dt/2),c),d=rhs(t+dt/2,add(b,dt/2),c),e=rhs(t+dt,add(d,dt),c);
 return y.map((v,i)=>v+dt/6*(a[i]+2*b[i]+2*d[i]+e[i]));
}
export function energy(y,s,p){const J=p.inertia_pitch*Math.cos(y[1])**2+p.inertia_yaw*Math.sin(y[1])**2;
 return .5*(p.mass*y[3]**2+p.inertia_roll*y[4]**2+J*y[5]**2)+p.mass*p.gravity*y[0]+.5*p.stiffness*s.compression.reduce((a,v)=>a+Math.max(0,v)**2,0);}
export function quaternion(roll,pitch){const cr=Math.cos(roll/2),sr=Math.sin(roll/2),cp=Math.cos(pitch/2),sp=Math.sin(pitch/2);return [cp*cr,cp*sr,sp*cr,-sp*sr];}

// Incremental and batch calculations share EXACTLY the same stepper and state.
// Live controls start a new session; they never inject changed coefficients into
// an old trajectory or let the rendering frame rate set the integration step.
export class Session{
 constructor(config){
  validate(config);this.config=structuredClone(config);this.p=this.config.parameters;this.n=this.config.numerics;
  this.total=Math.round(this.n.duration_s/this.n.dt_s);this.stride=Math.round(this.n.sample_dt_s/this.n.dt_s);this.index=0;
  this.y=[this.p.z0,config.initial.roll_rad,config.initial.pitch_rad,0,0,0,0,0];this.samples=[];
  this.count=0;this.mean=0;this.m2=0;this.roll2=0;this.pitch2=0;this.forceCount=0;this.zero=0;this.anyZero=0;this.maxForce=0;this.maxSide=0;this.maxResidual=0;
  const s=contacts(0,this.y,this.config);this.e0=energy(this.y,s,this.p);this.forceStats(0,s);this.record(0,s);
 }
 forceStats(t,s){if(t<this.n.analysis_start_s-1e-10)return;this.forceCount++;this.maxForce=Math.max(this.maxForce,...s.force);this.maxSide=Math.max(this.maxSide,s.force[0]+s.force[2],s.force[1]+s.force[3]);const n=s.force.filter(f=>f<=1e-9).length;this.zero+=n;this.anyZero+=n>0?1:0;}
 record(t,s){
  const y=this.y,e=energy(y,s,this.p),residual=e-this.e0-y[6]+y[7];this.maxResidual=Math.max(this.maxResidual,Math.abs(residual));
  const sample={t,z:y[0],roll:y[1],pitch:y[2],state:[...y],quaternion:quaternion(y[1],y[2]),
   support:s.support,force:s.force,contact:s.points.map(p=>p[2]),points:s.points,compression:s.compression,phase:s.phase,energy:e,residual};
  this.samples.push(sample);
  if(t>=this.n.analysis_start_s-1e-10){this.count++;const dz=y[0]-this.mean;this.mean+=dz/this.count;this.m2+=dz*(y[0]-this.mean);this.roll2+=y[1]**2;this.pitch2+=y[2]**2;}
  return sample;
 }
 advanceTo(target){
  if(!Number.isFinite(target)||target<0)throw Error('Target time must be finite and nonnegative.');
  const goal=Math.min(this.total,Math.ceil(target/this.n.sample_dt_s-1e-9)*this.stride),first=this.samples.length;
  while(this.index<goal){
   this.y=step(this.index*this.n.dt_s,this.y,this.n.dt_s,this.config);this.index++;
   if(!this.y.every(Number.isFinite)||Math.abs(this.y[1])>Math.PI/3||Math.abs(this.y[2])>Math.PI/3||Math.abs(this.y[0]-this.p.z0)>2)throw Error(`Motion left the explorer range at ${(this.index*this.n.dt_s).toFixed(3)} s (60° tilt or 2 m heave). Reduce forcing; these are software limits, not physical failure thresholds.`);
   const t=this.index*this.n.dt_s,s=contacts(t,this.y,this.config);this.forceStats(t,s);if(this.index%this.stride===0)this.record(t,s);
  }
  return this.samples.slice(first);
 }
 get stats(){return {heaveRmsMm:this.count?1000*Math.sqrt(Math.max(0,this.m2/this.count)):null,
  rollRmsDeg:this.count?Math.sqrt(this.roll2/this.count)/DEG:null,pitchRmsDeg:this.count?Math.sqrt(this.pitch2/this.count)/DEG:null,
  peakForceN:this.forceCount?this.maxForce:null,peakSideN:this.forceCount?this.maxSide:null,
  contactLossFraction:this.forceCount?this.zero/(4*this.forceCount):null,anyContactLossFraction:this.forceCount?this.anyZero/this.forceCount:null,
  maxEnergyResidualJ:this.maxResidual,sampleCount:this.samples.length,forceSampleCount:this.forceCount,analysisSampleCount:this.count};}
 result(){return {config:structuredClone(this.config),samples:this.samples,stats:this.stats,derived:derived(this.p),complete:this.index===this.total,simulatedUntil:this.samples.at(-1).t};}
}
export function simulate(config,onProgress=()=>{}){const s=new Session(config);while(s.index<s.total){s.advanceTo(Math.min(config.numerics.duration_s,s.index*s.n.dt_s+1));onProgress(s.index/s.total);}return s.result();}
export function toCSV(run){
 const allocation=run.config.mode==='collapsed'?'allocated_':'';
 const ids=['front_left','front_right','rear_left','rear_right'];
 const header=['time_s','z_m','heave_mm','roll_rad','pitch_rad','roll_deg','pitch_deg','qw','qx','qy','qz',
  ...ids.map(n=>`${n}_support_m`),...ids.map(n=>`${allocation}${n}_force_N`),'left_side_force_N','right_side_force_N',
  ...ids.map(n=>`${n}_contact_m`),...ids.map(n=>`${n}_compression_m`),'front_stride_phase_rad','rear_stride_phase_rad','energy_J','energy_residual_J'];
 return header.join(',')+'\n'+run.samples.map(s=>[s.t,s.z,1000*(s.z-run.config.parameters.z0),s.roll,s.pitch,s.roll/DEG,s.pitch/DEG,...s.quaternion,...s.support,...s.force,s.force[0]+s.force[2],s.force[1]+s.force[3],...s.contact,...s.compression,...s.phase,s.energy,s.residual].join(',')).join('\n')+'\n';
}

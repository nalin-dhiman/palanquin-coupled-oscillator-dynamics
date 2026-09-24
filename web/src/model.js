// Finite-angle vertical/roll model. SI units, x forward, y lateral, z up.
// Faithful port of python/model.py; no browser rendering state enters the solver.
export const PARAMS = {
 mass_kg:40,inertia_kg_m2:8,half_span_m:.5,com_height_above_support_m:.15,
 stiffness_N_m:8000,damping_N_s_m:250,gravity_m_s2:9.81,equilibrium_com_height_m:1.5,
 feedback_filter_s:.08,feedback_gain_m_N_s:5e-5,feedback_return_s:1,
 feedback_displacement_limit_m:.006,feedback_rate_limit_m_s:.02
};
export const IRREGULAR = {irregular_frequencies_hz:[.45,.9,1.7],irregular_amplitudes_m:[[.0008,.0006,.0004],[.0007,.00065,.00045]],irregular_phases_rad:[[.2,2,4.1],[1.1,3.2,5]]};
export function preset(name='offset') {
 const config={schema_version:1,parameters:{...PARAMS},input:{input_kind:'periodic',frequency_hz:1.5,amplitudes_m:[.004,.004],phases_rad:[0,Math.PI/3],feedback:false,initial_roll_rad:0,ramp_s:2},numerics:{duration_s:30,dt_s:.001,sample_dt_s:.01,analysis_start_s:4}};
 if(name==='in-phase'){config.input.phases_rad=[0,0];config.input.initial_roll_rad=Math.PI/360;}
 if(name==='feedback')config.input.feedback=true;
 if(name==='irregular')Object.assign(config.input,structuredClone(IRREGULAR),{input_kind:'irregular'});
 if(name==='quiet')config.input.input_kind='none';
 return config;
}
export function derived(p) {
 const staticForce=p.mass_kg*p.gravity_m_s2/2, compression=staticForce/p.stiffness_N_m;
 const rollStiffness=2*p.stiffness_N_m*p.half_span_m**2-p.mass_kg*p.gravity_m_s2*p.com_height_above_support_m;
 return {staticForce,compression,supportHeight:p.equilibrium_com_height_m-p.com_height_above_support_m+compression,rollStiffness,
 heaveFrequency:Math.sqrt(2*p.stiffness_N_m/p.mass_kg)/(2*Math.PI),rollFrequency:Math.sqrt(Math.max(0,rollStiffness)/p.inertia_kg_m2)/(2*Math.PI)};
}
export function validate(config) {
 if(!config||config.schema_version!==1||!config.parameters||!config.input||!config.numerics)throw Error('Use a version 1 configuration with parameters, input and numerics.');
 const {parameters:p,input:c,numerics:n}=config;
 for(const k of Object.keys(PARAMS))if(!Number.isFinite(p[k]))throw Error(`${k} must be a finite number.`);
 for(const k of Object.keys(PARAMS).filter(k=>!['com_height_above_support_m','equilibrium_com_height_m','damping_N_s_m','feedback_gain_m_N_s'].includes(k)))if(p[k]<=0)throw Error(`${k} must be positive.`);
 if(p.damping_N_s_m<0||p.feedback_gain_m_N_s<0)throw Error('Damping and feedback gain must be nonnegative.');
 if(!Object.values(derived(p)).every(Number.isFinite))throw Error('Derived parameters overflow; use finite physical scales.');
 if(derived(p).rollStiffness<=0)throw Error('The selected equilibrium is unstable: increase stiffness/span or reduce the COM offset.');
 if(!['periodic','irregular','none'].includes(c.input_kind))throw Error('Unknown input kind.');
 if(typeof c.feedback!=='boolean')throw Error('feedback must be true or false.');
 if(!Number.isFinite(c.initial_roll_rad)||Math.abs(c.initial_roll_rad)>Math.PI/6)throw Error('Initial roll must be within ±30 degrees for this explorer.');
 if(!Number.isFinite(c.ramp_s)||c.ramp_s<0)throw Error('Ramp duration must be nonnegative.');
 const finiteArray=(a,len)=>Array.isArray(a)&&a.length===len&&a.every(Number.isFinite);
 if(c.input_kind==='periodic') {
  if(!Number.isFinite(c.frequency_hz)||c.frequency_hz<=0||c.frequency_hz>30)throw Error('Frequency must be in (0, 30] Hz.');
  if(!finiteArray(c.amplitudes_m,2)||c.amplitudes_m.some(x=>x<0||x>.1)||!finiteArray(c.phases_rad,2))throw Error('Provide two amplitudes in [0, 0.1] m and two finite phases.');
 }
 if(c.input_kind==='irregular') {
  const f=c.irregular_frequencies_hz, m=f?.length;
  if(!m||m>12||!finiteArray(f,m)||f.some(x=>x<=0||x>30))throw Error('Use 1–12 irregular frequencies in (0, 30] Hz.');
  for(const k of ['irregular_amplitudes_m','irregular_phases_rad'])if(!Array.isArray(c[k])||c[k].length!==2||!c[k].every(row=>finiteArray(row,m)))throw Error(`${k} must have two rows matching the frequency list.`);
  if(c.irregular_amplitudes_m.flat().some(x=>x<0||x>.1))throw Error('Irregular amplitudes must be in [0, 0.1] m.');
 }
 for(const k of ['duration_s','dt_s','sample_dt_s','analysis_start_s'])if(!Number.isFinite(n[k]))throw Error(`${k} must be finite.`);
 if(n.duration_s<=0||n.duration_s>180||n.dt_s<=0||n.dt_s>.005||n.sample_dt_s<n.dt_s||n.sample_dt_s>.1)throw Error('Use a duration up to 180 s, integration step up to 5 ms and output interval up to 100 ms.');
 if(n.analysis_start_s<0||n.analysis_start_s>=n.duration_s)throw Error('Analysis start must precede the end of the run.');
 for(const v of [n.duration_s/n.dt_s,n.sample_dt_s/n.dt_s,n.duration_s/n.sample_dt_s])if(Math.abs(v-Math.round(v))>1e-6)throw Error('Duration and output interval must contain an integer number of integration steps; duration must also contain whole output intervals.');
 if(n.duration_s/n.dt_s>1500000||n.duration_s/n.sample_dt_s>100000)throw Error('This browser run exceeds the work limit; increase the step or output interval.');
 const omega=Math.max(Math.sqrt(2*p.stiffness_N_m/p.mass_kg),Math.sqrt(derived(p).rollStiffness/p.inertia_kg_m2));
 const decay=Math.max(2*p.damping_N_s_m/p.mass_kg,2*p.damping_N_s_m*p.half_span_m**2/p.inertia_kg_m2,c.feedback?1/p.feedback_filter_s:0);
 if(n.dt_s*omega>.10||n.dt_s*decay>.20)throw Error('The time step is too large for these parameters. Reduce the integration step.');
 return config;
}
export function drive(t,c) {
 let ramp=1,rd=0;
 if(c.ramp_s>0&&t<c.ramp_s){const a=Math.PI*Math.max(0,t)/c.ramp_s;ramp=.5*(1-Math.cos(a));rd=.5*Math.PI*Math.sin(a)/c.ramp_s;}
 const v=[0,0],d=[0,0];
 for(let i=0;i<2;i++) {
  let raw=0,der=0;
  if(c.input_kind==='periodic'){const w=2*Math.PI*c.frequency_hz,ph=w*t+c.phases_rad[i];raw=c.amplitudes_m[i]*Math.sin(ph);der=c.amplitudes_m[i]*w*Math.cos(ph);}
  if(c.input_kind==='irregular')for(let j=0;j<c.irregular_frequencies_hz.length;j++){const w=2*Math.PI*c.irregular_frequencies_hz[j],ph=w*t+c.irregular_phases_rad[i][j],a=c.irregular_amplitudes_m[i][j];raw+=a*Math.sin(ph);der+=a*w*Math.cos(ph);}
  v[i]=ramp*raw;d[i]=rd*raw+ramp*der;
 }
 return [v,d];
}
const clip=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
export function contacts(t,y,p,c) {
 const [v,d]=drive(t,c),base=derived(p),result={drive:v,support:[],velocity:[],point:[],lever:[],compression:[],force:[],uv:[],dissipation:0};
 for(let i=0;i<2;i++) {
  let uv=c.feedback?clip(-p.feedback_gain_m_N_s*y[6+i]-y[4+i]/p.feedback_return_s,-p.feedback_rate_limit_m_s,p.feedback_rate_limit_m_s):0;
  if((y[4+i]>=p.feedback_displacement_limit_m&&uv>0)||(y[4+i]<=-p.feedback_displacement_limit_m&&uv<0))uv=0;
  const s=(i===0?-1:1)*p.half_span_m,point=y[0]+s*Math.sin(y[1])-p.com_height_above_support_m*Math.cos(y[1]);
  const lever=s*Math.cos(y[1])+p.com_height_above_support_m*Math.sin(y[1]),b=base.supportHeight+v[i]+y[4+i],bv=d[i]+uv;
  const delta=b-point,dd=bv-y[2]-lever*y[3],raw=p.stiffness_N_m*delta+p.damping_N_s_m*dd,f=delta>0?Math.max(raw,0):0;
  result.support.push(b);result.velocity.push(bv);result.point.push(point);result.lever.push(lever);result.compression.push(delta);result.force.push(f);result.uv.push(uv);
  result.dissipation+=delta>0?Math.max(0,(f-p.stiffness_N_m*delta)*dd):0;
 }
 return result;
}
export function rhs(t,y,p,c) {
 const s=contacts(t,y,p,c),pow=s.force.map((f,i)=>f*s.velocity[i]);
 return [y[2],y[3],(s.force[0]+s.force[1]-p.mass_kg*p.gravity_m_s2)/p.mass_kg,(s.lever[0]*s.force[0]+s.lever[1]*s.force[1])/p.inertia_kg_m2,
 ...s.uv,...s.force.map((f,i)=>c.feedback?(f-p.mass_kg*p.gravity_m_s2/2-y[6+i])/p.feedback_filter_s:0),pow.reduce((a,x)=>a+Math.max(0,x),0),pow.reduce((a,x)=>a+Math.min(0,x),0),s.dissipation];
}
export function step(t,y,dt,p,c) {
 const add=(k,s)=>y.map((v,i)=>v+s*k[i]);const a=rhs(t,y,p,c),b=rhs(t+dt/2,add(a,dt/2),p,c),d=rhs(t+dt/2,add(b,dt/2),p,c),e=rhs(t+dt,add(d,dt),p,c);
 return y.map((v,i)=>v+dt*(a[i]+2*b[i]+2*d[i]+e[i])/6);
}
export function energy(y,s,p) {return .5*p.mass_kg*y[2]**2+.5*p.inertia_kg_m2*y[3]**2+p.mass_kg*p.gravity_m_s2*y[0]+.5*p.stiffness_N_m*s.compression.reduce((v,d)=>v+Math.max(0,d)**2,0);}
export function simulate(config,onProgress=()=>{}) {
 validate(config);const {parameters:p,input:c,numerics:n}=config,steps=Math.round(n.duration_s/n.dt_s),stride=Math.round(n.sample_dt_s/n.dt_s);
 let y=[p.equilibrium_com_height_m,c.initial_roll_rad,0,0,0,0,0,0,0,0,0];const e0=energy(y,contacts(0,y,p,c),p),samples=[];
 function record(t) {const s=contacts(t,y,p,c);samples.push({t,z:y[0],roll:y[1],state:[...y],quaternion:[Math.cos(y[1]/2),Math.sin(y[1]/2),0,0],support:s.support,force:s.force,contact:s.point,compression:s.compression,lever:s.lever,energy:energy(y,s,p),residual:energy(y,s,p)-e0-y[8]-y[9]+y[10]});}
 record(0);
 for(let i=0;i<steps;i++) {y=step(i*n.dt_s,y,n.dt_s,p,c);
  if(!y.every(Number.isFinite)||Math.abs(y[1])>Math.PI/3||Math.abs(y[0]-p.equilibrium_com_height_m)>2)throw Error(`Run stopped at ${((i+1)*n.dt_s).toFixed(3)} s: motion left the explorer's supported range (60° roll or 2 m heave). Reduce forcing or change the model parameters.`);
  if((i+1)%stride===0)record((i+1)*n.dt_s);
  if(i%5000===0)onProgress(i/steps);
 }
 const ss=samples.filter(s=>s.t>=n.analysis_start_s),mean=ss.reduce((a,s)=>a+s.z,0)/ss.length;
 const stats={heaveRmsMm:1000*Math.sqrt(ss.reduce((a,s)=>a+(s.z-mean)**2,0)/ss.length),rollRmsDeg:180/Math.PI*Math.sqrt(ss.reduce((a,s)=>a+s.roll**2,0)/ss.length),peakForceN:ss.reduce((a,s)=>Math.max(a,...s.force),0),contactLossFraction:ss.filter(s=>s.force.some(f=>f<=1e-9)).length/ss.length,maxEnergyResidualJ:samples.reduce((a,s)=>Math.max(a,Math.abs(s.residual)),0),sampleCount:samples.length};
 return {config:structuredClone(config),samples,stats,derived:derived(p)};
}
export function toCSV(run) {
 const header='time_s,z_m,heave_mm,roll_rad,roll_deg,qw,qx,qy,qz,left_support_m,right_support_m,left_force_N,right_force_N,left_contact_m,right_contact_m,left_compression_m,right_compression_m,energy_J,energy_residual_J';
 return header+'\n'+run.samples.map(s=>[s.t,s.z,1000*(s.z-run.config.parameters.equilibrium_com_height_m),s.roll,s.roll*180/Math.PI,...s.quaternion,...s.support,...s.force,...s.contact,...s.compression,s.energy,s.residual].join(',')).join('\n')+'\n';
}

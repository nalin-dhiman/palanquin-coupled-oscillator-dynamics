import {preset,validate,toCSV,isWalking,viewParameters} from './simulation.js';
import {Viewer} from './viewer.js';
const $=s=>document.querySelector(s),DEG=180/Math.PI;
let config=preset(),run=null,worker=null,job=0,playing=true,time=0,lastFrame=0,dirty=false,live=false,pending=false,autoTimer,viewer;
try{viewer=new Viewer($('#stage'));viewer.ready.catch(()=>{});}catch(error){$('#asset-status').textContent='WebGL is unavailable. The simulation and charts still work.';}
const walkingPresets=[['G90','Roll and pitch','A quarter-stride offset between front and rear: both roll and pitch respond.'],['G0','Matched phases','Front and rear use the same stride phase.'],['G180','Load redistribution','Opposite torso sway can redistribute shoulder loads with almost no net rocking.'],['Gvar','Cadence mismatch','Slightly different cadences and shoulder amplitudes let the relative phase drift.'],['heave','Heave','Matched vertical inputs, with torso tilt switched off.'],['roll','Roll','Matched torso sway, with vertical motion switched off.'],['pitch','Pitch','Front and rear vertical inputs oppose; torso tilt is switched off.'],['Gstress','Contact opening','Larger prescribed inputs examine unloading and contact opening.'],['G90slow','Lower cadence','The quarter-stride example at 1.83 steps/s.'],['G90fast','Higher cadence','The quarter-stride example at 2.33 steps/s.']];
const legacyPresets=[['in-phase','In phase','Matched supports; a small initial roll decays.'],['offset','60° offset','Different phases on the two pole sides.'],['feedback','Load yielding','A bounded load-yielding feedback rule.'],['irregular','Irregular inputs','A prescribed frequency mixture.'],['quiet','Stationary supports','No prescribed support movement.']];
// Numeric fields: path, label, unit, min, max, increment, display conversion, slider.
const f=(path,label,unit,min,max,step=1,scale=1,slider=false)=>[path,label,unit,min,max,step,scale,slider];
const numericGroup=['Duration & numerical controls',true,[f('numerics.duration_s','Duration','s',1,180),f('numerics.analysis_start_s','Statistics begin at','s',0,179),f('numerics.dt_s','Integration step','ms',.05,2,.125,1000),f('numerics.sample_dt_s','Recorded interval','ms',.05,100,1,1000)]];
const walkingGroups=[
 ['Walking inputs',false,[['mode','Pitch comparison','','select',[['full','Four contacts · free pitch'],['pitch_locked','Four contacts · locked pitch'],['collapsed','Two averaged resultants']]],...['Front','Rear'].flatMap((s,j)=>[f(`gait.step_hz.${j}`,`${s} step cadence`,'steps/s',.1,5,.01,1,true),f(`gait.stride_phase_rad.${j}`,`${s} stride phase`,'degrees',-360,360,1,DEG,true)])]],
 ['Shoulder motion',true,[...['Front','Rear'].flatMap((s,j)=>[f(`gait.vertical_m.${j}`,`${s} vertical amplitude`,'mm',0,100,.5,1000,true),f(`gait.tilt_rad.${j}`,`${s} torso tilt`,'degrees',0,15,.1,DEG,true)]),f('gait.ramp_s','Ramp duration','s',.1,30,.1)]],
 ['Load, geometry & compliance',true,[f('parameters.mass','Total mass','kg',1,500),f('parameters.half_width','Lateral half-spacing','m',.05,3,.01),f('parameters.half_length','Front/rear half-spacing','m',.05,5,.01),f('parameters.com_height','COM above contacts','m',-2,2,.01),f('parameters.z0','Initial COM height','m',.1,5,.01),f('parameters.stiffness','Stiffness per contact','N/m',100,100000,100),f('parameters.damping','Damping per contact','N s/m',0,10000,10),f('parameters.inertia_roll','Roll inertia','kg m²',.01,500,.1),f('parameters.inertia_pitch','Pitch inertia','kg m²',.01,500,.1),f('parameters.inertia_yaw','Yaw inertia¹','kg m²',.01,500,.1),f('parameters.gravity','Gravity','m/s²',.1,30,.01)]],
 ['Phase variation & initial angles',true,[...['Front','Rear'].flatMap((s,j)=>[f(`gait.phase_mod_rad.${j}`,`${s} phase variation`,'degrees',0,180,.1,DEG),f(`gait.phase_mod_offset_rad.${j}`,`${s} variation phase`,'degrees',-360,360,1,DEG)]),f('gait.phase_mod_hz','Variation frequency','Hz',0,5,.01),f('initial.roll_rad','Initial roll','degrees',-30,30,.1,DEG),f('initial.pitch_rad','Initial pitch','degrees',-30,30,.1,DEG)]],numericGroup];
const legacyGroups=[
 ['Support inputs',false,[['input.input_kind','Input waveform','','select',[['periodic','Periodic'],['irregular','Irregular mixture'],['none','Stationary']]],f('input.frequency_hz','Frequency','Hz',.1,30,.1),f('input.amplitudes_m.0','Left amplitude','mm',0,100,.1,1000),f('input.amplitudes_m.1','Right amplitude','mm',0,100,.1,1000),f('input.phases_rad.0','Left phase','degrees',-360,360,1,DEG),f('input.phases_rad.1','Right phase','degrees',-360,360,1,DEG),['input.feedback','Load yielding','','checkbox']]],
 ['Load & geometry',true,[f('parameters.mass_kg','Mass','kg',1,500),f('parameters.stiffness_N_m','Stiffness per side','N/m',100,100000,100),f('parameters.damping_N_s_m','Damping per side','N s/m',0,10000,10),f('parameters.inertia_kg_m2','Roll inertia','kg m²',.01,500,.1),f('parameters.half_span_m','Lateral half-spacing','m',.05,3,.01),f('parameters.com_height_above_support_m','COM above contacts','m',-2,2,.01),f('parameters.equilibrium_com_height_m','Initial COM height','m',.1,5,.01),f('parameters.gravity_m_s2','Gravity','m/s²',.1,30,.01),f('input.initial_roll_rad','Initial roll','degrees',-30,30,.1,DEG),f('input.ramp_s','Ramp duration','s',0,30,.1)]],
 ['Feedback controller',true,[f('parameters.feedback_filter_s','Force-filter time','s',.001,5,.01),f('parameters.feedback_gain_m_N_s','Yielding gain','m/(N s)',0,.01,.00001),f('parameters.feedback_return_s','Return time','s',.001,10,.1),f('parameters.feedback_displacement_limit_m','Displacement limit','mm',.01,100,.1,1000),f('parameters.feedback_rate_limit_m_s','Rate limit','mm/s',.1,1000,1,1000)]],numericGroup];
let fields=[];
const get=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
function set(o,path,value){const keys=path.split('.');let cur=o;for(const k of keys.slice(0,-1))cur=cur[k];cur[keys.at(-1)]=value;}
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function renderFields(){
 const walking=isWalking(config),groups=walking?walkingGroups:legacyGroups;fields=groups.flatMap(g=>g[2]);
 $('#model-family').value=walking?'walking':'reference';$('#live-mode').disabled=!walking;
 $('#presets').innerHTML=(walking?walkingPresets:legacyPresets).map(([id,label])=>`<button type="button" data-preset="${walking?'walk-':''}${id}">${label}</button>`).join('');
 $('#fields').innerHTML=groups.map(([title,fold,items])=>`<${fold?'details':'section'} class="group">${fold?`<summary>${title}</summary>`:`<h3>${title}</h3>`}${items.map(f=>{const [path,label,unit,type,options]=f,id='field-'+path.replaceAll('.','-');let control;
  if(type==='select')control=`<select id="${id}" data-path="${path}">${options.map(([v,l])=>`<option value="${v}">${l}</option>`).join('')}</select>`;
  else if(type==='checkbox')control=`<input type="checkbox" id="${id}" data-path="${path}">`;
  else control=`<div class="number-control">${f[7]?`<input type="range" data-slider="${path}" aria-label="${label} slider" min="${f[3]}" max="${f[4]}" step="${f[5]}">`:''}<input type="number" id="${id}" data-path="${path}" min="${f[3]}" max="${f[4]}" step="any" required></div>`;
  return `<div class="field" data-for="${path}"><label for="${id}"><span>${label}</span><span>${unit}</span></label>${control}</div>`;
 }).join('')}</${fold?'details':'section'}>`).join('');
 fillFields();for(const b of document.querySelectorAll('[data-preset]'))b.onclick=()=>{const record=(walking?walkingPresets:legacyPresets).find(r=>r[0]===b.dataset.preset.replace('walk-',''));$('#preset-note').textContent=record[2];if(['walk-roll','walk-pitch'].includes(b.dataset.preset))$('#camera').value=b.dataset.preset==='walk-roll'?'front':'side';calculate(preset(b.dataset.preset));};
}
function fillFields(){for(const f of fields){const el=document.querySelector(`[data-path="${f[0]}"]`),v=get(config,f[0]);if(f[3]==='checkbox')el.checked=v;else el.value=typeof v==='number'?Number((v*(f[6]??1)).toPrecision(12)):v??'';const slider=document.querySelector(`[data-slider="${f[0]}"]`);if(slider)slider.value=el.value;}$('#config-editor').value=JSON.stringify(config,null,2);updateConditional();}
function updateConditional(){
 if(isWalking(config)){const pitch=$('[data-path="initial.pitch_rad"]');pitch.disabled=$('[data-path="mode"]').value!=='full';if(pitch.disabled)pitch.value=0;}
 else{const kind=$('[data-path="input.input_kind"]').value;for(const f of fields.filter(f=>f[0]==='input.frequency_hz'||f[0].includes('amplitudes_m.')||f[0].includes('phases_rad.'))){const e=document.querySelector(`[data-for="${f[0]}"]`);e.classList.toggle('hidden',kind!=='periodic');e.querySelector('input').disabled=kind!=='periodic';}}
}
function readFields(){const next=structuredClone(config);for(const f of fields){const e=document.querySelector(`[data-path="${f[0]}"]`);if(e.disabled&&f[0]!=='initial.pitch_rad')continue;set(next,f[0],f[3]==='checkbox'?e.checked:f[3]==='select'?e.value:e.value.trim()===''?NaN:Number(e.value)/(f[6]??1));}if(!isWalking(next)&&next.input.input_kind==='irregular'&&!next.input.irregular_frequencies_hz)Object.assign(next.input,preset('irregular').input,{feedback:next.input.feedback,ramp_s:next.input.ramp_s,initial_roll_rad:next.input.initial_roll_rad});return next;}
function setPlaying(value){playing=value;$('#play').textContent=value?'Ⅱ':'▶';$('#play').setAttribute('aria-label',value?'Pause animation':'Play animation');if(run)updateStats();}
function modeLabel(c){return !isWalking(c)?'Reference two supports':({full:'Four contacts · free pitch',pitch_locked:'Four contacts · locked pitch',collapsed:'Two averaged resultants'})[c.mode];}
function updateDisplayNote(){const gain=Number($('#motion-gain').value);$('#display-note').textContent=gain===1?'Angles and displacement shown at actual scale.':`${gain}× visual magnification. Readouts and exports retain computed values.`;$('#view-note').textContent=`${run?modeLabel(run.config):'Walking'} · ${gain===1?'actual scale':`MAGNIFIED ${gain}×`}`;$('#display-note').classList.toggle('magnified',gain!==1);}
function calculate(next,{live:liveOverride}={}){
 clearTimeout(autoTimer);try{validate(next);}catch(e){dirty=true;status(`Not applied: ${e.message}`,true);return false;}
 const familyChanged=isWalking(config)!==isWalking(next);config=structuredClone(next);dirty=false;
 if(familyChanged)renderFields();else fillFields();
 const matched=(isWalking(config)?walkingPresets:legacyPresets).find(([name])=>{const p=preset(isWalking(config)?'walk-'+name:name);return JSON.stringify(isWalking(config)?p.gait:p.input)===JSON.stringify(isWalking(config)?config.gait:config.input);});$('#preset-note').textContent=matched?matched[2]:'Custom parameter configuration. Motion and contact loads are computed from these inputs.';
 document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',JSON.stringify(preset(b.dataset.preset))===JSON.stringify(config)));
 const id=++job;worker?.terminate();worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});live=isWalking(config)&&(liveOverride??$('#live-mode').checked);pending=false;run=null;time=0;setPlaying(false);$('#csv-download').disabled=true;$('#scrubber').max=0;$('#time').textContent='0.00 s';status(live?'Starting live simulation…':'Calculating full trajectory…');
 for(const id of ['heave-stat','roll-stat','pitch-stat','force-stat','side-stat','contact-stat'])$('#'+id).textContent='—';
 worker.onmessage=({data})=>{
  if(data.id!==job)return;
  if(data.type==='progress'){status(`Calculating full trajectory… ${Math.round(data.progress*100)}%`);return;}
  if(data.type==='error'){pending=false;live=false;setPlaying(false);status(`Calculation stopped: ${data.message}${run?' Recorded prefix remains available.':''}`,true);$('#compute-note').textContent='Calculation stopped. Adjust the parameters and restart.';return;}
  if(data.type==='chunk'){pending=false;run.samples.push(...data.samples);Object.assign(run,{stats:data.stats,complete:data.complete,simulatedUntil:data.simulatedUntil});}
  else{run=data.run;run.simulatedUntil??=run.samples.at(-1).t;run.complete??=true;setPlaying(true);setupContacts();viewer?.update(run.samples[0],run.config);viewer?.setCamera($('#camera').value,viewParameters(run.config).z0);status(live?'Live simulation running. Changes restart from the initial state.':`${run.samples.length.toLocaleString()} samples calculated. Playing the recorded trajectory.`);}
  $('#csv-download').disabled=false;$('#scrubber').max=run.simulatedUntil;$('#scrubber').step=run.config.numerics.sample_dt_s;updateStats();updateDisplayNote();
 };
 worker.onerror=e=>{pending=false;live=false;setPlaying(false);status(`Simulation worker failed: ${e.message}`,true);};worker.postMessage({id,config,live});return true;
}
function updateStats(){
 if(!run)return;const c=run.config,s=run.stats,w=isWalking(c),collapsed=w&&c.mode==='collapsed';const fmt=(v,n=3)=>v==null?'—':Math.abs(v)<1e-10?'≈ 0':v.toFixed(n);
 $('#heave-stat').textContent=fmt(s.heaveRmsMm);$('#roll-stat').textContent=fmt(s.rollRmsDeg);$('#pitch-stat').textContent=w?fmt(s.pitchRmsDeg):'—';
 $('#force-stat').textContent=collapsed?'—':fmt(s.peakForceN,1);$('#force-unit').textContent=collapsed?'Individual contacts not resolved':w?'N · maximum individual contact':'N · one effective pole-side support';
 $('#side-stat').textContent=fmt(w?s.peakSideN:s.peakForceN,1);$('#contact-stat').textContent=fmt(s.contactLossFraction==null?null:s.contactLossFraction*100,2);$('#contact-unit').textContent=!w?'% of outputs with any support unloaded':collapsed?'% of resultant–time samples':'% of contact–time samples';
 const start=c.numerics.analysis_start_s,until=run.simulatedUntil;$('#analysis-note').textContent=until<start?`Statistics begin at ${start} s; ${until.toFixed(1)} s recorded so far.`:`Statistics: ${start}–${until.toFixed(2)} s. Traces follow playback; statistics use the recorded window.`;
 const d=run.derived;$('#numerical-note').textContent=`Static load ${d.staticForce.toFixed(1)} N per ${w?'contact':'support'} · Natural frequencies: heave ${d.heaveFrequency.toFixed(2)}, roll ${d.rollFrequency.toFixed(2)}${w?`, pitch ${d.pitchFrequency.toFixed(2)}`:''} Hz · Max work–energy residual ${s.maxEnergyResidualJ.toExponential(2)} J${w?' · ¹Yaw inertia enters finite-angle kinetic energy; yaw is constrained.':''}`;
 $('#compute-note').textContent=`${live&&!run.complete?(playing?'Live simulation':'Simulation paused'):run.complete?'Full trajectory recorded':'Recorded prefix'} · ${until.toFixed(2)} / ${c.numerics.duration_s} s calculated · ${run.samples.length.toLocaleString()} outputs${dirty?' · Unapplied edits':''}`;
}
const COLORS=['#376574','#b46f37','#398074','#80628e'];
function setupContacts(){const c=run.config,four=isWalking(c)&&c.mode!=='collapsed',names=four?['Front left','Front right','Rear left','Rear right']:['Left resultant','Right resultant'];$('#contact-explanation').textContent=four?'Four computed normal forces':'Two effective forces; shoulders unresolved';$('#contact-cards').innerHTML=names.map((n,i)=>`<div class="contact-card" style="--contact-color:${COLORS[i]}"><span>${n}</span><strong id="force-now-${i}">—</strong><small id="state-now-${i}">Loading…</small></div>`).join('');$('#trace-legend').innerHTML=names.map((n,i)=>`<span style="--contact-color:${COLORS[i]}">${n}</span>`).join('');}
function currentForces(s,c){return isWalking(c)&&c.mode==='collapsed'?[s.force[0]+s.force[2],s.force[1]+s.force[3]]:s.force;}
function readouts(s){const p=viewParameters(run.config);$('#heave-now').textContent=`${((s.z-p.z0)*1000).toFixed(2)} mm`;$('#roll-now').textContent=`${(s.roll*DEG).toFixed(2)}°`;$('#pitch-now').textContent=p.walking?`${(s.pitch*DEG).toFixed(2)}°`:'Not modelled';for(const [i,v] of currentForces(s,run.config).entries()){const el=$('#force-now-'+i);el.textContent=`${v.toFixed(1)} N`;el.parentElement.classList.toggle('unloaded',v<=1e-9);$('#state-now-'+i).textContent=v>1e-9?'Load-bearing':(s.compression?.[i]??0)<0?'Separated · zero force':'Unloaded · zero force';}}
function download(name,value,mime){const url=URL.createObjectURL(new Blob([value],{type:mime})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#toggle-settings').onclick=()=>{const expanded=$('.settings').classList.toggle('expanded');$('#toggle-settings').textContent=expanded?'Hide parameters':'Show all parameters';$('#toggle-settings').setAttribute('aria-expanded',expanded);};
$('#parameters').onsubmit=e=>{e.preventDefault();calculate(readFields());};
$('#parameters').oninput=e=>{if(e.target.dataset.slider){document.querySelector(`[data-path="${e.target.dataset.slider}"]`).value=e.target.value;}else if(e.target.dataset.path){const slider=document.querySelector(`[data-slider="${e.target.dataset.path}"]`);if(slider)slider.value=e.target.value;}updateConditional();dirty=true;status('Settings changed. Applying restarts from the initial state.');document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));clearTimeout(autoTimer);if($('#auto-apply').checked)autoTimer=setTimeout(()=>{if($('#parameters').checkValidity())calculate(readFields());else status('Not applied: check the highlighted parameter limits.',true);},450);};
$('#auto-apply').onchange=()=>{clearTimeout(autoTimer);if($('#auto-apply').checked&&dirty)calculate(readFields());};
$('#model-family').onchange=e=>{$('#preset-note').textContent=e.target.value==='walking'?walkingPresets[0][2]:legacyPresets[0][2];calculate(preset(e.target.value==='walking'?'walk-G90':'in-phase'));};
$('#reset').onclick=()=>calculate(preset(isWalking(config)?'walk-G90':'in-phase'));
$('#calculate-all').onclick=()=>calculate(readFields(),{live:false});$('#live-mode').onchange=()=>calculate(readFields());
$('#play').onclick=()=>setPlaying(!playing);$('#restart').onclick=()=>{time=0;setPlaying(true);};$('#scrubber').oninput=e=>{time=Number(e.target.value);setPlaying(false);};
$('#camera').onchange=()=>viewer?.setCamera($('#camera').value,run?viewParameters(run.config).z0:1.5);$('#motion-gain').onchange=updateDisplayNote;
for(const [id,mode] of [['view-rath','rath'],['view-model','model']])$('#'+id).onclick=()=>{viewer?.setMode(mode);$('#view-rath').classList.toggle('active',mode==='rath');$('#view-model').classList.toggle('active',mode==='model');updateDisplayNote();};
$('#config-download').onclick=()=>{try{const c=readFields();validate(c);download('rath-config.json',JSON.stringify(c,null,2),'application/json');}catch(e){status(`Cannot export invalid settings: ${e.message}`,true);}};
$('#csv-download').onclick=()=>{if(run)download('rath-trajectory.csv',toCSV(run),'text/csv');};
$('#config-apply').onclick=()=>{try{calculate(JSON.parse($('#config-editor').value));}catch(e){status(`Invalid JSON: ${e.message}`,true);}};
$('#config-upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>500000)throw Error('Configuration file is too large.');calculate(JSON.parse(await file.text()));}catch(err){status(`Import failed: ${err.message}`,true);}e.target.value='';};
$('#copy-link').onclick=async()=>{try{const c=readFields();validate(c);const url=new URL(location.href);url.hash='config='+encodeURIComponent(JSON.stringify(c));$('#share-output').value=url.href;$('#share-output').hidden=false;try{await navigator.clipboard.writeText(url.href);status('Settings link copied.');}catch{status('Select and copy the settings link below.');}}catch(e){status(`Cannot share invalid settings: ${e.message}`,true);}};
const chart=$('#traces'),ctx=chart.getContext('2d');let lastChart=-1;
function charts(sample){
 const w=chart.clientWidth,h=540,dpr=Math.min(devicePixelRatio,2);if(chart.width!==Math.round(w*dpr)){chart.width=Math.round(w*dpr);chart.height=h*dpr;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!run)return;
 const start=Math.max(0,sample.t-6),end=start+8,duration=end-start,interval=run.config.numerics.sample_dt_s;
 const visible=run.samples.slice(Math.max(0,Math.floor(start/interval)),Math.min(run.samples.length,Math.ceil(end/interval)+1)),p=viewParameters(run.config),b0=run.derived.supportHeight;
 const rows=[{name:'Support height change (mm)',get:s=>(p.collapsed?s.support.slice(0,2):s.support).map(x=>(x-b0)*1000),min:4.5},
 {name:'Up / down · heave (mm)',get:s=>[(s.z-p.z0)*1000],min:5.5},
 {name:'Sideways tilt · roll (°)',get:s=>[s.roll*DEG],min:.3},
 {name:p.walking?'Front / back tilt · pitch (°)':'Pitch · not calculated in this model',get:s=>[(s.pitch??0)*DEG],min:.3},
 {name:p.collapsed?'Effective resultant force (N)':'Normal contact force (N)',get:s=>currentForces(s,run.config),min:run.derived.staticForce*(p.collapsed?2:1)*1.15,positive:true}];
 const left=55,right=w-15;
 rows.forEach((row,i)=>{const top=27+i*102,height=60;let max=row.min;for(const s of visible)for(const v of row.get(s))max=Math.max(max,Math.abs(v)*1.08);const lo=row.positive?0:-max,yy=v=>top+height-(v-lo)/(max-lo)*height;
  ctx.fillStyle='#4c6055';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText(row.name,left,top-11);ctx.lineWidth=1;ctx.strokeStyle='#e4e9e3';ctx.font='9px system-ui';ctx.fillStyle='#7c887e';
  for(const v of row.positive?[0,max/2,max]:[-max,0,max]){const y=yy(v);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.textAlign='right';ctx.fillText(Math.abs(v)<.01?'0':Math.abs(v)<1?v.toFixed(2):v.toFixed(1),left-7,y+3);}
  for(let tick=0;tick<=4;tick++){const x=left+(right-left)*tick/4;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+height);ctx.stroke();ctx.textAlign='center';ctx.fillText((start+duration*tick/4).toFixed(1),x,top+height+13);}
  for(let j=0;j<row.get(sample).length;j++){ctx.strokeStyle=i===2?'#80628e':i===3?'#398074':COLORS[j];ctx.setLineDash(j>=2?[4,3]:[]);ctx.lineWidth=1.5;ctx.beginPath();visible.forEach((s,k)=>{const x=left+(s.t-start)/duration*(right-left),y=yy(row.get(s)[j]);k===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();ctx.setLineDash([]);}
  const cursor=left+(sample.t-start)/duration*(right-left);ctx.strokeStyle='#435d48';ctx.beginPath();ctx.moveTo(cursor,top);ctx.lineTo(cursor,top+height);ctx.stroke();
 });ctx.textAlign='right';ctx.font='10px system-ui';ctx.fillStyle='#748077';ctx.fillText('Time (s)',right,537);
}
function tick(now){
 const elapsed=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;
 if(run){const duration=run.config.numerics.duration_s;
  if(playing){time=Math.min(time+elapsed*Number($('#speed').value),run.simulatedUntil);if(live&&!run.complete&&!pending&&run.simulatedUntil-time<.15){pending=true;worker.postMessage({type:'advance',id:job,target:Math.min(duration,time+.35)});}if(time>=duration)setPlaying(false);}
  const sample=run.samples[Math.min(run.samples.length-1,Math.max(0,Math.round(time/run.config.numerics.sample_dt_s)))];
  viewer?.update(sample,run.config,{gain:Number($('#motion-gain').value)});$('#scrubber').value=sample.t;$('#time').textContent=`${sample.t.toFixed(2)} / ${duration.toFixed(0)} s`;
  if(now-lastChart>100){readouts(sample);charts(sample);lastChart=now;}
 }
 viewer?.render();requestAnimationFrame(tick);
}
// Read-only diagnostics and explicit run/seek hooks for reproducible browser tests.
window.rathLab={getRun:()=>run,getConfig:()=>structuredClone(config),isDirty:()=>dirty,getViewer:()=>viewer,run:(c,options={live:false})=>calculate(c,options),seek:t=>{time=Math.min(Math.max(0,t),run?.simulatedUntil??0);setPlaying(false);},getTime:()=>time,getPlaybackMode:()=>live?'live':'recorded',getViewOptions:()=>({gain:Number($('#motion-gain').value)})};
let hashError='';try{if(location.hash.startsWith('#config=')){if(location.hash.length>30000)throw Error('Settings link is too large.');const c=JSON.parse(decodeURIComponent(location.hash.slice(8)));validate(c);config=c;}}catch(e){hashError=`Settings link was not applied: ${e.message}`;}
renderFields();calculate(config);if(hashError)$('#preset-note').textContent=hashError;requestAnimationFrame(tick);

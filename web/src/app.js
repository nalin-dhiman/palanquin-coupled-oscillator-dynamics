import {preset,validate,toCSV} from './model.js';
import {Viewer} from './viewer.js';
const $=s=>document.querySelector(s);let config=preset(),run=null,worker=null,job=0,playing=true,time=0,lastFrame=0,dirty=false;
let viewer;
try{viewer=new Viewer($('#stage'));viewer.ready.catch(()=>{});}catch(error){$('#asset-status').textContent='WebGL is unavailable on this device. The simulation and charts still work.';console.error(error);}
const groups=[
 ['Support inputs',false,[['input.input_kind','Input waveform','','select',['periodic','irregular','none']],['input.frequency_hz','Frequency','Hz',.1,30,.1],['input.amplitudes_m.0','Left amplitude','mm',0,100,.1,1000],['input.amplitudes_m.1','Right amplitude','mm',0,100,.1,1000],['input.phases_rad.0','Left phase','degrees',-360,360,1,180/Math.PI],['input.phases_rad.1','Right phase','degrees',-360,360,1,180/Math.PI],['input.feedback','Local load yielding','','checkbox']]],
 ['Load & compliance',true,[['parameters.mass_kg','Mass','kg',1,500,1],['parameters.stiffness_N_m','Stiffness per support','N/m',100,100000,100],['parameters.damping_N_s_m','Damping per support','N s/m',0,10000,10]]],
 ['Geometry & initial state',true,[['parameters.inertia_kg_m2','Roll inertia','kg m²',.01,500,.1],['parameters.half_span_m','Lateral half-span','m',.05,3,.01],['parameters.com_height_above_support_m','COM above contact line','m',-2,2,.01],['parameters.equilibrium_com_height_m','Equilibrium COM height','m',.1,5,.01],['parameters.gravity_m_s2','Gravity','m/s²',.1,30,.01],['input.initial_roll_rad','Initial roll','degrees',-30,30,.1,180/Math.PI],['input.ramp_s','Input ramp','s',0,30,.1]]],
 ['Feedback controller',true,[['parameters.feedback_filter_s','Force-filter time','s',.001,5,.01],['parameters.feedback_gain_m_N_s','Yielding gain','m/(N s)',0,.01,.00001],['parameters.feedback_return_s','Return time','s',.001,10,.1],['parameters.feedback_displacement_limit_m','Displacement limit','mm',.01,100,.1,1000],['parameters.feedback_rate_limit_m_s','Rate limit','mm/s',.1,1000,1,1000]]],
 ['Duration & numerical controls',true,[['numerics.duration_s','Simulation duration','s',5,180,1],['numerics.analysis_start_s','Analysis starts at','s',0,179,1],['numerics.dt_s','Integration step','ms',.1,5,.1,1000],['numerics.sample_dt_s','Output interval','ms',1,100,1,1000]]]
];
const fields=groups.flatMap(g=>g[2]);
function get(obj,path){return path.split('.').reduce((v,k)=>v?.[k],obj);}
function set(obj,path,value){const keys=path.split('.');let cur=obj;for(const k of keys.slice(0,-1))cur=cur[k]??=(/^\d+$/.test(keys.at(-1))?[]:{});cur[keys.at(-1)]=value;}
function renderFields(){
 $('#fields').innerHTML=groups.map(([title,fold,items],i)=>`<${fold?'details':'section'} class="group" ${fold&&i===1?'open':''}>${fold?`<summary>${title}</summary>`:`<h3>${title}</h3>`}${items.map(f=>{const [path,label,unit,type,options]=f,id='field-'+path.replaceAll('.','-');let control;
  if(type==='select')control=`<select id="${id}" data-path="${path}">${options.map(v=>`<option value="${v}">${{periodic:'Periodic',irregular:'Irregular mixture',none:'No prescribed drive'}[v]}</option>`).join('')}</select>`;
  else if(type==='checkbox')control=`<input type="checkbox" id="${id}" data-path="${path}">`;
  else control=`<input type="number" id="${id}" data-path="${path}" min="${f[3]}" max="${f[4]}" step="any" required>`;
  return `<div class="field" data-for="${path}"><label for="${id}"><span>${label}</span><span>${unit}</span></label>${control}</div>`;
 }).join('')}${!fold?'<p class="small-note" id="irregular-note" hidden>Edit all mixture frequencies, amplitudes and phases in the full JSON configuration below.</p>':''}</${fold?'details':'section'}>`).join('');fillFields();
}
function fillFields(){for(const f of fields){const el=document.querySelector(`[data-path="${f[0]}"]`);if(f[3]==='checkbox')el.checked=get(config,f[0]);else{const value=get(config,f[0]);el.value=typeof value==='number'?Number((value*(f[6]??1)).toPrecision(12)):(value??'');}}$('#config-editor').value=JSON.stringify(config,null,2);updateInputKind();}
function updateInputKind(){const periodic=document.querySelector('[data-path="input.input_kind"]').value==='periodic';for(const f of fields.filter(f=>f[0].startsWith('input.frequency')||f[0].includes('amplitudes_m.')||f[0].includes('phases_rad.'))){const wrapper=document.querySelector(`[data-for="${f[0]}"]`);wrapper.classList.toggle('hidden',!periodic);wrapper.querySelector('input').disabled=!periodic;}$('#irregular-note').hidden=document.querySelector('[data-path="input.input_kind"]').value!=='irregular';}
function readFields(){const next=structuredClone(config);for(const f of fields){const el=document.querySelector(`[data-path="${f[0]}"]`);if(el.disabled)continue;set(next,f[0],f[3]==='checkbox'?el.checked:f[3]==='select'?el.value:Number(el.value)/(f[6]??1));}if(next.input.input_kind==='irregular'&&!next.input.irregular_frequencies_hz)Object.assign(next.input,preset('irregular').input,{feedback:next.input.feedback,ramp_s:next.input.ramp_s,initial_roll_rad:next.input.initial_roll_rad});return next;}
function status(message,error=false){$('#status').textContent=message;$('#status').classList.toggle('error',error);}
function calculate(next){try{validate(next);}catch(error){status(error.message,true);return false;}
 config=structuredClone(next);dirty=false;fillFields();document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',JSON.stringify(preset(b.dataset.preset))===JSON.stringify(config)));const id=++job;worker?.terminate();worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});status('Calculating…');$('#run').disabled=true;
 worker.onmessage=({data})=>{if(data.id!==job)return;if(data.type==='progress'){status(`Calculating… ${Math.round(data.progress*100)}%`);return;}$('#run').disabled=false;
  if(data.type==='error'){dirty=true;status(data.message+(run?' Previous results remain displayed.':''),true);return;}
  run=data.run;time=0;playing=true;$('#play').textContent='Ⅱ';$('#play').setAttribute('aria-label','Pause animation');$('#scrubber').max=config.numerics.duration_s;$('#scrubber').step=config.numerics.sample_dt_s;$('#csv-download').disabled=false;
  const st=run.stats;$('#heave-stat').textContent=st.heaveRmsMm.toFixed(3);$('#roll-stat').textContent=st.rollRmsDeg<1e-10?'≈ 0':st.rollRmsDeg.toFixed(4);$('#force-stat').textContent=st.peakForceN.toFixed(1);$('#contact-stat').textContent=(100*st.contactLossFraction).toFixed(2);
  $('#analysis-note').textContent=`Statistics: ${config.numerics.analysis_start_s}–${config.numerics.duration_s} s inclusive. The visible trace window follows playback.`;
  const d=run.derived;$('#numerical-note').textContent=`Static force ${d.staticForce.toFixed(1)} N per support · Natural frequencies: heave ${d.heaveFrequency.toFixed(2)} Hz, roll ${d.rollFrequency.toFixed(2)} Hz · Maximum work–energy residual ${st.maxEnergyResidualJ.toExponential(2)} J`;
  status(`${st.sampleCount.toLocaleString()} samples ready · ${config.numerics.duration_s} s simulated${st.contactLossFraction>0?' · Contact loss occurred':''}`);viewer?.update(run.samples[0],config.parameters);viewer?.setCamera($('#camera').value,config.parameters.equilibrium_com_height_m);
 };
 worker.onerror=error=>{status(`Simulation worker failed: ${error.message}`,true);$('#run').disabled=false;};worker.postMessage({id,config});return true;
}
function download(name,text,mime){const url=URL.createObjectURL(new Blob([text],{type:mime}));const link=document.createElement('a');link.href=url;link.download=name;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#toggle-settings').onclick=()=>{const expanded=$('.settings').classList.toggle('expanded');$('#toggle-settings').textContent=expanded?'Hide parameters':'Show all parameters';$('#toggle-settings').setAttribute('aria-expanded',expanded);};
renderFields();$('#parameters').addEventListener('submit',e=>{e.preventDefault();calculate(readFields());});
$('#parameters').addEventListener('input',()=>{dirty=true;status('Parameters changed. Run simulation to apply them.');document.querySelectorAll('[data-preset]').forEach(b=>b.classList.remove('active'));updateInputKind();});
for(const button of document.querySelectorAll('[data-preset]'))button.onclick=()=>{document.querySelectorAll('[data-preset]').forEach(b=>b.classList.toggle('active',b===button));calculate(preset(button.dataset.preset));};
$('#reset').onclick=()=>calculate(preset());
$('#play').onclick=()=>{playing=!playing;$('#play').textContent=playing?'Ⅱ':'▶';$('#play').setAttribute('aria-label',playing?'Pause animation':'Play animation');};
$('#restart').onclick=()=>{time=0;};$('#scrubber').oninput=e=>{time=Number(e.target.value);playing=false;$('#play').textContent='▶';$('#play').setAttribute('aria-label','Play animation');};
$('#camera').onchange=()=>viewer?.setCamera($('#camera').value,run?.config.parameters.equilibrium_com_height_m??1.5);
for(const [id,mode] of [['view-rath','rath'],['view-model','model']])$("#"+id).onclick=()=>{viewer?.setMode(mode);$('#view-rath').classList.toggle('active',mode==='rath');$('#view-model').classList.toggle('active',mode==='model');$('#view-note').textContent=mode==='rath'?'Illustrative mesh · Unamplified motion':'Computed contacts · Force arrows: 0.75 mm/N';$('#scope').textContent=mode==='rath'?'The rath mesh illustrates the computed pose; its shape does not determine the model’s mass, inertia or contacts. Its small motion is easier to see in the traces.':'The analytical body shows the assumed COM and effective contact locations. Coloured bars are undeformed support references, not solid pads. Arrows show computed upward force.';};
$('#config-download').onclick=()=>{const current=readFields();download('rath-config.json',JSON.stringify(current,null,2),'application/json');};
$('#csv-download').onclick=()=>{if(run)download('rath-trajectory.csv',toCSV(run),'text/csv');};
$('#config-apply').onclick=()=>{try{calculate(JSON.parse($('#config-editor').value));}catch(error){status(`Invalid JSON: ${error.message}`,true);}};
$('#config-upload').onchange=async e=>{const file=e.target.files[0];if(!file)return;try{if(file.size>500000)throw Error('Configuration file is too large.');calculate(JSON.parse(await file.text()));}catch(error){status(`Import failed: ${error.message}`,true);}e.target.value='';};
const chart=$('#traces');const ctx=chart.getContext('2d');let lastChart=-1;
function charts(sample){const w=chart.clientWidth,h=430,dpr=Math.min(devicePixelRatio,2);if(chart.width!==Math.round(w*dpr)){chart.width=Math.round(w*dpr);chart.height=h*dpr;}ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,w,h);if(!run)return;
 const start=Math.max(0,Math.min(sample.t-4,run.config.numerics.duration_s-8)),end=Math.min(run.config.numerics.duration_s,start+8),duration=Math.max(.001,end-start);const visible=run.samples.filter(s=>s.t>=start&&s.t<=end),p=run.config.parameters,b0=run.derived.supportHeight;
 const rows=[{name:'Support (mm)',get:s=>s.support.map(x=>(x-b0)*1000),min:4.5},{name:'Heave (mm)',get:s=>[(s.z-p.equilibrium_com_height_m)*1000],min:5.5},{name:'Roll (degrees)',get:s=>[s.roll*180/Math.PI],min:.3},{name:'Force (N)',get:s=>s.force,min:run.derived.staticForce*1.15,positive:true}];
 const left=65,right=w-12;
 rows.forEach((row,i)=>{const top=25+i*100,height=57;let max=row.min;for(const s of visible)for(const v of row.get(s))max=Math.max(max,Math.abs(v)*1.08);const lo=row.positive?0:-max,hi=max;const yy=v=>top+height-(v-lo)/(hi-lo)*height;
  ctx.fillStyle='#4c6055';ctx.font='11px system-ui';ctx.textAlign='left';ctx.fillText(row.name,left,top-10);
  ctx.lineWidth=1;ctx.strokeStyle='#e4e9e3';ctx.font='9px system-ui';ctx.fillStyle='#7c887e';for(const v of row.positive?[0,max/2,max]:[-max,0,max]){const y=yy(v);ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(right,y);ctx.stroke();ctx.textAlign='right';ctx.fillText(Math.abs(v)<.01?'0':Math.abs(v)<1?v.toFixed(2):v.toFixed(1),left-9,y+3);}
  for(let tick=0;tick<=4;tick++){const x=left+(right-left)*tick/4;ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,top+height);ctx.stroke();ctx.textAlign='center';ctx.fillText((start+duration*tick/4).toFixed(1),x,top+height+13);}
  for(let j=0;j<row.get(sample).length;j++){ctx.strokeStyle=i===2?'#786092':j===0?'#376574':'#b46f37';ctx.setLineDash(j===1?[5,3]:[]);ctx.lineWidth=1.4;ctx.beginPath();visible.forEach((s,k)=>{const x=left+(s.t-start)/duration*(right-left),y=yy(row.get(s)[j]);k===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.stroke();ctx.setLineDash([]);}
  const cursor=left+(sample.t-start)/duration*(right-left);ctx.strokeStyle='#435d48';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cursor,top);ctx.lineTo(cursor,top+height);ctx.stroke();
 });ctx.textAlign='right';ctx.font='10px system-ui';ctx.fillStyle='#748077';ctx.fillText('Time (s)',right,425);
}
function tick(now){const elapsed=lastFrame?Math.min((now-lastFrame)/1000,.1):0;lastFrame=now;if(run){if(playing)time=Math.min(time+elapsed*Number($('#speed').value),run.config.numerics.duration_s);if(time>=run.config.numerics.duration_s){playing=false;$('#play').textContent='▶';$('#play').setAttribute('aria-label','Play animation');}
 const idx=Math.min(run.samples.length-1,Math.max(0,Math.round(time/run.config.numerics.sample_dt_s))),sample=run.samples[idx];viewer?.update(sample,run.config.parameters);$('#scrubber').value=sample.t;$('#time').textContent=`${sample.t.toFixed(2)} / ${run.config.numerics.duration_s.toFixed(2)} s`;if(now-lastChart>80){charts(sample);lastChart=now;}}
 viewer?.render();requestAnimationFrame(tick);
}
// Read-only diagnostics for automated cross-engine and world-transform checks.
window.rathLab={getRun:()=>run,getConfig:()=>structuredClone(config),isDirty:()=>dirty,getViewer:()=>viewer,run:calculate,seek:t=>{time=t;playing=false;},getTime:()=>time};
calculate(config);requestAnimationFrame(tick);

import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
import {sha256} from './content-digest.mjs';
const base=process.env.APP_URL||'http://127.0.0.1:8087/',output=process.env.PROOF_DIR||'test-results';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
try{
 const page=await browser.newPage({viewport:{width:1440,height:1100}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.rathLab?.getRun()&&window.rathLab.getViewer()?.asset,{timeout:60000});
 assert.equal(await page.title(),'Rath · Research simulation');
 assert.match(await page.locator('.research-context').textContent(),/sole purpose is scientific research/);
 assert.match(await page.locator('#scope').textContent(),/Nalin Dhiman, IIT Mandi/);
 assert.equal(await page.locator('.site-nav a').first().getAttribute('href'),'./overview.html');
 assert.equal(await page.evaluate(()=>performance.getEntriesByType('resource').some(r=>r.name.endsWith('.mp4'))),false);
 assert.equal(await page.locator('#asset-status').textContent(),'');
 const manifestResponse=await page.request.get(new URL('build-info.json',base).href);assert.ok(manifestResponse.ok());const manifest=await manifestResponse.json();
 assert.equal(sha256(JSON.stringify(manifest.files)),manifest.sha256);
 for(const file of manifest.files){assert.ok(!file.path.includes('..')&&!file.path.startsWith('/'));const response=await page.request.get(new URL(file.path,base).href);assert.ok(response.ok(),file.path);assert.equal(sha256(await response.body()),file.sha256,file.path);}
 assert.equal(await page.evaluate(()=>window.rathLab.getPlaybackMode()),'live');
 const first=await page.evaluate(()=>window.rathLab.getRun().simulatedUntil);
 await page.waitForFunction(t=>window.rathLab.getRun().simulatedUntil>t+.6,first);
 await page.click('#play');await page.waitForTimeout(300);const paused=await page.evaluate(()=>window.rathLab.getRun().simulatedUntil);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>window.rathLab.getRun().simulatedUntil),paused);
 await page.locator('[data-path="gait.step_hz.1"]').fill('2.12');await page.waitForFunction(()=>window.rathLab.getRun()?.config.gait.step_hz[1]===2.12);assert.ok(await page.evaluate(()=>window.rathLab.getRun().simulatedUntil<2));
 // Run a bounded whole trajectory for reproducible transfer and interaction checks.
 await page.evaluate(async()=>{const {preset}=await import('./src/walking.js');const c=preset('Gvar');c.numerics.duration_s=24;window.rathLab.run(c);});
 await page.waitForFunction(()=>window.rathLab.getRun()?.complete&&window.rathLab.getRun()?.config.gait.step_hz[1]===2.04);
 await page.evaluate(()=>window.rathLab.seek(12.37));await page.waitForTimeout(150);
 const transfer=await page.evaluate(async()=>{
  const lab=window.rathLab,v=lab.getViewer(),run=lab.getRun();let seed=24092026;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const used=new Set();while(used.size<120)used.add(Math.floor(random()*run.samples.length));let pos=0,orientation=0,contactError=0,supportError=0;
  for(const i of used){const s=run.samples[i];v.update(s,run.config);const actual=v.pose.getWorldPosition(v.pose.position.clone()),q=v.pose.getWorldQuaternion(v.pose.quaternion.clone());pos=Math.max(pos,Math.hypot(actual.x,actual.y,actual.z-s.z));const norm=Math.hypot(...s.quaternion)*Math.hypot(q.w,q.x,q.y,q.z),dot=Math.abs((q.w*s.quaternion[0]+q.x*s.quaternion[1]+q.y*s.quaternion[2]+q.z*s.quaternion[3])/norm);orientation=Math.max(orientation,2*Math.acos(Math.min(1,dot)));for(let j=0;j<4;j++){const point=v.points[j].getWorldPosition(v.points[j].position.clone()).toArray();contactError=Math.max(contactError,Math.hypot(...point.map((x,k)=>x-s.points[j][k])));supportError=Math.max(supportError,Math.abs(v.refs[j].position.z-s.support[j]));}}
  const refs=await(await fetch('./assets/rath_geometry.json')).json();v.pose.position.set(0,0,0);v.pose.quaternion.identity();v.pose.updateMatrixWorld(true);let meshError=0,matched=0;for(const [o,a] of v.gltf.parser.associations){if(a.nodes===undefined)continue;const name=v.gltf.parser.json.nodes[a.nodes].name,ref=refs.objects.find(r=>r.name===name);if(!ref)continue;const point=o.getWorldPosition(o.position.clone());meshError=Math.max(meshError,Math.hypot(...point.toArray().map((x,i)=>x-ref.origin_z_up[i])));matched++;}
  return {random_frames:used.size,position_error_m:pos,orientation_error_rad:orientation,contact_position_error_m:contactError,support_height_error_m:supportError,mesh_origin_error_m:meshError,matched_components:matched};
 });for(const [key,value] of Object.entries(transfer))if(key.includes('error'))assert.ok(value<2e-6,`${key}: ${value}`);assert.equal(transfer.matched_components,39);
 await page.screenshot({path:output+'/desktop.png',fullPage:true});
 const truePose=await page.evaluate(()=>{const r=window.rathLab.getRun();return {csvSample:JSON.stringify(r.samples[1237]),stats:JSON.stringify(r.stats),readout:document.querySelector('#pitch-now').textContent};});
 await page.selectOption('#motion-gain','5');await page.waitForTimeout(150);assert.match(await page.locator('#view-note').textContent(),/MAGNIFIED 5/);assert.equal(await page.locator('#pitch-now').textContent(),truePose.readout);
 assert.deepEqual(await page.evaluate(()=>{const r=window.rathLab.getRun();return {csvSample:JSON.stringify(r.samples[1237]),stats:JSON.stringify(r.stats)};}),{csvSample:truePose.csvSample,stats:truePose.stats});
 const gainCheck=await page.evaluate(()=>{const v=window.rathLab.getViewer(),s=v.sample,p=window.rathLab.getRun().config.parameters;return Math.abs(v.pose.position.z-(p.z0+5*(s.z-p.z0)));});assert.ok(gainCheck<1e-12);
 await page.selectOption('#motion-gain','1');await page.click('#view-model');await page.selectOption('#camera','side');await page.waitForTimeout(150);await page.screenshot({path:output+'/analytical.png',fullPage:true});
 for(const camera of ['front','top','three-quarter']){await page.selectOption('#camera',camera);assert.equal(await page.evaluate(()=>window.rathLab.getViewer().cameraMode),camera);}
 // Change comparison modes through the actual controls, then finish each run.
 await page.selectOption('[data-path="mode"]','pitch_locked');await page.waitForFunction(()=>window.rathLab.getRun()?.config.mode==='pitch_locked');await page.click('#calculate-all');await page.waitForFunction(()=>window.rathLab.getRun()?.complete&&window.rathLab.getRun().config.mode==='pitch_locked');assert.equal(await page.evaluate(()=>window.rathLab.getRun().stats.pitchRmsDeg),0);
 await page.selectOption('[data-path="mode"]','collapsed');await page.waitForFunction(()=>window.rathLab.getRun()?.config.mode==='collapsed');assert.equal(await page.locator('.contact-card').count(),2);assert.match(await page.locator('#force-unit').textContent(),/not resolved/);assert.equal(await page.locator('#force-stat').textContent(),'—');
 const csv=page.waitForEvent('download');await page.click('#csv-download');assert.equal((await csv).suggestedFilename(),'rath-trajectory.csv');
 await page.click('details.configuration summary');const json=page.waitForEvent('download');await page.click('#config-download');assert.equal((await json).suggestedFilename(),'rath-config.json');
 await page.click('#copy-link');const link=await page.locator('#share-output').inputValue();assert.match(link,/#config=/);
 const shared=await browser.newPage();await shared.goto(link);await shared.waitForFunction(()=>window.rathLab?.getRun()?.config.mode==='collapsed');await shared.close();
 await page.locator('#config-editor').fill('{broken JSON');await page.click('#config-apply');assert.match(await page.locator('#status').textContent(),/Invalid JSON/);
 const bad=await page.evaluate(()=>window.rathLab.getConfig());bad.parameters.half_width=.001;await page.locator('#config-editor').fill(JSON.stringify(bad));await page.click('#config-apply');assert.match(await page.locator('#status').textContent(),/unstable/);
 // A stale worker must never overwrite a newer run.
 await page.evaluate(async()=>{const {preset}=await import('./src/walking.js');const a=preset();a.numerics.duration_s=180;window.rathLab.run(a);const b=preset('G0');b.numerics.duration_s=9;window.rathLab.run(b);});await page.waitForFunction(()=>window.rathLab.getRun()?.complete&&window.rathLab.getRun().config.numerics.duration_s===9);await page.waitForTimeout(200);assert.equal(await page.evaluate(()=>window.rathLab.getRun().config.numerics.duration_s),9);
 await page.selectOption('#model-family','reference');await page.waitForFunction(()=>window.rathLab.getRun()?.complete&&window.rathLab.getRun().config.schema_version===1);assert.equal(await page.locator('#live-mode').isDisabled(),true);assert.ok(await page.evaluate(()=>window.rathLab.getRun().stats.rollRmsDeg<1e-10));
 await page.click('[data-preset="irregular"]');await page.waitForFunction(()=>window.rathLab.getRun()?.complete&&window.rathLab.getRun().config.input.input_kind==='irregular');
 await page.selectOption('#model-family','walking');await page.waitForFunction(()=>window.rathLab.getRun()?.config.model==='walking');
 for(const [id,camera] of [['walk-heave','three-quarter'],['walk-roll','front'],['walk-pitch','side']]){await page.click(`[data-preset="${id}"]`);await page.waitForFunction(()=>window.rathLab.getRun()?.config.model==='walking');if(id!=='walk-heave')assert.equal(await page.locator('#camera').inputValue(),camera);}
 await page.click('#view-rath');await page.setViewportSize({width:390,height:844});await page.waitForTimeout(250);await page.screenshot({path:output+'/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.click('#toggle-settings');assert.equal(await page.locator('#parameters').isVisible(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const overview=await browser.newPage({viewport:{width:1200,height:900}});overview.on('pageerror',e=>errors.push(e.message));
 await overview.goto(new URL('overview.html',base).href,{waitUntil:'networkidle'});
 assert.equal(await overview.title(),'Rath · Research overview');
 const media=overview.locator('#research-video');
 assert.notEqual(await media.evaluate(v=>v.canPlayType('video/mp4; codecs="avc1.64001f, mp4a.40.2"')),'','Video checks require a browser with H.264/AAC support; set CHROME_PATH to an installed compatible browser.');
 await overview.waitForFunction(()=>document.querySelector('video').readyState>=1,null,{timeout:30000});
 const metadata=await media.evaluate(v=>({duration_seconds:v.duration,width:v.videoWidth,height:v.videoHeight,autoplay:v.autoplay,controls:v.controls,playsinline:v.playsInline}));
 assert.ok(Math.abs(metadata.duration_seconds-273.298866)<.1);assert.equal(metadata.width,1280);assert.equal(metadata.height,720);assert.equal(metadata.autoplay,false);assert.equal(metadata.controls,true);assert.equal(metadata.playsinline,true);
 await media.evaluate(async v=>{v.muted=true;await v.play();});await overview.waitForFunction(()=>document.querySelector('video').currentTime>.3);
 await media.evaluate(v=>{v.pause();v.currentTime=164;});await overview.waitForFunction(()=>{const v=document.querySelector('video');return !v.seeking&&Math.abs(v.currentTime-164)<.1&&v.readyState>=2;});
 assert.match(await overview.locator('#model-notes').textContent(),/implemented model/);
 assert.equal(await overview.locator('.site-nav a').first().getAttribute('href'),'./');
 await overview.screenshot({path:output+'/video-desktop.png',fullPage:true});
 await overview.setViewportSize({width:390,height:844});await overview.screenshot({path:output+'/video-mobile.png',fullPage:true});assert.ok(await overview.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
 const video={passed:true,...metadata,playback_verified:true,seek_verified_at_seconds:164,mobile_no_overflow:true};await overview.close();
 assert.deepEqual(errors,[]);
 await writeFile(output+'/browser-check.json',JSON.stringify({passed:true,url:base,build_sha256:manifest.sha256,transfer,video,checks:['live simulation advances and pauses','automatic restart on parameter edit','batch trajectory and stale-worker cancellation','120 seeded poses and four world contacts','39 original GLB component origins','magnification leaves physical results unchanged','front, side, top and orbit cameras','free/locked/collapsed pitch modes','individual loads hidden when unresolved','CSV/JSON export and share link reload','invalid JSON and unstable geometry rejection','original reference model compatibility','heave/roll/pitch presets','desktop/mobile no overflow or page errors','Rath identity, research purpose and attribution visible','simulator does not preload the overview video','overview video metadata, decoding, playback and seeking','overview navigation and mobile layout']},null,2));
 console.log(JSON.stringify({passed:true,transfer,video}));
}finally{await browser.close();}

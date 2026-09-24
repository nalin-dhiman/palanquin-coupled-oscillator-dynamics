import {chromium} from '@playwright/test';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const base=process.env.APP_URL||'http://127.0.0.1:8087/';const output=process.env.PROOF_DIR||'test-results';await mkdir(output,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||undefined,args:['--no-sandbox','--enable-unsafe-swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:1100}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.goto(base,{waitUntil:'networkidle'});await page.waitForFunction(()=>window.rathLab?.getRun()&&window.rathLab.getViewer()?.asset,{timeout:60000});
await page.evaluate(()=>window.rathLab.seek(6.2));await page.screenshot({path:output+'/desktop.png',fullPage:true});
assert.equal(await page.locator('#asset-status').textContent(),'');
const transfer=await page.evaluate(async()=>{
 const lab=window.rathLab,v=lab.getViewer(),run=lab.getRun();let seed=24092026;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};const used=new Set();while(used.size<120)used.add(Math.floor(random()*run.samples.length));let pos=0,orientation=0;
 for(const i of used){const s=run.samples[i];v.update(s,run.config.parameters);const actual=v.pose.getWorldPosition(v.pose.position.clone()),q=v.pose.getWorldQuaternion(v.pose.quaternion.clone());pos=Math.max(pos,Math.hypot(actual.x,actual.y,actual.z-s.z));const norm=Math.hypot(...s.quaternion);const dot=Math.abs((q.w*s.quaternion[0]+q.x*s.quaternion[1]+q.y*s.quaternion[2]+q.z*s.quaternion[3])/norm);orientation=Math.max(orientation,2*Math.acos(Math.min(1,dot)));}
 const refs=await(await fetch('./assets/rath_geometry.json')).json();v.pose.position.set(0,0,0);v.pose.quaternion.identity();v.pose.updateMatrixWorld(true);let meshError=0,matched=0;for(const [o,a] of v.gltf.parser.associations){if(a.nodes===undefined)continue;const name=v.gltf.parser.json.nodes[a.nodes].name;const ref=refs.objects.find(r=>r.name===name);if(!ref)continue;const point=o.getWorldPosition(o.position.clone());meshError=Math.max(meshError,Math.hypot(...point.toArray().map((x,i)=>x-ref.origin_z_up[i])));matched++;}
 return {random_frames:used.size,position_error_m:pos,orientation_error_rad:orientation,mesh_origin_error:meshError,matched_components:matched};
});assert.ok(transfer.position_error_m<2e-6);assert.ok(transfer.orientation_error_rad<2e-6);assert.ok(transfer.mesh_origin_error<2e-6);assert.equal(transfer.matched_components,39);
await page.click('#view-model');await page.selectOption('#camera','front');await page.screenshot({path:output+'/analytical.png',fullPage:true});
await page.click('button[data-preset="in-phase"]');await page.waitForFunction(()=>window.rathLab.getRun()?.config.input.phases_rad[1]===0&&document.querySelector('#run').disabled===false);assert.ok((await page.evaluate(()=>window.rathLab.getRun().stats.rollRmsDeg))<1e-10);
await page.locator('[data-path="parameters.mass_kg"]').fill('55');assert.match(await page.locator('#status').textContent(),/changed/);await page.click('#run');await page.waitForFunction(()=>window.rathLab.getRun()?.config.parameters.mass_kg===55);
const dl=page.waitForEvent('download');await page.click('#csv-download');assert.equal((await dl).suggestedFilename(),'rath-trajectory.csv');
await page.click('details.configuration summary');const configDl=page.waitForEvent('download');await page.click('#config-download');assert.equal((await configDl).suggestedFilename(),'rath-config.json');
await page.locator('#config-editor').fill('{broken JSON');await page.click('#config-apply');assert.match(await page.locator('#status').textContent(),/Invalid JSON/);
await page.click('button[data-preset="irregular"]');await page.waitForFunction(()=>window.rathLab.getRun()?.config.input.input_kind==='irregular'&&document.querySelector('#run').disabled===false);
const cfg=await page.evaluate(()=>window.rathLab.getConfig());cfg.parameters.half_span_m=.001;await page.locator('#config-editor').fill(JSON.stringify(cfg));await page.click('#config-apply');assert.match(await page.locator('#status').textContent(),/unstable/);
await page.click('#reset');await page.waitForFunction(()=>window.rathLab.getRun()?.config.input.input_kind==='periodic'&&document.querySelector('#run').disabled===false);await page.click('#view-rath');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:output+'/mobile.png',fullPage:true});assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
assert.deepEqual(errors,[]);await writeFile(output+'/browser-check.json',JSON.stringify({passed:true,url:base,transfer,checks:['desktop and mobile layout','WebGL and 39-component asset conversion','120 random displayed poses','preset switching','parameter edit and rerun','CSV and JSON downloads','malformed JSON rejection','unstable equilibrium rejection','irregular forcing','no page errors or horizontal overflow']},null,2));
console.log(JSON.stringify({passed:true,transfer}));await browser.close();

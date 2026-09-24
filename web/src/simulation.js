import * as legacy from './model.js';
import * as walking from './walking.js';
export const isWalking=c=>c?.schema_version===2&&c.model==='walking';
export const preset=(name='walk-G90')=>name.startsWith('walk-')?walking.preset(name.slice(5)):legacy.preset(name);
export const validate=c=>c?.schema_version===1?legacy.validate(c):walking.validate(c);
export const simulate=(c,progress)=>isWalking(c)?walking.simulate(c,progress):legacy.simulate(c,progress);
export const toCSV=run=>isWalking(run.config)?walking.toCSV(run):legacy.toCSV(run);
export function viewParameters(c){const p=c.parameters;return isWalking(c)?{
 z0:p.z0,a:p.half_width,l:p.half_length,h:p.com_height,walking:true,collapsed:c.mode==='collapsed'}:
 {z0:p.equilibrium_com_height_m,a:p.half_span_m,l:0,h:p.com_height_above_support_m,walking:false,collapsed:false};}

// Publish only the tested static app; the source checkout is never uploaded as a site.
import {execFileSync} from 'node:child_process';
import {mkdtemp,cp,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=fileURLToPath(new URL('..',import.meta.url));
const run=(cmd,args,cwd=repo,capture=false)=>execFileSync(cmd,args,{cwd,encoding:'utf8',stdio:capture?['ignore','pipe','pipe']:'inherit'});
run('npm',['test']);run('npm',['run','build']);run('npm',['run','check:release']);
const origin=run('git',['remote','get-url','origin'],repo,true).trim();
const existing=run('git',['ls-remote','--heads',origin,'interactive-site'],repo,true).trim();
const temp=await mkdtemp(join(tmpdir(),'rath-pages-'));const site=join(temp,'site');
try{
 if(existing)run('git',['clone','--depth','1','--single-branch','--branch','interactive-site',origin,site]);
 else{run('git',['init','--initial-branch=interactive-site',site]);run('git',['remote','add','origin',origin],site);}
 for(const name of await readdir(site))if(name!=='.git')await rm(join(site,name),{recursive:true,force:true});
 await cp(join(repo,'dist'),site,{recursive:true});
 for(const key of ['user.name','user.email'])run('git',['config',key,run('git',['config',key],repo,true).trim()],site);
 run('git',['add','--all'],site);
 const changed=run('git',['status','--porcelain'],site,true).trim();
 if(changed){run('git',['commit','-m','Publish tested interactive lab'],site);run('git',['push','origin','HEAD:interactive-site'],site);}
 else console.log('The published app is already current.');
}finally{await rm(temp,{recursive:true,force:true});}

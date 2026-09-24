import {readdir,readFile,lstat} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
export const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function inventory(root){
 const files=[];
 async function walk(path=''){
  for(const name of (await readdir(join(root,path))).sort()){
   const relative=path?path+'/'+name:name;if(relative==='build-info.json')continue;
   const info=await lstat(join(root,relative));if(info.isSymbolicLink())throw Error(`Release cannot contain symlinks: ${relative}`);
   if(info.isDirectory())await walk(relative);else files.push({path:relative,sha256:sha256(await readFile(join(root,relative)))});
  }
 }
 await walk();return {sha256:sha256(JSON.stringify(files)),files};
}

import {cp,mkdir,rm,writeFile} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await cp('web','dist',{recursive:true});await mkdir('dist/vendor/three',{recursive:true});
for(const file of ['three.module.js','three.core.js'])await cp(`node_modules/three/build/${file}`,`dist/vendor/three/${file}`);
for(const file of ['controls/OrbitControls.js','loaders/GLTFLoader.js','utils/BufferGeometryUtils.js']){await mkdir(`dist/vendor/three/addons/${file.split('/')[0]}`,{recursive:true});await cp(`node_modules/three/examples/jsm/${file}`,`dist/vendor/three/addons/${file}`);}
await cp('node_modules/three/LICENSE','dist/vendor/three/LICENSE');await writeFile('dist/.nojekyll','');console.log('Built self-contained static app in dist/');
const {inventory}=await import('./content-digest.mjs');await writeFile('dist/build-info.json',JSON.stringify(await inventory('dist'),null,2)+'\n');

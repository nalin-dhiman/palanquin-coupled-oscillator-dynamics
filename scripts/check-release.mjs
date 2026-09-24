// Enforce the user's code-only publication boundary and a verified browser build.
import {execFileSync} from 'node:child_process';
import {readFile,lstat} from 'node:fs/promises';
import {inventory} from './content-digest.mjs';
const source=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const rootAllowed=new Set(['.gitignore','LICENSE','README.md','package.json','package-lock.json']);
for(const path of source){
 if(!rootAllowed.has(path)&&! /^(web|python|scripts|tests|docs)\//.test(path))throw Error(`Source path outside publication allowlist: ${path}`);
 if(/\.(pdf|tex|bib|aux|log|out|npz|csv|mp4|blend\d*|zip|pem|key)$/i.test(path)||/(^|\/)(manuscript|main_submission|supplementary_information)(\.|\/)/i.test(path))throw Error(`Prohibited research/generated file: ${path}`);
 if(path.endsWith('.png')&&!/^docs\/images\/[^/]+\.png$/.test(path))throw Error(`Image outside reviewed documentation folder: ${path}`);
 if((await lstat(path)).isSymbolicLink())throw Error(`Source publication cannot contain symlinks: ${path}`);
}
const build=await inventory('dist'),manifest=JSON.parse(await readFile('dist/build-info.json'));
if(build.sha256!==manifest.sha256)throw Error('Build manifest is stale; rebuild.');
for(const file of build.files)if(!/^(index\.html|style\.css|\.nojekyll|(walking-)?default-config\.json|src\/[a-z-]+\.js|assets\/(rath\.glb|rath_geometry\.json)|vendor\/three\/(LICENSE|[a-z.]+\.js|addons\/(controls\/OrbitControls|loaders\/GLTFLoader|utils\/BufferGeometryUtils)\.js))$/.test(file.path))throw Error(`Unexpected site file: ${file.path}`);
const report=JSON.parse(await readFile('test-results/browser-check.json'));
if(!report.passed||report.build_sha256!==build.sha256||report.transfer.random_frames<100)throw Error('Run browser checks on this exact build before publishing.');
console.log(`Release checked: ${source.length} source/assets/docs files; ${build.files.length} site files; verified build ${build.sha256}.`);

// Publish code/assets and the one expressly requested overview video; no manuscripts.
import {execFileSync} from 'node:child_process';
import {readFile,lstat} from 'node:fs/promises';
import {inventory,sha256} from './content-digest.mjs';
const source=execFileSync('git',['ls-files','--cached','--others','--exclude-standard','-z'],{encoding:'utf8'}).split('\0').filter(Boolean);
const rootAllowed=new Set(['.gitignore','LICENSE','README.md','package.json','package-lock.json']);
const approvedVideo='web/media/rath-overview.mp4';
for(const path of source){
 if(!rootAllowed.has(path)&&! /^(web|python|scripts|tests|docs)\//.test(path))throw Error(`Source path outside publication allowlist: ${path}`);
 if((path!==approvedVideo&&/\.(pdf|tex|bib|aux|log|out|npz|csv|mp4|blend\d*|zip|pem|key)$/i.test(path))||/(^|\/)(manuscript|main_submission|supplementary_information)(\.|\/)/i.test(path))throw Error(`Prohibited research/generated file: ${path}`);
 if(path.endsWith('.png')&&!/^docs\/images\/[^/]+\.png$/.test(path))throw Error(`Image outside reviewed documentation folder: ${path}`);
 if((await lstat(path)).isSymbolicLink())throw Error(`Source publication cannot contain symlinks: ${path}`);
}
const provenance=JSON.parse(await readFile('web/media/provenance.json'));
const video=await readFile(approvedVideo);
if(provenance.file!=='rath-overview.mp4'||video.length!==provenance.size_bytes||video.length>50*1024*1024||sha256(video)!==provenance.sha256)throw Error('The approved overview video does not match its recorded provenance.');
const build=await inventory('dist'),manifest=JSON.parse(await readFile('dist/build-info.json'));
if(build.sha256!==manifest.sha256)throw Error('Build manifest is stale; rebuild.');
for(const file of build.files)if(!/^(index\.html|overview\.html|style\.css|\.nojekyll|(walking-)?default-config\.json|src\/[a-z-]+\.js|assets\/(rath\.glb|rath_geometry\.json)|media\/(rath-overview\.mp4|rath-overview-poster\.jpg|provenance\.json)|vendor\/three\/(LICENSE|[a-z.]+\.js|addons\/(controls\/OrbitControls|loaders\/GLTFLoader|utils\/BufferGeometryUtils)\.js))$/.test(file.path))throw Error(`Unexpected site file: ${file.path}`);
const builtVideo=build.files.find(file=>file.path==='media/rath-overview.mp4');
if(builtVideo?.sha256!==provenance.sha256)throw Error('The built video differs from the supplied original.');
const report=JSON.parse(await readFile('test-results/browser-check.json'));
if(!report.passed||report.build_sha256!==build.sha256||report.transfer.random_frames<100||!report.video?.passed)throw Error('Run browser checks on this exact build before publishing.');
console.log(`Release checked: ${source.length} source/assets/docs files; ${build.files.length} site files; verified build ${build.sha256}.`);

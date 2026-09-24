"""Gate every long-video render on evaluated Blender pose and rigid-mesh readback."""
import bpy,numpy as np,json,hashlib,sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();meta=json.loads((out/'long_frame_map.json').read_text());s=bpy.context.scene;assert s.rigidbody_world is None
source={}
for name,item in meta['sources'].items():
 p=out/item['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'];source[name]=dict(np.load(p))
rng=np.random.default_rng(24092026);selected=set(map(int,rng.choice(np.arange(1,1441),160,replace=False)));selected|={1,720,721,1440}
for name,d in source.items():
 rr=[r for r in meta['frames'] if r['case']==name];indices=[r['index'] for r in rr]
 for vec in [d['position'][:,2],d['state'][:,1]]:
  for fn in [np.argmin,np.argmax]:selected.add(rr[int(fn(vec[indices]))]['frame'])
err={'position_m':0.,'orientation_rad':0.,'rigid_matrix_max_abs':0.}
for frame in sorted(selected):
 s.frame_set(frame);bpy.context.view_layer.update();deps=bpy.context.evaluated_depsgraph_get();mat=bpy.data.objects['NumericalPose'].evaluated_get(deps).matrix_world.copy();r=meta['frames'][frame-1];d=source[r['case']];k=r['index']
 q=np.array(mat.to_quaternion(),dtype=np.float64);q/=np.linalg.norm(q);q0=d['quaternion'][k];q0=q0/np.linalg.norm(q0)
 err['position_m']=max(err['position_m'],float(np.linalg.norm(np.array(mat.translation)-d['position'][k])));err['orientation_rad']=max(err['orientation_rad'],float(2*np.arccos(np.clip(abs(q@q0),0,1))))
 for name,local in meta['local_matrices'].items():err['rigid_matrix_max_abs']=max(err['rigid_matrix_max_abs'],float(np.max(np.abs(np.array(bpy.data.objects[name].evaluated_get(deps).matrix_world)-np.array(mat)@np.array(local)))))
assert all(v<2e-6 for v in err.values()),err
s['transfer_valid']=True;s.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=str(out/'rath_120s.blend'))
report={'passed':True,'seed':24092026,'random_frames':160,'unique_frames':len(selected),'frames':sorted(selected),'max_errors':err,'tolerances':2e-6,'scene_sha256':hashlib.sha256((out/'rath_120s.blend').read_bytes()).hexdigest(),'map_sha256':hashlib.sha256((out/'long_frame_map.json').read_bytes()).hexdigest(),'source_hashes':meta['sources']}
(out/'long_transfer.json').write_text(json.dumps(report,indent=2));print(json.dumps({'passed':True,'frames':len(selected),'max_errors':err}))

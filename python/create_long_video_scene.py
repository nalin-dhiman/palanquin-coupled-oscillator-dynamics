"""Bind the apparatus to two NEW 64-s trajectories for a 120-s replay.
Usage: blender context.blend -b --python create_long_video_scene.py -- OUTPUT_DIR
The output directory contains long_trajectories/{in_phase,phase_offset}.npz.
"""
import bpy,numpy as np,json,hashlib,sys
from pathlib import Path
from mathutils import Matrix,Vector
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();out.mkdir(exist_ok=True);s=bpy.context.scene
assert s.rigidbody_world is None
props=[o for o in s.objects if o.type in {'MESH','CURVE'} and not o.name.startswith(('Front ','Rear ')) and o.name!='Ground']
for o in list(s.objects):
 if o.type in {'MESH','CURVE'} and o not in props:bpy.data.objects.remove(o,do_unlink=True)
root=bpy.data.objects.new('NumericalPose',None);s.collection.objects.link(root);root.rotation_mode='QUATERNION';root.location=(0,0,1.5);bpy.context.view_layer.update();inv=root.matrix_world.inverted();local={}
for o in props:
 old=o.matrix_world.copy();o.parent=root;o.matrix_parent_inverse=Matrix.Identity(4);o.matrix_basis=inv@old;local[o.name]=[list(row) for row in o.matrix_basis]
sources={};frames=[];frame=1
for name in ['in_phase','phase_offset']:
 p=out/'long_trajectories'/f'{name}.npz';d=dict(np.load(p));sources[name]={'file':str(p.relative_to(out)),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
 for k in np.rint(np.linspace(400,6400,720)).astype(int):
  root.location=d['position'][k];root.rotation_quaternion=d['quaternion'][k];root.keyframe_insert('location',frame=frame);root.keyframe_insert('rotation_quaternion',frame=frame)
  frames.append({'frame':frame,'case':name,'index':int(k),'time_s':float(d['time'][k])});frame+=1
s.render.engine='BLENDER_WORKBENCH';s.display.shading.light='STUDIO';s.display.shading.color_type='MATERIAL';s.display.shading.show_shadows=False;s.display.shading.show_cavity=True;s.display.shading.cavity_type='BOTH';s.display.shading.background_type='WORLD';s.world.color=(1,1,1)
s.render.resolution_x=1000;s.render.resolution_y=630;s.render.resolution_percentage=100;s.render.film_transparent=True;s.render.image_settings.color_mode='RGBA';s.render.image_settings.file_format='PNG'
s.camera=bpy.data.objects['three_quarter'];s.camera.location=(4.8,-6.8,3.5);s.camera.rotation_euler=(Vector((0,0,1.85))-s.camera.location).to_track_quat('-Z','Y').to_euler();s.camera.data.ortho_scale=3.65
s.frame_start=1;s.frame_end=1440;s.render.fps=12;s['transfer_valid']=False;s['purpose']='Illustrative mesh replay of fresh synthetic trajectories; no empirical rath calibration';s.frame_set(1)
(out/'long_frame_map.json').write_text(json.dumps({'fps':12,'duration_s':120,'sources':sources,'frames':frames,'local_matrices':local,'physical_interval_per_case_s':[4,64]},indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(out/'rath_120s.blend'))

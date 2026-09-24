"""Export the procedural apparatus, centred at the declared drawing-space origin.
Run Blender with the generated contextual_apparatus.blend and this script.
GLB uses standard Y-up; the web scene explicitly restores the solver's Z-up axes.
"""
import bpy,json,sys
from pathlib import Path
from mathutils import Matrix
rootdir=Path(__file__).resolve().parents[1];s=bpy.context.scene
props=[o for o in s.objects if o.type in {'MESH','CURVE'} and not o.name.startswith(('Front ','Rear ')) and o.name!='Ground']
for o in list(s.objects):
 if o not in props:bpy.data.objects.remove(o,do_unlink=True)
reference=[]
for o in props:
 o.location.z-=1.5
bpy.context.view_layer.update()
for o in props:
 reference.append({'name':o.name,'origin_z_up':list(o.matrix_world.translation)})
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=str(rootdir/'web/assets/rath.glb'),export_format='GLB',use_selection=True,export_animations=False,export_yup=True,export_apply=True)
(rootdir/'web/assets/rath_geometry.json').write_text(json.dumps({'objects':reference,'axis_mapping':'glTF (x,z,-y); restore using +pi/2 rotation about x','drawing_origin':[0,0,1.5],'metric_calibration':False},indent=2))
print('Exported',len(props),'original apparatus components')

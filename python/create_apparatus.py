#!/usr/bin/env python3
"""Original static Kullu apparatus schematic and separate immutable-data replay.
Run with installed Blender. No rigid-body world or human dynamics are created.
Contextual dimensions are illustrative proportions, not measured metres.
"""
import bpy, math, json, sys, hashlib
from pathlib import Path
from mathutils import Vector
import numpy as np
HERE=Path(__file__).resolve().parent.parent/'generated'; HERE.mkdir(exist_ok=True)
OUT=HERE/'stills'; OUT.mkdir(exist_ok=True)

def material(name,c):
 m=bpy.data.materials.new(name);m.diffuse_color=(*c,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*c,1);p.inputs['Roughness'].default_value=.85
 return m

def finish(o,name,mat,parent=None):
 o.name=name;o.data.materials.append(mat)
 if parent:o.parent=parent
 for p in o.data.polygons:p.use_smooth=True
 return o

def box(name,loc,dims,mat,parent=None,bevel=.01):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.scale=dims
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  b=o.modifiers.new('Soft edges','BEVEL');b.width=bevel;b.segments=3
  o.modifiers.new('Weighted normals','WEIGHTED_NORMAL')
 return finish(o,name,mat,parent)

def ellipsoid(name,loc,scale,mat,parent=None):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=32,ring_count=16,location=loc);o=bpy.context.object;o.scale=scale
 return finish(o,name,mat,parent)

def rod(name,a,b,r,mat,parent=None):
 a,b=Vector(a),Vector(b);v=b-a
 bpy.ops.mesh.primitive_cylinder_add(vertices=32,radius=r,depth=v.length,location=(a+b)/2)
 o=bpy.context.object;o.rotation_mode='QUATERNION';o.rotation_quaternion=v.to_track_quat('Z','Y')
 return finish(o,name,mat,parent)

def camera(name,loc,target,scale):
 bpy.ops.object.camera_add(location=loc);o=bpy.context.object;o.name=name
 o.rotation_euler=(Vector(target)-o.location).to_track_quat('-Z','Y').to_euler();o.data.type='ORTHO';o.data.ortho_scale=scale
 return o

def setup():
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=24;s.cycles.use_denoising=True
 s.render.resolution_x=1500;s.render.resolution_y=1050;s.render.resolution_percentage=100
 s.world.color=(.8,.8,.8);s.world.use_nodes=True;s.world.node_tree.nodes['Background'].inputs[0].default_value=(.93,.945,.95,1);s.world.node_tree.nodes['Background'].inputs[1].default_value=.7
 s.view_settings.view_transform='Standard';s.render.image_settings.file_format='PNG';s.render.film_transparent=False
 for loc,power,size in [((2,-4,6),450,5),((-3,2,5),300,4)]:
  bpy.ops.object.light_add(type='AREA',location=loc);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;o.rotation_euler=(-o.location).to_track_quat('-Z','Y').to_euler()
 return s

def context():
 s=setup();wood=material('Warm wood',(.30,.19,.10));cloth=material('Illustrative cloth',(.24,.06,.10));gold=material('Schematic metal plates',(.69,.53,.26));gray=material('Neutral human silhouettes',(.28,.33,.37));ground=material('Light ground',(.94,.95,.96))
 # Paired longitudinal poles. Bodies stand between them, head and neck clear.
 for y in [-.20,.20]:rod('Longitudinal pole',( -1.60,y,1.47),(1.60,y,1.47),.034,wood)
 # Chair-like frame with dressed back, not an idol placed on a pedestal.
 for x in [-.32,.32]:box('Frame cross member',(x,0,1.52),(.08,.64,.08),wood)
 for y in [-.27,.27]:box('Frame upright',(-.30,y,1.88),(.07,.07,.75),wood)
 box('Frame back',(-.32,0,1.99),(.065,.61,.54),wood)
 box('Cloth over frame',(-.20,0,1.89),(.27,.72,.77),cloth,bevel=.075)
 # Simple untailored drape, original arrangement, no copied ornament pattern.
 for y in [-.35,.35]:box('Cloth side',(0,y,1.74),(.62,.025,.80),cloth,bevel=.008)
 for z,ys in [(1.68,[-.18,.18]),(1.94,[-.22,0,.22]),(2.18,[-.12,.12])]:
  for y in ys:
   ellipsoid('Schematic mohra',(.012,y,z),(.035,.074,.084),gold)
   # Basic relief marking as a face, with no reproduction of a named face design.
   ellipsoid('Face relief',(.047,y,z),(.018,.013,.025),gold)
   for dy in [-.025,.025]:ellipsoid('Schematic eye',(.042,y+dy,z+.024),(.009,.009,.009),wood)
 # Assembled top arch rather than generic tall umbrella/column.
 curve=bpy.data.curves.new('Simple metal arch','CURVE');curve.dimensions='3D';curve.bevel_depth=.017;curve.bevel_resolution=3
 spline=curve.splines.new('POLY');spline.points.add(39)
 for j,point in enumerate(spline.points):
  angle=math.pi*j/39;point.co=(-.17,.30*math.cos(angle),2.16+.24*math.sin(angle),1)
 arch=bpy.data.objects.new('Simple metal arch',curve);s.collection.objects.link(arch);curve.materials.append(gold)
 for x in [-1.10,1.10]:
  tag='Rear' if x<0 else 'Front'
  # Rounded torso + shoulder volumes; poles tangent to shoulder tops at z=1.436.
  ellipsoid(tag+' torso',(x,0,1.13),(.145,.205,.29),gray)
  ellipsoid(tag+' pelvis',(x,0,.86),(.14,.175,.15),gray)
  for y in [-.185,.185]:ellipsoid(tag+' shoulder',(x,y,1.365),(.115,.085,.071),gray)
  rod(tag+' neck',(x,0,1.34),(x,0,1.53),.055,gray)
  ellipsoid(tag+' head',(x+.015,0,1.65),(.095,.09,.125),gray)
  for side in [-1,1]:
   hip=(x,side*.105,.86); knee=(x+side*.055,side*.115,.48);ankle=(x+side*.08,side*.13,.095)
   rod(tag+' thigh',hip,knee,.073,gray);ellipsoid(tag+' knee',knee,(.071,.071,.075),gray);rod(tag+' shin',knee,ankle,.056,gray)
   ellipsoid(tag+' foot',(ankle[0]+.065,ankle[1],.055),(.125,.065,.05),gray)
   shoulder=(x,side*.205,1.36);elbow=(x+.10,side*.30,1.10);hand=(x+.25,side*.20,1.47)
   rod(tag+' upper arm',shoulder,elbow,.047,gray);ellipsoid(tag+' elbow',elbow,(.049,.049,.049),gray);rod(tag+' forearm',elbow,hand,.036,gray);ellipsoid(tag+' contextual hand',hand,(.055,.045,.045),gray)
 box('Ground',(0,0,-.015),(200,200,.04),ground,bevel=0)
 views=[('side',(0,-7,1.4),(0,0,1.2),4.05),('front',(7,0,1.6),(0,0,1.2),4.05),('three_quarter',(4.8,-6.8,3.5),(0,0,1.22),4.45)]
 for name,loc,target,scale in views:camera(name,loc,target,scale)
 # White page background, preserving the original source-informed mesh.
 bpy.data.objects['Ground'].hide_render=True
 s.render.film_transparent=True
 s.render.image_settings.color_mode='RGBA'
 s.cycles.samples=48
 s.camera=bpy.data.objects['three_quarter'];s['purpose']='Static source-informed schematic; proportions unmeasured; no dynamics';s['visual_review_passed']=False; s['geometry_revision']='Bounded correction: flat cloth, face markers, full framing, ground contact'
 bpy.ops.wm.save_as_mainfile(filepath=str(HERE/'contextual_apparatus.blend'))
 for name,_,_,_ in views:
  s.camera=bpy.data.objects[name];s.render.filepath=str(OUT/(name+'.png'));bpy.ops.render.render(write_still=True)

if __name__=="__main__": context()

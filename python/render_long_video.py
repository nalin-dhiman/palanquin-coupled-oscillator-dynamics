import bpy,json,hashlib,sys
from pathlib import Path
out=Path(sys.argv[sys.argv.index('--')+1]).resolve();r=json.loads((out/'long_transfer.json').read_text());assert r['passed'] and bpy.context.scene.get('transfer_valid')
assert hashlib.sha256(Path(bpy.data.filepath).read_bytes()).hexdigest()==r['scene_sha256']
assert hashlib.sha256((out/'long_frame_map.json').read_bytes()).hexdigest()==r['map_sha256']
for item in r['source_hashes'].values():assert hashlib.sha256((out/item['file']).read_bytes()).hexdigest()==item['sha256']
(out/'long_frames').mkdir(exist_ok=True);bpy.context.scene.render.filepath=str(out/'long_frames/frame_');bpy.ops.render.render(animation=True)

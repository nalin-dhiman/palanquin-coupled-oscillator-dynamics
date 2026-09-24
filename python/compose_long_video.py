#!/usr/bin/env python3
"""Clean, labelled detailed-mesh replay with synchronized saved-data traces."""
from pathlib import Path
import json,subprocess,hashlib
import numpy as np
from PIL import Image,ImageDraw,ImageFont
import argparse
p=argparse.ArgumentParser();p.add_argument('output',type=Path);args=p.parse_args();HERE=args.output.resolve();ROOT=HERE
meta=json.loads((HERE/'long_frame_map.json').read_text());report=json.loads((HERE/'long_transfer.json').read_text())
assert report['passed']
font_path='/usr/share/texmf/fonts/opentype/public/lm/lmroman10-regular.otf'
def font(size):return ImageFont.truetype(font_path,size)
TITLE=font(46);H=font(32);F=font(28);SM=font(24)
INK='#25323c';MUTED='#56636c';BLUE='#246080';PURPLE='#754b88'
W,HGT=1920,1080;frames=HERE/'long_composite_frames';frames.mkdir(exist_ok=True);(HERE/'previews').mkdir(exist_ok=True)
data={}
for name,item in meta['sources'].items():
 p=ROOT/item['file'];assert hashlib.sha256(p.read_bytes()).hexdigest()==item['sha256'];data[name]=dict(np.load(p))
# Explicit, repeated chart geometry: both conditions have identical axes.
x0,x1=1100,1830;plot_h=170;ytops=[270,610]
max_text_right=0

def text(draw,xy,value,face=F,color=INK):
 global max_text_right
 box=draw.textbbox(xy,value,font=face);assert box[0]>=0 and box[2]<=W-25 and box[3]<=HGT-10,(value,box)
 max_text_right=max(max_text_right,box[2]);draw.text(xy,value,font=face,fill=color)

for rec in meta['frames']:
 d=data[rec['case']];k=rec['index'];image=Image.new('RGB',(W,HGT),'white');dr=ImageDraw.Draw(image)
 text(dr,(55,35),'The illustrated rath: replay of synthetic motion',TITLE)
 offset=0 if rec['case']=='in_phase' else 60
 text(dr,(55,106),f'{offset}° support phase offset   |   4 mm at 1.5 Hz   |   saved time {rec["time_s"]:.2f} s',H)
 dr.line((55,173,1865,173),fill='#dce2e5',width=2)
 text(dr,(55,211),'Original rath apparatus schematic',H)
 scene=Image.open(HERE/'long_frames'/f'frame_{rec["frame"]:04d}.png').convert('RGBA')
 # Alpha composition on white; no pixel-level changes to the Blender render.
 image.paste(scene,(25,285),scene)
 dr=ImageDraw.Draw(image)
 text(dr,(70,870),'Saved motion, without amplification',F)
 text(dr,(70,914),'Small motion is clearer in the traces.',SM,MUTED)
 window_start=max(4,min(rec['time_s']-4,56));window_end=window_start+8
 keep=(d['time']>=window_start)&(d['time']<=window_end);t=d['time'][keep]
 ys=[1000*(d['position'][keep,2]-1.5),np.degrees(d['state'][keep,1])]
 vals=[1000*(d['position'][k,2]-1.5),float(np.degrees(d['state'][k,1]))]
 for row,(series,lim,ticks,title,unit,color) in enumerate(zip(ys,[5.5,.3],[[-4,0,4],[-.3,0,.3]],['Heave','Roll'],['mm','degrees'],[BLUE,PURPLE])):
  top=ytops[row]; text(dr,(1100,top-59),f'{title} ({unit})',H)
  for tick in ticks:
   yy=top+plot_h/2-tick/lim*plot_h/2;dr.line((x0,yy,x1,yy),fill='#dce2e5',width=1)
   label=f'{tick:g}';bbox=dr.textbbox((0,0),label,font=SM);text(dr,(x0-18-(bbox[2]-bbox[0]),int(yy)-13),label,SM,MUTED)
  for tick in np.linspace(window_start,window_end,5):
   xx=x0+(tick-window_start)/8*(x1-x0);dr.line((xx,top,xx,top+plot_h),fill='#e5e9eb',width=1)
   text(dr,(int(xx)-13,top+plot_h+10),f'{tick:.1f}',SM,MUTED)
  dr.line(list(zip(x0+(t-window_start)/8*(x1-x0),top+plot_h/2-series/lim*plot_h/2)),fill=color,width=3)
  xx=x0+(rec['time_s']-window_start)/8*(x1-x0);yy=top+plot_h/2-vals[row]/lim*plot_h/2
  dr.line((xx,top,xx,top+plot_h),fill='#a63e45',width=2);dr.ellipse((xx-5,yy-5,xx+5,yy+5),fill=color)
  text(dr,(1110,top+plot_h+55),f'Current value: {vals[row]:+.3f} {unit}',SM,color)
 text(dr,(1430,877),'Saved time (s)',SM,MUTED)
 dr.line((55,973,1865,973),fill='#dce2e5',width=2)
 text(dr,(55,993),'Illustrative pose replay; the pictured rath’s mass, balance and contacts are unmeasured.',SM)
 text(dr,(55,1031),'New 64-second simulations. Each case shows 4–64 s at approximately real time; no motion amplification.',SM,MUTED)
 image.save(frames/f'frame_{rec["frame"]:04d}.png')
 if rec['frame'] in [1,360,720,721,1080,1440]:image.save(HERE/'previews'/f'rath_clip_check_{rec["frame"]:04d}.png')
subprocess.run(['ffmpeg','-hide_banner','-loglevel','error','-y','-framerate','12','-i',str(frames/'frame_%04d.png'),'-c:v','libx264','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',str(HERE/'rath_illustrative_replay_120s.mp4')],check=True)
(HERE/'long_video_composition.json').write_text(json.dumps({'frames':1440,'fps':12,'duration_s':120,'resolution':[W,HGT],'maximum_text_right_px':max_text_right,'text_within_canvas':True,'same_time_mapping_and_axes':True,'spatial_motion_amplification':1,'preview_frames':[1,360,720,721,1080,1440]},indent=2))
print('Wrote rath_illustrative_replay_120s.mp4')

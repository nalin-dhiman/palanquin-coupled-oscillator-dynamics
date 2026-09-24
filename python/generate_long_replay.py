#!/usr/bin/env python3
"""New 64-s integrations per condition; no repetition or stretching of a short clip."""
from pathlib import Path
import argparse,json,copy
from run import run
p=argparse.ArgumentParser();p.add_argument('--output',type=Path,required=True);args=p.parse_args()
config=json.loads((Path(__file__).resolve().parents[1]/'web/default-config.json').read_text());config['numerics']['duration_s']=64
for name,phase,initial in [('in_phase',0,.5),('phase_offset',60,0)]:
 c=copy.deepcopy(config);c['input']['phases_rad']=[0,phase*3.141592653589793/180];c['input']['initial_roll_rad']=initial*3.141592653589793/180
 d=run(c,args.output/(name+'.npz'));print(name,len(d['time']),'samples',flush=True)

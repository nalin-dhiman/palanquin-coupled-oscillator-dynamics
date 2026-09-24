#!/usr/bin/env python3
"""Run the independent NumPy reference solver; keep output outside the code repository."""
import argparse,json,hashlib
from pathlib import Path
import numpy as np
from model import Parameters,simulate

def run(config,output):
 n=config['numerics'];d=simulate(Parameters(**config['parameters']),config['input'],duration_s=n['duration_s'],dt_s=n['dt_s'],sample_dt_s=n['sample_dt_s'])
 output=Path(output);output.parent.mkdir(parents=True,exist_ok=True);np.savez_compressed(output,**d)
 output.with_suffix('.json').write_text(json.dumps({'config':config,'sha256':hashlib.sha256(output.read_bytes()).hexdigest(),'samples':len(d['time'])},indent=2))
 return d
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('config',type=Path);p.add_argument('output',type=Path);a=p.parse_args();run(json.loads(a.config.read_text()),a.output)

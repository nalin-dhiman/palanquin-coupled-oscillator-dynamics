"""Run an exported version-2 browser configuration with the Python reference."""
import argparse
import json
from pathlib import Path
import numpy as np
from walking_model import Parameters, Gait, WalkingDrive, System, simulate, metrics

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('config',type=Path)
    parser.add_argument('output',type=Path)
    args=parser.parse_args()
    config=json.loads(args.config.read_text())
    if config.get('schema_version')!=2 or config.get('model')!='walking':
        parser.error('Use a version-2 walking configuration exported from the app.')
    p=Parameters(**config['parameters']);g=Gait(**config['gait'])
    system=System(p,WalkingDrive(g,p),config['mode'])
    y=system.initial(config['initial']['roll_rad']);y[2]=config['initial']['pitch_rad']
    n=config['numerics']
    if not 0<=n['analysis_start_s']<n['duration_s']:
        parser.error('Analysis interval must begin before the run ends.')
    out=simulate(system,duration=n['duration_s'],dt=n['dt_s'],sample_dt=n['sample_dt_s'],initial=y)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    np.savez_compressed(args.output,**out,metadata_json=json.dumps(config))
    report=metrics(out,p,start=n['analysis_start_s'])
    if config['mode']=='collapsed':
        report['load_interpretation']='Patch values are equal allocations of two resultants; individual shoulder loads are unresolved.'
    print(json.dumps(report,indent=2))

if __name__=='__main__':main()

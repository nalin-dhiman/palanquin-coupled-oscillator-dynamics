"""Regenerate independent Python samples for all 21 walking comparisons.

Run from the repository root. Fixture regeneration is deliberately separate from
JS tests: a test run must not silently replace its expected values.
"""
import hashlib
import json
from pathlib import Path
import numpy as np
from walking_model import Parameters, Gait, WalkingDrive, System, simulate, metrics

root = Path(__file__).resolve().parents[1]
design = json.loads((root / 'tests/walking-design.json').read_text())
rows = []
for name, gait in design['cases'].items():
    for mode in design['modes']:
        p = Parameters(**design['parameters'])
        config = dict(schema_version=2, model='walking', mode=mode,
                      parameters=design['parameters'], gait=gait,
                      initial=dict(roll_rad=0., pitch_rad=0.),
                      numerics={k: design[k] for k in ('duration_s','dt_s','sample_dt_s','analysis_start_s')})
        out = simulate(System(p, WalkingDrive(Gait(**gait), p), mode),
                       duration=design['duration_s'], dt=design['dt_s'], sample_dt=design['sample_dt_s'])
        ids = sorted(set([0, 1, 199, 200, 800, 1600, 2400] + np.random.default_rng(24092026).choice(2401, 24, replace=False).tolist()))
        samples = [dict(index=i, t=float(out['time_s'][i]), state=out['state'][i].tolist(),
                        force=out['force_N'][i].tolist(), support=out['support_height_m'][i].tolist(),
                        quaternion=out['quaternion_wxyz'][i].tolist(), residual=float(out['energy_residual_J'][i])) for i in ids]
        rows.append(dict(name=name, mode=mode, config=config, samples=samples,
                         stats=metrics(out,p,start=design['analysis_start_s'])))
        print(name, mode, flush=True)
result = dict(generator='python/make_walking_reference.py',
              python_model_sha256=hashlib.sha256((root/'python/walking_model.py').read_bytes()).hexdigest(),
              note='Cross-language agreement at fixed dt, not empirical or contact-event convergence validation.', cases=rows)
(root/'tests/walking-reference.json').write_text(json.dumps(result, separators=(',',':'))+'\n')

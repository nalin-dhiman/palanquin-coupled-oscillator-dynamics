import argparse
import os
import json
import numpy as np
import copy
import pandas as pd
from run_ensemble import run_ensemble

def set_nested(d, key_path, value):
    """Set value in nested dict using dot notation."""
    keys = key_path.split('.')
    current = d
    for k in keys[:-1]:
        current = current.setdefault(k, {})
    current[keys[-1]] = value

def run_grid(template_path, out_root, p1_def, p2_def, n_seeds=20):
    with open(template_path, 'r') as f:
        base_config = json.load(f)
        
    # p1_def: (name, start, end, steps)
    p1_name, p1_s, p1_e, p1_n = p1_def
    p2_name, p2_s, p2_e, p2_n = p2_def
    
    p1_vals = np.linspace(p1_s, p1_e, int(p1_n))
    p2_vals = np.linspace(p2_s, p2_e, int(p2_n))
    
    results = []
    
    total_runs = len(p1_vals) * len(p2_vals)
    curr_run = 0
    
    print(f"Starting Grid Search: {p1_name} vs {p2_name}")
    print(f"Grid Size: {len(p1_vals)}x{len(p2_vals)} = {total_runs} points. Seeds per point: {n_seeds}")
    
    for v1 in p1_vals:
        for v2 in p2_vals:
            curr_run += 1
            point_name = f"p1_{v1:.3f}_p2_{v2:.3f}"
            print(f"[{curr_run}/{total_runs}] Running {p1_name}={v1:.3f}, {p2_name}={v2:.3f}...")
            
            # Prepare config
            cfg = copy.deepcopy(base_config)
            set_nested(cfg, p1_name, float(v1))
            set_nested(cfg, p2_name, float(v2))
            
            # Run Ensemble
            point_dir = os.path.join(out_root, point_name)
            
            # Save temporary config
            tmp_cfg_path = os.path.join(out_root, f"config_{point_name}.json")
            if not os.path.exists(out_root): os.makedirs(out_root)
            with open(tmp_cfg_path, 'w') as f:
                json.dump(cfg, f, indent=2)
            
            # Execute (using imported run_ensemble logic)
            # We need to capture the outputs. 
            # Ideally run_ensemble returns stats? It doesn't.
            # But it saves summary.csv.
            
            # To avoid spam, we might want to suppress prints or output
            # But run_ensemble is imported.
            run_ensemble(tmp_cfg_path, point_dir, n_seeds=n_seeds)
            
            # Clean up tmp config
            os.remove(tmp_cfg_path)
            
            # Parse results
            summary_path = os.path.join(point_dir, 'summary.csv')
            df = pd.read_csv(summary_path)
            
            # Compute Metrics
            instability_prob = np.mean(df['onset_time'] > 0)
            mean_roll = df['rms_roll'].mean()
            mean_loss = df['contact_loss'].mean()
            mean_sync = df['synchrony'].mean()
            mean_growth = df['growth_ratio'].mean()
            
            res = {
                p1_name: v1,
                p2_name: v2,
                'prob_instability': instability_prob,
                'mean_rms_roll': mean_roll,
                'mean_contact_loss': mean_loss,
                'mean_synchrony': mean_sync,
                'mean_growth': mean_growth
            }
            results.append(res)
            
            # Incremental save
            pd.DataFrame(results).to_csv(os.path.join(out_root, 'grid_results.csv'), index=False)
            
    print("Grid Search Complete.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('--template', required=True)
    parser.add_argument('--out', required=True)
    parser.add_argument('--p1', nargs=4, help="Name Start End Steps", required=True)
    parser.add_argument('--p2', nargs=4, help="Name Start End Steps", required=True)
    parser.add_argument('--seeds', type=int, default=20)
    
    args = parser.parse_args()
    
    # Parse param ranges
    p1 = (args.p1[0], float(args.p1[1]), float(args.p1[2]), int(args.p1[3]))
    p2 = (args.p2[0], float(args.p2[1]), float(args.p2[2]), int(args.p2[3]))
    
    run_grid(args.template, args.out, p1, p2, args.seeds)

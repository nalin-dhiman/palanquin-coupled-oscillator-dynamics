import os
import json
import argparse
import numpy as np
import copy
import csv
import sys

# Ensure we can import from local package
sys.path.append(os.getcwd())

from palanquin_v2.simulator import PalanquinSimulator

def run_ensemble(config_path, outdir, n_seeds=30):
    if not os.path.exists(outdir):
        os.makedirs(outdir)
        
    with open(config_path, 'r') as f:
        base_config = json.load(f)
        
    stats_list = []
    
    print(f"Starting Ensemble Run: {n_seeds} seeds")
    print(f"Config: {config_path}")
    print(f"Output: {outdir}")
    print("-" * 100)
    print(f"{'Seed':<6} | {'RMS Roll (deg)':<15} | {'Contact Loss':<12} | {'Onset (s)':<10} | {'Sync':<10} | {'Growth':<10} | {'Slack(s)':<10}")
    print("-" * 100)
    
    for i in range(n_seeds):
        # Unique seed per run
        seed = 1001 + i
        
        # Deepcopy to avoid mutation
        current_config = copy.deepcopy(base_config)
        current_config['sim']['seed'] = seed
        
        # Create subdir for this seed to avoid file collision and keep clean
        seed_dir = os.path.join(outdir, f"seed_{seed}")
        if not os.path.exists(seed_dir):
            os.makedirs(seed_dir)

        # Save the exact config used for this seed
        with open(os.path.join(seed_dir, 'config.json'), 'w') as f:
            json.dump(current_config, f, indent=2)
        
        # Initialize and Run
        # Quiet mode? Simulator prints headers.
        sim = PalanquinSimulator(current_config)
        
        # Redirect stdout to avoid spamming the console with per-sim logs?
        # Or just live with it. Live with it for now, but maybe add a spacer.
        
        stats = sim.run(seed_dir)
        
        # Collect relevant metrics
        row = {
            'seed': seed,
            'rms_roll': stats.get('rms_roll_deg', 0.0),
            'contact_loss': stats.get('contact_loss_avg', 0.0),
            'onset_time': stats.get('uncontrolled_onset_time', -1.0),
            'synchrony': stats.get('synchrony_index', 0.0),
            'growth_ratio': stats.get('growth_ratio_y', 0.0),
            'rms_y': stats.get('rms_y_m', 0.0),
            'slack_mean': stats.get('slack_mean_s', 0.0)
        }
        stats_list.append(row)
        
        print(f"{seed:<6} | {row['rms_roll']:<15.2f} | {row['contact_loss']:<12.3f} | {row['onset_time']:<10.1f} | {row['synchrony']:<10.3f} | {row['growth_ratio']:<10.2f} | {row['slack_mean']:<10.3f}")

    # Aggregation
    print("-" * 100)
    
    # Save CSV
    csv_path = os.path.join(outdir, 'summary.csv')
    keys = stats_list[0].keys()
    with open(csv_path, 'w', newline='') as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(stats_list)
        
    # Compute Summary Stats
    rolls = [s['rms_roll'] for s in stats_list]
    losses = [s['contact_loss'] for s in stats_list]
    onsets = [s['onset_time'] for s in stats_list]
    syncs = [s['synchrony'] for s in stats_list]
    
    def get_ci(data):
        mean = np.mean(data)
        std = np.std(data)
        ci = 1.96 * std / np.sqrt(len(data))
        return mean, ci
        
    roll_m, roll_ci = get_ci(rolls)
    loss_m, loss_ci = get_ci(losses)
    loss_m, loss_ci = get_ci(losses)
    sync_m, sync_ci = get_ci(syncs)
    slack_m, slack_ci = get_ci([s['slack_mean'] for s in stats_list])

    
    # Onset: Count how many detected (< 60s and > 0)
    n_uncontrolled = sum(1 for o in onsets if o > 0)
    
    print("\nEnsemble Summary:")
    print(f"RMS Roll:       {roll_m:.2f} +/- {roll_ci:.2f} deg")
    print(f"Contact Loss:   {loss_m:.3f} +/- {loss_ci:.3f}")
    print(f"Synchrony:      {sync_m:.3f} +/- {sync_ci:.3f}")
    print(f"Slack Mean:     {slack_m:.3f} +/- {slack_ci:.3f} s")
    print(f"Instability:    {n_uncontrolled}/{n_seeds} runs detected onset")
    
    # Save summary text
    with open(os.path.join(outdir, 'summary_stats.txt'), 'w') as f:
        f.write(f"RMS Roll:       {roll_m:.2f} +/- {roll_ci:.2f} deg\n")
        f.write(f"Contact Loss:   {loss_m:.3f} +/- {loss_ci:.3f}\n")
        f.write(f"Synchrony:      {sync_m:.3f} +/- {sync_ci:.3f}\n")
        f.write(f"Slack Mean:     {slack_m:.3f} +/- {slack_ci:.3f} s\n")
        f.write(f"Instability:    {n_uncontrolled}/{n_seeds} runs detected onset\n")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('config', type=str)
    parser.add_argument('--outdir', type=str, required=True)
    parser.add_argument('--seeds', type=int, default=30)
    args = parser.parse_args()
    
    run_ensemble(args.config, args.outdir, args.seeds)

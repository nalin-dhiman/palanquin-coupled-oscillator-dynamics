import os
import json
import csv
import glob
import sys

def aggregate(dir_path):
    print(f"Aggregating {dir_path}...")
    stats_list = []
    
    # partial read if summary.csv doesn't exist or is incomplete
    # We just crawl subdirs
    seed_dirs = glob.glob(os.path.join(dir_path, 'seed_*'))
    for s_dir in seed_dirs:
        try:
            stats_path = os.path.join(s_dir, 'stats.json')
            if not os.path.exists(stats_path):
                continue
                
            with open(stats_path, 'r') as f:
                stats = json.load(f)
                
            # Seed from dirname
            seed = int(os.path.basename(s_dir).split('_')[1])
            
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
        except Exception as e:
            print(f"Error reading {s_dir}: {e}")

    if not stats_list:
        print("No stats found.")
        return

    # Sort by seed
    stats_list.sort(key=lambda x: x['seed'])
    
    # Save
    csv_path = os.path.join(dir_path, 'summary.csv')
    keys = stats_list[0].keys()
    with open(csv_path, 'w', newline='') as f:
        dict_writer = csv.DictWriter(f, fieldnames=keys)
        dict_writer.writeheader()
        dict_writer.writerows(stats_list)

    print(f"Saved {csv_path} with {len(stats_list)} records.")

if __name__ == "__main__":
    if len(sys.argv) > 1:
        for d in sys.argv[1:]:
            aggregate(d)
    else:
        aggregate('final_results/baseline_v5')
        aggregate('final_results/music_v5')

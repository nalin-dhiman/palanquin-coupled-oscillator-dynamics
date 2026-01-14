import argparse
import numpy as np
import os
import sys

# Add local path
sys.path.append(os.getcwd())

from palanquin_v2.visualizer import PalanquinVisualizer

def render(log_path, out_file):
    if not os.path.exists(log_path):
        print(f"Log not found: {log_path}")
        return

    print(f"Loading {log_path}...")
    data = np.load(log_path, allow_pickle=True)
    
    # Reconstruct logs dict for Visualizer
    logs = {k: data[k] for k in data.files}
    print("Log keys:", list(logs.keys()))
    
    # Config object (minimal needed for Viz)
    # The visualizer reads 'palanquin' and 'carriers' from config, OR usually reads logs.
    # Let's see visualizer.py requirements. 
    # V2 Visualizer mostly relies on logs for geometry if 'geom_*' keys exist.
    # My simulator saves 'geom_pole_length', 'geom_handle_layout', 'geom_com_offset_y'.
    # So minimal dummy config might work.
    
    dummy_config = {
        'palanquin': {
            'length': 1.4, # Default fallback
            'width': 0.6,
            'height': 0.4
        },
        'carriers': [{'name':'c1'}, {'name':'c2'}]
    }

    viz = PalanquinVisualizer(logs, dummy_config)
    viz.save_animation(filename=out_file)

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument('log_path', type=str)
    parser.add_argument('--out', type=str, default='simulation.gif')
    args = parser.parse_args()
    
    render(args.log_path, args.out)

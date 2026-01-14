import argparse
import os
import pandas as pd
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from scipy import signal
import glob

def plot_distributions(df, outdir):
    vars = ['rms_roll', 'contact_loss', 'synchrony', 'onset_time']
    plt.figure(figsize=(15, 4))
    for i, v in enumerate(vars):
        if v not in df.columns: continue
        plt.subplot(1, 4, i+1)
        sns.histplot(df[v], kde=True)
        plt.title(v)
    plt.tight_layout()
    plt.savefig(os.path.join(outdir, 'dist_metrics.png'))
    plt.close()

def plot_psd(log_files, outdir):
    # Load all logs and compute PSD of Roll
    psds = []
    freqs = None
    
    print(f"Computing PSDs for {len(log_files)} seeds...")
    for f in log_files:
        try:
            data = np.load(f)
            roll = data['roll']
            # t = data['t']
            # dt = t[1] - t[0] # assume constant
            fs = 100.0 # roughly? Or derived.
            if 't' in data and len(data['t']) > 1:
                dt = data['t'][1] - data['t'][0]
                fs = 1.0 / dt
            
            # Welch
            f_axis, Pxx = signal.welch(roll, fs=fs, nperseg=512)
            if freqs is None:
                freqs = f_axis
            
            # Interpolate if len differs? Should be same if nperseg fixed.
            if len(Pxx) == len(freqs):
                psds.append(Pxx)
        except Exception as e:
            print(f"Error loading {f}: {e}")
            
    if not psds:
        return

    psds = np.array(psds)
    mean_psd = np.mean(psds, axis=0)
    std_psd = np.std(psds, axis=0)
    
    plt.figure(figsize=(8, 6))
    plt.plot(freqs, mean_psd, 'b-', label='Mean PSD')
    plt.fill_between(freqs, mean_psd - std_psd, mean_psd + std_psd, color='b', alpha=0.2)
    plt.xlim(0, 5) # 0-5 Hz interest
    plt.xlabel('Frequency (Hz)')
    plt.ylabel('Power Density (rad^2/Hz)')
    plt.title('Roll PSD (Ensemble)')
    plt.legend()
    plt.savefig(os.path.join(outdir, 'psd_roll.png'))
    plt.close()

def plot_grid(grid_csv, outdir):
    df = pd.read_csv(grid_csv)
    # Pivot
    # Identify col 0 and 1 as axes
    cols = df.columns
    p1 = cols[0]
    p2 = cols[1]
    metric = 'prob_instability'
    
    pivot = df.pivot(index=p2, columns=p1, values=metric)
    
    plt.figure(figsize=(8, 6))
    sns.heatmap(pivot, annot=True, cmap='RdYlGn_r', vmin=0, vmax=1)
    plt.title(f'Instability Probability: {p1} vs {p2}')
    plt.savefig(os.path.join(outdir, f'phase_diagram_{p1}_{p2}.png'))
    plt.close()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('input_dir', type=str)
    args = parser.parse_args()
    
    summary_path = os.path.join(args.input_dir, 'summary.csv')
    if os.path.exists(summary_path):
        print("Found summary.csv, plotting distributions...")
        df = pd.read_csv(summary_path)
        plot_distributions(df, args.input_dir)
        
        # Check logs
        log_files = glob.glob(os.path.join(args.input_dir, 'seed_*', 'logs.npz'))
        if log_files:
            plot_psd(log_files, args.input_dir)
            
    grid_path = os.path.join(args.input_dir, 'grid_results.csv')
    if os.path.exists(grid_path):
        print("Found grid_results.csv, plotting phase diagram...")
        plot_grid(grid_path, args.input_dir)

if __name__ == "__main__":
    main()

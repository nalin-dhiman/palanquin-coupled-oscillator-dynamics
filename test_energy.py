import numpy as np
import matplotlib.pyplot as plt
import os
from palanquin_v2.simulator import PalanquinSimulator
import json

def test_energy():
    with open('baseline_v5.json', 'r') as f:
        config = json.load(f)
    
    config['sim']['duration'] = 5.0
    config['sim']['log_hz'] = 100 # High res for energy check
    config['sim']['log_every'] = 0
    config['palanquin']['mass'] = 60.0 # explicit
    
    sim = PalanquinSimulator(config)
    sim.run('test_energy_output')
    
    # Load logs
    data = np.load('test_energy_output/logs.npz')
    t = data['t']
    ke_lin = data['ke_lin']
    ke_rot = data['ke_rot']
    pe_grav = data['pe_grav']
    pe_spring = data['pe_spring']
    power_in = data['power_in']
    power_diss = data['power_diss']
    
    # Integration of Power => Work
    dt_log = t[1] - t[0]
    work_in = np.cumsum(power_in) * dt_log
    work_diss = np.cumsum(power_diss) * dt_log
    
    total_energy = ke_lin + ke_rot + pe_grav + pe_spring
    
    # Balance: E_total - (Work_In + Work_Diss) = Constant
    # Note: Work_Diss should be NEGATIVE if it's "Dissipated". 
    # But usually we track "Power Dissipated" as positive quantity leaving system.
    # In simulator.py: step_power_diss += info['fy_damp'] * v_rel_y
    # fy_damp opposes v_rel, so dot product is Negative. 
    # So power_diss array contains Negative values.
    # Thus E_final - E_initial = Integral(Power_Net)
    # Balance = E_total - Integral(Power_In + Power_Diss) should be constant.
    
    balance = total_energy - (work_in + work_diss)
    balance_drift = balance[-1] - balance[0]
    
    print(f"Total Energy Drift over 5s: {balance_drift:.5f} J")
    print(f"  Delta KE: {ke_lin[-1]+ke_rot[-1] - (ke_lin[0]+ke_rot[0]):.2f}")
    print(f"  Delta PE: {pe_grav[-1]+pe_spring[-1] - (pe_grav[0]+pe_spring[0]):.2f}")
    print(f"  Work In: {work_in[-1]:.2f}")
    print(f"  Work Diss: {work_diss[-1]:.2f}")
    
    # Plot
    plt.figure(figsize=(10,6))
    plt.plot(t, total_energy - total_energy[0], label='Delta Total Energy')
    plt.plot(t, work_in + work_diss, label='Net Work (In + Diss)')
    plt.plot(t, balance - balance[0], 'k--', label='Drift (Error)')
    plt.legend()
    plt.savefig('energy_check.png')
    print("Saved energy_check.png")

if __name__ == '__main__':
    test_energy()

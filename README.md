# Coupled Oscillator Dynamics of Carried Palanquins

## Overview
This repository accompanies the paper:

**“The Rath Dynamics of the Himalayas:  
A Physics-First Account of Coupled Oscillators and Beat Entrainment in Deity Palanquins”**  
Nalin Dhiman (IIT Mandi, 2026)

The project presents a fully specified *mechanistic model* showing that observed palanquin
motions (jumping, rocking, synchrony shifts, harmonic structure) can arise from:

- rigid-body Newton–Euler dynamics,
- human gait modeled as weakly coupled limit-cycle oscillators,
- music-driven phase entrainment (Adler locking),
- nonlinear unilateral handle contact.

The work is **simulation-only** and makes **no metaphysical or cultural claims**.
It addresses *causation*, not *meaning*.

---

## Scientific Scope (Read This First)

This repository **does not claim**:
- historical reconstruction of any specific procession,
- empirical calibration to real palanquins or carriers,
- denial of cultural, religious, or symbolic meaning.

This repository **does claim**:
- a purely physical model is sufficient to reproduce key motion signatures,
- “surprising motion ⇒ supernatural agency” is an invalid causal inference,
- the model generates falsifiable predictions.

---

## Model Summary

The coupled system consists of:

1. **Rigid body dynamics**  
   - 6-DOF Newton–Euler equations
   - Body-frame inertia with correct torque handling

2. **Carrier gait oscillators**
   - Phase reduction of limit cycles
   - PRC formalism with weak coupling
   - Kuramoto synchrony emergence

3. **Music entrainment**
   - Adler locking condition
   - Beat-locked frequency shifts

4. **Handle contact**
   - Unilateral compliant spring–damper
   - Friction-limited tangential forces
   - Contact loss as a key nonlinearity

---


---

## Reproducibility

This work is intended as a **mechanistic plausibility generator**.
Parameter sweeps, ablations, and regime mapping are provided.

---

## How to Run (Minimal)

```bash
python simulation/run_simulation.py --config configs/music_entrain.yaml


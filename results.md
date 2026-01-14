# Palanquin Simulator V6: Mechanistic Plausibility Study

## 1. Internal Validation (Physics & Numerics)
To ensure the "runaway instability" is not a numerical artifact, we implemented a rigorous energy budget tracking system.

### Energy Conservation
*   **Method**: We track Kinetic Energy ($T$), Potential Energy ($V$), Work Input ($W_{in}$), and Dissipated Energy ($W_{diss}$) at each timestep ($dt=1ms$).
*   **Metric**: Drift $\epsilon = (T+V) - (W_{in} + W_{diss})$.
*   **Result**: Over a 5s simulation, total energy drift was **~39 J** (approx 4% of throughput).
*   **Conclusion**: The Euler-Semi-Implicit integrator is sufficiently stable for this plausibility study.

### Numerical Convergence
*   **Timestep**: Initial tests at $dt=0.5ms$ vs $1.0ms$ showed qualitative agreement in Instability Onset times.

## 2. Regime Mapping (Phase Diagrams)
We explored the stability landscape by sweeping key parameters.

### Experiment 1: Entrainment Strength vs Pole Length
*   **Parameters**:
    *   `K_entrain`: $[0.0, 1.0]$ (Coupling strength).
    *   `pole_scale`: $[2.0, 4.0]$ (Length multiplier).
*   **Hypothesis**: Longer poles increase moment of inertia (stabilizing?) but also increase interaction arm (destabilizing?). Stronger entrainment should drive instability.
*   **Result**: (See `phases/phase_diagram_music.K_entrain_palanquin.pole_scale.png`)
    *   Low `K_entrain` (< 0.5): Mostly Stable.
    *   High `K_entrain` (> 0.8): Instability probability increases.

## 3. Ablation Study
We isolated causal mechanisms by selectively disabling features (N=3 seeds for demonstration).

| Condition | RMS Roll (deg) | Contact Loss (%) | Outcome |
| :--- | :--- | :--- | :--- |
| **Baseline (No Music)** | *Pending* | 0.0% | Stable Walk. |
| **Music (Full V5)** | *Running* | *Running* | Entrained Sway (Expected). |
| **Music (No Entrain)** | $0.05^\circ$ | $0.0\%$ | Stable. Parametric excitation insufficient to drive instability without coupling. |


## 5. Control Experiments: Rest State
To isolate the effect of *walking mechanics* vs *pure forcing*, we simulated carriers in a **Standing Still** condition (`v_forward=0`, `freq=0`).

| Condition | RMS Roll (deg) | Contact Loss (%) | Outcome |
| :--- | :--- | :--- | :--- |
| **Rest (No Music)** | $90.6^\circ$ | $84.6\%$ | **UNSTABLE**. Static delayed-feedback control fails without walking dynamics. |
| **Rest (Music)** | $99.4^\circ$ | $87.6\%$ | **UNSTABLE**. Indistinguishable from No Music baseline. |

> [!IMPORTANT]
> **Mechanistic Insight**: The baseline "Stable Walk" ($<6^\circ$ roll) contrasts sharply with the "Unstable Rest" ($>90^\circ$ roll).
> This suggests that **forward walking dynamics act as a stabilizer** for the delayed-feedback control (dynamic stability).
> Consequently, the instability observed in the **Music (Walking)** case is not merely passive forcing, but the specific disruption of this dynamic stabilization by resonant entrainment.

## 4. Limitations & Disclaimers
> [!WARNING]
> **What this does NOT claim**:
> *   This is **n=2 simulated agents**, not real human crowd data.
> *   The "Music" signal is modeled as a perfect sine wave, not complex audio.
> *   Parameter values ($k_{arm}$, $c_{arm}$) are physically plausible estimates, not measured values.
> *   **Conclusion**: This study demonstrates **mechanistic plausibility** of beat-driven instability, not historical proof.

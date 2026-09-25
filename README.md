# Rath

**A research simulation of collective carrying, motion and load sharing.**

**Nalin Dhiman**<br>
School of Computing and Electrical Engineering, Indian Institute of Technology Mandi, India

[Open the simulation](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/) · [Watch the research overview](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/overview.html) · [Technical guide](docs/technical-guide.md)

A rath is a ceremonial structure carried on poles. This project studies how changes in shoulder motion affect the movement of the shared load and the forces borne at individual contacts. Its sole purpose is scientific research into collective carrying.

The interactive model represents front-left, front-right, rear-left and rear-right shoulder contacts. Prescribed support motions produce three calculated body motions: **heave** (vertical movement), **roll** (side-to-side tilt) and **pitch** (forward–backward tilt). Parameters can be adjusted while inspecting motion, contact loads and numerical summaries.

## Research overview video

[![View the Rath research overview video, with accompanying model notes](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/media/rath-overview-poster.jpg)](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/overview.html)

**[Play the video — 4 min 33 s](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/overview.html)** · [Direct MP4](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/media/rath-overview.mp4)

The supplied video introduces the research through diagrams and selected numerical examples. Some diagrams differ from the implementation: the inputs are shoulder-support heights, the reference supports are pole-side resultants, and the roll equation shown around 1:40 differs from the solver. **[The viewing page provides the corrections and model context](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/overview.html#model-notes).** This overview is separate from the numerically verified Blender trajectory replay.

## Interactive simulation

![Rath research interface with parameter controls, separate heave, roll and pitch readouts, individual contact loads and time histories](docs/images/simulation-overview.png)

*Four-contact model with different front and rear cadences. The screenshot shows a 24-second comparison paused for inspection. Interactive runs default to 120 seconds and support durations up to 180 seconds.*

1. Select a preset such as **Roll and pitch**, **Heave**, **Roll** or **Pitch**.
2. Adjust front/rear cadence, stride phase or shoulder amplitude. With automatic application enabled, parameter changes restart the simulation from its initial state.
3. Use **Contacts & forces** to inspect the numerical contact geometry and load distribution. Camera controls provide front, side, top and three-quarter views.
4. Compare **free pitch**, **locked pitch** and **two averaged resultants**. The **Load redistribution** preset illustrates changing individual forces despite negligible angular motion.
5. Pause to inspect the recorded trajectory. **Calculate full run** completes the selected duration for inspection and CSV export. JSON export preserves the model configuration.

On smaller screens, select **Show all parameters** to expand the controls. Motion magnification is labelled explicitly and affects the display only; readouts, plots, statistics and exports retain the computed values.

| Parameter group | Research comparison |
| --- | --- |
| Cadence and stride phase | Effects of relative timing between prescribed front and rear inputs |
| Vertical amplitude and torso tilt | Contributions to heave, roll, pitch and individual contact loading |
| Mass, inertia and geometry | Sensitivity to assumed mechanical properties and contact spacing |
| Contact stiffness and damping | Load transmission, unloading and separation |
| Initial angles, duration and integration step | Transients and numerical sensitivity |

![Numerical contact geometry with four contact locations, force arrows and calculated shoulder loads](docs/images/support-forces.png)

*Contact colours correspond to the load cards and traces. Arrows indicate computed normal forces; bars indicate undeformed support references. A zero-force contact may be separated or undergoing clipped unloading.*

## Scientific scope and verification

The model uses assumed geometry, inertia, compliance and prescribed shoulder waveforms. It evaluates conditional mechanical consequences; empirical application requires measurements of the apparatus and carrying practice. Religious interpretation, intentions and participants' experiences require distinct evidence.

The four-contact model calculates vertical motion, roll and pitch. It omits horizontal travel, horizontal forces, yaw, foot–ground mechanics, pole bending and adaptive gait. Pitch denotes a change in orientation, rather than forward travel. The rath mesh illustrates the calculated pose and does not determine the mechanical parameters. A two-support reference model is available for comparison; its supports represent pole sides.

The browser solver is checked against independent Python calculations for **21 walking comparisons**, alongside the reference cases. Browser checks evaluate **120 randomly selected poses**, four contact locations and **39 mesh component origins**. These checks establish numerical and graphical consistency. Recontact introduces force jumps, so contact-opening cases also require step-size sensitivity checks.

## Local use

With Node.js 18 or later and Python 3:

```bash
npm ci --ignore-scripts
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open [localhost:8080](http://localhost:8080). The video overview is at [localhost:8080/overview.html](http://localhost:8080/overview.html). The simulator runs locally in the browser and does not upload configurations or trajectories.

The [technical guide](docs/technical-guide.md) documents the equations, model assumptions, project-local Python `.venv`, tests and publication procedure. Source code is on `interactive-main`; GitHub Pages serves `interactive-site`. The earlier `main` branch remains available as historical code.

| Directory | Contents |
| --- | --- |
| `web/` | Browser interface, solvers, rath asset and the supplied overview video |
| `python/` | Independent reference solvers, tests and mesh/replay tools |
| `scripts/` | Build, browser verification and deployment scripts |
| `tests/` | Cross-language reference fixtures and numerical tests |
| `docs/` | Interface images, technical documentation and verification records |

Manuscripts, PDFs, TeX sources and private research files are excluded from this repository. The supplied overview is the single explicitly included MP4; generated replay files remain local.

Original code is distributed under the [MIT licence](LICENSE). Three.js retains its own MIT licence. The supplied video and third-party material within it are not relicensed under the code licence.

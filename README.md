# Rath Dynamics Lab

A browser-based mechanics explorer for a synthetic carried load, with a detailed rath illustration, an analytical contact view, adjustable parameters, time-series plots and reproducible exports.

**Live app:** https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/

The `interactive-main` branch is the new application branch. The earlier `main` branch retains the previous implementation and its history. This branch contains simulation/application code, its original mesh asset, configuration and automated test fixtures. Manuscripts, PDFs, TeX, private material, generated trajectories and videos are excluded.

## Use the app

Choose an in-phase, phase-offset, load-yielding or irregular-input preset. Edit parameters and select **Run simulation**. The rath view shows the computed position and orientation using an original schematic; the analytical view shows the assumed effective contacts, prescribed support references and computed force arrows. Drag to orbit, scroll to zoom, or select a fixed camera. Pause, scrub, restart and change playback speed independently of the numerical calculation.

Controls expose mass, inertia, contact half-span, COM offset/height, gravity, stiffness, damping, input amplitudes, frequency, phases, ramp, initial roll, all five feedback parameters, integration/output steps, analysis start and a run duration up to 180 seconds (120 seconds by default). The full JSON editor also exposes each component of the irregular input. Configurations can be imported/exported; CSV exports include time, pose, quaternion, support positions, contact coordinates, compression, forces and the work–energy audit. Everything computes locally; there is no server-side simulation or data upload.

## Model and limits

`python/model.py` is the independent NumPy reference implementation. `web/src/model.js` ports the same finite-angle, two-degree-of-freedom equations to JavaScript. A dedicated Web Worker integrates with fixed-step fourth-order Runge–Kutta. World coordinates are x forward, y lateral, z up; saved quaternions are wxyz. The renderer reorders quaternion components explicitly for Three.js. No rendering state enters the solver.

Each support has a gated, clipped Kelvin–Voigt force: zero across a gap, otherwise the nonnegative spring-plus-damper force. The load-yielding controller uses filtered force state with rate and displacement bounds. Initial velocity/controller/work states are zero. Passive roll stiffness must be positive. The app rejects malformed configurations and time steps that are too large for the selected natural/decay rates; it stops trajectories exceeding its supported 60-degree roll or 2-m heave range. These are explorer limits, not measured physical failure thresholds.

Statistics use the inclusive configured analysis interval. Heave RMS is about its sample mean; roll RMS is about zero. Contact loss counts samples when either support force is at most 1e-9 N. The work–energy residual measures numerical consistency, not agreement with a real apparatus. Plots auto-scale when needed; exports contain the unscaled values.

The rath mesh has unmeasured proportions and is only a rigid illustration of the computed pose. Its geometry does not set the simulation mass, COM, inertia or support locations. The apparatus has 39 original procedural components; no documentary photographs, copied ornament designs or third-party meshes are included. The model does not calculate human gait, pole bending, route choice, pitch, human/cloth deformation or empirical biomechanics. The original source-informed form is preserved in the geometry builder.

## Build locally

Node.js 18 or later is sufficient:

```bash
npm ci --ignore-scripts
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080`. The build copies pinned Three.js modules locally, so the deployed app does not depend on a runtime CDN. `package-lock.json` pins dependencies.

GitHub Pages publishes the root of the separate `interactive-site` branch, containing only the built app. To update it with an authorized GitHub login, run `npm run deploy`: the script runs the numerical tests, builds the app and pushes the static files through a temporary checkout. It never uploads the source checkout or generated research files as a website, never force-pushes, and preserves the site's commit history. In repository Settings → Pages, the source is **Deploy from a branch**, branch **interactive-site**, folder **/ (root)**. This approach does not require permission to create GitHub Actions workflow files.

For the NumPy implementation, create a project-local environment:

```bash
python3 -m venv .venv
.venv/bin/pip install -r python/requirements.txt
.venv/bin/python -m pytest python/test_model.py
.venv/bin/python python/run.py web/default-config.json generated/run.npz
```

Do not install dependencies globally. The working implementation uses NumPy, not MuJoCo; adding a different engine would require a separate equivalence check.

## Verification

`npm test` checks four independent NumPy reference trajectories (including irregular forcing and feedback), static equilibrium, unilateral contact, torque sign, the matched modal response, energy accounting, a continuous 120-second run, parameter sensitivity and invalid inputs. `tests/reference.json` records selected numerical samples and the hash of the independent Python implementation.

`scripts/browser-smoke.mjs` checks UI behavior, exports, mobile layout and 120 random world poses. It also checks that all 39 GLB component origins return to their original coordinates after the explicit glTF Y-up to solver Z-up conversion. Set `APP_URL` to test a deployed site and `CHROME_PATH` to a Chromium executable. The test writes local screenshots and a report under ignored `test-results/`.

```bash
CHROME_PATH=/path/to/chromium node scripts/browser-smoke.mjs
```

The default test URL is `http://127.0.0.1:8087/`; serve `dist/` on that port first or override `APP_URL`.

## Rebuild the mesh and the two-minute video

Blender is used only for geometry and replay; it does not calculate rigid-body dynamics. Use an installed Blender executable and check `blender --version`. The mesh can be regenerated without any private research files:

```bash
blender --background --python python/create_apparatus.py
blender generated/contextual_apparatus.blend --background --python python/export_web_asset.py
```

The longer video uses **new 64-second integrations per condition**, not a loop or stretched version of a short clip. Each condition shows 4–64 s across 60 seconds of screen time. Both use identical mapping and camera, with unamplified displacement/angle. There are 720 frames per condition at 12 fps (120 seconds total); rounding the uniform index sequence gives approximately 1.0014× physical speed across displayed frame intervals.

```bash
.venv/bin/pip install -r python/requirements-video.txt
.venv/bin/python python/generate_long_replay.py --output generated/video/long_trajectories
blender generated/contextual_apparatus.blend --background \
  --python python/create_long_video_scene.py -- generated/video
blender generated/video/rath_120s.blend --background \
  --python python/verify_long_transfer.py -- generated/video
blender generated/video/rath_120s.blend --background \
  --python python/render_long_video.py -- generated/video
.venv/bin/python python/compose_long_video.py generated/video
```

The compositor additionally needs Pillow, ffmpeg and a Latin Modern Roman font installed with TeX Live; it does not build any TeX document. Its output is a local MP4, not a Git-tracked file. The validator checks 160 seeded random frames plus endpoints/extrema, body position, quaternion geodesic error and rigid component transforms. Rendering requires a passing report bound to the exact saved scene and trajectory hashes. In the initial long replay, 170 distinct frames passed with 2e-6 tolerances.

## Repository layout

- `web/`: application, worker, numerical model, default configuration and original mesh asset.
- `python/`: independent reference solver and reproducible mesh/video pipeline.
- `scripts/`: static build, tested branch deployment and browser checks.
- `tests/`: numerical tests and reference fixtures.

MIT license applies to original code. Three.js retains its own MIT license in the built app. No manuscripts or confidential materials are distributed here.

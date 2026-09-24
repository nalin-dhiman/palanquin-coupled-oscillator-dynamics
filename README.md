# Rath Dynamics Lab

**See how the timing of two supports changes the bounce and tilt of a carried rath.**

This project is an interactive physics demonstration of a rath, a ceremonial structure carried on poles. The model represents the carriers with two moving supports. You can change their timing, the weight of the load and other settings, then watch the motion and the forces change.

**[Open the interactive simulation →](https://nalin-dhiman.github.io/palanquin-coupled-oscillator-dynamics/)**

It runs in your browser, on a computer or phone. No installation or account is needed.

![The live simulation showing the rath, adjustable settings, playback controls and graphs of motion and support forces.](docs/images/simulation-overview.png)

*The app with its default settings. The controls are on the left; the rath, results and graphs are on the right. Open the image to see the details.*

## Try it in a minute

1. Open the simulation and choose **In phase**: both supports move up and down together.
2. Choose **60° offset**: one support moves later than the other. Compare the bounce and tilt.
3. Change a setting, such as **Mass**, **Frequency** or **Right amplitude**, then select **Run simulation**.
4. Drag the 3D view to look around the rath. Pause the animation or move the time slider to inspect a moment.
5. Select **Download CSV** to save the numbers, or open **Import / export configuration** to save and reuse your settings.

Each run lasts **two minutes by default**. Open **Duration & numerical controls** to choose a different length, up to **three minutes**. On a phone, tap **Show all parameters** to reveal the controls.

## What can you compare?

| App preset | In plain words |
| --- | --- |
| **In phase** | Both supports follow the same rhythm at the same time. |
| **60° offset** | One support follows the same rhythm with a timing difference. |
| **Load yielding** | Each support adjusts slightly in response to the force it carries. |
| **Irregular** | Several rhythms are mixed together to produce less regular support movement. |

You can also change the load's mass, how far apart the supports are, how soft or stiff they are, and how much and how quickly they move. The advanced controls expose the remaining model settings; the full JSON configuration lets you edit every part of the irregular input.

## See the supports and forces

The **Rath illustration** view shows the detailed shape. Switch to **Analytical body** to see the simplified load used by the calculation: a block, two contact points and arrows showing upward support forces.

![The analytical view showing a simplified load, two contact points and upward force arrows.](docs/images/support-forces.png)

*The coloured lines mark the prescribed support positions. The arrows show the calculated upward forces. Both views display the same computed motion.*

The movement is shown at its calculated size, so it can look small. The graphs make these small changes easier to see:

- **Heave** means the load moving up and down.
- **Roll** means the load tilting from side to side.
- **Support force** means how strongly each support pushes upward on the load.
- **Contact loss** means a support has stopped pushing on the load at that moment.

## What the model represents

This is a simplified simulation with assumed physical properties. The rath's real dimensions, mass and balance have not been measured for this model. Its decorative shape is an illustration of the calculated motion.

The calculation covers vertical movement, sideways tilt and support forces. Walking, pole bending and cloth movement are outside its scope. Automated checks compare the browser calculation with the Python version and verify that the displayed 3D position and rotation match the saved numbers.

## Run it on your computer

With Node.js 18 or later and Python 3 installed, run these commands from the repository folder:

```bash
npm ci --ignore-scripts
npm test
npm run build
python3 -m http.server 8080 --directory dist
```

Open [localhost:8080](http://localhost:8080).

The **[technical guide](docs/technical-guide.md)** explains the equations, verification checks, Python environment, website publishing and how to rebuild the two-minute Blender video. For future website updates, `npm run deploy` tests, builds and publishes the app.

## Where things live

| Folder | Contents |
| --- | --- |
| `web/` | The interactive app and original 3D rath asset. |
| `python/` | The reference simulation and tools for rebuilding the mesh and video. |
| `scripts/` | Build, deployment and browser-check scripts. |
| `tests/` | Numerical checks and reference samples. |
| `docs/` | App screenshots and the technical guide. |

`interactive-main` is the default source branch. The previous `main` branch retains the earlier implementation. `interactive-site` contains the published website. The screenshots above come from the live app; manuscript files and generated simulation videos are excluded from this branch.

Original code is available under the [MIT license](LICENSE). Three.js retains its own MIT license.

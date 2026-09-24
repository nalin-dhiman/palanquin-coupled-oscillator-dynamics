from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parent))

from model import (  # noqa: E402
    Parameters,
    contact_state,
    energy,
    force_phase_identity,
    initial_state,
    linear_frequency_response,
    rhs,
    simulate,
)


def quiet_case(**updates):
    case = {
        "input_kind": "none",
        "feedback": False,
        "initial_roll_rad": 0.0,
        "ramp_s": 2.0,
    }
    case.update(updates)
    return case


def periodic_case(amplitudes=(0.0001, 0.0001), phases=(0.0, 0.0)):
    return {
        "input_kind": "periodic",
        "frequency_hz": 1.5,
        "amplitudes_m": list(amplitudes),
        "phases_rad": list(phases),
        "feedback": False,
        "initial_roll_rad": 0.0,
        "ramp_s": 1.0,
    }


def test_static_equilibrium_and_preload():
    p = Parameters()
    case = quiet_case()
    y = initial_state(p, case)
    derivative = rhs(0.0, y, p, case)
    contact = contact_state(0.0, y, p, case)
    assert np.allclose(contact["force"], p.static_force_N, atol=1e-10)
    assert np.allclose(derivative[:8], 0.0, atol=1e-10)


def test_axis_and_torque_sign():
    p = Parameters()
    y = initial_state(p, quiet_case())
    y[4] = -0.001
    y[5] = 0.001
    state = contact_state(0.0, y, p, quiet_case())
    assert state["force"][1] > state["force"][0]
    assert state["lever"] @ state["force"] > 0.0


def test_unilateral_contact_has_no_tension():
    p = Parameters()
    case = quiet_case()
    y = initial_state(p, case)
    y[0] += 0.2
    state = contact_state(0.0, y, p, case)
    assert np.all(state["compression"] < 0.0)
    assert np.all(state["force"] == 0.0)


def test_symmetric_periodic_input_cancels_torque_at_symmetry():
    p = Parameters()
    case = periodic_case()
    y = initial_state(p, case)
    state = contact_state(1.2, y, p, case)
    assert abs(float(state["lever"] @ state["force"])) < 1e-10


def test_force_phase_identity():
    for phase in np.linspace(0.0, np.pi, 17):
        result = force_phase_identity(0.5, 25.0, phase)
        assert np.isclose(
            result["torque_amplitude_N_m"],
            result["torque_from_coherence_N_m"],
            atol=1e-12,
        )


def test_small_signal_periodic_response_matches_linear_limit():
    p = Parameters()
    case = periodic_case(amplitudes=(0.0001, 0.0001), phases=(0.0, np.pi / 3.0))
    arrays = simulate(p, case, duration_s=8.0, dt_s=0.001, sample_dt_s=0.005)
    mask = arrays["time"] >= 4.0
    heave_amplitude = 0.5 * np.ptp(arrays["state"][mask, 0])
    roll_amplitude = 0.5 * np.ptp(arrays["state"][mask, 1])
    linear = linear_frequency_response(
        p, case["frequency_hz"], np.asarray(case["amplitudes_m"]), np.asarray(case["phases_rad"])
    )
    assert np.isclose(heave_amplitude, linear["heave_amplitude_m"], rtol=0.03)
    assert np.isclose(roll_amplitude, linear["roll_amplitude_rad"], rtol=0.03)


def test_work_balance():
    p = Parameters()
    case = periodic_case(amplitudes=(0.004, 0.004), phases=(0.0, np.pi / 3.0))
    arrays = simulate(p, case, duration_s=4.0, dt_s=0.001, sample_dt_s=0.01)
    scale = max(1.0, float(np.ptp(arrays["energy_J"])))
    assert np.max(np.abs(arrays["balance_residual_J"])) < 2e-4 * scale
    assert arrays["state"][-1, 8] > 0.0
    assert arrays["state"][-1, 9] < 0.0
    assert arrays["state"][-1, 10] >= 0.0


def test_energy_function_is_finite():
    p = Parameters()
    case = quiet_case()
    assert np.isfinite(energy(0.0, initial_state(p, case), p, case))

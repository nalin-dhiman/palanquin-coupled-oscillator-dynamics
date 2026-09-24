#!/usr/bin/env python3
"""Finite-angle planar forward model for a preloaded, two-support carried object.

World axes are x forward, y lateral, z up. The modeled rocking plane is y-z,
so theta is roll about +x and the +y end rises for positive theta. Numerical
parameters are a synthetic design domain, not measurements of a rath or person.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Any

import numpy as np


@dataclass(frozen=True)
class Parameters:
    mass_kg: float = 40.0
    inertia_kg_m2: float = 8.0
    half_span_m: float = 0.50
    com_height_above_support_m: float = 0.15
    stiffness_N_m: float = 8000.0
    damping_N_s_m: float = 250.0
    gravity_m_s2: float = 9.81
    equilibrium_com_height_m: float = 1.50
    feedback_filter_s: float = 0.08
    feedback_gain_m_N_s: float = 5.0e-5
    feedback_return_s: float = 1.0
    feedback_displacement_limit_m: float = 0.006
    feedback_rate_limit_m_s: float = 0.020

    def validate(self) -> None:
        values = asdict(self)
        if not all(np.isfinite(v) for v in values.values()):
            raise ValueError("all parameters must be finite")
        for name in (
            "mass_kg",
            "inertia_kg_m2",
            "half_span_m",
            "stiffness_N_m",
            "gravity_m_s2",
            "feedback_filter_s",
            "feedback_return_s",
            "feedback_displacement_limit_m",
            "feedback_rate_limit_m_s",
        ):
            if values[name] <= 0:
                raise ValueError(f"{name} must be positive")
        if self.damping_N_s_m < 0 or self.feedback_gain_m_N_s < 0:
            raise ValueError("damping and feedback gain must be nonnegative")
        if self.passive_roll_stiffness_N_m_rad <= 0:
            raise ValueError("selected equilibrium is not passively stable")

    @property
    def static_force_N(self) -> float:
        return self.mass_kg * self.gravity_m_s2 / 2.0

    @property
    def static_compression_m(self) -> float:
        return self.static_force_N / self.stiffness_N_m

    @property
    def equilibrium_support_height_m(self) -> float:
        return (
            self.equilibrium_com_height_m
            - self.com_height_above_support_m
            + self.static_compression_m
        )

    @property
    def passive_roll_stiffness_N_m_rad(self) -> float:
        return (
            2.0 * self.stiffness_N_m * self.half_span_m**2
            - self.mass_kg * self.gravity_m_s2 * self.com_height_above_support_m
        )

    @property
    def heave_natural_frequency_hz(self) -> float:
        return float(
            np.sqrt(2.0 * self.stiffness_N_m / self.mass_kg) / (2.0 * np.pi)
        )

    @property
    def roll_natural_frequency_hz(self) -> float:
        return float(
            np.sqrt(self.passive_roll_stiffness_N_m_rad / self.inertia_kg_m2)
            / (2.0 * np.pi)
        )


def smooth_ramp(t: float, duration_s: float) -> tuple[float, float]:
    """Raised-cosine amplitude ramp and its derivative."""
    if duration_s <= 0:
        return 1.0, 0.0
    if t <= 0:
        return 0.0, 0.0
    if t >= duration_s:
        return 1.0, 0.0
    phase = np.pi * t / duration_s
    return 0.5 * (1.0 - np.cos(phase)), 0.5 * np.pi * np.sin(phase) / duration_s


def prescribed_drive(t: float, case: dict[str, Any]) -> tuple[np.ndarray, np.ndarray]:
    """Support-height deviation and velocity, ordered left (-y), right (+y)."""
    ramp, ramp_dot = smooth_ramp(t, float(case.get("ramp_s", 2.0)))
    kind = case["input_kind"]
    if kind == "periodic":
        frequency = float(case["frequency_hz"])
        omega = 2.0 * np.pi * frequency
        amplitudes = np.asarray(case["amplitudes_m"], dtype=float)
        phases = np.asarray(case["phases_rad"], dtype=float)
        phase = omega * t + phases
        raw = amplitudes * np.sin(phase)
        raw_dot = amplitudes * omega * np.cos(phase)
    elif kind == "irregular":
        frequencies = np.asarray(case["irregular_frequencies_hz"], dtype=float)
        amplitudes = np.asarray(case["irregular_amplitudes_m"], dtype=float)
        phases = np.asarray(case["irregular_phases_rad"], dtype=float)
        if amplitudes.shape != phases.shape or amplitudes.shape[0] != 2:
            raise ValueError("irregular amplitudes/phases must have shape (2,n)")
        phase = 2.0 * np.pi * frequencies[None, :] * t + phases
        raw = np.sum(amplitudes * np.sin(phase), axis=1)
        raw_dot = np.sum(
            amplitudes * (2.0 * np.pi * frequencies[None, :]) * np.cos(phase),
            axis=1,
        )
    elif kind == "none":
        raw = np.zeros(2)
        raw_dot = np.zeros(2)
    else:
        raise ValueError(f"unknown input kind: {kind}")
    return ramp * raw, ramp_dot * raw + ramp * raw_dot


def controller_velocity(y: np.ndarray, p: Parameters, feedback: bool) -> np.ndarray:
    """Causal local yielding rule driven by filtered past/current load state.

    u_dot = -g*q - u/tau, with displacement and rate limits. q is a
    first-order filtered load deviation. The current command uses q as a state,
    avoiding an algebraic loop through the current contact force.
    """
    if not feedback:
        return np.zeros(2)
    u = y[4:6]
    filtered_load = y[6:8]
    velocity = -p.feedback_gain_m_N_s * filtered_load - u / p.feedback_return_s
    velocity = np.clip(
        velocity, -p.feedback_rate_limit_m_s, p.feedback_rate_limit_m_s
    )
    limit = p.feedback_displacement_limit_m
    velocity = np.where((u >= limit) & (velocity > 0), 0.0, velocity)
    velocity = np.where((u <= -limit) & (velocity < 0), 0.0, velocity)
    return velocity


def contact_state(
    t: float, y: np.ndarray, p: Parameters, case: dict[str, Any]
) -> dict[str, np.ndarray]:
    drive, drive_velocity = prescribed_drive(t, case)
    u = y[4:6]
    u_velocity = controller_velocity(y, p, bool(case.get("feedback", False)))
    support_height = p.equilibrium_support_height_m + drive + u
    support_velocity = drive_velocity + u_velocity

    z, theta, z_velocity, theta_velocity = y[:4]
    s = np.array([-p.half_span_m, p.half_span_m])
    point_height = z + s * np.sin(theta) - p.com_height_above_support_m * np.cos(theta)
    lever = s * np.cos(theta) + p.com_height_above_support_m * np.sin(theta)
    point_velocity = z_velocity + lever * theta_velocity
    compression = support_height - point_height
    compression_velocity = support_velocity - point_velocity

    raw_force = p.stiffness_N_m * compression + p.damping_N_s_m * compression_velocity
    force = np.where(compression > 0.0, np.maximum(raw_force, 0.0), 0.0)
    active = compression > 0.0
    # Exact piecewise residual term for this gated/clipped Kelvin-Voigt law.
    dissipation_power = np.where(
        active,
        (force - p.stiffness_N_m * compression) * compression_velocity,
        0.0,
    )
    dissipation_power = np.maximum(dissipation_power, 0.0)
    return {
        "drive": drive,
        "drive_velocity": drive_velocity,
        "u_velocity": u_velocity,
        "support_height": support_height,
        "support_velocity": support_velocity,
        "point_height": point_height,
        "point_velocity": point_velocity,
        "lever": lever,
        "compression": compression,
        "compression_velocity": compression_velocity,
        "force": force,
        "dissipation_power": dissipation_power,
    }


def initial_state(p: Parameters, case: dict[str, Any]) -> np.ndarray:
    p.validate()
    theta = float(case.get("initial_roll_rad", 0.0))
    # z, theta, zdot, thetadot, feedback displacements (2), filtered loads (2),
    # positive work, negative work, contact dissipation.
    return np.array(
        [p.equilibrium_com_height_m, theta, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0],
        dtype=float,
    )


def rhs(t: float, y: np.ndarray, p: Parameters, case: dict[str, Any]) -> np.ndarray:
    state = contact_state(t, y, p, case)
    force = state["force"]
    zdd = (np.sum(force) - p.mass_kg * p.gravity_m_s2) / p.mass_kg
    thetadd = float(state["lever"] @ force) / p.inertia_kg_m2
    if case.get("feedback", False):
        qdot = (force - p.static_force_N - y[6:8]) / p.feedback_filter_s
    else:
        qdot = np.zeros(2)
    boundary_power = force * state["support_velocity"]
    positive_power = float(np.sum(np.maximum(boundary_power, 0.0)))
    negative_power = float(np.sum(np.minimum(boundary_power, 0.0)))
    return np.r_[
        y[2],
        y[3],
        zdd,
        thetadd,
        state["u_velocity"],
        qdot,
        positive_power,
        negative_power,
        float(np.sum(state["dissipation_power"])),
    ]


def rk4_step(
    t: float, y: np.ndarray, dt: float, p: Parameters, case: dict[str, Any]
) -> np.ndarray:
    k1 = rhs(t, y, p, case)
    k2 = rhs(t + dt / 2.0, y + dt * k1 / 2.0, p, case)
    k3 = rhs(t + dt / 2.0, y + dt * k2 / 2.0, p, case)
    k4 = rhs(t + dt, y + dt * k3, p, case)
    return y + dt * (k1 + 2.0 * k2 + 2.0 * k3 + k4) / 6.0


def energy(t: float, y: np.ndarray, p: Parameters, case: dict[str, Any]) -> float:
    state = contact_state(t, y, p, case)
    elastic = 0.5 * p.stiffness_N_m * np.sum(
        np.maximum(state["compression"], 0.0) ** 2
    )
    return float(
        0.5 * p.mass_kg * y[2] ** 2
        + 0.5 * p.inertia_kg_m2 * y[3] ** 2
        + p.mass_kg * p.gravity_m_s2 * y[0]
        + elastic
    )


def simulate(
    p: Parameters,
    case: dict[str, Any],
    duration_s: float = 12.0,
    dt_s: float = 0.001,
    sample_dt_s: float = 0.01,
) -> dict[str, np.ndarray]:
    p.validate()
    if min(duration_s, dt_s, sample_dt_s) <= 0:
        raise ValueError("duration and time steps must be positive")
    stride = int(round(sample_dt_s / dt_s))
    if not np.isclose(stride * dt_s, sample_dt_s) or stride < 1:
        raise ValueError("sample_dt_s must be an integer multiple of dt_s")
    steps = int(round(duration_s / dt_s))
    if not np.isclose(steps * dt_s, duration_s):
        raise ValueError("duration_s must be an integer multiple of dt_s")

    y = initial_state(p, case)
    initial_energy = energy(0.0, y, p, case)
    rows: list[dict[str, np.ndarray | float]] = []

    def record(t: float, y_now: np.ndarray) -> None:
        cs = contact_state(t, y_now, p, case)
        theta = y_now[1]
        quat = np.array([np.cos(theta / 2.0), np.sin(theta / 2.0), 0.0, 0.0])
        support_position = np.column_stack(
            (
                np.zeros(2),
                cs["lever"],
                cs["support_height"],
            )
        )
        support_force = np.column_stack((np.zeros(2), np.zeros(2), cs["force"]))
        current_energy = energy(t, y_now, p, case)
        rows.append(
            {
                "time": t,
                "state": y_now.copy(),
                "position": np.array([0.0, 0.0, y_now[0]]),
                "quaternion": quat,
                "support_position": support_position,
                "support_force": support_force,
                "support_height": cs["support_height"].copy(),
                "support_velocity": cs["support_velocity"].copy(),
                "contact_point_height": cs["point_height"].copy(),
                "compression": cs["compression"].copy(),
                "energy_J": current_energy,
                "balance_residual_J": current_energy
                - initial_energy
                - y_now[8]
                - y_now[9]
                + y_now[10],
            }
        )

    record(0.0, y)
    for step in range(steps):
        t = step * dt_s
        y = rk4_step(t, y, dt_s, p, case)
        if not np.all(np.isfinite(y)):
            raise RuntimeError(f"nonfinite state at t={t + dt_s}")
        if (step + 1) % stride == 0:
            record((step + 1) * dt_s, y)

    keys = rows[0].keys()
    arrays = {key: np.asarray([row[key] for row in rows]) for key in keys}
    arrays["dt_s"] = np.asarray(dt_s)
    arrays["sample_dt_s"] = np.asarray(sample_dt_s)
    return arrays


def linear_frequency_response(
    p: Parameters, frequency_hz: float, amplitudes_m: np.ndarray, phases_rad: np.ndarray
) -> dict[str, float]:
    omega = 2.0 * np.pi * frequency_hz
    beta = np.asarray(amplitudes_m) * np.exp(1j * np.asarray(phases_rad))
    contact = p.stiffness_N_m + 1j * omega * p.damping_N_s_m
    heave_denominator = (
        2.0 * p.stiffness_N_m
        - p.mass_kg * omega**2
        + 1j * 2.0 * p.damping_N_s_m * omega
    )
    roll_denominator = (
        p.passive_roll_stiffness_N_m_rad
        - p.inertia_kg_m2 * omega**2
        + 1j * 2.0 * p.damping_N_s_m * p.half_span_m**2 * omega
    )
    eta = contact * np.sum(beta) / heave_denominator
    theta = p.half_span_m * contact * (beta[1] - beta[0]) / roll_denominator
    return {
        "heave_amplitude_m": float(abs(eta)),
        "roll_amplitude_rad": float(abs(theta)),
        "heave_phase_rad": float(np.angle(eta)),
        "roll_phase_rad": float(np.angle(theta)),
    }


def force_phase_identity(
    half_span_m: float, oscillatory_force_amplitude_N: float, phase_gap_rad: float
) -> dict[str, float]:
    coherence = abs(np.cos(phase_gap_rad / 2.0))
    torque_amplitude = (
        2.0
        * half_span_m
        * oscillatory_force_amplitude_N
        * abs(np.sin(phase_gap_rad / 2.0))
    )
    return {
        "coherence": float(coherence),
        "torque_amplitude_N_m": float(torque_amplitude),
        "torque_from_coherence_N_m": float(
            2.0
            * half_span_m
            * oscillatory_force_amplitude_N
            * np.sqrt(max(0.0, 1.0 - coherence**2))
        ),
    }


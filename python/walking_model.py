"""Three-DOF finite-angle mechanics with prescribed, walking-informed supports.

This is a kinematic gait forcing experiment, not a predictive human gait model.
Axes: x forward, y right, z up. Contacts: front-left, front-right, rear-left,
rear-right (left has y < 0, matching the archived reference). R = Ry(pitch) Rx(roll).
Horizontal translation and yaw are constrained; all contact forces are vertical.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass
from typing import Callable
import numpy as np


@dataclass(frozen=True)
class Parameters:
    mass: float = 40.0
    inertia_roll: float = 8.0
    inertia_pitch: float = 16.0
    inertia_yaw: float = 20.0
    half_width: float = 0.50
    half_length: float = 0.75
    com_height: float = 0.15
    stiffness: float = 4000.0  # per patch, half the archived per-side value
    damping: float = 125.0
    gravity: float = 9.81
    z0: float = 1.50

    @property
    def static_force(self):
        return self.mass * self.gravity / 4

    @property
    def b0(self):
        return self.z0 - self.com_height + self.static_force / self.stiffness

    def validate(self):
        d = asdict(self)
        if not all(np.isfinite(x) for x in d.values()):
            raise ValueError("parameters must be finite")
        if any(d[k] <= 0 for k in d if k not in ("damping", "com_height", "z0")) or self.damping < 0:
            raise ValueError("mass, inertias, dimensions, stiffness and gravity must be positive; damping nonnegative")
        inertias = [self.inertia_roll, self.inertia_pitch, self.inertia_yaw]
        if 2 * max(inertias) > sum(inertias):
            raise ValueError("principal inertias must satisfy triangle inequalities")
        if min(4*self.stiffness*self.half_width**2, 4*self.stiffness*self.half_length**2) <= self.mass*self.gravity*self.com_height:
            raise ValueError("unstable assumed upright equilibrium")


@dataclass(frozen=True)
class Gait:
    """Front/rear stride phases; step frequency is twice stride frequency.

    Amplitudes/tilts are illustrative inputs, not measured rath-carrier values.
    A stride is a full left-right cycle, containing two nominal footfall events.
    Tilt prescribes differential shoulder HEIGHT; it is not lateral translation.
    """
    step_hz: tuple = (2.0, 2.0)
    vertical_m: tuple = (0.020, 0.020)
    tilt_rad: tuple = (np.deg2rad(1.5), np.deg2rad(1.5))
    stride_phase_rad: tuple = (0.0, 0.0)
    phase_mod_rad: tuple = (0.0, 0.0)
    phase_mod_hz: float = 0.25
    phase_mod_offset_rad: tuple = (0.0, 0.0)
    ramp_s: float = 2.0

    def validate(self):
        for key in ("step_hz", "vertical_m", "tilt_rad", "stride_phase_rad", "phase_mod_rad", "phase_mod_offset_rad"):
            v = np.asarray(getattr(self, key))
            if v.shape != (2,) or not np.all(np.isfinite(v)):
                raise ValueError(f"{key} must contain two finite front/rear values")
        if min(self.step_hz) <= 0 or min(self.vertical_m) < 0 or min(self.tilt_rad) < 0:
            raise ValueError("invalid gait frequency or amplitude")
        if not np.isfinite(self.phase_mod_hz) or not np.isfinite(self.ramp_s) or self.phase_mod_hz < 0 or self.ramp_s <= 0:
            raise ValueError("invalid modulation/ramp")
        if np.any(np.pi*np.asarray(self.step_hz) <= 2*np.pi*self.phase_mod_hz*np.abs(self.phase_mod_rad)):
            raise ValueError("stride phase must advance monotonically")


def ramp(t, duration):
    if t <= 0:
        return 0.0, 0.0
    if t >= duration:
        return 1.0, 0.0
    return .5*(1-np.cos(np.pi*t/duration)), .5*np.pi/duration*np.sin(np.pi*t/duration)


class WalkingDrive:
    def __init__(self, gait: Gait, parameters: Parameters):
        gait.validate()
        self.gait, self.parameters = gait, parameters
        self.omega = np.pi*np.asarray(gait.step_hz)
        self.phase0 = np.asarray(gait.stride_phase_rad)
        self.mod = np.asarray(gait.phase_mod_rad)
        self.modphase = np.asarray(gait.phase_mod_offset_rad)
        self.modomega = 2*np.pi*gait.phase_mod_hz
        self.amplitude = np.asarray(gait.vertical_m)
        self.tilt = np.asarray(gait.tilt_rad)
        self.sides = np.array([-parameters.half_width, parameters.half_width])

    def phase(self, t):
        phase = self.omega*t+self.phase0+self.mod*np.sin(self.modomega*t+self.modphase)
        velocity = self.omega+self.mod*self.modomega*np.cos(self.modomega*t+self.modphase)
        return phase, velocity

    def __call__(self, t):
        phase, velocity = self.phase(t)
        vertical = self.amplitude*np.cos(2*phase)
        vertical_velocity = -2*self.amplitude*velocity*np.sin(2*phase)
        tilt = self.tilt*np.sin(phase)
        tilt_velocity = self.tilt*velocity*np.cos(phase)
        raw = vertical[:,None]+np.sin(tilt)[:,None]*self.sides
        raw_velocity = vertical_velocity[:,None]+(np.cos(tilt)*tilt_velocity)[:,None]*self.sides
        r, rd = ramp(t, self.gait.ramp_s)
        return self.parameters.b0+(r*raw).ravel(), (rd*raw+r*raw_velocity).ravel()


class System:
    def __init__(self, p: Parameters, drive: Callable, mode="full"):
        p.validate()
        if mode not in ("full", "pitch_locked", "collapsed"):
            raise ValueError("unknown comparison mode")
        self.p, self.drive, self.mode = p, drive, mode
        self.x = np.array([p.half_length,p.half_length,-p.half_length,-p.half_length])
        self.y = np.array([-p.half_width,p.half_width,-p.half_width,p.half_width])

    def initial(self, roll=0.0):
        return np.array([self.p.z0,roll,0.,0.,0.,0.,0.,0.])

    def geometry(self, q):
        z, phi, theta = q
        sp,cp,st,ct = np.sin(phi),np.cos(phi),np.sin(theta),np.cos(theta)
        u = self.y*sp-self.p.com_height*cp
        height = z-self.x*st+ct*u
        jacobian = np.column_stack((np.ones(4),ct*(self.y*cp+self.p.com_height*sp),-self.x*ct-st*u))
        return height, jacobian

    def inputs(self, t):
        b, bd = self.drive(t)
        if self.mode == "collapsed":
            b = np.tile((b[:2]+b[2:])/2,2)
            bd = np.tile((bd[:2]+bd[2:])/2,2)
        return b, bd

    def contact(self, t, state):
        b, bd = self.inputs(t)
        height, jac = self.geometry(state[:3])
        delta = b-height
        deltad = bd-jac@state[3:6]
        elastic = self.p.stiffness*np.maximum(delta,0)
        force = np.where(delta>0,np.maximum(elastic+self.p.damping*deltad,0),0)
        dissipation = np.where(delta>0,(force-elastic)*deltad,0)
        return b,bd,delta,force,jac,dissipation

    def rhs(self, t, state):
        p = self.p
        b,bd,delta,force,jac,dissipation = self.contact(t,state)
        phi = state[1]
        J = p.inertia_pitch*np.cos(phi)**2+p.inertia_yaw*np.sin(phi)**2
        Jprime = 2*(p.inertia_yaw-p.inertia_pitch)*np.sin(phi)*np.cos(phi)
        loads = jac.T@force
        acc = np.array([(loads[0]-p.mass*p.gravity)/p.mass,
                        (loads[1]+.5*Jprime*state[5]**2)/p.inertia_roll,
                        (loads[2]-Jprime*state[4]*state[5])/J])
        vel = state[3:6].copy()
        if self.mode != "full":
            vel[2] = acc[2] = 0.
        return np.r_[vel,acc,np.dot(force,bd),np.sum(dissipation)]

    def energy(self, state):
        # Elastic energy depends on time; this part returns body energy only.
        p = self.p
        J = p.inertia_pitch*np.cos(state[1])**2+p.inertia_yaw*np.sin(state[1])**2
        return .5*(p.mass*state[3]**2+p.inertia_roll*state[4]**2+J*state[5]**2)+p.mass*p.gravity*state[0]


def quaternion(roll, pitch):
    cr,sr,cp,sp = np.cos(roll/2),np.sin(roll/2),np.cos(pitch/2),np.sin(pitch/2)
    return np.column_stack((cp*cr,cp*sr,sp*cr,-sp*sr))


def collect(system, time, states, step_time, step_forces):
    contacts = [system.contact(t,s) for t,s in zip(time,states)]
    b,bd,delta,forces = [np.array([row[i] for row in contacts]) for i in range(4)]
    energy = np.array([system.energy(s) for s in states])+.5*system.p.stiffness*np.sum(np.maximum(delta,0)**2,axis=1)
    out = dict(time_s=time,state=states,support_height_m=b,support_velocity_m_s=bd,
               compression_m=delta,force_N=forces,energy_J=energy,
               energy_residual_J=energy-energy[0]-states[:,6]+states[:,7],
               position_m=np.column_stack((np.zeros(len(time)),np.zeros(len(time)),states[:,0])),
               quaternion_wxyz=quaternion(states[:,1],states[:,2]),
               step_time_s=step_time,step_force_N=step_forces)
    if isinstance(system.drive,WalkingDrive):
        out["stride_phase_rad"] = np.array([system.drive.phase(t)[0] for t in time])
    return out


def simulate(system: System, duration=24.0, dt=.001, sample_dt=.01, initial=None):
    """RK4, evaluating contact at every stage; force statistics at EVERY step.

    Output poses use sample_dt; contact fractions use dt, not rendered frames.
    Stored contact loss is zero normal force (separation OR clipped unloading).
    """
    steps = int(round(duration/dt)); stride = int(round(sample_dt/dt))
    if steps<1 or stride<1 or not np.isclose(steps*dt,duration) or not np.isclose(stride*dt,sample_dt) or steps%stride:
        raise ValueError("duration and sample interval must be multiples of dt")
    y = system.initial() if initial is None else np.array(initial,dtype=float).copy()
    if y.shape!=(8,) or not np.all(np.isfinite(y)):
        raise ValueError("initial state must have eight finite entries")
    if system.mode!="full" and (y[2]!=0 or y[5]!=0):
        raise ValueError("pitch-locked initial state must have zero pitch and pitch velocity")
    history = np.empty((steps//stride+1,8)); history[0]=y
    step_time = np.arange(steps+1)*dt
    step_forces = np.empty((steps+1,4)); step_forces[0]=system.contact(0,y)[3]
    for n in range(steps):
        t=n*dt
        k1=system.rhs(t,y);k2=system.rhs(t+dt/2,y+dt*k1/2)
        k3=system.rhs(t+dt/2,y+dt*k2/2);k4=system.rhs(t+dt,y+dt*k3)
        y=y+dt/6*(k1+2*k2+2*k3+k4)
        if not np.all(np.isfinite(y)):
            raise FloatingPointError(f"nonfinite state at step {n}")
        step_forces[n+1]=system.contact((n+1)*dt,y)[3]
        if (n+1)%stride==0:history[(n+1)//stride]=y
    time=np.arange(len(history))*sample_dt
    return collect(system,time,history,step_time,step_forces)


def metrics(out, p, start=8.):
    keep=out['time_s']>=start-1e-10
    s=out['state'][keep];f=out['step_force_N'][out['step_time_s']>=start-1e-10]
    sides=f[:,[0,1]]+f[:,[2,3]]
    loss=f<=1e-9
    return dict(heave_rms_mm=float(np.std(s[:,0])*1000),
                roll_rms_deg=float(np.sqrt(np.mean(s[:,1]**2))*180/np.pi),
                pitch_rms_deg=float(np.sqrt(np.mean(s[:,2]**2))*180/np.pi),
                peak_patch_N=float(f.max()),peak_patch_over_static=float(f.max()/p.static_force),
                peak_side_over_static=float(sides.max()/(2*p.static_force)),
                minimum_patch_N=float(f.min()),
                zero_force_fraction=float(np.mean(loss)),any_zero_force_fraction=float(np.mean(np.any(loss,axis=1))),
                per_patch_zero_force_fraction=np.mean(loss,axis=0).tolist(),
                maximum_energy_residual_J=float(np.max(np.abs(out['energy_residual_J']))),
                max_abs_roll_deg=float(np.max(np.abs(s[:,1]))*180/np.pi),
                max_abs_pitch_deg=float(np.max(np.abs(s[:,2]))*180/np.pi))

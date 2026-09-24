"""Physical invariants, analytic limits and coordinate checks for the extension."""
from dataclasses import replace
import numpy as np
import pytest
from scipy.spatial.transform import Rotation
from walking_model import Parameters,Gait,WalkingDrive,System,simulate,quaternion


def stationary(p):return lambda t:(np.full(4,p.b0),np.zeros(4))


def test_equilibrium_preload_and_linear_stiffness():
    p=Parameters();s=System(p,stationary(p));y=s.initial()
    np.testing.assert_allclose(s.contact(0,y)[3],p.static_force,atol=1e-10)
    np.testing.assert_allclose(s.rhs(0,y),0,atol=1e-10)
    for j,I,span in [(1,p.inertia_roll,p.half_width),(2,p.inertia_pitch,p.half_length)]:
        v=y.copy();v[j]=1e-6
        measured=-s.rhs(0,v)[3+j]*I/1e-6
        assert measured==pytest.approx(4*p.stiffness*span**2-p.mass*p.gravity*p.com_height,rel=1e-7)


def test_geometry_quaternion_and_virtual_work():
    p=Parameters();s=System(p,stationary(p));q=np.array([1.53,.24,-.18])
    height,jac=s.geometry(q)
    quat=quaternion(np.array([q[1]]),np.array([q[2]]))[0]
    rotated=Rotation.from_quat(quat[[1,2,3,0]]).apply(np.column_stack((s.x,s.y,np.full(4,-p.com_height))))
    np.testing.assert_allclose(rotated[:,2]+q[0],height,atol=1e-14)
    eps=1e-6
    for j in range(3):
        d=np.eye(3)[j]*eps
        np.testing.assert_allclose((s.geometry(q+d)[0]-s.geometry(q-d)[0])/(2*eps),jac[:,j],atol=2e-10)
    force=np.array([42.,125.,0.,186.]);dq=np.array([.03,-.02,.07])
    assert np.dot(force,jac@dq)==pytest.approx(np.dot(jac.T@force,dq),abs=1e-12)


def test_front_up_drives_negative_pitch_right_up_positive_roll():
    p=Parameters()
    for offset,axis,sign in [(np.array([1,1,-1,-1])*.001,2,-1),(np.array([-1,1,-1,1])*.001,1,1)]:
        s=System(p,lambda t:(p.b0+offset,np.zeros(4)))
        assert sign*s.rhs(0,s.initial())[3+axis]>0


def test_gap_and_clipped_unloading_are_non_tensile():
    p=Parameters()
    for b,bd in [(p.b0-.1,0.),(p.b0,-2.)]:
        s=System(p,lambda t:(np.full(4,b),np.full(4,bd)))
        c=s.contact(0,s.initial())
        np.testing.assert_array_equal(c[3],0.)
        assert np.all(c[-1]>=0.)


@pytest.mark.parametrize('b,bd',[(1.38,.1),(1.0,.1),(1.38,-2.)])
def test_finite_angle_instantaneous_work_energy_identity(b,bd):
    p=Parameters();s=System(p,lambda t:(np.full(4,b+bd*t),np.full(4,bd)))
    y=s.initial();y[1:6]=[.02,-.015,.03,.04,-.05];dy=s.rhs(0,y)
    def total(t,state):
        return s.energy(state)+.5*p.stiffness*np.sum(np.maximum(s.contact(t,state)[2],0)**2)
    eps=1e-7
    derivative=(total(eps,y+eps*dy)-total(-eps,y-eps*dy))/(2*eps)
    assert derivative==pytest.approx(dy[6]-dy[7],abs=2e-6)


def test_gait_velocity_and_stride_step_distinction():
    p=Parameters();g=Gait(stride_phase_rad=(0.,np.pi),phase_mod_rad=(.08,.08))
    d=WalkingDrive(g,p)
    for t in [.4,1.3,3.13,8.71]:
        eps=1e-6
        np.testing.assert_allclose((d(t+eps)[0]-d(t-eps)[0])/(2*eps),d(t)[1],atol=5e-10)
        b=d(t)[0].reshape(2,2)
        assert b[0].mean()==pytest.approx(b[1].mean(),abs=1e-14)
        assert b[0,1]-b[0,0]==pytest.approx(-(b[1,1]-b[1,0]),abs=1e-14)


def test_diagonal_forcing_can_change_patch_load_without_net_torque():
    p=Parameters();offset=np.array([-1,1,1,-1])*.01
    s=System(p,lambda t:(p.b0+offset,np.zeros(4)))
    y=s.initial();np.testing.assert_allclose(s.rhs(0,y)[:6],0,atol=1e-10)
    assert np.ptp(s.contact(0,y)[3])==pytest.approx(80.)
    collapsed=System(p,s.drive,'collapsed')
    np.testing.assert_allclose(collapsed.contact(0,y)[3],p.static_force,atol=1e-10)


def test_small_signal_pitch_matches_frequency_response():
    p=Parameters();omega=2*np.pi*1.5;amplitude=1e-5
    pattern=np.array([1,1,-1,-1])
    def drive(t):return p.b0+amplitude*pattern*np.sin(omega*t),amplitude*omega*pattern*np.cos(omega*t)
    s=System(p,drive);out=simulate(s,duration=8.,dt=.002)
    t=out['time_s'];keep=t>=4;pitch=out['state'][keep,2]
    fit=np.linalg.lstsq(np.column_stack((np.sin(omega*t[keep]),np.cos(omega*t[keep]),np.ones(sum(keep)))),pitch,rcond=None)[0]
    K=4*p.stiffness*p.half_length**2-p.mass*p.gravity*p.com_height
    C=4*p.damping*p.half_length**2
    expected=abs(-4*p.half_length*(p.stiffness+1j*omega*p.damping)*amplitude/(K-p.inertia_pitch*omega**2+1j*omega*C))
    assert np.hypot(*fit[:2])==pytest.approx(expected,rel=2e-6)
    assert np.max(np.abs(out['energy_residual_J']))<1e-8


def test_parameter_and_phase_validation():
    with pytest.raises(ValueError):replace(Parameters(),mass=0).validate()
    with pytest.raises(ValueError):replace(Parameters(),inertia_yaw=100).validate()
    with pytest.raises(ValueError):Gait(step_hz=(2.,)).validate()
    with pytest.raises(ValueError):Gait(phase_mod_rad=(10.,10.)).validate()

import json
import math
from datetime import UTC, datetime, timedelta
from pathlib import Path

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from lunascope.observer import build_observer
from lunascope.providers.geometry.horizons import parse_response
from lunascope.providers.geometry.interpolate import (
    DirectionSpline,
    SplineError,
    geometry_timing_bound_s,
    holdout_error_deg,
    to_enu_vector,
)

FIX = Path(__file__).parent.parent / "fixtures" / "horizons"
T0 = datetime(2027, 1, 10, tzinfo=UTC)


def analytic(t, A=0.3, P=86400.0, az0=150.0, az_span=3.0, phase=0.0):
    el = A * np.sin(2 * np.pi * (t + phase) / P)
    az = az0 + az_span * np.sin(2 * np.pi * t / (2 * P))
    return az, el


def real_series(name):
    obs = build_observer(site_id="fx", lat_deg=-89.5, lon_deg=0.0, convention="planetocentric",
                         lon_direction="east_positive", reference_radius_km=1737.4,
                         ground_height_m=0.0, ground_height_source="fixture",
                         observer_height_above_ground_m=0.0)
    meta = json.loads((FIX / f"{name}.meta.json").read_text())
    times = [T0 + timedelta(minutes=k) for k in range(361)]
    return parse_response((FIX / f"{name}.json").read_bytes(), obs=obs,
                          target="sun_center" if "sun" in name else "earth_center",
                          expected_times=times, params=meta["params"], retrieved_utc="x")


# ---- construction and accuracy ---------------------------------------------------------------
def test_reproduces_nodes_and_stays_on_the_unit_sphere():
    t = np.arange(0, 7200.0 + 1, 600.0)
    az, el = analytic(t)
    sp = DirectionSpline(t, az, el)
    for i in (0, 5, len(t) - 1):
        assert np.allclose(sp.eval(t[i])[0], to_enu_vector(az[i], el[i]), atol=1e-14)
    for x in np.linspace(0, 7200, 97):
        assert abs(np.linalg.norm(sp.eval(x)[0]) - 1) < 1e-7


def test_error_falls_about_eightfold_when_the_step_is_halved():
    ts = np.linspace(0, 40000, 2001)
    errs = []
    for step in (4000.0, 2000.0):
        t = np.arange(0, 40000.0 + 1, step)
        sp = DirectionSpline(t, *analytic(t))
        az, el = analytic(ts)
        errs.append(holdout_error_deg(sp, ts, az, el).max_deg)
    assert errs[0] / errs[1] > 5.0  # third order: ~8x


def test_rejects_bad_grids_and_out_of_range_times():
    with pytest.raises(SplineError):
        DirectionSpline([0, 1], [0, 0], [0, 0])
    with pytest.raises(SplineError):
        DirectionSpline([0, 1, 3, 4], [0] * 4, [0] * 4)  # non-uniform
    sp = DirectionSpline([0, 10, 20], [10, 11, 12], [0, 0, 0])
    with pytest.raises(SplineError):
        sp.eval(25.0)


def test_azimuth_wrap_is_harmless():
    t = np.arange(0, 3601.0, 600.0)
    az = (359.5 + t / 3600.0) % 360.0  # crosses north
    sp = DirectionSpline(t, az, np.full_like(t, 1.0))
    a, e = sp.az_el(1800.0)
    assert (a - 360.0 if a > 180 else a) == pytest.approx(0.0, abs=1e-6)
    assert e == pytest.approx(1.0, abs=1e-9)


# ---- the bounds really are bounds ------------------------------------------------------------
@given(st.floats(0.05, 2.0), st.floats(20000, 200000), st.floats(0.5, 20.0),
       st.floats(0.0, 80000.0))
@settings(max_examples=40, deadline=None)
def test_derivative_bounds_hold_on_dense_samples(A, P, az_span, phase):
    t = np.arange(0, 20000.0 + 1, 1000.0)
    az, el = analytic(t, A=A, P=P, az_span=az_span, phase=phase)
    sp = DirectionSpline(t, az, el)
    a, b = 3000.0, 9000.0
    mb = sp.motion_bounds(a, b)
    xs = np.linspace(a, b, 241)
    rates = np.array([sp.rates(x) for x in xs])  # (az', el') deg/s, analytic
    assert np.abs(rates[:, 0]).max() <= mb.az_rate * (1 + 1e-9) + 1e-15
    assert np.abs(rates[:, 1]).max() <= mb.el_rate * (1 + 1e-9) + 1e-15
    d = 0.5
    acc = np.array([[(sp.rates(x + d)[k] - sp.rates(x - d)[k]) / (2 * d) for k in (0, 1)]
                    for x in xs[1:-1]])
    assert np.abs(acc[:, 0]).max() <= mb.az_acc * (1 + 1e-6) + 1e-12
    assert np.abs(acc[:, 1]).max() <= mb.el_acc * (1 + 1e-6) + 1e-12


def test_analytic_rates_match_finite_differences():
    t = np.arange(0, 20000.0 + 1, 1000.0)
    sp = DirectionSpline(t, *analytic(t))
    for x in (1500.0, 7777.0):
        a0, e0 = sp.az_el(x - 0.5)
        a1, e1 = sp.az_el(x + 0.5)
        ar, er = sp.rates(x)
        assert ar == pytest.approx(a1 - a0, abs=1e-9) and er == pytest.approx(e1 - e0, abs=1e-9)


def test_bounds_refuse_to_certify_near_the_zenith():
    t = np.arange(0, 3601.0, 600.0)
    sp = DirectionSpline(t, np.full_like(t, 10.0), np.linspace(85, 88, len(t)))
    assert math.isinf(sp.motion_bounds(0, 3600).az_rate)


# ---- real Horizons data ----------------------------------------------------------------------
@pytest.mark.parametrize("name", ["sun_pole_1min", "earth_pole_1min"])
def test_holdout_against_real_one_minute_series(name):
    s = real_series(name)
    t = np.arange(361) * 60.0
    out = {}
    for k in (60, 10):  # hourly and 10-minute node grids; 1-minute data is the held-out truth
        sp = DirectionSpline(t[::k], s.az_deg[::k], s.el_deg[::k])
        out[k] = holdout_error_deg(sp, t, s.az_deg, s.el_deg)
    assert out[60].n == 361
    assert out[10].max_deg < 1e-7  # measured ~1e-8 deg (Sun), ~2e-9 deg (Earth)
    assert out[60].max_deg < 1e-5  # measured ~2.6e-6 deg (Sun)
    assert out[60].max_deg / out[10].max_deg > 10  # converges with finer nodes


def test_real_data_timing_consequence_is_tiny_at_ten_minutes():
    s = real_series("sun_pole_1min")
    t = np.arange(361) * 60.0
    h = holdout_error_deg(DirectionSpline(t[::10], s.az_deg[::10], s.el_deg[::10]), t,
                          s.az_deg, s.el_deg).max_deg
    rate = 1.4e-4  # deg/s, the Sun's azimuth rate at this site
    assert geometry_timing_bound_s(h, rate) < 1e-3  # sub-millisecond


def test_timing_bound_has_no_claim_near_a_tangent():
    assert geometry_timing_bound_s(1e-6, 2e-5) == pytest.approx(0.05)
    assert geometry_timing_bound_s(1e-6, 0.0) is None
    assert geometry_timing_bound_s(1e-6, 1e-9) is None

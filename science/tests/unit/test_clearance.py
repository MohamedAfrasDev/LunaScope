"""End to end: interpolated geometry + terrain horizon -> certified events and durations.

Truth is an analytic track evaluated densely at 1 s; the production path only sees 10-minute nodes.
"""

import numpy as np
import pytest
from scipy.optimize import brentq

from lunascope.clearance import TerrainClearanceModel
from lunascope.codes import IntervalClass as C
from lunascope.events import Settings, build_partition
from lunascope.horizon import (
    CERTIFIED,
    COVERAGE_LIMITED,
    HorizonProfile,
    HorizonSettings,
    compute_horizon,
)
from lunascope.metrics import summarize
from lunascope.observer import build_observer
from lunascope.providers.geometry.interpolate import DirectionSpline
from lunascope.terrain import FlatSphere, expected_flat_dip_deg

DAY = 86400.0
EPS = 0.01
S = Settings(eps=EPS)


def obs():
    return build_observer(site_id="t", lat_deg=-89.5, lon_deg=0.0, convention="planetocentric",
                          lon_direction="east_positive", reference_radius_km=1737.4,
                          ground_height_m=0.0, ground_height_source="synthetic",
                          observer_height_above_ground_m=2.0)


def nodes(az_fn, el_fn, step=600.0, end=DAY):
    t = np.arange(0, end + 1, step)
    return DirectionSpline(t, az_fn(t), el_fn(t))


def dense_durations(d_fn, t1=DAY):
    """Brute-force classification at 1 s from the analytic truth."""
    d = np.array([d_fn(x) for x in np.arange(0, t1, 1.0)])
    return {C.VISIBLE: float((d > EPS).sum()), C.HIDDEN: float((d < -EPS).sum()),
            C.UNRESOLVED: float((np.abs(d) <= EPS).sum())}


def dur(p, cls):
    return sum(i.duration for i in p.intervals if i.cls == cls)


def piecewise_profile(values_by_bin, states=None, step=1.0):
    n = round(360 / step)
    h = np.array([values_by_bin(i * step) for i in range(n)], dtype=float)
    st = np.zeros(n, dtype=np.int8) if states is None else states
    return HorizonProfile(np.arange(n) * step, h, np.zeros(n), st, HorizonSettings(az_step_deg=step),
                          "o", {})


# ---- smooth skyline: terrain and geometric-only ---------------------------------------------
def test_flat_dip_skyline_events_and_durations_match_dense_truth():
    o = obs()
    prof = compute_horizon(o, FlatSphere(o), HorizonSettings(radius_km=30, az_step_deg=1.0,
                                                           near_pixel_m=100, far_pixel_m=100))
    dip = expected_flat_dip_deg(1737.4, 2.0)
    az_fn = lambda t: 150.0 + 3.0 * np.sin(2 * np.pi * t / (2 * DAY))
    el_fn = lambda t: 0.3 * np.sin(2 * np.pi * (t + 5000) / DAY)
    model = TerrainClearanceModel(nodes(az_fn, el_fn), prof)

    p = build_partition(model, 0.0, DAY, 600.0, S)
    truth = lambda x: float(el_fn(x) - dip)
    zeros = [brentq(lambda x: truth(x), a, b) for a, b in ((40000, 45000), (75000, 80000))]
    got = [e.t for e in p.events]
    assert len(got) == 2
    assert got[0] == pytest.approx(zeros[0], abs=2.0) and got[1] == pytest.approx(zeros[1], abs=2.0)
    assert [e.type for e in p.events] == ["set", "rise"]  # starts visible, sets, then rises
    ref = dense_durations(truth)
    for cls in (C.VISIBLE, C.HIDDEN, C.UNRESOLVED):
        assert dur(p, cls) == pytest.approx(ref[cls], abs=15.0)
    assert dur(p, C.UNCERTIFIED) == 0 and dur(p, C.GAP) == 0


def test_geometric_only_differs_from_terrain_aware():
    o = obs()
    prof = compute_horizon(o, FlatSphere(o), HorizonSettings(radius_km=30, az_step_deg=1.0,
                                                           near_pixel_m=100, far_pixel_m=100))
    az_fn = lambda t: 150.0 + 0.0 * t
    el_fn = lambda t: -0.05 + 0.0 * t
    sp = nodes(az_fn, el_fn)
    flat = build_partition(TerrainClearanceModel(sp, None), 0.0, DAY, 600.0, S)
    terr = build_partition(TerrainClearanceModel(sp, prof), 0.0, DAY, 600.0, S)
    assert dur(flat, C.HIDDEN) == pytest.approx(DAY)  # geometric-only says never visible
    assert dur(terr, C.VISIBLE) == pytest.approx(DAY)  # over the depressed skyline it is visible
    m = summarize(terr.intervals, 0, DAY, 0.6)
    assert m.outcome.value == "PASS"


# ---- skyline knot inside an interval ---------------------------------------------------------
def test_target_crossing_a_skyline_knot_is_still_found():
    # skyline: 0 deg up to az 151, ramps to 1 deg at az 152, then flat 1 deg
    prof = piecewise_profile(lambda a: 0.0 if a <= 151 else (a - 151.0 if a <= 152 else 1.0))
    az_fn = lambda t: 150.0 + 3.0 * t / DAY
    el_fn = lambda t: 0.5 + 0.0 * t
    model = TerrainClearanceModel(nodes(az_fn, el_fn), prof)
    p = build_partition(model, 0.0, DAY, 600.0, S)
    # d = 0.5 - h(az); zero when h = 0.5, i.e. az = 151.5 -> t = 1.5/3 * DAY
    assert [e.type for e in p.events] == ["set"]
    assert p.events[0].t == pytest.approx(DAY / 2, abs=2.0)
    assert dur(p, C.UNCERTIFIED) == 0
    # the Lipschitz bound over a window containing the ramp must include the ramp's slope
    inside = model.lipschitz(DAY * 0.30, DAY * 0.36)  # az 150.9 .. 151.08 straddles the knot at 151
    away = model.lipschitz(DAY * 0.05, DAY * 0.11)
    assert inside > 1.9 * away  # + (slope 1) x azimuth rate, on top of the elevation-rate bound


def test_monotone_is_refused_across_a_knot_and_granted_inside_a_piece():
    prof = piecewise_profile(lambda a: 0.0 if a <= 151 else (a - 151.0 if a <= 152 else 1.0))
    model = TerrainClearanceModel(nodes(lambda t: 150.0 + 3.0 * t / DAY,
                                        lambda t: 0.5 + 0.0 * t), prof)
    assert model.monotone(DAY * 0.30, DAY * 0.36) is False  # knot at az 151 inside
    assert model.monotone(DAY * 0.40, DAY * 0.45) is True  # inside the ramp (az 151.2 .. 151.35)


# ---- unknown skyline -------------------------------------------------------------------------
def test_unknown_sectors_become_gap_never_hidden():
    states = np.zeros(360, dtype=np.int8)
    states[152:155] = COVERAGE_LIMITED
    prof = piecewise_profile(lambda a: 0.0, states=states)
    prof.horizon_el_deg[152:155] = np.nan
    model = TerrainClearanceModel(nodes(lambda t: 150.0 + 3.0 * t / DAY,
                                        lambda t: 0.5 + 0.0 * t), prof)
    p = build_partition(model, 0.0, DAY, 600.0, S)
    # unknown from az 151 (segment 151-152 touches bin 152) -> t = DAY/3 onwards
    assert dur(p, C.GAP) == pytest.approx(DAY * 2 / 3, abs=30.0)
    assert dur(p, C.HIDDEN) == 0
    m = summarize(p.intervals, 0, DAY, 0.2)
    assert m.outcome.value == "EXCLUDED" and "COVERAGE_MISSING" in m.exclusion_reasons
    assert m.availability_upper == pytest.approx(1.0) and m.availability_lower < 0.4
    assert (states == CERTIFIED).sum() == 357


# ---- a ridge dip ----------------------------------------------------------------------------
def test_short_terrain_dip_between_visible_samples_is_found():
    # a narrow skyline spike (1 deg wide) the target passes behind for ~28800 s * (1/3) ... between nodes
    prof = piecewise_profile(lambda a: 1.0 if abs(a - 151.5) <= 0.5 else 0.0)
    az_fn = lambda t: 150.0 + 3.0 * t / DAY
    el_fn = lambda t: 0.4 + 0.0 * t
    model = TerrainClearanceModel(nodes(az_fn, el_fn), prof)
    p = build_partition(model, 0.0, DAY, 600.0, S)
    types = [e.type for e in p.events]
    assert types == ["set", "rise"]
    assert dur(p, C.UNCERTIFIED) == 0
    assert dur(p, C.HIDDEN) > 0.2 * DAY

import math

import numpy as np
import pytest
from hypothesis import given, settings
from hypothesis import strategies as st

from lunascope.observer import (
    ObserverUnresolved,
    az_el,
    build_observer,
    enu_basis,
    wrapped_diff_deg,
)

R = 1737.4


def make(lat, lon=0.0, **kw):
    args = {
        "site_id": "t", "lat_deg": lat, "lon_deg": lon, "convention": "planetocentric",
        "lon_direction": "east_positive", "reference_radius_km": R, "ground_height_m": 0.0,
        "ground_height_source": "synthetic", "observer_height_above_ground_m": 2.0,
    }
    args.update(kw)
    return build_observer(**args)


SITES = [(0.0, 0.0), (-45.0, 120.0), (-89.5, 222.7), (-89.9999, 10.0), (-90.0, 0.0), (90.0, 33.0)]


@pytest.mark.parametrize("lat,lon", SITES)
def test_zenith(lat, lon):
    obs = make(lat, lon)
    _, _, u = obs.enu
    _, el = az_el(u, obs)
    assert el == pytest.approx(90.0, abs=1e-9)


@pytest.mark.parametrize("lat,lon", SITES)
def test_horizon_plane(lat, lon):
    obs = make(lat, lon)
    e, n, _ = obs.enu
    for v in (e, n, -e, -n):
        _, el = az_el(v, obs)
        assert el == pytest.approx(0.0, abs=1e-9)


@pytest.mark.parametrize("lat,lon", SITES)
def test_cardinals(lat, lon):
    obs = make(lat, lon)
    e, n, _ = obs.enu
    for vec, expected in ((n, 0.0), (e, 90.0), (-n, 180.0), (-e, 270.0)):
        az, _ = az_el(vec, obs)
        assert float(wrapped_diff_deg(az, expected)) == pytest.approx(0.0, abs=1e-9)


def test_north_is_physical_north_at_equator():
    # Hand-derived: at lat 0, lon 0 the body-fixed +Z axis is local north, +Y is east.
    obs = make(0.0, 0.0)
    az_n, _ = az_el(np.array([0, 0, 1.0]), obs)
    az_e, _ = az_el(np.array([0, 1.0, 0]), obs)
    assert float(az_n) == pytest.approx(0.0, abs=1e-9)
    assert float(az_e) == pytest.approx(90.0, abs=1e-9)


def test_basis_is_right_handed_orthonormal_at_pole():
    e, n, u = enu_basis(-90.0, 0.0)
    assert np.allclose([e @ e, n @ n, u @ u], 1.0)
    assert abs(e @ n) < 1e-12 and abs(e @ u) < 1e-12 and abs(n @ u) < 1e-12
    assert np.allclose(np.cross(e, n), u)


@given(st.floats(-90, 90), st.floats(0, 360), st.floats(0, 360), st.floats(-89.9, 89.9))
@settings(max_examples=100, deadline=None)
def test_round_trip(lat, lon, az, el):
    obs = make(lat, lon)
    e, n, u = obs.enu
    a, h = math.radians(az), math.radians(el)
    v = math.cos(h) * (math.sin(a) * e + math.cos(a) * n) + math.sin(h) * u
    az2, el2 = az_el(v, obs)
    assert float(wrapped_diff_deg(az2, az)) == pytest.approx(0.0, abs=1e-6)
    assert float(el2) == pytest.approx(el, abs=1e-6)


def test_west_positive_longitude_converted():
    assert make(-80, 30, lon_direction="west_positive").lon_deg_east == pytest.approx(330.0)


def test_longitude_wrapped():
    assert make(-80, -10).lon_deg_east == pytest.approx(350.0)


def test_unresolved_when_ground_height_missing():
    with pytest.raises(ObserverUnresolved):
        make(-89, ground_height_m=None)


def test_unresolved_for_unknown_convention():
    with pytest.raises(ObserverUnresolved):
        make(-89, convention="planetographic")


def test_height_above_ground_is_not_height_above_reference():
    obs = make(-89, ground_height_m=-1500.0, observer_height_above_ground_m=2.0)
    assert obs.radius_km == pytest.approx(R + (-1500.0 + 2.0) / 1000.0)
    # A wrong unit (km instead of m) or conflated heights must change the radius detectably.
    assert obs.radius_km != pytest.approx(R + 2.0 / 1000.0)


@pytest.mark.parametrize("bad", [
    {"lat": -91}, {"lat": float("nan")},
    {"observer_height_above_ground_m": -1}, {"observer_height_above_ground_m": 51},
])
def test_rejects_bad_inputs(bad):
    lat = bad.pop("lat", -80)
    with pytest.raises(ValueError):
        make(lat, **bad)

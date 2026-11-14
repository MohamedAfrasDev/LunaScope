"""Test case 12: a wrong unit, direction or height must FAIL, not produce a plausible-looking skyline.

Each test compares the horizon engine with a hand derivation that does not use production code, and
also checks that the mistake it guards against would land far outside the tolerance, so the test can
actually fail when the mistake is made (a check that cannot fail proves nothing).
"""

import math

import numpy as np
import pytest

from lunascope.horizon import HorizonSettings, compute_horizon, radial_schedule
from lunascope.observer import build_observer
from lunascope.terrain import Ridge

R = 1737.4  # km, the reference sphere
S = HorizonSettings(radius_km=15.0, az_step_deg=1.0, near_pixel_m=50.0, far_pixel_m=50.0)
TOL_DEG = 0.02


def obs_at(mast_m=2.0, lat=-89.5, lon=0.0):
    return build_observer(site_id="t", lat_deg=lat, lon_deg=lon, convention="planetocentric",
                          lon_direction="east_positive", reference_radius_km=R, ground_height_m=0.0,
                          ground_height_source="synthetic", observer_height_above_ground_m=mast_m)


def hand_angle_deg(h_obs_m: float, ridge_m: float, d_km: float) -> float:
    """Elevation of a ridge top above the observer's local horizontal, from plane geometry on the sphere."""
    phi = d_km / R
    up = (R + ridge_m / 1000) * math.cos(phi) - (R + h_obs_m / 1000)
    along = (R + ridge_m / 1000) * math.sin(phi)
    return math.degrees(math.atan2(up, along))


def expected_deg(h_obs_m: float, ridge_m: float, d_km: float = 5.0) -> float:
    """The hand derivation at the first radial sample on or past the ridge's near edge: the engine
    samples a 50 m grid, so the front edge is seen at the first sample at or beyond d_km."""
    d_sample = float(next(x for x in radial_schedule(S) if x >= d_km))
    return hand_angle_deg(h_obs_m, ridge_m, d_sample)


def peak(obs, az, ridge_m=300.0, d_km=5.0):
    t = Ridge(obs, az_deg=az, half_width_deg=5.0, dist_km=d_km, length_km=1.0, height_m=ridge_m)
    p = compute_horizon(obs, t, S)
    i = int(np.nanargmax(p.horizon_el_deg))
    return float(p.azimuth_deg[i]), float(p.horizon_el_deg[i]), p


def test_ridge_height_in_metres_matches_the_hand_derivation_and_a_unit_error_would_not():
    _, el, _ = peak(obs_at(), az=90.0)
    right = expected_deg(2.0, 300.0)
    assert el == pytest.approx(right, abs=TOL_DEG)
    # the mistakes this guards against are enormous next to the tolerance
    assert abs(hand_angle_deg(2.0, 300.0 * 1000, 5.0) - right) > 30.0  # metres read as kilometres
    assert abs(hand_angle_deg(2.0, 300.0 / 1000, 5.0) - right) > 3.0  # kilometres read as metres


def test_a_ridge_ten_times_taller_is_not_ten_times_the_angle_but_the_right_one():
    _, el, _ = peak(obs_at(), az=90.0, ridge_m=3000.0)
    assert el == pytest.approx(expected_deg(2.0, 3000.0), abs=TOL_DEG)


def test_observer_height_enters_the_skyline_exactly_as_derived():
    low = peak(obs_at(mast_m=2.0), az=90.0)[1]
    high = peak(obs_at(mast_m=50.0), az=90.0)[1]  # 50 m is the largest mast the model accepts
    assert low == pytest.approx(expected_deg(2.0, 300.0), abs=TOL_DEG)
    assert high == pytest.approx(expected_deg(50.0, 300.0), abs=TOL_DEG)
    assert low - high > 0.3  # 48 m of extra height lowers a 300 m ridge 5 km away by about half a degree
    # a mast that is ignored, or counted twice, would land far outside the tolerance
    assert abs(low - expected_deg(0.0, 300.0)) < 0.05 < abs(high - expected_deg(0.0, 300.0))


@pytest.mark.parametrize("az", [90.0, 270.0, 0.0, 180.0])
def test_the_skyline_peak_is_where_the_ridge_is_not_mirrored(az):
    peak_az, el, p = peak(obs_at(), az=az)
    d = (peak_az - az + 180.0) % 360.0 - 180.0
    assert abs(d) <= 5.0  # inside the ridge's own width
    assert el > 3.0
    far_side = p.horizon_el_deg[int((az + 180.0) % 360.0)]
    assert far_side < 0.5  # the opposite direction is just the curved-surface dip


def test_east_is_ninety_degrees_by_the_observers_own_basis_and_a_mirror_would_fail():
    """Place the ridge by an explicit east vector from the observer's local frame (itself checked in
    test_observer against N/E/S/W), then ask where the engine puts it. If azimuth were mirrored
    (east<->west), this would put the peak at 270 and fail."""
    obs = obs_at()
    e, n, u = (np.asarray(v, float) for v in obs.enu)
    phi = 5.5 / R

    def q(direction):
        return math.cos(phi) * u + math.sin(phi) * direction

    ridge = Ridge(obs, az_deg=90.0, half_width_deg=5.0, dist_km=5.0, length_km=1.0, height_m=300.0)
    assert ridge.elevation_m(q(e)[None, :])[0] == pytest.approx(300.0)  # 5.5 km due east: on the ridge
    assert ridge.elevation_m(q(-e)[None, :])[0] == pytest.approx(0.0)  # due west: nothing
    assert ridge.elevation_m(q(n)[None, :])[0] == pytest.approx(0.0)  # due north: nothing
    assert peak(obs, az=90.0)[0] == pytest.approx(90.0, abs=5.0)
    assert abs(((peak(obs, az=270.0)[0] - 90.0 + 180.0) % 360.0) - 180.0) > 100.0  # and west is not east


def test_west_positive_longitude_is_the_mirror_site_across_the_pole():
    east = obs_at(lon=30.0)
    west = build_observer(site_id="t", lat_deg=-89.5, lon_deg=30.0, convention="planetocentric",
                          lon_direction="west_positive", reference_radius_km=R, ground_height_m=0.0,
                          ground_height_source="synthetic", observer_height_above_ground_m=2.0)
    assert east.lon_deg_east == pytest.approx(30.0) and west.lon_deg_east == pytest.approx(330.0)
    # 0.5 deg from the pole, 60 deg apart in longitude: they are 0.5 * 2 * sin(30 deg) = 0.5 deg apart
    sep = math.degrees(math.acos(np.clip(np.dot(east.enu[2], west.enu[2]), -1, 1)))
    assert sep == pytest.approx(0.5, abs=0.01)
    same = obs_at(lon=30.0)  # reading the same number as east-positive would put the site at 30, not 330
    assert math.degrees(math.acos(np.clip(np.dot(same.enu[2], west.enu[2]), -1, 1))) > 0.4


def test_latitude_sign_south_is_the_pole_we_mean():
    south = obs_at(lat=-89.5)
    north = obs_at(lat=89.5)
    assert float(np.dot(south.enu[2], north.enu[2])) < 0  # opposite poles: local up vectors nearly opposite
    assert float(south.enu[2][2]) < -0.99  # -89.5 deg is within half a degree of the south pole axis (-z)

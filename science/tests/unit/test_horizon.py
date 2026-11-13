import dataclasses
import math

import numpy as np
import pytest

from lunascope.codes import IntervalClass as C
from lunascope.events import class_of
from lunascope.horizon import (
    CERTIFIED,
    COVERAGE_LIMITED,
    Cancelled,
    HorizonProfile,
    HorizonSettings,
    clearance_deg,
    compare_profiles,
    compute_horizon,
    radial_schedule,
)
from lunascope.observer import build_observer
from lunascope.terrain import CraterRim, FlatSphere, Ridge, expected_flat_dip_deg

R = 1737.4
S = HorizonSettings(radius_km=30.0, az_step_deg=1.0, near_pixel_m=100.0, far_pixel_m=100.0)


def obs_at(height_m=2.0, lat=-89.5, lon=0.0):
    return build_observer(
        site_id="t", lat_deg=lat, lon_deg=lon, convention="planetocentric",
        lon_direction="east_positive", reference_radius_km=R, ground_height_m=0.0,
        ground_height_source="synthetic", observer_height_above_ground_m=height_m,
    )


def block_angle_deg(h_obs_m, H_m, d_km):
    """Hand-derived 2D geometry in the great-circle plane (independent of production code)."""
    phi = d_km / R
    wx = (R + H_m / 1000) * math.cos(phi) - (R + h_obs_m / 1000)
    wy = (R + H_m / 1000) * math.sin(phi)
    return math.degrees(math.atan2(wx, wy))


# ---- case 4: flat synthetic DEM -> curved-surface horizon -----------------------------------
@pytest.mark.parametrize("h", [2.0, 10.0, 42.34])
def test_flat_sphere_matches_analytic_dip(h):
    o = obs_at(h)
    p = compute_horizon(o, FlatSphere(o), S)
    assert np.all(p.sector_state == CERTIFIED)
    assert np.allclose(p.horizon_el_deg, expected_flat_dip_deg(R, h), atol=1e-4)


def test_depressed_skyline_is_visible_flat_comparison_is_hidden():  # case 6
    o = obs_at(42.34)
    p = compute_horizon(o, FlatSphere(o), S)
    assert p.lookup(123.4) == pytest.approx(-0.4, abs=1e-3)
    d_terrain = clearance_deg(-0.2, 123.4, p)
    d_flat = clearance_deg(-0.2, 123.4, p, terrain=False)
    assert class_of(float(d_terrain), 0.01) == C.VISIBLE
    assert class_of(float(d_flat), 0.01) == C.HIDDEN


# ---- case 5: single ridge ---------------------------------------------------------------------
def test_ridge_blocks_lower_target_not_higher():
    o = obs_at()
    ridge = Ridge(o, az_deg=90.0, half_width_deg=2.0, dist_km=10.0, length_km=1.0, height_m=200.0)
    p = compute_horizon(o, ridge, S)
    i = round(90.0 / S.az_step_deg)
    expected = block_angle_deg(2.0, 200.0, p.argmax_distance_km[i])
    assert p.horizon_el_deg[i] == pytest.approx(expected, abs=1e-6)
    assert 0.93 < p.horizon_el_deg[i] < 0.99  # approx (H-h)/d - d/(2R)
    assert 10.0 <= p.argmax_distance_km[i] <= 10.11  # obstacle distance is recorded
    assert clearance_deg(0.5, 90.0, p) < 0
    assert clearance_deg(1.5, 90.0, p) > 0
    # away from the ridge the skyline is the smooth-sphere dip
    assert p.lookup(180.0) == pytest.approx(expected_flat_dip_deg(R, 2.0), abs=1e-4)
    assert clearance_deg(0.5, 180.0, p) > 0


def test_crater_rim_is_uniform_around_the_observer():
    o = obs_at()
    p = compute_horizon(o, CraterRim(o, rim_radius_km=5.0, rim_width_km=0.5, rim_m=300.0), S)
    assert np.ptp(p.horizon_el_deg) < 0.08  # sampling-step spread only
    for k in (0, 100, 250):
        expected = block_angle_deg(2.0, 300.0, p.argmax_distance_km[k])
        assert p.horizon_el_deg[k] == pytest.approx(expected, abs=1e-6)


# ---- case 7: obstacles beyond the tile / nodata ------------------------------------------------
def far_ridge(o, **kw):
    return Ridge(o, az_deg=90.0, half_width_deg=2.0, dist_km=40.0, length_km=1.0, height_m=800.0,
                 **kw)


def test_far_obstacle_detected_when_radius_covers_it():
    o = obs_at()
    p = compute_horizon(o, far_ridge(o), dataclasses.replace(S, radius_km=50.0))
    assert p.lookup(90.0) > 0.3
    assert p.argmax_distance_km[90] >= 40.0


def test_uncovered_region_is_unsupported_not_flat_by_default():
    o = obs_at()
    p = compute_horizon(o, far_ridge(o, tile_radius_km=30.0), dataclasses.replace(S, radius_km=50.0))
    assert np.all(p.sector_state == COVERAGE_LIMITED)
    assert np.all(np.isnan(p.lookup(np.arange(0, 360, 7.3))))
    assert np.isnan(clearance_deg(0.5, 90.0, p))  # unknown, never "hidden" or "visible"


def test_justified_missing_region_bound_can_certify_or_not():
    o = obs_at()
    s50 = dataclasses.replace(S, radius_km=50.0)
    low = compute_horizon(o, far_ridge(o, tile_radius_km=30.0, missing_bound_m=0.0), s50)
    assert np.all(low.sector_state == CERTIFIED)  # nothing above 0 m can raise the skyline
    high = compute_horizon(o, far_ridge(o, tile_radius_km=30.0, missing_bound_m=1000.0), s50)
    assert np.all(high.sector_state == COVERAGE_LIMITED)  # a 1 km peak out there could


def test_nodata_hole_over_ridge_makes_only_those_sectors_unknown():
    o = obs_at()
    ridge = Ridge(o, az_deg=90.0, half_width_deg=2.0, dist_km=10.0, length_km=1.0, height_m=200.0,
                  hole=(88.0, 92.0, 9.0, 12.0))
    p = compute_horizon(o, ridge, S)
    assert np.isnan(p.lookup(90.0))
    assert not np.isnan(p.lookup(180.0)) and not np.isnan(p.lookup(10.0))
    limited = np.flatnonzero(p.sector_state == COVERAGE_LIMITED)
    assert limited.min() == 88 and limited.max() == 92


# ---- case 8: narrow ridge between rays ---------------------------------------------------------
def test_narrow_ridge_between_coarse_rays_needs_the_refinement_study():
    o = obs_at()
    ridge = Ridge(o, az_deg=90.25, half_width_deg=0.1, dist_km=10.0, length_km=1.0, height_m=200.0)
    s = dataclasses.replace(S, radius_km=15.0)
    coarse = compute_horizon(o, ridge, s)
    fine = compute_horizon(o, ridge, dataclasses.replace(s, az_step_deg=0.05))
    assert coarse.horizon_el_deg.max() < 0.0  # missed entirely by 1 degree rays
    assert fine.horizon_el_deg.max() > 0.9
    assert compare_profiles(coarse, fine, n=7200) > 0.5  # flagged as unstable


# ---- profile mechanics -------------------------------------------------------------------------
def test_lookup_wraps_around_north():
    s = HorizonSettings(az_step_deg=90.0)
    p = HorizonProfile(np.array([0.0, 90.0, 180.0, 270.0]), np.array([0.0, 10.0, 0.0, -10.0]),
                       np.zeros(4), np.zeros(4, dtype=np.int8), s, "o", {})
    assert p.lookup(315.0) == pytest.approx(-5.0)
    assert p.lookup(45.0) == pytest.approx(5.0)
    assert p.lookup(359.999) == pytest.approx(0.0, abs=1e-3)
    assert p.lookup(-45.0) == pytest.approx(-5.0)


def test_radial_schedule_step_estimate_at_default_settings():
    n = len(radial_schedule(HorizonSettings()))  # 150 km, 20 m pixels
    assert 7000 < n < 8500  # review: on the order of 7,500 steps per ray, not 3,000


def test_cancellation_between_chunks():
    o = obs_at()
    calls = {"n": 0}

    def cancel():
        calls["n"] += 1
        return calls["n"] > 1

    with pytest.raises(Cancelled):
        compute_horizon(o, FlatSphere(o), dataclasses.replace(S, chunk_rows=64), cancel)


def test_cache_key_depends_on_every_identity_field_and_is_deterministic():
    o = obs_at()
    a = compute_horizon(o, FlatSphere(o), S)
    assert a.cache_key() == compute_horizon(o, FlatSphere(o), S).cache_key()
    assert a.cache_key() != compute_horizon(o, FlatSphere(o), dataclasses.replace(S, az_step_deg=2.0)).cache_key()
    o2 = obs_at(10.0)
    assert a.cache_key() != compute_horizon(o2, FlatSphere(o2), S).cache_key()
    assert a.cache_key() != compute_horizon(o, FlatSphere(o, tile_radius_km=100.0), S).cache_key()


def test_azimuth_step_must_divide_360():
    with pytest.raises(ValueError):
        HorizonSettings(az_step_deg=0.7).n_az()

"""The independent (pixel-driven) skyline: right on cases with a known answer, and the comparison with
the production ray skyline can fail (mutations). Nothing here needs the real DEM."""

import math

import numpy as np
import pytest

from lunascope.horizon import HorizonSettings, compute_horizon
from lunascope.independent_horizon import THRESHOLDS, Grid, compare, evaluate, independent_skyline
from lunascope.observer import build_observer
from lunascope.terrain import FlatSphere

G = Grid()
R = G.sphere_m


def _xy(r0, r1, c0, c1):
    x = (-G.half_m + G.pix_m * (np.arange(c0, c1) + 0.5))[None, :]
    y = (G.half_m - G.pix_m * (np.arange(r0, r1) + 0.5))[:, None]
    return x + 0 * y, y + 0 * x


def _reader(height_of_xy):
    return lambda r0, r1, c0, c1: height_of_xy(*_xy(r0, r1, c0, c1)).astype(np.float32)


def test_flat_sphere_gives_the_analytic_horizon_dip_in_every_direction():
    h = 2.0
    sky = independent_skyline(_reader(lambda x, y: 0 * x), lat_deg=-89.5, lon_east_deg=0.0, ground_m=0.0,
                              mast_m=h, radius_km=30.0, n_az=360)["skyline_el_deg"]
    dip = -math.degrees(math.sqrt(2 * h / R))  # the textbook dip of the horizon for eye height h
    assert np.isfinite(sky).all()
    assert np.allclose(sky, dip, atol=0.003)


def test_a_wall_at_a_known_azimuth_appears_there_and_not_mirrored():
    # observer at (-89.5, 0); a 400 m high block of terrain 5 km due EAST (azimuth 90) of the observer.
    lat, lon = math.radians(-89.5), 0.0
    d_km, bearing = 5.0, math.radians(90.0)
    # point 5 km away on the sphere at bearing 90: use the destination-point formula
    dd = d_km * 1000 / R
    lat2 = math.asin(math.sin(lat) * math.cos(dd) + math.cos(lat) * math.sin(dd) * math.cos(bearing))
    lon2 = lon + math.atan2(math.sin(bearing) * math.sin(dd) * math.cos(lat),
                            math.cos(dd) - math.sin(lat) * math.sin(lat2))
    rho2 = 2 * R * math.tan((lat2 + math.pi / 2) / 2)
    bx, by = rho2 * math.sin(lon2), rho2 * math.cos(lon2)
    height = lambda x, y: np.where(np.hypot(x - bx, y - by) < 300.0, 400.0, 0.0)
    r = independent_skyline(_reader(height), lat_deg=-89.5, lon_east_deg=0.0, ground_m=0.0, mast_m=2.0,
                            radius_km=20.0, n_az=360)
    sky = r["skyline_el_deg"]
    peak = int(np.nanargmax(sky))
    assert abs(peak - 90) <= 4 and abs(peak - 270) > 100  # east, not west
    expected = math.degrees(math.atan2((R + 400) * math.cos(dd) - (R + 2), (R + 400) * math.sin(dd)))
    assert sky[peak] == pytest.approx(expected, abs=0.35)  # block is 300 m wide: nearest pixels are a bit closer
    assert sky[peak] > 3.0 and sky[(peak + 180) % 360] < 0.0


def _rolling(x, y):
    return 30.0 * np.sin(x / 2500.0) * np.cos(y / 3100.0) + 15.0 * np.sin((x + y) / 1700.0)


_rho = 2 * R * math.tan((math.radians(-89.5) + math.pi / 2) / 2)
GROUND = float(_rolling(np.array(0.0), np.array(_rho)))  # terrain height under the observer at (-89.5, 0)


def _ray_vs_independent(terrain_builder, n_az=360, ground=0.0):
    obs = build_observer(site_id="t", lat_deg=-89.5, lon_deg=0.0, convention="planetocentric",
                         lon_direction="east_positive", reference_radius_km=1737.4, ground_height_m=ground,
                         ground_height_source="test", observer_height_above_ground_m=2.0)
    return obs


def test_the_two_methods_agree_on_a_gently_rolling_surface_and_the_check_notices_a_rotation():
    # smooth rolling terrain (relief a few tens of metres): both methods must agree closely
    height = _rolling
    obs = _ray_vs_independent(None, ground=GROUND)

    class Rolling:
        identity = None  # not used by the horizon engine
        missing_bound_m = None

        def elevation_m(self, q):
            from lunascope.dem import stereographic_xy
            x, y = stereographic_xy(q)
            return height(x, y)

    ray = compute_horizon(obs, Rolling(), HorizonSettings(radius_km=20.0, az_step_deg=1.0))
    ind = independent_skyline(_reader(height), lat_deg=-89.5, lon_east_deg=0.0, ground_m=GROUND, mast_m=2.0,
                              radius_km=20.0, n_az=360)
    kw = {"ind_inclusive_el_deg": ind["inclusive_el_deg"], "ray_argmax_km": ray.argmax_distance_km,
          "ind_argmax_km": ind["nearest_argmax_km"]}
    m = compare(ray.horizon_el_deg, ind["skyline_el_deg"], **kw)
    assert m["ray_above_inclusive_deg"] < 0.01 and m["best_shift_sectors"] == 0
    assert evaluate(m)["met"], m
    # a check must be able to fail: rotate / mirror the independent skyline and the verdict flips
    rot = compare(ray.horizon_el_deg, np.roll(ind["skyline_el_deg"], 7), **kw)
    assert not evaluate(rot)["met"]
    mir = compare(ray.horizon_el_deg, ind["skyline_el_deg"][::-1], **kw)
    assert not evaluate(mir)["met"]
    lowered = {"ind_inclusive_el_deg": ind["inclusive_el_deg"] - 0.3, "ray_argmax_km": ray.argmax_distance_km,
          "ind_argmax_km": ind["nearest_argmax_km"]}
    lifted = compare(ray.horizon_el_deg, ind["skyline_el_deg"] - 0.3, **lowered)  # independent LOWER than the rays
    assert not evaluate(lifted)["met"]


def test_evaluate_requires_every_sector_to_be_compared_and_uses_declared_thresholds():
    base = {"sectors_compared": 10, "sectors_total": 10, "near_field_sectors": 0, "near_field_fraction": 0.0,
            "ray_above_inclusive_deg": 0.0, "within_tolerance_fraction": 1.0, "max_tolerance_ratio": 0.0,
            "best_shift_sectors": 0}
    assert evaluate(base)["met"]
    assert not evaluate({**base, "sectors_compared": 9})["met"]  # one sector silently skipped
    for k, (op, v) in THRESHOLDS.items():
        assert not evaluate({**base, k: v + 1 if op == "max" else v - 0.5})["met"], k


def test_flat_sphere_matches_the_production_horizon():
    obs = _ray_vs_independent(None)
    ray = compute_horizon(obs, FlatSphere(obs), HorizonSettings(radius_km=30.0, az_step_deg=1.0))
    ind = independent_skyline(_reader(lambda x, y: 0 * x), lat_deg=-89.5, lon_east_deg=0.0, ground_m=0.0,
                              mast_m=2.0, radius_km=30.0, n_az=360)
    m = compare(ray.horizon_el_deg, ind["skyline_el_deg"], ind_inclusive_el_deg=ind["inclusive_el_deg"],
                ray_argmax_km=ray.argmax_distance_km, ind_argmax_km=ind["nearest_argmax_km"])
    assert m["max_abs_deg"] < 0.01


def _wall_on_the_axis(x, y):
    # one pixel column (centre x = +10 m) tall at y in [-6 km, -5 km]: a ray due south along the x = 0 axis
    # runs exactly half a pixel from it
    return np.where((np.abs(x - 10.0) < 1.0) & (y > -6000.0) & (y < -5000.0), 300.0, 0.0)


def test_a_ray_exactly_between_two_pixel_columns_still_sees_a_one_pixel_wall():
    import lunascope.independent_horizon as ih
    kw = {"lat_deg": -89.5, "lon_east_deg": 0.0, "ground_m": 0.0, "mast_m": 2.0, "radius_km": 30.0, "n_az": 360}
    sky = independent_skyline(_reader(_wall_on_the_axis), **kw)
    assert sky["skyline_el_deg"][180] > 0.4  # the wall (about 300 m at ~14 km, less curvature) is seen from due south
    # a check must be able to fail: without the tie rule the result is decided by rounding and the wall is missed
    old = ih.TIE_M
    ih.TIE_M = 0.0
    try:
        assert independent_skyline(_reader(_wall_on_the_axis), **kw)["skyline_el_deg"][180] < 0.0
    finally:
        ih.TIE_M = old

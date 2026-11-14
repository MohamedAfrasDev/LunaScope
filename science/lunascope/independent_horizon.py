"""A second, independent skyline (phase plan 2.x, validation card "independent_terrain_check").

The production skyline (horizon.py) is RAY-DRIVEN: for each azimuth it walks a great-circle ray outward,
bilinearly interpolates the DEM at each step and takes the largest 3-D elevation angle. This module
computes the same quantity the other way round, PIXEL-DRIVEN:

    for every DEM pixel inside the radius, work out where it is as seen from the observer
    (distance, bearing, elevation angle) with closed-form spherical formulas, then give each
    azimuth sector the largest elevation among the pixels that its ray passes through.

What is independent: the traversal (all pixels, not a sampled ray), the sampling (raw pixel values, no
interpolation), the geometry (inverse stereographic projection, haversine distance, spherical
bearing, a 2-D elevation formula in the observer-centre-point plane, instead of 3-D vectors and the
local east/north/up basis) and the code (nothing is imported from horizon.py, terrain.py,
observer.py or dem.py's sampling). What is NOT independent, and is said so on the card: the DEM
bytes themselves, and the stated georeference of the grid (30,400 px of 20 m, true scale at the
pole, 1,737.4 km sphere), which a GeoTIFF reader confirms for the adjusted product. So this check
tests the skyline computation, never the DEM.

Two supports are computed in one pass. The NEAREST-pixel skyline counts a pixel for sector k if the ray
at azimuth k * step passes within half a pixel (10 m) of its centre; the NEIGHBOUR-INCLUSIVE skyline within
one pixel diagonal (28 m), which covers every pixel a bilinear sample on that ray can draw on. A bilinear value
never exceeds its four neighbours, so the ray skyline must not be higher than the inclusive one (a
parameter-free gate), and it should agree with the nearest-pixel one within a physical tolerance (see
THRESHOLDS for how the gates were set and what an earlier, stricter attempt showed).
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

INDEPENDENT_ALGORITHM = "independent-pixel-skyline-0.1.0"


@dataclass(frozen=True)
class Grid:
    """The LOLA south-polar 20 m grid: pixel-is-area, x east, y up, true scale at the pole."""

    n: int = 30400
    pix_m: float = 20.0
    sphere_m: float = 1_737_400.0

    @property
    def half_m(self) -> float:
        return self.n * self.pix_m / 2


# Agreement gates. Version 1 (declared before the first comparison on real data) compared the NEIGHBOUR-
# INCLUSIVE skyline two-sidedly: median 0.02 deg, p99 0.10 deg, max 0.50 deg. On GR-001 rule-89.5S-E240 it
# FAILED (median 0.058, p99 0.70, max 0.77 deg, ray never above the independent skyline) because that support
# (every pixel within a full pixel diagonal of the ray) is more generous than a bilinear sample and so
# over-states steep near slopes by up to a pixel of relief. That result is kept in the evidence. Version 2,
# declared after reading it and justified from first principles rather than fitted:
#   * one-sided gate unchanged: the ray skyline must never be higher than the neighbour-inclusive skyline,
#     because a bilinear sample can never exceed its four neighbours (parameter-free);
#   * two-sided gate against the NEAREST-pixel skyline (pixels whose centre is within half a pixel of the
#     ray), with a PHYSICAL per-sector tolerance: nearest-pixel and bilinear sampling can differ by at most
#     half a pixel of horizontal offset times the terrain slope, i.e. an elevation of
#     atan(half_pixel * tan(SLOPE_DEG) / distance), taking 45 degrees as the steepest slope a sector's
#     skyline pixel is assumed to have. At 1.7 km that is 0.34 deg, at 20 km 0.03 deg, at 100 km 0.006 deg.
# Each entry is (comparison, value); "max" means metric <= value, "min" means metric >= value.
SLOPE_DEG = 45.0
THRESHOLDS = {
    "ray_above_inclusive_deg": ("max", 0.01),     # the ray may not see HIGHER than its pixel neighbourhood
    "within_tolerance_fraction": ("min", 0.99),   # sectors whose difference is inside the physical tolerance
    "max_tolerance_ratio": ("max", 2.0),          # no sector is worse than twice its tolerance
    "best_shift_sectors": ("max", 0),             # no azimuth offset or mirror: best alignment is zero shift
    "near_field_fraction": ("max", 0.05),         # at most 5% of sectors set closer than NEAR_FIELD_KM
}
# The distance used for the tolerance is the NEARER of the ray's and the independent skyline's feature
# (first draft of this gate used the ray's alone, which wrongly gave a 5 km tolerance to a 0.4 km pixel).
# Terrain closer than this is not resolved by either method (one 20 m pixel is already 11 degrees of
# elevation at 100 m for 20 m of relief), so the two methods sample different points of the same pixel and
# legitimately differ. Sectors whose skyline is set that close are counted and reported, not compared.
NEAR_FIELD_KM = 0.1
# A ray running exactly along a grid axis (the meridians through the pole) lies exactly half a pixel from two
# columns of pixel centres. "Within half a pixel" is a closed interval, so ties are included; without this
# 5 cm the outcome would be decided by floating-point rounding (found on GR-001 rule-89.5S-E0, azimuth 180).
TIE_M = 0.05
FIRST_ATTEMPT_V1 = {
    "site_id": "rule-89.5S-E240", "result": "NOT MET (run on this one site, then stopped)",
    "thresholds": {"median_abs_deg": 0.02, "p99_abs_deg": 0.10, "max_abs_deg": 0.50},
    "measured": {"median_abs_deg": 0.0583, "p99_abs_deg": 0.6977, "max_abs_deg": 0.772,
                 "ray_above_ind_deg": 0.0002, "best_shift_sectors": 0},
    "reading": ("The ray skyline was never above the independent one and there was no azimuth shift. The excess "
                "was one-sided, concentrated inside 20 km and growing with slope: the definition (every pixel within "
                "a full diagonal of the ray) over-includes steep neighbours. The design was revised, not the data."),
}


def _xy_to_polar_geometry(x: np.ndarray, y: np.ndarray, grid: Grid):
    """Inverse south-polar stereographic: planetocentric latitude and east longitude (radians)."""
    rho = np.hypot(x, y)
    colat = 2.0 * np.arctan(rho / (2.0 * grid.sphere_m))  # angle from the south pole
    lat = -math.pi / 2 + colat
    lon = np.arctan2(x, y)  # x = rho sin(lon), y = rho cos(lon)
    return lat, lon


def _argmax_update(best: np.ndarray, dist: np.ndarray, ks: np.ndarray, el: np.ndarray, d_km: np.ndarray) -> None:
    """Per-sector running maximum that also remembers the distance of the pixel that set it."""
    order = np.lexsort((el, ks))  # by sector, then by elevation; the last of each sector is its maximum
    ks_s = ks[order]
    last = np.r_[ks_s[1:] != ks_s[:-1], True]
    sel = order[last]
    k, e, dd = ks[sel], el[sel], d_km[sel]
    better = e > best[k]
    best[k[better]] = e[better]
    dist[k[better]] = dd[better]


def independent_skyline(read_window: Callable[[int, int, int, int], np.ndarray], *, lat_deg: float,
                        lon_east_deg: float, ground_m: float, mast_m: float, radius_km: float,
                        n_az: int, grid: Grid = Grid(), chunk_rows: int = 256,
                        envelope: bool = False) -> dict:
    """Skyline elevation (degrees) at azimuth k * 360 / n_az, k = 0..n_az-1 (NaN: no pixel qualifies).

    read_window(r0, r1, c0, c1) returns the DEM heights (metres above the sphere) of that pixel window.
    With envelope=True also returns the larger "any pixel in the sector" skyline as a diagnostic: how much
    relief lies BETWEEN rays (this is what a ray skyline can under-estimate; it does not gate the card).
    """
    R = grid.sphere_m
    phi1, lam1 = math.radians(lat_deg), math.radians(lon_east_deg)
    r_obs = R + ground_m + mast_m
    step = 360.0 / n_az
    # observer position on the map, only to choose which pixel rows and columns to read
    rho_o = 2.0 * R * math.tan((phi1 + math.pi / 2) / 2.0)
    xo, yo = rho_o * math.sin(lam1), rho_o * math.cos(lam1)
    reach = radius_km * 1000.0 * 1.02 + 2 * grid.pix_m  # stereographic scale is <= 1.0076 in the tile
    c_lo = max(0, math.floor((xo - reach + grid.half_m) / grid.pix_m) - 1)
    c_hi = min(grid.n, math.ceil((xo + reach + grid.half_m) / grid.pix_m) + 2)
    r_lo = max(0, math.floor((grid.half_m - (yo + reach)) / grid.pix_m) - 1)
    r_hi = min(grid.n, math.ceil((grid.half_m - (yo - reach)) / grid.pix_m) + 2)
    cols = np.arange(c_lo, c_hi)
    x = (-grid.half_m + grid.pix_m * (cols + 0.5))[None, :]

    best = np.full(n_az, -np.inf)  # neighbour-inclusive support (one pixel diagonal)
    best_nn = np.full(n_az, -np.inf)  # nearest-pixel support (half a pixel)
    dist_nn = np.full(n_az, np.nan)  # distance (km) of the pixel that sets best_nn
    env = np.full(n_az, -np.inf) if envelope else None
    seen = 0
    for r0 in range(r_lo, r_hi, chunk_rows):
        r1 = min(r0 + chunk_rows, r_hi)
        z = read_window(r0, r1, c_lo, c_hi).astype(np.float64)
        y = (grid.half_m - grid.pix_m * (np.arange(r0, r1) + 0.5))[:, None]
        lat, lon = _xy_to_polar_geometry(x + 0.0 * y, y + 0.0 * x, grid)
        dlam = lon - lam1
        # haversine central angle and initial bearing (east of north), both on the sphere
        a = np.sin((lat - phi1) / 2) ** 2 + math.cos(phi1) * np.cos(lat) * np.sin(dlam / 2) ** 2
        delta = 2.0 * np.arcsin(np.sqrt(np.clip(a, 0.0, 1.0)))
        keep = (delta * R <= radius_km * 1000.0) & (delta > 0) & np.isfinite(z)
        if not keep.any():
            continue
        d = delta[keep]
        zz = z[keep]
        bearing = np.degrees(np.arctan2(np.sin(dlam) * np.cos(lat),
                                        math.cos(phi1) * np.sin(lat) - math.sin(phi1) * np.cos(lat) * np.cos(dlam))[keep]) % 360.0
        rp = R + zz
        # observer O = (0, r_obs) and pixel P = (rp sin d, rp cos d) in the plane through the body centre;
        # elevation is the angle of OP above the horizontal x-axis. rp cos d - r_obs is written without
        # cancellation as (rp - r_obs) - 2 rp sin^2(d/2).
        el = np.degrees(np.arctan2((rp - r_obs) - 2.0 * rp * np.sin(d / 2) ** 2, rp * np.sin(d)))
        seen += int(d.size)
        dist_m = d * R
        for width_m, acc in ((grid.pix_m * math.sqrt(2), best), (grid.pix_m / 2 + TIE_M, best_nn)):
            hw = np.degrees(np.arcsin(np.minimum(1.0, width_m / dist_m)))
            k_lo = np.ceil((bearing - hw) / step).astype(np.int64)
            k_hi = np.floor((bearing + hw) / step).astype(np.int64)
            count = np.maximum(k_hi - k_lo + 1, 0)
            if count.sum():
                idx = np.repeat(np.arange(d.size), count)
                start = np.cumsum(count) - count
                offs = np.arange(count.sum()) - np.repeat(start, count)
                ks = (k_lo[idx] + offs) % n_az
                if acc is best_nn:
                    _argmax_update(best_nn, dist_nn, ks, el[idx], dist_m[idx] / 1000.0)
                else:
                    np.maximum.at(acc, ks, el[idx])
        if env is not None:
            np.maximum.at(env, np.rint(bearing / step).astype(np.int64) % n_az, el)
    res = {"azimuth_deg": np.arange(n_az) * step, "skyline_el_deg": np.where(np.isinf(best_nn), np.nan, best_nn),
           "inclusive_el_deg": np.where(np.isinf(best), np.nan, best), "nearest_argmax_km": dist_nn,
           "pixels_used": seen,
           "algorithm": INDEPENDENT_ALGORITHM}
    if env is not None:
        res["envelope_el_deg"] = np.where(np.isinf(env), np.nan, env)
    return res


def tolerance_deg(ray_argmax_km: np.ndarray, grid: Grid = Grid()) -> np.ndarray:
    """Physical per-sector tolerance between nearest-pixel and bilinear sampling: half a pixel of horizontal
    offset times the steepest assumed slope, seen from the distance at which the ray skyline is set."""
    d_m = np.maximum(np.asarray(ray_argmax_km, float) * 1000.0, grid.pix_m)
    return np.degrees(np.arctan((grid.pix_m / 2) * math.tan(math.radians(SLOPE_DEG)) / d_m))


def compare(ray_el_deg: np.ndarray, ind_el_deg: np.ndarray, *, ind_inclusive_el_deg: np.ndarray,
            ray_argmax_km: np.ndarray, ind_argmax_km: np.ndarray, envelope_el_deg: np.ndarray | None = None) -> dict:
    """How the independent skyline differs from the production (ray) skyline, sector by sector.

    ind_el_deg is the nearest-pixel skyline (two-sided comparison); ind_inclusive_el_deg the
    neighbour-inclusive one (the ray may not exceed it).
    """
    ray, ind, incl = (np.asarray(v, float) for v in (ray_el_deg, ind_el_deg, ind_inclusive_el_deg))
    argmax = np.asarray(ray_argmax_km, float)
    # the two methods may be looking at different features of one sector; the sampling difference that
    # matters is the one at the NEARER of the two (a pixel's relief subtends more angle the closer it is)
    nearer = np.fmin(argmax, np.asarray(ind_argmax_km, float))
    finite = np.isfinite(ray) & np.isfinite(ind) & np.isfinite(incl)
    near = argmax < NEAR_FIELD_KM
    n_near = int((finite & near).sum())
    ok = finite & ~near
    if not ok.any():
        raise ValueError("no sector has both skylines")
    diff = ind[ok] - ray[ok]
    a = np.abs(diff)
    tol = tolerance_deg(nearer)[ok]
    ratio = a / tol
    shifts = {}
    for s in range(-8, 9):
        r = np.roll(ind, s)
        m = ok & np.isfinite(r)
        shifts[s] = float(np.mean(np.abs(r[m] - ray[m])))
    best_shift = min(shifts, key=lambda s: (shifts[s], abs(s)))
    worst = int(np.flatnonzero(ok)[int(np.argmax(ratio))])
    out = {"sectors_compared": int(ok.sum()), "sectors_total": int(ray.size), "near_field_sectors": n_near,
           "near_field_fraction": n_near / ray.size, "sectors_both_finite": int(finite.sum()),
           "median_abs_deg": float(np.median(a)), "p99_abs_deg": float(np.percentile(a, 99)),
           "max_abs_deg": float(a.max()), "mean_ind_minus_ray_deg": float(diff.mean()),
           "within_tolerance_fraction": float(np.mean(a <= tol)), "max_tolerance_ratio": float(ratio.max()),
           "worst_sector_index": worst,
           "ray_above_inclusive_deg": float(max(0.0, (ray[ok] - incl[ok]).max())),
           "best_shift_sectors": abs(int(best_shift))}
    if envelope_el_deg is not None:
        e = np.asarray(envelope_el_deg, float)
        m = ok & np.isfinite(e)
        out["between_ray_relief_max_deg"] = float((e[m] - ray[m]).max())
        out["between_ray_relief_p99_deg"] = float(np.percentile(e[m] - ray[m], 99))
    return out


def evaluate(metrics: dict, thresholds: dict | None = None) -> dict:
    """Verdict per check, re-derived from the metrics and the declared thresholds in THIS file."""
    t = THRESHOLDS if thresholds is None else thresholds
    checks = {k: bool(metrics[k] <= v if op == "max" else metrics[k] >= v) for k, (op, v) in t.items()}
    # every sector is either compared or counted as near-field; a sector silently skipped fails the check
    checks["every_sector_accounted_for"] = (
        metrics["sectors_compared"] + metrics["near_field_sectors"] == metrics["sectors_total"])
    return {"checks": checks, "met": all(checks.values())}

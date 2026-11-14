"""Comparison of LunaScope's long-term illumination and Earth visibility with NASA's published maps.

Reference (not produced by this project): the LOLA-derived average illumination maps of the Lunar
Polar Illumination product (NASA GSFC PGDA; Mazarico et al. 2011, Icarus 211, 1066-1081,
doi:10.1016/j.icarus.2010.10.030): `AVGVISIB_85S_060M_201608` (percentage of time the Sun is visible,
treated as a finite disc) and `AVGVISIB_85S_060M_201608_EARTH` (the same for Earth), hourly over a lunar
nutation cycle (about 18.6 years), 60 m per pixel, 85S to the pole. The Earth map counts Earth as visible
if any part of its disc is unobscured, so the gate uses the upper limb for both bodies.

What this compares: our skyline (from the pinned 20 m LOLA DEM, ground-level observer because the map
states no height) combined with hourly SPICE directions over the same 18.6-year length, against the map
value at the site. It tests whether our whole chain (terrain, skyline, geometry, time integration) gives
the long-term numbers an independent NASA product gives. It does NOT test our one-week reference window
directly: the map is a long-term average.

THE GATES BELOW WERE WRITTEN BEFORE THE COMPARISON WAS RUN and are not changed afterwards. Whatever the
result, it is recorded. They are deliberately about agreement, not equality: the map is built from a
different DEM product and resolution (60 m), a different epoch and an unstated observer height.

Set A, the three GR-001 sites (-89.5 deg, 0 / 120 / 240 E):
  A1  for Sun and for Earth, our fraction lies within the map's range over the 3 x 3 pixels around the site,
      widened by A_SLACK_PP percentage points either way.
  A2  the order of the three sites by Sun fraction and by Earth fraction is the same as the map's
      (sites whose fractions differ by less than A_TIE_PP in the map count as tied).
Set B, the ten rule-chosen sites of the DEM-release study (SDR-001), the map value taken at the site's pixel:
  B1  Pearson correlation of our fractions with the map's is at least B_MIN_R, for Sun and for Earth.
  B2  mean absolute difference is at most B_MAX_MAE_PP percentage points, for Sun and for Earth.
"""

from __future__ import annotations

import math

import numpy as np

A_SLACK_PP = 2.0
A_TIE_PP = 1.0
B_MIN_R = 0.90
B_MAX_MAE_PP = 5.0

SPHERE_M = 1_737_400.0
SUN_RADIUS_KM = 695_700.0
EARTH_RADIUS_KM = 6_378.137
HOURS_18_6_YEARS = round(18.6 * 365.25 * 24)  # 163,000 hourly samples
SITES_B = [(-89.5, 0.0), (-89.5, 120.0), (-89.5, 240.0), (-89.0, 45.0), (-89.0, 200.0),
           (-88.0, 90.0), (-88.0, 300.0), (-87.0, 10.0), (-87.0, 170.0), (-86.0, 250.0)]


def stereographic_xy(lat_deg: float, lon_east_deg: float) -> tuple[float, float]:
    """South-polar stereographic, true scale at the pole, on the 1,737.4 km sphere (the map's projection)."""
    rho = 2 * SPHERE_M * math.tan((math.radians(lat_deg) + math.pi / 2) / 2)
    return rho * math.sin(math.radians(lon_east_deg)), rho * math.cos(math.radians(lon_east_deg))


def map_values(ds, lat_deg: float, lon_east_deg: float) -> dict:
    """Published fraction (0 to 1) at the site's pixel and the min / max / mean over the 3 x 3 pixels around it."""
    x, y = stereographic_xy(lat_deg, lon_east_deg)
    r, c = ds.index(x, y)
    a = ds.read(1, window=((r - 1, r + 2), (c - 1, c + 2))).astype(float)
    scale = ds.scales[0]
    a = np.where(a == ds.nodata, np.nan, a * scale)
    if np.isnan(a).any():
        raise ValueError("no-data pixel next to the site")
    return {"pixel": float(a[1, 1]), "min3x3": float(a.min()), "max3x3": float(a.max()), "mean3x3": float(a.mean())}


def fractions(az_deg: np.ndarray, el_deg: np.ndarray, radius_deg: np.ndarray, skyline_at) -> dict:
    """Fraction of samples with the centre, the upper limb ("any part") and the whole disc above the skyline."""
    h = skyline_at(az_deg)
    ok = np.isfinite(h)
    return {"centre": float(np.mean((el_deg > h)[ok])), "upper_limb": float(np.mean((el_deg + radius_deg > h)[ok])),
            "whole_disc": float(np.mean((el_deg - radius_deg > h)[ok])), "samples": int(ok.sum())}


def _ordering(vals: list[float], tie: float) -> list[tuple[int, int]]:
    """Pairs (i, j) with i clearly above j (more than tie apart)."""
    return [(i, j) for i in range(len(vals)) for j in range(len(vals)) if vals[i] - vals[j] > tie]


def evaluate_set_a(rows: list[dict]) -> dict:
    """rows: per site {"sun": {"ours", "map"}, "earth": {...}} with map = map_values dict, fractions in 0..1."""
    checks, detail = {}, {}
    for body in ("sun", "earth"):
        within = []
        for r in rows:
            m, o = r[body]["map"], r[body]["ours"]
            lo, hi = m["min3x3"] - A_SLACK_PP / 100, m["max3x3"] + A_SLACK_PP / 100
            within.append(bool(lo <= o <= hi))
        checks[f"A1_{body}_within_map_range"] = all(within)
        detail[f"A1_{body}"] = within
        ours = [r[body]["ours"] for r in rows]
        theirs = [r[body]["map"]["pixel"] for r in rows]
        same = set(_ordering(ours, A_TIE_PP / 100)) == set(_ordering(theirs, A_TIE_PP / 100))
        checks[f"A2_{body}_same_site_order"] = bool(same)
    return {"checks": checks, "met": all(checks.values()), "detail": detail}


def evaluate_set_b(rows: list[dict]) -> dict:
    checks, stats = {}, {}
    for body in ("sun", "earth"):
        ours = np.array([r[body]["ours"] for r in rows])
        theirs = np.array([r[body]["map"]["pixel"] for r in rows])
        r_ = float(np.corrcoef(ours, theirs)[0, 1]) if ours.std() > 0 and theirs.std() > 0 else float("nan")
        mae = float(np.mean(np.abs(ours - theirs)) * 100)
        stats[body] = {"pearson_r": r_, "mae_pp": mae, "n": len(rows)}
        checks[f"B1_{body}_correlation"] = bool(r_ >= B_MIN_R)
        checks[f"B2_{body}_mae"] = bool(mae <= B_MAX_MAE_PP)
    return {"checks": checks, "met": all(checks.values()), "stats": stats}

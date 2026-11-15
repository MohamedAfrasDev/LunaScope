"""A patch of real terrain around a site, for drawing (redesign: Site sky).

This is data for a picture, not a result: it never decides whether anything is visible. The heights are the same DEM samples the
horizon engine reads, sampled on a regular grid in the site's own local frame (east and north from the site, on the sphere), so the
web app can build the ground you would stand on. Nothing outside the DEM tile, and nothing next to a missing value, is guessed:
such cells are NODATA.

Grid: `size` x `size` cells, `step_m` apart, centred on the site. Row 0 is the northernmost row, column 0 the westernmost.
Heights are relative to the site's own ground height, in units of `UNIT_M` metres, as little-endian signed 16-bit integers.
The curvature of the Moon is NOT removed: a height is the DEM height, so a flat plain far from the site still reads as lower in a
flat picture; the picture adds the drop d^2 / 2R itself.
"""

from __future__ import annotations

import base64
import math

import numpy as np

from .errors import INVALID_INPUT, LunaScopeError
from .observer import enu_basis

SCHEMA = "lunascope-terrain-patch/1"
UNIT_M = 0.5  # one integer step is half a metre: +-16 km of relief fits
NODATA = -32768
MAX_SIZE = 601
MIN_STEP_M = 50.0
MAX_STEP_M = 400.0
MAX_RADIUS_KM = 40.0
REFERENCE_RADIUS_M = 1_737_400.0


def grid_size(radius_km: float, step_m: float) -> int:
    """An odd number of cells, so the site is the middle cell."""
    n = int(round(2.0 * radius_km * 1000.0 / step_m)) + 1
    return n if n % 2 == 1 else n + 1


def validate(lat_deg: float, lon_east_deg: float, radius_km: float, step_m: float) -> None:
    if not (-90.0 <= lat_deg <= -80.0):
        raise LunaScopeError(INVALID_INPUT, "latitude must be from -90 to -80 (the terrain data covers 80 S to the pole)", field="lat_deg")
    if not math.isfinite(lon_east_deg) or not (0.0 <= lon_east_deg < 360.0):
        raise LunaScopeError(INVALID_INPUT, "east longitude must be from 0 up to 360", field="lon_east_deg")
    if not (1.0 <= radius_km <= MAX_RADIUS_KM):
        raise LunaScopeError(INVALID_INPUT, f"radius must be from 1 to {MAX_RADIUS_KM:g} km", field="radius_km")
    if not (MIN_STEP_M <= step_m <= MAX_STEP_M):
        raise LunaScopeError(INVALID_INPUT, f"step must be from {MIN_STEP_M:g} to {MAX_STEP_M:g} m", field="step_m")
    if grid_size(radius_km, step_m) > MAX_SIZE:
        raise LunaScopeError(INVALID_INPUT, f"that is more than {MAX_SIZE} cells a side: use a larger step or a smaller radius", field="step_m")


def sample_patch(terrain, lat_deg: float, lon_east_deg: float, radius_km: float, step_m: float) -> dict:
    """Sample `terrain` (anything with `elevation_m(q_hat)` taking unit vectors in the body frame) on the local grid."""
    validate(lat_deg, lon_east_deg, radius_km, step_m)
    n = grid_size(radius_km, step_m)
    half = (n - 1) / 2.0
    east_m = (np.arange(n) - half) * step_m  # west to east
    north_m = (half - np.arange(n)) * step_m  # north to south: row 0 is north
    X, Y = np.meshgrid(east_m, north_m)  # X[row, col] east, Y[row, col] north
    d = np.hypot(X, Y)
    safe = np.where(d > 0, d, 1.0)
    e, nn, u = enu_basis(lat_deg, lon_east_deg)
    ang = d / REFERENCE_RADIUS_M
    t = (X / safe)[..., None] * e + (Y / safe)[..., None] * nn  # unit direction along the surface
    q = np.cos(ang)[..., None] * u + np.sin(ang)[..., None] * t
    z = np.asarray(terrain.elevation_m(q.reshape(-1, 3)), dtype=np.float64).reshape(n, n)
    centre = float(z[n // 2, n // 2])
    if not math.isfinite(centre):
        raise LunaScopeError("DEM_COVERAGE_INCOMPLETE", f"no DEM height at ({lat_deg}, {lon_east_deg})")
    rel = (z - centre) / UNIT_M
    finite = np.isfinite(rel) & (np.abs(rel) <= 32767)
    packed = np.where(finite, np.rint(np.clip(rel, -32767, 32767)), NODATA).astype("<i2")
    return {
        "schema": SCHEMA,
        "lat_deg": lat_deg,
        "lon_east_deg": lon_east_deg,
        "radius_km": radius_km,
        "step_m": step_m,
        "size": n,
        "rows_from": "north",
        "cols_from": "west",
        "unit_m": UNIT_M,
        "nodata": NODATA,
        "ground_height_m": centre,
        "reference_radius_m": REFERENCE_RADIUS_M,
        "covered_fraction": float(finite.mean()),
        "heights_b64": base64.b64encode(packed.tobytes()).decode("ascii"),
    }

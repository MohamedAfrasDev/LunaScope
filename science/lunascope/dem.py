"""Real-DEM TerrainProvider for the LOLA south-polar 20 m products (SDR-001 D-01).

Both products share one grid: 30,400 x 30,400 pixels of 20 m, polar stereographic centred on
the south pole (true scale at the pole) on a 1,737.4 km sphere, pixel-is-area, x east (+), y up (+),
heights in metres relative to that sphere. This provider takes unit vectors in the body-fixed
MOON_ME frame, so nothing here knows about sites or azimuths.

Projection (south pole, k0 = 1, sphere radius R):
    rho = 2 R sqrt((1 + z) / (1 - z))       x = rho * qy / h       y = rho * qx / h,   h = hypot(qx, qy)
(equivalently x = rho sin(lon), y = rho cos(lon)); rho = 304 km at 80 deg S, the tile edge.

Nothing outside the tile, outside the loaded window, or next to a NaN is guessed: such samples
are NaN, which the horizon engine reports as coverage-limited (never as flat ground).
Neither product has a no-data cell inside the tile; sparsely measured terrain is therefore NOT
flagged here (SDR-001 D-01b).
"""

from __future__ import annotations

import hashlib
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .errors import RESOURCE_INTEGRITY_FAILED, LunaScopeError
from .observer import CanonicalObserver

REPO = Path(__file__).resolve().parents[2]
MANIFESTS = REPO / "data" / "manifests"
RAW = REPO / "data" / "raw"

N = 30400
PIX = 20.0
HALF = N * PIX / 2  # 304,000 m
SPHERE_M = 1_737_400.0
SCALE_MARGIN = 1.02  # stereographic scale is <= 1.0076 inside the tile; 2% margin on windows


def stereographic_xy(q_hat: np.ndarray, radius_m: float = SPHERE_M) -> tuple[np.ndarray, np.ndarray]:
    """South-polar stereographic (true scale at the pole) of unit vectors (..., 3)."""
    qx, qy, qz = q_hat[..., 0], q_hat[..., 1], q_hat[..., 2]
    rho = 2.0 * radius_m * np.sqrt(np.clip((1.0 + qz) / np.maximum(1.0 - qz, 1e-300), 0.0, None))
    h = np.hypot(qx, qy)
    safe = np.where(h > 0, h, 1.0)
    return rho * qy / safe, rho * qx / safe


def lonlat_to_unit(lat_deg: float, lon_east_deg: float) -> np.ndarray:
    la, lo = math.radians(lat_deg), math.radians(lon_east_deg)
    return np.array([math.cos(la) * math.cos(lo), math.cos(la) * math.sin(lo), math.sin(la)])


# ----------------------------------------------------------------------------- sources
class GeoTiffSource:
    """PGDA adjusted product (float32 GeoTIFF, NaN nodata)."""

    kind = "geotiff"

    def __init__(self, path: Path):
        import rasterio
        self.path = Path(path)
        self._ds = rasterio.open(self.path)
        if (self._ds.width, self._ds.height) != (N, N):
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED, f"{path} is not the expected 30400 grid")
        t = self._ds.transform
        if (t.a, t.e, t.c, t.f) != (PIX, -PIX, -HALF, HALF):
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED, f"{path} has an unexpected geotransform")

    def window(self, r0: int, r1: int, c0: int, c1: int) -> np.ndarray:
        from rasterio.windows import Window
        return self._ds.read(1, window=Window(c0, r0, c1 - c0, r1 - r0)).astype(np.float32)


class PdsImgSource:
    """PDS LDEM_80S_20M: raw little-endian int16, height = DN * 0.5 m relative to the sphere."""

    kind = "pds_img"

    def __init__(self, path: Path):
        self.path = Path(path)
        if self.path.stat().st_size != N * N * 2:
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED, f"{path} has the wrong size")
        self._mm = np.memmap(self.path, dtype="<i2", mode="r", shape=(N, N))

    def window(self, r0: int, r1: int, c0: int, c1: int) -> np.ndarray:
        raw = np.asarray(self._mm[r0:r1, c0:c1])
        out = raw.astype(np.float32) * 0.5
        out[raw == -32768] = np.nan  # GDAL's default sentinel; none present in the tile
        return out


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with Path(path).open("rb") as f:
        while block := f.read(8 * 1024 * 1024):
            h.update(block)
    return h.hexdigest()


def manifest(resource_id: str) -> dict:
    return json.loads((MANIFESTS / f"{resource_id}.json").read_text(encoding="utf-8"))


# ----------------------------------------------------------------------------- terrain
@dataclass(frozen=True)
class Window:
    r0: int
    r1: int
    c0: int
    c1: int


class DemTerrain:
    """TerrainProvider backed by a window of one of the LOLA 20 m products."""

    def __init__(self, source, *, center_lat_deg: float, center_lon_east_deg: float,
                 radius_km: float, resource_id: str | None = None):
        self.source = source
        self.radius_km = radius_km
        cx, cy = stereographic_xy(lonlat_to_unit(center_lat_deg, center_lon_east_deg))
        r = radius_km * 1000.0 * SCALE_MARGIN + 2 * PIX
        # pixel (row, col) centre: x = -HALF + PIX (col + .5),  y = HALF - PIX (row + .5)
        c0 = max(0, math.floor((cx - r + HALF) / PIX) - 1)
        c1 = min(N, math.ceil((cx + r + HALF) / PIX) + 2)
        r0 = max(0, math.floor((HALF - (cy + r)) / PIX) - 1)
        r1 = min(N, math.ceil((HALF - (cy - r)) / PIX) + 2)
        if r1 <= r0 or c1 <= c0:
            raise LunaScopeError("DEM_COVERAGE_INCOMPLETE", "footprint lies outside the DEM tile")
        self.win = Window(r0, r1, c0, c1)
        self.data = source.window(r0, r1, c0, c1)
        self.clipped = bool(c0 == 0 or r0 == 0 or c1 == N or r1 == N)
        m = manifest(resource_id) if resource_id else {}
        self.identity = {
            "kind": "lola_20m_polar", "source": source.kind, "resource_id": resource_id,
            "product_id": m.get("product_id"), "sha256": m.get("sha256"),
            "window_rows_cols": [r0, r1, c0, c1], "radius_km": radius_km,
            "interpolation": "bilinear_pixel_centres",
        }

    @property
    def missing_bound_m(self) -> float | None:
        return None  # no justified bound for terrain outside the tile

    def elevation_m(self, q_hat: np.ndarray) -> np.ndarray:
        x, y = stereographic_xy(q_hat)
        u = (x + HALF) / PIX - 0.5  # fractional column of the pixel-centre grid
        v = (HALF - y) / PIX - 0.5  # fractional row
        j0, i0 = np.floor(u), np.floor(v)
        fu, fv = u - j0, v - i0
        w = self.win
        j = j0.astype(np.int64) - w.c0
        i = i0.astype(np.int64) - w.r0
        h, wd = self.data.shape
        inside = (j >= 0) & (j + 1 < wd) & (i >= 0) & (i + 1 < h)
        # also outside the full tile: pixel indices outside [0, N-1] have no data
        inside &= (j0 >= 0) & (j0 + 1 <= N - 1) & (i0 >= 0) & (i0 + 1 <= N - 1)
        jj, ii = np.where(inside, j, 0), np.where(inside, i, 0)
        d = self.data
        z00, z01 = d[ii, jj], d[ii, jj + 1]
        z10, z11 = d[ii + 1, jj], d[ii + 1, jj + 1]
        z = (z00 * (1 - fu) + z01 * fu) * (1 - fv) + (z10 * (1 - fu) + z11 * fu) * fv
        return np.where(inside, z, np.nan).astype(np.float64)

    def ground_height_m(self, lat_deg: float, lon_east_deg: float) -> float:
        z = float(self.elevation_m(lonlat_to_unit(lat_deg, lon_east_deg)[None, :])[0])
        if not math.isfinite(z):
            raise LunaScopeError("DEM_COVERAGE_INCOMPLETE",
                                 f"no DEM height at ({lat_deg}, {lon_east_deg})")
        return z

    def verify_integrity(self) -> None:
        """Full SHA-256 against the manifest pin (slow: run at startup / in CI, not per request)."""
        pin = self.identity.get("sha256")
        if not pin or sha256_file(self.source.path) != pin:
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED,
                                 f"{self.source.path.name} fails its SHA-256 pin")


def footprint_coverage(obs: CanonicalObserver, radius_km: float, samples: int = 720) -> dict:
    """Fraction of the horizon footprint (a disk of `radius_km` on the sphere) inside the tile."""
    e, n, u = obs.enu
    ref = obs.reference_radius_km
    ang = np.linspace(0, radius_km, 60)[1:] / ref
    az = np.radians(np.linspace(0, 360, samples, endpoint=False))
    t = np.sin(az)[:, None] * e + np.cos(az)[:, None] * n
    q = np.cos(ang)[None, :, None] * u + np.sin(ang)[None, :, None] * t[:, None, :]
    x, y = stereographic_xy(q)
    ok = (np.abs(x) <= HALF - PIX) & (np.abs(y) <= HALF - PIX)
    return {"covered_fraction": float(ok.mean()), "fully_covered": bool(ok.all()),
            "sectors_with_gap": int((~ok.all(axis=1)).sum()), "radius_km": radius_km}

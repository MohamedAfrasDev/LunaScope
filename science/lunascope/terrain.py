"""TerrainProvider contract and synthetic terrains for tests (spec 6.1).

Providers take unit vectors in the body-fixed frame (shape (..., 3)) and return elevation in
metres above the reference sphere, NaN where there is no data. Numerical code does no file
or network access; real DEM providers will plug in behind the same protocol.
"""

from __future__ import annotations

import math
from typing import Protocol

import numpy as np

from .observer import CanonicalObserver


class TerrainProvider(Protocol):
    identity: dict

    def elevation_m(self, q_hat: np.ndarray) -> np.ndarray:
        """Elevation (m) at unit vectors q_hat (..., 3); NaN where nodata or uncovered."""

    @property
    def missing_bound_m(self) -> float | None:
        """Conservative upper bound on terrain elevation inside *missing* regions, or None.

        Must be justified independently of the valid cells (spec 6.4); None means "unknown".
        """


def _offsets(q_hat: np.ndarray, obs: CanonicalObserver):
    """Great-circle distance (km) and azimuth (deg) of q_hat as seen from the observer."""
    e, n, u = obs.enu
    cosd = np.clip(q_hat @ u, -1.0, 1.0)
    s_km = obs.reference_radius_km * np.arccos(cosd)
    az = np.degrees(np.arctan2(q_hat @ e, q_hat @ n)) % 360.0
    return s_km, az


class _Synthetic:
    identity: dict
    _bound: float | None = None

    @property
    def missing_bound_m(self) -> float | None:
        return self._bound


class FlatSphere(_Synthetic):
    """z = 0 everywhere; optional tile radius beyond which there is no data."""

    def __init__(self, obs: CanonicalObserver, tile_radius_km: float | None = None,
                 missing_bound_m: float | None = None):
        self.obs, self.tile = obs, tile_radius_km
        self._bound = missing_bound_m
        self.identity = {"synthetic": "flat_sphere", "tile_radius_km": tile_radius_km}

    def elevation_m(self, q_hat):
        z = np.zeros(q_hat.shape[:-1])
        if self.tile is not None:
            s, _ = _offsets(q_hat, self.obs)
            z = np.where(s > self.tile, np.nan, z)
        return z


class Ridge(_Synthetic):
    """A block of height `height_m` over azimuths az0 +/- half_width_deg and distances
    [dist_km, dist_km + length_km] from the observer; z = 0 elsewhere. Optional tile radius
    and rectangular nodata hole."""

    def __init__(self, obs, *, az_deg, half_width_deg, dist_km, length_km, height_m,
                 tile_radius_km: float | None = None,
                 hole: tuple[float, float, float, float] | None = None,
                 missing_bound_m: float | None = None):
        self.obs, self.az0, self.hw = obs, az_deg, half_width_deg
        self.d0, self.len, self.h = dist_km, length_km, height_m
        self.tile, self.hole = tile_radius_km, hole  # hole = (az_lo, az_hi, d_lo_km, d_hi_km)
        self._bound = missing_bound_m
        self.identity = {"synthetic": "ridge", "az": az_deg, "dist_km": dist_km, "h_m": height_m}

    def elevation_m(self, q_hat):
        s, az = _offsets(q_hat, self.obs)
        daz = (az - self.az0 + 180.0) % 360.0 - 180.0
        z = np.where((np.abs(daz) <= self.hw) & (s >= self.d0) & (s <= self.d0 + self.len),
                     self.h, 0.0)
        if self.hole is not None:
            lo, hi, dlo, dhi = self.hole
            inhole = (az >= lo) & (az <= hi) & (s >= dlo) & (s <= dhi)
            z = np.where(inhole, np.nan, z)
        if self.tile is not None:
            z = np.where(s > self.tile, np.nan, z)
        return z


class CraterRim(_Synthetic):
    """Observer on a floor (z=0) at the crater centre; rim ring of height `rim_m`."""

    def __init__(self, obs, *, rim_radius_km, rim_width_km, rim_m):
        self.obs, self.r, self.w, self.h = obs, rim_radius_km, rim_width_km, rim_m
        self.identity = {"synthetic": "crater", "rim_km": rim_radius_km, "h_m": rim_m}

    def elevation_m(self, q_hat):
        s, _ = _offsets(q_hat, self.obs)
        return np.where((s >= self.r) & (s <= self.r + self.w), self.h, 0.0)


def expected_flat_dip_deg(reference_radius_km: float, total_height_m: float) -> float:
    """Hand-derived horizon depression for an observer `h` above a smooth sphere."""
    h_km = total_height_m / 1000.0
    return -math.degrees(math.acos(reference_radius_km / (reference_radius_km + h_km)))

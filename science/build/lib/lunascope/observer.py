"""Canonical observer and local-frame angles (spec 8.2, 8.3).

Local frame is derived in 3D from the site position, never from raster grid north.
East is defined from longitude directly, e = (-sin lon, cos lon, 0); this equals
normalize(z x u) away from the pole and stays well-defined at the pole (documented
pole convention, tested).
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np

from .canonical import hash_of

MAX_OBSERVER_HEIGHT_M = 50.0


class ObserverUnresolved(ValueError):
    """Vertical reference or coordinate convention is unresolved (OBSERVER_UNRESOLVED)."""


def enu_basis(lat_deg: float, lon_deg_east: float) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
    lat, lon = math.radians(lat_deg), math.radians(lon_deg_east)
    u = np.array([math.cos(lat) * math.cos(lon), math.cos(lat) * math.sin(lon), math.sin(lat)])
    e = np.array([-math.sin(lon), math.cos(lon), 0.0])
    n = np.cross(u, e)
    return e, n, u


@dataclass(frozen=True)
class CanonicalObserver:
    site_id: str
    lat_deg: float  # planetocentric
    lon_deg_east: float  # [0, 360)
    body_frame: str
    reference_radius_km: float
    ground_height_m: float  # relative to the reference sphere
    ground_height_source: str
    observer_height_above_ground_m: float

    @property
    def radius_km(self) -> float:
        return self.reference_radius_km + (
            self.ground_height_m + self.observer_height_above_ground_m
        ) / 1000.0

    @property
    def enu(self) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        return enu_basis(self.lat_deg, self.lon_deg_east)

    @property
    def position_km(self) -> np.ndarray:
        return self.radius_km * self.enu[2]

    def to_dict(self) -> dict:
        return {
            "site_id": self.site_id,
            "lat_deg": self.lat_deg,
            "lon_deg_east": self.lon_deg_east,
            "body_frame": self.body_frame,
            "reference_radius_km": self.reference_radius_km,
            "ground_height_m": self.ground_height_m,
            "ground_height_source": self.ground_height_source,
            "observer_height_above_ground_m": self.observer_height_above_ground_m,
        }

    def digest(self) -> str:
        return hash_of(self.to_dict())


def build_observer(
    *,
    site_id: str,
    lat_deg: float,
    lon_deg: float,
    convention: str,
    lon_direction: str,
    reference_radius_km: float,
    ground_height_m: float | None,
    ground_height_source: str,
    observer_height_above_ground_m: float,
    body_frame: str = "MOON_ME",
) -> CanonicalObserver:
    """Ground height and observer height are separate required terms, so a height above
    ground can never be passed off as a height above the reference surface."""
    if convention != "planetocentric":
        raise ObserverUnresolved(f"latitude convention {convention!r} is not resolved")
    if lon_direction not in ("east_positive", "west_positive"):
        raise ObserverUnresolved(f"longitude direction {lon_direction!r} is not resolved")
    if ground_height_m is None or not math.isfinite(ground_height_m):
        raise ObserverUnresolved("ground height (vertical reference) is unresolved")
    for name, v in (("lat_deg", lat_deg), ("lon_deg", lon_deg), ("radius", reference_radius_km)):
        if not math.isfinite(v):
            raise ValueError(f"{name} must be finite")
    if not -90.0 <= lat_deg <= 90.0:
        raise ValueError("latitude must be within +/-90 degrees")
    if reference_radius_km <= 0:
        raise ValueError("reference radius must be positive")
    if not 0.0 <= observer_height_above_ground_m <= MAX_OBSERVER_HEIGHT_M:
        raise ValueError(f"observer height must be within 0..{MAX_OBSERVER_HEIGHT_M} m")
    lon_east = lon_deg % 360.0 if lon_direction == "east_positive" else (-lon_deg) % 360.0
    return CanonicalObserver(
        site_id=site_id,
        lat_deg=lat_deg,
        lon_deg_east=lon_east,
        body_frame=body_frame,
        reference_radius_km=reference_radius_km,
        ground_height_m=ground_height_m,
        ground_height_source=ground_height_source,
        observer_height_above_ground_m=observer_height_above_ground_m,
    )


def az_el(v: np.ndarray, obs: CanonicalObserver) -> tuple[np.ndarray, np.ndarray]:
    """Azimuth (clockwise from local north, [0,360)) and elevation (deg) of direction(s) v.

    azimuth = mod(atan2(E, N), 360), elevation = atan2(U, sqrt(E^2 + N^2)).
    """
    v = np.asarray(v, dtype=float)
    norm = np.linalg.norm(v, axis=-1, keepdims=True)
    if np.any(norm == 0):
        raise ValueError("zero-length direction")
    v = v / norm
    e, n, u = obs.enu
    E, N, U = v @ e, v @ n, v @ u
    az = np.degrees(np.arctan2(E, N)) % 360.0
    el = np.degrees(np.arctan2(U, np.hypot(E, N)))
    return az, el


def wrapped_diff_deg(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """Signed difference a-b wrapped to [-180, 180)."""
    return (np.asarray(a) - np.asarray(b) + 180.0) % 360.0 - 180.0

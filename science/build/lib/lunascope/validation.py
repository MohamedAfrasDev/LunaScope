"""Geometry reference agreement (spec 9.3 card 1): primary provider vs independent reference.

Residuals are wrapped azimuth and elevation differences per target. A good match here validates
GEOMETRY ONLY; it says nothing about the terrain horizon.
"""

from __future__ import annotations

from dataclasses import dataclass

import numpy as np

from .observer import wrapped_diff_deg
from .providers.geometry.base import GeometrySeries

ARCSEC = 3600.0


@dataclass(frozen=True)
class GeometryResiduals:
    target: str
    n: int
    az_deg: np.ndarray  # primary - reference, wrapped to [-180, 180)
    el_deg: np.ndarray
    az_on_sky_deg: np.ndarray  # az residual * cos(el): the angle actually subtended on the sky
    primary: str
    reference: str

    def max_az_arcsec(self) -> float:
        return float(np.abs(self.az_deg).max() * ARCSEC)

    def max_az_on_sky_arcsec(self) -> float:
        return float(np.abs(self.az_on_sky_deg).max() * ARCSEC)

    def max_el_arcsec(self) -> float:
        return float(np.abs(self.el_deg).max() * ARCSEC)

    def total_arcsec(self) -> np.ndarray:
        return np.hypot(self.az_on_sky_deg, self.el_deg) * ARCSEC

    def max_total_arcsec(self) -> float:
        return float(self.total_arcsec().max())

    def summary(self) -> dict:
        return {"target": self.target, "n": self.n, "primary": self.primary,
                "reference": self.reference,
                "max_az_on_sky_arcsec": self.max_az_on_sky_arcsec(),
                "max_el_arcsec": self.max_el_arcsec(),
                "max_total_arcsec": self.max_total_arcsec(),
                "rms_total_arcsec": float(np.sqrt((self.total_arcsec() ** 2).mean()))}

    def within(self, tolerance_arcsec: float) -> bool:
        return self.max_total_arcsec() <= tolerance_arcsec


def geometry_residuals(primary: GeometrySeries, reference: GeometrySeries) -> GeometryResiduals:
    if primary.target != reference.target:
        raise ValueError("series are for different targets")
    if primary.t_utc != reference.t_utc:
        raise ValueError("series are on different time grids")
    d_az = wrapped_diff_deg(primary.az_deg, reference.az_deg)
    d_el = primary.el_deg - reference.el_deg
    return GeometryResiduals(primary.target, len(primary), d_az, d_el,
                             d_az * np.cos(np.radians(reference.el_deg)), primary.provider,
                             reference.provider)

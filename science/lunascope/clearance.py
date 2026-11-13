"""Clearance model joining target geometry to the terrain horizon (spec 7.1, 7.2).

d(t) = target_elevation(t) - skyline(azimuth(t)) - margin, on the *interpolated* geometry.

`lipschitz` and `monotone` are bounds over a whole interval, not sample estimates:
  * |d'| <= |el'|max + max|skyline slope over every horizon segment the azimuth range overlaps| * |az'|max
  * d' keeps one sign on [a, b] when |d'(mid)| exceeds the bound on |d''| times half the width,
    which is only attempted while the azimuth stays inside ONE linear skyline piece (the skyline
    slope jumps at bin knots, so d' is not Lipschitz across them).
Anything that cannot be bounded returns inf / False, which makes the event search subdivide and
finally report the interval as uncertified, never as "no event".
"""

from __future__ import annotations

import math

from .horizon import HorizonProfile
from .providers.geometry.interpolate import DirectionSpline


class TerrainClearanceModel:
    def __init__(self, spline: DirectionSpline, profile: HorizonProfile | None, *,
                 margin_deg: float = 0.0):
        """profile=None means the flat 0 degree horizon (geometric-only comparison)."""
        self.spline, self.profile, self.margin = spline, profile, margin_deg

    # -- value ------------------------------------------------------------------------------
    def d(self, t: float) -> float:
        az, el = self.spline.az_el(t)
        h = 0.0 if self.profile is None else float(self.profile.lookup(az))
        return el - h - self.margin  # NaN when the skyline there is unknown

    def rate(self, t: float) -> float | None:
        """Analytic dd/dt (deg/s), or None when the skyline slope is not defined (a knot, or an
        uncertified bin): callers must then claim no timing bound."""
        az_r, el_r = self.spline.rates(t)
        if self.profile is None:
            return el_r
        az = self.spline.az_el(t)[0]
        slope = self.profile.single_piece_slope(az, az)
        return None if slope is None else el_r - slope * az_r

    # -- bounds -----------------------------------------------------------------------------
    def _az_range(self, a: float, b: float, mb) -> tuple[float, float]:
        mid = (a + b) / 2
        az_mid = self.spline.az_el(mid)[0]
        half = mb.az_rate * (b - a) / 2
        return az_mid - half, az_mid + half

    def lipschitz(self, a: float, b: float) -> float:
        mb = self.spline.motion_bounds(a, b)
        if self.profile is None:
            return mb.el_rate
        if math.isinf(mb.az_rate):
            return math.inf
        lo, hi = self._az_range(a, b, mb)
        slope = self.profile.max_slope(lo, hi)
        return mb.el_rate + slope * mb.az_rate

    def monotone(self, a: float, b: float) -> bool:
        mb = self.spline.motion_bounds(a, b)
        if math.isinf(mb.az_acc):
            return False
        if self.profile is None:
            s = 0.0
        else:
            lo, hi = self._az_range(a, b, mb)
            piece = self.profile.single_piece_slope(lo, hi)
            if piece is None:
                return False
            s = piece
        mid = (a + b) / 2
        az_r, el_r = self.spline.rates(mid)
        d_mid = el_r - s * az_r
        d2 = mb.el_acc + abs(s) * mb.az_acc
        return abs(d_mid) > d2 * (b - a) / 2

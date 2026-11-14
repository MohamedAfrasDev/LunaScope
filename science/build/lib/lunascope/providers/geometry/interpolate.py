"""Cubic Hermite interpolation of target directions, with rigorous derivative bounds (review I-03).

Directions are interpolated as **vectors** in the observer's local east/north/up frame, not as
angles, so azimuth wrap and the zenith never matter. Node derivatives come from the same grid
(central differences, 2nd-order one-sided at the ends). Result is re-normalised.

Bounds (all valid for the interpolant, not estimated from samples):
  * each segment is a cubic Bezier with control points P0..P3, so v' and v'' lie in the convex
    hulls of their control points -> |v'| <= max|D_k|, |v''| <= max|S_k|;
  * |v| >= min_k P_k . u_hat for any unit u_hat (linear functional on a convex hull) ->  rho;
  * for w = v/|v|:  |w'| <= |v'|/rho,   |w''| <= 2|v''|/rho + 5|v'|^2/rho^2;
  * elevation:  |el'| <= |w'|,  |el''| <= |w''| + 2|w'|^2 tan|el|;
    azimuth:    |az'| <= |w'|/cos el,  |az''| <= |w''|/cos el + 2|az'| tan|el| |el'|.
The holdout error (`holdout_error_deg`) separately measures how far the interpolant is from
finer *provider* data; that residual, not these bounds, limits event-time accuracy.
"""

from __future__ import annotations

import math
from dataclasses import dataclass

import numpy as np


def to_enu_vector(az_deg, el_deg) -> np.ndarray:
    az, el = np.radians(az_deg), np.radians(el_deg)
    return np.stack([np.cos(el) * np.sin(az), np.cos(el) * np.cos(az), np.sin(el)], axis=-1)


def from_enu_vector(v) -> tuple[float, float]:
    v = np.asarray(v, dtype=float)
    v = v / np.linalg.norm(v)
    return (math.degrees(math.atan2(v[0], v[1])) % 360.0,
            math.degrees(math.atan2(v[2], math.hypot(v[0], v[1]))))


class SplineError(ValueError):
    pass


@dataclass(frozen=True)
class SegmentBound:
    rho: float  # lower bound on |v|
    rmax: float
    vp: float  # upper bound on |v'| (per second)
    vpp: float  # upper bound on |v''| (per second^2)


@dataclass(frozen=True)
class MotionBounds:
    """Bounds over a time interval, in degrees and seconds. inf means 'cannot certify'."""

    w_rate: float  # rad/s, bound on |w'|
    el_rate: float  # deg/s
    az_rate: float  # deg/s
    el_acc: float  # deg/s^2
    az_acc: float  # deg/s^2
    el_max_deg: float  # bound on |elevation| over the interval


class DirectionSpline:
    def __init__(self, t_s, az_deg, el_deg):
        t = np.asarray(t_s, dtype=float)
        n = len(t)
        if n < 3 or np.any(np.diff(t) <= 0):
            raise SplineError("need >= 3 strictly increasing times")
        h = np.diff(t)
        if not np.allclose(h, h[0], rtol=1e-9):
            raise SplineError("grid must be uniform")
        self.t, self.h = t, float(h[0])
        self.az, self.el = np.asarray(az_deg, float), np.asarray(el_deg, float)
        self.V = to_enu_vector(self.az, self.el)
        M = np.empty_like(self.V)
        M[1:-1] = (self.V[2:] - self.V[:-2]) / (2 * self.h)
        M[0] = (-3 * self.V[0] + 4 * self.V[1] - self.V[2]) / (2 * self.h)
        M[-1] = (3 * self.V[-1] - 4 * self.V[-2] + self.V[-3]) / (2 * self.h)
        self.M = M
        self._bounds: list[SegmentBound] = [self._segment_bound(i) for i in range(n - 1)]

    # ------------------------------------------------------------------ evaluation
    @property
    def t_start(self) -> float:
        return float(self.t[0])

    @property
    def t_end(self) -> float:
        return float(self.t[-1])

    def _seg(self, t: float) -> tuple[int, float]:
        if t < self.t[0] - 1e-9 or t > self.t[-1] + 1e-9:
            raise SplineError(f"t={t} outside [{self.t[0]}, {self.t[-1]}]")
        i = int(min(max(np.searchsorted(self.t, t, side="right") - 1, 0), len(self.t) - 2))
        return i, (t - self.t[i]) / self.h

    def eval(self, t: float):
        """Return (v, v', v'') at t; derivatives per second."""
        i, s = self._seg(t)
        h, V0, V1, M0, M1 = self.h, self.V[i], self.V[i + 1], self.M[i], self.M[i + 1]
        h00, h10, h01, h11 = 2*s**3 - 3*s**2 + 1, s**3 - 2*s**2 + s, -2*s**3 + 3*s**2, s**3 - s**2
        d00, d10, d01, d11 = 6*s**2 - 6*s, 3*s**2 - 4*s + 1, -6*s**2 + 6*s, 3*s**2 - 2*s
        e00, e10, e01, e11 = 12*s - 6, 6*s - 4, -12*s + 6, 6*s - 2
        v = h00*V0 + h10*h*M0 + h01*V1 + h11*h*M1
        vp = (d00*V0 + d10*h*M0 + d01*V1 + d11*h*M1) / h
        vpp = (e00*V0 + e10*h*M0 + e01*V1 + e11*h*M1) / h**2
        return v, vp, vpp

    def az_el(self, t: float) -> tuple[float, float]:
        return from_enu_vector(self.eval(t)[0])

    def rates(self, t: float) -> tuple[float, float]:
        """Analytic (az', el') in deg/s."""
        v, vp, _ = self.eval(t)
        r = np.linalg.norm(v)
        w = v / r
        wp = (vp - (w @ vp) * w) / r
        c2 = w[0] ** 2 + w[1] ** 2
        el_rate = (wp[2]) / math.sqrt(c2)  # u = (0,0,1): u.w' / cos(el)
        az_rate = (w[1] * wp[0] - w[0] * wp[1]) / c2
        return math.degrees(az_rate), math.degrees(el_rate)

    # ------------------------------------------------------------------ bounds
    def _segment_bound(self, i: int) -> SegmentBound:
        h, V0, V1, M0, M1 = self.h, self.V[i], self.V[i + 1], self.M[i], self.M[i + 1]
        P = np.array([V0, V0 + h * M0 / 3, V1 - h * M1 / 3, V1])
        D = 3 * (P[1:] - P[:-1]) / h
        S = 6 * (P[2:] - 2 * P[1:3] + P[:2]) / h**2
        u_hat = (P[0] + P[3]) / np.linalg.norm(P[0] + P[3])
        rho = float(np.min(P @ u_hat))
        if rho <= 0.5:
            raise SplineError("grid too coarse: cannot bound |v| away from zero")
        return SegmentBound(rho, float(np.max(np.linalg.norm(P, axis=1))),
                            float(np.max(np.linalg.norm(D, axis=1))),
                            float(np.max(np.linalg.norm(S, axis=1))))

    def motion_bounds(self, a: float, b: float) -> MotionBounds:
        i0, _ = self._seg(a)
        i1, _ = self._seg(b)
        sb = self._bounds[i0:i1 + 1]
        rho = min(s.rho for s in sb)
        vp = max(s.vp for s in sb)
        vpp = max(s.vpp for s in sb)
        R = vp / rho  # |w'|
        A = 2 * vpp / rho + 5 * vp**2 / rho**2  # |w''|
        el_a = max(abs(self.az_el(a)[1]), abs(self.az_el(b)[1]))
        emax = math.radians(el_a) + R * (b - a)  # |el(t)| <= |el(endpoint)| + R * width
        if emax >= math.radians(80.0):
            inf = math.inf
            return MotionBounds(R, math.degrees(R), inf, inf, inf, math.degrees(emax))
        c, tn = math.cos(emax), math.tan(emax)
        az_r = R / c
        el_acc = A + 2 * R**2 * tn
        az_acc = A / c + 2 * az_r * tn * R
        d = math.degrees
        return MotionBounds(R, d(R), d(az_r), d(el_acc), d(az_acc), d(emax))


def angular_distance_deg(v1, v2) -> float:
    v1, v2 = np.asarray(v1, float), np.asarray(v2, float)
    return math.degrees(math.atan2(np.linalg.norm(np.cross(v1, v2)), float(v1 @ v2)))


@dataclass(frozen=True)
class Holdout:
    max_deg: float
    rms_deg: float
    n: int


def holdout_error_deg(spline: DirectionSpline, t_truth, az_truth, el_truth) -> Holdout:
    """Angular error of the interpolant against finer provider data not used to build it."""
    errs = []
    for t, az, el in zip(t_truth, az_truth, el_truth, strict=True):
        if spline.t_start - 1e-9 <= t <= spline.t_end + 1e-9:
            errs.append(angular_distance_deg(spline.eval(t)[0] / np.linalg.norm(spline.eval(t)[0]),
                                             to_enu_vector(az, el)))
    e = np.array(errs)
    return Holdout(float(e.max()), float(np.sqrt((e**2).mean())), len(e))


def geometry_timing_bound_s(delta_deg: float, clearance_rate_deg_s: float,
                            min_rate_deg_s: float = 1e-6) -> float | None:
    """Time shift of a crossing caused by a clearance error of `delta_deg`.

    Returns None near a tangent (|d'| too small): no timing bound is claimed there.
    """
    if abs(clearance_rate_deg_s) < min_rate_deg_s:
        return None
    return delta_deg / abs(clearance_rate_deg_s)

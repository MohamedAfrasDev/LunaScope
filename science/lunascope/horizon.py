"""Terrain-horizon engine (spec 6.4, 6.5).

For each azimuth the skyline elevation is the maximum, over terrain samples along the
great-circle ray, of the 3D elevation angle seen from the observer (lunar curvature included).
Nodata is unknown, never zero: a sector with missing samples is `coverage_limited` unless a
separately justified bound on the *missing region* shows it cannot raise the skyline.

Interpolating between azimuth bins can under-estimate a narrow ridge that falls between rays,
so results are "converged under the tested settings", never "all obstacles resolved"; use
`compare_profiles` for the refinement study.
"""

from __future__ import annotations

import math
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np

from .canonical import hash_of
from .observer import CanonicalObserver
from .terrain import TerrainProvider

HORIZON_ALGORITHM = "horizon-0.1.0"

CERTIFIED, COVERAGE_LIMITED, UNSUPPORTED = 0, 1, 2
STATE_NAMES = {CERTIFIED: "certified", COVERAGE_LIMITED: "coverage_limited",
               UNSUPPORTED: "unsupported"}


class Cancelled(Exception):
    pass


@dataclass(frozen=True)
class HorizonSettings:
    radius_km: float = 150.0
    az_step_deg: float = 0.5
    near_pixel_m: float = 20.0
    far_pixel_m: float = 20.0
    near_limit_km: float = 2.0
    growth: float = 1.02
    chunk_rows: int = 64

    def n_az(self) -> int:
        n = round(360.0 / self.az_step_deg)
        if not math.isclose(n * self.az_step_deg, 360.0, rel_tol=1e-9):
            raise ValueError("azimuth step must divide 360 degrees")
        return n

    def to_dict(self) -> dict:
        d = dict(self.__dict__)
        d.pop("chunk_rows")  # execution detail, not identity
        return d


def radial_schedule(s: HorizonSettings) -> np.ndarray:
    near = 0.5 * s.near_pixel_m / 1000.0
    far = max(s.far_pixel_m / 1000.0, near)
    out, x, step = [], near, near
    while x <= s.radius_km + 1e-12:
        out.append(x)
        step = near if x < s.near_limit_km else min(step * s.growth, far)
        x += step
    return np.array(out)


@dataclass(frozen=True)
class HorizonProfile:
    azimuth_deg: np.ndarray
    horizon_el_deg: np.ndarray  # NaN where no sample was valid
    argmax_distance_km: np.ndarray
    sector_state: np.ndarray  # CERTIFIED / COVERAGE_LIMITED / UNSUPPORTED
    settings: HorizonSettings
    observer_digest: str
    terrain_identity: dict
    algorithm: str = HORIZON_ALGORITHM

    def cache_key(self) -> str:
        return hash_of({"observer": self.observer_digest, "terrain": self.terrain_identity,
                        "settings": self.settings.to_dict(), "algorithm": self.algorithm})

    def lookup(self, az_deg) -> np.ndarray:
        """Circular linear interpolation of the skyline; NaN if either neighbour is uncertified."""
        az = np.asarray(az_deg, dtype=float) % 360.0
        n, step = len(self.azimuth_deg), self.settings.az_step_deg
        x = az / step
        i0 = np.floor(x).astype(int) % n
        i1 = (i0 + 1) % n
        f = x - np.floor(x)
        ok = (self.sector_state[i0] == CERTIFIED) & (self.sector_state[i1] == CERTIFIED)
        h = (1 - f) * self.horizon_el_deg[i0] + f * self.horizon_el_deg[i1]
        return np.where(ok, h, np.nan)

    def sector_summary(self) -> dict:
        return {STATE_NAMES[k]: int((self.sector_state == k).sum()) for k in STATE_NAMES}


def _elevation_angle(q_hat, z_m, ref_r, pos, u):
    q = (ref_r + z_m / 1000.0)[..., None] * q_hat
    w = q - pos
    wu = w @ u
    horiz = np.linalg.norm(w - wu[..., None] * u, axis=-1)
    return np.degrees(np.arctan2(wu, horiz))


def compute_horizon(
    obs: CanonicalObserver,
    terrain: TerrainProvider,
    settings: HorizonSettings = HorizonSettings(),
    should_cancel: Callable[[], bool] | None = None,
) -> HorizonProfile:
    e, n, u = obs.enu
    pos, ref_r = obs.position_km, obs.reference_radius_km
    s_km = radial_schedule(settings)
    ang = s_km / ref_r
    n_az = settings.n_az()
    az_deg = np.arange(n_az) * settings.az_step_deg
    h_el = np.full(n_az, np.nan)
    arg_d = np.full(n_az, np.nan)
    state = np.zeros(n_az, dtype=np.int8)
    bound = terrain.missing_bound_m

    for lo in range(0, n_az, settings.chunk_rows):
        if should_cancel is not None and should_cancel():
            raise Cancelled
        hi = min(lo + settings.chunk_rows, n_az)
        a = np.radians(az_deg[lo:hi])
        t = np.sin(a)[:, None] * e + np.cos(a)[:, None] * n  # (rows, 3) tangent directions
        q_hat = (np.cos(ang)[None, :, None] * u + np.sin(ang)[None, :, None] * t[:, None, :])
        z = terrain.elevation_m(q_hat)
        theta = _elevation_angle(q_hat, np.where(np.isnan(z), 0.0, z), ref_r, pos, u)
        theta = np.where(np.isnan(z), np.nan, theta)
        missing = np.isnan(z)
        all_missing = missing.all(axis=1)
        safe = np.where(missing, -np.inf, theta)
        idx = safe.argmax(axis=1)
        best = safe[np.arange(hi - lo), idx]
        best = np.where(all_missing, np.nan, best)
        h_el[lo:hi] = best
        arg_d[lo:hi] = np.where(all_missing, np.nan, s_km[idx])

        st = np.zeros(hi - lo, dtype=np.int8)
        any_missing = missing.any(axis=1)
        if bound is None:
            st[any_missing] = COVERAGE_LIMITED
        else:
            theta_b = _elevation_angle(q_hat, np.full(z.shape, float(bound)), ref_r, pos, u)
            worst = np.where(missing, theta_b, -np.inf).max(axis=1)
            exceeds = worst > np.where(np.isnan(best), -np.inf, best)
            st[any_missing & exceeds] = COVERAGE_LIMITED
        st[all_missing] = UNSUPPORTED
        state[lo:hi] = st

    return HorizonProfile(az_deg, h_el, arg_d, state, settings, obs.digest(), terrain.identity)


def clearance_deg(target_el_deg, target_az_deg, profile: HorizonProfile,
                  margin_deg: float = 0.0, terrain: bool = True) -> np.ndarray:
    """d = target elevation - horizon(az) - margin. NaN means unknown (never hidden).

    With terrain=False the flat 0 degree horizon is used (geometric-only comparison).
    """
    el = np.asarray(target_el_deg, dtype=float)
    h = profile.lookup(target_az_deg) if terrain else 0.0
    return el - h - margin_deg


def compare_profiles(coarse: HorizonProfile, fine: HorizonProfile, n: int = 3600) -> float:
    """Max absolute skyline difference (deg) over a common azimuth grid, ignoring unknowns."""
    az = np.arange(n) * 360.0 / n
    a, b = coarse.lookup(az), fine.lookup(az)
    ok = ~(np.isnan(a) | np.isnan(b))
    return float(np.max(np.abs(a - b)[ok])) if ok.any() else float("nan")

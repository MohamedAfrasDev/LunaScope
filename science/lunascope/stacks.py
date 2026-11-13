"""Provider stacks the service can run, and the identity of an analysis (known at admission).

* "synthetic": analytic geometry + a synthetic ridge. Instant, offline, ALWAYS labelled
  synthetic_demonstration (DEMONSTRATION_DATA warning). For UI development and tests.
* "live": JPL Horizons (cached verbatim) + LOLA 20 m DEM + SPICE reference. Result state is
  real_data_unverified until validation gates close.

The run_id must be computable before any work starts (spec 8.1), so everything it needs is read
from manifests here: DEM SHA-256 pins and the SPICE kernel-set digest. No data file is opened.
"""

from __future__ import annotations

import dataclasses
import json
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import ClassVar

import numpy as np

from . import ALGORITHM_VERSION
from .api_models import AnalysisRequest, canonical_request, resolve_sites
from .canonical import hash_of, make_run_id
from .codes import ResultState
from .dem import MANIFESTS, RAW, DemTerrain, GeoTiffSource, PdsImgSource
from .horizon import HORIZON_ALGORITHM
from .observer import build_observer
from .pipeline import RunConfig, SiteSpec, Stack
from .providers.geometry.base import GeometrySeries
from .providers.geometry.horizons import HorizonsClient, HorizonsProvider, ResponseCache
from .providers.geometry.spice import KernelSet, SpiceProvider
from .terrain import Ridge

DEM_FILES = {
    "lola-80s-20m-adj": ("dem-lola-80s-20mpp-adj", GeoTiffSource, "LDEM_80S_20MPP_ADJ.TIF"),
    "lola-80s-20m-pds": ("dem-pds-ldem-80s-20m", PdsImgSource, "LDEM_80S_20M.IMG"),
}
ALT_PROFILE = {"lola-80s-20m-adj": "lola-80s-20m-pds", "lola-80s-20m-pds": "lola-80s-20m-adj"}
SYNTHETIC_DEM_SHA = hash_of({"synthetic": "ridge", "az": 90.0, "dist_km": 5.0, "h_m": 300.0})


@dataclass(frozen=True)
class ServiceConfig:
    data_dir: Path
    stack_kind: str = "synthetic"  # synthetic | live
    mode: str = "live"  # live | replay
    raw_dir: Path = RAW
    kernel_dir: Path | None = None
    max_running: int = 2
    max_queued: int = 8
    timeout_s: float | None = None  # per-run; defaults by stack kind
    max_attempts: int = 2
    api_token: str | None = None  # shared secret the web BFF sends; None disables the check

    @property
    def run_timeout_s(self) -> float:
        return self.timeout_s if self.timeout_s is not None else (60.0 if self.stack_kind == "synthetic" else 900.0)


# ----------------------------------------------------------------------------- synthetic
class AnalyticGeometry:
    """Sun-like and Earth-like tracks: azimuth sweeps 40 deg over 2 days. Offline and instant."""

    identity: ClassVar[dict] = {"name": "fixture-synthetic", "label": "DEMONSTRATION: invented tracks, not an ephemeris"}

    def series(self, obs, target, times):
        t0 = times[0]
        t = np.array([(x - t0).total_seconds() for x in times])
        az = (70.0 + 40.0 * t / (2 * 86400.0)) % 360.0
        el = np.full_like(t, 2.0 if target == "sun_center" else 5.0)
        return GeometrySeries(
            target=target, t_utc=tuple(times), az_deg=az, el_deg=el, provider="fixture-synthetic",
            signature_version="0", raw_sha256=hash_of({"t": target, "n": len(times), "t0": times[0].isoformat()}),
            retrieved_utc="2027-01-01T00:00:00Z", request={"synthetic": True},
            correction_mode="none", time_scale="UTC",
            flags=("DEMONSTRATION_DATA",), header={"label": self.identity["label"]})


def synthetic_terrain_factory(site: SiteSpec, cfg: RunConfig):
    o = build_observer(site_id=site.site_id, lat_deg=site.lat_deg, lon_deg=site.lon_east_deg,
                       convention="planetocentric", lon_direction="east_positive",
                       reference_radius_km=1737.4, ground_height_m=0.0, ground_height_source="synthetic",
                       observer_height_above_ground_m=cfg.observer_height_m)
    return Ridge(o, az_deg=90.0, half_width_deg=5.0, dist_km=5.0, length_km=1.0, height_m=300.0), 0.0


# ----------------------------------------------------------------------------- live
def dem_factory(profile: str, raw_dir: Path):
    rid, source_cls, filename = DEM_FILES[profile]

    def make(site: SiteSpec, cfg: RunConfig):
        d = DemTerrain(source_cls(Path(raw_dir) / filename), center_lat_deg=site.lat_deg,
                       center_lon_east_deg=site.lon_east_deg, radius_km=cfg.radius_km, resource_id=rid)
        return d, d.ground_height_m(site.lat_deg, site.lon_east_deg)
    return make


def manifest_sha(resource_id: str) -> str:
    sha = json.loads((MANIFESTS / f"{resource_id}.json").read_text(encoding="utf-8")).get("sha256")
    if not sha:
        raise ValueError(f"manifest {resource_id} has no sha256 pin")
    return sha


def kernel_digest(cfg: ServiceConfig) -> str:
    return KernelSet(cfg.kernel_dir).manifest_digest


def build_stack(cfg: ServiceConfig, req_dem_profile: str) -> tuple[Stack, object | None]:
    """Returns (stack, alternate terrain factory or None). Builds providers; opens no DEM yet."""
    if cfg.stack_kind == "synthetic":
        return Stack(geometry=AnalyticGeometry(), terrain_factory=synthetic_terrain_factory,
                     synthetic=True, extra_resources=[]), synthetic_terrain_factory
    if cfg.stack_kind != "live":
        raise ValueError(f"unknown stack kind {cfg.stack_kind!r}")
    cache = ResponseCache(Path(cfg.data_dir) / "horizons_cache")
    kernels = KernelSet(cfg.kernel_dir)
    stack = Stack(
        geometry=HorizonsProvider(HorizonsClient(cache)),
        terrain_factory=dem_factory(req_dem_profile, cfg.raw_dir),
        reference=SpiceProvider(kernels),
        extra_resources=[{"role": "spice_kernels", "sha256": kernels.manifest_digest}])
    return stack, dem_factory(ALT_PROFILE[req_dem_profile], cfg.raw_dir)


# ----------------------------------------------------------------------------- identity
@dataclass(frozen=True)
class Identity:
    run_id: str
    request_hash: str
    resource_digest: str
    algorithm_id: str
    canonical_request: dict
    effective_settings: dict
    resources: list
    result_state: str

    def request_json(self) -> str:
        return json.dumps(self.canonical_request, sort_keys=True, separators=(",", ":"))


def analysis_identity(req: AnalysisRequest, cfg: ServiceConfig) -> Identity:
    sites = resolve_sites(req)
    return identity_from_canonical(canonical_request(req, sites), cfg)


def identity_from_canonical(canon: dict, cfg: ServiceConfig) -> Identity:
    """Identity of an already-canonical request (a stored parent with one field changed, say).
    A variant and a fresh request with the same inputs get the same run_id, so they attach."""
    run_cfg, _ = run_config_from_canonical(canon)
    dem_profile = canon["terrain"]["dem_profile"]
    sensitivity = canon["options"]["sensitivity"]
    synthetic = cfg.stack_kind == "synthetic"
    if synthetic:
        resources = [{"role": "dem", "sha256": SYNTHETIC_DEM_SHA}]
        geometry_identity = AnalyticGeometry.identity
    else:
        rid = DEM_FILES[dem_profile][0]
        resources = [{"role": "dem", "sha256": manifest_sha(rid)},
                     {"role": "spice_kernels", "sha256": kernel_digest(cfg)}]
        geometry_identity = HorizonsProvider.identity
    effective = {**run_cfg.effective_settings(), "geometry_provider": geometry_identity,
                 "interpolation": "cubic_hermite_enu_vectors", "horizon_algorithm": HORIZON_ALGORITHM,
                 "event_algorithm": ALGORITHM_VERSION, "stack_kind": cfg.stack_kind,
                 "dem_profile": dem_profile, "sensitivity": sensitivity}
    algorithm_id = f"lunascope-science/{ALGORITHM_VERSION}"
    run_id = make_run_id(canon, effective, resources, algorithm_id)
    return Identity(
        run_id=run_id, request_hash=hash_of(canon), resource_digest=hash_of(
            sorted(resources, key=lambda r: (r["role"], r["sha256"]))),
        algorithm_id=algorithm_id, canonical_request=canon, effective_settings=effective,
        resources=resources,
        result_state=(ResultState.SYNTHETIC if synthetic else ResultState.REAL_UNVERIFIED).value)


def run_config_from_canonical(canon: dict) -> tuple[RunConfig, list[SiteSpec]]:
    m, r, t = canon["mission"], canon["requirements"], canon["terrain"]
    start = datetime.fromisoformat(m["start_utc"]).astimezone(UTC)
    cfg = RunConfig(start_utc=start, duration_s=m["duration_s"], step_s=m["step_s"],
                    sun_min=r["sun_min_availability"], earth_min=r["earth_min_availability"],
                    radius_km=t["radius_km"], az_step_deg=t["az_step_deg"],
                    observer_height_m=t["observer_height_m"],
                    clearance_margin_deg=t["clearance_margin_deg"])
    sites = [SiteSpec(s["site_id"], s["lat_deg"], s["lon_east_deg"], s["source"], s["precision_m"])
             for s in canon["sites"]]
    return cfg, sites


__all__ = [
    "Identity",
    "ServiceConfig",
    "analysis_identity",
    "build_stack",
    "dataclasses",
    "identity_from_canonical",
    "run_config_from_canonical",
]

"""One site, end to end: geometry -> horizon -> certified events -> metrics -> evidence bundle.

This is the first integrated path (Phase 1, Gate 1). It orchestrates modules that each have their
own tests; it adds no new science. Every result carries its state:

  synthetic_demonstration  any input is a synthetic fixture
  real_data_unverified     real inputs, but no validation gate has closed (always, for now)

`validated` is never produced here: that needs the three evidence cards signed off.
"""

from __future__ import annotations

import dataclasses
import json
import math
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime, timedelta
from pathlib import Path

import numpy as np

from . import ALGORITHM_VERSION, horizon_store
from .canonical import canonical_bytes, hash_of, make_result_id, make_run_id, sha256_hex
from .clearance import TerrainClearanceModel
from .codes import ResultState
from .contacts import find_contacts
from .countdown import countdown
from .disk_edge import disk_edge_sensitivity
from .events import Settings, build_partition
from .horizon import STATE_NAMES, HorizonProfile, HorizonSettings, compute_horizon
from .metrics import summarize
from .observer import build_observer
from .providers.geometry.interpolate import (
    DirectionSpline,
    geometry_timing_bound_s,
    holdout_error_deg,
)
from .requirements import site_summary
from .validation import geometry_residuals

TARGETS = ("sun_center", "earth_center")
REFERENCE_TOLERANCE_ARCSEC = 0.01  # SDR-001 D-04 / D-10 (proposed)
HOLDOUT_SAFETY = 10.0  # delta_geom used for certification = 10 x measured holdout max
DELTA_FLOOR_DEG = 1e-6
SENSITIVITY_AVAILABILITY_TOL = 0.01  # proposed (OQ-08): 1 percentage point


@dataclass(frozen=True)
class SiteSpec:
    site_id: str
    lat_deg: float
    lon_east_deg: float
    source: str = "user-entered"
    precision_m: float = 100.0


@dataclass(frozen=True)
class RunConfig:
    start_utc: datetime
    duration_s: int = 7 * 86400
    step_s: int = 600
    sun_min: float = 0.60  # scenario values, not mission rules
    earth_min: float = 0.50
    radius_km: float = 150.0
    az_step_deg: float = 0.1
    observer_height_m: float = 2.0
    clearance_margin_deg: float = 0.0
    eps_deg: float = 0.01
    tau_s: float = 1.0
    w_min_s: float = 5.0
    max_evals: int = 200
    holdout_s: int = 6 * 3600  # 1-minute held-out window from the start; 0 disables

    def effective_settings(self) -> dict:
        d = dataclasses.asdict(self)
        d["start_utc"] = self.start_utc.strftime("%Y-%m-%dT%H:%M:%SZ")
        return d

    def thresholds(self) -> dict:
        return {"sun_center": self.sun_min, "earth_center": self.earth_min}


@dataclass
class Stack:
    """The injected providers. `terrain_factory(site, cfg)` returns (TerrainProvider, ground_height_m)."""

    geometry: object  # .series(obs, target, times) and .identity
    terrain_factory: Callable
    reference: object | None = None  # independent geometry provider (SPICE)
    synthetic: bool = False
    extra_resources: list = field(default_factory=list)
    horizon_dir: Path | None = None  # precomputed skylines (horizon_store); None = always compute

    def replace(self, **kw) -> Stack:
        return dataclasses.replace(self, **kw)


def _clean(o):
    if isinstance(o, dict):
        return {str(k): _clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)):
        return [_clean(v) for v in o]
    if isinstance(o, np.ndarray):
        return _clean(o.tolist())
    if isinstance(o, (np.floating, float)):
        return None if not math.isfinite(float(o)) else float(o)
    if isinstance(o, np.integer):
        return int(o)
    if isinstance(o, np.bool_):
        return bool(o)
    return o


def horizon_payload_sha256(azimuth_deg, horizon_el_deg, argmax_distance_km, sector_state) -> str:
    """Digest of the skyline exactly as the bundle stores it (JSON numbers, NaN as null), so a
    reader can tell whether any bin of a stored horizon changed after the run (test case 13)."""
    return hash_of(_clean({"azimuth_deg": azimuth_deg, "horizon_el_deg": horizon_el_deg,
                           "argmax_distance_km": argmax_distance_km, "sector_state": list(sector_state)}))


def _iso(start: datetime, seconds: float) -> str:
    return (start + timedelta(seconds=float(seconds))).strftime("%Y-%m-%dT%H:%M:%S.%f")[:-3] + "Z"


def _grid(start: datetime, step_s: int, total_s: int) -> list[datetime]:
    return [start + timedelta(seconds=k * step_s) for k in range(total_s // step_s + 1)]


def _intervals_json(intervals, start):
    return [{"start_s": iv.start, "end_s": iv.end, "start_utc": _iso(start, iv.start),
             "end_utc": _iso(start, iv.end), "class": iv.cls.value} for iv in intervals]


def run_site(site: SiteSpec, cfg: RunConfig, stack: Stack, *, with_reference: bool = True) -> dict:
    t_all = time.time()
    timing: dict[str, float] = {}
    warnings: list[str] = []
    T = cfg.duration_s
    if T % cfg.step_s:
        raise ValueError("duration must be a whole number of steps")

    # -- terrain, observer ------------------------------------------------------------------
    t0 = time.time()
    terrain, ground_m = stack.terrain_factory(site, cfg)
    timing["terrain_load_s"] = time.time() - t0
    obs = build_observer(
        site_id=site.site_id, lat_deg=site.lat_deg, lon_deg=site.lon_east_deg,
        convention="planetocentric", lon_direction="east_positive", reference_radius_km=1737.4,
        ground_height_m=ground_m, ground_height_source=json.dumps(terrain.identity, sort_keys=True),
        observer_height_above_ground_m=cfg.observer_height_m)

    # -- horizon -----------------------------------------------------------------------------
    t0 = time.time()
    hs = HorizonSettings(radius_km=cfg.radius_km, az_step_deg=cfg.az_step_deg)
    prof, horizon_cached = None, False
    if stack.horizon_dir is not None:
        prof = horizon_store.load(HorizonProfile(
            np.empty(0), np.empty(0), np.empty(0), np.empty(0, dtype=np.int8), hs, obs.digest(),
            terrain.identity).cache_key(), stack.horizon_dir)
        horizon_cached = prof is not None
    if prof is None:
        prof = compute_horizon(obs, terrain, hs)
        if stack.horizon_dir is not None:
            horizon_store.save(prof, stack.horizon_dir)
    timing["horizon_s"] = time.time() - t0
    timing["horizon_cached"] = 1.0 if horizon_cached else 0.0
    sectors = prof.sector_summary()
    if sectors["coverage_limited"] or sectors["unsupported"]:
        warnings.append("DEM_COVERAGE_INCOMPLETE")

    # -- geometry ---------------------------------------------------------------------------
    grid = _grid(cfg.start_utc, cfg.step_s, T)
    t_nodes = np.arange(len(grid)) * float(cfg.step_s)
    geo, splines, deltas = {}, {}, {}
    t0 = time.time()
    for tgt in TARGETS:
        s = stack.geometry.series(obs, tgt, grid)
        sp = DirectionSpline(t_nodes, s.az_deg, s.el_deg)
        info = {"provider": s.provider, "signature_version": s.signature_version,
                "raw_sha256": s.raw_sha256, "retrieved_utc": s.retrieved_utc,
                "correction_mode": s.correction_mode, "time_scale": s.time_scale,
                "request": s.request, "warnings": list(s.warnings), "header": s.header,
                "samples": len(s), "step_s": cfg.step_s}
        warnings += [f"{w}" for w in s.warnings]
        if cfg.holdout_s:
            fine = _grid(cfg.start_utc, 60, cfg.holdout_s)
            truth = stack.geometry.series(obs, tgt, fine)
            ho = holdout_error_deg(sp, np.arange(len(fine)) * 60.0, truth.az_deg, truth.el_deg)
            deltas[tgt] = max(HOLDOUT_SAFETY * ho.max_deg, DELTA_FLOOR_DEG)
            info["holdout"] = {"window_s": cfg.holdout_s, "truth_step_s": 60, "n": ho.n,
                               "max_deg": ho.max_deg, "rms_deg": ho.rms_deg,
                               "truth_raw_sha256": truth.raw_sha256}
        else:
            deltas[tgt] = 1e-5
            info["holdout"] = None
            warnings.append("INTERPOLATION_ERROR_ASSUMED")
        info["delta_geom_used_deg"] = deltas[tgt]
        info["series"] = {"step_s": cfg.step_s, "az_deg": [round(float(x), 9) for x in s.az_deg],
                          "el_deg": [round(float(x), 9) for x in s.el_deg]}
        if with_reference and stack.reference is not None:
            ref = stack.reference.series(obs, tgt, grid)
            r = geometry_residuals(s, ref)
            info["reference_agreement"] = {**r.summary(), "tolerance_arcsec": REFERENCE_TOLERANCE_ARCSEC,
                                           "within_tolerance": r.within(REFERENCE_TOLERANCE_ARCSEC),
                                           "reference_request_sha256": ref.raw_sha256}
            if not r.within(REFERENCE_TOLERANCE_ARCSEC):
                warnings.append("GEOMETRY_REFERENCE_MISMATCH")
        geo[tgt], splines[tgt] = info, sp
    timing["geometry_s"] = time.time() - t0

    # -- events, intervals, metrics ------------------------------------------------------------
    t0 = time.time()
    results: dict = {}
    outcomes: dict = {}
    for tgt in TARGETS:
        results[tgt] = {}
        settings = Settings(eps=cfg.eps_deg, tau=cfg.tau_s, w_min=cfg.w_min_s,
                            max_evals=cfg.max_evals, delta=deltas[tgt])
        for horizon_name, profile in (("terrain", prof), ("flat", None)):
            model = TerrainClearanceModel(splines[tgt], profile, margin_deg=cfg.clearance_margin_deg)
            part = build_partition(model, 0.0, float(T), float(cfg.step_s), settings)
            m = summarize(part.intervals, 0.0, float(T), cfg.thresholds()[tgt])
            evs = []
            for e in part.events:
                rate = model.rate(e.t)
                bound = None if rate is None else geometry_timing_bound_s(deltas[tgt], rate)
                evs.append({"t_s": e.t, "t_utc": _iso(cfg.start_utc, e.t), "type": e.type,
                            "solver_bracket_s": e.solver_bracket_s,
                            "geometry_timing_bound_s": bound,
                            "clearance_rate_deg_per_s": rate,
                            "quality": "normal" if bound is not None else "near_tangent",
                            "horizon": horizon_name})
            if profile is None:
                clr = np.asarray(geo[tgt]["series"]["el_deg"]) - cfg.clearance_margin_deg
            else:
                clr = (np.asarray(geo[tgt]["series"]["el_deg"])
                       - profile.lookup(np.asarray(geo[tgt]["series"]["az_deg"])) - cfg.clearance_margin_deg)
            finite = clr[np.isfinite(clr)]
            clearance = None if finite.size == 0 else {
                "min_deg": float(finite.min()), "median_deg": float(np.median(finite)),
                "max_deg": float(finite.max()), "samples": int(finite.size),
                "note": "target elevation minus skyline at the 10-minute nodes; negative = below the skyline"}
            results[tgt][horizon_name] = {
                "clearance_at_nodes": clearance,
                "metrics": m.to_dict(), "intervals": _intervals_json(part.intervals, cfg.start_utc),
                "events": evs,
                "contacts": [{**vars(c), "t_utc": _iso(cfg.start_utc, c.t_extremum),
                              "start_utc": _iso(cfg.start_utc, c.start), "end_utc": _iso(cfg.start_utc, c.end),
                              "horizon": horizon_name} for c in find_contacts(model, part)],
                "evaluations": part.evals,
                "countdown_at_start": countdown(part.intervals, part.events, 0.0, tgt)}
            if horizon_name == "terrain":
                outcomes[tgt] = m.outcome
    timing["events_s"] = time.time() - t0

    # -- disc size: the centre-only assumption, bracketed by the upper limb and the whole disc (S-2)
    t0 = time.time()
    disk_edge = disk_edge_sensitivity(
        splines, prof, base_margin_deg=cfg.clearance_margin_deg, duration_s=T, step_s=cfg.step_s,
        thresholds=cfg.thresholds(),
        settings={t: Settings(eps=cfg.eps_deg, tau=cfg.tau_s, w_min=cfg.w_min_s, max_evals=cfg.max_evals,
                              delta=deltas[t]) for t in TARGETS},
        centre={t: results[t]["terrain"]["metrics"] for t in TARGETS})
    timing["disk_edge_s"] = time.time() - t0
    status = site_summary(outcomes)

    # -- state, identity ----------------------------------------------------------------------
    synthetic = stack.synthetic
    state = ResultState.SYNTHETIC if synthetic else ResultState.REAL_UNVERIFIED
    warnings.append("DEMONSTRATION_DATA" if synthetic else "UNVERIFIED")
    warnings = sorted(set(warnings))
    algorithm_id = f"lunascope-science/{ALGORITHM_VERSION}"
    request = {"site": dataclasses.asdict(site),
               "mission": {"start_utc": cfg.start_utc.strftime("%Y-%m-%dT%H:%M:%SZ"),
                           "duration_s": T, "step_s": cfg.step_s},
               "requirements": cfg.thresholds(), "targets": list(TARGETS)}
    effective = {**cfg.effective_settings(), "geometry_provider": getattr(stack.geometry, "identity", {}),
                 "interpolation": "cubic_hermite_enu_vectors", "horizon_algorithm": prof.algorithm,
                 "event_algorithm": ALGORITHM_VERSION}
    terrain_sha = terrain.identity.get("sha256") or hash_of(terrain.identity)
    resources = [{"role": "dem", "sha256": terrain_sha}, *stack.extra_resources]
    run_id = make_run_id(request, effective, resources, algorithm_id)
    manifest_in = {
        "geometry_responses": sorted(g["raw_sha256"] for g in geo.values())
        + sorted(g["holdout"]["truth_raw_sha256"] for g in geo.values() if g["holdout"]),
        "horizon_profile": prof.cache_key(), "terrain_identity": terrain.identity}
    core = {"targets": results, "site_status": status.value}
    result_id = make_result_id(run_id, manifest_in, [hash_of(_clean(core))])

    bundle = {
        "schema": "lunascope.site_run/1", "result_state": state.value, "validated_scopes": [],
        "verified": False, "run_id": run_id, "result_id": result_id, "algorithm_id": algorithm_id,
        "site_status": status.value, "request": request, "effective_settings": effective,
        "resources": resources, "observer": obs.to_dict(),
        "horizon": {
            "settings": hs.to_dict(), "cache_key": prof.cache_key(), "sectors": sectors,
            "payload_sha256": horizon_payload_sha256(prof.azimuth_deg, prof.horizon_el_deg,
                                                     prof.argmax_distance_km,
                                                     [STATE_NAMES[int(s)] for s in prof.sector_state]),
            "azimuth_deg": prof.azimuth_deg, "horizon_el_deg": prof.horizon_el_deg,
            "argmax_distance_km": prof.argmax_distance_km,
            "sector_state": [STATE_NAMES[int(s)] for s in prof.sector_state],
            "skyline_min_deg": float(np.nanmin(prof.horizon_el_deg)),
            "skyline_max_deg": float(np.nanmax(prof.horizon_el_deg)),
            "terrain_identity": terrain.identity},
        "geometry": geo, "targets": results, "disk_edge": disk_edge,
        "warnings": warnings, "timing_s": {**timing, "total_s": time.time() - t_all},
        "caveats": [
            "Screening and education only; not a landing-safety, power, link or feasibility result.",
            "Centre-of-disk visibility; no refraction (no atmosphere); finite horizon radius.",
            "No validation gate has closed: terrain horizon, DEM suitability and convergence are unreviewed.",
        ]}
    return _clean(bundle)


# ----------------------------------------------------------------------------- sensitivity
def _key_numbers(res: dict) -> dict:
    out = {}
    for tgt in TARGETS:
        t = res["targets"][tgt]["terrain"]
        m = t["metrics"]
        out[tgt] = {"lower": m["availability_lower"], "upper": m["availability_upper"],
                    "outcome": m["outcome"], "longest_hidden_s": m["longest_known_hidden_s"],
                    "events": [e["t_s"] for e in t["events"]]}
    return out


def compare_runs(base: dict, other: dict, label: str) -> dict:
    a, b = _key_numbers(base), _key_numbers(other)
    per, high = {}, False
    for tgt in TARGETS:
        dl = b[tgt]["lower"] - a[tgt]["lower"]
        du = b[tgt]["upper"] - a[tgt]["upper"]
        same_events = len(a[tgt]["events"]) == len(b[tgt]["events"])
        shifts = [abs(x - y) for x, y in zip(a[tgt]["events"], b[tgt]["events"], strict=False)]
        flip = a[tgt]["outcome"] != b[tgt]["outcome"]
        big = abs(dl) > SENSITIVITY_AVAILABILITY_TOL or abs(du) > SENSITIVITY_AVAILABILITY_TOL
        per[tgt] = {"delta_lower": dl, "delta_upper": du, "outcome_base": a[tgt]["outcome"],
                    "outcome_variant": b[tgt]["outcome"], "outcome_changed": flip,
                    "event_count_base": len(a[tgt]["events"]),
                    "event_count_variant": len(b[tgt]["events"]),
                    "max_event_shift_s": max(shifts) if shifts else 0.0,
                    "events_same_count": same_events,
                    "longest_hidden_delta_s": b[tgt]["longest_hidden_s"] - a[tgt]["longest_hidden_s"]}
        high = high or flip or big or not same_events
    return {"variant": label, "sensitivity_high": high,
            "tolerance_availability": SENSITIVITY_AVAILABILITY_TOL, "targets": per,
            "variant_run_id": other["run_id"], "variant_result_id": other["result_id"]}


def run_with_sensitivity(site: SiteSpec, cfg: RunConfig, stack: Stack,
                         alt_terrain_factory: Callable | None = None) -> dict:
    base = run_site(site, cfg, stack)
    variants = [("azimuth_step_halved",
                 run_site(site, dataclasses.replace(cfg, az_step_deg=cfg.az_step_deg / 2), stack,
                          with_reference=False))]
    if alt_terrain_factory is not None:
        variants.append(("alternate_dem_release",
                         run_site(site, cfg, stack.replace(terrain_factory=alt_terrain_factory),
                                  with_reference=False)))
    comps = [compare_runs(base, v, name) for name, v in variants]
    base["sensitivity"] = comps
    if any(c["sensitivity_high"] for c in comps):
        base["warnings"] = sorted({*base["warnings"], "SENSITIVITY_HIGH"})
    return base


def save_bundle(bundle: dict, directory: Path) -> Path:
    directory = Path(directory)
    directory.mkdir(parents=True, exist_ok=True)
    raw = canonical_bytes(bundle)
    path = directory / f"{bundle['run_id'][:16]}_{sha256_hex(raw)[:12]}.json"
    path.write_bytes(raw)
    return path

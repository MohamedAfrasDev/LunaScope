"""Reference runs (GR-001 and later): readiness, convergence and the freeze rule (spec 13, impl. 14.2/14.3).

readiness(analysis)
    End-to-end readiness of a stored result (test case 13). Nothing is trusted because it was stored:
    the skyline digest is recomputed, the skyline is checked against its own summary (and against
    the precomputed horizon file when one is given), and the terrain-aware and flat events,
    intervals and metrics are RE-DERIVED from the stored angle series and stored skyline. A corrupted
    horizon with correct geometry therefore fails, even when its digest is missing.

convergence_report(site, cfg, stack)
    Re-runs one site with one setting changed at a time (time step, azimuth step, horizon radius)
    and compares each with the base run. Any outcome flip, event-count change or availability move
    beyond tolerance marks that case SENSITIVITY_HIGH.

Freeze rule
    A reference definition (data/reference/GR-xxx.json) is frozen by pinning its run_id. Any later
    change to provider settings, observer conventions, DEM identity, horizon parameters or event
    policy changes the run_id, and `check_freeze` says to create the next GR version instead.
"""

from __future__ import annotations

import dataclasses
import json
import math
from itertools import pairwise
from pathlib import Path

import numpy as np

from . import horizon_store
from .api_models import AnalysisRequest, canonical_request, resolve_sites
from .clearance import TerrainClearanceModel
from .events import Settings, build_partition
from .horizon import STATE_NAMES, HorizonProfile, HorizonSettings
from .metrics import summarize
from .pipeline import (
    TARGETS,
    RunConfig,
    SiteSpec,
    Stack,
    compare_runs,
    horizon_payload_sha256,
    run_site,
)
from .providers.geometry.interpolate import DirectionSpline

REPO = Path(__file__).resolve().parents[2]
REFERENCE_DIR = REPO / "data" / "reference"

AVAILABILITY_TOL = 1e-6  # re-derived vs stored: only float noise from the 1e-9 deg series rounding
EVENT_TOL_S = 1.0  # one root tolerance
CLEARANCE_TOL_DEG = 1e-6
_STATE_CODE = {v: k for k, v in STATE_NAMES.items()}


# ----------------------------------------------------------------------------- readiness
def _check(site_id: str, check: str, ok: bool | None, detail: str) -> dict:
    status = "pass" if ok else "not_recorded" if ok is None else "fail"
    return {"site_id": site_id, "check": check, "status": status, "detail": detail}


def _profile(h: dict) -> HorizonProfile:
    el = np.array([np.nan if x is None else x for x in h["horizon_el_deg"]], dtype=float)
    dist = np.array([np.nan if x is None else x for x in h["argmax_distance_km"]], dtype=float)
    return HorizonProfile(np.asarray(h["azimuth_deg"], dtype=float), el, dist,
                          np.array([_STATE_CODE[s] for s in h["sector_state"]], dtype=np.int8),
                          HorizonSettings(**h["settings"]), "", h["terrain_identity"])


def _horizon_checks(sid: str, h: dict, horizon_dir: Path | None) -> list[dict]:
    out = []
    rec = h.get("payload_sha256")
    got = horizon_payload_sha256(h["azimuth_deg"], h["horizon_el_deg"], h["argmax_distance_km"], h["sector_state"])
    out.append(_check(sid, "horizon_digest", None if rec is None else rec == got,
                      "no skyline digest recorded in this bundle (written before it existed)" if rec is None
                      else "skyline matches its recorded digest" if rec == got
                      else f"skyline digest {got[:12]} differs from the recorded {rec[:12]}"))

    n = HorizonSettings(**h["settings"]).n_az()
    shape_ok = len(h["azimuth_deg"]) == len(h["horizon_el_deg"]) == len(h["sector_state"]) == n
    counts = {k: sum(1 for s in h["sector_state"] if s == k) for k in STATE_NAMES.values()}
    finite = [x for x in h["horizon_el_deg"] if x is not None and math.isfinite(x)]
    summary_ok = (shape_ok and counts == {k: h["sectors"].get(k, 0) for k in counts} and bool(finite)
                  and abs(min(finite) - h["skyline_min_deg"]) < 1e-12
                  and abs(max(finite) - h["skyline_max_deg"]) < 1e-12)
    out.append(_check(sid, "horizon_summary", summary_ok,
                      f"{n} bins; sector counts and skyline range agree with the stored summary" if summary_ok
                      else "the skyline disagrees with its own summary (bin count, sector counts or range)"))

    if horizon_dir is not None:
        stored = horizon_store.load(h["cache_key"], horizon_dir)
        if stored is None:
            out.append(_check(sid, "horizon_store", False, "no verified precomputed skyline under this cache key"))
        else:
            same = (np.array_equal(stored.horizon_el_deg, _profile(h).horizon_el_deg, equal_nan=True)
                    and [STATE_NAMES[int(s)] for s in stored.sector_state] == list(h["sector_state"]))
            out.append(_check(sid, "horizon_store", same,
                              "bundle skyline equals the precomputed file" if same
                              else "bundle skyline differs from the precomputed file"))
    return out


def rederive_site(bundle: dict) -> dict:
    """Recompute events, intervals and metrics for both horizons from the bundle's own series and skyline."""
    eff, req = bundle["effective_settings"], bundle["request"]
    step, duration = int(req["mission"]["step_s"]), int(req["mission"]["duration_s"])
    prof = _profile(bundle["horizon"])
    margin = float(eff["clearance_margin_deg"])
    out: dict = {}
    for tgt in TARGETS:
        g = bundle["geometry"][tgt]
        az, el = np.asarray(g["series"]["az_deg"], float), np.asarray(g["series"]["el_deg"], float)
        sp = DirectionSpline(np.arange(len(az)) * float(step), az, el)
        settings = Settings(eps=eff["eps_deg"], tau=eff["tau_s"], w_min=eff["w_min_s"],
                            max_evals=eff["max_evals"], delta=g["delta_geom_used_deg"])
        theta = req["requirements"][tgt]
        out[tgt] = {}
        for name, profile in (("terrain", prof), ("flat", None)):
            model = TerrainClearanceModel(sp, profile, margin_deg=margin)
            part = build_partition(model, 0.0, float(duration), float(step), settings)
            m = summarize(part.intervals, 0.0, float(duration), theta)
            clr = el - margin - (0.0 if profile is None else profile.lookup(az))
            finite = clr[np.isfinite(clr)]
            out[tgt][name] = {"metrics": m.to_dict(), "events": [e.t for e in part.events],
                              "intervals": len(part.intervals),
                              "clearance_min_deg": float(finite.min()) if finite.size else None}
    return out


def _compare_rederived(sid: str, bundle: dict, again: dict) -> list[dict]:
    out = []
    for tgt in TARGETS:
        for name in ("terrain", "flat"):
            s, r = bundle["targets"][tgt][name], again[tgt][name]
            sm, rm = s["metrics"], r["metrics"]
            problems = []
            if sm["outcome"] != rm["outcome"]:
                problems.append(f"outcome {sm['outcome']} re-derives as {rm['outcome']}")
            for k in ("availability_lower", "availability_upper"):
                if abs(sm[k] - rm[k]) > AVAILABILITY_TOL:
                    problems.append(f"{k} {sm[k]:.6f} re-derives as {rm[k]:.6f}")
            se = [e["t_s"] for e in s["events"]]
            if len(se) != len(r["events"]):
                problems.append(f"{len(se)} events stored, {len(r['events'])} re-derived")
            elif se and max(abs(a - b) for a, b in zip(se, r["events"], strict=True)) > EVENT_TOL_S:
                problems.append("an event time moved by more than the root tolerance")
            if len(s["intervals"]) != r["intervals"]:
                problems.append(f"{len(s['intervals'])} intervals stored, {r['intervals']} re-derived")
            cl = (s.get("clearance_at_nodes") or {}).get("min_deg")
            if (cl is None) != (r["clearance_min_deg"] is None) or (
                    cl is not None and abs(cl - r["clearance_min_deg"]) > CLEARANCE_TOL_DEG):
                problems.append("clearance at the nodes does not re-derive")
            out.append(_check(sid, f"rederived_{tgt}_{name}", not problems,
                              "events, intervals and metrics re-derive from the stored series and skyline"
                              if not problems else "; ".join(problems)))
    return out


def disk_edge_from_bundle(bundle: dict) -> dict:
    """The disc-size bracket (S-2) for a stored site bundle, from its own angle series and skyline. This is
    how real runs made before the check existed get it, with no network and no DEM. The centre readings
    are the bundle's stored terrain-aware metrics."""
    from .disk_edge import disk_edge_sensitivity
    eff, req = bundle["effective_settings"], bundle["request"]
    step, duration = int(req["mission"]["step_s"]), int(req["mission"]["duration_s"])
    splines, settings = {}, {}
    for tgt in TARGETS:
        g = bundle["geometry"][tgt]
        az, el = np.asarray(g["series"]["az_deg"], float), np.asarray(g["series"]["el_deg"], float)
        splines[tgt] = DirectionSpline(np.arange(len(az)) * float(step), az, el)
        settings[tgt] = Settings(eps=eff["eps_deg"], tau=eff["tau_s"], w_min=eff["w_min_s"],
                                 max_evals=eff["max_evals"], delta=g["delta_geom_used_deg"])
    return disk_edge_sensitivity(
        splines, _profile(bundle["horizon"]), base_margin_deg=float(eff["clearance_margin_deg"]),
        settings=settings, duration_s=duration, step_s=step, thresholds={t: req["requirements"][t] for t in TARGETS},
        centre={t: bundle["targets"][t]["terrain"]["metrics"] for t in TARGETS})


def _site_bundles(analysis: dict) -> list[dict]:
    return analysis.get("sites", [analysis])


def readiness(analysis: dict, *, horizon_dir: Path | None = None, rederive: bool = True) -> dict:
    """Readiness of a stored analysis (``lunascope.analysis/1``) or one site bundle. Ready only if
    every check passes; ``not_recorded`` counts as not ready (a reference must carry its evidence)."""
    checks: list[dict] = []
    for b in _site_bundles(analysis):
        sid = b["request"]["site"]["site_id"]
        checks += _horizon_checks(sid, b["horizon"], horizon_dir)
        n = int(b["request"]["mission"]["duration_s"]) // int(b["request"]["mission"]["step_s"]) + 1
        geo_ok = all(len(b["geometry"][t]["series"]["az_deg"]) == len(b["geometry"][t]["series"]["el_deg"]) == n
                     and all(x is not None for x in b["geometry"][t]["series"]["el_deg"]) for t in TARGETS)
        checks.append(_check(sid, "geometry_series", geo_ok,
                             f"{n} finite samples per target" if geo_ok else "angle series length or values are wrong"))
        if rederive and geo_ok:
            checks += _compare_rederived(sid, b, rederive_site(b))
    failing = [c for c in checks if c["status"] != "pass"]
    return {"ready": not failing, "checks": checks, "failing": failing,
            "note": "Readiness means the stored result is internally consistent and re-derives. "
                    "It is not a validation of the science."}


# ----------------------------------------------------------------------------- Gate 2
GATES = ("geometry", "horizon", "aggregation", "event_search", "convergence")
TILING_TOL_S = 1e-6


def _g(gate: str, status: str, detail: str, failing: list[str] | None = None) -> dict:
    return {"gate": gate, "status": status, "detail": detail, "failing": failing or []}


def _geometry_gate(bundles: list[dict]) -> dict:
    bad, missing, worst = [], [], 0.0
    for b in bundles:
        sid = b["request"]["site"]["site_id"]
        for tgt in TARGETS:
            g = b["geometry"][tgt]
            ra, h = g.get("reference_agreement"), g.get("holdout")
            if ra is None:
                missing.append(f"{sid}/{tgt}: no independent SPICE reference")
            else:
                worst = max(worst, ra["max_total_arcsec"])
                if not ra["within_tolerance"]:
                    bad.append(f"{sid}/{tgt}: SPICE disagreement {ra['max_total_arcsec']:.4f} arcsec exceeds {ra['tolerance_arcsec']}")
            if h is None:
                missing.append(f"{sid}/{tgt}: no interpolation holdout")
            elif h["max_deg"] > g["delta_geom_used_deg"]:
                bad.append(f"{sid}/{tgt}: interpolation holdout {h['max_deg']:.2e} deg exceeds the {g['delta_geom_used_deg']:.0e} deg allowance")
        if "GEOMETRY_REFERENCE_MISMATCH" in b.get("warnings", []):
            bad.append(f"{sid}: GEOMETRY_REFERENCE_MISMATCH warning")
    if bad:
        return _g("geometry", "fail", f"{len(bad)} geometry check(s) failed", bad)
    if missing:
        return _g("geometry", "not_evaluated", f"{len(missing)} geometry check(s) were not run", missing)
    return _g("geometry", "pass", f"SPICE agrees with the provider to {worst:.4f} arcsec at most, and interpolation is inside its allowance, for every site and target")


def _horizon_gate(bundles: list[dict], horizon_dir: Path | None) -> dict:
    bad = []
    for b in bundles:
        sid = b["request"]["site"]["site_id"]
        bad += [f"{sid}: {c['check']} {c['status']}: {c['detail']}" for c in _horizon_checks(sid, b["horizon"], horizon_dir)
                if c["status"] != "pass"]
        sec = b["horizon"]["sectors"]
        total = sum(sec.values())
        if total == 0 or sec.get("certified", 0) != total:
            bad.append(f"{sid}: only {sec.get('certified', 0)} of {total} skyline sectors are certified")
    if bad:
        return _g("horizon", "fail", f"{len(bad)} skyline check(s) failed", bad)
    return _g("horizon", "pass", "every skyline has its recorded digest, agrees with its own summary, and has every sector certified")


def _aggregation_gate(bundles: list[dict]) -> dict:
    bad = []
    for b in bundles:
        sid = b["request"]["site"]["site_id"]
        duration = float(b["request"]["mission"]["duration_s"])
        bad += [f"{sid}: {c['check']}: {c['detail']}" for c in _compare_rederived(sid, b, rederive_site(b)) if c["status"] != "pass"]
        for tgt in TARGETS:
            for name in ("terrain", "flat"):
                blk = b["targets"][tgt][name]
                ivs, m = blk["intervals"], blk["metrics"]
                where = f"{sid}/{tgt}/{name}"
                if not ivs or abs(ivs[0]["start_s"]) > TILING_TOL_S or abs(ivs[-1]["end_s"] - duration) > TILING_TOL_S:
                    bad.append(f"{where}: intervals do not span the whole window")
                bad += [f"{where}: gap or overlap at {x['end_s']:.1f} s" for x, y in pairwise(ivs)
                        if abs(y["start_s"] - x["end_s"]) > TILING_TOL_S]
                total = m["visible_s"] + m["hidden_s"] + m["unknown_s"]
                if abs(total - m["total_s"]) > 1e-3:
                    bad.append(f"{where}: visible + hidden + unknown = {total:.3f} s, not the window {m['total_s']:.3f} s")
                if abs(m["availability_lower"] - m["visible_s"] / m["total_s"]) > 1e-9:
                    bad.append(f"{where}: lower availability is not visible time over the window")
                if abs(m["availability_upper"] - (m["visible_s"] + m["unknown_s"]) / m["total_s"]) > 1e-9:
                    bad.append(f"{where}: upper availability is not (visible + unknown) over the window")
                if m["availability_lower"] > m["availability_upper"] + 1e-12:
                    bad.append(f"{where}: lower bound exceeds upper bound")
    if bad:
        return _g("aggregation", "fail", f"{len(bad)} aggregation check(s) failed", bad)
    return _g("aggregation", "pass", "intervals tile the window, V + H + U + X + G equals it, the bounds follow from the intervals, and every result re-derives from the stored series and skyline")


def _event_search_gate(bundles: list[dict]) -> dict:
    bad, events, tangent = [], 0, 0
    for b in bundles:
        sid = b["request"]["site"]["site_id"]
        tau = float(b["effective_settings"]["tau_s"])
        for tgt in TARGETS:
            for name in ("terrain", "flat"):
                blk = b["targets"][tgt][name]
                where = f"{sid}/{tgt}/{name}"
                unc = [i for i in blk["intervals"] if i["class"] in ("X", "G")]
                if unc:
                    bad.append(f"{where}: {len(unc)} interval(s) the event search could not certify or that lack data (classes X or G)")
                for e in blk["events"]:
                    events += 1
                    tangent += e.get("quality") == "near_tangent"
                    if e["solver_bracket_s"] > tau + 1e-9:
                        bad.append(f"{where}: event at {e['t_s']:.1f} s is bracketed to {e['solver_bracket_s']} s, wider than {tau} s")
    if bad:
        return _g("event_search", "fail", f"{len(bad)} event-search check(s) failed", bad)
    return _g("event_search", "pass", f"no interval is uncertified or missing data, and all {events} events are bracketed within the root tolerance ({tangent} are near-tangent and flagged as such)")


def _convergence_gate(bundles: list[dict]) -> dict:
    expected = {name for name, _ in CONVERGENCE_CASES}
    bad, missing = [], []
    for b in bundles:
        sid = b["request"]["site"]["site_id"]
        conv = b.get("convergence")
        if conv is None:
            missing.append(f"{sid}: no convergence report")
            continue
        done = {c["case"] for c in conv["cases"]} | {c["case"] for c in conv.get("skipped", [])}
        bad += [f"{sid}: convergence case {n} is missing" for n in sorted(expected - done)]
        bad += [f"{sid}: {c['case']} is SENSITIVITY_HIGH" for c in conv["cases"] if c["sensitivity_high"]]
    if bad:
        return _g("convergence", "fail", f"{len(bad)} convergence problem(s)", bad)
    if missing:
        return _g("convergence", "not_evaluated", "the convergence report was not run", missing)
    return _g("convergence", "pass", f"all {len(expected)} cases (time step, azimuth step, radius) ran at every site and none is flagged SENSITIVITY_HIGH")


def gate_report(bundles: list[dict], *, horizon_dir: Path | None = None) -> dict:
    """Gate 2's "GR-001 passes geometry, horizon, aggregation, event-search and convergence checks" as five
    named checks over the SAVED site bundles. A check is `pass` only if it ran and held; `not_evaluated`
    and `fail` both keep the gate shut. Passing says the run is internally sound, converged and checked
    against SPICE; it does not validate the science."""
    bundles = list(bundles)
    gates = [_geometry_gate(bundles), _horizon_gate(bundles, horizon_dir), _aggregation_gate(bundles),
             _event_search_gate(bundles), _convergence_gate(bundles)]
    return {"passes": all(g["status"] == "pass" for g in gates), "gates": gates,
            "failing": [g["gate"] for g in gates if g["status"] != "pass"],
            "note": "Passing means the run is internally consistent, converged and checked against SPICE. It is not a validation of the science."}


# ----------------------------------------------------------------------------- convergence
CONVERGENCE_CASES = (
    ("step_60s", {"step_s": 60}),
    ("azimuth_0.5deg", {"az_step_deg": 0.5}),
    ("azimuth_0.25deg", {"az_step_deg": 0.25}),
    ("radius_100km", {"radius_km": 100.0}),
    ("radius_200km", {"radius_km": 200.0}),
)
NOT_APPLICABLE = ({"case": "dem_near_field_on_off",
                   "reason": "no multi-resolution near/far merge exists yet (phase plan 1.6), so there is nothing to switch"},)


def convergence_report(site: SiteSpec, cfg: RunConfig, stack: Stack, *, base: dict | None = None,
                       cases=CONVERGENCE_CASES) -> dict:
    """One-at-a-time setting changes against the base run (spec 14.3). Values equal to the base
    setting are skipped and listed, so the report never compares a run with itself."""
    base = base or run_site(site, cfg, stack)
    rows, skipped = [], []
    for name, change in cases:
        if all(getattr(cfg, k) == v for k, v in change.items()):
            skipped.append({"case": name, "reason": "equals the base setting"})
            continue
        variant = run_site(site, dataclasses.replace(cfg, **change), stack, with_reference=False)
        c = compare_runs(base, variant, name)
        rows.append({"case": name, "changed": change, **c})
    return {"site_id": site.site_id, "base_run_id": base["run_id"], "base_result_id": base["result_id"],
            "base_settings": {k: getattr(cfg, k) for k in ("step_s", "az_step_deg", "radius_km")},
            "cases": rows, "skipped": skipped, "not_applicable": list(NOT_APPLICABLE),
            "sensitivity_high": [r["case"] for r in rows if r["sensitivity_high"]],
            "converged": not any(r["sensitivity_high"] for r in rows)}


def apply_convergence(bundle: dict, report: dict) -> dict:
    """Attach the report to the base bundle and add SENSITIVITY_HIGH if any case is unstable."""
    bundle["convergence"] = report
    if report["sensitivity_high"]:
        bundle["warnings"] = sorted({*bundle["warnings"], "SENSITIVITY_HIGH"})
    return bundle


# ----------------------------------------------------------------------------- freeze rule
class FreezeViolation(Exception):
    pass


def load_definition(ref_id: str, directory: Path = REFERENCE_DIR) -> dict:
    if not ref_id.startswith("GR-") or not ref_id[3:].isdigit():
        raise ValueError("reference ids look like GR-001")
    return json.loads((Path(directory) / f"{ref_id}.json").read_text(encoding="utf-8"))


def definition_request(defn: dict) -> AnalysisRequest:
    return AnalysisRequest.model_validate_json(json.dumps(defn["request"]))


def definition_run_id(defn: dict, cfg) -> str:
    """run_id the definition would get on the given service stack (live for a real reference)."""
    from .stacks import identity_from_canonical
    req = definition_request(defn)
    return identity_from_canonical(canonical_request(req, resolve_sites(req)), cfg).run_id


def check_freeze(defn: dict, cfg) -> dict:
    """Frozen definitions must still produce their pinned run_id. Draft ones report what they would get."""
    rid = definition_run_id(defn, cfg)
    pin = defn.get("frozen", {}).get("run_id") if defn.get("frozen") else None
    if pin is None:
        return {"reference_id": defn["reference_id"], "frozen": False, "run_id": rid}
    if rid != pin:
        nxt = f"GR-{int(defn['reference_id'][3:]) + 1:03d}"
        raise FreezeViolation(
            f"{defn['reference_id']} is frozen at run_id {pin[:16]}... but its inputs now give {rid[:16]}...: "
            f"a scientific input changed (provider settings, observer convention, DEM identity, horizon "
            f"parameters, event policy or algorithm). Do not edit {defn['reference_id']}; create {nxt}.")
    return {"reference_id": defn["reference_id"], "frozen": True, "run_id": rid}

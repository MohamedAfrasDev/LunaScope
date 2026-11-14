"""Server-side comparison (FR-08, spec 11.4). All comparison logic lives here, never in the browser.

Two modes:
  * sites inside one run: identical inputs by construction, so the held-constant list is shown
    and the differences are per site;
  * two runs (baseline vs variant): compatibility is checked, held and changed fields are listed,
    and an explicit alignment mode decides how time is paired:
      "elapsed"  each run keeps its own UTC; the same elapsed time is compared;
      "calendar" the runs share one UTC axis; only the overlap is compared and time outside a
                 run's own window is never counted.

There is no winner, rank or score anywhere in these results (spec rule 3). Facts are typed
records that a fixed template turns into text; nothing here is free-form wording.
"""

from __future__ import annotations

from datetime import UTC, datetime
from itertools import pairwise

from .errors import INVALID_INPUT, LunaScopeError
from .requirements import requirement_outcome

INCOMPATIBLE_RUNS = "INCOMPATIBLE_RUNS"
TARGETS = ("sun_center", "earth_center")
HORIZONS = ("terrain", "flat")

EQUAL_AVAILABILITY = 0.01  # "about the same availability": within one percentage point
OUTAGE_DIFFERENCE_S = 3600.0  # and a longest outage that differs by at least an hour...
OUTAGE_DIFFERENCE_FRACTION = 0.2  # ...and by at least 20% of the longer one
MAX_CHANGED_INTERVALS = 200


def _parse(ts: str) -> datetime:
    return datetime.fromisoformat(ts).astimezone(UTC)


def _site(analysis: dict, site_id: str) -> dict:
    for s in analysis["sites"]:
        if s["request"]["site"]["site_id"] == site_id:
            return s
    raise LunaScopeError(INVALID_INPUT, f"no site {site_id!r} in run {analysis['run_id'][:12]}", field="sites")


# ----------------------------------------------------------------------------- shared pieces
def _metric_row(block: dict) -> dict:
    m = block["metrics"]
    return {"outcome": m["outcome"], "availability_lower": m["availability_lower"],
            "availability_upper": m["availability_upper"], "margin_lower": m["margin_lower"],
            "margin_upper": m["margin_upper"], "longest_known_hidden_s": m["longest_known_hidden_s"],
            "worst_case_not_visible_s": m["worst_case_not_visible_s"], "events": len(block["events"]),
            "exclusion_reasons": m["exclusion_reasons"]}


def _inputs(analysis: dict) -> dict:
    """The inputs a reviewer would hold constant, flattened to name -> value."""
    r, eff = analysis["request"], analysis["effective_settings"]
    out = {
        "mission.start_utc": r["mission"]["start_utc"], "mission.duration_s": r["mission"]["duration_s"],
        "mission.step_s": r["mission"]["step_s"],
        "requirements.sun_min_availability": r["requirements"]["sun_min_availability"],
        "requirements.earth_min_availability": r["requirements"]["earth_min_availability"],
        "terrain.dem_profile": r["terrain"]["dem_profile"], "terrain.radius_km": r["terrain"]["radius_km"],
        "terrain.az_step_deg": r["terrain"]["az_step_deg"],
        "terrain.observer_height_m": r["terrain"]["observer_height_m"],
        "terrain.clearance_margin_deg": r["terrain"]["clearance_margin_deg"],
        "algorithm_id": analysis["algorithm_id"], "geometry_provider": eff["geometry_provider"].get("name"),
        "interpolation": eff["interpolation"], "horizon_algorithm": eff["horizon_algorithm"],
        "stack_kind": eff["stack_kind"],
    }
    for res in analysis["resources"]:
        out[f"resource.{res['role']}"] = res["sha256"]
    return out


def window_metrics(intervals: list[dict], lo: float, hi: float) -> dict:
    """Recompute V/H/U inside [lo, hi] elapsed seconds from the stored classified intervals."""
    t = {"V": 0.0, "H": 0.0, "U": 0.0}
    for iv in intervals:
        a, b = max(iv["start_s"], lo), min(iv["end_s"], hi)
        if b > a:
            t["V" if iv["class"] == "V" else "H" if iv["class"] == "H" else "U"] += b - a
    total = hi - lo
    return {"visible_s": t["V"], "hidden_s": t["H"], "unknown_s": t["U"], "window_s": total,
            "availability_lower": t["V"] / total, "availability_upper": (t["V"] + t["U"]) / total}


def diff_intervals(a: list[dict], b: list[dict], b_shift: float, lo: float, hi: float) -> list[dict]:
    """Segments of [lo, hi] (a's elapsed seconds) where the classified state differs.
    b's elapsed times are shifted by `b_shift` seconds (b_start - a_start) to land on a's axis."""
    cuts = sorted({lo, hi, *(x for iv in a for x in (iv["start_s"], iv["end_s"]) if lo < x < hi),
                   *(x for iv in b for x in (iv["start_s"] + b_shift, iv["end_s"] + b_shift) if lo < x < hi)})

    def cls(ivs: list[dict], t: float, shift: float) -> str:
        for iv in ivs:
            if iv["start_s"] + shift <= t < iv["end_s"] + shift:
                return iv["class"]
        return "?"

    out: list[dict] = []
    for x0, x1 in pairwise(cuts):
        mid = (x0 + x1) / 2
        ca, cb = cls(a, mid, 0.0), cls(b, mid, b_shift)
        if ca != cb:
            if out and out[-1]["a"] == ca and out[-1]["b"] == cb and abs(out[-1]["end_s"] - x0) < 1e-6:
                out[-1]["end_s"] = x1
            else:
                out.append({"start_s": x0, "end_s": x1, "a": ca, "b": cb})
    return out


# ----------------------------------------------------------------------------- sites in one run
def compare_sites(analysis: dict, site_ids: list[str] | None) -> dict:
    ids = site_ids or [s["request"]["site"]["site_id"] for s in analysis["sites"]]
    if len(ids) < 2:
        raise LunaScopeError(INVALID_INPUT, "choose at least two sites to compare", field="sites")
    if len(set(ids)) != len(ids):
        raise LunaScopeError(INVALID_INPUT, "duplicate sites", field="sites")
    sites = [_site(analysis, i) for i in ids]
    inputs = _inputs(analysis)

    per_target: dict = {}
    for t in TARGETS:
        rows = []
        for s in sites:
            rows.append({"site_id": s["request"]["site"]["site_id"],
                         **{h: _metric_row(s["targets"][t][h]) for h in HORIZONS}})
        lows = [r["terrain"]["availability_lower"] for r in rows]
        per_target[t] = {"sites": rows, "spread": {
            "availability_lower_min": min(lows), "availability_lower_max": max(lows),
            "availability_lower_range": max(lows) - min(lows)}}

    return {
        "mode": "sites_in_run", "run_id": analysis["run_id"], "result_state": analysis["result_state"],
        "compatible": True, "alignment": "single shared simulation time",
        "held_constant": [{"field": k, "value": v} for k, v in inputs.items()],
        "changed": [{"field": "site", "values": [{"site_id": s["request"]["site"]["site_id"],
                                                  "lat_deg": s["request"]["site"]["lat_deg"],
                                                  "lon_east_deg": s["request"]["site"]["lon_east_deg"],
                                                  "ground_height_m": s["observer"]["ground_height_m"]}
                                                 for s in sites]}],
        "site_status": {s["request"]["site"]["site_id"]: s["site_status"] for s in sites},
        "targets": per_target, "facts": site_facts(ids, per_target),
        "caveats": sorted({c for s in sites for c in s["caveats"]}),
        "warnings": analysis["warnings"], "validated_scopes": analysis["validated_scopes"],
        "verified": analysis["verified"],
    }


def site_facts(ids: list[str], per_target: dict) -> list[dict]:
    facts: list[dict] = []
    for t, block in per_target.items():
        rows = block["sites"]
        for r in rows:
            f, tr = r["flat"]["outcome"], r["terrain"]["outcome"]
            if f != tr:
                facts.append({"fact": "terrain_changes_outcome", "site_id": r["site_id"], "target": t,
                              "flat_outcome": f, "terrain_outcome": tr,
                              "flat_availability_lower": r["flat"]["availability_lower"],
                              "terrain_availability_lower": r["terrain"]["availability_lower"]})
        outcomes = {r["site_id"]: r["terrain"]["outcome"] for r in rows}
        facts.append({"fact": "outcomes_differ" if len(set(outcomes.values())) > 1 else "outcomes_same",
                      "target": t, "outcomes": outcomes})
        for i in range(len(rows)):
            for j in range(i + 1, len(rows)):
                a, b = rows[i]["terrain"], rows[j]["terrain"]
                la, lb = a["longest_known_hidden_s"], b["longest_known_hidden_s"]
                if (abs(a["availability_lower"] - b["availability_lower"]) <= EQUAL_AVAILABILITY
                        and abs(la - lb) >= max(OUTAGE_DIFFERENCE_S, OUTAGE_DIFFERENCE_FRACTION * max(la, lb))):
                    facts.append({"fact": "equal_availability_different_outage", "target": t,
                                  "sites": [rows[i]["site_id"], rows[j]["site_id"]],
                                  "availability_lower": [a["availability_lower"], b["availability_lower"]],
                                  "longest_known_hidden_s": [la, lb]})
        if any(r["terrain"]["availability_upper"] - r["terrain"]["availability_lower"] >= 0.01 for r in rows):
            facts.append({"fact": "unresolved_time_matters", "target": t,
                          "sites": [r["site_id"] for r in rows
                                    if r["terrain"]["availability_upper"] - r["terrain"]["availability_lower"] >= 0.01]})
    return facts


# ----------------------------------------------------------------------------- two runs
def compare_runs(a: dict, b: dict, site_ids: list[str] | None, alignment: str) -> dict:
    if alignment not in ("elapsed", "calendar"):
        raise LunaScopeError(INVALID_INPUT, "alignment must be 'elapsed' or 'calendar'", field="alignment")
    ia, ib = _inputs(a), _inputs(b)
    sa = [s["request"]["site"]["site_id"] for s in a["sites"]]
    sb = [s["request"]["site"]["site_id"] for s in b["sites"]]
    ids = site_ids or [x for x in sa if x in sb]
    reasons = []
    if not ids or any(x not in sa or x not in sb for x in ids):
        reasons.append("the runs do not share the requested sites")
    for k in ("mission.duration_s", "mission.step_s", "requirements.sun_min_availability",
              "requirements.earth_min_availability", "terrain.dem_profile", "terrain.radius_km",
              "terrain.az_step_deg", "terrain.observer_height_m", "terrain.clearance_margin_deg",
              "algorithm_id", "geometry_provider", "stack_kind"):
        if ia.get(k) != ib.get(k):
            reasons.append(f"{k} differs ({ia.get(k)!r} vs {ib.get(k)!r}); a variant keeps everything but the changed field")
    if reasons:
        raise LunaScopeError(INCOMPATIBLE_RUNS, "; ".join(reasons))

    start_a, start_b = _parse(ia["mission.start_utc"]), _parse(ib["mission.start_utc"])
    dur = float(ia["mission.duration_s"])
    shift = (start_b - start_a).total_seconds()
    if alignment == "elapsed":
        lo, hi = 0.0, dur
        lo_b, hi_b = 0.0, dur
        overlap = None
    else:
        lo, hi = max(0.0, shift), min(dur, dur + shift)  # on a's elapsed axis
        if hi - lo <= 0:
            raise LunaScopeError(INCOMPATIBLE_RUNS, "the two windows do not overlap in calendar time")
        lo_b, hi_b = lo - shift, hi - shift
        overlap = {"start_utc": (start_a.timestamp() + lo), "duration_s": hi - lo}
        overlap["start_utc"] = datetime.fromtimestamp(overlap["start_utc"], UTC).strftime("%Y-%m-%dT%H:%M:%SZ")

    changed = [{"field": k, "from": ia[k], "to": ib[k]} for k in ia if ia[k] != ib.get(k)]
    held = [{"field": k, "value": v} for k, v in ia.items() if v == ib.get(k)]

    per_site = []
    for sid in ids:
        xa, xb = _site(a, sid), _site(b, sid)
        tgt = {}
        for t in TARGETS:
            ba, bb = xa["targets"][t]["terrain"], xb["targets"][t]["terrain"]
            if alignment == "elapsed":
                ma, mb = _metric_row(ba), _metric_row(bb)
            else:
                wa = window_metrics(ba["intervals"], lo, hi)
                wb = window_metrics(bb["intervals"], lo_b, hi_b)
                theta = a["request"]["requirements"]["sun_min_availability" if t == "sun_center" else "earth_min_availability"]
                ma, mb = _window_row(ba, wa, lo, hi, theta), _window_row(bb, wb, lo_b, hi_b, theta)
            tgt[t] = {
                "a": ma, "b": mb,
                "delta": {"availability_lower": mb["availability_lower"] - ma["availability_lower"],
                          "availability_upper": mb["availability_upper"] - ma["availability_upper"],
                          "longest_known_hidden_s": mb["longest_known_hidden_s"] - ma["longest_known_hidden_s"]},
                "outcome_change": f"{ma['outcome']} to {mb['outcome']}" if ma["outcome"] != mb["outcome"] else None,
                "event_count": [len(ba["events"]), len(bb["events"])],
                "changed_intervals": diff_intervals(ba["intervals"], bb["intervals"], shift if alignment == "calendar" else 0.0, lo, hi)[:MAX_CHANGED_INTERVALS],
                "terrain_vs_flat": {"a": xa["targets"][t]["flat"]["metrics"]["outcome"],
                                    "b": xb["targets"][t]["flat"]["metrics"]["outcome"]},
            }
        per_site.append({"site_id": sid, "site_status": {"a": xa["site_status"], "b": xb["site_status"]},
                         "targets": tgt})
    return {
        "mode": "runs", "compatible": True, "alignment": alignment,
        "runs": {"a": {"run_id": a["run_id"], "start_utc": ia["mission.start_utc"]},
                 "b": {"run_id": b["run_id"], "start_utc": ib["mission.start_utc"]}},
        "shift_s": shift, "overlap": overlap, "held_constant": held, "changed": changed,
        "sites": per_site, "result_state": a["result_state"] if a["result_state"] == b["result_state"] else "mixed",
        "warnings": sorted({*a["warnings"], *b["warnings"]}), "verified": False,
        "note": ("elapsed: each run keeps its own UTC and the same elapsed time is compared" if alignment == "elapsed"
                 else "calendar: one shared UTC axis; only the overlap is compared, time outside a run's own window is never counted"),
    }


def _window_row(block: dict, w: dict, intervals_lo: float, intervals_hi: float, theta: float) -> dict:
    """Metrics restricted to a window, recomputed from the stored classified intervals."""
    row = _metric_row(block)
    lower, upper = w["availability_lower"], w["availability_upper"]
    longest = 0.0
    for iv in block["intervals"]:
        if iv["class"] == "H":
            longest = max(longest, min(iv["end_s"], intervals_hi) - max(iv["start_s"], intervals_lo))
    row.update(
        availability_lower=lower, availability_upper=upper, window_s=w["window_s"],
        longest_known_hidden_s=max(longest, 0.0), margin_lower=lower - theta, margin_upper=upper - theta,
        outcome=requirement_outcome(lower, upper, theta, block["metrics"]["exclusion_reasons"]).value)
    return row

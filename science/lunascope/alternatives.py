"""Date shifts and the alternatives search (FR-10, FR-11, spec 8.4).

admit_shift       one linked date-shift run (shared by the Time Machine and the search)
plan_search       the dates a search will test, as a deterministic search id
pump              admit the planned dates as runs in BOUNDED BATCHES, called from the runner loop
tested_dates      the "tested-dates strip": one row per date, one cell per site

A search never holds a CPU slot: it is only rows in the store plus this pump. At most BATCH of its
runs are queued or running at once, and a full queue just pauses admission until room appears, so a
15-date search can never burst against the 8-slot queue. Every date is an ordinary, immutable run
that any other request with the same inputs would attach to.

There is no hidden score. The stated objective is shown on screen and used for one thing only: to
name, per site, the passing date with the largest margin.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime, timedelta

from .api_models import SearchRange, shifted_request
from .canonical import hash_of
from .errors import LunaScopeError
from .logs import log_event
from .stacks import ServiceConfig, identity_from_canonical
from .store import QUEUE_FULL, Admission, RunStore

BATCH = 2  # runs of one search queued or running at the same time
OBJECTIVE = ("For each site and date: the smaller of the Sun margin and the Earth margin (lower availability "
             "bound minus the requirement). A date passes for a site only if both targets pass. This is shown "
             "to compare dates; it is not a score or a ranking of sites.")
IN_FLIGHT = ("queued", "running")
DONE = ("complete", "complete_with_warnings")


def admit_shift(store: RunStore, cfg: ServiceConfig, parent_run_id: str, parent_canon: dict,
                offset_s: int) -> tuple[object, Admission, dict]:
    """Admit (or attach to) the run whose request is the parent's with only the start moved, and
    link it to the parent. Returns (identity, admission, child canonical request)."""
    child = shifted_request(parent_canon, offset_s)
    ident = identity_from_canonical(child, cfg)
    adm = store.admit(
        run_id=ident.run_id, request_hash=ident.request_hash, resource_digest=ident.resource_digest,
        algorithm_id=ident.algorithm_id, request_json=ident.request_json(),
        effective_json=json.dumps({"effective": ident.effective_settings, "resources": ident.resources},
                                  sort_keys=True),
        stack_kind=cfg.stack_kind, result_state=ident.result_state)
    store.link(child_run_id=ident.run_id, parent_run_id=parent_run_id, variant_type="date_shift",
               changed_fields=["mission.start_utc"])
    return ident, adm, child


def plan_search(parent_run_id: str, rng: SearchRange) -> tuple[str, list[int]]:
    offsets = rng.offsets_s()
    return hash_of({"parent": parent_run_id, "offsets_s": offsets})[:32], offsets


def pump(store: RunStore, cfg: ServiceConfig, notify) -> int:
    """Admit pending dates of unfinished searches, at most BATCH in flight per search. Cheap enough
    to call on every runner tick. Returns how many runs it admitted."""
    admitted = 0
    for sid in store.unfinished_searches():
        s = store.get_search(sid)
        parent = store.get(s["parent_run_id"]) if s else None
        if s is None or parent is None:
            continue
        parent_canon = json.loads(parent["request_json"])
        in_flight = sum(1 for i in s["items"] if i["status"] in IN_FLIGHT)
        for item in s["items"]:
            if item["run_id"] is not None or item["offset_s"] == 0:
                continue
            if in_flight >= BATCH:
                break
            try:
                ident, adm, _ = admit_shift(store, cfg, s["parent_run_id"], parent_canon, item["offset_s"])
            except LunaScopeError as e:
                if e.code == QUEUE_FULL:
                    break  # room appears as runs finish; try again next tick
                raise
            store.assign_search_item(sid, item["offset_s"], ident.run_id)
            log_event("search_date_admitted", run_id=ident.run_id, outcome="created" if adm.created else "attached")
            if adm.created:
                notify()
                in_flight += 1
            elif adm.run["status"] in IN_FLIGHT:
                in_flight += 1
            admitted += 1
    return admitted


def _cell(analysis: dict) -> list[dict]:
    out = []
    for s in analysis["sites"]:
        t = {k: s["targets"][k]["terrain"]["metrics"] for k in ("sun_center", "earth_center")}
        margin = min(m["margin_lower"] for m in t.values())
        out.append({"site_id": s["request"]["site"]["site_id"], "site_status": s["site_status"],
                    "sun_outcome": t["sun_center"]["outcome"], "earth_outcome": t["earth_center"]["outcome"],
                    "sun_margin": t["sun_center"]["margin_lower"], "earth_margin": t["earth_center"]["margin_lower"],
                    "objective_margin": margin})
    return out


def _verdict(cells: list[dict]) -> str:
    if any(c["site_status"] == "PASS" for c in cells):
        return "pass"
    if any(c["site_status"] in ("INDETERMINATE", "UNKNOWN_COVERAGE") for c in cells):
        return "unknown"
    return "fail"


def tested_dates(store: RunStore, search_id: str) -> dict:
    """The tested-dates strip for one search: the baseline plus every planned date, with counts."""
    s = store.get_search(search_id)
    parent = store.require(s["parent_run_id"])
    parent_canon = json.loads(parent["request_json"])
    start0 = datetime.fromisoformat(parent_canon["mission"]["start_utc"]).astimezone(UTC)

    def row(offset_s: int, run_id: str | None, state: str, err: dict | None) -> dict:
        r: dict = {"offset_s": offset_s, "offset_days": offset_s / 86400, "run_id": run_id, "state": state,
                   "start_utc": (start0 + timedelta(seconds=offset_s)).strftime("%Y-%m-%dT%H:%M:%SZ"),
                   "verdict": None, "sites": [], "error": err}
        if run_id and state in DONE + ("baseline",):
            r["sites"] = _cell(store.get_analysis(run_id))
            r["verdict"] = _verdict(r["sites"])
        return r

    rows = [row(0, parent["run_id"], "baseline" if parent["status"] in DONE else parent["status"], None)]
    for it in s["items"]:
        if it["offset_s"] == 0:
            continue
        if it["run_id"] is None:
            rows.append(row(it["offset_s"], None, "pending", None))
        else:
            err = {"code": it["error_code"], "message": it["error_detail"]} if it["status"] == "failed" else None
            rows.append(row(it["offset_s"], it["run_id"], it["status"], err))
    rows.sort(key=lambda r: r["offset_s"])

    tested = [r for r in rows if r["verdict"] is not None]
    counts = {"planned": len(rows), "tested": len(tested),
              "passing": sum(r["verdict"] == "pass" for r in tested),
              "failing": sum(r["verdict"] == "fail" for r in tested),
              "unknown": sum(r["verdict"] == "unknown" for r in tested),
              "pending": sum(r["state"] in ("pending", "queued", "running") for r in rows),
              "failed_runs": sum(r["state"] == "failed" for r in rows)}
    best: dict[str, int | None] = {}
    site_ids = [c["site_id"] for r in tested for c in r["sites"]]
    for sid in dict.fromkeys(site_ids):
        cand = [(c["objective_margin"], r["offset_s"]) for r in tested for c in r["sites"]
                if c["site_id"] == sid and c["site_status"] == "PASS"]
        best[sid] = max(cand)[1] if cand else None
    return {"search_id": search_id, "parent_run_id": s["parent_run_id"], "objective": s["objective"],
            "complete": counts["pending"] == 0, "counts": counts, "dates": rows,
            "largest_margin_among_passing": best,
            "note": "A date that is still pending or failed is not counted as a pass or a fail."}

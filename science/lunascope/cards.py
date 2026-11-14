"""Validation cards (spec 5.5): what was checked, against what, and what that does and does not show.

Statuses: ``met`` / ``not_met`` / ``not_evaluated``. No card ever says "validated": a card is evidence
for one narrow claim (its ``scope``), and ``scopes_closed`` stays empty until a human closes a scope.
"""

from __future__ import annotations

import json
from pathlib import Path

from .independent_horizon import evaluate

EVIDENCE_DIR = Path(__file__).resolve().parents[2] / "data" / "validation" / "independent_skyline"


def _card(cid: str, title: str, status: str, facts: list[str], scope: str, site: str | None = None,
          target: str | None = None) -> dict:
    return {"id": cid, "title": title, "status": status, "site_id": site, "target": target,
            "facts": facts, "scope": scope}


def load_independent_evidence(payload_sha256: str | None, directory: Path | None = None) -> dict | None:
    """The recorded independent-skyline comparison for this exact skyline (by its payload digest), or None."""
    if not payload_sha256 or len(payload_sha256) != 64 or not all(c in "0123456789abcdef" for c in payload_sha256):
        return None
    p = (directory or EVIDENCE_DIR) / f"{payload_sha256}.json"
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None


def _independent_card(s: dict, sid: str, directory: Path | None = None) -> dict:
    cid, title = "independent_terrain_check", "Skyline vs an independent implementation"
    scope = "the skyline computation (traversal, sampling, geometry), not the DEM"
    h = s["horizon"]
    digest = h.get("payload_sha256")
    ev = load_independent_evidence(digest, directory)
    if ev is None:
        return _card(cid, title, "not_evaluated",
                     ["no independent comparison is on file for this exact skyline"], scope, sid)
    try:
        mismatch = (ev["subject"]["payload_sha256"] != digest
                    or ev["dem"]["sha256"] != h["terrain_identity"].get("sha256"))
        m = ev["metrics"]
        verdict = evaluate(m)  # re-derived from the metrics and the thresholds in code, never read from the file
    except (KeyError, TypeError):
        mismatch, verdict, m = True, None, {}
    if mismatch or verdict is None:
        return _card(cid, title, "not_evaluated",
                     ["the recorded comparison does not match this skyline or its DEM, so it is not used"], scope, sid)
    failed = [k for k, ok in verdict["checks"].items() if not ok]
    facts = [(f"{m['within_tolerance_fraction']:.1%} of {m['sectors_compared']} compared sectors within the physical "
              f"tolerance; worst is {m['max_tolerance_ratio']:.2f} x its tolerance"),
             (f"the ray skyline never exceeds the independent neighbour-inclusive skyline by more than "
              f"{m['ray_above_inclusive_deg']:.4f} deg; best alignment at {m['best_shift_sectors']} sectors of shift"),
             (f"{m['near_field_sectors']} of {m['sectors_total']} sectors are set within {ev['independent']['near_field_km']} km "
              "and are counted, not compared"),
             "same DEM bytes and stated grid; a check of the computation, not of the DEM"]
    if failed:
        facts.insert(0, "not met: " + ", ".join(failed))
    return _card(cid, title, "met" if verdict["met"] else "not_met", facts, scope, sid)


def site_cards(s: dict) -> list[dict]:
    sid = s["request"]["site"]["site_id"]
    out: list[dict] = []
    for tgt, g in sorted(s["geometry"].items()):
        ra = g.get("reference_agreement")
        if ra is None:
            out.append(_card("geometry_agreement", "Geometry vs independent SPICE", "not_evaluated",
                             ["no independent reference on this stack"], "Sun/Earth direction only", sid, tgt))
        else:
            out.append(_card("geometry_agreement", "Geometry vs independent SPICE",
                             "met" if ra["within_tolerance"] else "not_met",
                             [(f"max {ra['max_total_arcsec']:.4f} arcsec over {ra['n']} samples, tolerance "
                               f"{ra['tolerance_arcsec']} arcsec"), f"{ra['primary']} vs {ra['reference']}"],
                             "Sun/Earth direction only; not the terrain horizon", sid, tgt))
        h = g.get("holdout")
        if h is not None:
            used = g["delta_geom_used_deg"]
            out.append(_card("interpolation_holdout", "Interpolation vs held-out finer series",
                             "met" if h["max_deg"] <= used else "not_met",
                             [(f"max {h['max_deg']:.1e} deg against the {used:.0e} deg used in certification "
                               f"({h['n']} points at {h['truth_step_s']} s)")],
                             "interpolation error of the angle series", sid, tgt))
    sec = s["horizon"]["sectors"]
    total = sum(sec.values())
    full = total > 0 and sec.get("certified", 0) == total
    out.append(_card("horizon_certification", "Skyline sectors certified", "met" if full else "not_met",
                     [(f"{sec.get('certified', 0)} of {total} sectors certified; "
                       f"{sec.get('coverage_limited', 0)} coverage-limited, {sec.get('unsupported', 0)} unsupported")],
                     "DEM coverage within the radius; says nothing about DEM accuracy", sid))
    by_variant = {v["variant"]: v for v in s.get("sensitivity", [])}
    for variant, cid, title, scope in (
            ("azimuth_step_halved", "horizon_convergence", "Result unchanged at half the azimuth step",
             "numerical resolution of the skyline"),
            ("alternate_dem_release", "dem_release_sensitivity", "Result unchanged on the other DEM release",
             "choice between the two pinned DEM releases; not DEM accuracy")):
        v = by_variant.get(variant)
        if v is None:
            out.append(_card(cid, title, "not_evaluated", ["variant was not run"], scope, sid))
            continue
        flips = [t for t, d in v["targets"].items() if d["outcome_changed"]]
        shift = max((d["max_event_shift_s"] for d in v["targets"].values()), default=0.0)
        ok = not flips and not v["sensitivity_high"]
        out.append(_card(cid, title, "met" if ok else "not_met",
                         [("no outcome changed" if not flips else f"outcome changed for {', '.join(flips)}"),
                          f"largest event shift {shift:.0f} s"], scope, sid))
    out.append(_independent_card(s, sid))
    return out


GROUPS = (  # the three validation cards of spec 5.5 / FR-09, each a roll-up of narrow checks
    ("geometry", "Sun and Earth geometry", ("geometry_agreement", "interpolation_holdout"),
     ("Directions of the Sun and Earth centres from the provider, against an independent SPICE "
     "implementation and a finer held-out series. Says nothing about the terrain.")),
    ("terrain_horizon", "Terrain horizon", ("horizon_certification", "dem_release_sensitivity",
                                            "independent_terrain_check"),
     ("The skyline from the pinned DEM: coverage, sensitivity to the DEM release, and an independent "
     "skyline. DEM accuracy itself is not checked.")),
    ("numerical_convergence", "Numerical convergence", ("horizon_convergence",),
     ("Whether results hold at a finer azimuth step. The full step/azimuth/radius report runs with the "
     "reference run.")),
)


def _rollup(statuses: list[str]) -> str:
    """not_met if any check failed; met only if every check ran and passed; otherwise not_evaluated.
    A group with an unrun check is never shown as met."""
    if "not_met" in statuses:
        return "not_met"
    return "met" if statuses and all(s == "met" for s in statuses) else "not_evaluated"


def group_cards(cards: list[dict]) -> list[dict]:
    out = []
    for gid, title, ids, scope in GROUPS:
        members = [c for c in cards if c["id"] in ids]
        out.append({"id": gid, "title": title, "status": _rollup([c["status"] for c in members]),
                    "scope": scope, "card_ids": list(ids),
                    "counts": {k: sum(c["status"] == k for c in members) for k in ("met", "not_met", "not_evaluated")}})
    return out


def run_cards(analysis: dict) -> dict:
    cards = [c for s in analysis["sites"] for c in site_cards(s)]
    return {"run_id": analysis["run_id"], "result_state": analysis["result_state"], "cards": cards,
            "groups": group_cards(cards),
            "scopes_closed": list(analysis.get("validated_scopes", [])),
            "summary": {k: sum(c["status"] == k for c in cards) for k in ("met", "not_met", "not_evaluated")},
            "note": "A met card supports one narrow claim. It does not make the result verified."}

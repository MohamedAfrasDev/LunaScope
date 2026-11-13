"""Validation cards (spec 5.5): what was checked, against what, and what that does and does not show.

Statuses: ``met`` / ``not_met`` / ``not_evaluated``. No card ever says "validated": a card is evidence
for one narrow claim (its ``scope``), and ``scopes_closed`` stays empty until a human closes a scope.
"""

from __future__ import annotations


def _card(cid: str, title: str, status: str, facts: list[str], scope: str, site: str | None = None,
          target: str | None = None) -> dict:
    return {"id": cid, "title": title, "status": status, "site_id": site, "target": target,
            "facts": facts, "scope": scope}


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
    out.append(_card("independent_terrain_check", "Skyline vs an independent implementation", "not_evaluated",
                     ["no second horizon implementation or independent skyline exists yet"],
                     "the terrain horizon itself", sid))
    return out


def run_cards(analysis: dict) -> dict:
    cards = [c for s in analysis["sites"] for c in site_cards(s)]
    return {"run_id": analysis["run_id"], "result_state": analysis["result_state"], "cards": cards,
            "scopes_closed": list(analysis.get("validated_scopes", [])),
            "summary": {k: sum(c["status"] == k for c in cards) for k in ("met", "not_met", "not_evaluated")},
            "note": "A met card supports one narrow claim. It does not make the result verified."}

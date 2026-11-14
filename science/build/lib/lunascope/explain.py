"""Explanation facts: fixed templates over numbers already in the result. No free text is generated,
no cause is asserted beyond the arithmetic ("below the skyline by x deg"), and unknown is never
described as "not visible". Each fact has a stable code, the filled sentence and its parameters.
"""

from __future__ import annotations


def _pct(x: float | None) -> str:
    return "unknown" if x is None else f"{100 * x:.1f}%"


def _hours(s: float) -> str:
    return f"{s / 3600:.1f} h"


def explain_target(terrain: dict, flat: dict | None = None) -> list[dict]:
    """`terrain`/`flat`: the per-model result dicts with `metrics` and `clearance_at_nodes`."""
    m, c = terrain["metrics"], terrain.get("clearance_at_nodes") or {}
    facts: list[dict] = []

    def add(code: str, text: str, **params):
        facts.append({"code": code, "text": text, "params": params})

    unresolved = (m.get("uncertified_s") or 0) + (m.get("unknown_s") or 0) + (m.get("gap_s") or 0)
    lo, hi = m["availability_lower"], m["availability_upper"]
    if m["outcome"] == "EXCLUDED":
        add("EXCLUDED", "This target is excluded: " + ", ".join(m.get("exclusion_reasons") or ["no reason recorded"]) + ".",
            reasons=m.get("exclusion_reasons") or [])
        return facts
    if unresolved > 0:
        add("UNRESOLVED_TIME", f"{_hours(unresolved)} of the window could not be certified as visible or hidden; "
            f"availability is between {_pct(lo)} and {_pct(hi)}, not a single value.",
            unresolved_s=unresolved, lower=lo, upper=hi)
    elif lo == hi == 0 and m["visible_s"] == 0:
        add("HIDDEN_WHOLE_WINDOW", "The target is below the terrain skyline for the whole computed window.",
            hidden_s=m["hidden_s"])
        if c.get("max_deg") is not None and c["max_deg"] < 0:
            add("CLOSEST_APPROACH_BELOW", f"At its highest the target is {abs(c['max_deg']):.1f} deg below the "
                f"skyline (sampled at {c.get('samples', '?')} nodes).", max_clearance_deg=c["max_deg"])
    elif lo == hi == 1:
        add("VISIBLE_WHOLE_WINDOW", "The target is above the skyline, with margin, for the whole computed window.")
    else:
        add("AVAILABILITY_RANGE", f"The target is visible {_pct(lo)} to {_pct(hi)} of the window.", lower=lo, upper=hi)
    if m.get("longest_known_hidden_s"):
        add("LONGEST_HIDDEN", f"The longest certified hidden stretch is {_hours(m['longest_known_hidden_s'])}.",
            seconds=m["longest_known_hidden_s"])
    if flat is not None:
        fm = flat["metrics"]
        if fm["outcome"] != m["outcome"]:
            add("TERRAIN_CHANGES_OUTCOME",
                f"With a flat horizon the outcome is {fm['outcome']}; with this terrain it is {m['outcome']}.",
                flat_outcome=fm["outcome"], terrain_outcome=m["outcome"])
        elif fm["availability_lower"] - lo > 0.01:
            add("TERRAIN_REDUCES_AVAILABILITY",
                f"Terrain reduces availability from {_pct(fm['availability_lower'])} (flat horizon) to {_pct(lo)}.",
                flat=fm["availability_lower"], terrain=lo)
    return facts

"""Sunset / Earthset countdown from the shared event list (FR-17, spec 9.2).

The browser may only subtract the cursor time from a time the server already decided; this
module is the server-side rule set that decides WHAT to count down to. One interval list and one
event list drive durations, outages and the countdown, so they cannot disagree.

Rules:
  * At the exact moment of an event, the interval that STARTS there is the current state.
  * The mission end is a censored boundary, never a sunset.
  * The countdown never crosses uncertified or missing-coverage time: if such an interval lies
    before the next event the answer is "unknown", not a number.
  * The numerical decision band (class U) around a crossing belongs to that event; it does not
    block the countdown, but the band is reported so the display can show it.
  * No further event: "no set before the end of the computed window".
"""

from __future__ import annotations

from .codes import IntervalClass as C

BLOCKING = (C.UNCERTIFIED, C.GAP)


def state_at(intervals, t: float):
    """Interval containing t; at a shared boundary the interval that starts there wins."""
    for iv in intervals:
        if iv.start <= t < iv.end:
            return iv
    if intervals and t == intervals[-1].end:
        return intervals[-1]  # mission end: the last interval, flagged censored by the caller
    raise ValueError(f"t={t} outside the mission window")


def countdown(intervals, events, t: float, target_label: str = "target") -> dict:
    cur = state_at(intervals, t)
    end = intervals[-1].end
    base = {"t": t, "state": cur.cls.value, "target": target_label, "mission_end": end}
    if t >= end:
        return {**base, "kind": "mission_end", "text": "At the mission end (censored boundary)"}
    if cur.cls in BLOCKING:
        return {**base, "kind": "unknown", "unknown_from": cur.start, "unknown_until": cur.end,
                "text": "Unknown: no data or no certification here; no count is given"}

    if cur.cls == C.UNRESOLVED:  # inside a decision band: report the event it belongs to
        ev = next((e for e in events if cur.start <= e.t <= cur.end), None)
        out = {**base, "kind": "in_decision_band", "band": [cur.start, cur.end],
               "text": "Inside the numerical decision band of a crossing"}
        if ev is not None:
            out.update(event_type=ev.type, at=ev.t, remaining_s=ev.t - t,
                       solver_bracket_s=ev.solver_bracket_s)
        return out

    expect = "set" if cur.cls == C.VISIBLE else "rise"
    nxt = next((e for e in events if e.t > t), None)
    horizon_t = nxt.t if nxt is not None else end
    blocker = next((iv for iv in intervals
                    if iv.cls in BLOCKING and iv.end > t and iv.start < horizon_t), None)
    if blocker is not None:
        return {**base, "kind": "unknown_before_event", "unknown_from": blocker.start,
                "text": "The next change is preceded by uncertified or missing data: not counted"}
    if nxt is None:
        return {**base, "kind": "no_event", "remaining_s": None,
                "text": "No change before the end of the computed window"}
    if nxt.type != expect:
        return {**base, "kind": "unexpected_event_order", "at": nxt.t, "event_type": nxt.type,
                "text": "Event order does not match the current state; not counted"}
    return {**base, "kind": expect, "at": nxt.t, "remaining_s": nxt.t - t,
            "solver_bracket_s": nxt.solver_bracket_s,
            "text": f"Predicted {expect} under this terrain model"}

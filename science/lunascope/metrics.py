"""Metrics from classified intervals (spec 8.5). Durations, never sample counts."""

from __future__ import annotations

from dataclasses import dataclass

from .codes import ExclusionReason, Outcome
from .codes import IntervalClass as C
from .events import Interval
from .requirements import requirement_outcome


@dataclass(frozen=True)
class TargetMetrics:
    total_s: float
    visible_s: float
    hidden_s: float
    unknown_s: float  # U + X + G
    uncertified_s: float
    gap_s: float
    availability_lower: float
    availability_upper: float
    known_time_fraction: float | None  # V / (V + H); conditional, never full-window availability
    longest_known_hidden_s: float
    longest_known_hidden_start: float | None
    longest_known_hidden_end: float | None
    worst_case_not_visible_s: float  # longest run of anything not certified visible
    worst_case_touches_edge: bool
    exclusion_reasons: list[str]
    threshold: float
    outcome: Outcome
    margin_lower: float
    margin_upper: float

    def to_dict(self) -> dict:
        d = dict(self.__dict__)
        d["outcome"] = self.outcome.value
        return d


def summarize(
    intervals: list[Interval],
    t0: float,
    t1: float,
    theta: float,
    extra_exclusions: list[str] | None = None,
) -> TargetMetrics:
    total = t1 - t0
    by = {c: 0.0 for c in C}
    for iv in intervals:
        by[iv.cls] += iv.duration
    v, h = by[C.VISIBLE], by[C.HIDDEN]
    unknown = by[C.UNRESOLVED] + by[C.UNCERTIFIED] + by[C.GAP]
    assert abs(v + h + unknown - total) < 1e-6 * max(1.0, total), "T must equal V + H + U"

    reasons = list(extra_exclusions or [])
    if by[C.UNCERTIFIED] > 0:
        reasons.append(ExclusionReason.UNCERTIFIED_EVENT_SEARCH.value)
    if by[C.GAP] > 0:
        reasons.append(ExclusionReason.COVERAGE_MISSING.value)

    lower, upper = v / total, (v + unknown) / total

    # longest known hidden run (merged intervals are already maximal runs of one class)
    hid = [iv for iv in intervals if iv.cls == C.HIDDEN]
    longest = max(hid, key=lambda iv: iv.duration, default=None)

    # longest run of anything not certified visible, merging adjacent non-visible classes
    worst, run_start, touches = 0.0, None, False
    best_touch = False
    for iv in intervals + [Interval(t1, t1, C.VISIBLE)]:
        if iv.cls != C.VISIBLE:
            run_start = iv.start if run_start is None else run_start
            run_end = iv.end
        elif run_start is not None:
            length = run_end - run_start
            touches = run_start <= t0 + 1e-9 or run_end >= t1 - 1e-9
            if length > worst:
                worst, best_touch = length, touches
            run_start = None
    if run_start is not None:  # pragma: no cover - sentinel closes every run
        raise AssertionError

    return TargetMetrics(
        total_s=total,
        visible_s=v,
        hidden_s=h,
        unknown_s=unknown,
        uncertified_s=by[C.UNCERTIFIED],
        gap_s=by[C.GAP],
        availability_lower=lower,
        availability_upper=upper,
        known_time_fraction=(v / (v + h)) if (v + h) > 0 else None,
        longest_known_hidden_s=longest.duration if longest else 0.0,
        longest_known_hidden_start=longest.start if longest else None,
        longest_known_hidden_end=longest.end if longest else None,
        worst_case_not_visible_s=worst,
        worst_case_touches_edge=best_touch,
        exclusion_reasons=reasons,
        threshold=theta,
        outcome=requirement_outcome(lower, upper, theta, reasons),
        margin_lower=lower - theta,
        margin_upper=upper - theta,
    )

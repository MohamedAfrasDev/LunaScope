"""Interval partition and event isolation (spec 7.1, 7.2).

The clearance function d(t) = target_el - horizon_el - margin is supplied through a
`ClearanceModel`. Three separate responsibilities:

* certification  - an interval is certified free of crossings of a level c only when
                   |d(mid) - c| > L*w/2 + delta, with L a conservative bound over the
                   whole interval (never an estimate from sampled rates);
* partition      - crossings of +eps and -eps bound the unresolved band;
* events         - crossings of 0 are rise/set events.

Brent refinement is applied only to a bracket on which the model certifies that d' has a
single sign, so the bracket holds exactly one root. Anything that cannot be certified within
the minimum width / evaluation cap is returned as UNCERTIFIED, never as "no event".
"""

from __future__ import annotations

from dataclasses import dataclass, field
from itertools import pairwise
from math import isnan
from typing import Protocol

from scipy.optimize import brentq

from .codes import IntervalClass as C


class ClearanceModel(Protocol):
    def d(self, t: float) -> float: ...

    def lipschitz(self, a: float, b: float) -> float:
        """Conservative bound on |d'(t)| over [a, b]."""

    def monotone(self, a: float, b: float) -> bool:
        """True only if d' is certified to have a single sign over [a, b]."""


@dataclass(frozen=True)
class Settings:
    eps: float = 0.01  # decision band, degrees (SDR-001 D-05, default)
    tau: float = 1.0  # root tolerance, seconds (D-06)
    w_min: float = 5.0  # minimum interval width, seconds
    max_evals: int = 200  # evaluation cap per base interval
    delta: float = 0.0  # geometry interpolation residual, degrees


@dataclass(frozen=True)
class Interval:
    start: float
    end: float
    cls: C

    @property
    def duration(self) -> float:
        return self.end - self.start


@dataclass(frozen=True)
class Event:
    t: float
    type: str  # "rise" | "set"
    solver_bracket_s: float
    quality: str = "normal"


@dataclass
class Partition:
    intervals: list[Interval]
    events: list[Event]
    evals: int = 0
    base_intervals: int = field(default=0)


def class_of(d: float, eps: float) -> C:
    if d > eps:
        return C.VISIBLE
    if d < -eps:
        return C.HIDDEN
    return C.UNRESOLVED


class _Budget:
    def __init__(self, cap: int):
        self.cap, self.used = cap, 0

    def spend(self) -> None:
        self.used += 1

    @property
    def exhausted(self) -> bool:
        return self.used >= self.cap


def _monotone_leaf(model, a, b, fa, fb, s: Settings, budget) -> tuple[list, list]:
    """Exactly-one-crossing-per-level leaf. Returns (segments, events)."""
    rising = fb > fa
    levels = [-s.eps, 0.0, s.eps] if rising else [s.eps, 0.0, -s.eps]
    cuts: list[tuple[float, float]] = []  # (time, level)
    for c in levels:
        # half-open sides (x >= c) so a crossing that lands exactly on a base-interval edge is
        # counted once, by the interval that starts there
        if (fa >= c) != (fb >= c):
            t = brentq(lambda x, c=c: model.d(x) - c, a, b, xtol=s.tau / 2, rtol=1e-14)
            budget.used += 1
            cuts.append((t, c))
    cuts.sort()
    events = [
        Event(t, "rise" if rising else "set", s.tau) for t, c in cuts if c == 0.0
    ]
    # Pieces between cuts take their class from d at the piece midpoint; the solver bracket
    # around each +/-eps crossing is kept as bounded unresolved time.
    segs: list[tuple[float, float, C]] = []
    pos = a
    for t, c in cuts:
        if c == 0.0:
            continue
        lo, hi = max(a, t - s.tau / 2), min(b, t + s.tau / 2)
        if lo > pos:
            segs.append((pos, lo, class_of(model.d((pos + lo) / 2), s.eps)))
            budget.used += 1
        segs.append((lo, hi, C.UNRESOLVED))
        pos = hi
    if b > pos:
        segs.append((pos, b, class_of(model.d((pos + b) / 2), s.eps)))
        budget.used += 1
    return segs, events


def _resolve(model, a, b, fa, fb, s: Settings, budget):
    w = b - a
    mid = (a + b) / 2
    fm = model.d(mid)
    budget.spend()
    if isnan(fa) or isnan(fb) or isnan(fm):
        # Unknown horizon or geometry: never "hidden". Subdivide to find where known time
        # resumes; whatever stays unknown at the minimum width is a coverage gap.
        if w <= s.w_min or budget.exhausted:
            return [(a, b, C.GAP)], []
        ls, le = _resolve(model, a, mid, fa, fm, s, budget)
        rs, re_ = _resolve(model, mid, b, fm, fb, s, budget)
        return ls + rs, le + re_
    margin = model.lipschitz(a, b) * w / 2 + s.delta
    if all(abs(fm - c) > margin for c in (-s.eps, 0.0, s.eps)):
        return [(a, b, class_of(fm, s.eps))], []
    if model.monotone(a, b):
        return _monotone_leaf(model, a, b, fa, fb, s, budget)
    if w <= s.w_min or budget.exhausted:
        return [(a, b, C.UNCERTIFIED)], []
    ls, le = _resolve(model, a, mid, fa, fm, s, budget)
    rs, re_ = _resolve(model, mid, b, fm, fb, s, budget)
    return ls + rs, le + re_


def build_partition(
    model: ClearanceModel, t0: float, t1: float, base_step: float, s: Settings = Settings()
) -> Partition:
    if not t1 > t0 or base_step <= 0:
        raise ValueError("need t1 > t0 and base_step > 0")
    segs: list[tuple[float, float, C]] = []
    events: list[Event] = []
    evals = 0
    n_base = 0
    a = t0
    fa = model.d(a)
    while a < t1 - 1e-9:
        b = min(a + base_step, t1)
        fb = model.d(b)
        budget = _Budget(s.max_evals)
        sg, ev = _resolve(model, a, b, fa, fb, s, budget)
        segs += sg
        events += ev
        evals += budget.used + 2
        n_base += 1
        a, fa = b, fb
    events.sort(key=lambda e: e.t)
    return Partition(_merge(segs, t0, t1), events, evals, n_base)


def _merge(segs, t0, t1) -> list[Interval]:
    out: list[Interval] = []
    for a, b, c in segs:
        if b - a <= 0:
            continue
        if out and out[-1].cls == c and abs(out[-1].end - a) < 1e-9:
            out[-1] = Interval(out[-1].start, b, c)
        else:
            out.append(Interval(a, b, c))
    # tiling invariant: no gaps or overlaps
    assert abs(out[0].start - t0) < 1e-6 and abs(out[-1].end - t1) < 1e-6
    for p, q in pairwise(out):
        assert abs(p.end - q.start) < 1e-6, "intervals must tile the mission window"
    return out

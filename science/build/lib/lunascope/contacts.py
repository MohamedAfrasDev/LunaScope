"""Contact events: the target approaches the skyline (or leaves it) without a certified crossing.

A maximal run of unresolved-band intervals (|d| <= eps) whose two neighbours are the SAME class
(visible-band-visible, or hidden-band-hidden) and which holds no rise/set event is a candidate.
The extremum of d inside the run is located (golden-section refinement of a dense scan) and the
candidate is reported as:

* ``graze``            visible on both sides, minimum d stays above 0: touches the skyline band, no crossing
* ``near_miss``        hidden on both sides, maximum d stays below 0: approaches, never clears it
* ``unresolved_dip``   the extremum is on the other side of 0 than the neighbours, so d crossed 0 twice
                       inside the band and the two events were not isolated; reported, never dropped

The extremum search is numerical, not a certificate; every contact carries ``extremum_search:
"numerical"`` so a consumer cannot mistake it for the certified interval classes.
"""

from __future__ import annotations

from dataclasses import dataclass
from math import isnan

import numpy as np
from scipy.optimize import minimize_scalar

from .codes import IntervalClass as C
from .events import Partition

SCAN_POINTS = 257


@dataclass(frozen=True)
class Contact:
    kind: str  # graze | near_miss | unresolved_dip
    start: float
    end: float
    t_extremum: float
    d_extremum: float
    extremum_search: str = "numerical"


def find_contacts(model, part: Partition) -> list[Contact]:
    out: list[Contact] = []
    ivs = part.intervals
    i = 0
    while i < len(ivs):
        if ivs[i].cls != C.UNRESOLVED:
            i += 1
            continue
        j = i
        while j + 1 < len(ivs) and ivs[j + 1].cls == C.UNRESOLVED:
            j += 1
        before = ivs[i - 1].cls if i > 0 else None
        after = ivs[j + 1].cls if j + 1 < len(ivs) else None
        a, b = ivs[i].start, ivs[j].end
        i = j + 1
        if before is None or before != after or before not in (C.VISIBLE, C.HIDDEN):
            continue
        if any(a - 1e-9 <= e.t <= b + 1e-9 for e in part.events):
            continue  # a certified crossing explains the band
        sign = 1.0 if before == C.VISIBLE else -1.0  # we look for min of d (visible) or max (hidden)
        ts = np.linspace(a, b, SCAN_POINTS)
        vals = np.array([model.d(float(t)) for t in ts])
        if np.isnan(vals).any():
            continue  # unknown skyline inside: no extremum claim
        k = int(np.argmin(sign * vals))
        lo, hi = ts[max(k - 1, 0)], ts[min(k + 1, len(ts) - 1)]
        if hi > lo:
            r = minimize_scalar(lambda t, sign=sign: sign * model.d(float(t)), bounds=(lo, hi), method="bounded",
                                options={"xatol": 1e-3})
            t_x, d_x = float(r.x), float(model.d(float(r.x)))
            if isnan(d_x) or sign * d_x > sign * vals[k]:
                t_x, d_x = float(ts[k]), float(vals[k])
        else:
            t_x, d_x = float(ts[k]), float(vals[k])
        if before == C.VISIBLE:
            kind = "graze" if d_x > 0 else "unresolved_dip"
        else:
            kind = "near_miss" if d_x < 0 else "unresolved_dip"
        out.append(Contact(kind, a, b, t_x, d_x))
    return out


def contacts_to_json(contacts: list[Contact]) -> list[dict]:
    return [vars(c) | {"d_extremum_deg": c.d_extremum} for c in contacts]


__all__ = ["Contact", "contacts_to_json", "find_contacts"]

"""Requirement outcomes and site summary (spec 7.1, 7.4).

Per target: PASS if lower >= theta; FAIL if upper < theta; INDETERMINATE otherwise;
EXCLUDED when required inputs are missing, validation is fatal, or the event search is
uncertified. Indeterminate or excluded is never counted as a failed target.
"""

from __future__ import annotations

from collections.abc import Mapping

from .codes import Outcome, SiteStatus


def requirement_outcome(
    lower: float, upper: float, theta: float, exclusion_reasons: list[str]
) -> Outcome:
    if exclusion_reasons:
        return Outcome.EXCLUDED
    if lower >= theta:
        return Outcome.PASS
    if upper < theta:
        return Outcome.FAIL
    return Outcome.INDETERMINATE


def site_summary(
    outcomes: Mapping[str, Outcome], *, site_fatal: bool = False
) -> SiteStatus:
    """`outcomes` maps "sun_center" / "earth_center" to their per-target outcome."""
    if site_fatal:
        return SiteStatus.UNKNOWN_COVERAGE
    sun_fail = outcomes.get("sun_center") == Outcome.FAIL
    earth_fail = outcomes.get("earth_center") == Outcome.FAIL
    if sun_fail and earth_fail:
        return SiteStatus.FAIL_BOTH
    if sun_fail:
        return SiteStatus.FAIL_SUN
    if earth_fail:
        return SiteStatus.FAIL_EARTH
    values = set(outcomes.values())
    if Outcome.EXCLUDED in values and values <= {Outcome.EXCLUDED}:
        return SiteStatus.UNKNOWN_COVERAGE
    if values & {Outcome.INDETERMINATE, Outcome.EXCLUDED}:
        return SiteStatus.INDETERMINATE
    return SiteStatus.PASS

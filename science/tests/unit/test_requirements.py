import pytest

from lunascope.codes import IntervalClass as C
from lunascope.codes import Outcome, SiteStatus
from lunascope.events import Interval
from lunascope.metrics import summarize
from lunascope.requirements import requirement_outcome, site_summary

TH = 0.6


def test_bounds_wholly_above_pass():
    assert requirement_outcome(0.65, 0.66, TH, []) == Outcome.PASS


def test_bounds_wholly_below_fail():
    assert requirement_outcome(0.4, 0.55, TH, []) == Outcome.FAIL


def test_bounds_straddling_indeterminate():
    assert requirement_outcome(0.58, 0.62, TH, []) == Outcome.INDETERMINATE


def test_exclusion_beats_numbers():
    assert requirement_outcome(0.9, 0.9, TH, ["COVERAGE_MISSING"]) == Outcome.EXCLUDED


def test_one_pass_one_indeterminate_is_not_a_failure():
    s = site_summary({"sun_center": Outcome.PASS, "earth_center": Outcome.INDETERMINATE})
    assert s == SiteStatus.INDETERMINATE


def test_definite_failure_establishes_site_failure():
    s = site_summary({"sun_center": Outcome.FAIL, "earth_center": Outcome.INDETERMINATE})
    assert s == SiteStatus.FAIL_SUN
    s = site_summary({"sun_center": Outcome.FAIL, "earth_center": Outcome.FAIL})
    assert s == SiteStatus.FAIL_BOTH


def test_all_excluded_and_fatal_are_unknown_coverage():
    ex = {"sun_center": Outcome.EXCLUDED, "earth_center": Outcome.EXCLUDED}
    assert site_summary(ex) == SiteStatus.UNKNOWN_COVERAGE
    assert site_summary({"sun_center": Outcome.PASS}, site_fatal=True) == SiteStatus.UNKNOWN_COVERAGE


def test_all_pass():
    assert site_summary({"sun_center": Outcome.PASS, "earth_center": Outcome.PASS}) == SiteStatus.PASS


def iv(*parts):
    out, t = [], 0.0
    for cls, d in parts:
        out.append(Interval(t, t + d, cls))
        t += d
    return out, t


def test_bounded_crossing_uncertainty_propagates_not_excludes():
    # 58% visible + 4% in the numerical band: lower 0.58 < 0.60 <= upper 0.62
    ivs, T = iv((C.VISIBLE, 58), (C.UNRESOLVED, 4), (C.HIDDEN, 38))
    m = summarize(ivs, 0, T, 0.60)
    assert m.outcome == Outcome.INDETERMINATE and m.exclusion_reasons == []
    assert m.margin_lower == pytest.approx(-0.02) and m.margin_upper == pytest.approx(0.02)


def test_unknown_is_never_folded_into_hidden():
    ivs, T = iv((C.VISIBLE, 50), (C.GAP, 20), (C.HIDDEN, 30))
    m = summarize(ivs, 0, T, 0.5)
    assert m.hidden_s == 30 and m.unknown_s == 20
    assert m.outcome == Outcome.EXCLUDED  # missing coverage
    assert m.availability_upper == pytest.approx(0.7)


def test_equal_availability_different_longest_outage():
    a, T = iv((C.VISIBLE, 50), (C.HIDDEN, 50))
    b, _ = iv((C.VISIBLE, 25), (C.HIDDEN, 10), (C.VISIBLE, 25), (C.HIDDEN, 10), (C.VISIBLE, 0.0001),
              (C.HIDDEN, 30 - 0.0001))
    ma, mb = summarize(a, 0, T, 0.5), summarize(b, 0, T, 0.5)
    assert ma.availability_lower == pytest.approx(mb.availability_lower, abs=1e-4)
    assert ma.longest_known_hidden_s == 50 and mb.longest_known_hidden_s < 31


def test_worst_case_includes_unknown_only_spans_and_edges():
    ivs, T = iv((C.GAP, 10), (C.VISIBLE, 40), (C.UNRESOLVED, 20), (C.VISIBLE, 30))
    m = summarize(ivs, 0, T, 0.1)
    assert m.longest_known_hidden_s == 0
    assert m.worst_case_not_visible_s == 20 and m.worst_case_touches_edge is False
    ivs, T = iv((C.GAP, 25), (C.VISIBLE, 75))
    m = summarize(ivs, 0, T, 0.1)
    assert m.worst_case_not_visible_s == 25 and m.worst_case_touches_edge is True


def test_known_time_fraction_is_conditional_and_separate():
    ivs, T = iv((C.VISIBLE, 30), (C.UNRESOLVED, 50), (C.HIDDEN, 20))
    m = summarize(ivs, 0, T, 0.1)
    assert m.known_time_fraction == pytest.approx(0.6)
    assert m.availability_lower == pytest.approx(0.3)

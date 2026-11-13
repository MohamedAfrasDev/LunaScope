import pytest

from lunascope.codes import IntervalClass as C
from lunascope.countdown import countdown, state_at
from lunascope.events import Event, Interval

V, H, U, X, G = C.VISIBLE, C.HIDDEN, C.UNRESOLVED, C.UNCERTIFIED, C.GAP


def iv(*parts):
    out, t = [], 0.0
    for cls, d in parts:
        out.append(Interval(t, t + d, cls))
        t += d
    return out


def ev(t, kind):
    return Event(t, kind, 1.0)


# visible 0-1000, band 1000-1100 (set at 1050), hidden 1100-2000, band 2000-2100 (rise 2050), visible to 3000
INTERVALS = iv((V, 1000), (U, 100), (H, 900), (U, 100), (V, 900))
EVENTS = [ev(1050, "set"), ev(2050, "rise")]


def test_visible_counts_down_to_the_set_event_not_to_the_band_edge():
    c = countdown(INTERVALS, EVENTS, 400.0, "sun")
    assert c["kind"] == "set" and c["at"] == 1050 and c["remaining_s"] == 650
    assert c["solver_bracket_s"] == 1.0 and "terrain model" in c["text"]


def test_hidden_counts_down_to_the_rise():
    c = countdown(INTERVALS, EVENTS, 1500.0)
    assert c["kind"] == "rise" and c["remaining_s"] == 550


def test_inside_a_decision_band_reports_the_event_it_belongs_to():
    c = countdown(INTERVALS, EVENTS, 1020.0)
    assert c["kind"] == "in_decision_band" and c["event_type"] == "set" and c["remaining_s"] == 30


def test_at_the_exact_event_boundary_the_interval_that_starts_there_is_current():  # case 10
    assert state_at(INTERVALS, 1000.0).cls == U
    assert state_at(INTERVALS, 1100.0).cls == H
    assert countdown(INTERVALS, EVENTS, 1100.0)["state"] == "H"


def test_mission_end_is_censored_not_a_sunset():
    c = countdown(INTERVALS, EVENTS, 3000.0)
    assert c["kind"] == "mission_end" and "censored" in c["text"]


def test_no_further_event_says_so_and_never_invents_a_time():
    c = countdown(INTERVALS, EVENTS, 2500.0)
    assert c["kind"] == "no_event" and c["remaining_s"] is None
    assert "end of the computed window" in c["text"]


def test_never_counts_across_missing_data():
    ivs = iv((V, 500), (G, 300), (V, 200), (U, 50), (H, 450))
    c = countdown(ivs, [ev(1025, "set")], 100.0)
    assert c["kind"] == "unknown_before_event" and c["unknown_from"] == 500
    c = countdown(ivs, [ev(1025, "set")], 600.0)
    assert c["kind"] == "unknown"
    ivs2 = iv((V, 500), (X, 100), (V, 400))
    assert countdown(ivs2, [], 10.0)["kind"] == "unknown_before_event"


def test_event_order_that_contradicts_the_state_is_refused():
    c = countdown(iv((V, 100), (H, 100)), [ev(150, "rise")], 10.0)
    assert c["kind"] == "unexpected_event_order"


def test_outside_the_window_is_an_error():
    with pytest.raises(ValueError):
        state_at(INTERVALS, 9999.0)

import pytest
from conftest import ParabolaModel

from lunascope.codes import IntervalClass as C
from lunascope.contacts import find_contacts
from lunascope.events import Event, Interval, Partition, build_partition


def test_graze_is_a_contact_not_an_event():
    m = ParabolaModel(k=4e-8, c=1000.0, m=0.004)  # min d = +0.004 deg, inside the +/-0.01 band
    p = build_partition(m, 0.0, 2000.0, 100.0)
    assert p.events == []
    (c,) = find_contacts(m, p)
    assert c.kind == "graze" and c.t_extremum == pytest.approx(1000.0, abs=1.0)
    assert c.d_extremum == pytest.approx(0.004, abs=1e-6) and c.extremum_search == "numerical"


def test_near_miss_from_below():
    m = ParabolaModel(k=-4e-8, c=1000.0, m=-0.004)  # max d = -0.004 deg
    p = build_partition(m, 0.0, 2000.0, 100.0)
    (c,) = find_contacts(m, p)
    assert c.kind == "near_miss" and c.d_extremum == pytest.approx(-0.004, abs=1e-6)


def test_a_real_dip_with_isolated_events_is_not_a_contact():
    m = ParabolaModel(k=4e-8, c=1000.0, m=-0.004)  # crosses 0 twice: events are found
    p = build_partition(m, 0.0, 2000.0, 100.0)
    assert [e.type for e in p.events] == ["set", "rise"]
    assert find_contacts(m, p) == []


def test_extremum_on_the_other_side_of_zero_is_reported_not_dropped():
    m = ParabolaModel(k=4e-8, c=1000.0, m=-0.004)
    p = Partition([Interval(0, 600, C.VISIBLE), Interval(600, 1400, C.UNRESOLVED),
                   Interval(1400, 2000, C.VISIBLE)], events=[])  # events missing from this partition
    (c,) = find_contacts(m, p)
    assert c.kind == "unresolved_dip" and c.d_extremum < 0


def test_unknown_or_uncertified_neighbours_make_no_claim():
    m = ParabolaModel(k=4e-8, c=1000.0, m=0.004)
    p = Partition([Interval(0, 600, C.UNCERTIFIED), Interval(600, 1400, C.UNRESOLVED),
                   Interval(1400, 2000, C.VISIBLE)], events=[Event(5.0, "rise", 1.0)])
    assert find_contacts(m, p) == []

import pytest
from conftest import ParabolaModel, SineModel
from hypothesis import given, settings
from hypothesis import strategies as st

from lunascope.codes import IntervalClass as C
from lunascope.events import Settings, build_partition
from lunascope.metrics import summarize

T0, T1 = 0.0, 86400.0


def dur(p, cls):
    return sum(i.duration for i in p.intervals if i.cls == cls)


def test_sine_events_found_within_tolerance():
    m = SineModel(A=1.0, P=86400.0, shift=7000.0)  # set at 36200 s, rise at 79400 s
    p = build_partition(m, T0, T1, 600.0)
    got = [(e.t, e.type) for e in p.events]
    assert [t for _, t in got] == ["set", "rise"]
    assert got[0][0] == pytest.approx(36200.0, abs=1.0)
    assert got[1][0] == pytest.approx(79400.0, abs=1.0)
    assert all(e.solver_bracket_s == 1.0 for e in p.events)


def test_partition_tiles_and_band_is_unresolved_not_hidden():
    m = SineModel(A=1.0, P=86400.0, shift=7000.0)
    p = build_partition(m, T0, T1, 600.0)
    assert dur(p, C.VISIBLE) + dur(p, C.HIDDEN) + dur(p, C.UNRESOLVED) == pytest.approx(T1 - T0)
    assert dur(p, C.UNCERTIFIED) == 0
    # band width per crossing ~ 2*eps / rate = 0.02 / (2 pi / 86400) ~ 275 s, two crossings
    assert 450 < dur(p, C.UNRESOLVED) < 650


def test_double_crossing_between_same_sign_endpoints():
    # d>0 at both ends of the 600 s base interval, negative dip 28.3 s wide near t=150
    m = ParabolaModel(k=0.2 / 400.0, c=150.0, m=-0.1)
    p = build_partition(m, 0.0, 600.0, 600.0)
    kinds = [e.type for e in p.events]
    assert kinds == ["set", "rise"]
    half = (0.1 / (0.2 / 400.0)) ** 0.5
    assert p.events[0].t == pytest.approx(150 - half, abs=1.0)
    assert p.events[1].t == pytest.approx(150 + half, abs=1.0)
    assert dur(p, C.UNCERTIFIED) == 0


def test_tangent_without_sign_change_is_not_called_no_event():
    m = ParabolaModel(k=0.2 / 400.0, c=150.0, m=0.0)
    p = build_partition(m, 0.0, 600.0, 600.0)
    assert dur(p, C.UNCERTIFIED) > 0  # unresolved, never "no event"
    assert [e for e in p.events if e.type] == []
    r = summarize(p.intervals, 0.0, 600.0, theta=0.5)
    assert r.outcome.value == "EXCLUDED"
    assert "UNCERTIFIED_EVENT_SEARCH" in r.exclusion_reasons


def test_entering_band_without_crossing_zero():
    # minimum 0.004 deg: inside the +/-0.01 band, never reaches 0 or below
    m = ParabolaModel(k=1e-7, c=150.0, m=0.004)
    p = build_partition(m, 0.0, 600.0, 600.0)
    assert p.events == []
    assert dur(p, C.HIDDEN) == 0 and dur(p, C.UNCERTIFIED) == 0
    assert dur(p, C.UNRESOLVED) > 0


def test_evaluation_cap_returns_uncertified():
    m = ParabolaModel(k=0.2 / 400.0, c=150.0, m=-0.1)
    p = build_partition(m, 0.0, 600.0, 600.0, Settings(max_evals=2))
    assert dur(p, C.UNCERTIFIED) > 0


def test_delta_shrinks_certification_not_correctness():
    m = SineModel(A=1.0, P=86400.0, shift=7000.0)
    p = build_partition(m, T0, T1, 600.0, Settings(delta=0.05))
    assert dur(p, C.VISIBLE) + dur(p, C.HIDDEN) + dur(p, C.UNRESOLVED) + dur(
        p, C.UNCERTIFIED) == pytest.approx(T1 - T0)


@given(st.floats(0.2, 3.0), st.floats(20000, 120000), st.floats(0, 100000))
@settings(max_examples=40, deadline=None)
def test_property_intervals_tile_and_sum(A, P, shift):
    m = SineModel(A=A, P=P, shift=shift)
    p = build_partition(m, 0.0, 50000.0, 900.0)
    assert p.intervals[0].start == pytest.approx(0.0)
    assert p.intervals[-1].end == pytest.approx(50000.0)
    r = summarize(p.intervals, 0.0, 50000.0, theta=0.5)
    assert r.availability_lower <= r.availability_upper
    # event times agree with analytic zeros
    # Zeros sitting on the window edge are boundary cases (censored), not interior events.
    exact = m.zero_crossings(60.0, 50000.0 - 60.0)
    inner = [e for e in p.events if 60.0 <= e.t <= 50000.0 - 60.0]
    if r.uncertified_s == 0:
        assert len(inner) == len(exact)
        for ev, (t, kind) in zip(inner, exact):
            assert ev.type == kind and ev.t == pytest.approx(t, abs=1.5)


class LinearModel:
    """d(t) = k (t - c): monotone, one crossing at c."""

    def __init__(self, k, c):
        self.k, self.c = k, c

    def d(self, t):
        return self.k * (t - self.c)

    def lipschitz(self, a, b):
        return abs(self.k)

    def monotone(self, a, b):
        return True


@pytest.mark.parametrize("c", [600.0, 1200.0, 0.0 + 1e-9, 599.999999, 300.0])
@pytest.mark.parametrize("k", [-1e-4, 1e-4])
def test_crossing_exactly_on_a_base_interval_edge_is_found_once(k, c):
    p = build_partition(LinearModel(k, c), 0.0, 1800.0, 600.0, Settings(eps=0.01))
    zero = [e for e in p.events]
    if c < 1e-6:  # a zero sitting on the window start is a censored boundary, not an event
        assert len(zero) <= 1
        return
    assert len(zero) == 1
    assert zero[0].type == ("rise" if k > 0 else "set")
    assert zero[0].t == pytest.approx(c, abs=1.0)

"""Horizons provider tests against RECORDED REAL responses (real_data_unverified fixtures)."""

import json
import threading
import time
from datetime import UTC, datetime, timedelta
from pathlib import Path

import httpx
import pytest

from lunascope.errors import (
    GEOMETRY_COVERAGE_MISSING,
    GEOMETRY_PROVIDER_REJECTED_REQUEST,
    GEOMETRY_PROVIDER_UNAVAILABLE,
    GEOMETRY_RESPONSE_UNSUPPORTED,
    INVALID_INPUT,
    OBSERVER_MISMATCH,
    RESOURCE_INTEGRITY_FAILED,
    LunaScopeError,
)
from lunascope.observer import build_observer
from lunascope.providers.geometry.horizons import (
    ExternalRequestLimiter,
    HorizonsClient,
    HorizonsProvider,
    ResponseCache,
    build_params,
    cache_key,
    parse_response,
)

FIX = Path(__file__).parent.parent / "fixtures" / "horizons"
T0 = datetime(2027, 1, 10, 0, 0, tzinfo=UTC)
GRID = [T0 + timedelta(hours=h) for h in range(7)]


def obs(height=0.0):
    return build_observer(
        site_id="fx", lat_deg=-89.5, lon_deg=0.0, convention="planetocentric",
        lon_direction="east_positive", reference_radius_km=1737.4, ground_height_m=0.0,
        ground_height_source="fixture", observer_height_above_ground_m=height)


def raw(name):
    return (FIX / f"{name}.json").read_bytes()


def meta(name):
    return json.loads((FIX / f"{name}.meta.json").read_text())


def parse(name, target, o=None, text=None):
    return parse_response(text if text is not None else raw(name), obs=o or obs(), target=target,
                          expected_times=GRID, params=meta(name)["params"],
                          retrieved_utc="2026-11-13T00:36:00Z")


def codes(fn):
    with pytest.raises(LunaScopeError) as e:
        fn()
    return e.value.code


def mutate(name, fn):
    j = json.loads(raw(name))
    fn(j)
    return json.dumps(j).encode()


# ---- request builder ------------------------------------------------------------------------
@pytest.mark.parametrize("name,target", [("sun_pole_sample", "sun_center"),
                                         ("earth_pole_sample", "earth_center")])
def test_request_builder_reproduces_the_recorded_requests(name, target):
    p = build_params(obs(), target, T0, T0 + timedelta(hours=6), 3600)
    assert p == meta(name)["params"]


def test_request_validation():
    o = obs()
    end = T0 + timedelta(hours=6)
    assert codes(lambda: build_params(o, "moon", T0, end, 3600)) == INVALID_INPUT
    assert codes(lambda: build_params(o, "sun_center", T0, end, 30)) == INVALID_INPUT
    assert codes(lambda: build_params(o, "sun_center", T0, end, 7000)) == INVALID_INPUT
    assert codes(lambda: build_params(o, "sun_center", end, T0, 3600)) == INVALID_INPUT
    naive = datetime(2027, 1, 10)
    assert codes(lambda: build_params(o, "sun_center", naive, end, 3600)) == INVALID_INPUT


def test_height_is_ground_plus_mast_relative_to_sphere():
    o = build_observer(site_id="x", lat_deg=-89.0, lon_deg=10.0, convention="planetocentric",
                       lon_direction="east_positive", reference_radius_km=1737.4,
                       ground_height_m=1500.0, ground_height_source="fx",
                       observer_height_above_ground_m=2.0)
    p = build_params(o, "sun_center", T0, T0 + timedelta(hours=1), 3600)
    assert p["SITE_COORD"] == "'10,-89,1.502'"


# ---- parser on real responses ---------------------------------------------------------------
def test_parse_real_sun_response():
    s = parse("sun_pole_sample", "sun_center")
    assert len(s) == 7 and s.signature_version == "1.2" and s.provider == "jpl-horizons"
    assert s.az_deg[0] == pytest.approx(153.482528882) and s.el_deg[0] == pytest.approx(0.417727144)
    assert s.az_deg[-1] == pytest.approx(150.436381378) and s.el_deg[-1] == pytest.approx(0.425044472)
    assert s.t_utc[0] == T0 and s.t_utc[-1] == T0 + timedelta(hours=6)
    assert s.flags[0] == "*|i"
    assert s.header["center_frame"] == "MEAN_ME" and s.header["center_radii_km"] == [1737.4] * 3
    assert "AIRLESS" in s.header["refraction"]
    assert s.header["light_bending"] and "Sun" in s.header["light_bending"]
    assert "UTC_FUTURE_LEAP_SECOND_ASSUMPTION" in s.warnings
    assert s.raw_sha256 == meta("sun_pole_sample")["sha256"]  # verbatim bytes hashed


def test_parse_real_earth_response():
    s = parse("earth_pole_sample", "earth_center")
    assert s.az_deg[0] == pytest.approx(356.817603444) and s.el_deg[0] == pytest.approx(-0.752404786)
    assert s.header["target_body"].startswith("Earth")


def test_input_error_with_http_200_is_rejected_not_parsed():
    j = json.loads(raw("bad_start_time"))
    assert "error" in j  # real Horizons behaviour: HTTP 200 plus an `error` field
    assert codes(lambda: parse("bad_start_time", "sun_center")) == GEOMETRY_PROVIDER_REJECTED_REQUEST


def test_unsupported_or_missing_signature_rejected():
    for bad in ({"version": "2.0"}, {"version": "0.9"}, {}, None):
        text = mutate("sun_pole_sample", lambda j, bad=bad: j.__setitem__("signature", bad))
        assert codes(lambda t=text: parse("sun_pole_sample", "sun_center", text=t)) \
            == GEOMETRY_RESPONSE_UNSUPPORTED
    ok = mutate("sun_pole_sample", lambda j: j.__setitem__("signature", {"version": "1.3"}))
    assert len(parse("sun_pole_sample", "sun_center", text=ok)) == 7


def test_no_rows_or_wrong_row_count_is_coverage_missing():
    none = mutate("sun_pole_sample", lambda j: j.__setitem__(
        "result", "No ephemeris for target prior to A.D. 1900"))
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=none)) == GEOMETRY_COVERAGE_MISSING

    def drop_row(j):
        lines = j["result"].splitlines()
        i = next(k for k, ln in enumerate(lines) if "2027-Jan-10 03:00:00" in ln)
        del lines[i]
        j["result"] = "\n".join(lines)
    short = mutate("sun_pole_sample", drop_row)
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=short)) == GEOMETRY_COVERAGE_MISSING


def test_shifted_time_grid_is_coverage_missing():
    s = mutate("sun_pole_sample", lambda j: j.__setitem__(
        "result", j["result"].replace("2027-Jan-10 01:00:00", "2027-Jan-10 01:00:01")))
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=s)) == GEOMETRY_COVERAGE_MISSING


def test_bad_values_rejected():
    for old, new in (("153.482528882", "nan"), ("0.417727144", "95.0"), ("153.482528882", "360.5")):
        s = mutate("sun_pole_sample", lambda j, o=old, n=new: j.__setitem__(
            "result", j["result"].replace(o, n)))
        assert codes(lambda t=s: parse("sun_pole_sample", "sun_center", text=t)) \
            == GEOMETRY_RESPONSE_UNSUPPORTED


def test_garbage_is_rejected():
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=b"<html>")) \
        == GEOMETRY_RESPONSE_UNSUPPORTED
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=b"[1]")) \
        == GEOMETRY_RESPONSE_UNSUPPORTED


# ---- observer echo (the key frame / height-reference guard) ---------------------------------
def test_observer_echo_catches_height_reference_mismatch():
    # Same response, but we claim the mast was 20 m high: radius and altitude disagree.
    assert codes(lambda: parse("sun_pole_sample", "sun_center", o=obs(height=20.0))) \
        == OBSERVER_MISMATCH
    other = build_observer(site_id="x", lat_deg=-80.0, lon_deg=0.0, convention="planetocentric",
                           lon_direction="east_positive", reference_radius_km=1737.4,
                           ground_height_m=0.0, ground_height_source="fx",
                           observer_height_above_ground_m=0.0)
    assert codes(lambda: parse("sun_pole_sample", "sun_center", o=other)) == OBSERVER_MISMATCH


def test_observer_echo_catches_wrong_frame_or_radius():
    bad_frame = mutate("sun_pole_sample", lambda j: j.__setitem__(
        "result", j["result"].replace("MEAN_ME (high precision)", "PA_DE440 (high precision)")))
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=bad_frame)) == OBSERVER_MISMATCH
    bad_r = mutate("sun_pole_sample", lambda j: j.__setitem__(
        "result", j["result"].replace("1737.4, 1737.4, 1737.4 km", "1738.0, 1738.0, 1738.0 km")))
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=bad_r)) == OBSERVER_MISMATCH


def test_missing_echo_is_not_trusted():
    s = mutate("sun_pole_sample", lambda j: j.__setitem__(
        "result", j["result"].replace("Center geodetic :", "Center geodetic_:")))
    assert codes(lambda: parse("sun_pole_sample", "sun_center", text=s)) == OBSERVER_MISMATCH


# ---- client: cache, retries, limiter --------------------------------------------------------
class Server:
    def __init__(self, responses):
        self.responses, self.calls, self.agents = list(responses), 0, []
        self.in_flight = self.max_in_flight = 0
        self._l = threading.Lock()

    def handler(self, request: httpx.Request) -> httpx.Response:
        with self._l:
            self.calls += 1
            self.in_flight += 1
            self.max_in_flight = max(self.max_in_flight, self.in_flight)
            self.agents.append(request.headers.get("user-agent"))
            r = self.responses[min(self.calls, len(self.responses)) - 1]
        time.sleep(0.02)
        with self._l:
            self.in_flight -= 1
        return r() if callable(r) else r


def ok(name="sun_pole_sample"):
    return lambda: httpx.Response(200, content=raw(name))


def client(tmp_path, server, sleeps=None, **kw):
    sleeps = sleeps if sleeps is not None else []
    http = httpx.Client(transport=httpx.MockTransport(server.handler))
    lim = kw.pop("limiter", ExternalRequestLimiter(min_interval_s=0.0, sleep=sleeps.append))
    return HorizonsClient(ResponseCache(tmp_path / "c"), http, lim, sleeps.append, **kw)


def test_provider_end_to_end_and_cache_hit(tmp_path):
    srv = Server([ok()])
    prov = HorizonsProvider(client(tmp_path, srv))
    s1 = prov.series(obs(), "sun_center", GRID)
    s2 = prov.series(obs(), "sun_center", GRID)
    assert srv.calls == 1  # second call served from the cache
    assert s1.raw_sha256 == s2.raw_sha256 == meta("sun_pole_sample")["sha256"]
    assert s1.az_deg[0] == pytest.approx(153.482528882)
    assert s1.request == build_params(obs(), "sun_center", T0, T0 + timedelta(hours=6), 3600)


def test_user_agent_is_product_and_version_only(tmp_path):
    srv = Server([ok()])
    HorizonsProvider(client(tmp_path, srv)).series(obs(), "sun_center", GRID)
    ua = srv.agents[0]
    assert ua.startswith("LunaScope/") and "@" not in ua and "mailto" not in ua


def test_cache_key_covers_identity_fields():
    o = obs()
    p = build_params(o, "sun_center", T0, T0 + timedelta(hours=6), 3600)
    base = cache_key(o, "sun_center", p)
    assert base == cache_key(o, "sun_center", dict(p))
    assert base != cache_key(obs(2.0), "sun_center", p)
    p2 = build_params(o, "sun_center", T0, T0 + timedelta(hours=6), 7200)
    assert base != cache_key(o, "sun_center", p2)
    pe = build_params(o, "earth_center", T0, T0 + timedelta(hours=6), 3600)
    assert base != cache_key(o, "earth_center", pe)


def test_corrupted_cache_blocks_instead_of_refetching(tmp_path):
    srv = Server([ok()])
    c = client(tmp_path, srv)
    HorizonsProvider(c).series(obs(), "sun_center", GRID)
    f = next(p for p in (tmp_path / "c").glob("*.json") if not p.name.endswith(".meta.json"))
    f.write_bytes(f.read_bytes() + b" ")
    assert codes(lambda: HorizonsProvider(c).series(obs(), "sun_center", GRID)) \
        == RESOURCE_INTEGRITY_FAILED
    assert srv.calls == 1


def test_retries_on_503_with_backoff_then_succeeds(tmp_path):
    sleeps = []
    srv = Server([httpx.Response(503), httpx.Response(503, headers={"Retry-After": "7"}), ok()])
    HorizonsProvider(client(tmp_path, srv, sleeps)).series(obs(), "sun_center", GRID)
    assert srv.calls == 3
    assert sleeps == [2.0, 7.0]  # exponential first, then Retry-After honoured


def test_persistent_503_is_retryable_unavailable_and_never_cached(tmp_path):
    srv = Server([httpx.Response(503)])
    c = client(tmp_path, srv, max_attempts=3)
    with pytest.raises(LunaScopeError) as e:
        HorizonsProvider(c).series(obs(), "sun_center", GRID)
    assert e.value.code == GEOMETRY_PROVIDER_UNAVAILABLE and e.value.retryable
    assert srv.calls == 3 and not list((tmp_path / "c").glob("*"))


def test_http_400_is_not_retried(tmp_path):
    srv = Server([httpx.Response(400, text="bad keyword")])
    c = client(tmp_path, srv)
    assert codes(lambda: HorizonsProvider(c).series(obs(), "sun_center", GRID)) \
        == GEOMETRY_PROVIDER_REJECTED_REQUEST
    assert srv.calls == 1


def test_network_error_is_retried(tmp_path):
    def boom():
        raise httpx.ConnectError("down")
    srv = Server([boom, ok()])
    HorizonsProvider(client(tmp_path, srv)).series(obs(), "sun_center", GRID)
    assert srv.calls == 2


def test_error_in_200_is_not_cached(tmp_path):
    srv = Server([ok("bad_start_time")])
    c = client(tmp_path, srv)
    # a rejected-by-content response must not poison the cache for the correct request
    assert codes(lambda: HorizonsProvider(c).series(obs(), "sun_center", GRID)) \
        == GEOMETRY_PROVIDER_REJECTED_REQUEST


def test_never_more_than_one_request_in_flight_across_clients(tmp_path):
    srv = Server([ok("sun_pole_sample"), ok("earth_pole_sample")] * 4)
    limiter = ExternalRequestLimiter(min_interval_s=0.0)
    obs_list = [obs(float(h)) for h in range(8)]
    # distinct observers => distinct cache keys => real fetches; the echo check will reject the
    # parse, but the HTTP traffic is what this test measures.
    errs = []

    def work(o):
        c = HorizonsClient(ResponseCache(tmp_path / f"c{o.observer_height_above_ground_m}"),
                           httpx.Client(transport=httpx.MockTransport(srv.handler)), limiter)
        try:
            HorizonsProvider(c).series(o, "sun_center", GRID)
        except LunaScopeError as e:
            errs.append(e.code)

    ts = [threading.Thread(target=work, args=(o,)) for o in obs_list]
    [t.start() for t in ts]
    [t.join() for t in ts]
    assert srv.calls == 8 and srv.max_in_flight == 1

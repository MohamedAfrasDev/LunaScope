"""JPL Horizons observer-ephemeris provider (spec 5.4, review I-03, I-06).

* Builds the request from the canonical observer only.
* Stores the raw response verbatim with its SHA-256 and retrieval time (filesystem cache).
* Validates the payload: explicit JSON `error` (Horizons returns input errors with HTTP 200),
  supported `signature.version`, `$$SOE`/`$$EOE`, row count, time grid, value ranges, and that the
  observer Horizons echoes (site, radius, body frame) is the observer we asked for.
* One request in flight at a time across all jobs, exponential backoff, application-specific
  User-Agent (product + version only; no secrets or personal contact details).

Verified against a recorded real response (2026-11-13): site height 0 km is on the 1737.4 km
sphere (cylindric echo radius matches), and the lunar frame is MEAN_ME.
"""

from __future__ import annotations

import math
import re
import threading
import time
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from itertools import pairwise
from pathlib import Path
from typing import ClassVar

import httpx
import numpy as np

from ... import ALGORITHM_VERSION
from ...canonical import hash_of, sha256_hex
from ...errors import (
    GEOMETRY_COVERAGE_MISSING,
    GEOMETRY_PROVIDER_REJECTED_REQUEST,
    GEOMETRY_PROVIDER_UNAVAILABLE,
    GEOMETRY_RESPONSE_UNSUPPORTED,
    INVALID_INPUT,
    OBSERVER_MISMATCH,
    RESOURCE_INTEGRITY_FAILED,
    LunaScopeError,
)
from ...observer import CanonicalObserver
from .base import GeometrySeries

ENDPOINT = "https://ssd.jpl.nasa.gov/api/horizons.api"
SUPPORTED_SIGNATURE_MAJOR = "1"  # docs say 1.3; observed 1.2; reject other majors
TARGET_IDS = {"sun_center": "10", "earth_center": "399"}
CORRECTION_MODE = "horizons_apparent_airless_quantity4"  # NOT claimed identical to SPICE LT+S
TIME_SCALE = "UTC (Horizons UT)"
FRAME_FOR_BODY_FRAME = {"MOON_ME": "MEAN_ME"}
MONTHS = {m: i for i, m in enumerate(
    ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"], 1)}


# ----------------------------------------------------------------------------- request
def _utc(dt: datetime, name: str) -> datetime:
    if dt.tzinfo is None or dt.utcoffset() != timedelta(0):
        raise LunaScopeError(INVALID_INPUT, f"{name} must be a UTC datetime", field=name)
    return dt.astimezone(UTC)


def _fmt_time(dt: datetime) -> str:
    return f"'{dt:%Y-%m-%d %H:%M}'"


def _num(x: float) -> str:
    return format(x, ".12g")


def build_params(obs: CanonicalObserver, target: str, start: datetime, stop: datetime,
                 step_s: int) -> dict[str, str]:
    if target not in TARGET_IDS:
        raise LunaScopeError(INVALID_INPUT, f"unknown target {target!r}", field="target")
    start, stop = _utc(start, "start"), _utc(stop, "stop")
    if start.second or start.microsecond or stop.second or stop.microsecond:
        raise LunaScopeError(INVALID_INPUT, "start/stop must be whole minutes", field="start")
    if step_s < 60 or step_s % 60:
        raise LunaScopeError(INVALID_INPUT, "step must be a whole number of minutes (>= 60 s); "
                             "sub-minute times need TLIST", field="step_s")
    if stop <= start or (stop - start).total_seconds() % step_s:
        raise LunaScopeError(INVALID_INPUT, "stop must lie on the step grid after start",
                             field="stop")
    # Site height is relative to the 1737.4 km sphere (verified from the Horizons echo).
    height_km = (obs.ground_height_m + obs.observer_height_above_ground_m) / 1000.0
    site = f"{_num(obs.lon_deg_east)},{_num(obs.lat_deg)},{_num(height_km)}"
    return {
        "format": "json", "COMMAND": f"'{TARGET_IDS[target]}'", "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'", "EPHEM_TYPE": "'OBSERVER'", "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'", "SITE_COORD": f"'{site}'",
        "START_TIME": _fmt_time(start), "STOP_TIME": _fmt_time(stop),
        "STEP_SIZE": f"'{step_s // 60} m'", "QUANTITIES": "'4'", "ANG_FORMAT": "'DEG'",
        "APPARENT": "'AIRLESS'", "CSV_FORMAT": "'YES'", "EXTRA_PREC": "'YES'",
        "TIME_DIGITS": "'SECONDS'",
    }


def cache_key(obs: CanonicalObserver, target: str, params: dict[str, str]) -> str:
    """Spec 11: provider, observer, target, correction mode, time scale, window, step."""
    return hash_of({"provider": "jpl-horizons", "endpoint": ENDPOINT, "params": params,
                    "observer": obs.digest(), "target": target,
                    "correction_mode": CORRECTION_MODE, "time_scale": TIME_SCALE})


# ----------------------------------------------------------------------------- parsing
def _parse_time(s: str) -> datetime:
    m = re.fullmatch(r"\s*(\d{4})-([A-Za-z]{3})-(\d{2}) (\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?\s*", s)
    if not m or m[2] not in MONTHS:
        raise ValueError(f"unparseable time {s!r}")
    micro = int((m[7] or "0").ljust(6, "0")[:6])
    return datetime(int(m[1]), MONTHS[m[2]], int(m[3]), int(m[4]), int(m[5]), int(m[6] or 0),
                    micro, tzinfo=UTC)


_FLOAT = r"([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)"  # also ".002" and "1.06E-13"


def _header_facts(text: str) -> dict:
    facts: dict = {}

    def grab(label, pattern, conv=None):
        m = re.search(label + r"\s*:\s*" + pattern, text)
        if m:
            facts_val = m.groups()
            return conv(facts_val) if conv else facts_val
        return None

    geod = grab("Center geodetic", f"{_FLOAT},\\s*{_FLOAT},\\s*{_FLOAT}", lambda g: [float(x) for x in g])
    cyl = grab("Center cylindric", f"{_FLOAT},\\s*{_FLOAT},\\s*{_FLOAT}", lambda g: [float(x) for x in g])
    rad = grab("Center radii", f"{_FLOAT},\\s*{_FLOAT},\\s*{_FLOAT}", lambda g: [float(x) for x in g])
    pole = re.search(r"Center pole/equ\s*:\s*(\S+)", text)
    facts["center_geodetic_elon_lat_alt_km"] = geod
    facts["center_cylindric_elon_dxy_dz_km"] = cyl
    facts["center_radii_km"] = rad
    facts["center_frame"] = pole.group(1) if pole else None
    for key, label in (("target_body", "Target body name"), ("refraction", "Atmos refraction"),
                       ("light_bending", "Rel. light bend"), ("eop_coverage", "EOP coverage"),
                       ("center_body", "Center body name")):
        m = re.search(label + r"\s*:\s*(.+)", text)
        facts[key] = m.group(1).strip() if m else None
    return facts


def _check_observer_echo(facts: dict, obs: CanonicalObserver) -> None:
    def fail(msg):
        raise LunaScopeError(OBSERVER_MISMATCH, msg)

    geod, cyl, rad = (facts["center_geodetic_elon_lat_alt_km"],
                      facts["center_cylindric_elon_dxy_dz_km"], facts["center_radii_km"])
    if geod is None or cyl is None or rad is None:
        fail("Horizons response does not echo the observer; cannot confirm what it computed")
    lon, lat, alt = geod
    dlon = (lon - obs.lon_deg_east + 180.0) % 360.0 - 180.0
    want_alt = (obs.ground_height_m + obs.observer_height_above_ground_m) / 1000.0
    if abs(dlon) > 1e-6 or abs(lat - obs.lat_deg) > 1e-6 or abs(alt - want_alt) > 1e-6:
        fail(f"echoed site {geod} differs from requested "
             f"({obs.lon_deg_east}, {obs.lat_deg}, {want_alt})")
    echoed_r = math.hypot(cyl[1], cyl[2])
    # Dz is printed with limited digits (3 decimals, or 5 significant digits at the pole), so the
    # tolerance is 5 m: enough to catch a wrong reference surface, while the geodetic altitude echo
    # above (1e-6 km) catches an input height mismatch exactly.
    if abs(echoed_r - obs.radius_km) > 5e-3:
        fail(f"echoed observer radius {echoed_r:.4f} km differs from {obs.radius_km:.4f} km: "
             "height reference mismatch")
    if any(abs(r - obs.reference_radius_km) > 1e-6 for r in rad):
        fail(f"Horizons reference radii {rad} differ from {obs.reference_radius_km} km")
    want_frame = FRAME_FOR_BODY_FRAME.get(obs.body_frame)
    if want_frame is None or facts["center_frame"] != want_frame:
        fail(f"Horizons lunar frame {facts['center_frame']!r} differs from "
             f"{obs.body_frame!r} ({want_frame!r})")


def parse_response(raw: bytes, *, obs: CanonicalObserver, target: str,
                   expected_times: list[datetime], params: dict, retrieved_utc: str) -> GeometrySeries:
    import json

    try:
        j = json.loads(raw)
    except ValueError as e:
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED, f"response is not JSON: {e}") from e
    if not isinstance(j, dict):
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED, "response is not a JSON object")
    if j.get("error"):  # input errors arrive with HTTP 200
        raise LunaScopeError(GEOMETRY_PROVIDER_REJECTED_REQUEST, str(j["error"]).strip())
    version = (j.get("signature") or {}).get("version")
    if not isinstance(version, str) or version.split(".")[0] != SUPPORTED_SIGNATURE_MAJOR:
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED,
                             f"unsupported Horizons signature version {version!r}")
    text = j.get("result")
    if not isinstance(text, str):
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED, "missing result text")
    if "$$SOE" not in text or "$$EOE" not in text:
        raise LunaScopeError(GEOMETRY_COVERAGE_MISSING,
                             "no ephemeris rows returned: " + " ".join(text.split())[:200])

    facts = _header_facts(text)
    _check_observer_echo(facts, obs)

    head, rest = text.split("$$SOE", 1)
    body = rest.split("$$EOE", 1)[0]
    header_line = next((ln for ln in reversed(head.splitlines()) if "Date__" in ln), None)
    if header_line is None:
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED, "column header not found")
    cols = [c.strip() for c in header_line.split(",")]
    try:
        i_t = next(i for i, c in enumerate(cols) if c.startswith("Date__"))
        i_az = next(i for i, c in enumerate(cols) if c.startswith("Azimuth"))
        i_el = next(i for i, c in enumerate(cols) if c.startswith("Elevation"))
    except StopIteration as e:
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED,
                             f"azimuth/elevation columns not found in {cols}") from e

    times, az, el, flags = [], [], [], []
    for ln in (x for x in body.splitlines() if x.strip()):
        f = [c.strip() for c in ln.split(",")]
        try:
            times.append(_parse_time(f[i_t]))
            az.append(float(f[i_az]))
            el.append(float(f[i_el]))
        except (ValueError, IndexError) as e:
            raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED, f"bad row {ln!r}: {e}") from e
        flags.append("|".join(c for k, c in enumerate(f) if k not in (i_t, i_az, i_el) and c))

    if len(times) != len(expected_times):
        raise LunaScopeError(GEOMETRY_COVERAGE_MISSING,
                             f"expected {len(expected_times)} rows, got {len(times)}")
    for k, (got, want) in enumerate(zip(times, expected_times, strict=True)):
        if got != want:
            raise LunaScopeError(GEOMETRY_COVERAGE_MISSING,
                                 f"row {k} time {got:%Y-%m-%dT%H:%M:%SZ} != expected "
                                 f"{want:%Y-%m-%dT%H:%M:%SZ}")
    a, e_ = np.array(az), np.array(el)
    if not (np.isfinite(a).all() and np.isfinite(e_).all()):
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED, "non-finite angles")
    if ((a < 0) | (a >= 360)).any() or ((e_ < -90) | (e_ > 90)).any():
        raise LunaScopeError(GEOMETRY_RESPONSE_UNSUPPORTED, "angle outside [0,360) / [-90,90]")

    warnings = []
    if "last known leap-second" in text:
        warnings.append("UTC_FUTURE_LEAP_SECOND_ASSUMPTION")
    eop = facts.get("eop_coverage") or ""
    m = re.search(r"TO (\d{4})-([A-Za-z]{3})-(\d{2})\.", eop)
    if m and m[2].upper().title() in MONTHS:
        data_end = datetime(int(m[1]), MONTHS[m[2].title()], int(m[3]), tzinfo=UTC) + timedelta(days=1)
        if times[-1] >= data_end:
            warnings.append("EOP_PREDICTED")

    return GeometrySeries(
        target=target, t_utc=tuple(times), az_deg=a, el_deg=e_, provider="jpl-horizons",
        signature_version=version, raw_sha256=sha256_hex(raw), retrieved_utc=retrieved_utc,
        request=dict(params), correction_mode=CORRECTION_MODE, time_scale=TIME_SCALE,
        flags=tuple(flags), header=facts, warnings=tuple(warnings))


# ----------------------------------------------------------------------------- cache
class ResponseCache:
    """Content of each response is stored verbatim; integrity is verified on every read."""

    def __init__(self, root: Path):
        self.root = Path(root)
        self.root.mkdir(parents=True, exist_ok=True)

    def get(self, key: str) -> tuple[bytes, dict] | None:
        raw_p, meta_p = self.root / f"{key}.json", self.root / f"{key}.meta.json"
        if not raw_p.exists() or not meta_p.exists():
            return None
        import json
        raw, meta = raw_p.read_bytes(), json.loads(meta_p.read_text(encoding="utf-8"))
        if sha256_hex(raw) != meta.get("sha256"):
            raise LunaScopeError(RESOURCE_INTEGRITY_FAILED,
                                 f"cached Horizons response {key[:12]} fails its checksum")
        return raw, meta

    def put(self, key: str, raw: bytes, meta: dict) -> None:
        import json
        meta = dict(meta, sha256=sha256_hex(raw))
        (self.root / f"{key}.json").write_bytes(raw)
        (self.root / f"{key}.meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")


# ----------------------------------------------------------------------------- client
class ExternalRequestLimiter:
    """Exactly one external request in flight (JPL fair use), shared by every job."""

    def __init__(self, min_interval_s: float = 1.0, sleep: Callable[[float], None] = time.sleep):
        self._lock, self.min_interval_s, self._sleep = threading.Lock(), min_interval_s, sleep
        self._last_end = 0.0

    def __enter__(self):
        self._lock.acquire()
        wait = self.min_interval_s - (time.monotonic() - self._last_end)
        if wait > 0:
            self._sleep(wait)
        return self

    def __exit__(self, *exc):
        self._last_end = time.monotonic()
        self._lock.release()


HORIZONS_LIMITER = ExternalRequestLimiter()
RETRYABLE_STATUS = {429, 500, 502, 503, 504}


class HorizonsClient:
    def __init__(self, cache: ResponseCache, http: httpx.Client | None = None,
                 limiter: ExternalRequestLimiter = HORIZONS_LIMITER,
                 sleep: Callable[[float], None] = time.sleep, max_attempts: int = 5,
                 base_backoff_s: float = 2.0, timeout_s: float = 60.0):
        self.cache, self.http, self.limiter, self._sleep = cache, http or httpx.Client(), limiter, sleep
        self.max_attempts, self.base_backoff_s, self.timeout_s = max_attempts, base_backoff_s, timeout_s
        self.user_agent = f"LunaScope/{ALGORITHM_VERSION}"  # product + version only

    def fetch(self, key: str, params: dict[str, str]) -> tuple[bytes, str, bool]:
        """Return (raw bytes, retrieved_utc, from_cache). Cache-first; never substitutes settings."""
        hit = self.cache.get(key)
        if hit is not None:
            return hit[0], hit[1]["retrieved_utc"], True
        last = "no attempt"
        with self.limiter:
            for attempt in range(self.max_attempts):
                try:
                    r = self.http.get(ENDPOINT, params=params, timeout=self.timeout_s,
                                      headers={"User-Agent": self.user_agent})
                except httpx.TransportError as e:
                    last, retry_after = f"network error: {e}", None
                else:
                    if r.status_code == 200:
                        retrieved = datetime.now(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")
                        self.cache.put(key, r.content, {
                            "retrieved_utc": retrieved, "http_status": 200, "endpoint": ENDPOINT,
                            "params": params, "provider": "jpl-horizons",
                            "user_agent": self.user_agent})
                        return r.content, retrieved, False
                    if r.status_code not in RETRYABLE_STATUS:
                        raise LunaScopeError(GEOMETRY_PROVIDER_REJECTED_REQUEST,
                                             f"HTTP {r.status_code}: {r.text[:300]}")
                    last = f"HTTP {r.status_code}"
                    ra = r.headers.get("Retry-After")
                    retry_after = float(ra) if ra and ra.replace(".", "", 1).isdigit() else None
                if attempt + 1 < self.max_attempts:
                    self._sleep(retry_after if retry_after is not None
                                else min(self.base_backoff_s * 2 ** attempt, 60.0))
        raise LunaScopeError(GEOMETRY_PROVIDER_UNAVAILABLE,
                             f"Horizons unavailable after {self.max_attempts} attempts ({last})",
                             retryable=True)


@dataclass
class HorizonsProvider:
    client: HorizonsClient

    identity: ClassVar[dict] = {"name": "jpl-horizons", "endpoint": ENDPOINT, "correction_mode": CORRECTION_MODE,
                "time_scale": TIME_SCALE, "supported_signature_major": SUPPORTED_SIGNATURE_MAJOR}

    def series(self, obs: CanonicalObserver, target: str, times_utc: list[datetime]) -> GeometrySeries:
        if len(times_utc) < 2:
            raise LunaScopeError(INVALID_INPUT, "need at least two times", field="times_utc")
        times = [_utc(t, "times_utc") for t in times_utc]
        step_s = int((times[1] - times[0]).total_seconds())
        if any(int((b - a).total_seconds()) != step_s for a, b in pairwise(times)):
            raise LunaScopeError(INVALID_INPUT, "times must be a uniform grid", field="times_utc")
        params = build_params(obs, target, times[0], times[-1], step_s)
        raw, retrieved, _ = self.client.fetch(cache_key(obs, target, params), params)
        return parse_response(raw, obs=obs, target=target, expected_times=times, params=params,
                              retrieved_utc=retrieved)

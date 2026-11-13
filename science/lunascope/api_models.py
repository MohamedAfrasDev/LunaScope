"""Request models for the public API (spec 11.1, NFR-06): strict, bounded, unknown fields rejected.

Parsed with `model_validate_json` so strict mode accepts ISO-8601 strings for datetimes. Nothing
here accepts a path or URL: terrain is a named profile, custom sites are numbers only.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, ValidationError, field_validator, model_validator

from .errors import INVALID_INPUT, LunaScopeError
from .horizon import HorizonSettings
from .pipeline import RunConfig, SiteSpec

REPO = Path(__file__).resolve().parents[2]
CATALOG_PATH = REPO / "data" / "sites" / "catalog.json"

MIN_START = datetime(2020, 1, 1, tzinfo=UTC)
MAX_START = datetime(2100, 1, 1, tzinfo=UTC)
MAX_BODY_BYTES = 64 * 1024
MAX_SAMPLES = 60_000  # sites x targets x (duration / step), before event refinement
TARGETS = ("sun_center", "earth_center")
DEM_PROFILES = ("lola-80s-20m-adj", "lola-80s-20m-pds")  # named profiles; never a path or URL


class _Strict(BaseModel):
    model_config = ConfigDict(extra="forbid", strict=True, frozen=True)


class Mission(_Strict):
    start_utc: datetime
    duration_s: int = Field(ge=3600, le=30 * 86400)
    step_s: int = Field(default=600, ge=60, le=3600)
    sampling_level: Literal["preview", "standard", "validation"] = "standard"

    @field_validator("start_utc")
    @classmethod
    def _utc(cls, v: datetime) -> datetime:
        if v.tzinfo is None or v.utcoffset().total_seconds() != 0:
            raise ValueError("must be a UTC time ending in Z")
        if not MIN_START <= v < MAX_START:
            raise ValueError("start must be within 2020-01-01 and 2100-01-01 (kernel/provider coverage)")
        if v.second or v.microsecond:
            raise ValueError("start must be a whole minute")
        return v.astimezone(UTC)

    @model_validator(mode="after")
    def _grid(self):
        if self.duration_s % self.step_s:
            raise ValueError("duration must be a whole number of steps")
        return self


class Requirements(_Strict):
    sun_min_availability: float = Field(default=0.6, ge=0.0, le=1.0)
    earth_min_availability: float = Field(default=0.5, ge=0.0, le=1.0)
    outage_budget_s: int | None = Field(default=None, ge=0, le=30 * 86400)


class Terrain(_Strict):
    enabled: Literal[True] = True  # geometric-only is always returned beside it; there is no off switch yet
    dem_profile: Literal["lola-80s-20m-adj", "lola-80s-20m-pds"] = "lola-80s-20m-adj"
    radius_km: float = Field(default=150.0, ge=1.0, le=300.0)
    az_step_deg: float = Field(default=0.1, ge=0.05, le=2.0)
    clearance_margin_deg: float = Field(default=0.0, ge=0.0, le=1.0)
    observer_height_m: float = Field(default=2.0, ge=0.0, le=50.0)

    @field_validator("az_step_deg")
    @classmethod
    def _divides_360(cls, v: float) -> float:
        HorizonSettings(az_step_deg=v).n_az()  # raises ValueError if it does not divide 360
        return v


class CustomSite(_Strict):
    lat_deg: float = Field(ge=-90.0, le=-80.0)  # the loaded DEM tile covers 80S to the pole
    lon_deg: float = Field(ge=-360.0, le=360.0)
    convention: Literal["planetocentric"] = "planetocentric"
    lon_direction: Literal["east_positive", "west_positive"] = "east_positive"
    source: str = Field(min_length=1, max_length=200)
    precision_m: float = Field(ge=0.0, le=10_000.0)

    @field_validator("source")
    @classmethod
    def _no_urls(cls, v: str) -> str:
        if "://" in v or "\\" in v:
            raise ValueError("source is a citation text, not a URL or path")
        return v


class SiteRef(_Strict):
    site_id: str | None = Field(default=None, pattern=r"^[A-Za-z0-9._-]{1,64}$")
    custom: CustomSite | None = None

    @model_validator(mode="after")
    def _one_of(self):
        if (self.site_id is None) == (self.custom is None):
            raise ValueError("give exactly one of site_id or custom")
        return self


class Options(_Strict):
    sensitivity: bool = False  # also run halved azimuth step and the alternate DEM release


class AnalysisRequest(_Strict):
    schema_version: Literal["1"] = "1"
    mission: Mission
    requirements: Requirements = Requirements()
    terrain: Terrain = Terrain()
    sites: list[SiteRef] = Field(min_length=1, max_length=6)
    targets: list[Literal["sun_center", "earth_center"]] = Field(default_factory=lambda: list(TARGETS))
    geometry_provider: Literal["horizons"] = "horizons"
    options: Options = Options()

    @model_validator(mode="after")
    def _bounds(self):
        if sorted(self.targets) != sorted(TARGETS):
            raise ValueError("this version computes both targets: sun_center and earth_center")
        n = len(self.sites) * len(self.targets) * (self.mission.duration_s // self.mission.step_s + 1)
        if n > MAX_SAMPLES:
            raise ValueError(f"{n} samples exceeds the {MAX_SAMPLES} limit")
        return self


class ComparisonRequest(_Strict):
    runs: list[str] = Field(min_length=1, max_length=2)
    sites: list[str] | None = Field(default=None, max_length=6)
    alignment: Literal["elapsed", "calendar"] = "elapsed"

    @field_validator("runs")
    @classmethod
    def _ids(cls, v: list[str]) -> list[str]:
        import re
        if any(not re.fullmatch(r"[0-9a-f]{64}", x) for x in v):
            raise ValueError("run ids are 64 lowercase hex characters")
        if len(v) == 2 and v[0] == v[1]:
            raise ValueError("compare two different runs, or one run with several sites")
        return v

    @field_validator("sites")
    @classmethod
    def _site_ids(cls, v: list[str] | None) -> list[str] | None:
        import re
        if v is not None and any(not re.fullmatch(r"[A-Za-z0-9._-]{1,64}", x) for x in v):
            raise ValueError("site ids use letters, digits, '.', '_' and '-'")
        return v


# ----------------------------------------------------------------------------- parsing
def load_catalog() -> dict:
    return json.loads(CATALOG_PATH.read_text(encoding="utf-8"))


def parse_request(body: bytes) -> AnalysisRequest:
    if len(body) > MAX_BODY_BYTES:
        raise LunaScopeError(INVALID_INPUT, f"request body exceeds {MAX_BODY_BYTES} bytes")
    try:
        return AnalysisRequest.model_validate_json(body)
    except ValidationError as e:
        err = e.errors()[0]
        field = ".".join(str(p) for p in err["loc"])
        raise LunaScopeError(INVALID_INPUT, err["msg"], field=field or None) from e


def parse_comparison(body: bytes) -> ComparisonRequest:
    if len(body) > 4096:
        raise LunaScopeError(INVALID_INPUT, "request body exceeds 4096 bytes")
    try:
        return ComparisonRequest.model_validate_json(body)
    except ValidationError as e:
        err = e.errors()[0]
        raise LunaScopeError(INVALID_INPUT, err["msg"], field=".".join(str(p) for p in err["loc"]) or None) from e


def resolve_sites(req: AnalysisRequest) -> list[SiteSpec]:
    """Preset ids resolve against the committed catalog; custom points are normalised."""
    catalog = {s["site_id"]: s for s in load_catalog()["sites"]}
    out: list[SiteSpec] = []
    for i, ref in enumerate(req.sites):
        if ref.site_id is not None:
            s = catalog.get(ref.site_id)
            if s is None:
                raise LunaScopeError(INVALID_INPUT, f"unknown site_id {ref.site_id!r}",
                                     field=f"sites.{i}.site_id")
            out.append(SiteSpec(s["site_id"], s["lat_deg"], s["lon_east_deg"], s["source"],
                                s["precision_m"]))
        else:
            c = ref.custom
            lon = c.lon_deg % 360.0 if c.lon_direction == "east_positive" else (-c.lon_deg) % 360.0
            sid = ("custom-" + f"{abs(c.lat_deg):.5f}S_{lon:.5f}E").replace(".", "p")
            out.append(SiteSpec(sid, c.lat_deg, lon, c.source, c.precision_m))
    if len({s.site_id for s in out}) != len(out):
        raise LunaScopeError(INVALID_INPUT, "duplicate sites in the request", field="sites")
    return out


def to_run_config(req: AnalysisRequest) -> RunConfig:
    m, r, t = req.mission, req.requirements, req.terrain
    return RunConfig(start_utc=m.start_utc, duration_s=m.duration_s, step_s=m.step_s,
                     sun_min=r.sun_min_availability, earth_min=r.earth_min_availability,
                     radius_km=t.radius_km, az_step_deg=t.az_step_deg,
                     observer_height_m=t.observer_height_m,
                     clearance_margin_deg=t.clearance_margin_deg)


def canonical_request(req: AnalysisRequest, sites: list[SiteSpec]) -> dict:
    """The request as it is hashed: resolved sites, no ordering luck. Site order is significant."""
    d = json.loads(req.model_dump_json())
    d["sites"] = [{"site_id": s.site_id, "lat_deg": s.lat_deg, "lon_east_deg": s.lon_east_deg,
                   "source": s.source, "precision_m": s.precision_m} for s in sites]
    return d

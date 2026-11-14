"""Response models for the endpoints the web app depends on. They drive the OpenAPI document and,
through it, the generated TypeScript types (lib/api/generated.ts). Other responses are still plain
JSON; each model here is checked against real payloads by tests, so a field cannot silently drift.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, ConfigDict

ResultStateName = Literal["synthetic_demonstration", "real_data_unverified", "validated"]
RunStatusName = Literal["queued", "running", "complete", "complete_with_warnings", "failed"]


class _Out(BaseModel):
    model_config = ConfigDict(extra="forbid")


class ErrorDetail(_Out):
    code: str
    message: str
    field: str | None
    retryable: bool
    correlation_id: str | None


class ErrorEnvelope(_Out):
    error: ErrorDetail


class Limits(_Out):
    max_running: int
    max_queued: int
    run_timeout_s: float


class HealthResponse(_Out):
    status: str
    mode: Literal["live", "replay"]
    stack: Literal["synthetic", "live"]
    algorithm_id: str
    result_state: ResultStateName
    resources_ok: bool
    checked: int
    failing: list[str]
    resources_approved: bool
    queue: dict[str, int]
    running: list[str]
    limits: Limits
    recovered_on_start: dict[str, int]
    uptime_s: float


class RunError(_Out):
    code: str | None
    message: str | None


class RunSummaryResponse(_Out):
    run_id: str
    result_id: str | None
    status: RunStatusName
    stage: str | None
    progress: float | None
    result_state: ResultStateName
    attempt: int
    created_utc: str
    finished_utc: str | None
    algorithm_id: str
    attached: bool | None = None
    status_url: str | None = None
    error: RunError | None = None


class VariantAdmissionResponse(RunSummaryResponse):
    parent_run_id: str
    variant_type: Literal["date_shift"]
    changed_fields: list[str]
    start_utc: str
    parent_start_utc: str


class VariantLink(_Out):
    child_run_id: str
    parent_run_id: str
    variant_type: Literal["date_shift"]
    changed_fields: list[str]
    status: RunStatusName
    created_utc: str
    start_utc: str


class VariantsResponse(_Out):
    run_id: str
    start_utc: str
    parents: list[VariantLink]
    children: list[VariantLink]


class ValidationCardResponse(_Out):
    id: str
    title: str
    status: Literal["met", "not_met", "not_evaluated"]
    site_id: str | None
    target: str | None
    facts: list[str]
    scope: str


class ValidationSummary(_Out):
    met: int
    not_met: int
    not_evaluated: int


class ValidationGroup(_Out):
    id: Literal["geometry", "terrain_horizon", "numerical_convergence"]
    title: str
    status: Literal["met", "not_met", "not_evaluated"]
    scope: str
    card_ids: list[str]
    counts: ValidationSummary


class ValidationResponse(_Out):
    run_id: str
    result_state: ResultStateName
    cards: list[ValidationCardResponse]
    groups: list[ValidationGroup]
    scopes_closed: list[str]
    summary: ValidationSummary
    note: str


# ----------------------------------------------------------------------------- sites
class DemCoverage(_Out):
    covered_fraction: float
    fully_covered: bool
    sectors_with_gap: int
    radius_km: float


class CatalogSiteResponse(_Out):
    site_id: str
    label: str
    lat_deg: float
    lon_east_deg: float
    convention: str
    source: str
    precision_m: float
    kind: str
    dem_coverage_150km: DemCoverage


class SitesResponse(_Out):
    note: str
    sites: list[CatalogSiteResponse]


# ----------------------------------------------------------------------------- results
Outcome = Literal["PASS", "FAIL", "INDETERMINATE", "EXCLUDED"]
IntervalClassName = Literal["V", "H", "U", "X", "G"]
SiteStatusName = Literal["PASS", "FAIL_SUN", "FAIL_EARTH", "FAIL_BOTH", "INDETERMINATE", "UNKNOWN_COVERAGE"]


class MetricsResponse(_Out):
    availability_lower: float
    availability_upper: float
    exclusion_reasons: list[str]
    gap_s: float
    hidden_s: float
    known_time_fraction: float | None
    longest_known_hidden_end: float | None
    longest_known_hidden_s: float
    longest_known_hidden_start: float | None
    margin_lower: float
    margin_upper: float
    outcome: Outcome
    threshold: float
    total_s: float
    uncertified_s: float
    unknown_s: float
    visible_s: float
    worst_case_not_visible_s: float
    worst_case_touches_edge: bool


class ClearanceAtNodes(_Out):
    min_deg: float
    median_deg: float
    max_deg: float
    samples: int
    note: str


class CountdownBody(_Out):
    t: float
    state: IntervalClassName
    target: str
    mission_end: float
    kind: str
    text: str
    at: float | None = None
    remaining_s: float | None = None
    solver_bracket_s: float | None = None
    event_type: Literal["rise", "set"] | None = None
    unknown_from: float | None = None
    unknown_until: float | None = None
    band: list[float] | None = None
    quality: str | None = None


class EventRow(_Out):
    t_s: float
    t_utc: str
    type: Literal["rise", "set"]
    solver_bracket_s: float
    geometry_timing_bound_s: float | None
    clearance_rate_deg_per_s: float | None
    quality: str
    horizon: Literal["terrain", "flat"]


class TargetHorizonResult(_Out):
    metrics: MetricsResponse
    clearance_at_nodes: ClearanceAtNodes | None
    countdown_at_start: CountdownBody
    intervals: list[dict] | None = None
    events: list[EventRow] | None = None


class SkySeries(_Out):
    step_s: float
    az_deg: list[float | None]
    el_deg: list[float | None]


class Explanation(_Out):
    code: str
    text: str
    params: dict


class TargetResults(_Out):
    terrain: TargetHorizonResult | None = None
    flat: TargetHorizonResult | None = None
    series: SkySeries | None = None
    explanations: list[Explanation] | None = None


class SiteResultsResponse(_Out):
    site_id: str
    validity: str
    site_status: SiteStatusName
    result_state: ResultStateName
    target_metrics: dict[str, TargetResults]
    warnings: list[str]
    sensitivity: list[dict]


class ResultsResponse(_Out):
    run_id: str
    result_id: str
    status: RunStatusName
    result_state: ResultStateName
    algorithm_id: str
    coverage_fraction: float
    warnings: list[str]
    sites: list[SiteResultsResponse]
    provenance_url: str


# ----------------------------------------------------------------------------- countdown / horizon
class CountdownResponse(CountdownBody):
    run_id: str
    site_id: str
    horizon: Literal["terrain", "flat"]
    result_state: ResultStateName


class HorizonResponse(_Out):
    site_id: str
    result_state: ResultStateName
    azimuth_deg: list[float]
    horizon_el_deg: list[float | None]
    argmax_distance_km: list[float | None]
    sector_state: list[str]
    sectors: dict[str, int]
    settings: dict[str, float]
    skyline_min_deg: float | None
    skyline_max_deg: float | None
    cache_key: str
    terrain_identity: dict
    payload_sha256: str | None = None  # absent on bundles written before it was recorded


# ----------------------------------------------------------------------------- alternatives search
class SearchAdmissionResponse(_Out):
    search_id: str
    parent_run_id: str
    variant_type: Literal["alternatives_search"]
    planned: int
    attached: bool
    objective: str
    status_url: str


class StripSite(_Out):
    site_id: str
    site_status: SiteStatusName
    sun_outcome: Outcome
    earth_outcome: Outcome
    sun_margin: float
    earth_margin: float
    objective_margin: float


class StripError(_Out):
    code: str | None
    message: str | None


class StripDate(_Out):
    offset_s: int
    offset_days: float
    run_id: str | None
    state: Literal["baseline", "pending", "queued", "running", "complete", "complete_with_warnings", "failed"]
    start_utc: str
    verdict: Literal["pass", "fail", "unknown"] | None
    sites: list[StripSite]
    error: StripError | None


class StripCounts(_Out):
    planned: int
    tested: int
    passing: int
    failing: int
    unknown: int
    pending: int
    failed_runs: int


class SearchStripResponse(_Out):
    search_id: str
    parent_run_id: str
    objective: str
    complete: bool
    counts: StripCounts
    dates: list[StripDate]
    largest_margin_among_passing: dict[str, int | None]
    note: str


class SearchListResponse(_Out):
    run_id: str
    searches: list[SearchStripResponse]

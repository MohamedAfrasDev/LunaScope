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


class ValidationResponse(_Out):
    run_id: str
    result_state: ResultStateName
    cards: list[ValidationCardResponse]
    scopes_closed: list[str]
    summary: ValidationSummary
    note: str

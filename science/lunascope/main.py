"""FastAPI service (spec 11): admission, status, results, provenance, export.

The API never computes science. It validates, hashes, admits (or attaches to) a run, and reads
immutable results back. All numbers come from the worker processes via the run store.
"""

from __future__ import annotations

import contextlib
import hashlib
import hmac
import json
import math
import os
import re
import time
import uuid
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, Response
from pydantic import ValidationError

from . import ALGORITHM_VERSION
from .api_models import (
    MAX_BODY_BYTES,
    CustomSite,
    load_catalog,
    parse_comparison,
    parse_request,
    parse_variant,
    shifted_request,
)
from .canonical import canonical_bytes, hash_of
from .cards import run_cards
from .codes import IntervalClass, ResultState
from .compare import INCOMPATIBLE_RUNS, compare_runs, compare_sites
from .countdown import countdown as compute_countdown
from .dem import MANIFESTS, REPO, footprint_coverage
from .errors import INVALID_INPUT, LunaScopeError
from .events import Event, Interval
from .explain import explain_target
from .jobs import JobRunner
from .logs import configure_logging, log_event
from .observer import build_observer
from .reference import load_definition
from .registry import check_all
from .registry import summary as registry_summary
from .responses import (
    CountdownResponse,
    ErrorEnvelope,
    HealthResponse,
    HorizonResponse,
    ResultsResponse,
    RunSummaryResponse,
    SitesResponse,
    ValidationResponse,
    VariantAdmissionResponse,
    VariantsResponse,
)
from .stacks import ServiceConfig, analysis_identity, identity_from_canonical
from .store import NOT_FOUND, QUEUE_FULL, RunStore

EXPORT_BLOCKED_UNVERIFIED = "EXPORT_BLOCKED_UNVERIFIED"
REPLAY_ONLY = "REPLAY_ONLY"
NOT_READY = "NOT_READY"
RUN_ID = re.compile(r"^[0-9a-f]{64}$")
IMMUTABLE_READ = re.compile(
    r"^/api/v1/analyses/([0-9a-f]{64})/(?:results|provenance|countdown|horizon/[A-Za-z0-9._-]{1,64})$")
IMMUTABLE_CACHE = "private, max-age=31536000, immutable"
REVALIDATE_CACHE = "private, no-cache"
HTTP = {INCOMPATIBLE_RUNS: 422, INVALID_INPUT: 422, NOT_FOUND: 404, QUEUE_FULL: 503, NOT_READY: 409,
        EXPORT_BLOCKED_UNVERIFIED: 409, REPLAY_ONLY: 409, "GEOMETRY_PROVIDER_UNAVAILABLE": 502,
        "RESOURCE_INTEGRITY_FAILED": 500}


def config_from_env() -> ServiceConfig:
    return ServiceConfig(
        data_dir=Path(os.environ.get("LUNASCOPE_DATA_DIR", REPO / "var")),
        stack_kind=os.environ.get("LUNASCOPE_STACK", "synthetic"),
        mode=os.environ.get("LUNASCOPE_MODE", "live"),
        api_token=os.environ.get("LUNASCOPE_API_TOKEN") or None)


def _run_id(value: str) -> str:
    if not RUN_ID.match(value):
        raise LunaScopeError(NOT_FOUND, "run ids are 64 lowercase hex characters")
    return value


def _summary(row: dict) -> dict:
    out = {"run_id": row["run_id"], "result_id": row["result_id"], "status": row["status"],
           "stage": row["stage"], "progress": row["progress"], "result_state": row["result_state"],
           "attempt": row["current_attempt"], "created_utc": row["created_utc"],
           "finished_utc": row["finished_utc"], "algorithm_id": row["algorithm_id"]}
    if row["status"] == "failed":
        out["error"] = {"code": row["error_code"], "message": row["error_detail"]}
    return out


def create_app(cfg: ServiceConfig | None = None, *, runner: JobRunner | None = None,
               store: RunStore | None = None) -> FastAPI:
    cfg = cfg or config_from_env()
    store = store or RunStore(cfg.data_dir / "store", max_queued=cfg.max_queued)
    runner = runner or JobRunner(store, cfg)
    started = time.time()
    configure_logging()
    startup_checks = check_all(cfg.raw_dir)  # cheap: presence and size; hashes via scripts/verify_resources.py

    @contextlib.asynccontextmanager
    async def lifespan(app: FastAPI):
        if cfg.mode != "replay":
            runner.start()
        yield
        if cfg.mode != "replay":
            runner.stop()

    app = FastAPI(title="LunaScope science service", version=ALGORITHM_VERSION, lifespan=lifespan)
    app.state.cfg, app.state.store, app.state.runner = cfg, store, runner

    @app.middleware("http")
    async def finished_result_cache(request: Request, call_next):
        """Reads of a finished result are immutable: the artifact is write-once and a stale
        attempt can never publish. They are tagged with the result_id and may be cached for good;
        a matching If-None-Match is answered 304 before any work. Validation cards and the export
        carry their own content tags instead (they can change when a scope closes)."""
        m = IMMUTABLE_READ.match(request.url.path) if request.method == "GET" else None
        if m is None:
            return await call_next(request)
        row = store.get(m.group(1))
        result_id = row["result_id"] if row and row["analysis_artifact"] else None
        if result_id is None:
            return await call_next(request)
        tag = f'"{result_id}"'
        headers = {"ETag": tag, "Cache-Control": IMMUTABLE_CACHE}
        if request.headers.get("if-none-match") == tag:
            return Response(status_code=304, headers=headers)
        resp = await call_next(request)
        if resp.status_code == 200:
            resp.headers.update(headers)
        return resp

    @app.middleware("http")
    async def correlation(request: Request, call_next):
        request.state.cid = request.headers.get("x-correlation-id") or uuid.uuid4().hex
        path = request.url.path
        if cfg.api_token and path.startswith("/api/v1/") and path != "/api/v1/health":
            sent = request.headers.get("authorization", "")
            if not (sent.startswith("Bearer ")
                    and hmac.compare_digest(sent[7:].encode(), cfg.api_token.encode())):
                resp = JSONResponse(LunaScopeError("UNAUTHORIZED", "missing or wrong service token")
                                    .to_dict(request.state.cid), status_code=401)
                resp.headers["X-Correlation-ID"] = request.state.cid
                return resp
        resp = await call_next(request)
        resp.headers["X-Correlation-ID"] = request.state.cid
        return resp

    @app.exception_handler(LunaScopeError)
    async def handle(request: Request, e: LunaScopeError):
        headers = {"Retry-After": "10"} if e.code == QUEUE_FULL else {}
        return JSONResponse(e.to_dict(request.state.cid), status_code=HTTP.get(e.code, 500),
                            headers=headers)

    # ------------------------------------------------------------------ meta
    @app.get("/api/v1/health", response_model=HealthResponse)
    def health() -> dict:
        return {
            "status": "ok", "mode": cfg.mode, "stack": cfg.stack_kind,
            "algorithm_id": f"lunascope-science/{ALGORITHM_VERSION}",
            # nothing is scientifically approved yet, whatever the stack
            "result_state": (ResultState.SYNTHETIC if cfg.stack_kind == "synthetic"
                             else ResultState.REAL_UNVERIFIED).value,
            **registry_summary(startup_checks), "resources_approved": False, "queue": store.counts(), "running": runner.running_ids(),
            "limits": {"max_running": cfg.max_running, "max_queued": cfg.max_queued,
                       "run_timeout_s": cfg.run_timeout_s},
            "recovered_on_start": runner.reconciled, "uptime_s": round(time.time() - started, 1)}

    @app.get("/api/v1/resources")
    def resources() -> dict:
        out = []
        for p in sorted(MANIFESTS.glob("*.json")):
            m = json.loads(p.read_text(encoding="utf-8"))
            out.append({"resource_id": m.get("resource_id"), "role": m.get("role"), "kind": m.get("kind"),
                        "product_id": m.get("product_id"), "readiness": m.get("readiness"),
                        "decision": m.get("decision"), "sha256": m.get("sha256"),
                        "size_bytes": m.get("size_bytes"), "use_terms": m.get("use_terms"),
                        "open_items": m.get("open_items", [])})
        status = {s.resource_id: s.to_dict() for s in check_all(cfg.raw_dir)}
        for r in out:
            r["checks"] = status.get(r["resource_id"])
        return {"resources": out,
                "note": "readiness integrity_verified means the bytes match a pin, not that the "
                        "resource is scientifically approved"}

    @app.get("/api/v1/references/{ref_id}")
    def reference(ref_id: str) -> dict:
        """A golden reference definition (GR-001 ...): the exact request Home submits, with its
        status, so the one-button mission and the reference run are the same inputs."""
        if not re.fullmatch(r"GR-\d{3}", ref_id):
            raise LunaScopeError(NOT_FOUND, "reference ids look like GR-001")
        try:
            d = load_definition(ref_id)
        except FileNotFoundError as e:
            raise LunaScopeError(NOT_FOUND, f"no reference {ref_id}") from e
        return {"reference_id": d["reference_id"], "status": d["status"], "frozen": d.get("frozen"),
                "sites_status": d.get("sites_status"), "request": d["request"]}

    @app.get("/api/v1/sites", response_model=SitesResponse)
    def sites() -> dict:
        cat = load_catalog()
        out = []
        for s in cat["sites"]:
            o = build_observer(site_id=s["site_id"], lat_deg=s["lat_deg"], lon_deg=s["lon_east_deg"],
                               convention="planetocentric", lon_direction="east_positive",
                               reference_radius_km=1737.4, ground_height_m=0.0,
                               ground_height_source="coverage-check", observer_height_above_ground_m=0.0)
            out.append({**s, "dem_coverage_150km": footprint_coverage(o, 150.0)})
        return {"note": cat["note"], "sites": out}

    @app.post("/api/v1/sites/custom")
    async def custom_site(request: Request) -> dict:
        body = await request.body()
        if len(body) > MAX_BODY_BYTES:
            raise LunaScopeError(INVALID_INPUT, "body too large")
        try:
            c = CustomSite.model_validate_json(body)
        except ValidationError as e:
            err = e.errors()[0]
            raise LunaScopeError(INVALID_INPUT, err["msg"],
                                 field=".".join(str(x) for x in err["loc"]) or None) from e
        lon = c.lon_deg % 360.0 if c.lon_direction == "east_positive" else (-c.lon_deg) % 360.0
        o = build_observer(site_id="custom", lat_deg=c.lat_deg, lon_deg=lon, convention=c.convention,
                           lon_direction="east_positive", reference_radius_km=1737.4,
                           ground_height_m=0.0, ground_height_source="coverage-check",
                           observer_height_above_ground_m=0.0)
        return {"lat_deg": c.lat_deg, "lon_east_deg": lon, "convention": c.convention,
                "source": c.source, "precision_m": c.precision_m,
                "source_point_kept_separate": {"lon_deg": c.lon_deg, "lon_direction": c.lon_direction},
                "dem_coverage_150km": footprint_coverage(o, 150.0)}

    # ------------------------------------------------------------------ analyses
    @app.post("/api/v1/analyses", response_model=RunSummaryResponse, status_code=202,
              responses={200: {"model": RunSummaryResponse}, 422: {"model": ErrorEnvelope},
                         503: {"model": ErrorEnvelope}})
    async def create_analysis(request: Request) -> Response:
        req = parse_request(await request.body())
        ident = analysis_identity(req, cfg)
        if cfg.mode == "replay":
            row = store.get(ident.run_id)
            if row is None:
                raise LunaScopeError(REPLAY_ONLY, "this packaged service replays validated runs only")
            return JSONResponse({**_summary(row), "attached": True}, status_code=200)
        adm = store.admit(
            run_id=ident.run_id, request_hash=ident.request_hash, resource_digest=ident.resource_digest,
            algorithm_id=ident.algorithm_id, request_json=ident.request_json(),
            effective_json=json.dumps({"effective": ident.effective_settings, "resources": ident.resources},
                                      sort_keys=True),
            stack_kind=cfg.stack_kind, result_state=ident.result_state)
        log_event("run_admitted", run_id=ident.run_id, outcome="created" if adm.created else "attached",
                  cid=request.state.cid)
        if adm.created:
            runner.notify()  # only the insert winner schedules work
        body = {**_summary(adm.run), "attached": not adm.created,
                "status_url": f"/api/v1/analyses/{ident.run_id}"}
        return JSONResponse(body, status_code=202 if adm.created else 200)

    @app.post("/api/v1/analyses/{run_id}/variants", response_model=VariantAdmissionResponse, status_code=202,
              responses={200: {"model": VariantAdmissionResponse}, 404: {"model": ErrorEnvelope},
                         422: {"model": ErrorEnvelope}, 503: {"model": ErrorEnvelope}})
    async def create_variant(run_id: str, request: Request) -> Response:
        """Time Machine (FR-10, spec 8.4): copy the parent's canonical request, change only the
        start, admit it as an ordinary run and link it. Same inputs as a fresh request = same run."""
        parent = store.require(_run_id(run_id))
        v = parse_variant(await request.body())
        parent_canon = json.loads(parent["request_json"])
        child_canon = shifted_request(parent_canon, v.changes.start_offset_s)
        ident = identity_from_canonical(child_canon, cfg)
        changed = ["mission.start_utc"]
        if cfg.mode == "replay":
            row = store.get(ident.run_id)
            if row is None:
                raise LunaScopeError(REPLAY_ONLY, "this packaged service replays packaged variants only")
            adm_run, created = row, False
        else:
            adm = store.admit(
                run_id=ident.run_id, request_hash=ident.request_hash, resource_digest=ident.resource_digest,
                algorithm_id=ident.algorithm_id, request_json=ident.request_json(),
                effective_json=json.dumps({"effective": ident.effective_settings,
                                           "resources": ident.resources}, sort_keys=True),
                stack_kind=cfg.stack_kind, result_state=ident.result_state)
            adm_run, created = adm.run, adm.created
        store.link(child_run_id=ident.run_id, parent_run_id=run_id, variant_type=v.variant_type,
                   changed_fields=changed)
        log_event("variant_admitted", run_id=ident.run_id, parent_run_id=run_id,
                  outcome="created" if created else "attached", cid=request.state.cid)
        if created:
            runner.notify()
        body = {**_summary(adm_run), "attached": not created,
                "status_url": f"/api/v1/analyses/{ident.run_id}", "parent_run_id": run_id,
                "variant_type": v.variant_type, "changed_fields": changed,
                "start_utc": child_canon["mission"]["start_utc"],
                "parent_start_utc": parent_canon["mission"]["start_utc"]}
        return JSONResponse(body, status_code=202 if created else 200)

    @app.get("/api/v1/analyses/{run_id}/variants", response_model=VariantsResponse,
             responses={404: {"model": ErrorEnvelope}})
    def list_variants(run_id: str) -> dict:
        row = store.require(_run_id(run_id))
        return {"run_id": run_id, "start_utc": json.loads(row["request_json"])["mission"]["start_utc"],
                "parents": store.parents(run_id), "children": store.children(run_id)}

    @app.get("/api/v1/analyses/{run_id}")
    def get_analysis(run_id: str) -> dict:
        row = store.require(_run_id(run_id))
        out = _summary(row)
        if row["analysis_artifact"]:
            a = store.get_analysis(run_id)
            out["warnings"] = a["warnings"]
            out["verified"] = a["verified"]
            out["matrix"] = [{
                "site_id": s["request"]["site"]["site_id"], "site_status": s["site_status"],
                "targets": {t: {h: {"outcome": s["targets"][t][h]["metrics"]["outcome"],
                                    "availability_lower": s["targets"][t][h]["metrics"]["availability_lower"],
                                    "availability_upper": s["targets"][t][h]["metrics"]["availability_upper"],
                                    "threshold": s["targets"][t][h]["metrics"]["threshold"]}
                                for h in ("terrain", "flat")} for t in ("sun_center", "earth_center")}}
                for s in a["sites"]]
        return out

    def _ready(run_id: str) -> dict:
        row = store.require(_run_id(run_id))
        if row["analysis_artifact"] is None:
            raise LunaScopeError(NOT_READY, f"run is {row['status']}", retryable=row["status"] in
                                 ("queued", "running"))
        return store.get_analysis(run_id)

    @app.get("/api/v1/analyses/{run_id}/results", response_model=ResultsResponse, response_model_exclude_unset=True,
             responses={404: {"model": ErrorEnvelope}, 409: {"model": ErrorEnvelope}})
    def results(run_id: str, site: str | None = None, target: str | None = None,
                include: str = "") -> dict:
        a = _ready(run_id)
        inc = {x for x in include.split(",") if x}
        bad = inc - {"intervals", "events", "series"}
        if bad:
            raise LunaScopeError(INVALID_INPUT, f"unknown include {sorted(bad)}", field="include")
        out_sites = []
        for s in a["sites"]:
            sid = s["request"]["site"]["site_id"]
            if site and sid != site:
                continue
            tm = {}
            for t, hs in s["targets"].items():
                if target and t != target:
                    continue
                tm[t] = {}
                for h, v in hs.items():
                    d = {"metrics": v["metrics"], "clearance_at_nodes": v["clearance_at_nodes"],
                         "countdown_at_start": v["countdown_at_start"]}
                    if "intervals" in inc:
                        d["intervals"] = v["intervals"]
                    if "events" in inc:
                        d["events"] = v["events"]
                    tm[t][h] = d
                if "terrain" in hs:
                    tm[t]["explanations"] = explain_target(hs["terrain"], hs.get("flat"))
                if "series" in inc:
                    tm[t]["series"] = s["geometry"][t]["series"]
            out_sites.append({"site_id": sid, "validity": "unverified", "site_status": s["site_status"],
                              "result_state": s["result_state"], "target_metrics": tm,
                              "warnings": s["warnings"],
                              "sensitivity": s.get("sensitivity", [])})
        if site and not out_sites:
            raise LunaScopeError(NOT_FOUND, f"no site {site!r} in this run")
        return {"run_id": a["run_id"], "result_id": a["result_id"], "status": a["status"],
                "result_state": a["result_state"], "algorithm_id": a["algorithm_id"],
                "coverage_fraction": a["coverage_fraction"], "warnings": a["warnings"],
                "sites": out_sites, "provenance_url": f"/api/v1/analyses/{run_id}/provenance"}

    @app.get("/api/v1/analyses/{run_id}/provenance")
    def provenance(run_id: str) -> dict:
        a = _ready(run_id)
        return {
            "run_id": a["run_id"], "result_id": a["result_id"], "algorithm_id": a["algorithm_id"],
            "result_state": a["result_state"], "verified": a["verified"],
            "validated_scopes": a["validated_scopes"], "request": a["request"],
            "effective_settings": a["effective_settings"], "resources": a["resources"],
            "sites": [{
                "site_id": s["request"]["site"]["site_id"], "observer": s["observer"],
                "site_run_id": s["run_id"], "site_result_id": s["result_id"],
                "horizon": {k: v for k, v in s["horizon"].items()
                            if k not in ("azimuth_deg", "horizon_el_deg", "argmax_distance_km", "sector_state")},
                "geometry": {t: {k: v for k, v in g.items() if k not in ("series",)}
                             for t, g in s["geometry"].items()},
                "warnings": s["warnings"], "caveats": s["caveats"]} for s in a["sites"]]}

    @app.post("/api/v1/comparisons")
    async def comparisons(request: Request) -> dict:
        req = parse_comparison(await request.body())
        analyses = [_ready(r) for r in req.runs]
        if len(analyses) == 1:
            return compare_sites(analyses[0], req.sites)
        return compare_runs(analyses[0], analyses[1], req.sites, req.alignment)

    @app.get("/api/v1/analyses/{run_id}/countdown", response_model=CountdownResponse, response_model_exclude_unset=True)
    def countdown(run_id: str, site: str, target: str, t: float, horizon: str = "terrain") -> dict:
        """Server-decided countdown at an arbitrary cursor time (seconds from the window start).
        The browser only subtracts the cursor from the event time this returns."""
        a = _ready(run_id)
        if target not in ("sun_center", "earth_center") or horizon not in ("terrain", "flat"):
            raise LunaScopeError(INVALID_INPUT, "target or horizon is not one of the allowed values",
                                 field="target" if target not in ("sun_center", "earth_center") else "horizon")
        s = next((x for x in a["sites"] if x["request"]["site"]["site_id"] == site), None)
        if s is None:
            raise LunaScopeError(NOT_FOUND, f"no site {site!r} in this run")
        block = s["targets"][target][horizon]
        intervals = [Interval(i["start_s"], i["end_s"], IntervalClass(i["class"])) for i in block["intervals"]]
        events = [Event(e["t_s"], e["type"], e["solver_bracket_s"], e["quality"]) for e in block["events"]]
        end = intervals[-1].end
        if not (math.isfinite(t) and 0.0 <= t <= end):  # NaN, infinite or outside the window
            raise LunaScopeError(INVALID_INPUT, f"t must be within 0 and {end:g} seconds", field="t")
        return {"run_id": a["run_id"], "site_id": site, "horizon": horizon,
                "result_state": s["result_state"], **compute_countdown(intervals, events, t, target)}

    @app.get("/api/v1/analyses/{run_id}/horizon/{site_id}", response_model=HorizonResponse)
    def horizon(run_id: str, site_id: str) -> dict:
        a = _ready(run_id)
        for s in a["sites"]:
            if s["request"]["site"]["site_id"] == site_id:
                return {"site_id": site_id, "result_state": s["result_state"], **s["horizon"]}
        raise LunaScopeError(NOT_FOUND, f"no site {site_id!r} in this run")

    @app.get("/api/v1/analyses/{run_id}/validation", response_model=ValidationResponse,
             responses={404: {"model": ErrorEnvelope}, 409: {"model": ErrorEnvelope}})
    def validation(run_id: str, request: Request, response: Response) -> dict | Response:
        """Validation metadata is tagged separately from the result: its tag is the hash of the
        cards, and it is always revalidated, because a scope can close after the result is sealed."""
        cards = run_cards(_ready(run_id))
        tag = f'"v-{hash_of(cards)[:32]}"'
        headers = {"ETag": tag, "Cache-Control": REVALIDATE_CACHE}
        if request.headers.get("if-none-match") == tag:
            return Response(status_code=304, headers=headers)
        response.headers.update(headers)
        return cards

    @app.get("/api/v1/analyses/{run_id}/export")
    def export(run_id: str, request: Request, verified: bool = False) -> Response:
        """Evidence bundle (FR-13): the sealed analysis plus a frozen snapshot of the validation
        cards as they stand now. Deterministic: the same result and the same cards give the same bytes."""
        a = _ready(run_id)
        if verified:  # only a truthfully validated state may be designated verified
            raise LunaScopeError(EXPORT_BLOCKED_UNVERIFIED,
                                 "no validation scope has closed for this run; export it as an "
                                 "investigative bundle instead")
        cards = run_cards(a)
        raw = canonical_bytes({**a, "export": {
            "schema": "lunascope.export/1", "designation": "investigative",
            "designation_reason": "no validation scope has closed; a verified export is refused until one does",
            "analysis_artifact_sha256": store.require(run_id)["analysis_artifact"],
            "validation_snapshot": {**cards, "cards_sha256": hash_of(cards),
                                    "note": "Frozen when this bundle was exported. Live cards: "
                                            f"/api/v1/analyses/{run_id}/validation"}}})
        sha = hashlib.sha256(raw).hexdigest()
        headers = {"ETag": f'"{sha}"', "Cache-Control": REVALIDATE_CACHE}
        if request.headers.get("if-none-match") == headers["ETag"]:
            return Response(status_code=304, headers=headers)
        return Response(raw, media_type="application/json", headers={
            **headers, "X-Content-SHA256": sha, "X-Result-State": a["result_state"],
            "X-Bundle-Kind": "investigative",
            "Content-Disposition": f'attachment; filename="lunascope-{run_id[:12]}-investigative.json"'})

    return app


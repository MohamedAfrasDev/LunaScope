# LunaScope — Phase Plan and To-Do Tracker

**Companion to:** [Implementation Specification v1.1](LunaScope-Implementation-Spec.md) · [SDR-001 (draft)](sdr/SDR-001.md)
**Last updated:** 13 Nov 2026 · **Code state:** commit `a974125` (73 science tests passing, ruff clean, web lint and build passing)

Legend: `[x]` done and verified in this repo · `[~]` partly done (the note says what is missing) · `[ ]` not started.
Dates are intended work windows, not evidence that a gate will pass.

> **Honest status:** everything computed so far uses **synthetic** terrain and **analytic test functions**. No real lunar data (Horizons, SPICE, DEM) has been used. Nothing in the repository is a validated result.

---

## 1. Progress at a glance

| Phase | Window | Goal | Gate | Status |
| --- | --- | --- | --- | --- |
| **0. Decision & contract gate** | 13 Nov | Settle science/contract decisions before real data | SDR-001 approved | `[~]` draft written, not approved |
| **1. Validity foundation** | 13 Nov | One real site end to end through the science pipeline | **Gate 1** | `[~]` synthetic slice done (~45 %) |
| **2. Core experience** | 14 Nov | Three-site reference run, all workspaces, evidence | **Gate 2** | `[ ]` |
| **3. Extras, presentation, reliability** | 15 Nov | Animation, alternatives, fallback, submission | **Gate 3** | `[ ]` |

```
Phase 0 ████████░░ 80 %   Phase 1 ████░░░░░░ 40 %   Phase 2 ░░░░░░░░░░ 0 %   Phase 3 ░░░░░░░░░░ 0 %
```

**Done so far (summary)**

- [x] Read product spec v2.1 (`.md` and `.pdf`) and analysed the scaffold
- [x] Implementation spec v1.0 → revised to v1.1 after the plan review (I-01 … I-07 applied in the document)
- [x] Repo hygiene: README rewritten as UTF-8, site metadata, `.gitignore`, ESLint ignores
- [x] Science package scaffold with venv, pytest, ruff
- [x] Synthetic numerical slice: canonical hashing, observer, az/el, event engine, metrics, requirement outcomes
- [x] Synthetic terrain horizon engine with nodata/coverage handling
- [x] Two commits: `774dc41`, `a974125`

---

## 2. Phase 0 — Decision and contract gate

Goal: no real-data work starts until these are decided and written down. **Owner: science lead.** Gate: SDR-001 signed off.

- [x] Draft [SDR-001](sdr/SDR-001.md) with 12 decision items and defaults clearly marked
- [x] Adopt one uncertainty/requirement policy (PASS / FAIL / INDETERMINATE / EXCLUDED) — written in spec §7.1, implemented in code
- [x] Define identities: stable `run_id` at admission, sealed `result_id` at completion (spec §8.1)
- [~] **D-01** DEM product: **recommended** primary `LDEM_80S_20MPP_ADJ` (PGDA 2023) + cross-check PDS `LDEM_80S_20M` V2.0. Both downloaded, SHA-256 pinned, metadata verified, full-extent comparison done (RMS 1.76 m), use terms checked. Still open: D-01b quality-mask decision, same-site horizon comparison on both DEMs, sign-off
- [x] **D-02** Frame `MOON_ME` = `MOON_ME_DE440_ME421`; 0.53 m from the DE421 ME frame the DEMs cite (skyline effect <= 0.016 deg); guard tests added. Decided on evidence, awaiting sign-off
- [x] **D-03** Planetocentric, east-positive, 1,737.4 km sphere, heights relative to it: confirmed on the DEMs and against Horizons echo. Awaiting sign-off
- [~] **D-04** Decided (proposed) and measured: Horizons quantity 4 airless vs SPICE `LT+S`, UTC, DE440 kernels pinned; awaiting sign-off, and a longer multi-date comparison
- [x] **D-05** epsilon = 0.01 deg holds with azimuth step <= 0.1 deg (error > 0.01 deg in < 0.01% of azimuths); epsilon sweep flips no outcome. Awaiting sign-off
- [x] **D-06** tau 1 s, w_min 5 s, cap 200 kept: no outcome change across the tested ranges. Awaiting sign-off
- [x] **D-08** Window stays an explicit request input recorded in every bundle; timing error and EOP effects quantified (<= 1.4e-4 deg per second). Awaiting sign-off
- [~] **D-09** Demo points are rule-chosen and labelled non-candidate; 100 m precision. Real demo sites still need the science owner
- [~] **D-10** Tolerance 0.01 arcsec; one date measured. `science/scripts/geometry_agreement.py` ready for 6 dates x 5 sites; blocked on the Horizons contact
- [~] **D-11** User-Agent format and fail-closed code done and tested; the contact value is MISSING (team email or URL needed)
- [~] **D-12** Template (`docs/permissions/ORGANIZER-PERMISSION.md`, NOT ON FILE) and git work log prepared. Needs the organizer's written reply
- [ ] Science owner and product owner sign SDR-001

---

## 3. Phase 1 — Validity foundation (13 Nov)

Ends only when **one real site** passes through the approved geometry provider, one pinned DEM horizon and the shared event/countdown pipeline.

### 1.0 Repo hygiene
- [x] Rewrite `README.md` as clean UTF-8 (removed stray UTF-16 line)
- [x] Replace "Create Next App" metadata with LunaScope title/description
- [x] Extend `.gitignore` (venv, caches, `data/raw`, `data/derived`, `var/`)
- [x] Exclude `science/**` and `data/**` from ESLint
- [x] Create `docs/sdr/`
- [~] Add organizer-permission note to `docs/` (D-12): template added, no permission on file

### 1.1 Inventory of resources
- [x] Record LROC QuickMap, NASA Moon Trek, JPL Horizons as official resources with citations (`docs/resources.md`; the portals are visual only, not numerical inputs)
- [x] Catalog candidate DEM files: two manifests with product ID, version, URL, size, SHA-256, CRS, sphere, units, nodata, registration, coverage and use terms (readiness `integrity_verified`)
- [x] Catalog SPICE kernels (LSK, PCK, SPK, lunar frame kernels) with checksums and time coverage (`data/manifests/spice-kernels.json`)
- [x] Write one manifest per resource in `data/manifests/`: two DEMs, SPICE kernels and Horizons (`horizons-api.json`); the site catalog is part of the API, not a data resource
- [x] Gate: no numerical resource is used without a manifest entry (registry checks every manifest at start; `scripts/verify_resources.py` hashes them all, all pass)

### 1.2 Decide (see Phase 0)
- [ ] Science owner approves SDR-001

### 1.3 Service scaffold
- [x] `science/` package, `pyproject.toml`, venv, pytest, ruff
- [x] Canonical JSON (RFC 8785) and hashing: `run_id`, `result_id` ([canonical.py](../science/lunascope/canonical.py))
- [x] Shared enumerations / status codes ([codes.py](../science/lunascope/codes.py))
- [x] `GET /api/v1/health` reporting `synthetic_demonstration` and `resources_ok: false`
- [x] Pydantic request models: strict, `extra="forbid"`, bounded, no paths/URLs ([api_models.py](../science/lunascope/api_models.py)); responses are plain JSON for now
- [x] Error envelope: stable code, field path, retryable flag, correlation id (header echoed or generated)
- [x] Run store: SQLite (WAL) with unique run ids, attempts, content-addressed write-once artifacts verified on read ([store.py](../science/lunascope/store.py)); no hosted-DB adapter yet
- [x] Resource registry with startup presence/size checks (`registry.py`, `/health` `resources_ok`, `/resources` per-file status) and a full-hash script; `resources_approved` stays false
- [x] Fixture (synthetic) geometry provider, labeled demonstration (identity label, `DEMONSTRATION_DATA` flag and header; result state `synthetic_demonstration`)
- [x] Structured JSON logging (run ID, stage, timing, warning codes; `LUNASCOPE_LOG=json`; no coordinates or tokens logged)
- [~] OpenAPI: `docs/openapi.json` exported by `science/scripts/export_openapi.py`, with a test that fails when it is stale. TypeScript generation is NOT wired: responses are untyped plain JSON, so a generator would produce nothing useful until response models exist (and it needs a new npm dev dependency)

### 1.4 Observer and local frame
- [x] Canonical observer with separate ground-height and mast-height terms
- [x] `ObserverUnresolved` when convention or vertical reference is missing
- [x] Local east/north/up from 3D, stable at the exact pole
- [x] Azimuth/elevation from a direction vector, wrapped differences
- [x] Test case 1: zenith · case 2: horizon plane · case 3: N/E/S/W at several sites incl. pole
- [x] Round-trip property test, longitude wrap and west-positive conversion, bad-input rejection
- [x] Cross-check the pole convention against SPICE: SPICE's own azimuth routine cannot define north at the exact pole, so the check is our east-from-longitude convention vs the recorded Horizons response at -90 deg (0.00002 arcsec) plus SPICE vectors rotated through our own local frame (`test_spice.py`)

### 1.5 Geometry providers
- [x] Horizons client: request builder from the canonical observer (quantity 4, airless, UTC); reproduces the recorded real requests ([horizons.py](../science/lunascope/providers/geometry/horizons.py))
- [x] Parse JSON: explicit `error` field and `signature` checks; confirmed on a real HTTP-200 error response
- [x] Parse `$$SOE…$$EOE` rows by column name; validate count, exact time grid, finite angles, ranges
- [x] Store raw response verbatim + SHA-256 + retrieval time (filesystem `ResponseCache`; SQLite later)
- [x] Geometry cache with full-identity key; integrity checked on every read, corrupted cache blocks instead of refetching
- [x] Global limiter: one Horizons request in flight, exponential backoff + `Retry-After`, `LunaScope/<version>` User-Agent (tested with 8 concurrent threads)
- [x] Hermite interpolation on unit direction vectors with same-grid derivatives; rigorous bounds on |v'|, |v''|, |v| from the Bezier control points ([interpolate.py](../science/lunascope/providers/geometry/interpolate.py))
- [~] Held-out finer series → measure δ_geom and timing bound: done against recorded real 1-minute series (10-minute nodes: max ~1e-8° Sun, ~2e-9° Earth; hourly nodes ~2.6e-6°); the direct sub-minute `TLIST` query fallback is not built
- [x] SPICE provider (`spkcpo` + own `az_el`), kernels pinned by manifest and verified before load ([spice.py](../science/lunascope/providers/geometry/spice.py))
- [x] Residual report Horizons vs SPICE (wrapped az, el) in [validation.py](../science/lunascope/validation.py); measured 0.00002" Sun, 0.0016" Earth on six cases; `LT+S` difference documented in SDR-001
- [x] Gate: provider, convention, residual and coverage tests pass (full suite green, 13 Nov; includes wrong-longitude-direction and wrong-latitude-sign detection)

### 1.6 Terrain and horizon
- [x] `TerrainProvider` contract and synthetic terrains (flat sphere, ridge, crater rim) ([terrain.py](../science/lunascope/terrain.py))
- [x] Horizon engine: max 3D elevation angle per azimuth, curvature included, chunked ([horizon.py](../science/lunascope/horizon.py))
- [x] Missing terrain unknown by default; only a justified bound on the missing region certifies a sector
- [x] Circular lookup; unknown if either neighbouring bin is uncertified
- [x] Clearance `d = elevation − horizon − margin`, `NaN` = unknown
- [x] Cooperative cancellation between chunks; cache key over observer/terrain/settings/algorithm
- [x] Test case 4 (flat sphere dip) · 5 (ridge) · 6 (depressed skyline) · 7 (far obstacle / nodata) · 8 (narrow ridge, synthetic)
- [x] Step-count check: ~7,500 radial steps per ray at default settings
- [x] DEM preprocessing script (`science/scripts/dem_check.py`): hash, grid and label metadata, pixel-centre round trip (8.5e-8 m), terrain-at-pixel-centre equality, ADJ vs PDS window; all pass on the real files. The DEMs are read in place, nothing is rewritten
- [x] `DemTerrain`: polar stereographic matches PROJ to micrometres, pixel-centre bilinear, NaN outside tile/window/next to NaN, GDAL sampling cross-check, both LOLA products ([dem.py](../science/lunascope/dem.py))
- [x] Footprint-wide coverage report (`footprint_coverage`): fraction of the horizon disk inside the tile, sectors with a gap
- [x] Real-terrain horizon checks and refinement: ADJ vs PDS skyline at ten sites (`dem_release_comparison.py`): median RMS 0.076 deg, worst max 2.6 deg, so the release choice dominates epsilon and must be reported; azimuth step 0.1 deg is adequate (SDR-001 D-05, Phase 0 study); radius converged at the first site
- [x] Precomputed horizon storage (`horizon_store.py`): hash-verified `.npz` keyed by the cache key, atomic writes, corrupt file = miss; read measured under 300 ms in a test; pipeline reports `horizon_cached`. Named showcase presets themselves are not chosen (they need the real demo sites, D-09)
- [~] Benchmark: one site, 150 km, 0.5 deg: window load 3.3 s + horizon 1.8 s (0.1 deg: 8.6 s), 937 MB window; budget met. Other machines and cold caches not measured
- [ ] Multi-resolution near/far merge (after the single-DEM pipeline is correct)

### 1.7 Visibility, events, metrics
- [x] Three-way classification (visible / hidden / unresolved) plus uncertified and gap classes
- [x] Interval partition with per-level certification and subdivision ([events.py](../science/lunascope/events.py))
- [x] Brent refinement only on brackets certified single-sign; evaluation cap → uncertified, never "no event"
- [x] Events for rise/set found within tolerance on analytic models; double crossing and tangent cases
- [x] Metrics from intervals: V/H/U, availability bounds, known-time fraction, longest hidden, worst-case-not-visible
- [x] Per-target outcome (`PASS`/`FAIL`/`INDETERMINATE`/`EXCLUDED`) and site summary ([requirements.py](../science/lunascope/requirements.py))
- [x] Glue: `TerrainClearanceModel` from the interpolated geometry + horizon profile, or the flat horizon for the geometric-only comparison ([clearance.py](../science/lunascope/clearance.py))
- [x] Whole-interval Lipschitz bound from Hermite coefficients and every horizon bin crossed; `monotone` only granted inside one linear skyline piece
- [x] `geometry_timing_bound_s` attached to every event with a `near_tangent` flag when the clearance rate is undefined or tiny (pipeline)
- [x] Contact events (`contacts.py`): graze / near_miss / unresolved_dip from runs of the unresolved band with equal neighbours and no event; extremum search is numerical and labeled so; returned per model as `contacts`
- [x] Explanation facts and fixed templates (`explain.py`, returned per target by the results endpoint): hidden whole window, unresolved range, terrain changes outcome, excluded
- [x] Comparison service ([compare.py](../science/lunascope/compare.py), `POST /comparisons`): sites within a run, and two runs with explicit `elapsed` / `calendar` alignment, compatibility check with reasons, held and changed fields, deltas, changed intervals, typed facts (terrain changes outcome, outcomes same/differ, equal availability with different outage, unresolved time matters); no winner, rank or score anywhere
- [x] Validation cards (`cards.py`, `GET /analyses/{id}/validation`, shown in the Evidence panel): geometry agreement, interpolation holdout, skyline certification, azimuth-step convergence, DEM-release sensitivity, and an always `not_evaluated` independent-terrain-check card. Cards are evidence for narrow scopes; none closes a validation scope

### 1.8 Run lifecycle and thin application
- [x] Atomic admit-or-attach on `run_id` in one transaction; `202` before any external work; only the insert winner schedules (12-thread test admits exactly one)
- [x] Bounded runner: 2 running / 8 queued, `QUEUE_FULL` + `Retry-After`, per-run timeout ([jobs.py](../science/lunascope/jobs.py)); existing runs still attach when the queue is full
- [x] Supervised killable worker processes (one OS process per attempt); slot freed only after confirmed exit
- [x] Attempt numbers, staging directory, conditional commit, start-up reconciliation (requeue or fail, staging removed); retry policy: crash x2 then `ATTEMPT_LIMIT`, timeout no retry, handled error keeps its code
- [x] `POST /analyses`, `GET /analyses/{id}`, `/results`, `/provenance`, `/horizon/{site}`, `/export`, plus `/health`, `/resources`, `/sites`, `/sites/custom` ([API.md](API.md)); variants and comparisons not built
- [x] BFF route `app/api/v1/[...slug]/route.ts`: allow-listed routes only, upstream path rebuilt (never copied), query keys validated, cookies and browser headers not forwarded, server-side service token, per-route timeouts (8 s default), 413 over body limits, 502 in the same error envelope ([bff.ts](../lib/bff.ts), [route.ts](../app/api/v1/[...slug]/route.ts))
- [x] First pages: Home (one-button reference mission), New analysis (mission, requirements, terrain, sites, field-level validation), Run (polling, status matrix, warnings, evidence), Timeline (bands, legend, table alternative, CSV). Mission and Sites share one form for now
- [x] Persistent `DataStatusBanner` (reads /health, says so when the service is down) and `ResultStateFrame` around every numeric surface
- [x] Read the Next 16.4 docs for Route Handlers, BFF proxying, caching and Suspense before writing routes: `params` awaited inside `<Suspense>`, no `export const dynamic`, `PageProps`/`RouteContext` types from `next typegen`

### 1.9 Measure
- [x] Record stage timings vs budgets in `docs/perf.md` (single observations; showcase read time and Horizons latency not measured)

### First real run

- [x] `RUN-001` (13 Nov): three rule-chosen sites x 7 days, live Horizons + LOLA 20 m + SPICE, sensitivity variants. At all three sites flat-horizon Sun availability is 100% (PASS) and terrain-aware 0% (FAIL), with the Sun at best 2.5 to 22.7 degrees below the skyline. State `real_data_unverified`. See [the run record](runs/RUN-001-first-real-run.md).

### Gate 1 checklist
- [x] Real sites: Horizons geometry + SPICE residual within tolerance (3 sites x 2 targets, 1,009 samples each; max 0.0017 arcsec) — [RUN-001](runs/RUN-001-first-real-run.md)
- [x] Pinned DEM horizon with manifest (SHA-256, CRS, sphere, units, registration, terms); readiness `integrity_verified`, not scientifically approved
- [x] Shared event list drives durations, outages and countdown (`countdown.py` consumes the same intervals and events)
- [x] End-to-end run through the thin UI: reference mission started from Home on the live stack, progress shown, matrix and evidence match RUN-001 (checked in the browser, 13 Nov)
- [x] Evidence bundle (canonical JSON) with request, settings, resource pins, raw-response hashes, horizon profile, angle series, intervals, events, metrics (sensitivity when requested); `GET /analyses/{id}/export` and a download button in the Evidence panel; a verified export is refused until a scope closes (tested)

---

## 4. Phase 2 — Core experience (14 Nov)

Priority order: validity → relevance → core experience.

### 2.1 Reference run `GR-001`
- [ ] Choose three verified candidate sites with coordinate and terrain provenance (D-09)
- [ ] Freeze the request, window, DEM identity, settings (D-08)
- [ ] Run and cache; record commit, build, algorithm version, checksums
- [ ] Convergence report: step 10 → 1 min, azimuth 0.5° → 0.25° → 0.1°, radius 100/150/200 km
- [ ] Mark unstable cases `SENSITIVITY_HIGH`
- [ ] Disk-edge sensitivity for Earth (S-2, OQ-06)
- [ ] Apply the implementation freeze rule: later changes create `GR-002`, never edit `GR-001`

### 2.2 Workspaces
- [ ] **Mission** — draft form with field-level errors, sample-count preview (FR-01)
- [ ] **Sites** — presets, custom coordinates with convention/source/precision, DEM coverage flag (FR-02)
- [ ] **Run summary** — status matrix, excluded group, progress (FR-03)
- [x] **Local Sky**: polar (north up) and unrolled views, terrain skyline hatched, flat 0 deg horizon, Sun and Earth tracks styled by the service's classification, scrubber, event jumps, countdown, text alternative and table ([SkyView.tsx](../components/SkyView.tsx), [SkyPlots.tsx](../components/SkyPlots.tsx)); static SVG, no canvas layer
- [ ] **Timeline** — aligned Sun/Earth bands, threshold line, interval table, longest outage (FR-07)
- [x] **Compare** (`/runs/{id}/compare`): site selector (at least two, recomputed server-side), held-constant list, changed sites, typed facts by fixed templates, per-target table with the flat horizon labelled as comparison, paired timelines (one row per site, one shared axis) with tables ([CompareView.tsx](../components/CompareView.tsx)); comparing two runs has no page yet
- [ ] **Time Machine** — 5-day shift, linked variant, deltas, alignment mode (FR-10)
- [ ] **Evidence** — provenance, three validation cards, export (FR-09, FR-13)
- [ ] Home — one button starts the reference mission

### 2.3 Cross-cutting
- [~] Countdown rules: the Local Sky countdown is asked from the service at the cursor time (`GET /countdown`), covering at-event, mission-end, no-event, unknown and decision-band cases; the terrain-variant range (sensitivity) is not shown yet
- [~] Alignment modes: the service names them `elapsed` and `calendar` with an explanatory note and refuses non-overlapping calendar windows; the labelled UI control comes with the Time Machine page
- [ ] Evidence bundle export (JSON) with frozen validation snapshot; investigative vs verified designation
- [~] Keyboard-complete core flow; chart text alternatives and table views; pass/fail not by colour alone: icon+word on every state, SVG has title/desc and a table per band, focus rings, skip link, reduced-motion rule; manual keyboard pass and axe checks not done (AC-15)
- [ ] Playwright core-flow test + axe checks
- [ ] Cache reads of finished runs by `result_id`; validation metadata tagged separately

### Gate 2 checklist
- [ ] `GR-001` passes geometry, horizon, aggregation, event-search and convergence checks
- [ ] Three validation cards populated; corrupted-horizon test fails readiness (case 13)
- [ ] Core flow works by keyboard
- [ ] Time Machine five-day shift verified (case 14)

---

## 5. Phase 3 — Extras, presentation, reliability (15 Nov)

Only after Gate 2.

### 3.1 Extras (cut in this order if time runs out: share link → sensitivity UI → alternatives strip → animation → guided mode)
- [x] Animated local sky (FR-18): play/pause, speed, scrub, jump to previous/next event, `prefers-reduced-motion` turns playback off; SVG driven by requestAnimationFrame, measured advancing 0.57 d in 2.5 s at 6 h/s; no canvas layer was needed
- [ ] Alternatives search with tested-dates strip, bounded batches (FR-11)
- [ ] Guided mode from fixed templates (FR-14)
- [ ] "Why the south pole is hard" explainer, one click from the main flow (FR-19)
- [ ] Sensitivity variants UI (FR-12) — the numerical checks stay mandatory
- [ ] Shareable link (FR-15, P2)

### 3.2 Reliability
- [ ] Deploy web (Vercel-compatible) and containerised service with persistent volume and `/health`
- [ ] Smoke-test deployment early (not only at the end)
- [ ] Offline fallback package: build, `MODE=replay`, labelled "Replay mode"
- [ ] Rehearse with the network off (case 16)
- [ ] Test on the event network; signed-out link test (AC-16)
- [ ] Freeze versions; submit early

### 3.3 Presentation and submission
- [ ] Seven slides or 30-second subtitled video (OQ-11)
- [ ] Rehearse the five-minute pitch and five-minute Q&A
- [ ] Project page with 50–200 word summary
- [ ] Cite NASA resources; record dataset/library/image licences
- [ ] AI and software-tool use disclosed; no NASA logos generated or altered
- [ ] Claims audit: nothing undelivered described as delivered
- [ ] No voice or picture of anyone under 18

### Gate 3 checklist
- [ ] Demo ready: validated reference run cached, pitch rehearsed, fallback tested offline
- [ ] Submission ready: public page, summary, demo link, NASA resource evidence, disclosures, signed-out access

---

## 6. The 16 minimum science test cases

| # | Case | Status | Where |
| --- | --- | --- | --- |
| 1 | Target overhead | `[x]` | `tests/unit/test_observer.py` |
| 2 | Target on flat horizon | `[x]` | `test_observer.py` |
| 3 | N/E/S/W = 0/90/180/270 | `[x]` | `test_observer.py` |
| 4 | Flat DEM → curved-surface horizon | `[x]` | `test_horizon.py` |
| 5 | Ridge blocks lower, not higher target | `[x]` | `test_horizon.py` |
| 6 | Depressed skyline visible | `[x]` | `test_horizon.py` |
| 7 | Far obstacle / unsupported sector | `[x]` | `test_horizon.py` |
| 8 | Narrow ridge, finer az/radius | `[~]` synthetic only; real DEM pending | `test_horizon.py` |
| 9 | Two crossings; tangent = contact | `[~]` double crossing and tangent→uncertified done; contact reporting pending | `test_events.py` |
| 10 | Cursor at event / mission end | `[x]` | `test_countdown.py` |
| 11 | Equal availability, different longest outage | `[~]` metric difference done; explanation text pending | `test_requirements.py` |
| 12 | Wrong unit/direction/height fails | `[~]` checked by hand-mutation; no committed test yet | — |
| 13 | Corrupted horizon fails readiness | `[ ]` | — |
| 14 | 5-day shift, own UTC per panel | `[ ]` | — |
| 15 | Out-of-order responses don't overwrite | `[ ]` | — |
| 16 | Network off → fallback opens demo | `[ ]` | — |

**Review adversarial cases (from the plan review)**

- [x] Bounds wholly above / below / straddling the threshold; one PASS + one INDETERMINATE; missing data
- [~] Bounded crossing uncertainty propagates (done) — horizon-knot transition inside an interval (pending)
- [x] Entering the ±ε band without crossing zero; tangent with no sign change
- [x] Nodata gap: sector stays unknown unless a recorded bound covers it
- [ ] Horizons HTTP 200 with JSON `error`; unsupported signature
- [x] Concurrent identical submits schedule one job; timeout kills the process and frees the slot only after exit; stale attempt cannot commit; restart reconciliation (a 15-variant burst is not applicable yet: no variants endpoint)
- [x] Two jobs never exceed one in-flight Horizons request (8 concurrent threads, max in flight = 1)

---

## 7. Plan-review items (I-01 … I-07)

| Item | In the spec | In the code |
| --- | --- | --- |
| I-01 Uncertainty / requirement policy | `[x]` | `[x]` outcomes and site summary |
| I-02 Event certification | `[x]` | `[~]` per-level certification done on test models; real Lipschitz bound pending |
| I-03 Interpolation and Horizons parsing | `[x]` | `[ ]` |
| I-04 Missing terrain | `[x]` | `[x]` synthetic; real DEM pending |
| I-05 Admission and identity | `[x]` | `[~]` hashing done; admission/sealing pending |
| I-06 Horizons concurrency | `[x]` | `[ ]` |
| I-07 Timeout, publication, recovery | `[x]` | `[ ]` |

---

## 8. Risks to watch (from the spec, with current standing)

| # | Risk | Standing |
| --- | --- | --- |
| 1 | Eligibility: pre-event work without written permission | **Open** — D-12, file the permission |
| 2 | Wrong observer / frame / north | Partly mitigated: observer and az/el tested; Horizons/SPICE cross-check pending |
| 3 | Portal mistaken for a pinned DEM; missed ridge | Mitigated in code for nodata; real DEM and refinement pending |
| 4 | Geometry agreement presented as full validation | Pending validation service (three cards) |
| 5 | Same-sign samples hide two events | Mitigated: subdivision + certification tested on analytic models |
| 6 | Baseline and shifted run share one UTC | Pending Time Machine |
| 8 | Mock data mistaken for results | Partly: health reports synthetic; UI labels pending |
| 9 | Scope too large for a solo build | Cut order above; keep one real site first |
| 10 | Horizons/hosting/network failure at the pitch | Pending cache + fallback |
| 11 | DEM / convention / sites not approved in time | **Open** — D-01 … D-09 |

---

## 9. Immediate next actions

1. [ ] Science owner signs off D-01 (recommendation ready) and decides D-02, D-04: **blocks all real-data work**
2. [ ] Approve the 2.7 GB download of `LDEM_80S_20MPP_ADJ.TIF` (optionally also the 1.85 GB PDS file) to compute SHA-256
3. [ ] Write the Horizons provider against recorded responses (parser, error checks, limiter, cache) — can start before the decisions
4. [ ] Build the Hermite interpolation + whole-interval bound so the horizon connects to the event engine
5. [ ] Pydantic request models, error envelope, SQLite `RunRepository`
6. [ ] File the organizer permission (D-12)

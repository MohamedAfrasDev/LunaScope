# LunaScope — Phase Plan and To-Do Tracker

**Companion to:** [Implementation Specification v1.1](LunaScope-Implementation-Spec.md) · [SDR-001 (draft)](sdr/SDR-001.md)
**Last updated:** 14 Nov 2026 · **Code state:** `main` at `9a153be` (GR-001 frozen, record in `docs/runs/GR-001/`) plus the uncommitted live-fallback work; 376 science tests, 147 web tests, ruff, typecheck, lint and `next build` passing; 5 Playwright tests and 1 offline-fallback spec passing locally; no CI service exists, so `npm run verify` and the commands in the README are the gate)

Legend: `[x]` done and verified in this repo · `[~]` partly done (the note says what is missing) · `[ ]` not started.
Dates are intended work windows, not evidence that a gate will pass.

> **Honest status:** every result is labelled `synthetic_demonstration` or `real_data_unverified`. One real-data run exists: [RUN-001](runs/RUN-001-first-real-run.md) (three rule-chosen sites, seven days, live Horizons + LOLA 20 m + SPICE). The golden reference run `GR-001` has **not** been run on live data and its sites are placeholders. Nothing in the repository is a validated result.

---

## 1. Progress at a glance

| Phase | Window | Goal | Gate | Status |
| --- | --- | --- | --- | --- |
| **0. Decision & contract gate** | 13 Nov | Settle science/contract decisions before real data | SDR-001 approved | `[~]` decisions made on evidence (~70 %), none signed off: SDR-001 is unsigned |
| **1. Validity foundation** | 13 Nov | One real site end to end through the science pipeline | **Gate 1** | `[x]` Gate 1 checklist complete (5 of 5, via RUN-001). Phase not formally closed: SDR-001 unsigned, near/far terrain merge not built |
| **2. Core experience** | 14 Nov | Three-site reference run, all workspaces, evidence | **Gate 2** | `[~]` GR-001 is **frozen** and passes Gate 2's five checks on a clean-commit, no-network re-run (14 Nov). Not closed: the terrain-horizon validation card reads "not evaluated" (no independent skyline implementation), and SDR-001 is unsigned |
| **3. Extras, presentation, reliability** | 15 Nov | Animation, alternatives, fallback, submission | **Gate 3** | `[~]` started 14 Nov: extras and the fallback built; deployment, the live package and the human items are open |

```
Phase 0 ███████░░░ 70 %   Phase 1 █████████▌ 95 %   Phase 2 █████████▌ 95 %   Phase 3 █████░░░░░ 50 %
```

Percentages are the share of each phase's own checklist that is done (a partly done item counts as half, checked 14 Nov). They are not effort or gate readiness. **Gate 1's checklist is complete; Gates 2 and 3 are not passed**: `GR-001` is frozen and passes its Gate 2 checks, but one validation card is not evaluated and SDR-001 is unsigned.

**Done so far (summary)**

- [x] Read product spec v2.1 (`.md` and `.pdf`) and analysed the scaffold
- [x] Implementation spec v1.0 → revised to v1.1 after the plan review (I-01 … I-07 applied in the document)
- [x] Repo hygiene: README rewritten as UTF-8, site metadata, `.gitignore`, ESLint ignores
- [x] Science package scaffold with venv, pytest, ruff
- [x] Synthetic numerical slice: canonical hashing, observer, az/el, event engine, metrics, requirement outcomes
- [x] Synthetic terrain horizon engine with nodata/coverage handling
- [x] Phase 1: Horizons and SPICE geometry, LOLA terrain horizon, certified events, run lifecycle, thin UI, and the first real run (RUN-001)
- [x] Phase 2: Time Machine, Evidence workspace and export, caching, reference-run tooling (readiness, convergence, freeze rule), Playwright keyboard and axe tests
- [x] Phase 3: alternatives search, guided mode, explainer, sensitivity panel, share link, offline fallback (synthetic), container images built and run locally, submission drafts
- [x] Pull requests #1 to #4 merged to `main`

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
- [x] OpenAPI -> TypeScript: response models for health, sites, run admission/summary, results (incl. explanations), countdown, horizon, validation cards and the error envelope (`responses.py`), validated against every endpoint test and the real RUN-001 payloads; `docs/openapi.json` (staleness test) -> `lib/api/generated.ts` via `npm run gen:api`, checked by `npm run check:api` inside `npm run verify`. Sites, Health, RunSummary and validation types come from it. Results, countdown and horizon keep stricter hand-written types guarded one level deep by `lib/api/compat.ts` (the generated shapes are looser: nullable and optional fields the UI treats as present). Provenance and comparison responses are still untyped JSON. No CI service exists in this repo, so `npm run verify` is the gate

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
- [x] Precomputed horizon storage (`horizon_store.py`), now used by the service for every run (`<data_dir>/horizons`): a Time Machine shift reuses its baseline's skylines (tested): hash-verified `.npz` keyed by the cache key, atomic writes, corrupt file = miss; read measured under 300 ms in a test; pipeline reports `horizon_cached`. Named showcase presets themselves are not chosen (they need the real demo sites, D-09)
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
- [x] Sites (D-09), decided for GR-001 on 14 Nov by the project owner: the three **rule points** (latitude -89.5 deg at 0, 120 and 240 E), fixed by an equal-spacing rule before any result was seen, as a **declared reference scenario, not candidate landing sites**. Recorded in `data/reference/GR-001.json` and SDR-001. Science-owner sign-off is still pending. Real candidate sites, with coordinate and terrain provenance, would be a new reference version (GR-002)
- [x] Freeze the request, window, DEM identity, settings (D-08): **frozen on 14 Nov** on the project owner's go-ahead. `data/reference/GR-001.json` pins the live-stack run id (`a06f9440...`, which includes the DEM and SPICE kernel hashes and the algorithm version); `check_freeze` refuses to run if any pinned input changes, and the answer is then GR-002, never an edit. Guards: `test_the_committed_gr001_pin_still_matches_its_inputs_on_the_live_stack` and `test_gr001_record.py` (both shown to fail when the definition is touched). Science-owner sign-off on SDR-001 is still pending
- [x] Run and cache; record commit, build, algorithm version, checksums: the frozen run was made from the **clean freeze commit** `75b7e6b` into `docs/runs/GR-001/` (manifest: commit, `dirty: false`, algorithm 0.2.0-phase1, definition hash, resource pins, and each site's bundle, skyline and Horizons-response hashes); record [runs/GR-001-run.md](runs/GR-001-run.md). It was re-run with **no Horizons contact set**, so no request could have been sent, and it reproduced the earlier draft run exactly: run and result ids, every interval, event and metric, skyline digests, Horizons response hashes and convergence
- [x] Convergence report, on real data: all five cases (time step 60 s, azimuth 0.5 and 0.25 deg, radius 100 and 200 km) ran at all three sites; **none is flagged `SENSITIVITY_HIGH`**; no outcome or event count changes, availability moves by at most 0.02 percentage points, and event times by at most 119 s (Earth at `rule-89.5S-E0`, coarsest azimuth step). The near-field on/off case is recorded as not applicable (no multi-resolution merge exists). Earlier offline partial: [RUN-001-convergence.md](runs/RUN-001-convergence.md)
- [x] Mark unstable cases `SENSITIVITY_HIGH` (`apply_convergence`; tested: a 1 km radius cutting off a 5 km ridge is flagged)
- [x] Disk-edge sensitivity (S-2, OQ-06): every run now carries a bracket for the Sun and Earth (`disk_edge.py`): the upper limb (visible when any part of the disc clears the skyline), the centre (used everywhere), and the whole disc, recomputed with the same geometry, skyline and event search by moving the clearance margin by the angular radius (Sun 0.27 deg, Earth 0.95 deg; Earth's 0.90 to 1.03 variation is stated, not modelled). Tested against hand-derived rise times. Shown on the Evidence page ("Disc size: centre or edge?") and in `GET .../provenance`; it is outside the hashed result, so run and result ids do not change. **On the real RUN-001 sites** ([record](runs/RUN-001-disk-edge.md), computed offline from the stored bundles): no outcome changes at any site; Earth's availability moves by roughly 10 percentage points either way, and at `S89.5-E240` Earth still passes on the whole-disc reading with only 3.8 points to spare; the Sun fails at every site even on the upper limb
- [x] Apply the implementation freeze rule: a frozen definition pins its run_id; `check_freeze` raises "create GR-002" when any scientific input changes (tested by changing the radius)

### 2.2 Workspaces
- [x] **Mission**: field-level errors mirroring the service bounds, live sample-count preview against the 60,000 limit, a per-tab draft (sessionStorage, guarded) that survives navigation, and "Reset to the reference mission" (FR-01). Mission and Sites share one form
- [x] **Sites**: presets with source, precision and coverage flag; custom points with convention, direction, source and precision, and a per-point "Check terrain coverage" (`POST /sites/custom`) showing the normalised analysis point, the source point kept separate, and the covered fraction / unknown sectors; a result is hidden once its inputs change (FR-02)
- [x] **Run summary**: status matrix, progress, and an excluded group: `UNKNOWN_COVERAGE` sites are listed apart as not decided, never as failures (FR-03)
- [x] **Local Sky**: polar (north up) and unrolled views, terrain skyline hatched, flat 0 deg horizon, Sun and Earth tracks styled by the service's classification, scrubber, event jumps, countdown, text alternative and table ([SkyView.tsx](../components/SkyView.tsx), [SkyPlots.tsx](../components/SkyPlots.tsx)); static SVG, no canvas layer
- [x] **Timeline**: aligned Sun/Earth bands, an availability bar per target with the requirement as a threshold line (bound shown lower to upper), longest known outage bracketed on the band, total known hidden time, interval tables and CSV (FR-07)
- [x] **Compare** (`/runs/{id}/compare`): site selector (at least two, recomputed server-side), held-constant list, changed sites, typed facts by fixed templates, per-target table with the flat horizon labelled as comparison, paired timelines (one row per site, one shared axis) with tables ([CompareView.tsx](../components/CompareView.tsx)); comparing two runs has no page yet
- [x] **Time Machine** (`/runs/{id}/time-machine`): `POST /analyses/{id}/variants` (`date_shift`, start only, ±30 d, whole minutes) admits an ordinary run and links it (`run_links`); a fresh request with the same inputs is the same run; `GET /analyses/{id}/variants` lists parents and children. Page: day offset with field errors, shifted-runs list, labelled elapsed/calendar control, held/changed fields, per-site per-target deltas and outcome changes, two panels each on its own UTC with countdown at start and timelines, changed spans on both clocks; late replies for another alignment are dropped. Replay mode serves packaged variants only. Checked in a headless browser on the synthetic stack (13 Nov). Tested-dates strip with pass/fail counts and alternatives search are Phase 3 (FR-11) **A real-data five-day shift has now been run** ([record](runs/GR-001-plus5d.md)): Earth passes at 100% at two sites after the slip (up from 74.5% and 65.0%), and the Sun at `rule-89.5S-E240` goes from 0% to 51.2% (still below its 60% need) with two new events. It carries `SENSITIVITY_HIGH` at that site: the finer azimuth step cannot certify a 4.7 s sliver at the Sun's rise (below the 5 s minimum width), while the availability bounds are identical; documented, policy unchanged. It is a variant, not part of the frozen reference, and has no convergence report
- [x] **Evidence** (`/runs/{id}/evidence`): three validation cards (Sun and Earth geometry, terrain horizon, numerical convergence), rolled up by the service (`groups`: not met if any check failed, met only if every check ran and passed, otherwise not evaluated), each with its checks; identity and pins; method and inputs; per-site observer, provider, corrections, time scale, response hashes, SPICE residual, holdout, skyline key and digest; limits; investigative export. The run page shows the three card states and links here (FR-09, FR-13)
- [x] Home: one button submits GR-001 exactly as `GET /references/GR-001` serves it, so the demo and the reference run share one run id (tested); says GR-001 is a draft with demonstration sites

### 2.3 Cross-cutting
- [x] Countdown rules: the Local Sky countdown is asked from the service at the cursor time (`GET /countdown`), covering at-event, mission-end, no-event, unknown and decision-band cases. Under a predicted event it now says by how much that time moves across the terrain variants (finer azimuth step, other DEM release) from the service's own `max_event_shift_s`, warns if a variant finds a different number of events, and says plainly when no sensitivity check was run
- [x] Alignment modes: the service names them `elapsed` and `calendar` with an explanatory note and refuses non-overlapping calendar windows; the Time Machine has the labelled control and shows the shared window
- [x] Evidence bundle export (JSON) with frozen validation snapshot (`export.validation_snapshot` with the cards, groups and their hash), the analysis artifact hash, `designation: investigative`, deterministic bytes; verified designation refused (409) until a scope closes
- [x] Keyboard-complete core flow, checked by Playwright pressing Tab/Enter/arrow keys only (Home → reference mission → matrix → Time Machine → alignment → Evidence → download); chart text alternatives and table views; icon+word on every state; focus rings, skip link, reduced-motion rule. axe found the faded flat-horizon column below AA contrast; fixed (dashed rule instead of opacity). A manual screen-reader pass is still not done (AC-15)
- [x] Playwright core-flow test + axe checks (`npm run test:e2e`, `tests/e2e/core-flow.spec.ts`, synthetic stack): two tests, eight pages pass axe WCAG 2.1 A/AA. Playwright pinned to 1.64.0 to use the locally cached Chromium; not part of `npm run verify` (needs both servers)
- [x] Cache reads of finished runs by `result_id`: results, provenance, countdown and horizon carry `ETag: "<result_id>"` with `immutable` and answer `If-None-Match` with 304 before any work (inside the token check); parsed analyses kept per artifact SHA-256 (LRU of 8). Validation cards and the export carry their own content tags with `no-cache`. The BFF passes these headers and 304 through; everything else stays no-store

### Gate 2 checklist
- [x] `GR-001` passes geometry, horizon, aggregation, event-search and convergence checks, **on the frozen run**: `reference.gate_report` defines the five checks over the saved bundles (a check passes only if it ran and held; `not_evaluated` also keeps the gate shut; each can fail, tested). `scripts/reference_run.py gate docs/runs/GR-001` runs them and `test_gr001_record.py` keeps them true: SPICE within 0.0017 arcsec, every skyline sector certified, results re-derive, no uncertified interval and all 5 events inside the root tolerance, convergence unflagged. Passing says the run is sound and converged, **not** that the science is validated
- [~] Three validation cards populated: on the live run, **geometry: met** (12 checks), **numerical convergence: met**, **terrain horizon: not evaluated** (6 met, 3 not evaluated) because no second, independent skyline implementation exists to compare against. Building one would let that card read met; until then it honestly cannot. Corrupted-horizon test fails readiness (case 13) **done**: `reference.readiness` recomputes the skyline digest and re-derives events, intervals and metrics from the stored series and skyline
- [x] Core flow works by keyboard (Playwright, keyboard only)
- [x] Time Machine five-day shift verified (case 14): `test_variants.py` (own UTC, events, countdown per run; calendar refusal) and `time-machine.test.tsx` (panels on their own clocks); Playwright spec still pending

---

## 5. Phase 3 — Extras, presentation, reliability (15 Nov)

Only after Gate 2.

### 3.1 Extras (cut in this order if time runs out: share link → sensitivity UI → alternatives strip → animation → guided mode)
- [x] Animated local sky (FR-18): play/pause, speed, scrub, jump to previous/next event, `prefers-reduced-motion` turns playback off; SVG driven by requestAnimationFrame, measured advancing 0.57 d in 2.5 s at 6 h/s; no canvas layer was needed
- [x] Alternatives search with tested-dates strip (FR-11): `POST /analyses/{id}/variants` with `alternatives_search` plans up to 15 dates up front and returns `202`; a pump in the runner loop admits them at most two at a time and pauses when the queue is full. The search holds no CPU slot and is idempotent (same parent and dates, same search). `GET .../searches/{id}` gives one row per date and site, with counts in which a pending or failed date is never a pass or a fail; the stated objective names only the passing date with the largest margin (no score or ranking). UI under "Which dates pass?" in the Time Machine. Tested on synthetic (`test_alternatives.py`, `alternatives.test.tsx`, Playwright). **Not run on real data**
- [x] Guided mode from fixed templates (FR-14): a Guided/Technical toggle in the header (remembered per browser, works with storage blocked). Guided sentences are keyed on the service's fact codes and filled from their parameters, falling back to the service's own wording for an unknown code; a test fails if the service gains a fact code without a template. Shown on the Timeline (the explanation facts were not displayed anywhere before). Technical mode shows the service's own wording
- [x] "Why the south pole is hard" explainer (FR-19): `/why-the-south-pole-is-hard`, one click from Home and the header; well-established facts and one worked arithmetic example, a diagram labelled as a schematic, and a "what this page is not" note; passes axe
- [x] Sensitivity variants UI (FR-12): Timeline panel for the azimuth-step and DEM-release variants, with every figure and the high-sensitivity flag taken from the service (availability change, outcome change, event count and shift), flagged in words. The numerical checks stay mandatory; the full convergence report still needs the live GR-001 run
- [x] Shareable link (FR-15, P2): carries the form inputs only (strictly decoded: bounded, whitelisted, versioned); opening it fills the form and runs nothing; a hostile or unreadable link is ignored and says so

### 3.2 Reliability
- [~] Deploy web (Vercel-compatible) and containerised service with persistent volume and `/health`: `deploy/service.Dockerfile`, `deploy/web.Dockerfile`, `deploy/compose.yml` and `docs/deploy.md` are written, with health checks and a non-root service user. **Built and run locally on 14 Nov, nothing deployed:** both images build, the stack is healthy, `smoke.mjs` passes 10 of 10, the service is non-root, the token is enforced, data persists in the volume across a restart, and the fallback package opens in a replay container. Fixed on the way: `pyproject.toml` omitted `spiceypy`, `rasterio` and `pyproj`; `@types/node@^20` conflicted with Vitest's `^22` peer so `npm ci` failed under Node 22's npm 10 (now `^22.20.5`, lockfile regenerated with npm 10, no package version changed); the web Dockerfile copied a `public/` folder that no longer exists
- [~] Smoke-test deployment early: `scripts/smoke.mjs` (health, GR-001, run, label and 304, export hash, three pages) passes 10 of 10 against the local synthetic stack and against the locally built containers; it has not run against anything deployed
- [x] Offline fallback package: `build_fallback.py build` runs GR-001 and its five-day shift through the real service and packages the store with a manifest (commit, algorithm version, artifact hashes, and how many Horizons responses were reused versus newly fetched) and a README. Replay mode shows a **Replay mode** badge and says so in plain words; an unpackaged request reads "offline copy", not a raw code. **A real-data package has been built (14 Nov, 10.5 MB, stack `live`)**: its GR-001 run id equals the frozen pin and its three sites equal the frozen record exactly (run and result ids, intervals, events, metrics, skyline and Horizons-response hashes); the five-day shift needed **24 newly fetched Horizons responses** (the other 78 were reused). It is **gitignored and local to this machine**, and was built from a tree with uncommitted changes, so rebuild it from a clean commit before the pitch (every response is now cached, so that needs no network)
- [x] Rehearse with the network off (case 16), on the **live package**: `build_fallback.py check --stack live` blocks every non-loopback socket and DNS lookup (the guard is itself tested to block) and confirms each run is served and hash-matched, the Home request and the five-day shift resolve to packaged runs, an unpackaged shift is refused, and zero network attempts happened (17 of 17). `LUNASCOPE_FALLBACK_STACK=live npm run test:e2e:fallback` opens the real-data demo in a browser and checks no request leaves for another host. Done earlier on a synthetic package too
- [ ] Test on the event network; signed-out link test (AC-16)
- [ ] Freeze versions; submit early

### 3.3 Presentation and submission
- [ ] Seven slides or 30-second subtitled video (OQ-11): not written. `docs/submission/SUBMISSION-DRAFT.md` has the project summary (156 words, no results in it) and a pitch outline mapped to the pages; slide or video content needs people and the locked run
- [ ] Rehearse the five-minute pitch and five-minute Q&A
- [ ] Project page with 50–200 word summary
- [~] Cite NASA resources; record dataset/library/image licences: `docs/submission/LICENCES-AND-CITATIONS.md` (data terms from the manifests; direct dependency licences read from the installed packages; **transitive dependencies not listed**; the LOLA ADJ terms are not confirmed in writing; the SPICE terms wording and the Geist font licence are marked to confirm). The five unused scaffold images were removed
- [~] AI and software-tool use disclosed: `docs/submission/DISCLOSURES.md` is a **draft for the team to confirm** against the event's rules; no NASA logo is used, generated or altered
- [x] Claims audit: `docs/submission/CLAIMS-AUDIT.md` lists each claim with its status and what must not be said. Not delivered: GR-001 passing the gates, any hosted deployment, a live fallback package. Re-run it against the final submission text
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
| 12 | Wrong unit/direction/height fails | `[x]` | `test_wrong_inputs.py` (hand-derived ridge angles at the engine's sampling; unit, height and mirror mistakes shown to land far outside tolerance), `test_spice.py` (longitude direction, latitude sign), `test_observer.py` |
| 13 | Corrupted horizon fails readiness | `[x]` | `test_reference.py` |
| 14 | 5-day shift, own UTC per panel | `[x]` API + component; Playwright spec pending | `test_variants.py`, `tests/web/time-machine.test.tsx` |
| 15 | Out-of-order responses don't overwrite | `[x]` run page, compare, sky countdown, Time Machine; fetches ignore the abort signal and the older reply arrives last. The sky countdown test was shown to fail without its guard (a real bug, now fixed) | `tests/web/out-of-order.test.tsx`, `tests/web/time-machine.test.tsx` |
| 16 | Network off, fallback opens demo | `[x]` on the live (real-data) package and a synthetic one | `test_fallback.py`, `build_fallback.py check`, `tests/e2e-fallback/offline.spec.ts` |

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
| I-02 Event certification | `[x]` | `[x]` per-level certification and the whole-interval Lipschitz bound from the Hermite coefficients and skyline bins |
| I-03 Interpolation and Horizons parsing | `[x]` | `[x]` Hermite interpolation with rigorous bounds; Horizons parser with error, signature and grid checks |
| I-04 Missing terrain | `[x]` | `[x]` unknown unless a recorded bound covers it; on the real DEMs (`DemTerrain`, coverage report) |
| I-05 Admission and identity | `[x]` | `[x]` atomic admit-or-attach on `run_id`; `result_id` sealed at completion |
| I-06 Horizons concurrency | `[x]` | `[x]` one request in flight, backoff and `Retry-After` (tested with 8 threads) |
| I-07 Timeout, publication, recovery | `[x]` | `[x]` killable worker processes, conditional commit, start-up reconciliation |

---

## 8. Risks to watch (from the spec, with current standing)

| # | Risk | Standing |
| --- | --- | --- |
| 1 | Eligibility: pre-event work without written permission | **Open** — D-12, file the permission |
| 2 | Wrong observer / frame / north | Mitigated: observer and az/el tested; SPICE agrees with Horizons to 0.0017 arcsec (RUN-001); wrong longitude direction, latitude sign, unit and height are caught by tests (case 12). Conventions are decided but not signed off (D-02) |
| 3 | Portal mistaken for a pinned DEM; missed ridge | Mitigated: two DEM releases pinned by SHA-256; unknown is never treated as flat; azimuth step studied. The choice of DEM release still moves the skyline (worst site about 2.6 deg) and is reported, not hidden |
| 4 | Geometry agreement presented as full validation | Mitigated: three cards with narrow scopes; the terrain-horizon card reads "not evaluated" (no independent skyline exists); no scope has closed |
| 5 | Same-sign samples hide two events | Mitigated: subdivision + certification tested on analytic models |
| 6 | Baseline and shifted run share one UTC | Mitigated: each run keeps its own UTC; alignment mode is explicit and tested (case 14) |
| 8 | Mock data mistaken for results | Mitigated: persistent data-status banner, a state frame on every numeric surface, a Replay mode badge, and result states on every export |
| 9 | Scope too large for a solo build | Largely met: the buildable scope is done; what remains is human decisions and real-data runs |
| 10 | Horizons/hosting/network failure at the pitch | Mostly mitigated: Horizons responses cached verbatim; a **real-data** replay-mode fallback is built and rehearsed offline (service and browser). Not yet mitigated: nothing is deployed, the package is local to one machine (gitignored), and it must be rebuilt from a clean commit and copied to the pitch machine |
| 11 | DEM / convention / sites not approved in time | Partly open: D-09 is decided for GR-001 (rule points, a declared reference scenario) and GR-001 is frozen on the project owner's go-ahead, but D-01 to D-08 and SDR-001 still await the science owner's sign-off |

---

## 9. Immediate next actions

Done since 13 Nov: the DEM downloads, the Horizons provider, interpolation and the whole-interval bound, request models and the run store; **D-11** (the project's GitHub URL is used as the Horizons contact, set per run through `LUNASCOPE_CONTACT` and not stored in the repository); **D-09** for GR-001; GR-001 run live, converged and **frozen**. What remains:

1. [x] **Live fallback package** built from the frozen GR-001 and rehearsed offline (done 14 Nov). Still to do: rebuild it from a clean commit, keep a copy on the pitch machine and a second copy, and re-run `build_fallback.py check` there with the Wi-Fi off
2. [ ] Deploy web and service somewhere reachable and run `scripts/smoke.mjs` there, signed out
3. [ ] File the organizer permission (**D-12**); science owner and product owner sign **SDR-001** (D-01 to D-08, D-10)
4. [ ] Optional but it changes a card: build a **second, independent skyline implementation** so the terrain-horizon validation card can read `met` instead of `not evaluated`
5. [ ] Slides or video; confirm the disclosure and licence wording; manual screen-reader pass

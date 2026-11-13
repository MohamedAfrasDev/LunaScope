# LunaScope Product and Technical Specification v2.1

NASA Space Apps Challenge 2026 · Terrain-Aware Lunar Power and Direct-to-Earth Opportunity Navigator · Nov 13, 2026 · @Afras

## 1. At a glance

LunaScope is a web tool for early-stage lunar mission planners who need to compare candidate south-pole sites and mission dates for sunlight and direct-to-Earth opportunity. It shows the Sun and Earth against the local terrain horizon, identifies outages, and explains what changes when a mission date moves. It is a screening and education tool, not a certification of landing safety, electrical power, communications performance or complete mission feasibility.

| Item | Summary |
| --- | --- |
| Question it answers | Are the Sun (power) and Earth (direct link) visible above the terrain at this site, for how long, and when is the next sunset or Earthset? |
| Primary user | Early-stage lunar mission planner or systems engineer |
| Secondary users | University mission teams, science reviewers, educators, students and public explorers |
| Core loop | Pick sites and a mission window, see the local sky, shift the date, compare, check the evidence |
| NASA data at the core | JPL Horizons for lunar-surface Sun/Earth geometry; terrain products discovered through LROC QuickMap and NASA Moon Trek. The exact numerical DEM product remains a verification gate |
| Lead claim for judging | A terrain-aware local sky whose every number can be traced to its data. The Time Machine is the fast-comparison feature, not the headline |
| Status | v2.1 integration baseline, 13 Nov 2026. NASA-provided resources are confirmed; the exact DEM, sites, conventions and validated results remain pending. This document contains no computed lunar result |

**Three rules the build never breaks**

1. No placeholder is shown as science. Synthetic values carry a persistent label.
2. Unknown is not "not visible". Missing coverage stays unknown and is never counted as an outage.
3. No hidden score. Sun and Earth requirements are judged separately and the trade-offs are shown.

**How to read the labels**

| Label | Meaning |
| --- | --- |
| Confirmed | Stated in the published challenge, the Colombo judging guide, or an explicit team constraint |
| Proposed | A LunaScope design decision, not a NASA requirement |
| Unknown | Cannot be fixed until a dataset is inspected, a scientific check passes or the team records a decision |
| Pending verification | A candidate resource or decision exists, but its metadata or scientific suitability is not yet approved |

## 2. Challenge and problem

The challenge asks for an intuitive tool that lets planners, educators and the public compare lunar landing sites and dates quickly, showing the Sun and Earth relative to the horizon so users can judge power-generation potential and direct-to-Earth communication windows.

**Confirmed requirements**

| ID | Requirement | Source |
| --- | --- | --- |
| CR-01 | Provide an intuitive tool or application | Challenge page |
| CR-02 | Compare lunar landing sites and dates quickly | Challenge page |
| CR-03 | Visualize Sun and Earth positions relative to the horizon | Challenge page |
| CR-04 | Support assessment of power-generation potential and direct-to-Earth windows | Challenge page |
| CR-05 | Serve mission planners, educators and the public | Challenge page |
| CR-06 | Time remaining before sunset or Earthset is communicated clearly | Challenge page (user experience) |
| CR-07 | Use at least one official NASA resource | Colombo guide |
| CR-08 | Disclose AI or SI tool use; never generate or alter NASA logos | Colombo guide |

The challenge provides LROC QuickMap, NASA Moon Trek and the JPL Horizons System as official resources. It also suggests no-atmosphere horizons, libration, steep polar terrain, fast response to schedule change and curated sites such as Apollo, Commercial Lunar Payload Services (CLPS) and other countries' targets. LunaScope uses the resources only for roles their data and interfaces support.

**Why it matters.** Simplified flat-horizon analysis can overestimate lunar sunlight and direct-to-Earth opportunity by ignoring local ridges and crater walls. At the south pole, the Sun stays low, so terrain can hide a target whose geometric elevation is positive. Earth's direction also shifts with libration. A missed outage can change an early site or schedule decision even when it does not, by itself, determine complete mission feasibility.

**Product question.** How can an early mission team configure a mission, choose sites, and quickly identify terrain-created power and direct-to-Earth opportunity risks without hiding the data, assumptions, outages or uncertainty behind an unexplained recommendation?

## 3. Users and value

LunaScope is designed around one primary job: an early-stage mission planner screens sites and dates before detailed mission analysis. Reviewer and education depth appear through progressive disclosure rather than competing with the planning workflow.

| User | Job to be done | What LunaScope gives them |
| --- | --- | --- |
| Mission planner or systems engineer | Screen sites and dates before detailed analysis | Constraints, timelines, outages, traceable export |
| Science or data reviewer | Check that outputs follow documented methods | Evidence panel, provenance, validation scope |
| Educator or student | Understand why polar light and links change | Guided mode, plain-language explanations tied to the visuals |
| Public explorer | Compare lunar places without specialist tools | Safe defaults, accessible charts, honest limits |
| Presenter or judge | See problem, method and evidence fast | One demo path with visible NASA-data use |

**Value in one sentence.** LunaScope reveals sunlight and direct-to-Earth outages that flat-horizon analysis can miss, then shows the terrain, timing and evidence behind the changed decision.

**Primary outcome.** Given multiple candidate sites or dates, LunaScope must reveal a defensible decision-relevant difference caused by terrain or mission timing and show the evidence supporting it. If no decision changes, it must show the measured stability or trade-off rather than manufacture a reversal.

**What is new, stated honestly**

| Idea | What it is | What must be shown before claiming impact |
| --- | --- | --- |
| Terrain-aware local sky (lead) | Sun and Earth tracks over a DEM-derived horizon instead of a flat 0° line | Horizon validation and a convergence study |
| Evidence beside every result | Kernels, DEM, frame, sampling, version and warnings next to the numbers | Complete provenance and a reproducible run ID |
| Sunset and Earthset countdown | Time left before the Sun or Earth drops below the terrain | Event tests and a precision note that matches the model |
| Mission Time Machine | Shift the start date and recompute with the same sites and constraints | Measured recalculation time and a user task check |
| Alternatives view | Bounded search of nearby start dates with a visible tested range | Defined search domain and objective |

The Time Machine mainly delivers a challenge requirement (date flexibility). It is pitched as fast comparison, not as the main novelty.

## 4. Scope

**In scope for the hackathon**

- Configure mission start, duration, sample step, Sun and Earth thresholds, and the terrain toggle.
- Choose from curated south-pole sites, or enter custom coordinates with their convention and source.
- Compute Sun and Earth azimuth and elevation per site and time, plus a terrain horizon from a lunar DEM.
- Report visible fractions, windows, outages, threshold status, and a sunset/Earthset countdown.
- Compare sites and dates, shift the start date, and search nearby start dates.
- Show method, provenance, validation scope and limitations, and export results.

**Not in scope (non-goals)**

- Landing safety, slope, roughness, rocks, hazard avoidance.
- Electrical energy prediction; this needs array, dust, thermal and storage models.
- Link budgets, relay availability, antenna pointing, network scheduling.
- Thermal survival, radiation, trajectory, descent guidance, science value.
- Accounts, collaboration, AI recommendations, global-scale analysis.
- Representing any output as flight-qualified or NASA-endorsed.

**Hackathon cut list (retained from v2.0).** The build is solo and short, so scope is fixed as follows.

| Keep | Defer or drop |
| --- | --- |
| Seven workspaces: Config, Sites, Local Sky, Timeline, Compare, Time Machine, Evidence | Standalone Resilience Explorer; replaced by a compact tested-dates strip inside Time Machine |
| One process with SQLite or files; run ID derived from the request hash | Durable job queue, leases, fencing tokens, metadata gateway |
| Precomputed horizons for named showcase presets | Arbitrary custom-site heavy jobs beyond a simple async job |
| Server-side comparison and deterministic explanations | Free-form AI wording of scientific statements |
| Local offline fallback with the demo packaged | Public snapshot publishing (marked "planned"); rate limits; access-control policy |

**Working assumptions**

| Assumption | Treatment | How it is checked |
| --- | --- | --- |
| Sites are fixed on the surface | Each site stores lat, lon, height, convention, reference surface, source | Verified against released site definitions |
| Earth and Sun centres are good first-order targets | Visibility means centre above horizon; disk edges are an optional extension | Centre-versus-disk sensitivity |
| No atmosphere | Geometric rays only, no refraction | Stated in method and tests |
| A finite DEM radius represents relevant terrain | Configurable radius and azimuth spacing | Radius and resolution sensitivity |

**Confirmed resource roles**

| Resource | Confirmed role | Not responsible for |
| --- | --- | --- |
| [LROC QuickMap](https://quickmap.lroc.im-ldi.com/) | Discover and inspect Lunar Reconnaissance Orbiter imagery, topography and candidate terrain products | Sun/Earth geometry or final visibility decisions |
| [NASA Moon Trek](https://trek.nasa.gov/moon/) | Explore terrain, elevation profiles, coordinate context and available lunar layers; provide a visual cross-check | Authoritative mission-window computation |
| [JPL Horizons](https://ssd.jpl.nasa.gov/horizons/) | Produce or independently check Sun/Earth geometry for a declared lunar-surface observer and time range | Terrain obstruction from local ridges or crater walls |
| Selected numerical DEM | Drive the terrain-horizon calculation after its metadata and suitability are verified | Celestial geometry |

QuickMap and Moon Trek are portals, not by themselves a pinned numerical input. A real-data run remains unverified until the selected DEM has a product ID, version, download URL, coordinate reference system (CRS), reference surface, units, resolution, nodata definition, coverage, license or use terms, access date and SHA-256 checksum.

## 5. Reference mission

The demo follows one stable scenario: a seven-day robotic lander screened against 60% sunlight and 50% direct Earth visibility, with terrain on. It is a demonstration fixture, not a NASA mission result.

| Parameter | Reference value | Note |
| --- | --- | --- |
| Mission type | Robotic lunar lander | Demo context only |
| Duration | 7 days (168 h) | From the configured start |
| Minimum sunlight | 60% availability (Section 8.5) | Sun centre above the selected horizon |
| Minimum Earth visibility | 50% availability (Section 8.5) | Earth centre above the selected horizon |
| Terrain | On | Terrain-aware values decide; geometric-only is kept for comparison |
| Candidate sites | Three or more | Final sites and coordinates come from released resources |
| Sample step | 10 min, provisional | 1,009 timestamps if both ends are sampled; final step set by convergence |
| Outage budget | None applied, or an openly hypothetical one | Shown on screen so thresholds are not mistaken for mission rules |

**Story.** A team screens south-pole sites for a seven-day lander. It runs the baseline, compares the sites, then moves the landing five days later to simulate a delay. LunaScope recomputes the same metrics, shows what changed, and shows the time left before the next sunset or Earthset. Any recommendation waits for real data and validation.

**Decision policy**

1. A run with incomplete required coverage or a fatal validation warning is excluded from pass/fail. For the reference run, pass/fail also requires that no unresolved time remains; otherwise the case is excluded.
2. Sunlight and Earth visibility are judged separately against their own thresholds.
3. When terrain is on, both geometric-only and terrain-aware values are shown; terrain-aware values decide.
4. There is no combined score. If several sites pass, the trade-offs are shown and the user chooses.
5. Two sites with the same availability can differ in longest outage; the explanation must show that difference.
6. Every value carries one of three states: synthetic demonstration, real-data unverified, or validated within a named scope (Section 14). Values stay unverified until the geometry response or kernels, DEM, site coordinates and scientific checks are complete.

**Golden run configuration**

The first integrated scientific result is frozen as `GR-001`. It is the common reference for integration tests, performance measurements, screenshots, the live demo and exported evidence.

| Field | Frozen value or gate |
| --- | --- |
| Mission | Seven-day robotic lander screening scenario |
| Requirements | 60% sunlight and 50% direct-to-Earth visibility; scenario values only |
| Terrain | Enabled; flat-horizon result retained for comparison |
| Sites | Three verified candidates with complete coordinate and terrain provenance |
| Geometry provider | JPL Horizons for the MVP, or another provider only after a written science decision |
| Independent geometry check | A separately implemented SPICE calculation at selected epochs |
| Sampling | 10-minute base step plus adaptive event detection; final only after convergence |
| DEM | One exact product, version and checksum; pending verified selection |
| Observer | Fixed coordinate convention, reference surface and height |
| Result status | Unverified until geometry, terrain-horizon and interval/decision gates pass |

## 6. Features and priorities

**P0** = needed for a credible end-to-end demo. **P1** = clearly improves usability, validity or judging strength. **P2** = only if P0 and P1 gates are met. IDs FR-01 to FR-16 keep their v1.0 meaning; FR-17 to FR-19 are new.

| ID | Priority | Feature | What it must do | Done when |
| --- | --- | --- | --- | --- |
| FR-01 | P0 | Mission configuration | Start time, duration, sample step, Sun and Earth thresholds, terrain toggle, DEM radius, horizon resolution, observer height | Invalid values are blocked with field-level messages |
| FR-02 | P0 | Candidate sites | Curated south-pole presets, or custom coordinates with convention and source. Apollo, CLPS and international sites are P2 reference presets | Each site has a unique ID, validated lat/lon, and a source point kept separate from the analysis point |
| FR-03 | P0 | Analysis run | Submit a versioned request, see progress, recover from errors | Run ID is the hash of the canonical request plus resource and algorithm identity; repeat submits return the same run |
| FR-04 | P0 | Sun geometry | Sun azimuth and elevation per site and time through the approved geometry provider | Provider request and response are preserved; frame, range and independent-reference checks pass |
| FR-05 | P0 | Earth geometry | Earth azimuth and elevation per site and time through the approved geometry provider | Provider request and response are preserved; frame, range and independent-reference checks pass |
| FR-06 | P0 | Terrain horizon | Azimuth-dependent horizon from the DEM, compared with target elevation | Profile lists source, radius, spacing, resolution and coverage warnings |
| FR-07 | P0 | Visibility metrics | Per-target visible, hidden and unresolved durations, availability bounds, windows, longest and total outage, boundary times | Metrics reproduce from the exported classified intervals and refined events within tolerance |
| FR-08 | P0 | Comparison | Compare sites on identical inputs, computed on the server | Held-constant and changed fields shown; no implied overall winner |
| FR-09 | P0 | Evidence | Datasets, kernel names and checksums, frame, corrections, step, code version, warnings | Every result links to its provenance |
| FR-17 | P0 | Sunset / Earthset countdown | Time left before the Sun or Earth drops below the terrain, for the selected run, site, target and moment | Uses the same event list as outages; no-event states show the end of computed coverage |
| FR-10 | P0 | Mission Time Machine | Shift the start date and compare with a frozen baseline | Same sites and constraints kept; alignment mode (phase or calendar) shown |
| FR-11 | P1 | Alternatives and tested dates | Search nearby start dates with a compact tested-dates strip | Tested, passing, failing and unknown counts visible; objective is explicit |
| FR-12 | P1 | Sensitivity | Re-run selected cases with finer step or other terrain settings | Differences quantified; instability flagged |
| FR-13 | P0 | Export | Minimum: a machine-readable evidence bundle (JSON) with method, inputs, classified intervals, events, metrics, caveats and provenance. The formatted short report is optional | Reproducible; carries no placeholder label once validated |
| FR-14 | P1 | Guided mode | Plain-language explanations tied to the horizon, Sun, Earth and outages | Built from fixed templates; Technical mode stays available |
| FR-18 | P1 | Animated local sky | Play Sun and Earth tracks moving over the terrain horizon across the mission | Pause, scrub and jump to events; reduced-motion respected |
| FR-19 | P1 | Curated explainer | Short "why the south pole is hard" content for educators and the public | Reachable from the main flow in one click |
| FR-15 | P2 | Shareable link | Encode non-sensitive inputs in a URL | Opening it rebuilds inputs and requests a new run |
| FR-16 | Deferred | Accounts, collaboration, public snapshot publishing | Not built; marked "planned" in the UI and docs | Not advertised as delivered |

**Non-functional requirements**

| ID | Area | Requirement |
| --- | --- | --- |
| NFR-01 | Truthfulness | Synthetic values always carry a persistent demonstration label; never imply NASA endorsement or operational use |
| NFR-02 | Reproducibility | Request, provider response, data manifest and algorithm version are enough to reproduce a result within stated tolerance |
| NFR-03 | Accessibility | Keyboard-operable main flow, visible focus, chart text alternatives, pass/fail not shown by color alone, reduced-motion support |
| NFR-04 | Performance | Controls respond under 100 ms; cached reference result usable under 2.5 s; budgets in Section 12 |
| NFR-05 | Reliability | No silent partial result; gaps and failed sites are visible and machine-readable |
| NFR-06 | Security | Strict input schemas, bounded dates, radii and sample counts, no file paths from users, secrets kept server-side |
| NFR-07 | Portability | Frontend and backend each start with one documented command; offline fallback runs locally |
| NFR-08 | Observability | Structured logs with run ID, algorithm version, timing and warning codes |

## 7. Screens and user flows

The 16 screens of v1.0 collapse into a Home entry plus seven workspaces. Home has one button that starts the reference mission, so a first-time judge reaches a result without visiting every workspace.

| Workspace | What it answers | Main parts | Replaces v1.0 screens |
| --- | --- | --- | --- |
| Mission | What am I testing? | Start, duration, step, thresholds, terrain toggle, validation summary, data-status banner | S02, S03, S06, S07 |
| Sites | Which places are candidates? | Polar map, presets, custom coordinates, source and precision labels, DEM coverage | S04, S05 |
| Local Sky | What does the sky look like from here? | Polar azimuth/elevation plot, terrain and flat horizons, Sun and Earth tracks, animation, time scrubber, countdown | S09 |
| Timeline | When are Sun and Earth visible? | Aligned Sun and Earth bands, threshold line, interval table, longest outage, boundary resolution | S10 |
| Compare | Which sites meet the constraints, and what is the trade-off? | Status matrix, paired timelines, small multiples, held-constant fields | S08, S11 |
| Time Machine | What changes if the date slips? | Date control, frozen baseline, deltas, changed intervals, tested-dates strip, alternatives | S12, S13 (compact) |
| Evidence | Can I trust and reproduce this? | Provenance, three validation cards, method and limits, export | S14, S15, S16 |

**Rules that apply on every screen**

- Inputs are editable only in a draft. A submitted run stores an immutable request snapshot.
- Pass and fail use an icon, text and color. Unknown, excluded, warning and pending are separate states.
- Scientific views show UTC. Local event time appears only in planning text.
- Charts have a keyboard-reachable summary and a downloadable table; hover-only information is also focusable.
- A terrain-aware result always shows its flat-horizon comparison and its terrain parameters.
- The data-status banner stays until the real resources are verified; the most serious warning appears next to the affected result, not only in Evidence.
- Keyboard shortcuts work only when a chart or player control has focus, and never while typing in a field.

**Flow A: baseline comparison**

1. Open Home and start the seven-day lander preset.
2. Confirm start, duration, 60% sunlight, 50% Earth visibility and terrain on.
3. Pick three or more sites; their coordinate sources are visible.
4. Review sample count, geometry-provider and DEM coverage, and warnings; submit.
5. Read the status matrix. Invalid sites are excluded, not marked as failures.
6. Open Local Sky and Timeline for the most important outage; check the countdown.
7. Compare trade-offs and export the manifest and results.

**Flow B: mission delay**

1. Open a finished baseline and choose Time Machine.
2. Shift the start by five days. Duration, sites, thresholds, terrain settings and algorithm version stay fixed.
3. Commit; a linked variant run is created.
4. Compare values, deltas, changed windows and pass/fail changes under the chosen alignment mode.
5. Open a changed interval in Local Sky to see whether geometry or terrain caused it.
6. Check the tested-dates strip for nearby starts and export both runs' provenance.

**Flow C: scientific review.** Open Evidence, check the geometry provider, preserved request, SPICE comparison, DEM, observer convention, corrections, time scale and code version. Read the three validation cards, download the request, series, horizon, metrics and manifest, then re-run or report a discrepancy by run ID.

## 8. Science method

For each site and time sample, LunaScope finds the Sun and Earth direction in a local sky frame, compares it with the terrain horizon at that direction, and turns the result into windows, outages and threshold decisions. For a fixed request, resource set and algorithm version the output is deterministic.

### 8.1 Inputs and conventions

| Input | Required form | Check |
| --- | --- | --- |
| Time | ISO 8601 UTC start, duration and step in seconds; provider time scale and conversion recorded | Coverage spans all samples; input and output time scales match the decision record |
| Site | Latitude, longitude, height, coordinate type, longitude direction, reference figure, source, precision | Latitude within ±90°; longitude normalised; convention stated |
| Targets | Sun centre and Earth centre for the MVP | Target IDs and correction mode stored |
| Geometry source | Approved `GeometryProvider`, with JPL Horizons as the MVP provider and SPICE as the independent implementation unless the science decision record changes this assignment | Provider version, request, response, observer definition and coverage are stored |
| Lunar frame | Provider-defined body-fixed or topocentric convention matched to the selected lunar reference system | Frame or observer convention resolves and has coverage |
| DEM | One pinned georeferenced elevation raster with product ID, CRS, reference surface, units, resolution, nodata, version and checksum | Horizon footprint fully covered, or warn / exclude |

### 8.2 One canonical observer

Every real-data run builds and stores a single observer definition: source position, reference surface, terrain elevation interpretation, height above ground, frame or provider convention, local axes and units. The Horizons request, SPICE reference calculation, terrain engine and validation checks must represent the same physical observer.

- Height above ground is never passed as height above a reference surface without conversion.
- Local north is derived in 3D rather than taken from raster grid north.
- If a vertical reference or convention is unresolved, definitive real-data conclusions are blocked.

### 8.3 Sun and Earth angles

The backend requests or calculates Sun-centre and Earth-centre geometry with one declared correction mode. For the MVP, the service requests observer ephemerides from JPL Horizons for the canonical lunar-surface observer, caches the raw response and parses the declared azimuth/elevation quantities. A separately implemented SPICE path checks selected epochs and supports later offline computation. If SPICE becomes primary, Horizons becomes the independent reference; the two paths are never presented as independent if they share the same computed fixture.

For a locally computed path, let `v` be the normalized site-to-target direction and let `e`, `n` and `u` be the local east, north and up unit vectors. The local components are:

- `E = v · e`
- `N = v · n`
- `U = v · u`

The angles are `azimuth = mod(atan2(E, N), 360°)` and `elevation = atan2(U, sqrt(E² + N²))`. Azimuth increases clockwise from local north. Elevation is positive above the plane perpendicular to local up. The implementation defines a stable pole convention for local east and tests it independently; raster grid north is never substituted for physical local north.

> A positive elevation only means "above the flat local horizon". It does not yet mean visible over terrain.

### 8.4 Terrain horizon

1. **Open the DEM.** Verify CRS, transform, units, nodata and resolution.
2. **Check coverage** over the whole horizon search footprint, not just the map point; mark unsupported sectors.
3. **Sample outward.** For each azimuth bin, sample terrain outward and compute the elevation angle from the observer to each sample in 3D, including lunar curvature.
4. **Take the maximum.** The maximum angle along the ray is the horizon elevation for that azimuth; keep the distance and cell that produced it.
5. **Interpolate** the horizon at the target azimuth with circular interpolation. Nodata is unknown, never zero elevation.
6. **Compute the decision variable:** `d = target elevation - terrain horizon elevation - clearance margin` at the target azimuth.
7. **Classify each sample and interval.** A target is visible when `d` is above zero by more than the declared tolerance and hidden when `d` is below zero by more than that tolerance. Anything within the tolerance of `d = 0`, or whose crossing cannot be bracketed, is near-boundary and counts as unresolved time, never silently as visible or hidden. A target below the flat horizon can still be visible over a lower, depressed skyline.

Horizon profiles for the named showcase presets are precomputed and cached by site, observer height, DEM checksum, radius, azimuth step and algorithm version.

### 8.5 Metrics

| Metric | Definition |
| --- | --- |
| Geometric visible | Target centre elevation above 0° |
| Terrain visible | Decision variable d above zero by more than the declared tolerance |
| Near boundary | Decision variable within the declared tolerance of zero, or an interval the algorithm cannot certify; counts as unresolved time |
| Valid sample | Geometry and, with terrain on, horizon are available with no fatal flag |
| Availability bounds | One partition of the mission window into visible (V), hidden (H) and unresolved (U) durations, T = V + H + U. Lower bound = V / T; upper bound = (V + U) / T. Missing coverage is unresolved, never hidden |
| Known-time fraction | V / (V + H) when the denominator is nonzero. A separately named conditional figure; it never stands in for full-window availability |
| Window / outage | A continuous visible / not-visible interval inside valid coverage |
| Longest outage | Longest known hidden interval with start and end UTC |
| Possible worst-case hidden time | Reported separately, only where unknown gaps sit between hidden periods |
| Threshold pass | Lower availability bound at or above the minimum, with no unresolved time for the reference run and no fatal condition; unrounded values, with the signed margin shown |

Adaptive sampling makes samples non-uniform, so durations, not sample counts, are authoritative. Exports carry the classified intervals and refined events, not only coarse angle samples, so a reviewer can reproduce the durations. The near-boundary tolerance is a numerical decision band; it is kept distinct from model-sensitivity ranges and is never presented as a statistical confidence interval.

### 8.6 Sampling levels

| Level | Step | Status |
| --- | --- | --- |
| Preview | 30 to 60 minutes | Never final |
| Standard | 10-minute base step | Provisional until convergence passes |
| Validation | One-minute step or adaptive subdivision on selected cases | Used for checks |

Each base interval is examined for unresolved events by checking midpoint clearance, proximity to zero, local curvature and configured motion bounds. After a sign-change bracket is established, root refinement locates the crossing to the declared numerical tolerance. Subdivision stops at a declared minimum interval width or evaluation cap; an interval that cannot be certified within those limits is returned as unresolved, never as no event.

## 9. Events, validation and uncertainty

The interface must never sound more certain than the calculation. This section defines how events, evidence and uncertainty are handled so that a smooth animation or a precise-looking countdown cannot overstate what the model supports.

### 9.1 Event contract

One event list drives durations, outages, constraints and the countdown, so they cannot disagree.

| Field | Meaning |
| --- | --- |
| Identity | Run, site, target and event type (rise, set, or contact without crossing) |
| Nominal time | Where the event is defined |
| Numerical bound | Bracket width from root refinement; says how well the model's crossing was located |
| Horizon definition | Flat or terrain, with profile settings |
| Quality state | Normal, near-tangent, coverage-limited, censored at mission end |

**Event rules**

- Same-sign endpoints are not assumed to contain no event. Adaptive subdivision and clearance-extrema checks must establish whether an interval can contain two crossings or a tangent contact before root refinement begins.
- A grazing contact with no crossing is reported as contact, not as a rise and set.
- Zero-clearance plateaus and closely spaced events have a fixed ordering and tolerance.
- At the exact moment of an event, the interval that starts there is the current state. The mission end is a censored boundary, not a sunset.

### 9.2 Countdown honesty

Three things are kept apart: display rounding, the numerical bound, and model sensitivity (terrain and observer-height uncertainty).

- The technical text reads "predicted Sun-centre set under this terrain model", never "exact".
- When no event occurs, the countdown shows the end of computed coverage, for example "no sunset before the end of the computed window".
- A countdown always names its run, site and target and never uses an event across unknown coverage.
- If terrain-variant runs move or remove an event, the range or the changed event pattern is shown rather than one averaged time.

### 9.3 Evidence in three separate scopes

A good Sun/Earth angle match does not validate the terrain horizon, so the Evidence workspace shows three cards. A headline number always names what it measures and never says just "accuracy".

| Card | What it checks | Pass evidence |
| --- | --- | --- |
| Geometry reference agreement | Primary-provider Sun and Earth angles against an independently implemented reference, per target and per quantity | Residuals within the stated tolerance, with matched observer, convention, time and correction; JPL Horizons and SPICE roles are named |
| Terrain-horizon checks | Synthetic and real-terrain horizon tests, footprint coverage, radius and sampling refinement | Known horizons recovered; refinement changes stay inside tolerance or are flagged |
| Interval and decision convergence | Windows, outages and threshold decisions under finer settings | Metric changes inside tolerance, or the case is marked unstable |

> A test that deliberately corrupts the horizon while keeping geometry correct must fail end-to-end readiness.

### 9.4 Validation layers

| Layer | Test |
| --- | --- |
| Conventions | Cardinal-direction vectors, longitude wrap, latitude type, units |
| Provider coverage | Horizons API signature, request coverage and response completeness; SPICE kernel IDs, frame resolution and time coverage when SPICE is used |
| Geometry reference | Selected epochs compared between Horizons and the independently implemented SPICE path; wrapped azimuth and elevation differences |
| Analytic horizon | Flat sphere, single ridge, synthetic crater |
| Raster handling | CRS transform, pixel centre or corner, nodata, edges, seams, units |
| Aggregation | Hand-built Boolean series with gaps and boundary cases |
| Convergence | Finer time, azimuth, radius and DEM settings |
| End to end | Request through API, UI, export and re-run; identical within tolerance |

Expected values are derived by hand or from an external source, not from the production code, so one mistaken formula cannot make both the code and its tests agree.

### 9.5 Uncertainty budget

LunaScope does not merge these effects into one confidence percentage without a defensible statistical model. It reports parameters, validation status, sensitivity differences and flags.

| Source | Effect | Treatment |
| --- | --- | --- |
| DEM accuracy and resolution | Moves or smooths ridges, shifts the horizon | Carry dataset accuracy; run resolution sensitivity |
| Coordinate and reference surface | Site or terrain offset | Explicit convention; verified transforms |
| Geometry provider, kernels and orientation model | Changes target direction | Pin provider response and kernel versions; report convention and coverage |
| Time sampling | Misses short events, shifts boundaries | Report step; refine; run finer convergence |
| Azimuth spacing and finite radius | Misses a local maximum or distant terrain | Report values; test finer spacing and larger radius |
| Sun and Earth disk size | Centre-only visibility simplifies partial visibility | Declare centre assumption; optional edge sensitivity |
| Observer height | Changes clearance | Make height an explicit input |

### 9.6 Provenance record

Every run stores the following. Later checks create new versioned records; they never rewrite an old export.

- **Run:** run ID and request hash; algorithm version and source commit.
- **Geometry provider:** provider, version, complete request, raw response hash, retrieval time, target IDs, correction mode and time scale.
- **Datasets:** publisher, product ID, version, URL, use terms, filename, size and SHA-256 for each.
- **Kernels (when used):** type, name, checksum, frame and time coverage.
- **DEM:** CRS, reference surface, reference radius, units, resolution, nodata, coverage and preprocessing.
- **Site and observer:** the site and the canonical observer definition.
- **Settings:** horizon radius, azimuth step, time step and clearance margin.
- **Validation:** results with tolerances.

## 10. Architecture

A small stack keeps the build solo-sized: a web app for interaction, one Python service for all science, and a simple local store. Heavy production machinery is deferred (see the cut list in Section 4).

&#91;embedded content: architecture · 3 parts plus a local fallback frame\]

The web app sends typed requests and shows what the service returns; it never decides visibility, outages or comparisons. The service reads checksummed resources and writes immutable results to the run store, and the same stack runs offline.

### Design rules

| Rule | What it means |
| --- | --- |
| One science engine | All visibility, event, metric and comparison logic lives in Python. The browser may pick an already-classified interval, format it, interpolate display directions, and subtract the cursor time from an event time. It never infers causes or computes clearance, availability, deltas or rankings |
| Run identity | The run ID is the hash of the canonical request plus resource and algorithm identity. A repeat submit returns the same immutable run, backed by a SQLite uniqueness constraint on the run ID, so concurrent identical requests admit one run, and results become readable only when complete. If provider responses are fetched after submission, the request resolves to a pinned response bundle before the run is stored |
| Providers behind interfaces | `GeometryProvider`, `TerrainProvider` and a resource registry sit behind fixed contracts. The MVP `GeometryProvider` uses cached JPL Horizons observer ephemerides; the independent SPICE implementation is used for selected reference checks and can become an offline provider after validation. Mock data stays only in tests and labeled demonstration fixtures. Numerical visibility code performs no direct file or network access |
| Precompute contract | Instant horizons are guaranteed only for named combinations of site, observer height, DEM profile and numerical settings. Any other combination uses a matching cache or an explicit async job |
| Resource readiness | States are `discovered`, `downloaded`, `integrity_verified`, `metadata_verified`, `scientifically_approved` and `rejected`. A checksum proves integrity, not scientific suitability. Only scientifically approved inputs can produce verified public output |
| Storage | SQLite for metadata and files for artifacts, behind an interface so a hosted database can replace it later. Results are immutable; later checks are added as new versioned records |
| Deployment | Next.js frontend on a Vercel-compatible host plus a containerized Python service with a health endpoint; checksums and coverage are checked at startup. The local fallback includes the validated golden run and cached provider responses and is rehearsed with the network off |
| Security | Strict schemas, bounded dates, radii and sample counts, no user-supplied paths or URLs, secrets kept server-side, pinned dependencies. Two modes: the primary live application allows bounded new analyses, with safe admission, publication and recovery (bounded running and queued work, request timeouts, a queue-full response); the packaged fallback replays validated runs and named variants, clearly labeled |
| Service modules | `GeometryProvider`, `TerrainProvider`, `VisibilityEvaluator`, `MetricAggregator`, `ResourceRegistry`, `ValidationService`, `RunRepository` |

## 11. Data contracts

**Conventions:** base path `/api/v1`, JSON, UTC times ending in Z, angles in degrees, every distance and height with a declared unit. Errors carry a stable code, message, field path, retryable flag and correlation ID. Long jobs return 202 with a run resource; polling is enough. Unknown critical fields are rejected rather than silently coerced.

### Endpoints

| Method and path | Purpose |
| --- | --- |
| `GET /health` | Service and build status |
| `GET /resources` | Resource profiles, coverage, readiness |
| `GET /sites` | Candidate catalog with coordinate provenance |
| `POST /sites/custom` | Validate a typed numeric point; return its canonical definition; never accept paths or URLs |
| `POST /analyses` | Create a run; same canonical request returns the same run |
| `GET /analyses/{run_id}` | Status and summary |
| `GET /analyses/{run_id}/results` | Per-target metrics, series references, events, warnings |
| `GET /analyses/{run_id}/provenance` | Evidence manifest |
| `POST /analyses/{run_id}/variants` | Time Machine, alternatives and sensitivity variants with an explicit variant type and changed fields |
| `POST /comparisons` | Server-side comparison: compatibility, held and changed inputs, deltas and alignment mode |
| `GET /analyses/{run_id}/export` | JSON or report with checksum |

### Result shape

Each site result holds site-level quality states and separate metrics for each target, so Sun and Earth are never mixed in one field set.

```json
{
  "run_id": "hash-of-request-resources-and-algorithm",
  "status": "complete_with_warnings",
  "algorithm_version": "string",
  "coverage_fraction": 1.0,
  "sites": [{
    "site_id": "string",
    "validity": "verified | verified_with_limitations | unverified | excluded",
    "target_metrics": {
      "sun_center":   { "visible_s": 0, "hidden_s": 0, "unknown_s": 0,
                        "availability_lower": 0.0, "availability_upper": 0.0,
                        "longest_known_hidden_s": 0, "events": [] },
      "earth_center": { "visible_s": 0, "hidden_s": 0, "unknown_s": 0,
                        "availability_lower": 0.0, "availability_upper": 0.0,
                        "longest_known_hidden_s": 0, "events": [] }
    },
    "requirement_results": [],
    "warnings": []
  }],
  "provenance_url": "/api/v1/analyses/{run_id}/provenance"
}
```

Zeros above show shape only, not lunar values. Fixture payloads carry a demonstration flag and are never reusable as scientific evidence. Unknown durations use null or bounded values, never a placeholder zero.

### Contract rules

| Topic | Rule |
| --- | --- |
| Explanation facts | Facts are typed by analysis mode and quality state: geometric-only, terrain-aware, missing geometry, missing terrain, visible, blocked, unresolved. Fields that do not apply are absent rather than filled with made-up values. The server decides visibility from the selected horizon definition first, then picks a fixed template. Playback reads facts already loaded; an exact fact for an arbitrary moment is requested on pause and labelled with the time it describes |
| Time alignment | A single-run view uses one shared simulation time. A multi-run comparison declares one of two modes. In **elapsed-phase** mode each panel uses its own start plus the same elapsed time. In **calendar** mode panels share one UTC and mark periods outside their own run. A date shift never changes the mode silently |
| Result binding | Every selection and response carries run ID, request hash, site and target, so a late response for an old request cannot overwrite what the user is now viewing |
| Geometry cache key | Provider name and version, canonical observer, targets, correction mode, time scale, start, stop, requested samples and response signature |
| Horizon cache key | Site, canonical observer, DEM product and checksum, reference surface, radius, azimuth step, interpolation settings, clearance policy and algorithm version |
| Cache match | Requires every identity field to match |
| Errors | Distinct codes cover invalid input, unsupported observer conventions, geometry-provider unavailability or coverage, DEM coverage, reference mismatch, resource integrity, unverified metadata and storage availability. See the codes in Section 14 |

## 12. Testing and performance

### Test levels

| Level | Covers | Tools |
| --- | --- | --- |
| Science unit | Frames, azimuth and elevation, horizon, interpolation, visibility, intervals, thresholds | pytest with hand-derived fixtures |
| Reference and golden | `GR-001`, selected epochs, sites and resources against an independently implemented provider | Versioned fixtures with source, method, provider request and tolerance |
| Convergence | Time step, radius, azimuth step, raster resolution | Automated delta report |
| API | Schemas, bounds, repeat submits, status changes, exports | FastAPI test client |
| Frontend | Validation, state mapping, presentation only | Vitest, Testing Library |
| Accessibility | Keyboard flow, focus, contrast, chart text alternatives | Automated checks plus manual keyboard review |
| End to end | Create mission, run, compare, Time Machine, evidence, export | Playwright, on mock and real providers |
| Fault and fallback | Backend down, missing resource, partial site failure, network off | Fault injection and a rehearsal checklist |

### Minimum science test cases

1. Target straight overhead: elevation near +90°, azimuth handled by a documented convention.
2. Target exactly on the flat horizon: zero elevation within tolerance.
3. Targets at north, east, south and west give 0°, 90°, 180° and 270°.
4. Flat synthetic DEM gives the expected curved-surface horizon.
5. One synthetic ridge blocks a lower target at its azimuth but not a higher one.
6. A depressed skyline: target at −0.2° elevation over a −0.4° horizon is visible.
7. A far obstacle outside the nearby DEM tile is detected or the sector is marked unsupported.
8. Narrow ridge and raster-seam fixtures are tested under finer azimuth and radius settings.
9. Adaptive subdivision finds two crossings between same-sign base endpoints; a touching-without-crossing case is reported as contact.
10. Cursor exactly at an event and exactly at mission end behave as defined in Section 9.
11. Equal availability with different longest outage gives different explanations.
12. A deliberately wrong unit, direction or observer height makes a test fail.
13. A corrupted horizon with correct geometry fails end-to-end readiness.
14. Date shift of five days: each comparison panel shows its own UTC, events and countdown.
15. Responses that arrive out of order never overwrite the active selection.
16. With the network disabled before launch, the packaged fallback still opens the promised demo.

### Performance budgets

These are targets, not measured results; they are re-set once the real data and host are known.

| Workload | Target | How measured |
| --- | --- | --- |
| Control response | Under 100 ms | Browser performance trace |
| Cached reference result | Usable under 2.5 s on event Wi-Fi | Cold browser test, throttled |
| 7-day geometry, 3 sites, 10 min step | Under 5 s from cached provider responses; uncached Horizons calls and adaptive refinement are timed separately | Stage timing |
| Precomputed horizon read | Under 300 ms per site | Cache-hit timing |
| New horizon, custom setting | Under 20 s per site, run as an async job | Real DEM benchmark |
| Full standard run, 3 sites | Under 30 s | End-to-end timing |
| Preset comparison and date shift | Feels instant because horizons are precomputed | Cold and warm runs reported separately |

Only the named showcase configurations are guaranteed instant. Changing observer height, DEM product or numerical settings uses a matching cached profile or starts an explicit async job. Precomputed horizons do not make uncached geometry or adaptive event queries instant. The packaged fallback replays validated runs and named variants, clearly labeled, and does not recompute new dates until a local provider passes its own checks.

## 13. Plan

Validity comes first, then the core experience, then extras. No polish starts until one real site runs end to end.

&#91;embedded content: plan · 3 phases, 3 gates\]

Phase 1 ends only when one real site passes through the approved geometry provider, one pinned DEM horizon and the shared countdown/event pipeline. Animation and extras start after that.

### Phase 1 steps (13 Nov)

| Step | Action | Gate |
| --- | --- | --- |
| 1. Inventory | Record QuickMap, Moon Trek and Horizons; catalog candidate files, use terms, checksums, coverage, formats and conventions | No numerical resource is used before it has a manifest entry |
| 2. Decide | Select the exact DEM; fix provider roles, coordinate convention, reference surface, correction mode, target definition, site list and sampling | Science owner approves a written decision record |
| 3. Preprocess | Convert or tile the DEM if needed; keep the source checksum and exact commands | Round-trip and metadata checks pass |
| 4. Geometry | Query and cache Horizons for the canonical observer; implement the independent SPICE comparison at selected epochs | Provider, convention, residual and coverage tests pass |
| 5. Terrain | Register the DEM; compute and cache horizons for the presets | Synthetic and real-terrain checks pass |
| 6. Connect UI | Replace the mock provider behind the same API; show evidence and warnings | One validated end-to-end run completes |
| 7. Measure | Record timings, convergence and limits | Budgets met, or settings openly constrained |

### Priority on 14–15 Nov

1. **Validity first:** resolve discrepancies, finish convergence, lock the reference run and its evidence.
2. **Relevance:** make the official NASA resource visible in the computation and on the project page.
3. **Core experience:** baseline, local sky, countdown, timeline, comparison, Time Machine, export.
4. **Creativity:** animation and the tested-dates strip, only after the validity gates pass.
5. **Presentation:** seven slides or a 30-second subtitled video; rehearse the five-minute pitch and the five-minute Q&A.
6. **Reliability:** deploy, cache, test on the event network, prepare the local fallback, freeze versions, submit early.

> **Implementation freeze rule.** After `GR-001` passes the science gates, changes to provider settings, observer conventions, DEM identity, horizon parameters or event policy create a new golden-run version. Presentation changes cannot silently alter the scientific baseline.

### Roles

One person can wear several hats.

| Role | Accountable for |
| --- | --- |
| Product and presentation | Scope, reference story, acceptance, judging fit, submission |
| Science lead | Frames, kernels, conventions, validation, uncertainty, sign-off |
| Backend | API, resource registry, caching, deployment, logs |
| Frontend and UX | Workspaces, charts, accessibility, states, performance |
| Data and QA | DEM preprocessing, manifests, fixtures, convergence, reproducibility |

## 14. Risks and quality gates

### Top risks, in priority order

The full 60-item and 36-item review lists stay as a backlog; these are the ones that can sink the demo or the entry.

| # | Risk | Impact | Mitigation |
| --- | --- | --- | --- |
| 1 | Eligibility: work started before the event without confirmed organizer permission | Disqualification | Keep the organizer's written permission, limit 12 Nov work to the permitted foundation, and match the work log to it |
| 2 | Wrong observer, provider convention, frame or north direction | Silently wrong results | One canonical observer; preserved Horizons request; cardinal-direction fixtures; independent SPICE cross-check |
| 3 | A portal layer is mistaken for a pinned numerical DEM, terrain footprint is incomplete, or a ridge is missed | Optimistic visibility | Exact product manifest; footprint-wide coverage check; radius, resolution and azimuth refinement tests |
| 4 | Geometry agreement presented as full validation | Misleading headline | Three separate evidence cards; corrupted-horizon test must fail |
| 5 | Same-sign base samples hide two short events, or countdown boundaries are wrong | Wrong sunset or Earthset time | Adaptive subdivision, event contract and boundary tests in Section 9 |
| 6 | Baseline and shifted run share one UTC | Wrong Time Machine comparison | Phase and calendar modes, tested with a five-day shift |
| 7 | Wrong explanation for a depressed skyline or geometric-only mode | Misleading text | State-first facts; deterministic templates only |
| 8 | Mock data mistaken for results | Credibility | Persistent label; export lock |
| 9 | Scope too large for a solo, short build | Nothing works at the demo | Cut list in Section 4; real end-to-end run before polish |
| 10 | Horizons, hosting or event-network failure during the pitch, or a link that needs a login | Demo fails | Cached raw provider responses; local packaged golden run; signed-out link test |
| 11 | The exact DEM, coordinate convention or candidate sites cannot be scientifically approved in time | No defensible terrain result | Use one verified site first; block claims rather than substitute an unlabeled resource; keep a flat-horizon demonstration clearly separated |

### Acceptance criteria

| ID | Criterion |
| --- | --- |
| AC-01 | The reference mission (7 days, 60%, 50%, terrain on) can be configured; invalid values are blocked |
| AC-02 | Three or more sites can be chosen, each with visible coordinate source and precision |
| AC-03 | A run is immutable and reproducible from its request hash, provider response and resource manifest |
| AC-04 | Each valid site returns Sun and Earth angle series with quality flags, provider identity and a preserved request/response hash |
| AC-05 | A terrain run returns a horizon profile with exact DEM product, checksum, CRS, reference surface, radius, spacing, resolution and nodata status |
| AC-06 | Availability, windows, outages and threshold decisions recompute from the exported classified intervals and refined events |
| AC-07 | Pass, fail, unknown, excluded, warning and pending are distinguishable without color alone |
| AC-08 | Local Sky shows Sun and Earth tracks against both the terrain and flat horizons |
| AC-09 | A selected preset with a named precomputed configuration uses its stored horizon without recomputation; a changed configuration starts an async job |
| AC-10 | The Time Machine produces a linked variant with baseline deltas and a stated alignment mode |
| AC-11 | The countdown names its run, site and target and handles at-event, at-mission-end and no-event cases |
| AC-12 | Evidence shows kernel, DEM, frame, time, algorithm and validation fields in three separate scopes |
| AC-13 | Synthetic fixtures stay labeled and cannot be exported as verified science |
| AC-14 | `GR-001` and reference science cases pass geometry, horizon, aggregation, event-search and convergence checks |
| AC-15 | The core flow works by keyboard and every chart has a text or table equivalent |
| AC-16 | A signed-out reviewer opens the project page and demo; the fallback works with the network off |

### Quality gates

| Gate | Required before the status |
| --- | --- |
| Foundation ready | Core flow, contracts, synthetic fixtures, providers, tests, labels and deployment scaffolding done |
| Integrated | Official resources catalogued, manifests complete, real geometry and terrain connected, no fatal coverage error |
| Scientifically verified | Reference, analytic, aggregation and convergence tests pass; limits reviewed |
| Demo ready | Validated reference run cached; five-minute pitch rehearsed; offline fallback tested |
| Submission ready | Public page, summary, demo link, NASA resource evidence, AI disclosure, branding check, signed-out access verified |

### Status and warning codes

| Code | Meaning | UI behavior |
| --- | --- | --- |
| `PASS` | All constraints pass with enough valid coverage | Show pass with text, icon and evidence link |
| `FAIL_SUN` / `FAIL_EARTH` / `FAIL_BOTH` | A threshold is not met | Show actual versus required and the main outage; no combined score |
| `UNKNOWN_COVERAGE` | Not enough geometry or DEM coverage | Exclude and show how to fix |
| `DEM_COVERAGE_INCOMPLETE` | Some horizon sectors lack valid data | Mark times or sectors unknown, or exclude |
| `GEOMETRY_COVERAGE_MISSING` | The provider response or SPICE kernels do not span the interval | Fatal block |
| `UNVERIFIED` | Real data computed, but a validation gate is open (real-data unverified) | Allow exploring; block verified export |
| `SENSITIVITY_HIGH` | Result changes beyond tolerance under finer settings | Show instability and alternatives |
| `OBSERVER_UNRESOLVED` | Vertical reference or convention is unresolved | Block definitive real-data conclusions |
| `GEOMETRY_PROVIDER_UNAVAILABLE` | The live provider cannot return the declared request | Use a matching validated cache or block the run; never substitute different settings silently |
| `GEOMETRY_REFERENCE_MISMATCH` | Independent provider residual exceeds tolerance | Mark geometry unverified and block verified export |
| `RESOURCE_INTEGRITY_FAILED` | A checksum or file check failed | Block the profile; no synthetic fallback |
| `RESOURCE_METADATA_UNVERIFIED` | Integrity passes but CRS, units, reference surface or use terms remain unresolved | Permit labeled investigation only; block scientific approval |
| `DEMONSTRATION_DATA` | Output comes from a synthetic fixture (synthetic demonstration) | Persistent label on every surface and export |

**Result states.** Every result is exactly one of: **synthetic demonstration**, **real-data unverified**, or **validated within a named scope** (geometry, terrain or interval/decision). An offline replay of a validated run keeps that run's validation state and is labelled as replay mode; it does not imply new offline computation.

## 15. Demo, judging and submission

Colombo judges give 10 marks each for Impact, Creativity, Validity, Relevance and Presentation (50 per judge); six judge totals are averaged for Global Nominee selection. The lead story is a terrain-aware local sky with traceable evidence. The other qualities support it.

### Global award positioning

| Position | Award | Why LunaScope fits |
| --- | --- | --- |
| Primary | Best Use of Science | Terrain-aware visibility, explicit scientific method, independent geometry checks, convergence and honest uncertainty |
| Secondary | Best Use of Data | Converts NASA/JPL ephemeris and lunar terrain resources into an accessible, reproducible decision workflow |
| Supporting | Best Mission Concept | Provides a plausible screening method for a concrete robotic-lander scenario |

LunaScope does not lead with Galactic Impact, complete landing-site selection or operational readiness. Its defensible impact is earlier detection and communication of terrain- and schedule-driven power and direct-to-Earth opportunity risks.

### Judging criteria and proof

| Criterion | What judges look for | LunaScope proof |
| --- | --- | --- |
| Impact | Depth, reach, ability to help and inspire | One visible terrain- or schedule-driven decision difference; a user study only if actually run, with no invented time-saving claim |
| Creativity | A new idea or a meaningful improvement | Terrain-aware local sky, sunset/Earthset countdown, animated horizon, evidence-first design |
| Validity | Scientific grounding, feasibility, usability | Preserved Horizons geometry, independent SPICE checks, pinned DEM horizon, three validation cards, convergence and clear limits |
| Relevance | Direct fit to the challenge, NASA data at the core | QuickMap/Moon Trek-supported terrain selection and Horizons geometry are visible in the method and Evidence workspace |
| Presentation | A clear, engaging, organised story | One seven-day scenario, one visible delay, one changed decision, short method and evidence |

### Five-minute live pitch

| Time | Content | On screen |
| --- | --- | --- |
| 0:00–0:35 | Problem and the confirmed challenge | Local horizon illustration, one-sentence problem |
| 0:35–1:05 | Reference lander mission | 7 days, 60% Sun, 50% Earth, terrain on |
| 1:05–2:05 | Baseline run and comparison | Status matrix, animated sky with the countdown, one terrain-created outage or measured stable case |
| 2:05–3:05 | Mission Time Machine | Shift the start by five days; recalculation and deltas |
| 3:05–3:45 | Scientific validity | Horizons request, independent SPICE residual, pinned DEM provenance and three validation cards |
| 3:45–4:25 | Alternatives | Tested-dates strip and the trade-off |
| 4:25–5:00 | Impact, limits, close | Who uses it, what it does not claim |

> Do not script any number until the validated reference run is locked. If the real data shows no dramatic change, show the real stability or trade-off instead of forcing a reversal.

### Likely questions

| Question | Answer |
| --- | --- |
| How do you know the angles are right? | The preserved Horizons request and response are checked against an independently implemented SPICE calculation at selected epochs; this card covers geometry only |
| How does terrain change the answer? | Flat versus terrain values, the horizon profile, and the obstacle's azimuth and distance |
| How exact is the countdown? | The model crossing is located within the reported numerical bracket; terrain and observer uncertainty are assessed separately |
| Is sunlight percentage the same as power? | No. It is geometric illumination; energy needs spacecraft-specific models |
| Is Earth visibility a communications guarantee? | No. It is a direct line of sight, not a link budget or network schedule |
| What happens when data is missing? | Unknown or excluded status, coverage shown, no silent pass or fail |
| Can it choose a safe landing site? | No. It screens lighting and direct-Earth opportunity only |

### Submission checklist

- [ ] Written confirmation of the organizer's permission for pre-event foundation work is on file, and the work log matches it
- [ ] Project page has a 50–200 word summary
- [ ] Demo link is at most seven slides or a 30-second subtitled video, and public
- [ ] No voice or picture of anyone under 18 appears in the demo
- [ ] At least one official NASA resource is central to the method and cited
- [ ] AI and software-tool use is disclosed accurately; no NASA logo is generated or altered
- [ ] Challenge fit, method, results, limits, source code, data citations and team roles are complete
- [ ] Every link works from a signed-out, private browser; the project opens at a meaningful preset
- [ ] Dataset, library, image and model licenses and citations are recorded
- [ ] Reference run and export are frozen with commit, build, algorithm version and checksums
- [ ] Local fallback is rehearsed with the network off; submitted before the deadline
- [ ] Claims audit done: nothing undelivered is described as delivered

### Draft project summary (50–200 words)

> LunaScope is a terrain-aware lunar power and direct-to-Earth opportunity navigator for the Moon's south pole. Simplified flat-horizon analysis can miss outages created by crater walls and ridges, so LunaScope helps early mission teams compare candidate sites and dates against the local terrain horizon. Users configure a mission, pick sites, and inspect sunlight, direct-to-Earth visibility, outages and the time remaining before the next predicted sunset or Earthset. JPL Horizons supplies lunar-surface Sun and Earth geometry, while a pinned lunar elevation product selected through NASA-provided terrain resources supports the local horizon calculation. An independent SPICE implementation checks selected geometry samples. The Mission Time Machine reassesses a schedule delay, and every result carries its provider request, terrain provenance, numerical settings, validation status and limits. LunaScope is a screening and education tool; it does not certify landing safety, electrical power, link performance or complete mission feasibility. Computed claims are added only after the golden run passes the scientific gates.

### Requirement traceability

| Challenge requirement | Product requirements | Workspace or service | Required proof |
| --- | --- | --- | --- |
| Compare sites and dates | FR-08, FR-10, FR-11 | Compare, Time Machine, comparison service | `GR-001` baseline and linked date variant with held/changed fields |
| Show Sun and Earth relative to the horizon | FR-04, FR-05, FR-06, FR-18 | Local Sky and geometry/terrain providers | Animated tracks over flat and terrain horizons; geometry and horizon evidence cards |
| Assess power and direct-to-Earth opportunity | FR-07, FR-08 | Timeline and Compare | Separate Sun/Earth fractions, windows, outages, requirements and unknown coverage |
| Communicate sunset and Earthset | FR-17 | Local Sky and Timeline | Shared event list, countdown boundary tests and numerical bound |
| Use NASA resources | FR-04, FR-05, FR-06, FR-09 | Resource registry and Evidence | Horizons request/response plus exact terrain product manifest and citations |
| Provide an intuitive tool | FR-01, FR-02, FR-14, FR-18 | Seven-workspace guided flow | Keyboard-complete reference flow and judge rehearsal |

## 16. Limitations, open questions, references and change log

### Product maturity and permitted use

| Stage | Permitted claim and use |
| --- | --- |
| Hackathon prototype | Demonstrated mission-window screening and education with clearly labeled validation state |
| Validated research prototype | Preliminary trade studies using pinned resources, documented tolerances and independent review |
| Operational system | Not claimed; requires mission-specific models, formal scientific review, broader qualification and organizational approval |

### Limitations

- **Not flight qualified.** This is a challenge prototype for screening and education.
- **Environmental scope only:** no landing hazards, slope or roughness, trajectory, thermal survival, energy storage, link margin, relays, science value or resource access.
- Centre-based visibility simplifies partial Sun and Earth disks.
- Horizon accuracy is limited by DEM resolution, accuracy, interpolation, reference surface, search radius and observer height. Complete input coverage does not prove every physical obstacle is resolved.
- Window edges depend on the time step and refinement rule.
- Results apply only to the recorded site convention, frame, resource versions and time coverage.
- The 60% and 50% thresholds are scenario values, not universal mission criteria.
- This document contains no computed site ranking or mission conclusion.

### Open questions

| ID | Question | Owner | Decide by |
| --- | --- | --- | --- |
| OQ-01 | Which exact numerical DEM product, version, download route and use terms are selected from the terrain resources? | Science and data leads | Before terrain integration |
| OQ-02 | Which lunar frame, latitude convention, longitude direction, reference radius and height datum apply? | Science lead | Before geometry integration |
| OQ-03 | Which Horizons observer quantities, correction mode and time scale define the MVP, and which SPICE kernels and settings define the independent comparison? | Science lead | Before the verified run |
| OQ-04 | Does the selected terrain export preserve the CRS, reference surface, vertical units, nodata and accuracy metadata needed for a defensible horizon? | Data lead | Before horizon integration |
| OQ-05 | Which site locations and precision appear in the demo? | Product and science | Before the reference run |
| OQ-06 | Add disk-edge or clearance-margin treatment for Sun and Earth? | Science lead | After MVP convergence |
| OQ-07 | What minimum valid-coverage fraction allows threshold evaluation? | Product and science | Before results lock |
| OQ-08 | Which convergence tolerances are achievable on event hardware? | QA | 13–14 Nov |
| OQ-09 | Which host gives enough memory, startup speed and reliability? | Backend | 13 Nov |
| OQ-10 | What exactly does the organizer's permission for pre-event work allow, in writing? | Team lead | Now |
| OQ-11 | Seven slides or a 30-second subtitled video for the demo link? | Presentation | 14 Nov |
| OQ-12 | Who signs off science, owns submission access, and runs the live pitch? | Team lead | Before the event |

### References

1. [NASA Space Apps Challenge 2026: Lunar Landing Site Navigator](https://www.spaceappschallenge.org/2026/challenges/lunar-landing-site-navigator/)
2. NASA Space Apps Challenge Colombo 2026, Contestant Guide to Judging and Awards (supplied file)
3. [LROC QuickMap](https://quickmap.lroc.im-ldi.com/)
4. [NASA Moon Trek](https://trek.nasa.gov/moon/)
5. [JPL Horizons System](https://ssd.jpl.nasa.gov/horizons/)
6. [JPL Horizons API documentation](https://ssd-api.jpl.nasa.gov/doc/horizons.html)
7. [JPL Horizons manual](https://ssd.jpl.nasa.gov/horizons/manual.html)
8. [NASA NAIF SPICE documentation](https://naif.jpl.nasa.gov/naif/documentation.html)
9. [NAIF Frames Required Reading](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html)
10. [LRO LOLA data, NASA PDS Geosciences Node](https://pds-geosciences.wustl.edu/missions/lro/lola.htm)
11. [LOLA Gridded Data Record GDRDEM documentation](https://ode.rsl.wustl.edu/mars/pagehelp/Content/Missions_Instruments/LRO/LOLA/GDR/GDRDEM.htm)
12. [SpiceyPy](https://spiceypy.readthedocs.io/), [Rasterio](https://rasterio.readthedocs.io/), [FastAPI](https://fastapi.tiangolo.com/) and [Next.js](https://nextjs.org/docs)

The three challenge-provided portals and the Horizons API/manual were checked for this revision. Candidate DEM documentation remains pending until the exact product is selected.

### Change log from v2.0

| Area | Change |
| --- | --- |
| Positioning | Clarified the primary planner, concrete decision risk, permitted-use stages and Best Use of Science / Best Use of Data award strategy |
| Resources | Recorded QuickMap, Moon Trek and Horizons as confirmed challenge resources; separated portals from the pinned numerical DEM |
| Geometry | Set Horizons as the recommended MVP provider and SPICE as the independently implemented check, subject to a written science decision |
| Science | Replaced the raw equation block, defined local-frame variables and pole handling, added clearance margin states and corrected same-sign event discovery |
| Reproducibility | Added `GR-001`, provider request/response provenance, expanded cache identity and resource-readiness states |
| Engineering | Consolidated Time Machine, alternatives and sensitivity under typed variants; strengthened acceptance and warning contracts |
| Demo | Required an observable decision-relevant difference or honest stability result; updated the pitch and traceability matrix |

### Earlier v2.0 changes from v1.0

| Area | Change |
| --- | --- |
| Features | Added the sunset/Earthset countdown (FR-17), animated local sky (FR-18) and curated explainer (FR-19); curated site presets made P2 reference presets |
| Scope | 16 screens reduced to Home plus seven workspaces; Resilience Explorer replaced by a compact tested-dates strip; publishing marked planned |
| Science | Added the canonical observer, event contract, countdown honesty, and three separate evidence scopes |
| Correctness fixes | Time alignment modes for the Time Machine; per-target Sun and Earth metrics; state-first explanations with a depressed-skyline case; finite precompute domain |
| Architecture | Simplified to one process with SQLite or files and a request-hash run ID; durable queue, leases and gateway deferred |
| Pitch | Lead claim moved from the Time Machine to the terrain-aware local sky with traceable evidence |
| Risks | Eligibility confirmation raised to the top risk; priority list cut to 11 items from 60 |

### v2.1.1 clarifications (13 Nov 2026)

A narrow addendum from the v2.1 specification review. No scope or feature changes.

| Area | Change |
| --- | --- |
| Availability | One partition of the mission window into visible, hidden and unresolved durations; availability reported as lower and upper bounds; reference-run pass/fail requires no unresolved time. Sections 5, 6, 8.5 and AC-06 updated together |
| Clearance margin | Visibility is decided on `d = target elevation - horizon - clearance margin`, with near-boundary time counted as unresolved |
| Event search | Minimum interval width and evaluation cap added; uncertified intervals return unresolved, never no event |
| Pitch wording | Countdown answer no longer says "exact" |
| Run identity | Hash now covers request, resources and algorithm; SQLite uniqueness constraint added; live app allows bounded new analyses with safe admission, publication and recovery; packaged fallback replays validated runs and named variants |
| Result states | Synthetic demonstration, real-data unverified and validated within a named scope kept distinct; packaged fallback replays validated runs and named variants |
| Priorities | Time Machine (FR-10) and a minimal evidence export (FR-13) moved to P0 |
| Performance | Cached provider responses, uncached Horizons calls and adaptive refinement timed separately |

# Claims audit

**Rule:** nothing undelivered is described as delivered. Each row is a claim the product, the README or the draft summary makes, what backs it, and its honest status. **Last checked:** 14 Nov 2026 against branch `phase-3`.

Status words: **Delivered** (works and is tested), **Delivered, synthetic only** (works; verified only on the labelled synthetic stack), **Partial**, **Not delivered**.

## What the product claims

| Claim | Status | What backs it | What must not be said |
| --- | --- | --- | --- |
| Terrain-aware local sky for a site and dates, with the flat horizon beside it | Delivered | Local Sky, Timeline and Compare pages; `RUN-001` on real data (state `real_data_unverified`) | That any result is validated or a mission result |
| Sun and Earth geometry from JPL Horizons, checked by an independent SPICE implementation | Delivered | `RUN-001`: largest disagreement 0.0017 arcsec over 1,009 samples at 3 sites x 2 targets | That this validates the terrain horizon: it checks directions only |
| A pinned lunar elevation model supplies the horizon | Delivered | Two LOLA 20 m products pinned by SHA-256; readiness `integrity_verified` | That the DEM is "scientifically approved": it is not (SDR-001 unsigned) |
| Unknown is never counted as "not visible" | Delivered | Three-way classification, tested; guided templates never call unresolved time hidden | |
| Outages, availability bounds, longest outage, sunset/Earthset countdown from one event list | Delivered | Shared interval and event list; countdown rules tested | |
| Mission Time Machine: shift the start and compare with a baseline, with a stated alignment mode | Delivered, and run once on real data | `test_variants.py`, `time-machine.test.tsx`, Playwright core flow; **one real-data five-day shift** ([record](../runs/GR-001-plus5d.md)): Earth reaches 100% at two sites and the Sun at `rule-89.5S-E240` goes from 0% to 51.2% (still below 60%) | That the shifted run is validated: it is `real_data_unverified`, carries `SENSITIVITY_HIGH` at one site (a 4.7 s certification sliver; availability bounds unchanged), and has no convergence report |
| Which dates pass (alternatives search with a tested-dates strip) | Delivered (also run once on real data, unverified) | `test_alternatives.py`, bounded batches, `docs/runs/GR-001-dates-search.md` | That a date is "best": only the stated margin objective is shown |
| Agreement with NASA's published illumination maps | **Partial** | `docs/runs/GR-001-illumination-vs-map.md`: ten sites correlate at 0.97 (Sun and Earth), mean difference 1.6 and 2.2 points; the declared three-site gate is **not met** (Sun site order, one outlier map pixel) | "Validated", "matches NASA", or that all sites agree; the map is not independent of LOLA topography |
| Three validation cards | Partial | Cards render from real checks. The terrain-horizon card reads **met** for GR-001 because a second, independent skyline implementation agrees (`docs/runs/GR-001-independent-skyline.md`); that checks the computation, not the DEM, and other skylines read not evaluated | "Validated", or that all three cards are met |
| Every result carries request, provider hashes, terrain provenance, settings, validation status, limits | Delivered | Evidence page and investigative export | A "verified" export: it is refused until a scope closes |
| Guided and Technical views from fixed templates | Delivered | `guided.test.tsx`, including a drift guard against the service's fact codes | |
| "Why the south pole is hard" explainer | Delivered | `/why-the-south-pole-is-hard`; diagram labelled a schematic | That its rounded figures are results |
| Animated local sky | Delivered | Player with pause, scrub, event jumps; reduced motion respected | |
| Sensitivity checks (finer azimuth step, other DEM release) | Delivered | Shown on the Timeline from the service's numbers; the countdown shows its spread across the variants | Convergence on real data is **incomplete**: azimuth 0.5 and 0.25 deg ran offline on the RUN-001 sites (none flagged); the 1 minute step and the 100 and 200 km radius cases are blocked on the Horizons contact (D-11) |
| Disc size: the centre-only assumption is bracketed (Sun and Earth upper limb, centre, whole disc) | Delivered | Evidence page; on RUN-001 no outcome changes, Earth's availability moves about 10 points either way (`docs/runs/RUN-001-disk-edge.md`) | That it models partial illumination or partial signal, or Earth's changing size (about 0.90 to 1.03 deg radius): it only brackets the centre assumption |
| Keyboard-complete core flow, no meaning by colour alone | Delivered | Playwright keyboard-only flow; axe on eight pages. **A manual screen-reader pass is not done** | "Fully accessible" |
| Works offline (fallback) | Delivered, with a real-data package | `build_fallback.py check --stack live`: replay mode with the network blocked and zero attempts, case 16, browser spec; the package's GR-001 equals the frozen record exactly | That the package is anywhere but this machine: it is local and gitignored, built from a tree with uncommitted changes, and nothing is deployed |
| Hosted deployment | **Not delivered** | Images build and the compose stack passes the smoke test **on a local machine**; **nothing is deployed** anywhere | That the app is hosted anywhere |

## What the product does not claim (keep it that way)

Landing safety, electrical power, link performance or mission feasibility; NASA endorsement; flight qualification. The footer and every result frame already say so.

## The golden reference run

| Claim | Status |
| --- | --- |
| "GR-001 passes the scientific gates" | **Delivered, with limits.** GR-001 is **frozen** (14 Nov, on the project owner's go-ahead; SDR-001 sign-off is still pending) and its frozen run, made at a clean commit with no network, passes the five Gate 2 checks (geometry, horizon, aggregation, event search, convergence; see `docs/runs/GR-001-run.md`). Its three sites are rule-chosen points and not candidate sites, and its terrain-horizon validation card reads "not evaluated" because no independent skyline implementation exists. Say "passes internal consistency, convergence and SPICE checks", never "validated". |
| "Computed claims are added only after the golden run passes the scientific gates" (spec summary) | The frozen run passes its checks, so numbers from `docs/runs/GR-001-run.md` may be quoted, labelled `real_data_unverified`. They are the same numbers as RUN-001 (same coordinates and window). |

## Open items that block honest claims

1. **D-09:** decided for GR-001 (rule points, declared a reference scenario); real candidate sites remain open for any GR-002. Science-owner sign-off pending.
2. **D-11:** the project's GitHub URL is used as the Horizons contact for the live run (set per run, not stored in the repository).
3. **D-12:** organizer permission for pre-event work; the template is in `docs/permissions/`, **no permission is on file**. Do not state eligibility until it is.
4. **SDR-001:** unsigned.

## Wording to avoid

"validated", "verified" (outside the word "refused"), "accurate", "optimal", "best site", "recommended", "ready for mission use", "NASA-approved".

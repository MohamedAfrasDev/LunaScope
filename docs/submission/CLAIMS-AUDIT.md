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
| Mission Time Machine: shift the start and compare with a baseline, with a stated alignment mode | Delivered, synthetic only | `test_variants.py`, `time-machine.test.tsx`, Playwright core flow. **No real-data date shift has been run** | A real-data Time Machine result |
| Which dates pass (alternatives search with a tested-dates strip) | Delivered, synthetic only | `test_alternatives.py`, bounded batches | That a date is "best": only the stated margin objective is shown |
| Three validation cards | Partial | Cards render from real checks. The terrain-horizon card is **not evaluated**: no independent skyline implementation exists | "Validated", or that all three cards are met |
| Every result carries request, provider hashes, terrain provenance, settings, validation status, limits | Delivered | Evidence page and investigative export | A "verified" export: it is refused until a scope closes |
| Guided and Technical views from fixed templates | Delivered | `guided.test.tsx`, including a drift guard against the service's fact codes | |
| "Why the south pole is hard" explainer | Delivered | `/why-the-south-pole-is-hard`; diagram labelled a schematic | That its rounded figures are results |
| Animated local sky | Delivered | Player with pause, scrub, event jumps; reduced motion respected | |
| Sensitivity checks (finer azimuth step, other DEM release) | Delivered | Shown on the Timeline from the service's numbers | Convergence on real data: the full report has not been run |
| Keyboard-complete core flow, no meaning by colour alone | Delivered | Playwright keyboard-only flow; axe on eight pages. **A manual screen-reader pass is not done** | "Fully accessible" |
| Works offline (fallback) | Delivered, synthetic only | `build_fallback.py check`: replay mode with the network blocked, case 16, browser spec | An offline package of real data: none has been built |
| Hosted deployment | **Not delivered** | Dockerfiles and compose written; **never built** (no Docker daemon available), **nothing deployed** | That the app is hosted anywhere |

## What the product does not claim (keep it that way)

Landing safety, electrical power, link performance or mission feasibility; NASA endorsement; flight qualification. The footer and every result frame already say so.

## The golden reference run

| Claim | Status |
| --- | --- |
| "GR-001 passes the scientific gates" | **Not delivered.** The definition is a draft whose three sites are the RUN-001 rule points, labelled `PLACEHOLDER`. It has not been run live, its convergence report has not been run on real data, and it is not frozen. |
| "Computed claims are added only after the golden run passes the scientific gates" (spec summary) | Currently true by omission: no real-data claim beyond `RUN-001`, which is `real_data_unverified`. Do not add one until GR-001 is run and frozen. |

## Open items that block honest claims

1. **D-09:** three sites with coordinate and terrain provenance.
2. **D-11:** the Horizons contact; the live stack refuses to call Horizons without it.
3. **D-12:** organizer permission for pre-event work; the template is in `docs/permissions/`, **no permission is on file**. Do not state eligibility until it is.
4. **SDR-001:** unsigned.

## Wording to avoid

"validated", "verified" (outside the word "refused"), "accurate", "optimal", "best site", "recommended", "ready for mission use", "NASA-approved".

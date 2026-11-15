# LunaScope Explorer: plan

Status: **E0 and E1 done** (sections 9 and 10); E2 to E7 not started. Follows the galaxy phases ([GALAXY-PLAN.md](GALAXY-PLAN.md), [UI-GALAXY.md](UI-GALAXY.md)).

## 1. Goal

One interface, `/explore`, where a person can explore the Moon the way they would explore Earth in a globe viewer, and control everything from one panel:

- **Moon scale:** a tiled, streaming globe. Orbit, tilt, zoom from the whole Moon down to the surface, fly to a place, see the 15 site presets as pins.
- **System scale:** the Earth, Moon and Sun directions together.
- **Site sky:** stand on a chosen site, look at the horizon, and see the Sun and Earth paths over the terrain.
- **Control panel:** time, layers, view, sites, data status (section 4).

The look is "rich and minimal": the globe is the page, and the interface is a few floating glass controls that stay out of the way. The rest of the app keeps the calm look of the galaxy phases.

Inspiration: a third-party lunar navigator (screenshots shared by the owner). We borrow the *ideas* (a full-bleed Moon, a time dock, scale switching, a selected-site card), not its code, text, layout or branding.

## 2. Non-goals

- No change to the science service, the analysis request or response, or what the product claims.
- No new science in the browser. The browser never computes visibility.
- No real-time claims. Nothing looks live unless a service produced it.
- Not a replacement for the existing run pages; the explorer hands off to them.

## 3. Trust rules (unchanged, they apply here too)

1. Imagery is labelled "illustration of the surface, not an analysis result". Credit and licence are shown and recorded in `docs/submission/LICENCES-AND-CITATIONS.md`.
2. Sun and Earth positions, visibility and timelines come from the science service. If the service does not return the series the explorer needs, that is raised as an open question (E0), not filled with a browser estimate.
3. Status is an icon and a word, never colour alone. "Unknown" is never shown as "not visible".
4. Surface lighting on the globe is decorative unless computed by the service, and is labelled that way.
5. Every pointer interaction has a keyboard alternative and a plain list of sites beside the globe.
6. Reduced motion: no fly-in animation, no auto-rotation, no inertia.

## 4. Control panel

| Group | Controls |
|---|---|
| Time | Play/pause, speed, reverse, loop, next event, go to a UTC date, scrubber |
| Layers | Imagery, elevation shading, terrain horizon, site pins, Sun and Earth paths, labels |
| View | Scale (Moon, System, Site sky), reset, south-pole view, compass, coordinates, scale bar |
| Sites | List and search (reuses the command palette), selected-site card with **Analyse** |
| Data status | The existing data-status pill, always visible |

## 5. Technical approach

| Decision | Choice | Why |
|---|---|---|
| Engine | **CesiumJS with a Moon ellipsoid** (radius about 1737.4 km) | Streaming tiles and a mature globe camera. Needs no account or token. A custom tiled engine on three.js is the fallback if the size is a problem |
| Loading | Dynamic import on `/explore` only | The other pages keep their performance budget |
| Imagery | NASA Moon Trek tiles (LROC mosaic, LOLA shading), a bundled 2K texture as offline fallback | Public NASA data; the fallback keeps the page working if the tile server is unreachable |
| Sites | The existing 15 presets as pins; click a pin for a card | Reuses current data and the analysis flow |
| Arbitrary points | Only if the service accepts them (E0 question) | Otherwise presets only |
| Chrome | Floating `.chrome-glass` panels, shadcn components, command palette for search | Same system as the rest of the app, with an instrument-style (uppercase monospace labels) accent for the explorer |

## 6. Phases

| Phase | Ships | Done when |
|---|---|---|
| **E0 Spike and decisions** | Tile servers reachable from the browser (CORS), licence and credit text, bundle size, engine choice, what the service returns for Sun and Earth series, whether arbitrary points are accepted | A short report and the plan updated. **No UI is built before this passes** |
| **E1 Viewer** | `/explore`, lazy-loaded globe, orbit/zoom/tilt, south-pole view, compass, scale bar, offline fallback, credit line | Smooth at 60 fps on a mid laptop; works with the network blocked (fallback) |
| **E2 Sites** | Pins for the 15 presets, selection card, **Analyse this site** hand-off, site list beside the globe | Keyboard-only selection works; no overlapping labels |
| **E3 Control panel and search** | Layers menu, coordinates readout, palette entries ("go to site", "go to latitude/longitude") | Every control reachable by keyboard |
| **E4 Time dock** | Play/pause, speed, reverse, loop, date entry, scrubber, driven only by service data | Marker moves with the real timeline; no data means a clear "no data" state |
| **E5 System scale** | Earth, Moon and Sun directions, smooth scale switch | Switch needs no reload; labelled as derived |
| **E6 Site sky** | Fly-in to a site, horizon, Sun and Earth paths, return to Moon | Same values as the run's timeline and sky pages |
| **E7 Verification and docs** | axe (both themes, desktop and phone), reduced motion, a performance budget for `/explore`, user guide, design record | All guards pass; docs updated |

Each phase is its own branch and PR, merged before the next starts.

## 7. Risks

| Risk | Mitigation |
|---|---|
| Tile server blocks the browser or changes | Bundled fallback texture; E0 checks CORS first; credit and licence recorded |
| Bundle size | Load only on `/explore`; own budget for that route; fallback engine noted |
| Phone performance | Lower detail level and no tilt animation on small screens; list alternative always present |
| Looks like data but is not | Rules in section 3; labels checked in tests |
| Service does not return Sun/Earth series | Raised in E0; the dock and sky views wait for it, nothing is invented |

## 8. Open questions for the owner

1. Engine: CesiumJS (recommended) or the lighter, larger-effort three.js?
2. Arbitrary click-to-analyse, if the service supports it, or presets only?
3. Imagery source: NASA Moon Trek tiles (recommended) or a texture you already have a licence for?

## 9. E0 report (measured)

Checked on the working tree and from this machine; one observation each, not a lab study.

| Question | Finding | Consequence |
|---|---|---|
| Does the service return Sun and Earth positions over time? | **Yes.** Each site's results carry a `series` per target (Sun, Earth): `step_s`, `az_deg[]`, `el_deg[]` (`SkySeries`, `science/lunascope/responses.py`). The horizon endpoint returns the terrain skyline (`azimuth_deg`, `horizon_el_deg`) | The time dock (E4), the Site sky (E6) and result pins (E4) can be driven entirely by service data. **No ephemeris in the browser.** The System scale (E5) needs Earth-Moon-Sun geometry that is not in these series; E5 needs either a new service field or is limited to directions at the sampled times (open) |
| Does the service accept an arbitrary point? | **Yes, with a coverage check.** `POST /api/v1/sites/custom` takes latitude, longitude, convention and source, and returns `dem_coverage_150km` | Click-to-place is possible (E3). Where the terrain model does not cover a point, the result must say "unknown coverage", never "not visible" |
| Are NASA Moon Trek tiles usable from the browser? | **Yes.** Global LROC mosaic (`LRO_WAC_Mosaic_Global_303ppd_v02`) and LOLA colour shading (`LRO_LOLA_ClrShade_Global_128ppd_v04`) returned 200 with `Access-Control-Allow-Origin: *` | No proxy needed. Tile scheme: geographic, 2x1 tiles at level 0, 256 px, levels 0 to 8, URL `.../{level}/{row}/{col}.jpg`, which matches Cesium's geographic tiling scheme |
| South-pole-specific tiles | The polar layer name I guessed returned 404 | Not found yet. The global tiles are enough for E1; a higher-resolution polar layer is a stretch item to look up in the Trek catalogue |
| Licence and credit | NASA's media guidelines say NASA material is generally not copyrighted and may be used if NASA is acknowledged as the source and no endorsement is implied; the NASA insignia and logos are excluded. The Trek site itself is script-rendered, so **its own terms were not read** | Use a credit line ("Imagery: NASA/LRO ..., via Moon Trek"), use no NASA logos, state no endorsement. **Owner to confirm** the Trek terms before E1 ships |
| Bundle size (CesiumJS 1.147) | ES build 4.8 MB raw, **about 1.33 MB gzipped**, plus workers (1.2 MB) and assets (4.7 MB, mostly not needed). That is roughly **4 to 5 times the whole budget of our other pages** | Acceptable only as a lazy-loaded `/explore` route with its own budget (about 1.5 MB gzipped, set in E7) and a loading state. Tree-shaking via `@cesium/engine` may reduce it and is tried in E1 |

### Decisions from E0

1. **Engine: CesiumJS stays the recommendation**, on `/explore` only, because the global tiles fit its tiling scheme directly. The cost is the bundle. The three.js alternative would mean writing our own tile loader and is only worth it if the bundle proves unacceptable in E1.
2. **Arbitrary points: yes** (E3), with unknown coverage shown honestly.
3. **Imagery: Moon Trek global tiles**, with a bundled 2K fallback, subject to the owner confirming the Trek terms.
4. **Open for E5:** the System scale needs more than direction series; decide in E5 whether to ask for a service field or to draw directions only.

E0 changed no application code.

## 10. E1 record: the viewer

**Shipped.** `/explore`: a Moon globe (CesiumJS 1.147 with the Moon's ellipsoid) with orbit, tilt and zoom to the surface, streamed NASA Moon Trek tiles (levels 0 to 8), a bundled low-resolution picture under them, **Whole Moon** and **South pole** views, a compass that turns north up, zoom buttons, a readout (centre, height, scale bar) and the credit line. It is in the side navigation and in Search.

| Piece | Where |
|---|---|
| Page | `app/explore/page.tsx`, `components/explore/ExploreLoader.tsx` (lazy, client only), `components/explore/ExploreViewer.tsx` |
| Pure helpers (scale bar, formatting, views, key steps) | `lib/explore/geometry.ts`, `tests/web/explore-geometry.test.ts` |
| Cesium runtime files | `scripts/copy-cesium.mjs` copies Workers, ThirdParty and Assets to `public/cesium` (not committed) before `dev`, `build` and `test:e2e` |
| Fallback picture | `public/explore/moon-2k.jpg` (458 KB, NASA imagery, credited) |
| Guards | `tests/e2e/explore.spec.ts` (starts and is sized, controls and keyboard, offline fallback notice, the library loads on this page only, axe in both themes) |

**How it behaves.**
- If the tile server cannot be reached, the globe keeps working on the bundled picture and says so ("The detailed imagery could not be reached").
- If WebGL is unavailable, a flat picture of the Moon and a plain sentence are shown instead.
- Keyboard: the globe is a focusable region; arrow keys turn it, plus and minus zoom, Home returns to the whole Moon. Reduced motion: the fly-to is instant.
- Render on demand (not a continuous loop), so an idle page does not use the GPU.

**Measured** (production build, headless Chromium, no throttling, tiles blocked so only the fallback loads; one observation): JavaScript 1,556 KB transferred, Cesium workers 266 KB, images 544 KB (before the fallback was re-compressed to 458 KB), the globe ready in about 1.2 s on this machine. The other pages load **none** of it (tested). This is above the "about 1.5 MB" guess in section 5: the realistic budget for `/explore` is about **2 MB of script including workers**, to be set in E7. Tree-shaking through `@cesium/engine` may lower it and is not done yet.

**Verification.** `vitest` 316 pass, `tsc` and `eslint` clean, `next build` passes, six new e2e tests pass. Seen in the Browser pane: the whole Moon and the south pole view render with real tiles.

**Not done in E1 (by design).** No site pins (E2), no click-to-place or search (E3), no time dock (E4). The imagery carries no site data and is labelled as illustration.

**Open for the owner:** the Moon Trek terms (section 9 item, now also flagged in `LICENCES-AND-CITATIONS.md`); the south-pole tile layer name for higher resolution near the pole.

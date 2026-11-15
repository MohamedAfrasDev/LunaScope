# LunaScope Explorer: plan

Status: **proposed** (nothing built yet). Follows the galaxy phases ([GALAXY-PLAN.md](GALAXY-PLAN.md), [UI-GALAXY.md](UI-GALAXY.md)).

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

# LunaScope Atlas: the new layout, how every feature looks and how it is used

Status: **specification, no code written yet.** Branch `redesign-layout` (cut from `main`). `main` stays the frozen pitch version.
Companion documents: [USER-GUIDE.md](../USER-GUIDE.md) (the product as built today), [EXPLORE-PLAN.md](../ui/EXPLORE-PLAN.md) (the explorer phases E0 to E7, on `main` after E0).

This document describes the **end state** of the redesign: what a person sees and does, screen by screen, and where each existing feature moves. It changes the **interface only**. The science service, the API, the run ids, the labels and the claims do not change.

---

## 1. What changes and what does not

| Changes | Stays exactly as it is |
|---|---|
| The whole layout: from "pages with a sidebar" to "one full-screen Moon with floating instruments" | The science service and every number it returns |
| The visual language: near-black, monochrome, instrument-style labels | The three rules (no placeholder as science, unknown is not "not visible", no hidden score) |
| The landing page | Outcome words (Pass, Fail, Indeterminate, Excluded), always an icon and a word |
| Navigation: top bar, panels and a time dock | Availability shown as a range, terrain-aware beside flat-horizon |
| Time becomes a first-class control (play, scrub, next event) | Run ids, reference runs GR-001 to GR-003, the evidence export, replay mode |
| Sites are pins on the Moon, not only cards in a list | Accessibility: keyboard for every control, text alternatives, reduced motion, 4.5:1 text contrast |

The old URLs (`/runs/{id}`, `/runs/{id}/timeline/{site}` and so on) keep working. They become deep links that open the Atlas with the same panel in view.

---

## 2. The idea in one sentence

**The Moon is the page.** Everything else is a small panel floating on it, and one time dock at the bottom drives all of it.

---

## 3. The application model

One screen, three **scales** (the camera), a set of **panels** (the instruments), and one **clock**.

| Concept | Meaning | Where |
|---|---|---|
| **Scale** | What the camera shows: **Moon** (the whole globe, orbit and zoom), **System** (Earth, Moon and Sun directions), **Site sky** (standing on a site looking at the terrain skyline) | Top bar, left group |
| **Panel** | A floating card on top of the scene (Selected site, Timeline, Metrics, Clearance, Sky path, Compare, Dates, Evidence, Analyse, Layers, Learn). Collapsible, scrolls inside, never full-page | Top bar, middle group, and the left and right columns |
| **Clock** | A UTC time inside the current run's window. Moves the Sun and Earth, the terminator, the cursor in every chart, and the readouts | Time dock |
| **Run** | A saved result (for example GR-001). The Atlas always shows one run at a time. The run id is in the URL | Top bar, run chip |
| **Site** | One pin on the Moon and one row in Sites. At most one is selected | Pins, Sites panel |

### Routes

| Route | Opens |
|---|---|
| `/` | Landing (section 6.1) |
| `/atlas` | The Atlas with the reference run GR-001 (the default) |
| `/atlas?run={id}&site={siteId}&scale=moon|system|sky&panel=timeline&t={utc}` | The Atlas at an exact state. This is the share link; it carries view state only, never a token or a result |
| `/runs/{id}/...` (old routes) | Redirect to the matching Atlas state |
| `/learn` | Why the south pole is hard (also a panel) |

---

## 4. Screen anatomy

```
┌ TOP BAR ───────────────────────────────────────────────────────────────────────────────────────────┐
│ ● LUNASCOPE  | MOON · SYSTEM · SITE SKY | TIMELINE · SITES · CLEARANCE · SKY PATH · METRICS · COMPARE │
│              | DATES · EVIDENCE · ANALYSE · LEARN                    run chip · Search (Ctrl+K)       │
├────────────────────────────────────────────────────────────────────────────── READOUT (top right) ─┤
│ LEFT COLUMN                       FULL-BLEED SCENE                     TIME   2026-11-18 21:48 UTC   │
│ ┌ SELECTED SITE ┐                 the Moon (or system, or             SUB-SOLAR POINT  1.5°S 66.9°E │
│ │ name, coords  │                 site sky). Pins with labels,        SCALE  MOON SCALE             │
│ │ source, status│                 terminator, compass                                               │
│ │ [Enter sky]   │                                          ┌ ACTIVE PANEL (right) ┐                 │
│ └───────────────┘                                          │ one of: Clearance,   │                 │
│ ┌ TIMELINE ─────────────────┐                              │ Sky path, Metrics,   │                 │
│ │ SUN   ▓▓▓▓▓▓▓▓░░░░░░     │                              │ Compare, Dates,      │                 │
│ │ EARTH ▓▓▓▓▓▓▓▓▓▓▓▓▓▓     │                              │ Evidence, Analyse    │                 │
│ │ BOTH  ▓▓▓▓▓▓░░░░░░░░     │                              └──────────────────────┘                 │
│ └───────────────────────────┘                                                                       │
├ TIME DOCK ─────────────────────────────────────────────────────────────────────────────────────────┤
│ ▶  PAUSED · 1 HOUR PER SECOND | 1 MIN  10 MIN  1 HOUR  6 HOURS  1 DAY | REVERSE  LOOP  NEXT EVENT ──●── T+ 3 D 14 H │
│ [GR-001 · frozen]  Go to (UTC) [date/time] GO  LIVE        [REAL DATA, UNVERIFIED] imagery credit   │
└────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

Rules for the layout:
- The scene is always the largest thing. Panels never cover the selected pin.
- At most **two** panels are open on the left and **one** on the right at once. Opening another on the right replaces the current one.
- Panels never use the browser's native scrollbars; they use thin custom scrollbars. No horizontal scrolling inside a panel, ever (text wraps, tables switch to stacked rows).
- The data-status pill and the imagery credit are always visible in the dock's status line.

---

## 5. Visual language

### 5.1 Colour

Near-black, white, and two meaningful hues. Colour is never the only cue.

| Token | Value (starting point) | Use |
|---|---|---|
| `--void` | `#050507` | Page and space |
| `--panel` | `#0d0d11` at 88% with a hairline `#2a2a30` | Panels (opaque enough that data is readable on any imagery) |
| `--ink` | `#f2f2f4` | Primary text |
| `--ink-dim` | `#a4a4ae` | Secondary text (stays 4.5:1 on `--panel`) |
| `--sun` | `#e8a33d` | The Sun series, and nothing else |
| `--earth` | `#6db6f2` | The Earth series, and nothing else |
| `--select` | `#ffffff` ring | The selected site, the focus ring, the active tab. White rather than a hue, so it never competes with Sun or Earth |
| `--ok` `--warn` `--fail` | existing mint, amber, rose | Outcome chips only, always with an icon and a word |

The light theme is dropped inside the Atlas (a space instrument is dark). Printed or exported pages keep a light stylesheet.

### 5.2 Type

- **Labels, tags, readouts, panel titles:** a monospace face, uppercase, wide letter-spacing (about 0.14em), 11 to 12 px.
- **Numbers that matter** (elevation, availability): monospace, large (28 to 40 px), tabular figures.
- **Prose** (explanations, warnings): the existing sans, 14 to 15 px, sentence case, line length under 60 characters.
- Three sizes of label, two of number, one of prose. No more.

### 5.3 Tags (the trust layer)

Every block of numbers carries one tag in the corner, in the same dashed or solid box style:

| Tag | Meaning | Source today |
|---|---|---|
| `NASA DATA` (solid box) | A value taken from a NASA source as published (site coordinates, ephemeris pins) | catalog and manifests |
| `DERIVED` (dashed box) | Computed by the science service from NASA data | every result |
| `ASSUMPTION` (dotted box) | A value we chose (margin band, observer height, requirement thresholds) | request settings |
| `ILLUSTRATION` | Decorative (imagery, lander model, surface lighting) | scene |
| `SYNTHETIC` | Invented test data; the whole screen gets a banner | synthetic stack |
| `REPLAY` | Saved run only; new analyses are refused | replay mode |

This replaces the result-state frame visually but keeps its meaning one for one (Synthetic demonstration, Real data unverified, Validated).

### 5.4 Panels

- A panel has a title (monospace caps), a minimise button, and a one-pixel top rule in the select colour **only when it is the focused panel**.
- A panel's first line is the answer in words, the details are below, and anything long is folded ("Show as table", "Details").
- Empty, loading and error states are written sentences, not spinners alone.

### 5.5 Motion

- Page to Atlas: a 1.2 s fly from the landing Moon into the south-pole view.
- Scale switch: a 600 ms camera move. Time play: the terminator and the Sun and Earth markers move continuously.
- Reduced motion: no fly, no inertia, no idle rotation; playback is off but the scrubber and event buttons work (as today).
- Idle: a very slow rotation of the globe on the landing page only.

---

## 6. Every screen

### 6.1 Landing (`/`)

**Looks like.** A full-bleed Moon (lit crescent on black), a wide-tracked wordmark `L U N A S C O P E`, one line "Terrain-aware sunlight and Earth visibility at the lunar south pole", and a single **ENTER** button. A small credit line bottom right. Nothing else on first view.

**Usage.** Enter goes to `/atlas` (GR-001). Below the first screen (scroll or the **Learn** link) sit three short sections: the idea in two minutes, the three rules, and what it is not (the existing text). **Start your own analysis** is a secondary link that opens the Analyse panel.

### 6.2 Atlas, Moon scale (the default)

**Looks like.** The south pole centred on the lit side, real LROC imagery, pins for the 15 preset sites with short labels (name and a one-line method tag such as `TERRAIN-AWARE · 20 M`), the day/night terminator, a compass and a scale bar. The three readouts top right (time, sub-solar point, scale).

**Usage.**
- Drag to orbit, scroll or pinch to zoom, right-drag or two fingers to tilt. **South pole** and **Whole Moon** buttons reset the view. Arrow keys turn, plus and minus zoom, Home resets.
- Click a pin, or choose a site in **Sites**, to select it. The left column shows **Selected site** and **Timeline** for it.
- **Layers** toggles pins, labels, terminator, graticule, imagery (LROC or LOLA shading) and the Sun and Earth direction arrows.
- Click empty ground with **Place a point** on: a custom point is added (latitude −90 to −80), with the coverage check shown honestly (**unknown coverage** is never drawn as "not visible").

### 6.3 Selected site (left panel)

**Looks like.** Name, a chip for the method (`TERRAIN-AWARE · 20 M`), a chip for the source status (`COORDINATES NOT YET DOUBLE-CHECKED` when that applies), latitude and east longitude, point type, source link, and **How this point was chosen**. Under it the site's verdict: Sun and Earth outcome chips with availability ranges, and the flat-horizon comparison line.

**Usage.** Buttons: **Enter site sky**, **Centre on site**, **Reset view**, **Open evidence**. For a custom point: **Check terrain coverage**, **Remove**.

### 6.4 Timeline (left panel, bottom)

**Looks like.** Two aligned bars for the selected site: SUN and EARTH (a third BOTH row was dropped in phase E: the product judges Sun and Earth separately, rule 3, and a joint row would need the browser to combine classified states). Colours are the Sun and Earth hues; patterns carry the state (solid clear, hatched marginal/unresolved, dark blocked, dotted unknown). Rise and set ticks (▲ ▼) sit on the bars, a white cursor marks the dock time, and a one-sentence summary sits under it ("Sun above terrain horizon for 53% of the window, line of sight to Earth for 90%…").

**Usage.** Click or drag the bars to move the clock. **Show as table** opens every interval (state, start, end, note) and **Download intervals (CSV)** exports it. Flat-horizon rows appear under **Compare to a flat horizon**.

### 6.5 Metrics (right panel)

**Looks like.** A headline chip with the site's overall status, then two cards, **Sun above terrain horizon** and **Line of sight to Earth**, each with the big elevation at the cursor, azimuth, clearance and state. Below, grouped cards: share of the window, longest continuous period, longest darkness, number of darkness periods, for Sun, Earth and Both, each tagged `DERIVED`. The margin band is tagged `ASSUMPTION`.

**Usage.** Everything follows the dock time. A **Terms** (?) button explains each word. Values that are ranges stay ranges ("74.5 to 74.7%").

### 6.6 Clearance (right panel)

**Looks like.** A line chart over the window: Sun clearance above the terrain horizon (solid, Sun hue) and line of sight to Earth (dashed, Earth hue), a zero line, the marginal band shaded, and the dock cursor. A one-paragraph reading under it and **Show as table**.

**Usage.** Hover for exact values, click to move the clock. Switch **Terrain-aware / Flat horizon** with a toggle to see the difference.

### 6.7 Sky path (right panel)

**Looks like.** Azimuth across, elevation up: the Sun track (solid) and Earth track (dashed) over the hatched terrain skyline, the flat 0° horizon as a dotted line, markers at the cursor time. **Earth close-up** zooms into Earth's small libration loop.

**Usage.** Views: **Unrolled**, **Polar**. **Enter site sky** continues into the 3D view. Text alternative: positions table every 6 hours and CSV download (as today).

### 6.8 Site sky (scale)

**Looks like.** First-person on the surface at the selected site. The terrain skyline is the horizon, the Sun and Earth sit in the sky with their paths (gold line, blue loop), a compass on the right (heading and cardinal), and the readouts show **SUN AZ/EL** and **EARTH AZ/EL**. A **Mission window** card shows day N of M, time left, and a three-row status (Sun above terrain, line of sight, both) with how long both have been visible so far. The lander is an `ILLUSTRATION`-tagged generic model.

**Usage.** Drag to look around, wheel to zoom. Buttons: **Face the Sun**, **Face the Earth**, **N E S W**, **Sun path**, **Earth path**, **All paths**, **Exaggerate heights ×3** (stated on screen when on), **Return to Moon**. Everything follows the dock time. Without WebGL the polar and unrolled plots show the same sky.

### 6.9 System scale

**Looks like.** Earth, Moon and Sun directions at the dock time, labelled `DERIVED`. Not to scale, and it says so.

**Usage.** Switching scale needs no reload. **Open question:** the service must supply the geometry for this view; if it cannot, this scale shows directions at the sampled times only, or is cut (decision D4).

### 6.10 Compare (right panel)

**Looks like.** Pick two or more sites (chips). A **Held constant / Changed** block, then **What differs** as typed facts, then a paired timeline with one row set per site on one time axis. A **Window length and constraints** selector with the `ASSUMPTION` tag ("Example profile with arbitrary starting values, not a mission requirement").

**Usage.** No ranking, no score. The panel never shows more than the sites you picked.

### 6.11 Dates (right panel; today's Time Machine)

**Looks like.** Two parts. **Shift the start** (a number of days from −30 to 30) with **Shift and recompute**; and **Which dates pass?** with From, To and Step and a strip of up to 15 chips (Passes, Fails, Unknown, Not run yet, Queued, Running), then a delta table and the changed spans.

**Usage.** The dock gets an **A / B** switch: baseline and shifted run each on its own clock, or on a shared calendar axis. Unrun dates are never counted as pass or fail.

### 6.12 Evidence (right panel)

**Looks like.** Three validation cards (Sun and Earth geometry, Terrain horizon, Numerical convergence) as icon-and-word chips (Met, Not met, Not evaluated), the disc-size check (upper limb, centre, whole disc), the provenance folds (identity and pins, method and inputs, per-site geometry) and the limits.

**Usage.** **Download investigative bundle (JSON)** stays. A "verified" export stays refused until a scope closes. This panel is also the pitch's "trust" slide.

### 6.13 Analyse (right panel, today's /analyze)

**Looks like.** The same form, restyled: **Mission window**, **Sites** (checkboxes plus **Add a custom point**), and a closed **Advanced settings** with requirements, terrain and options. A summary line states the current values.

**Usage.** **Run analysis** validates, sends and opens the new run in the Atlas. **Reset to the reference mission** and **Copy a link to these inputs** stay. In replay mode it says plainly that new analyses are refused.

### 6.14 Learn (right panel)

The idea in two minutes, the three rules, what it is not, why the south pole is hard, the key terms, the page tour trigger. Same text as today, in the panel.

### 6.15 Sites (left panel)

A searchable list of all sites with status chips; also the keyboard alternative to clicking pins. Selecting a row selects the pin and flies to it.

### 6.16 Search (Ctrl+K)

The existing command palette, extended: go to site, go to latitude/longitude, switch scale, open any panel, set time, take the tour, pause motion, copy link.

---

## 7. Where every existing feature goes

| Today | Atlas |
|---|---|
| Home hero, rules, "what it is not" | Landing, then Learn |
| Reference mission button and notable-place cards | Run chip menu: GR-001, GR-002, GR-003 |
| `/analyze` form, share link, coverage check | Analyse panel |
| Run page verdict and site cards | Selected site panel plus the run chip summary |
| Full comparison table and status matrix | Compare panel, "Show as table" |
| Timeline page | Timeline panel plus Metrics and Clearance |
| Local sky (polar, unrolled, 3D) | Sky path panel and Site sky scale |
| Compare | Compare panel |
| Time Machine and dates search | Dates panel |
| Evidence and export | Evidence panel |
| Why the south pole is hard | Learn panel and `/learn` |
| Data-status pill, replay badge, no-service strip | Dock status line and a top banner |
| Guided / Technical switch | Top bar toggle (changes wording in Timeline, Metrics, Clearance) |
| Recent runs | Run chip menu |
| Page tour | Starts from the landing and Search, and outlines the scene, dock and panels |

Nothing is removed. A feature that has no home in this table is a bug in this document.

---

## 8. Usage walkthroughs

### 8.1 The three-minute pitch

1. **Landing.** "The Sun and Earth sit a few degrees above the horizon at the south pole, so the terrain decides." Press **Enter**.
2. **Moon scale, GR-001.** The camera glides to the south pole. Pins appear. "Here are the sites we compare."
3. **Select a site.** The Selected site and Timeline panels open. "A flat horizon says the Sun is up for X%; with real terrain it is Y%." (the flat-horizon line).
4. **Play the clock.** Press play at 1 hour per second: the terminator moves, the cursor sweeps the timeline, rises and sets tick by.
5. **Enter site sky.** Stand on the site; the Sun is behind a ridge, then rises above it. "This is what the number means."
6. **Evidence.** Open the panel: "Every value carries its provenance and a status of unverified, met or not met. We do not claim more than we have checked."
7. **Dates.** "If the date slips, which dates still pass?" Show the strip.

### 8.2 A researcher's analysis

Open **Analyse**, choose a window and sites (or place a point on the Moon), press **Run**. The Atlas opens the new run, centred on the first site. Use **Compare** for the sites side by side, **Dates** for slips, **Evidence** to export the bundle.

### 8.3 A learner's visit

**Learn**, then **Take the tour**: the tour outlines the scene, the dock, then the panels in turn.

---

## 9. Accessibility, keyboard, responsive

- **Every pointer action has a keyboard path.** The globe is a focusable region (arrows turn, plus/minus zoom, Home resets). **Sites** is the keyboard route to every pin. Panels are reachable from the top bar and with `1` to `9`.
- **Time dock keys:** Space play/pause, `.` next event, `,` previous event, left and right arrows step ten minutes, `[` and `]` change speed.
- **Global keys:** Ctrl/Cmd+K search, `/` search, `H` hide the interface (for screenshots), Esc closes the focused panel or dialog.
- **Contrast:** text 4.5:1 on panels, control edges 3:1; guarded by an updated `tokens.test.ts`.
- **Status:** always an icon and a word; patterns, not only colour, on every chart.
- **Reduced motion:** see 5.5. **WebGL missing:** a still Moon picture, the Sites list and every chart still work.
- **Screen readers:** every chart has a text summary and a table; the scene has a text description that updates with the selection and time.
- **Phone (under 768 px):** the scene fills the screen; the top bar collapses to a menu; panels become **bottom sheets** (one at a time, draggable); the dock shows play, the scrubber and a speed menu. No horizontal scroll from 320 px.

---

## 10. States

| State | What is shown |
|---|---|
| Loading imagery | The bundled low-resolution Moon, then tiles fade in; a one-line "Loading detail" |
| Tiles unreachable | Stays on the bundled picture and says "The detailed imagery could not be reached" |
| Service unreachable | A banner: "Science service not reachable. No results can be computed or shown right now." No stale numbers |
| Replay mode | `REPLAY` tag; Analyse says new analyses are refused |
| Synthetic stack | A full-width `SYNTHETIC` banner and tag on every panel |
| Run running | A progress card in the run chip and in the Analyse panel; the Atlas shows the previous run until it completes |
| Site excluded | Pin drawn hollow with a cross; the panel says why and that it is not counted as a failure |
| Unknown coverage | Pin drawn dashed; "unknown coverage" in words |

---

## 11. Trust rules (unchanged, they apply to every new screen)

1. Imagery and the lander are tagged `ILLUSTRATION`; imagery carries NASA credit and no NASA logo or endorsement.
2. The browser never computes visibility. Sun and Earth positions, skylines, states and timelines come from the service. If a series is missing, the panel says so and shows nothing in its place.
3. Surface lighting and the terminator on the globe are decorative unless computed by the service, and are labelled.
4. Unknown is never drawn or counted as hidden.
5. No combined score, no ranking.
6. Not flight-qualified, not endorsed by NASA: the footer text moves to Learn and stays in the dock status line as a short tag.

---

## 12. Data each screen needs (no new science)

| Need | Source today |
|---|---|
| Sun and Earth az/el over time | `series` per target (`step_s`, `az_deg[]`, `el_deg[]`) |
| Terrain skyline | horizon endpoint (`azimuth_deg`, `horizon_el_deg`) |
| Intervals, events, metrics | run results and the event endpoints |
| Custom point and coverage | `POST /api/v1/sites/custom` (`dem_coverage_150km`) |
| Compare, Time Machine, dates | existing compare and time-machine endpoints |
| Evidence and export | existing evidence and export endpoints |
| Imagery | NASA Moon Trek tiles with a bundled fallback (terms to confirm) |
| **Not available yet** | Earth-Moon-Sun geometry for the System scale (D4) |

---

## 13. Build phases (each is a reviewable step on this branch)

| Phase | Ships | Done when |
|---|---|---|
| **A. Foundations** | Cherry-pick the E1 viewer commit (`68ba87e` from `explore-e1`); new tokens, type, tags and panel components; top bar and dock skeleton; `/atlas` route | Empty Atlas renders; contrast tests updated and passing |
| **B. Landing** | New `/` | Looks as in 6.1; Enter reaches the Atlas; axe clean |
| **C. Sites** | Pins, labels, Selected site, Sites list, custom point | Keyboard-only selection works; labels do not overlap |
| **D. Time dock** | Play, speed, reverse, loop, next event, go-to date, scrubber, driven by `series` | The cursor in every chart follows the clock |
| **E. Panels** | Timeline, Metrics, Clearance, Sky path, Compare | Same numbers as the old pages (checked by test) |
| **F. Site sky** | Fly-in and the 3D view inside the Atlas | Same values as the old Local sky page |
| **G. Run tools** | Analyse, Dates, Evidence, Learn, run chip, redirects from old routes | Every row of section 7 has a home |
| **H. System scale** | Only if D4 is decided | Labelled derived |
| **I. Verification** | axe, reduced motion, phone layout, performance budget, smoke test, user-guide update | All guards pass; `npm run verify` green |

---

## 14. Decisions needed

| # | Decision | Recommendation |
|---|---|---|
| D1 | Product name and wordmark | Keep **LunaScope**. Do not reuse any other project's name or mark |
| D2 | Accent colour | None beyond white selection, Sun gold and Earth blue (section 5.1) |
| D3 | Keep the light theme outside the Atlas | Drop it in the Atlas, keep it for printed pages |
| D4 | System scale | Build only if the service can supply the geometry; otherwise cut |
| D5 | Moon Trek imagery terms | The owner confirms before this ships |
| D6 | Old routes | Redirect to the Atlas (keeps old links and tests working) |

---

## 15. Build record

### Phase A (foundations), done
`app/atlas.css` (scoped `.atlas` tokens, labels, panel, tags, pins), Tag, Panel, Readout, TopBar, TimeDock and Learn components, `/atlas`, and the E1 viewer in full-bleed mode. Contrast guarded by `tests/web/atlas-tokens.test.ts`.

### Phase B (landing), done
`/` is the Moon (three.js sphere with the bundled NASA surface picture, illustrative lighting), the wordmark and one Enter button; the idea, rules, limits and saved runs sit below. The data-status pill is on the first screen. Routes now live in two groups: `app/(shell)` (sidebar shell, analysis pages) and `app/(bare)` (landing and Atlas, full screen). The folder decides the layout; nothing reads the URL at runtime, which `cacheComponents` would reject on `/runs/[runId]`.
Production cost measured: landing JS 430 KB and images 459 KB (budgets raised from 300 KB and 120 KB to 560 KB and 600 KB, with the reason in `perf-budget.spec.ts`); Atlas JS 1,710 KB (CesiumJS, this route only).

### Phase C (sites), done
- Pins for every catalog site, drawn as real focusable buttons over the globe; positions are written per frame; a pin the Moon hides is hidden; labels are decluttered so none overlaps another, with the selected site always labelled (`lib/atlas/sites.ts`, `PinLayer`).
- Ring style carries terrain coverage (solid: whole 150 km footprint covered; dashed: partly outside or not checked). Unknown coverage is shown as unknown.
- **Sites** panel (search, groups, add a point by coordinates) is the keyboard route to everything the pins do. **Selected site** panel shows coordinates, feature, precision, coverage, source and an **Analyse this site** link that fills the analysis form (inputs only, nothing is started).
- **Place a point**: a click on the Moon (latitude -90 to -80) is checked by `POST /sites/custom`; a refusal or an unreachable service is said in words and no point is invented. The precision of a hand-placed point (1,000 m) is a stated assumption.
- Fixed: the overlay layer was catching the mouse, so the globe could not be dragged or clicked between instruments. Only the top bar, panels and dock take the mouse now.
- Not in this phase: Sun and Earth results for a selected site, the clock, Enter site sky (all need a run; phases D to F).

### Phase D (time dock), done
- **Run:** the Atlas loads the reference run GR-001 (submitted exactly as the service holds it, polled until finished, series fetched once), or any run with `/atlas?run=<64 hex>`. If any step fails the dock says why and shows no time (`useRun`).
- **Clock:** seconds since the start of the run window (read from the service's intervals). Play and pause, speed (1 min to 1 day per second), reverse, loop, previous and next event, a scrubber, and go to a UTC time (refused in words outside the window). At an end it loops or stops and pauses. Under reduced motion playback is off, and the scrubber and the event buttons still work. A playing clock commits to React ten times a second. Pure rules are in `lib/atlas/clock.ts`.
- **Events:** the Next and Previous buttons jump between the service's rise and set times for the selected site, or for every site of the run when none is selected (the dock says which).
- **At the cursor:** the Selected site panel shows each target's azimuth and elevation (interpolated between the service's samples, for display) and the service's classified state at the clock time, tagged `DERIVED`. A site that is not in the loaded run says so and shows no numbers.
- **Keys:** Space plays or pauses (not while a button or field has focus), `.` and `,` next and previous event, `[` and `]` speed, arrows on the scrubber move ten minutes (an hour with Shift).
- **Not in this phase:** the Moon's terminator and sub-solar point (the service returns per-site series, not a global sun position, so nothing is drawn that the service did not compute), and the charts that share the cursor (phase E).
- Fixed on the way: a go-to time typed in the field was lost when Go was pressed, because the click blurs the field first.

### Phase E (result panels), done
- **Timeline** (left, under Selected site): Sun and Earth bars from the service's classified intervals, its rise and set ticks, a cursor on the clock, drag to seek, an optional flat-horizon comparison, a table of every interval in words and a CSV download. No combined row (see 6.4).
- **Metrics** (right): per target the outcome (icon and word), availability as a range against the requirement (the requirement is tagged `ASSUMPTION`), the flat-horizon comparison, longest and total hidden time, best clearance, the time at the start and the reading at the cursor.
- **Clearance** (right): each target's elevation over the window (the service's series) against the terrain skyline in its direction (the service's skyline), with the cursor. It never subtracts the two: the clearance figures printed beside it are the service's, and a gap in the skyline line means unknown, not flat.
- **Sky path** (right): the run pages' own Local sky plots (unrolled and polar), reused, with a marker at the clock time.
- **Compare** (right): the service's comparison for the chosen sites of the run, with its typed facts worded by the same templates as the Compare page. No ranking.
- The right-hand panels share one column. A site panel with nothing to show says why (no run, no site selected, or a site the run does not hold).
- **Parity:** `tests/e2e/atlas-panels.spec.ts` loads the Timeline run page for the same site and checks that availability, longest and total hidden time, best clearance and the countdown at the start are the same text on both. Sky path's position is checked against the Selected site readout.
- Fixed: scrollable panel bodies are now keyboard-focusable (axe `scrollable-region-focusable`).

### Phase F (Site sky), done
- **Scale:** Site sky is on in the top bar once a site that the loaded run holds is selected (otherwise it is off and says why). Enter it there, or with Enter site sky on the Selected site card. Losing the site leaves Site sky and selecting again does not jump back in.
- **Scene:** the run pages' 3D sky (`Sky3D`), now embeddable full-bleed with host-controlled look mode, exaggeration and path visibility. The wall is the service's terrain skyline (an unknown sector is left open), Sun and Earth sit where the service's series puts them at the clock time, and a target behind the wall is hidden only because the data put it there. Three.js loads on the first visit only. Without WebGL it says so and points to the Sky path plots.
- **Controls:** Face the Sun, Face the Earth, N E S W, Sun path, Earth path, All paths, Look around or From outside, Exaggerate heights ×3 (stated on screen and in the scale readout whenever on), and Return to Moon. A compass line shows the heading ("151° SE, facing south-east").
- **Readout:** time, the Sun's and Earth's azimuth and elevation (tagged `DERIVED`), and the scale. **Mission window** panel: day N of M, time left, and for each target the service's state now and its availability over the whole window. No combined "both visible" figure (rule 3).
- **Not built:** the generic lander model. It is decoration the spec marked `ILLUSTRATION`, and it adds nothing the data shows; the observer pin of the 3D sky stays.
- Fixed on the way: the compass uses the eight points the reference uses (151 degrees is SE), not sixteen.

### Phase G (run tools), done
- **Runs** (the run chip in the top bar): the three reference missions (GR-001, GR-002, GR-003, each submitted exactly as the service holds it), the runs opened on this device, and any run by its id. The choice is written to the address (`?run=<id>` or `?ref=GR-002`) so a view can be shared, and the Atlas reads it on a first load and on a link from another page. The page passes the address to the Atlas as props, because reading `window.location` during a client navigation gave the previous address.
- **Analyse:** the analysis form inside the Atlas. **Analyse this site** on the Selected site card opens it with that site filled in (inputs only, nothing starts). Starting a run hands it to the Atlas, which loads it when it finishes. A classic share link `?d=` opens the panel with the inputs filled in.
- **Dates** (the Time Machine and the dates search) and **Evidence** (validation cards, disc-size check, provenance, export) are the run pages' own components, embedded for the loaded run, with a section heading instead of a second `h1`.
- The wide panels (Analyse, Dates, Evidence) take a wider right column.
- **Old routes:** they are **not** redirected. Every classic run page now has an **Open in the Atlas** link, and Search has **Open the Atlas**. A redirect would remove the pages the parity tests and the pitch version of the product rely on; it is a one-line decision for the end (D6).

#### Feature map, as built
| Today | Atlas | Status |
|---|---|---|
| Home hero, rules, "what it is not" | Landing, then Learn | done |
| Reference mission and notable-place cards | Runs panel (GR-001, GR-002, GR-003) | done |
| `/analyze` form, share link, coverage check | Analyse panel; coverage check on the Sites panel | done |
| Run verdict and site cards | Selected site card, Metrics, Mission window | done (the matrix and cards stay on the classic run page) |
| Full comparison table and status matrix | Compare panel | partial: the matrix is classic only |
| Timeline page | Timeline, Metrics, Clearance | done |
| Local sky (polar, unrolled, 3D) | Sky path panel and Site sky | done |
| Compare | Compare panel | done |
| Time Machine and dates search | Dates panel | done (the A/B clock switch is not built) |
| Evidence and export | Evidence panel | done |
| Why the south pole is hard | Learn panel and `/why-the-south-pole-is-hard` | done (the page stays) |
| Data-status pill, replay badge, no-service strip | Dock status line and the top strip | done |
| Guided / Technical switch | not in the Atlas | open |
| Recent runs | Runs panel | done |
| Page tour | not in the Atlas | open |
| System scale | not built (needs service geometry, D4) | open |

### Phase I (verification and polish), done
- **Phone (under 768 px):** the top bar folds behind a **Menu** (choosing something closes it), the run chip stays beside the name, one panel at a time is a bottom sheet (choosing a site replaces the list with its card), the dock keeps play, the scrubber, the time, the data label and the imagery credit with **More** for the rest, and Site sky folds its controls behind **Controls**. Nothing opens on its own on a phone. Checked at 320, 375 and 414 px (no sideways scroll, sheet above the dock, dock under 45% of the height) and at 768 px (desktop columns).
- **Production build:** passes; `/atlas` is partially prerendered. Measured bytes: landing JS 415 KB and images 459 KB; Atlas JS 1,762 KB (budgets 560 KB, 600 KB and 2,200 KB hold); the analysis page is unchanged at 245 KB.
- **Docs:** the user guide has a section on the Atlas (15) and the README links the spec.
- **Left open:** System scale (D4), Guided/Technical in the Atlas, the page tour, the A/B clock, redirecting the old run routes (D6), and the Moon Trek terms (D5).

### Site sky look (after phase I)
Inside the Atlas the 3D sky is drawn as a lit scene: a grey regolith ground and terrain wall (a seeded procedural picture), a gold skyline, a glowing Sun that the terrain hides, an Earth globe whose phase is lit from the side of the Sun (so it follows the angle between the Sun and Earth directions the service returned), thin path lines, small compass letters and a generic lander with a **Lander** toggle. The Mission window carries an `ILLUSTRATION` note: the ground, the Earth's surface and the lander are drawn, not photographed, and the Sun and Earth are enlarged. The run pages' 3D view keeps the diagram look. The fixed colours live in `lib/atlas/sky-look.ts` so the theme guard on `Sky3D.tsx` still holds. Fixed: the camera near plane clipped the ground under the viewer (a black band at the bottom).

### Sky for any site, and real pictures (after phase I)
- **Compute sky for this site.** A site the loaded run does not hold (a catalog place such as Haworth or Shackleton, or a custom point) shows **Compute sky for this site** on its card. It submits a one-site run with the loaded run's window, requirements and terrain settings (read from the run's provenance), follows it with progress, and merges the answer in. From then on Timeline, Metrics, Clearance, Sky path, the clock's event jumps, the cursor readout and Site sky work for it. A result whose window does not match the loaded run is refused. A refusal (for example in replay mode) or a failure is said in words and nothing is invented. Everything computed is dropped when another run is loaded. Sites of the loaded run are never replaced. Custom points work the same way (`lib/atlas/site-run.ts`, `useSiteRuns`).
- **Real Earth and Sun.** Site sky uses NASA's Blue Marble picture for the Earth and an SDO/HMI photograph of the Sun (cut to its disc), stored in `public/atlas/` and credited in the scene and in `docs/submission/LICENCES-AND-CITATIONS.md`. The Earth turns with the clock: the side that faces the Moon at each UTC time is estimated from the sidereal time and a low-precision Moon position (`lib/atlas/earth-orient.ts`, about half a degree), and the globe is lit from the Sun's side so its phase follows the Sun. This is a display estimate, not a service result, and the scene says so. The drawn globe and Sun remain as fallbacks while the pictures load.
- **Why the paths looked flat.** The three built-in rule points sit at 89.5 degrees south, where the Sun circles the horizon within about one and a half degrees; that is real, not a drawing fault. Places at 80 to 88 degrees south have paths that rise and fall, and show them once computed. The grey block that appeared on the horizon in the synthetic data is the terrain skyline where the synthetic skyline is known; sectors with no skyline data are left open, never drawn as flat ground.

## Real ground in Site sky

The skyline wall alone looked like a cut-out, so Site sky now draws the real ground around the site. `GET /api/v1/terrain/patch`
(Python: `science/lunascope/patch.py`; BFF allow-list entry in `lib/bff.ts`) returns the LOLA DEM heights on a 25 km, 150 m grid in the
site's own east/north frame, as little-endian int16 in half-metre units relative to the site (row 0 north, column 0 west, missing
cells marked NODATA, never guessed). `lib/atlas/terrain.ts` turns it into a mesh (patch radius mapped to the scene's 9.8 units,
Moon curvature d²/2R subtracted, holes left open); `Sky3D` shades it by how each patch faces the Sun, with no cast shadows, and only
lights it when the service's classified interval says the Sun is visible. Beyond the patch, and if the patch is unavailable (replay
copy, no DEM files, slow), the service's skyline wall stands as before. This is a picture: whether the Sun or Earth is visible is
still read only from the service's skyline and intervals. Synthetic stack: the patch is the demonstration ridge, labelled
`synthetic_demonstration`; live: `real_data_unverified`.

## Sunlit Moon

On the Moon scale of the Atlas the globe is lit from the Sun at the clock's UTC time: the sunlit half is bright, the other half
dark (imagery night alpha 0.07), with a clear terminator that moves as the clock runs (about 12.2° of longitude a day).
`lib/atlas/sun-light.ts` gives the sub-solar point (low precision, about a degree: a display estimate, not a service result; it
never says whether anything is visible from a site). The imagery is also brightened and given more contrast, and the globe uses a
finer tile level of detail. The Explorer page keeps its unlit look.

## The Atlas replaces the sidebar layout

The `(shell)` route group (sidebar, top bar, run, timeline, sky, compare, time machine, evidence, analyse, explore and explainer
pages) and every component only they used were deleted. `/` is still the Moon landing and `/atlas` is the app. `next.config.ts`
redirects the old addresses: `/runs/:id/...` to `/atlas?run=:id`, and `/analyze`, `/explore` and `/why-the-south-pole-is-hard` to
`/atlas`. The explainer and key terms now live in the Learn panel. The Atlas keeps the evidence, dates, compare and analyse tools as
panels. The classic pages remain on `main`.

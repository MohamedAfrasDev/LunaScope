# LunaScope UI redesign plan: "Mission console, in shadow"

Status: plan only, no code written. Follows `UI-POLISH.md` (token and consistency pass, merged in PR #14).

Decisions already made:
1. **Dark-first.** Dark is the default look; light stays fully supported.
2. **Custom SVG** for the hero illustration (no stock art, no brand art).

## 1. Problem

The product is rich but reads as a cluttered admin dashboard. Diagnosis:

1. **Generic theme.** A lunar south-pole product with no lunar identity; the best visual (the polar skyline plot) is buried.
2. **Numbers before answers.** Run page opens with a 6-column table of ~12 chips; timeline opens with text-heavy cards; Time Machine opens with three stacked forms.
3. **Everything has equal weight.** Banner, result-state strip, captions, helper text, warning codes and legends all compete.
4. **Flat navigation.** A run has 6 views reached by links buried in cells and pages; no "I am inside one analysis" sense.
5. **No narrative.** The core story (Sun above a flat horizon, hidden by a ridge) is only a paragraph and a schematic on a sub-page.
6. **Dry first run.** Home is text plus one button.

## 2. Direction

- **Dark-first**, near-black with a faint cool tint. Light theme re-tuned to match.
- **Two protagonists, two hues:** warm amber = Sun, cool blue = Earth, used identically in chips, plots, charts, cards.
- **Status stays as today:** pass / fail / unknown / excluded always icon + word, never colour alone.
- **Type:** Geist retained; tabular mono treatment for readouts, coordinates, percentages.
- **Imagery:** one custom SVG skyline hero built from the same geometry as the existing schematic. No gradients, no glow.
- **Motion:** subtle (sun marker drifting, plot reveal); fully off under `prefers-reduced-motion`.

## 3. Non-negotiables

- No change to logic, API, data, or product wording.
- Warnings, unknowns, "unverified" and result-state labels are quieter, never removed or hidden by default where the product rules require them (NFR-01, rule 1).
- No combined score or "winner".
- Keep AA contrast in both themes; keep keyboard flow, skip link, focus ring, axe passing.
- Keep route URLs unchanged.

## 4. Phase map

| Phase | Title | Size | PR |
|---|---|---|---|
| 0 | Baseline and safety net | S | A |
| 1 | Dark-first tokens and Sun/Earth hues | S | A |
| 2 | Type and numeric treatment | S | A |
| 3 | Shared primitives | M | A |
| 4 | Header and status pill | M | B |
| 5 | Run workspace shell (tabs, site switcher) | M | B |
| 6 | Home: story and hero SVG | M | C |
| 7 | Run page: verdict first, site cards | L | D |
| 8 | Timeline hierarchy | M | E |
| 9 | Sky stage | M | E |
| 10 | Analyze form: progressive disclosure | M | F |
| 11 | Time Machine: guided flow | L | F |
| 12 | Compare, Evidence, Explainer alignment | M | G |
| 13 | Motion, responsive and accessibility sweep | M | G |
| 14 | Verification and documentation | S | G |

PR A is the foundation (no structure changes). PR C and D deliver most of the "engaging" feel. E to G remove clutter on the remaining screens. Each PR is mergeable on its own.

---

## Phase 0: Baseline and safety net (S): DONE

Goal: know exactly what must not break.

- [x] Inventory every text string, role and link name pinned by `tests/web/*` and `tests/e2e/*` (Appendix A).
- [x] Capture "before" screenshots (dark and light at 1280, light at 375) for every route into `docs/ui/screenshots/before/` (27 images).
- [x] Run the full suite once to record the green baseline (Appendix B).
- [x] Test-update policy: structural changes may change selectors; wording changes may not.

Done when: baseline results and screenshots are saved, and the pinned-selector list exists.

## Phase 1: Dark-first tokens and Sun/Earth hues (S): DONE

Files: `app/globals.css` only (no component edits needed).

- [x] Dark is the default palette; light under `prefers-color-scheme: light`. No manual toggle for now (system preference; dark when there is none).
- [x] `--sun` / `--earth` tokens with soft variants for both themes, plus Tailwind aliases (`text-sun`, `bg-earth-soft`, ...). They match the hues the sky plot already uses (Sun amber, Earth blue), so nothing recoloured by surprise.
- [x] Neutrals, borders and surface steps re-tuned (near-black `#090b0e`, surfaces `#0f1216` / `#151a20`).
- [x] Contrast checked (below). Everything passes AA.
- [x] `color-scheme` set per theme so native controls, scrollbars and `progress` match.

Contrast ratios (WCAG, text on its surface; 4.5:1 required):

| Pair | Dark | Light |
|---|---|---|
| foreground on background | 16.2 | 16.8 |
| muted on background / surface / surface-2 | 7.6 / 7.3 / 6.8 | 6.1 / 6.5 / 5.7 |
| accent on background / surface | 9.0 / 8.5 | 6.3 / 6.7 |
| sun on background / surface | 11.0 / 10.5 | 5.8 / 6.2 |
| earth on background / surface | 8.1 / 7.7 | 7.5 / 7.9 |
| sun on sun-soft, earth on earth-soft | 8.7, 6.5 | 5.6, 6.8 |
| ok / fail / warn / info on their soft fills | 7.6 to 9.2 | 5.8 to 7.0 |

Verification: vitest 149, tsc, eslint, Playwright e2e 6 all pass. Because the e2e suite runs in the light scheme,
axe was also run by hand in **dark and light** on all 9 routes: 0 violations (WCAG 2 A/AA, 2.1 A/AA).

Done when: every existing page renders correctly in both themes with no component edits, and contrast ratios are recorded.

## Phase 2: Type and numeric treatment (S): DONE

Files: `app/globals.css` only. The classes are opt-in and unused so far, so no page changes yet; later phases adopt them.

- [x] Type scale classes (computed sizes at 1280px, in brackets at 320px where they differ):

| Class | Use | Size / weight |
|---|---|---|
| `type-display` | home hero headline, once | 44px / 600 (32px) |
| `type-title` | page title (h1) | 28px / 600 (24px) |
| `type-section` | section heading (h2) | 18px / 600 |
| `type-body` | running text | 16px, line-height 1.65 |
| `type-caption` | helper text, legends, footnotes | 13px, muted |

- [x] `readout`: Geist Mono, tabular numerals, ligatures off, no mid-value wrapping. For percentages, angles, times
  and coordinates. `readout-lg` (24px / 500) is a size modifier to combine with `readout` (`class="readout readout-lg"`);
  `readout-unit` styles a smaller muted unit next to the number.
- [x] `eyebrow` (small uppercase label) kept as the label style for group headings.

Verification: computed styles checked in the browser at 1280 and 320px; vitest 149, tsc and eslint clean.

Done when: scale and readout classes exist and are documented; no layout change yet.

## Phase 3: Shared primitives (M)

New files in `components/ui/` (presentation only): `Card`, `SectionHeader`, `Badge` (result-state), `Disclosure` (wrapper over `details`), `Stat` (label + readout), `SunEarthKey`.

- [x] Built each primitive in `components/ui/`, with variants limited to what the pages need:

| Primitive | Purpose | Notes |
|---|---|---|
| `Card` | `panel` (top-level) and `inset` (nested) boxes | forwards props |
| `Alert` | tone `fail` / `warn` / `info`, size `inline` / `block` | `role="alert"` by default; `role="status"` for non-urgent |
| `Button` | `primary` / `secondary` | defaults to `type="button"` |
| `Disclosure` | native `details`/`summary` for secondary detail | closed by default; `open` prop |
| `SectionHeader` | eyebrow + title (h1/h2/h3) + description + action | uses the phase 2 type classes |
| `Stat` | label + `readout` value + unit + hint | for `dl` lists |
| `ResultBadge` | compact result-state label (icon + word + tone, explanation in `title`) | not yet used on pages; phase 4/7 |
| `SunEarthKey` | legend: dot = Sun, diamond = Earth | shape plus word, never colour alone |
| `WarningItem` | warning code + plain text row | |
| `tone.ts` | single source of status tone classes | |

- [x] Adopted in Time Machine, Alternatives and Compare: 6 `role="alert"` boxes become `Alert`, 2 submit buttons
  become `Button variant="primary"` (new `.btn-sm` size), 3 nested boxes become `Card variant="inset"`, 2 warning
  lists use `WarningItem`. No wording or roles changed.
- [x] 13 unit tests for the primitives (`tests/web/ui-primitives.test.tsx`). `Disclosure` is asserted as a native
  `summary` that toggles on activation; Enter/Space on `summary` is browser behaviour (jsdom lacks it), so keyboard
  operation is covered by the e2e keyboard flow.
- Left as is (plain text errors, no box styling): field-level error lines in Time Machine, Alternatives and Compare.
  `RunView`, `AnalyzeForm`, `ReferenceMissionButton` and `DataStatusBanner` keep their one-off alert classes until
  their own phases (4, 7, 10).

Verification: vitest 162 (149 + 13 new), tsc, eslint, Playwright e2e 6, `next build` pass. Axe in dark and light on
Time Machine and Compare: 0 violations. Time Machine screenshot reviewed, unchanged apart from the button size.

Done when: primitives exist, tests pass, and the one-off alert/button class strings are gone from the three components named above.

## Phase 4: Header and status pill (M)

Files: `app/layout.tsx`, `components/DataStatusBanner.tsx`, `components/NavLink.tsx`.

- [x] The full-width banner is now a compact pill in the header. It always shows icon + words for the state
  (`◆ Synthetic demonstration data` or `◇ Real data, unverified`) plus a `REPLAY MODE` chip when the service is a
  replay. A native `details` panel under it carries the full sentences ("Data status: ...", the offline-copy
  sentence). Escape closes it and returns focus to the pill; a click elsewhere closes it too.
- [x] "Service unreachable" is deliberately **not** collapsed: it stays a full-width red banner above the header and
  the pill is hidden, so the one state that blocks everything cannot be missed.
- [x] One health poll now feeds both parts (`DataStatusProvider` context), so the page does not ask twice.
- [x] `role="status"` kept on the pill and the banner; the loading state is a neutral "Checking the science service…".
- [x] Footer unchanged (already tightened in the polish pass). The header's "Screening and education tool" text was
  removed: the panel and every result label carry it.
- [x] 375px: the pill wraps under the brand and the panel spans the header width (first version clipped on the left;
  fixed). No sideways scroll at 1280 or 375.

Test changes (structural, wording unchanged):
- `tests/e2e-fallback/offline.spec.ts` opens the pill (clicks "Replay mode") before asserting the offline-copy
  sentence, because that sentence now lives in the panel. "Replay mode" itself is still visible without a click.
- The core flow still sees "Synthetic demonstration data" persistently in the pill (no click needed).
- New `tests/web/data-status.test.tsx` (6 tests): synthetic, real, replay, Escape and focus return, unreachable
  banner with no pill, neutral loading state.

Verification: vitest 168, tsc, eslint, Playwright e2e 6, fallback e2e 1 (live stack), `next build`, axe in dark and
light on all 9 routes and on the unreachable state: 0 violations. Screenshots reviewed: desktop and mobile, light and
dark, pill closed and open, and the unreachable banner.

Done when: status is visible on every page without a banner, full text is one interaction away and exposed to assistive tech, and unreachable and synthetic states are clearly distinct.

## Phase 5: Run workspace shell (M)

Files: new `app/runs/[runId]/layout.tsx`, new `components/RunNav.tsx`, `RunView.tsx`.

- [x] New `app/runs/[runId]/layout.tsx` (server, reads no request data) wrapping every run view, with a client
  `components/RunNav.tsx` behind `Suspense`. Per the Next docs, a client component calls `useParams()` /
  `usePathname()` instead of awaiting `params`, so the page shell stays static (build output still shows the run
  routes as partially prerendered).
- [x] Tab bar `nav[aria-label="Analysis views"]`: Matrix, Timeline, Sky, Compare, Time Machine, Evidence, as plain
  links to the existing routes with `aria-current="page"`. The right side shows the short run id (readout) and the
  run's own result state as a `ResultBadge` (first page use of that primitive).
- [x] Timeline and Sky link to the first site, or to the current site when already on a site view.
- [x] Site switcher `nav[aria-label="Switch site"]` on Timeline and Sky: links to the same tab for another site, the
  current site marked `aria-current="true"`. No new data; sites come from the run's matrix.
- [x] Compare tab only when the run has 2+ sites (same rule as the matrix link). Timeline, Sky and Compare appear
  once the run is complete (the nav polls with the existing `useRun` hook until the run is terminal).
- [x] The nav renders nothing for an invalid id or a run the service says does not exist; the page itself explains.
- [x] Removed the redundant "← Back to the status matrix" link from the five main views (Timeline, Sky, Compare,
  Time Machine, Evidence). Kept it inside the error and loading states, where it is the only way out.
- [x] Tab labels were chosen not to collide with pinned link names ("Local sky", "Timeline and evidence",
  "Compare these sites", "Open the Time Machine", "Open the evidence").
- [x] Phone: the tab strip scrolls sideways inside its own box (links are focusable); the page itself does not.
- Not done: a separate run status chip. The run page already shows queued, running and failed states, and the badge
  covers the result state.

Verification: vitest 175 (7 new in `tests/web/run-nav.test.tsx`), tsc (after `next typegen`), eslint, Playwright
e2e 6, fallback e2e 1 (live stack), `next build`, axe in dark and light on all 9 routes: 0 violations. Checked at
1280 and 375px: correct active tab and site on every route, no sideways page scroll.

Done when: every run page shows the same tab bar with the correct active tab, and all existing links still resolve.

## Phase 6: Home, story and hero SVG (M)

Files: `app/page.tsx`, new `components/HeroSkyline.tsx`, `components/ReferenceMissionButton.tsx`.

- [ ] Design the SVG: skyline silhouette, low Sun above a dashed flat horizon, ridge blocking the line of sight, Earth marker. Uses `--sun` and `--earth` tokens, has `role="img"`, a title and a description, and is marked not-to-scale (same honesty rule as the explainer schematic).
- [ ] Optional drift animation of the Sun marker; static under reduced motion.
- [ ] Layout: hero (headline, short lede, primary CTA) beside the SVG; secondary actions below.
- [ ] Result preview strip using the saved reference run only if it can be read without new backend work; otherwise omit and note it as a follow-up. It must carry its result-state label.
- [ ] Condense "three rules" and "what it is not" into a quieter strip below the hero.

Done when: home tells the Sun-above-ridge story at a glance, the CTA is unambiguous, and nothing is shown as a result that is not labelled.

## Phase 7: Run page, verdict first (L)

Files: `components/RunView.tsx`, `components/StatusMatrix.tsx`, new `components/SiteCard.tsx`, new `components/RunVerdict.tsx`.

- [ ] Derive the headline from matrix data (counts of sites meeting both, one requirement, neither; excluded counted separately). Pure presentation of existing fields, no new logic beyond counting; add unit tests for the counting helper.
- [ ] Site card per site: label, overall chip, Sun and Earth outcome chips (terrain-aware decides), lower to upper availability as readouts, mini availability bar, links to Timeline and Sky.
- [ ] Excluded sites shown as a distinct card state ("not enough data to decide"), never styled as failures.
- [ ] Move the 6-column table into a `Disclosure` ("Full comparison table"), flat-horizon comparison kept and labelled.
- [ ] Collapse warnings into one disclosure; the count and the codes stay visible on expand.
- [ ] Keep `ResultStateFrame` around computed values.

Done when: the answer is readable in under five seconds, the full table is one click away, and the excluded/unknown semantics are unchanged.

## Phase 8: Timeline hierarchy (M)

Files: `components/TimelineView.tsx`, `TimelineChart.tsx`, `SensitivityPanel.tsx`.

- [ ] One-line verdict per target at the top (Sun / Earth chip plus the key sentence).
- [ ] Move the "in plain words" bullets and key-value table below the chart, collapsible in Technical mode only if wording is unchanged.
- [ ] Chart gets Sun amber and Earth blue row accents and a compact legend.
- [ ] Sensitivity and events become disclosures; downloads stay visible.

Done when: chart is above the fold on a 1280x800 screen and every existing fact is still reachable.

## Phase 9: Sky stage (M)

Files: `components/SkyView.tsx`, `SkyPlots.tsx`.

- [ ] Larger, centred plot; cursor readout as a compact side panel (Sun and Earth cards in their hues).
- [ ] Playback controls in a slim bar under the plot; keep keyboard operation of the slider and buttons.
- [ ] Plot colours from tokens; keep marker shape plus colour (not colour-only).
- [ ] Optional one-time skyline reveal animation (reduced-motion safe).

Done when: the plot is the visual anchor of the page, and keyboard and table fallbacks still work.

## Phase 10: Analyze form, progressive disclosure (M)

Files: `components/AnalyzeForm.tsx`, `app/analyze/page.tsx`.

- [ ] Default view: mission window and sites. Requirements, terrain and sensitivity under "Advanced settings" (`Disclosure`, closed by default).
- [ ] If any advanced field has a validation error, the section opens automatically and focus goes to the error summary.
- [ ] Live summary beside Run ("3 sites, 7 days, N samples, limit M") kept as is.
- [ ] No change to validation, draft saving, share-link or submit behaviour.

Done when: the form's first screen has two groups and a Run button, and all error paths still surface.

## Phase 11: Time Machine, guided flow (L)

Files: `components/TimeMachineView.tsx` (582 lines; split while touching).

- [ ] Split into subcomponents: `ShiftForm`, `DateSearch`, `ShiftedRuns`, `DeltaTable`, `RunComparison`. No behaviour change.
- [ ] Step layout: 1 Shift, 2 Which dates pass, 3 Compare; the date strip is the centrepiece.
- [ ] Deltas table and per-run charts in disclosures below.
- [ ] Preserve result binding and out-of-order protections (existing tests cover them).

Done when: the file is split below ~200 lines per component, existing Time Machine tests pass, and the first screen shows one question at a time.

## Phase 12: Compare, Evidence, Explainer alignment (M)

Files: `components/CompareView.tsx`, `EvidencePanel.tsx`, `app/why-the-south-pole-is-hard/page.tsx`.

- [ ] Apply primitives and the Sun/Earth hues; reduce card nesting.
- [ ] Explainer: reuse the new hero skyline styling for the schematic so the story is consistent.
- [ ] Evidence: group validation cards and provenance under disclosures; export actions stay prominent.

Done when: no page still uses the old visual language.

## Phase 13: Motion, responsive and accessibility sweep (M)

- [ ] Motion audit: every animation disabled under `prefers-reduced-motion`.
- [ ] Responsive pass at 320, 375, 768, 1024, 1440 for every route.
- [ ] Keyboard pass through the full flow (home to run to each tab).
- [ ] Contrast re-check on final components in both themes.
- [ ] Screen-reader spot check of tabs, disclosures, the status pill and the hero SVG.

Done when: the sweep checklist is ticked and defects are fixed or logged.

## Phase 14: Verification and documentation (S)

- [ ] Full suite: `vitest`, `tsc`, `eslint`, Playwright e2e (axe), fallback e2e, `next build`.
- [ ] "After" screenshots in `docs/ui/screenshots/after/`, before/after pairs in the doc.
- [ ] Update `docs/ui/UI-POLISH.md` or add `UI-REDESIGN.md` with final tokens, primitives and decisions.
- [ ] Update `docs/USER-GUIDE.md` where screenshots or navigation descriptions changed.

Done when: all suites are green and the docs reflect the shipped design.

---

## 5. PR grouping and order

| PR | Phases | Contents | Risk |
|---|---|---|---|
| A | 0 to 3 | Tokens, type, primitives | Low |
| B | 4 to 5 | Status pill, run workspace tabs | Medium (tests, routing layout) |
| C | 6 | Home and hero SVG | Low |
| D | 7 | Run page verdict and site cards | High (most test churn) |
| E | 8 to 9 | Timeline and Sky | Medium |
| F | 10 to 11 | Analyze and Time Machine | High (largest component) |
| G | 12 to 14 | Alignment, sweep, docs | Low |

Recommended first release: A, B, C, D.

## 6. Risks and mitigations

| Risk | Mitigation |
|---|---|
| Tests pin text and roles | Phase 0 inventory; keep wording, change structure only; update tests in the same PR |
| Hiding information violates product rules | Collapse only secondary detail; labels, warnings and unknown states remain one click away and always present as counts |
| Dark-first contrast failures | Record ratios in phase 1; axe in e2e |
| Next.js 16 breaking changes (AGENTS.md) | Read the relevant guide in `node_modules/next/dist/docs/` before layouts, Suspense or route changes |
| Large `TimeMachineView` refactor | Split first, restyle second; rely on existing out-of-order tests |
| Scope creep | Each phase has a "done when"; extras go to a follow-up list |

## 7. Open questions

1. Result preview on home (phase 6): acceptable to omit if it needs backend work?
2. Add a manual theme toggle later, or system preference only?
3. Should "Technical" mode also collapse the plain-words sections, or stay as is?

## Appendix A: pinned-selector inventory

Tests are semantic. No test asserts on class names, colours or layout (no `className` or `toHaveClass` in
`tests/`). Only four raw selectors exist: `main`, `svg desc`, `title`, `input[type=checkbox]:checked`.
So restyling is free; structure and wording are what to protect.

**Wording pinned (do not rephrase):**
- Buttons: "Start the reference mission", "Guided", "Technical", "Shift and recompute", "Test 15 dates",
  "Next event", "Compare", "Check terrain coverage for point 1".
- Links: "Local sky", /Open the Time Machine/.
- Headings: "Validation cards", "Disc size: centre or edge?".
- Text: "In plain words", "Facts from the service", "Replay mode", /offline copy: it shows saved runs only/,
  /Synthetic demonstration data/, /Reference GR-001/, /Objective, stated:/, /Held constant/,
  /compared in elapsed time/, /compared in calendar time/, /3 of 3 dates tested/,
  "Starts 2027-01-10 00:00:00 UTC", /not to scale and not computed from data/,
  /stays below the ridges and crater walls/.
- Labels: "Shift the start by (days)", "From (days)", "To (days)", /Horizon radius/, "Latitude (°)",
  /Calendar time/, site labels such as "89.5°S, 240°E".

**Structure pinned (keep roles and names when moving things):**
- `table` (status matrix, deltas, disc reading), `slider` (sky time), `img` (plots and SVGs), `alert`.
- `group` named /Sites/, `region` named /Sun at the cursor/, `list` named "Tested dates", `article` named "Baseline run".
- Keyboard completeness of the core flow and axe on every page (e2e).
- No sideways scrolling at phone width (e2e `mobile-layout`).

**Notes for later phases:**
- Phase 4: the status pill must still expose "Replay mode" and the offline-copy sentence as text.
- Phase 7: a `table` must still exist on the run page; if it sits in a closed disclosure, tests must open it.
- Phase 5/7: the "Local sky" link must stay reachable from the matrix or site cards.

## Appendix B: green baseline (2026-11-14, `main` at c9b6f63)

| Check | Result |
|---|---|
| `vitest` | 15 files, 149 tests pass |
| `tsc --noEmit` | clean |
| `eslint` | clean |
| Playwright e2e (synthetic stack) | 6 passed (axe, keyboard flow, mobile no-sideways-scroll) |
| Playwright fallback e2e | 1 passed with `LUNASCOPE_FALLBACK_STACK=live` (the packaged data is live-stack; the default `synthetic` fails by design) |
| `next build` | passes |

Screenshots: `docs/ui/screenshots/before/`, named `<route>-<desktop|mobile>-<dark|light>.png`
(routes: home, analyze, why, run, timeline, sky, compare, time-machine, evidence).

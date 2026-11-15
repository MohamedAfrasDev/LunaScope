# LunaScope UI redesign: the design record

> **Superseded in part by [UI-GALAXY.md](UI-GALAXY.md).** The colours, the "no gradients, no glow, no heavy shadow" rule, the header-based
> navigation, the `Button`/`Card`/`Alert` primitives and the `btn-primary` classes described below were replaced by the galaxy phases
> (calm twilight tokens, shadcn components, a sidebar shell). The structure, the result-first screens and the honesty rules are unchanged.

Status: shipped (phases 0 to 14 of [UI-REDESIGN-PLAN.md](UI-REDESIGN-PLAN.md)). This page is the short, current
description of what the interface is and why. The plan holds the per-phase history and measurements;
[UI-POLISH.md](UI-POLISH.md) is the earlier token-and-consistency pass this work builds on.

**Scope.** Presentation, layout, navigation, accessibility and focus management only. The redesign touched 108 files,
all under `app/`, `components/`, `tests/` and `docs/`. It changed nothing in `lib/`, `science/`, `scripts/`, `deploy/`
or the API route, and it did not change what the service is asked or how its replies are bound to the run they were
requested for. Product wording is unchanged except one phrase that became false ("not shown in the matrix above" now
reads "not shown in the results").

## 1. Why

The product was correct and rich, and felt like a stack of forms. Six problems, and the answer to each:

| Problem | What was done |
|---|---|
| Generic admin look for a lunar, light-and-shadow product | Dark-first "mission console": near-black surfaces, one accent, and two protagonist hues (Sun amber, Earth blue) used identically everywhere |
| Numbers before answers (a 12-chip table, text-heavy cards, three stacked forms) | Every result screen now opens with the answer: a verdict sentence and site cards, a verdict row and the chart, a three-step flow |
| Everything had equal weight | Secondary detail folds into disclosures with counts; trust labels stay visible and quiet |
| Flat navigation (six views reached by scattered links) | One run workspace: a tab bar and a site switcher on every view of a run |
| No story | A custom hero sketch (Sun above a flat horizon, hidden by a ridge, Earth clear) on Home, reused on the explainer |
| Dry first run | Home leads with the question, the picture and one clear action |

## 2. Design language

**Colour** (tokens in `app/globals.css`; dark is the default, light follows `prefers-color-scheme: light`):

| Token | Dark | Light | Use |
|---|---|---|---|
| `--background` / `--surface` / `--surface-2` | `#090b0e` / `#0f1216` / `#151a20` | `#f7f8f9` / `#ffffff` / `#eff1f3` | page, cards, nested and header strips |
| `--foreground` / `--muted` | `#e6e9ed` / `#98a2ad` | `#14181d` / `#565f69` | text |
| `--border` / `--border-strong` | `#232a32` / `#5f6b78` | `#dadfe4` / `#7a8591` | decoration / the edge of a control (3:1 or better) |
| `--accent` | `#7fb0ff` | `#1d4ed8` | links, primary action, focus |
| `--sun` / `--earth` | `#f2b84b` / `#6aa8ff` | `#8a5500` / `#1d4f9c` | the two protagonists |
| `--ok` / `--fail` / `--warn` / `--info` | `#6fd69b` / `#ff8f94` / `#f0c36a` / `#8ab4ff` | `#0f6b3a` / `#a4262c` / `#7c5200` / `#1d4f8c` | status, always with an icon and a word |

Rules: blue means Earth (the flat 0 degree horizon is neutral grey for that reason); amber means the Sun; status is never
colour alone (icon plus word; patterns on charts; dot and diamond markers for Sun and Earth); no gradients, no glow, no
heavy shadow. Every text pair is at least 4.5:1 and every control edge at least 3:1, in both themes, guarded by
`tests/web/tokens.test.ts`.

**Type** (Geist and Geist Mono): `type-display` 44 px (home headline only), `type-title` 28 px (page title), `type-section` 18 px,
`type-body` 16 px, `type-caption` 13 px muted; `eyebrow` for small uppercase labels. Measured values use `readout`
(monospace, fixed-width digits, no mid-value wrapping).

**Shape and motion.** One corner radius (`--radius`, 0.5 rem), cards are `surface-card`, insets are quieter boxes. The only
animations are one-time fade-ins on the home sketch and the sky terrain, and short hover transitions; they exist only
when the user has not asked for reduced motion.

## 3. Building blocks

Shared primitives in `components/ui/` (presentation only): `Card` (panel or inset), `Alert` (fail, warn, info; announces
itself), `Button` (primary, secondary), `Disclosure` (native `details`; closed by default), `SectionHeader`, `Stat`,
`ResultBadge` (compact result state), `SunEarthKey` (dot and diamond with words), `WarningItem`, and `tone.ts`.
Utility classes: `surface-card`, `btn-primary`, `btn-sm`, `nav-link`, `eyebrow`, `readout`, `kv` (label/value list that stacks
on a phone), `tap` and `tap-block` (24 px minimum target for standalone links).

Components added for the redesign: `NavLink`, `RunNav` (tab bar and site switcher, behind `Suspense`), the status pill in
`DataStatusBanner`, `HeroSkyline` and `SkylineFigure` (the shared sketch), `RunVerdict`, `SiteCard`, and the
`components/time-machine/` folder (the old 577-line view, split into files under 125 lines each).

## 4. Page by page

| Page | First thing you see | Folded away (one click) |
|---|---|---|
| Header (all pages) | Brand, links, a data-status pill (icon and words, plus REPLAY MODE), the Guided/Technical switch. A service outage is a full-width red strip instead | The full status sentence (open the pill; Escape closes) |
| Home | The question, the sketch, one action, three rules as a strip | None |
| New analysis | Mission window and Sites; a sticky Run bar with the sample count | Advanced settings (requirements, terrain, sensitivity), with current values in its summary; it opens itself on an error |
| Run | Tab bar; "N of M sites meet both requirements"; a card per site; excluded sites | The full comparison table; warnings |
| Timeline | A verdict per requirement, then the chart (above the fold at 1280x800) | Predicted events, warnings, sensitivity differences |
| Sky | One stage card (view switch, plot, time player) and one readout panel | The positions table |
| Compare | Site pills; held-constant and changed; what differs; per-target tables and timelines | Interval tables |
| Time Machine | Step 1 shift, Step 2 which dates pass, Step 3 compare, with "N of M results change outcome" | Deltas table, held-constant list |
| Evidence | Validation cards, disc-size tables, limits, a primary Export button | Provenance (identity, method, per site) |
| Explainer | The same sketch as Home, without Earth | None |

Always visible, by design: the data-status pill, the result-state frame and label around every set of numbers, the limits
that apply to every number, excluded sites ("not counted as failures"), and a flagged sensitivity result.

## 5. Accessibility, and how it is enforced

- WCAG 2.2 AA target: contrast (text 4.5:1, control edges 3:1), target size (24 px for standalone targets), keyboard
  operation of every control, visible focus, a skip link, no colour-only state, reduced motion honoured, one `h1` per page with
  no skipped heading level.
- Enforced by tests rather than by review: axe on every route in the e2e suite; `tests/e2e/a11y-sweep.spec.ts` (layout from
  320 to 1440 px, target size, reduced motion, keyboard disclosures and the pill, tab order, accessibility-tree names and
  heading order); `tests/web/tokens.test.ts` (contrast from the real stylesheet).
- **Not verified:** a real screen reader (NVDA, JAWS, VoiceOver). Names, descriptions and structure were checked through
  the accessibility tree only. Do one manual pass before launch.

## 6. Decisions and departures from the plan

- Dark-first with the system preference for light; no manual theme toggle (open question kept open).
- Home has no result preview: showing real numbers needs data loading beyond presentation. The hero is a labelled
  illustration ("not to scale, and not taken from any data").
- Some detail was deliberately **not** folded although the plan suggested it, because the product's explanation lives
  there and tests rely on it: the "In plain words" text, the per-run panels in the Time Machine, the validation cards,
  the disc-size tables and the sensitivity verdicts.
- Text that must stay unambiguous for selectors differs on purpose between the Home sketch caption and the explainer
  caption (the Home page stays mounted, hidden, after navigation).

## 7. Verification (final)

| Check | Result |
|---|---|
| `vitest` | 23 files, 243 tests pass |
| `tsc --noEmit`, `eslint`, `npm run check:api` | clean |
| Playwright e2e (synthetic stack, production build) | 11 pass (core flow, extras, phone layout, a11y sweep) |
| Playwright fallback e2e (`LUNASCOPE_FALLBACK_STACK=live`) | 1 passes |
| `next build` | passes; run routes still partially prerendered |
| axe, dark and light, 9 routes | 0 violations |

Run the e2e suite against a production build (`next build`, then `next start`) when checking visual or reduced-motion
changes: a long-running `next dev` can stop recompiling the global stylesheet.

## 8. Before and after

Same routes, same data (the packaged GR-001 run), 1280 px, dark. All 27 pairs (dark and light at 1280 px, light at 375 px)
are in [screenshots/before/](screenshots/before/) and [screenshots/after/](screenshots/after/) with matching names.

| Before | After |
|---|---|
| ![Home before](screenshots/before/home-desktop-dark.png) | ![Home after](screenshots/after/home-desktop-dark.png) |
| ![Run before](screenshots/before/run-desktop-dark.png) | ![Run after](screenshots/after/run-desktop-dark.png) |
| ![Timeline before](screenshots/before/timeline-desktop-dark.png) | ![Timeline after](screenshots/after/timeline-desktop-dark.png) |
| ![Sky before](screenshots/before/sky-desktop-dark.png) | ![Sky after](screenshots/after/sky-desktop-dark.png) |
| ![Analyze before](screenshots/before/analyze-desktop-dark.png) | ![Analyze after](screenshots/after/analyze-desktop-dark.png) |
| ![Time Machine before](screenshots/before/time-machine-desktop-dark.png) | ![Time Machine after](screenshots/after/time-machine-desktop-dark.png) |
| ![Evidence before](screenshots/before/evidence-desktop-dark.png) | ![Evidence after](screenshots/after/evidence-desktop-dark.png) |
| ![Home on a phone, before](screenshots/before/home-mobile-light.png) | ![Home on a phone, after](screenshots/after/home-mobile-light.png) |

Note: the "before" set was captured after the earlier polish pass ([UI-POLISH.md](UI-POLISH.md)), so it already has the
quieter tokens and consistent buttons; the redesign's changes are structural.

## 9. Follow-ups

- A real-screen-reader pass (see section 5).
- Home result preview, if loading the saved reference result becomes part of the page.
- A manual light/dark toggle, if wanted.
- The timeline's "unresolved" pattern uses the warning amber, close to the Sun amber; pattern and legend separate them.

## 10. Extending it

New page or panel: start from the primitives, open with the answer, fold secondary detail into a `Disclosure` with a count,
keep trust labels (result-state frame, data-status pill, limits) visible, give every status an icon and a word, use `.kv`
for label/value lists and `.tap` for standalone links, and add the page to the axe route list and the a11y sweep.

# LunaScope interface: the current design record

Status: shipped (galaxy phases G0 to G10 of [GALAXY-PLAN.md](GALAXY-PLAN.md)). This is the short description of what the interface is
now and why. The plan holds the per-phase history, decisions and measurements. [UI-REDESIGN.md](UI-REDESIGN.md) (the dark "mission
console" of phases 0 to 14) and [UI-POLISH.md](UI-POLISH.md) are the earlier passes this work builds on; where they disagree with this
page (colours, gradients, shadows, the header), this page is current.

**Scope.** Presentation, layout, navigation, accessibility and feel. No change to the science service, the API route, the client's
request or response handling, or what the product claims. Product wording is unchanged except where noted in the plan (two glossary
phrases were reworded to respect the "no certification" guard on the explainer).

## 1. The look: calm twilight, a galaxy as a mood

A deep, desaturated twilight (indigo and navy, never pure black) with pastel accents, generous space and near-still motion; a warm
"lunar day" light theme that follows the system. Data panels are always opaque; glass is for the header, the command palette and the
tour only, with solid fallbacks under `prefers-reduced-transparency` and `prefers-contrast: more`.

| Layer | What it is |
|---|---|
| Tokens | shadcn semantic names (`background`, `card`, `muted`, `primary`, `ring`, ...) plus status (`ok`, `fail`, `warn`, `info`, each with a `-soft` fill) and the two protagonists `sun` and `earth`. Dark is `:root`; light is the `prefers-color-scheme: light` block; `.theme-night` always uses the dark values (the Home hero stage). `tests/web/tokens.test.ts` guards 4.5:1 text and 3:1 control edges in both themes |
| Backdrop | A fixed, inert gradient with faint nebula washes and a still starfield (pure CSS); an optional 4-minute star drift, off under reduced motion and when the user presses **Pause background motion** (remembered) |
| Elevation | A two-part soft shadow on cards; hairline borders |
| Hero | The Home introduction sits on a 2400 px night picture (`next/image`, AVIF/WebP, ~270 KB) behind a legibility scrim, labelled "Background: illustration only. Not NASA imagery, not data." |
| Motion | Interaction motion is 150 to 250 ms. A new page rises 6 px. Skeletons breathe slowly. Nothing flashes, pulses or follows the pointer. Everything stops under reduced motion |

The things that never change: status is an icon and a word, never colour alone; Sun is a dot and amber, Earth a diamond and blue; the
data-status pill and the result-state frame stay visible; "unknown" is never "not visible"; nothing decorative looks like data.

## 2. The product experience

| Piece | Behaviour |
|---|---|
| **App shell** | A shadcn sidebar (Mission, Recent runs, Learn): an icon rail from 1280 px, a sheet below. A top bar holds the sidebar button, breadcrumbs, a **Search** button, the data-status pill and the Guided/Technical switch |
| **Recent runs** | Kept in this browser only (id, label from the service's own site names, result badge; 8 at most; clearable). Nothing is sent anywhere |
| **Command palette** | Ctrl/Cmd+K, or `/` when not typing, or the Search button: pages, the open run's views (matrix, timeline and sky per site, compare, Time Machine, evidence), recent runs, key terms, the page tour, Guided/Technical, pause motion, copy link, clear recent runs |
| **States** | Skeleton loading states that say what is loading; a real 404; an error screen with no technical detail; a "Run not found" card; short toasts for harmless confirmations only (critical states stay inline alerts) |
| **Onboarding** | Six key terms (one glossary file, worded from the user guide) open from buttons and are listed on the explainer; a one-time, skippable five-step tour of a finished run, offered once and never reopened by itself, restartable from the palette |
| **Components** | shadcn (Radix, `radix-nova`): button, card, badge, alert, progress, input, label, native select, separator, skeleton, sheet, sidebar, breadcrumb, toggle, tooltip, command, dialog, popover, sonner, empty. Native `details`, checkbox, radio and select stay native on purpose |

## 3. Accessibility and performance, as guarded by tests

| Guard | Where |
|---|---|
| axe (WCAG 2.0/2.1 A and AA) on every route, dark and light, desktop and phone, including the three sky views, the open palette, term popover and tour, and the 404 | `tests/e2e/theme-sweep.spec.ts` |
| No sideways scroll from 320 to 1440 px; 24 px targets; reduced motion; keyboard flows; heading order | `tests/e2e/a11y-sweep.spec.ts`, `core-flow.spec.ts`, `mobile-layout.spec.ts` |
| Wide tables scroll by keyboard (they become a named, focusable region only when they overflow) | `components/ui/scroll-region.tsx` |
| JavaScript per page (about 230 to 250 KB, 440 KB with the 3D sky), images on Home, layout shift under 0.1 | `tests/e2e/perf-budget.spec.ts` |
| Contrast of tokens in both themes; hero scrim; the night scope equals the dark tokens; no hard-coded colour in the 3D scene | `tokens.test.ts`, `hero-stage.test.tsx`, `sky-palette.test.tsx` |

## 4. Open items for the owner

1. **The hero picture's source and licence are not recorded** (`app/images/hero-bg.jpg`, and the 2400 px copy the page uses). Confirm
   them, or remove the picture; `docs/submission/LICENCES-AND-CITATIONS.md` says so plainly.
2. Whether to keep the 22.7 MB original `hero-bg.jpg` in the repository (a smaller copy is what ships; Git LFS or deletion are the options).
3. The galaxy 3D hero layer was deliberately not built (Appendix I of the plan); it can be its own phase.

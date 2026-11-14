# LunaScope UI polish: design notes

Scope: visual and interaction polish only. No API, data, science or business logic was changed, and no user-facing
wording, roles or labels were altered, so the unit and end-to-end tests keep their selectors.

## 1. Product analysis

LunaScope is a screening and education tool for sunlight and Earth line-of-sight near the lunar south pole.

| Surface | Route | Job |
|---|---|---|
| Home | `/` | Explain the question, start the frozen reference mission (GR-001) |
| New analysis | `/analyze` | Configure window, requirements, terrain, sites |
| Run | `/runs/[id]` | Status matrix of sites against Sun and Earth requirements |
| Timeline | `/runs/[id]/timeline/[site]` | Plain-words verdict, interval chart, events, sensitivity |
| Local sky | `/runs/[id]/sky/[site]` | Sun/Earth against the terrain skyline |
| Compare / Time Machine / Evidence | `/runs/[id]/...` | Side-by-side, date-slip what-if, provenance |
| Explainer | `/why-the-south-pole-is-hard` | Learner-facing background |

The product's trust model is part of the UI contract: values are always labelled (synthetic / real-unverified),
unknown is never shown as "not visible", and status is never conveyed by colour alone (icon + word).

## 2. Design contract

- **Job of the UI:** let a reader trust a number quickly. Quiet chrome, strong hierarchy, data first.
- **Principles:** simple (one accent, neutral surfaces), elegant (consistent radius, spacing, type), professional
  (no gradients, no heavy shadows, no decorative colour).
- **Reject:** purple/gradient "AI look", oversized rounding, stacked shadows, colour-only status.
- **Unchanged on purpose:** the persistent data-status banner, result-state frames, status chips and all warnings.

## 3. What changed

### Tokens (`app/globals.css`)
- Cooler neutral palette; added `--border-strong`, `--accent-hover`, `--accent-contrast`, `--shadow-sm`, `--radius`.
- Warn text darkened (`#8a5a00` to `#7c5200`) for stronger contrast on its soft background.
- Dark theme re-tuned with the same structure.

### Base element styles (in `@layer base`, so any utility class still wins)
- Buttons: shared hover, disabled cursor, pressed state; form controls: min height 2.5rem, hover border,
  accent-coloured checkboxes and progress.
- Tables: tabular numerals and small uppercase column headers. Headings balance wrapping; paragraphs avoid orphans.
- Link hover states, text selection colour, monospace for `code`.

### Reusable classes
`.surface-card`, `.btn-primary`, `.nav-link`, `.eyebrow`. Replaced about a dozen repeated one-off class strings.

### Components
- **Header:** sticky, translucent, small logo mark, current-page highlight via `aria-current="page"`
  (new `components/NavLink.tsx`, wrapped in `Suspense` because `usePathname()` is request data under Cache Components).
- **Guided / Technical toggle:** now a segmented control.
- **Home:** eyebrow label, tighter type scale, reference-mission action in a card, rules panel with divider.
- **Analyze form:** card fieldsets, stronger input borders, selectable site cards that highlight when checked
  (`has-[:checked]`), custom-point rows on a tinted panel, action bar sticky on mobile.
- **Run / results:** cards via `.surface-card`, tinted header strip on the result-state frame.
- **Footer:** constrained line length.

## 4. Accessibility and UX checks
- Focus ring, skip link, reduced-motion handling retained.
- Status still always icon + word. No new colour-only states.
- Checked light and dark at 1280px and home at 375px (screenshots in `docs/ui/screenshots/`).

## 5. Verification
- `vitest`: 15 files, 149 tests pass. `tsc --noEmit` and `eslint` clean.
- Dev server: no errors from the new code (a first `usePathname()` Suspense error was found and fixed).
- Not re-run: Playwright e2e suites and `next build`.

## 6. Suggested next steps
- Move the remaining one-off button/alert classes (Time Machine, Alternatives, Compare) onto shared classes.
- Add a loading skeleton for the run page instead of "Loading…".
- Run the Playwright axe checks (`npm run test:e2e`) against the new styles.

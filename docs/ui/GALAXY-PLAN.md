# LunaScope "Galaxy" redesign: shadcn components and a complete product experience

Status: **plan**. No code yet. Follows the shipped redesign ([UI-REDESIGN.md](UI-REDESIGN.md)).

## 1. The ask, and the decisions already made

> "For UI components use shadcn UI MCP, and make the UI a complete product experience that feels like a galaxy."

| Question | Decision |
|---|---|
| How to use shadcn when the MCP is not loaded in this session | **Use the shadcn CLI now** (`npx shadcn@latest search / view / docs / add`). It reads the same registry the MCP serves. `.mcp.json` (committed in `ed4bc13`) already registers the MCP for future sessions, so nothing is lost; approve it in `/mcp` after a restart to use the MCP tools directly |
| How immersive | **Immersive, instruments stay solid**: animated starfield and nebula backdrop, glow accents, glass chrome, a 3D galaxy hero. Every table, chart and number sits on a solid dark "instrument panel" |
| Scope | All four: app shell and command palette, polished states, onboarding, 3D galaxy hero |

## 2. What stays true (non-negotiable) and what is relaxed

**Relaxed, because you asked for it:** the earlier "no gradients, no glow, no decorative colour, one calm accent" rules. Gradients, glow,
glass, motion and a richer palette are now allowed **as decoration**.

**Kept, because they are the product's trust model and its accessibility:**
- Product wording, the result-state frame, the data-status pill and the limits stay visible. Nothing decorative may look like data.
- Status is an icon and a word, never colour alone. Sun is a dot, Earth a diamond.
- Text 4.5:1 and control edges 3:1 on the **actual** panel colours (guarded by `tokens.test.ts`, which this work updates).
- All decorative motion exists only under `prefers-reduced-motion: no-preference`; the 3D scene falls back to a still image.
- Data panels are opaque. Glass is for chrome only (shell, palette, tooltips), with a solid fallback under `prefers-reduced-transparency`
  and `prefers-contrast: more`.
- No fabricated numbers. The hero and backdrop are labelled illustration, as the home sketch is today.
- Keyboard, 24 px targets, one `h1`, no sideways scroll from 320 px, axe clean: all existing e2e and sweep tests keep passing.

## 3. Where we start (the baseline on `main`)

- Next.js 16, React 19, Tailwind 4 (CSS tokens in `app/globals.css`), Geist fonts. 9 routes. About 26 components plus `components/ui/`.
- Since the last redesign PR, three PRs landed: curated notable sites with a reference run card on Home, a **three.js 3D sky view**
  (`components/Sky3D.tsx`, `lib/sky3d.ts`, dependency `three@0.187`), and an explainer rewrite. The 3D work is the pattern to reuse for the hero.
- `shadcn@4.23` is a dev dependency and `.mcp.json` exists, but there is **no `components.json`** and no shadcn component yet.
- Tests: 23 unit files, 11 e2e, 1 fallback e2e. Many unit tests find disclosures by native `details`/`summary`.

## 4. Architecture decisions

**D1. shadcn base and setup.** `shadcn init` with the **Radix** base, CSS variables, Tailwind 4, no RTL, `components.json` with aliases to
`components/ui` and `lib/utils` (`cn`). Adds `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, and
per-component Radix packages. Existing hand-written primitives in `components/ui/` are replaced one for one by shadcn's (same file names where
possible, so imports barely change), then deleted.

**D2. One token system: shadcn's semantic tokens, with a galaxy palette.** shadcn's `muted` and `accent` are **backgrounds**; in this codebase
`text-muted` is text colour (119 uses) and `bg-accent` is the primary button (2) with `text-accent` links (27). Left alone, shadcn components would
render wrongly. So the migration is explicit and mechanical (a codemod plus review):

| Today | Becomes |
|---|---|
| `text-muted` | `text-muted-foreground` |
| `text-accent`, `border-accent`, `bg-accent` (button) | `text-primary`, `border-primary`, `bg-primary` |
| `bg-surface` / `bg-surface-2` | `bg-card` / `bg-muted` |
| `border-border-strong` | `border-input` |
| `text-warn`, `bg-ok-soft`, ... | kept (status tokens extend the shadcn set), plus `--sun`, `--earth` as chart-style protagonists |

Palette direction (final values chosen and contrast-checked in G1): deep-space background (near `#05060f`), instrument panels a step lighter with a
faint indigo tint, **primary** a cosmic violet-blue, nebula accents in violet, magenta and teal, **Sun amber and Earth blue unchanged** so the
meaning of the two protagonists never moves. Light theme becomes "lunar day": a calm pale palette with no starfield, so users who prefer light
keep a clean, legible product.

**D3. Disclosures stay native `<details>`**, restyled in shadcn's visual language, not replaced by a Radix accordion. Reason: 13 test files and the
a11y sweep depend on `details`/`summary`, and native behaviour (Enter, Space, find-in-page) is already right.

**D4. Shell.** shadcn `Sidebar` (icon-collapsible on desktop, `Sheet` on phones), breadcrumbs, and the existing run tabs stay in the content area.
Sections: Mission (Home, New analysis), Recent runs, Learn (Why the south pole is hard, notable sites), and a footer with the data-status pill and
the Guided/Technical switch (as a shadcn `ToggleGroup`). The nav keeps `aria-label="Main"` and the link names the tests find.

**D5. Recent runs without a backend change.** Kept in `localStorage` (guarded, optional): run id, when it was opened, and the label the service
already gave it. Never invented, never shared, cleared from a menu item. If storage is blocked the shell simply shows none.

**D6. Command palette** (shadcn `Command`, cmdk). Opens with Ctrl/Cmd+K and `/`. Entries: pages, recent runs, and, inside a run, its tabs and
sites; actions: Guided/Technical, copy link to this page. It is a shortcut layer, never the only way to anything. Focus trap, Esc, named dialog.

**D7. Polished states.** shadcn `Skeleton`, `Spinner`, `Sonner` (toasts), `Empty`, `Alert`. Skeletons for run, timeline, sky, compare, Time Machine and
Evidence while loading (replacing "Loading…" text); toasts for non-critical confirmations (link copied, run started); **critical errors stay inline
alerts**, never toasts; `not-found.tsx` and `error.tsx` with the product's voice; a short view transition between pages.

**D8. Onboarding.** A first-visit tour on the run page (shadcn `Dialog`/`Popover` steps: the verdict, a site card, the tabs, the folded detail, the
status pill), skippable, remembered in `localStorage`, and re-openable from the palette. Plus shadcn `Tooltip` on the key terms ("terrain-aware",
"flat horizon", "availability range", "unresolved", "excluded") driven by one glossary file whose text is lifted from the existing user guide, so the
wording stays the product's.

**D9. Galaxy backdrop.** Three layers, all behind content: a static CSS deep-space gradient with nebula washes; a CSS/`canvas` starfield (a few
hundred points, slow parallax, paused when the tab is hidden); and, on Home only, the 3D hero. Everything decorative is `aria-hidden`,
`pointer-events: none`, and removed under reduced motion (the gradient stays, the stars freeze).

**D10. 3D galaxy hero.** `next/dynamic`, client-only, lazy; reuses the three.js setup from `Sky3D`. A spiral of instanced points with a slow rotation,
the Moon and a marked south-pole point as the focal landmark (labelled illustration). Caps device pixel ratio, pauses off-screen and when hidden,
disposes GPU resources on unmount, and shows a pre-rendered still (and the existing sketch's caption) when WebGL is unavailable, the user prefers
reduced motion, or the device is low-power (`prefers-reduced-data` or `hardwareConcurrency <= 2`).

## 5. Phases

Small, individually mergeable; each ends with unit tests, e2e, axe in both themes, and a before/after screenshot. Grouped into PRs.

| Phase | Title | PR |
|---|---|---|
| G0 | Baseline: run all suites, capture "pre-galaxy" screenshots, list pinned selectors affected by the token rename | A |
| G1 | shadcn foundation: `init`, `cn`, deps, `components.json`; token migration codemod; galaxy palette; update `tokens.test.ts` | A |
| G2 | Replace primitives with shadcn: Button, Card, Badge (status chips), Alert, Separator, Skeleton, Progress, Input, Label, Select, Checkbox, RadioGroup; restyle native Disclosure | B |
| G3 | Galaxy visual system: backdrop layers, glass chrome, instrument panels, glow tokens, display font, reduced-motion/transparency/contrast fallbacks | C |
| G4 | App shell: Sidebar, Sheet on mobile, breadcrumbs, recent runs, ToggleGroup for the view mode, status pill relocated | D |
| G5 | Command palette: Command dialog, entries, shortcuts, tests | D |
| G6 | Polished states: skeletons, Sonner toasts, Empty/error/not-found, view transition | E |
| G7 | Onboarding: tour, tooltips, glossary | F |
| G8 | 3D galaxy hero with fallbacks and performance guard | G |
| G9 | Re-skin each route on the new system (Home, Run, Timeline, Sky, Compare, Time Machine, Evidence, Analyze, Explainer, notable sites) | H |
| G10 | Verification and docs: sweep, perf budget, update `UI-REDESIGN.md` and the user guide, after screenshots | H |

Suggested first release: A, B, C (the look), then D to F (the product feel), then G (the hero), then H.

## 6. Risks and how each is handled

| Risk | Handling |
|---|---|
| Token rename breaks styling or a test | Codemod with a reviewed diff; the contrast test and a screenshot diff per route gate G1; only 3 test files assert on classes |
| Galaxy backdrop hurts legibility | Opaque data panels; contrast tested against the real panel colours; `prefers-contrast: more` forces solid |
| Performance (three.js, blur, canvas) | Hero lazy-loaded and Home-only; DPR cap; pause when hidden or off-screen; `backdrop-blur` on chrome only; measure against `docs/perf.md`; set a JS budget in G8 |
| Radix components change DOM and keyboard behaviour | Adopt per component with its tests; keep native `details`, native radios in the Time Machine alignment until proven equal in the e2e keyboard flow |
| Test churn from new markup | Keep roles, names and wording; update tests in the same PR as the change, as before |
| Motion and accessibility regress | Reduced-motion e2e and the a11y sweep run on every PR; new components get their own tests |
| Decoration mistaken for data | Labelled illustration, `aria-hidden`, never placed inside a result frame |
| shadcn MCP absent in this session | CLI used; MCP stays configured for later sessions |
| Scope is large | Phased PRs; each is shippable alone; stop after any phase |

## 7. Open questions (defaults in bold; say if you disagree)

1. Keep a **light "lunar day" theme** (calm, no starfield) alongside the galaxy dark theme, or go dark-only?
2. Display font for headings: **keep Geist** or add a space-flavoured display face (for example Space Grotesk) for titles only?
3. Sidebar on desktop: **icon-collapsible rail** or a fixed full-width sidebar?
4. Recent runs only in this browser (**yes**), or is a server-side run list wanted (that would be a backend change)?

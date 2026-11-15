# LunaScope "Calm Galaxy" redesign: shadcn components and a complete product experience

Status: **plan, revised to a calm, aesthetic direction. G0 (baseline) is done**; see Appendix A. No product code changed yet. Follows the shipped redesign ([UI-REDESIGN.md](UI-REDESIGN.md)).

## 1. The ask, and the decisions already made

> "For UI components use shadcn UI MCP, and make the UI a complete product experience that feels like a galaxy." Then: "the complete UI
> should look calm, aesthetic."

| Question | Decision |
|---|---|
| How to use shadcn when the MCP is not loaded in this session | **Use the shadcn CLI now** (`npx shadcn@latest search / view / docs / add`). It reads the same registry the MCP serves. `.mcp.json` (committed in `ed4bc13`) already registers the MCP for future sessions; approve it in `/mcp` after a restart to use the MCP tools directly |
| Look and feel | **Calm and aesthetic** (this revision replaces the earlier "immersive" choice). A serene twilight-galaxy: soft colour, generous space, gentle depth, near-still motion. Data panels stay solid. The galaxy is a mood, not a spectacle |
| Scope | All four: app shell and command palette, polished states, onboarding, a galaxy hero (now a gentle one) |

## 2. Calm design principles

These govern every phase and are the review checklist for each PR.

1. **Quiet before striking.** One focal point per screen. Nothing flashes, pulses, bounces or competes for attention.
2. **Soft, low-saturation colour.** A deep twilight palette (desaturated indigo and navy, not pure black), pastel accents (lavender, dusty teal, a trace of
   rose), and no neon. Saturation and brightness are capped; large areas are the darkest, lowest-contrast tones.
3. **Depth through light, not effects.** Faint gradients, soft diffuse shadows and thin hairline borders. A gentle glow is allowed on **one** thing at a
   time (the primary action or the focused item) and never as a halo around text.
4. **Generous space and rhythm.** More whitespace and larger line height than today; fewer boxes, fewer borders; rounded, consistent radii; a single
   spacing scale.
5. **Near-still motion.** Ambient motion is optional and extremely slow (a full cycle of a minute or more), never parallax, never tied to scrolling or
   the pointer. Interaction motion is short (150 to 250 ms), eased, and only confirms a change. A visible **Pause animation** control is always available.
6. **Legibility is the aesthetic.** Soft does not mean low contrast. Text stays at least 4.5:1 and control edges 3:1 on the real panel colours; the
   decorative layer is always quieter than the content.
7. **Calm language.** Friendly, plain microcopy in empty, loading and error states; no exclamation marks; errors say what happened and what to do.

## 3. What stays true (non-negotiable) and what is relaxed

**Relaxed, because you asked for a galaxy feel:** the earlier "no gradients, no decorative colour" rule. Soft gradients, a pastel palette, diffuse
shadows, a faint starfield, glass chrome and slow ambient motion are now allowed **as decoration**.

**Kept, because they are the product's trust model and its accessibility:**
- Product wording, the result-state frame, the data-status pill and the limits stay visible. Nothing decorative may look like data.
- Status is an icon and a word, never colour alone. Sun is a dot, Earth a diamond; those two hues keep their meaning in the softened palette.
- Text 4.5:1 and control edges 3:1 on the **actual** panel colours (guarded by `tokens.test.ts`, which this work updates).
- All ambient motion exists only under `prefers-reduced-motion: no-preference`, and can be paused; the hero falls back to a still image.
- Data panels are opaque. Glass is for chrome only (shell, palette, tooltips), with a solid fallback under `prefers-reduced-transparency` and
  `prefers-contrast: more`.
- No fabricated numbers. The hero and backdrop are labelled illustration, as the home sketch is today.
- Keyboard, 24 px targets, one `h1`, no sideways scroll from 320 px, axe clean: all existing e2e and sweep tests keep passing.

## 4. Where we start (the baseline on `main`)

- Next.js 16, React 19, Tailwind 4 (CSS tokens in `app/globals.css`), Geist fonts. 9 routes. About 26 components plus `components/ui/`.
- Since the last redesign PR, three PRs landed: curated notable sites with a reference run card on Home, a **three.js 3D sky view**
  (`components/Sky3D.tsx`, `lib/sky3d.ts`, dependency `three@0.187`), and an explainer rewrite. The 3D work is the pattern to reuse for the hero.
- `shadcn@4.23` is a dev dependency and `.mcp.json` exists, but there is **no `components.json`** and no shadcn component yet.
- Tests: 23 unit files, 11 e2e, 1 fallback e2e. Many unit tests find disclosures by native `details`/`summary`.

## 5. Architecture decisions

**D1. shadcn base and setup.** `shadcn init` with the **Radix** base, CSS variables, Tailwind 4, no RTL, `components.json` with aliases to
`components/ui` and `lib/utils` (`cn`). Adds `clsx`, `tailwind-merge`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, and
per-component Radix packages. Existing hand-written primitives in `components/ui/` are replaced one for one by shadcn's (same file names where
possible, so imports barely change), then deleted. Lucide icons are used at a thin stroke weight to match the soft look.

**D2. One token system: shadcn's semantic tokens, with a calm twilight palette.** shadcn's `muted` and `accent` are **backgrounds**; in this codebase
`text-muted` is text colour (119 uses) and `bg-accent` is the primary button (2) with `text-accent` links (27). Left alone, shadcn components would
render wrongly. So the migration is explicit and mechanical (a codemod plus review):

| Today | Becomes |
|---|---|
| `text-muted` | `text-muted-foreground` |
| `text-accent`, `border-accent`, `bg-accent` (button) | `text-primary`, `border-primary`, `bg-primary` |
| `bg-surface` / `bg-surface-2` | `bg-card` / `bg-muted` |
| `border-border-strong` | `border-input` |
| `text-warn`, `bg-ok-soft`, ... | kept (status tokens extend the shadcn set), plus `--sun`, `--earth` |

Palette direction (final values chosen and contrast-checked in G1, then locked by test):

| Role | Direction |
|---|---|
| Background | A deep, slightly blue twilight (around `#0b1020`), not black; a very faint vertical gradient toward a hint of violet at the horizon |
| Panels / cards | One step lighter and opaque, with a hairline border at low contrast and a soft, wide, low-opacity shadow |
| Primary | A soft lavender-periwinkle; used sparingly (primary action, links, focus) |
| Secondary accents | Dusty teal for emphasis. The one warm accent is the **Sun's gold**, which also echoes the sunrise in the supplied hero image (Appendix A.3); a trace of muted rose at most |
| Sun / Earth | Same meaning as today, slightly softened (a warm gold and a gentle sky blue), still passing contrast on panels |
| Status | Pastel-leaning ok, fail, warn, info, always with icon and word, still passing 4.5:1 on their soft fills |
| Light theme | "Lunar day": a warm, paper-like pale palette with the same lavender primary and no starfield, for users who prefer light |

**D3. Disclosures stay native `<details>`**, restyled in shadcn's visual language (soft borders, a thin chevron), not replaced by a Radix
accordion. Reason: 13 test files and the a11y sweep depend on `details`/`summary`, and native behaviour (Enter, Space, find-in-page) is already right.

**D4. Shell.** shadcn `Sidebar` (icon-collapsible on desktop, `Sheet` on phones), breadcrumbs, and the existing run tabs stay in the content area.
Sections: Mission (Home, New analysis), Recent runs, Learn (Why the south pole is hard, notable sites), and a footer with the data-status pill and
the Guided/Technical switch (as a shadcn `ToggleGroup`). The shell is airy: wide gutters, quiet separators, no heavy active states. The nav keeps
`aria-label="Main"` and the link names the tests find.

**D5. Recent runs without a backend change.** Kept in `localStorage` (guarded, optional): run id, when it was opened, and the label the service
already gave it. Never invented, never shared, cleared from a menu item. If storage is blocked the shell simply shows none.

**D6. Command palette** (shadcn `Command`, cmdk). Opens with Ctrl/Cmd+K and `/`. Entries: pages, recent runs, and, inside a run, its tabs and
sites; actions: Guided/Technical, pause animation, copy link to this page. It is a shortcut layer, never the only way to anything. Focus trap, Esc,
named dialog. Frosted glass with a solid fallback.

**D7. Polished states.** shadcn `Skeleton` (a slow, soft shimmer, off under reduced motion), `Spinner`, `Sonner` (toasts), `Empty`, `Alert`. Skeletons
for run, timeline, sky, compare, Time Machine and Evidence while loading (replacing "Loading…" text); toasts for non-critical confirmations (link
copied, run started), short and unobtrusive; **critical errors stay inline alerts**, never toasts; `not-found.tsx` and `error.tsx` in the product's calm voice;
a short fade between pages.

**D8. Onboarding.** A first-visit tour on the run page (shadcn `Dialog`/`Popover` steps: the verdict, a site card, the tabs, the folded detail, the
status pill), skippable, remembered in `localStorage`, re-openable from the palette; never auto-reopens. Plus shadcn `Tooltip` on the key terms
("terrain-aware", "flat horizon", "availability range", "unresolved", "excluded") driven by one glossary file whose text is lifted from the existing
user guide, so the wording stays the product's.

**D9. Backdrop.** Three quiet layers behind content: a static twilight gradient with two or three very soft, low-opacity nebula washes; a **static**
faint starfield (a few hundred points at low contrast, generated once); and an optional **ambient drift** of the stars so slow that a cycle takes
minutes, with no parallax. Everything decorative is `aria-hidden`, `pointer-events: none`, paused when the tab is hidden, and removed under reduced
motion (the gradient and the still stars stay). A **Pause animation** toggle (also in the palette) is remembered.

**D10. Galaxy hero (gentle).** `next/dynamic`, client-only, lazy; reuses the three.js setup from `Sky3D`. A soft spiral of instanced points in pastel
tones, no bloom or flicker, rotating one revolution in minutes at most, with the Moon and a marked south-pole point as a quiet landmark (labelled
illustration). It starts as a still and fades in. Caps device pixel ratio, pauses off-screen and when hidden, disposes GPU resources on unmount, and shows a
pre-rendered still when WebGL is unavailable, the user prefers reduced motion or has paused animation, or the device is low-power
(`prefers-reduced-data` or `hardwareConcurrency <= 2`).

**D10a. The supplied hero image** (`app/images/hero-bg.jpg`, added in `8f83020`; see Appendix A.3). It is the Home hero's backdrop, treated to
stay calm: a dark, blue-tinted scrim over the bright left side so text always reads, a soft vignette, no motion on the photograph itself,
and the optional 3D layer sitting quietly in front or not at all. It must never be served at full size: an optimised responsive set
(AVIF and WebP with a JPEG fallback, with a blur placeholder) through `next/image`, and the 22.7 MB original stays out of the page. Because it is a
photoreal picture on a science tool, it carries the same label as the home sketch ("Illustration only") and is never placed inside a result frame.

## 6. Phases

Small, individually mergeable; each ends with unit tests, e2e, axe in both themes, a before/after screenshot, and a pass against the section 2 checklist.

| Phase | Title | PR |
|---|---|---|
| G0 | **Done.** Baseline: all suites, "pre-galaxy" screenshots, inventory of what the token rename touches, hero asset audit | A |
| G1 | shadcn foundation: `init`, `cn`, deps, `components.json`; token migration codemod; **calm twilight palette**; update `tokens.test.ts` | A |
| G2 | Replace primitives with shadcn: Button, Card, Badge (status chips), Alert, Separator, Skeleton, Progress, Input, Label, Select, Checkbox, RadioGroup; restyle native Disclosure | B |
| G3 | Calm visual system: twilight backdrop (gradient, nebula washes, still stars), soft elevation, hairline borders, spacing and type rhythm, optional slow drift with Pause, reduced-motion/transparency/contrast fallbacks | C |
| G4 | App shell: Sidebar, Sheet on mobile, breadcrumbs, recent runs, ToggleGroup for the view mode, status pill relocated | D |
| G5 | Command palette: Command dialog, entries, shortcuts, tests | D |
| G6 | Polished states: skeletons, Sonner toasts, Empty/error/not-found, a short page fade | E |
| G7 | Onboarding: tour, tooltips, glossary | F |
| G8 | Calm hero: the supplied image (optimised, with a scrim), plus an optional gentle 3D layer, fallbacks and a performance guard | G |
| G9 | Re-skin each route on the new system (Home, Run, Timeline, Sky, Compare, Time Machine, Evidence, Analyze, Explainer, notable sites) | H |
| G10 | Verification and docs: sweep, perf budget, update `UI-REDESIGN.md` and the user guide, after screenshots | H |

Suggested first release: A, B, C (the look), then D to F (the product feel), then G (the hero), then H.

## 7. Risks and how each is handled

| Risk | Handling |
|---|---|
| Token rename breaks styling or a test | Codemod with a reviewed diff; the contrast test and a screenshot diff per route gate G1; only 3 test files assert on classes |
| Soft palette hurts legibility | Opaque data panels; contrast tested against the real panel colours; `prefers-contrast: more` forces solid; "soft" never lowers text below 4.5:1 |
| Too calm to feel like a galaxy | Judged on real screenshots at G3 and G8; the mood comes from the twilight gradient, the faint stars and the hero, and can be turned up one notch without breaking the principles |
| Performance (three.js, blur, canvas) | Hero lazy-loaded and Home-only; DPR cap; pause when hidden or off-screen; blur on chrome only; measure against `docs/perf.md`; set a JS budget in G8 |
| Radix components change DOM and keyboard behaviour | Adopt per component with its tests; keep native `details`, native radios in the Time Machine alignment until proven equal in the e2e keyboard flow |
| Test churn from new markup | Keep roles, names and wording; update tests in the same PR as the change, as before |
| Motion and accessibility regress | Reduced-motion e2e and the a11y sweep run on every PR; a test asserts ambient motion stops under reduced motion and under Pause |
| Decoration mistaken for data | Labelled illustration, `aria-hidden`, never placed inside a result frame |
| shadcn MCP absent in this session | CLI used; MCP stays configured for later sessions |
| Scope is large | Phased PRs; each is shippable alone; stop after any phase |

## 8. Open questions (defaults in bold; say if you disagree)

1. Keep a **light "lunar day" theme** (calm, paper-like, no starfield) alongside the twilight dark theme, or go dark-only?
2. Display font for headings: **keep Geist** or add a soft, rounded display face for titles only?
3. Sidebar on desktop: **icon-collapsible rail** or a fixed full-width sidebar?
4. Recent runs only in this browser (**yes**), or is a server-side run list wanted (that would be a backend change)?
5. Ambient motion: **a very slow star drift with a Pause control**, or completely still (stars and hero static)?

## Appendix A. G0 baseline (2026-11-15, `main` at `3d04960`)

### A.1 Suites, all green on a production build

| Check | Result |
|---|---|
| `vitest` | 26 files, 260 tests pass |
| `tsc --noEmit`, `eslint`, `npm run check:api` | clean |
| `next build` | passes; the run routes are still partially prerendered |
| Playwright e2e (synthetic stack, production build on its own port) | 14 pass: core flow, extras, phone layout, a11y sweep (5), **3D sky view (3)** |
| Playwright fallback e2e (live stack) | 1 passes |
| axe, dark and light, 9 routes | 0 violations |

Note: run the e2e suite against a production build, on a port nothing else is using. A long-running dev server or an old `next start` can serve stale
stylesheets after a rebuild (this produced an unstyled screenshot set once already).

### A.2 Pre-galaxy screenshots

`docs/ui/screenshots/pre-galaxy/`: 30 images, 10 views x (dark and light at 1280 px, light at 375 px). The views are the 9 routes plus the **3D sky view**.
They include the new Home "Compare notable south-polar places" cards. The after-galaxy set will be captured with the same script and names.

### A.3 The supplied hero image

| Fact | Value |
|---|---|
| File | `app/images/hero-bg.jpg`, 5459 x 3059, JPEG, **22.7 MB**; committed in `8f83020`; not yet referenced by any code |
| Content | A photoreal view of the Earth's limb from orbit at sunrise: a warm gold-orange glow at the upper left, deep blue Earth below, dark space at the upper right |
| Palette it suggests | Deep blue plus warm gold, which are the product's own Earth blue and Sun gold. This is why the plan's one warm accent is the Sun's gold |
| Brightness | Mean luminance about 140 on the left and 77 on the right (0 to 255), with highlights near white: text placed on it needs a scrim |
| Problems to solve | (1) **Size**: 22.7 MB cannot ship; it needs an optimised responsive set via `next/image`. The original is already in git history; keeping it out of future builds is a decision for the team (a smaller committed copy, or Git LFS). (2) **Provenance**: it looks like a rendered or AI-style illustration, not a NASA photograph. Its **source and licence are not recorded**, and `docs/submission/LICENCES-AND-CITATIONS.md` currently says "No images are used", which becomes false when it ships. Please confirm where it came from and under what licence, and whether `DISCLOSURES.md` needs an entry. (3) **Honesty**: label it "Illustration only", and never imply it is NASA imagery or data |

### A.4 What the token rename touches (G1 input)

CSS variables referenced directly in components, by name: `--muted` 17, `--foreground` 16, `--surface` 9, `--border` 9, `--earth` 6, `--sun` 5, `--surface-2` 4,
`--fail` 4, `--warn` 2, `--ok` 2, `--warn-soft` 1, `--fail-soft` 1, `--border-strong` 1 (SVG fills and strokes, mostly).

Tailwind colour classes in `components/` and `app/`: `muted` 118, `border` 80, `fail` 43, `surface` 33, `accent` 31, `surface-2` 17, `fail-soft` 11,
`warn` 11, `border-strong` 11, `info` 8, `ok` 7, `foreground` 5, `sun` 5, `earth` 5, `background` 4, `info-soft` 3, `ok-soft` 2, `warn-soft` 2.
Heaviest files: `EvidencePanel` 24, `AnalyzeForm` 20, `SkyView` 17, `TimelineView` 12, `StatusMatrix` 10.

Custom classes in `globals.css` to rework: `btn-primary`, `surface-card`, `nav-link`, `eyebrow`, `kv`, `tap`, `tap-block`, `readout*`, `type-*`, and the hero and reveal
animation classes. (`.grid`'s base rule stays.)

**Tests that assert on a class or token (5 assertions, 4 files):** `compare.test.tsx` (`has-[:checked]:border-accent`), `phase2.test.tsx` (`btn-primary`),
`run-verdict.test.tsx` (`.bg-surface-2.rounded-full`), `ui-primitives.test.tsx` (`text-warn`, `readout`). Every other test finds things by role, name and
text, so it is unaffected by a rename. The e2e suite asserts on no class.

**Not covered by the CSS tokens:** the **3D sky view** (`components/Sky3D.tsx`) draws with hard-coded hex colours (background `0x0a0f1c`, ground, wall, ridge,
label colours; Sun `0xf5a524`, Earth `0x5aa9ff`), so it does not follow the theme at all today. G1 or G9 should route those through the palette, and the
light theme needs its own set. The Sun and Earth hues also differ slightly between the 3D view and the tokens (`#f5a524` vs `#f2b84b`, `#5aa9ff` vs `#6aa8ff`).

### A.5 Decisions G0 surfaces for you

1. Hero image: confirm its **source and licence**, and whether to keep the 22.7 MB original in the repo (a smaller committed copy or Git LFS are the options).
2. Update `LICENCES-AND-CITATIONS.md` ("No images are used") and, if the image was AI-generated, `DISCLOSURES.md`, when the hero ships.
3. Unify the Sun and Earth hues across the tokens, the SVGs and the 3D view in G1.

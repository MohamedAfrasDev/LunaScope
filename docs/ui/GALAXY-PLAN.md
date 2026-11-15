# LunaScope "Calm Galaxy" redesign: shadcn components and a complete product experience

Status: **plan, revised to a calm, aesthetic direction. G0 (baseline), G1 (shadcn foundation and calm tokens) and G2 (shadcn components) and G3 (calm visual system) and G4 (app shell) and G5 (command palette) and G6 (polished states) and G7 (onboarding) and G8 (calm hero) and G9 (route re-skin) are done**; see Appendices A to J. No product code changed yet. Follows the shipped redesign ([UI-REDESIGN.md](UI-REDESIGN.md)).

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
| G1 | **Done.** shadcn foundation: `init`, `cn`, deps, `components.json`; token migration codemod; **calm twilight palette**; `tokens.test.ts` updated | A |
| G2 | **Done.** Replace primitives with shadcn: Button, Card, Badge (status chips), Alert, Separator, Skeleton, Progress, Input, Label, native Select; restyle native Disclosure. Checkbox and RadioGroup deliberately stay native (Appendix C.3) | B |
| G3 | **Done.** Calm visual system: twilight backdrop (gradient, nebula washes, still stars), soft elevation, hairline borders, spacing and type rhythm, optional slow drift with Pause, reduced-motion/transparency/contrast fallbacks | C |
| G4 | **Done.** App shell: Sidebar, Sheet on mobile, breadcrumbs, recent runs, ToggleGroup for the view mode, status pill relocated | D |
| G5 | **Done.** Command palette: Command dialog, entries, shortcuts, tests | D |
| G6 | **Done.** Polished states: skeletons, Sonner toasts, Empty/error/not-found, a short page fade | E |
| G7 | **Done.**  Onboarding: tour, tooltips, glossary | F |
| G8 | **Done.** Calm hero: the supplied image (optimised, with a scrim), plus an optional gentle 3D layer, fallbacks and a performance guard | G |
| G9 | **Done.** Re-skin each route on the new system (Home, Run, Timeline, Sky, Compare, Time Machine, Evidence, Analyze, Explainer, notable sites) | H |
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

## Appendix B. G1: shadcn foundation and the calm token system

### B.1 What was set up

| Item | Result |
|---|---|
| `shadcn init` | `-t next -b radix -p nova` (Radix primitives; the **Nova** preset, Lucide icons and Geist, which the project already uses). Writes `components.json` (style `radix-nova`, RSC, CSS variables, aliases `@/components`, `@/components/ui`, `@/lib/utils`) and `lib/utils.ts` |
| Dependencies added | `radix-ui`, `class-variance-authority`, `lucide-react`, `tw-animate-css`, and **`cn`** (shadcn's own small replacement for clsx + tailwind-merge, from `shadcn-ui/cn`; `lib/utils.ts` re-exports it). `shadcn` (the CLI) was already a dev dependency; the stylesheet now imports `shadcn/tailwind.css` at build time, and the Docker build installs dev dependencies, so deploys are unaffected |
| What init did that was reverted | It overwrote `components/ui/Button.tsx` with shadcn's button (case-insensitive file system), which would have broken every `<Button variant="primary">`. Restored; shadcn's button arrives in G2. It also wrote a **circular** `--font-sans: var(--font-sans)` and mixed neutral light defaults into the dark `:root`; both were replaced when the token section was rebuilt |

### B.2 Tokens: shadcn's semantic names, calm twilight palette

`app/globals.css` was rebuilt: one `:root` (dark, the default) and one `@media (prefers-color-scheme: light)` block, mapped into Tailwind with `@theme inline`.
shadcn's `dark:` variant is defined as `@custom-variant dark (@media not (prefers-color-scheme: light))`, so shadcn components follow this app's own theme
switch (there is no `.dark` class). Radius is now `0.75rem` (the shadcn scale derives from it), so every box is a little softer.

| Token | Dark (twilight) | Light (lunar day) |
|---|---|---|
| `background` / `card` / `popover` / `muted` | `#0b1020` / `#111830` / `#151d38` / `#182142` | `#f7f5f0` / `#ffffff` / `#ffffff` / `#efece5` |
| `foreground` / `muted-foreground` | `#e9edfa` / `#a9b2d3` | `#1a1f36` / `#585e78` |
| `primary` / `primary-foreground` / `ring` | `#a5b4ff` / `#0b1020` / `#a5b4ff` | `#4350c8` / `#ffffff` / `#4350c8` |
| `secondary` / `accent` (hover and selected backgrounds) | `#1b2448` / `#212b57` | `#ece9e1` / `#e7e3da` |
| `border` (hairline) / `input` (control edge) | `#2a3560` / `#6d7bb0` | `#dcd8cc` / `#7a7466` |
| `sun` / `earth` | `#f4c873` / `#86b8ff` | `#8a5500` / `#1d4f9c` |
| `ok` `fail` `warn` `info` | `#86dcae` `#ff9aa5` `#f4d27e` `#9db7ff` | `#0f6b3a` `#a4262c` `#7c5200` `#2f4bb3` |

Also defined for later phases: `destructive`, `chart-1..5`, and the full `sidebar-*` set. Status colours keep their soft fills (`ok-soft` and the rest).

### B.3 The rename (codemod, reviewed)

225 replacements in 45 files, in one pass so nothing converts twice:
`text-muted` to `text-muted-foreground` (119), `text-accent` to `text-primary` (25), `bg-surface-2` to `bg-muted` (18), `bg-surface` to `bg-card` (16),
`border-border-strong` to `border-input` (11), `border-accent` to `border-primary` (6); and in SVG and inline styles `var(--muted)` to `var(--muted-foreground)` (17),
`var(--surface)` to `var(--card)` (9), `var(--surface-2)` to `var(--muted)` (4), `var(--border-strong)` to `var(--input)` (1). A search afterwards finds no stale names.
The hand-written CSS classes (`btn-primary`, `surface-card`, `nav-link`, `eyebrow`, type styles, `readout-unit`) were repointed to the new tokens; the focus ring is `--ring`.
Two test assertions followed the rename (`border-primary`, `.bg-muted`); the other two class assertions (`btn-primary`, `text-warn`) were unaffected.

### B.4 Contrast guard

`tests/web/tokens.test.ts` was rewritten for the new token set and now checks, in both themes and on every surface text can sit on (`background`, `card`,
`popover`, `muted`): all text and status colours at 4.5:1, the control edge (`input`) at 3:1 (also on `secondary` and `accent`), status text on its own soft fill, text on the
hover and selected backgrounds, the primary button label on `primary`, and the focus ring at 3:1; plus that every token is mapped into Tailwind and that the `dark:` variant uses the media query.
Result: lowest text pair **4.99:1** (light) and **6.46:1** (dark); lowest control edge **3.30:1** (dark) and **3.63:1** (light).

### B.5 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 26 files, 268 tests pass (the guard grew from 26 to 34 checks) |
| `tsc`, `eslint` | clean |
| `next build` | passes; the served stylesheet contains the new palette and the tw-animate keyframes |
| Playwright e2e | 14 pass; fallback e2e 1 passes |
| axe, dark and light, 9 routes | 0 violations |
| Visual | the same 30 views were re-captured and compared with `pre-galaxy/`: layout is unchanged; only colour, softer corners and the warm paper light theme differ |

### B.6 Findings for the next phases

- **File-name casing (for G2).** shadcn files are lower-case (`button.tsx`), the hand-written primitives are PascalCase (`Button.tsx`). On a case-insensitive file system
  these are the same file, and on Linux (Docker, CI) they would be two. G2 renames the primitives to lower-case with a two-step `git mv`, then adds shadcn's.
- **Not yet done by design.** No shadcn component is used yet (that is G2), shadows and the calm elevation are G3, and the **3D sky view** still draws with hard-coded
  hex colours (it does not follow either theme, and its Sun and Earth hues differ slightly from the tokens): its palette moves onto the tokens in G9.
- **Prerequisite for G2.** The `dark:` variant was verified by test (the string) and by the build; it will be exercised for real once shadcn components that use `dark:` classes are added.

## Appendix C. G2: shadcn components

### C.1 What is now shadcn

Added with `shadcn add ... -o` (Radix base, Nova preset), then adapted (the code is ours to edit):

| Component | Used for | Adaptation |
|---|---|---|
| `button` | Every button, and the export link (`asChild`) | `type="button"` unless a caller says otherwise; sizes `sm` 32 px, default 36 px, `lg` 44 px; long call-to-action labels may wrap |
| `alert` | Failed or warning messages | New tones `destructive`, `warning`, `info` in the status colours (soft fill, tinted edge); `role="alert"` by default, overridable |
| `badge` | The status chips (`StatusChip`, `ResultBadge`) | New tones `ok`, `fail`, `warn`, `info`, `muted`; icon and word always inside; a little larger text than shadcn's default |
| `card` | The three nested boxes that used my own Card | Flex column and spacing switched off at the call site so content keeps its flow |
| `progress` | The running-run progress bars | **Bug fixed**, see C.4 |
| `input`, `label`, `native-select` | All text inputs (form, Time Machine, dates search), field labels, and all 6 selects | Input and select are 40 px tall; `native-select` keeps a real `<select>` |
| `separator` | The rule on Home | none |
| `skeleton` | Added, **not used yet** (loading states are G6) | none |

Kept hand-written, because shadcn has no equivalent: `Disclosure` (restyled, below), `SectionHeader`, `Stat`, `SunEarthKey`, `WarningItem`, and `tone.ts`.

**Disclosure** stays a native `<details>`/`<summary>` (13 test files and the keyboard sweep depend on it) but now looks like the rest: a soft border and muted fill, a thin
Lucide chevron that turns when open, and a hover state. The three remaining hand-rolled `<details>` (interval tables, changed spans, the evidence-card checks) now use it, so every
disclosure shares one look. The Advanced settings section and the status pill keep their own markup.

### C.2 Mechanics

- The nine hand-written primitives were renamed to lower-case with a two-step `git mv` (`Button.tsx` to `button.tsx` and so on) and every import updated, so the repo is
  the same on Windows and on Linux. shadcn's files replaced three of them in place.
- Call sites: 13 buttons (including the former `btn-primary` ones), 12 inputs, 6 selects, 2 progress bars, 1 separator, 7 alerts and every chip. The old `btn-primary` and
  `btn-sm` CSS was deleted. `.surface-card` keeps its place but takes the shadcn card's corner (`1.4 x radius`).
- Verified in the build: shadcn's `dark:` classes compile to `@media not all and (prefers-color-scheme: light)`, so they apply in the default dark theme and are off in light, as designed in G1.

### C.3 Deliberate non-adoptions

| shadcn component | Decision | Why |
|---|---|---|
| `select` (Radix listbox) | Use `native-select` instead | A real `<select>` keeps `fireEvent.change`, `selectOption`, the platform picker on phones and screen-reader behaviour; the Radix select needs polyfills in jsdom and breaks the e2e keyboard flow |
| `checkbox`, `radio-group` | Stay native, styled with `accent-color` | They render as buttons plus hidden inputs; tests count checked inputs, the e2e flow moves a radio group with the arrow keys, and the site lists are native checkboxes inside selectable cards. Revisit only with a reason |
| `card` for every panel | `.surface-card` restyled; `Card` used for new work | The shadcn Card is a flex column with built-in spacing; swapping it into ~22 existing panels would shift their layouts for no gain |

### C.4 Findings

- **shadcn `Progress` drops its value.** The generated component takes `value` for the bar's width but never passes it to the Radix root, so the bar had no
  `aria-valuenow` and a screen reader would hear no progress. Fixed in the file and pinned by a test. Worth remembering when adding other generated components: read them.
- **The layout sweep caught a real regression.** shadcn's button never wraps its label; the large "Compare the Artemis III features" button made Home 3 px too wide at 320 px. The
  two call-to-action buttons now wrap (`whitespace-normal`, minimum height instead of a fixed one).
- **Operational:** a verification server must be a fresh `next start` on an unused port after every build; an old one keeps serving stale files.

### C.5 Tests

`tests/web/ui-primitives.test.tsx` was rewritten for the shadcn APIs (Alert tones, Button default type, variants and `asChild`, Badge tones, Card, Progress with `aria-valuenow`);
`components.test.tsx` now asserts `aria-valuenow="33"` instead of the old native `value`; `phase2.test.tsx` asserts the export link is the primary Button (`data-variant="default"`).
No other test changed: they find things by role, name and text.

### C.6 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 26 files, 273 tests pass |
| `tsc`, `eslint` | clean |
| `next build` | passes |
| Playwright e2e | 14 pass (after the wrap fix; the first run caught the 320 px overflow); fallback e2e 1 passes |
| axe, dark and light, 9 routes | 0 violations |
| Visual | 30 views re-captured: forms, chips, buttons, alerts and disclosures reviewed in both themes |

## Appendix D. G3: calm visual system

### D.1 What changed

| Part | Behaviour |
|---|---|
| **Backdrop** (`.backdrop`, in `app/layout.tsx`) | Fixed behind everything, `aria-hidden`, `pointer-events: none`. A twilight gradient with three faint nebula washes (lavender, dusty blue, rose, each under 16 % opacity). Pure CSS, no image, no canvas, no JavaScript |
| **Stars** (`.backdrop-stars`) | A still field of 34 faint points (1 to 2 px, 30 to 50 % opacity) from one 600 px tile, generated once with a fixed seed and written into the stylesheet |
| **Drift** | The star layer moves one tile (600 px) in 240 s, linear, a GPU `transform` only (no repaint, no parallax, not tied to scroll or pointer). Runs only under `prefers-reduced-motion: no-preference` and unless paused |
| **Pause** (`AmbientToggle`, in the footer) | A visible button, "Pause background motion" / "Resume background motion", `aria-pressed`, remembered in `localStorage`, applied as `data-motion="paused"` on `<html>`. Reads storage through `useSyncExternalStore`, so the first paint assumes "running" and there is no hydration mismatch |
| **Soft elevation** | `--shadow-sm` is now a two-part diffuse shadow in both themes (deeper in dark, barely there in light); applied to `.surface-card` and every shadcn Card (`[data-slot="card"]`). Hairline borders stay |
| **Glass chrome** | The header is `.chrome-glass` (82 % card colour, blur 14 px). Panels and data are never glass |
| **Rhythm** | Body line height 1.55 to 1.6; the page's vertical padding grows a little on large screens |

### D.2 Fallbacks

| Preference | Result |
|---|---|
| `prefers-reduced-motion: reduce` | No drift at all; the gradient and still stars stay |
| Paused by the user | Same, and remembered |
| `prefers-reduced-transparency: reduce` or `prefers-contrast: more` | The header is solid, the backdrop is the plain background colour, no stars |
| Light theme (the lunar day) | A pale wash, no stars |

### D.3 Notes

- Everything decorative sits behind opaque panels or in empty margin, so contrast was not changed: text colours are unchanged and `tokens.test.ts` (which tests against the real panel colours) still passes. Text that sits directly on the backdrop (headings and body on Home) is on a background between `#0d1330` and `#0b1020` with specks at 30 to 50 % opacity, and keeps well over 4.5:1.
- Not done: pausing when the tab is hidden is left to the browser, which already stops compositing animations in a hidden tab. The "also in the palette" entry for the pause toggle arrives with the palette in G5.
- A calm-versus-galaxy judgement on real screenshots is deferred to G8 with the hero, as the risk table says.

### D.4 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 27 files, 275 tests pass (new: `ambient-toggle.test.tsx`) |
| `tsc`, `eslint` | clean |
| `next build` | passes |
| Playwright e2e | 16 pass (new: `backdrop.spec.ts`: drifts by default, stops when paused and stays paused after a reload, is inert, and does not run under reduced motion) |
| Visual | Home reviewed in the browser: faint stars, soft wash, readable |

## Appendix E. G4: app shell

### E.1 What changed

| Part | Behaviour |
|---|---|
| **Side navigation** (`components/shell/AppSidebar.tsx`, shadcn `Sidebar`) | `<nav aria-label="Main">` with three groups: **Mission** (Home, New analysis), **Recent runs**, **Learn** (Why the south pole is hard). An icon-collapsible rail with a tooltip per item; current page marked with `aria-current="page"` (read from the URL behind Suspense, so a static list of links renders first). Docked from 1280 px; below that it is a **sheet** opened from the bar's sidebar button, and it closes after a link is chosen |
| **Top bar** (`components/shell/ShellBar.tsx`) | Sidebar button, **breadcrumbs** (Home, New analysis, Why the south pole is hard, Analysis `<short id>` and its view), and, always in view, the **data-status pill** and the Guided/Technical switch. The pill did not move into the sidebar: it is the trust label and must be visible on every screen, including a phone with the sheet closed |
| **Guided / Technical** | Now shadcn `Toggle` buttons (still `aria-pressed`, same names), inside a labelled group |
| **Recent runs** (`lib/recent-runs.ts`) | Kept in `localStorage` only: run id, when it was opened, and a label built from the site names the service returned for that run ("Shackleton rim and 2 more"), plus its result state badge. Recorded once the service has answered for the run (by `RunNav`), newest first, one entry per run, at most 8, ids validated, corrupt storage ignored, a "Clear recent runs" button. With storage blocked the list is empty or lasts for the page. No backend change |

### E.2 Decisions

- **Why 1280 px, not 768 px.** The first version docked the sidebar from 768 px; the layout sweep caught the Timeline page at 813 px wide in a 768 px window (the sidebar took 256 px). A sheet below 1280 px keeps every page's width unchanged on phones and tablets, and the docked sidebar still leaves 1184 px of content at 1440 px.
- **One `<main>`.** shadcn's `SidebarInset` renders a `<main>`; it is a `div` here, so the page keeps its single `<main id="main">` and the skip link still works.
- **`ToggleGroup` not used.** It renders radio buttons; the e2e tests and users know Guided and Technical as buttons with `aria-pressed`. The group is a plain `role="group"` of `Toggle`s.
- **Not generated as-is.** The shadcn `useIsMobile` hook set state in an effect (lint error); it is now `useSyncExternalStore`. `-o` also overwrote `button.tsx` and `input.tsx` with the generated versions; both were restored from git (the product's adaptations from G2 stay).
- **Sidebar state cookie.** shadcn writes a `sidebar_state` cookie on toggle. It holds only open/closed, is first-party, and is not read by the server.

### E.3 Findings from the tests

- The sweep caught two real problems before they shipped: the 768 px overflow above, and breadcrumb links that were 20 px tall (now a 24 px minimum). The sidebar's "clear" button was also widened from 20 to 24 px.
- A click on the sidebar button before the page hydrates does nothing (the sheet is client state); a click after hydration opens it. The e2e test waits for the button, as a user would.

### E.4 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 28 files, 281 tests pass (new: `shell.test.tsx`: breadcrumbs, recent runs, sidebar) |
| `tsc`, `eslint` | clean |
| `next build` | passes |
| Playwright e2e | 18 pass (new: `shell.spec.ts`: desktop shell, recent runs survive a reload and clear; phone sheet opens and closes with Escape, status stays in view); axe clean on every route with the shell; fallback e2e 1 passes |
| Visual | Desktop (1440) and phone (375, sheet open) reviewed in the browser |

## Appendix F. G5: command palette

### F.1 What it is

shadcn `Command` (cmdk) in a `Dialog`: `components/shell/CommandPalette.tsx`. A shortcut layer over things that already have a visible control; it is never the only way to anything.

| Part | Behaviour |
|---|---|
| **Opening** | Ctrl/Cmd+K (toggles), or `/` when you are not typing in a field; and a visible **Search** button in the top bar (with the shortcut as `aria-keyshortcuts`), so nobody needs to know the keys |
| **Dialog** | Radix: focus moves to the search box, focus is trapped, Escape closes and returns focus, and the dialog has a name ("Search LunaScope") and a description. Frosted (`chrome-glass`), solid under reduced transparency or more contrast. Fits a 320 px phone |
| **This analysis** (only on a run page) | Matrix, **Timeline: site** and **Sky: site** for each of the run's sites, Compare sites (two or more sites), Time Machine, Evidence. The site names come from the recent-run record, which now also keeps the run's site ids (written by `RunNav` once the service has answered) |
| **Pages** | Home, New analysis, Why the south pole is hard |
| **Recent runs** | The same list as the sidebar |
| **Actions** | Switch to the Guided or Technical view (shows the one you are not on), Pause or Resume background motion (the toggle from G3, now exported), Copy link to this page, Clear recent runs (only when there are some) |
| **Empty** | "Nothing matches. Try a page name, a site or technical." |

### F.2 Decisions and findings

- **Generated `CommandDialog` fixed twice.** Its title and description were rendered outside the dialog, leaving a screen-reader-only `h2` in the page even when the palette was closed, which broke the "home starts with its h1" check; they now sit inside the dialog. It also does not wrap its children in cmdk's `Command` root (the list throws without it); the palette adds it.
- **No separators.** axe flagged the listbox (`aria-required-children`): a `separator` is not an allowed child of a listbox. The groups already have headings, so the separators were dropped.
- **Suspense.** The palette reads the URL, so it streams in behind Suspense like the rest of the shell; the build caught the missing boundary.
- **Shortcut safety.** `/` never fires while typing in an input, textarea, select or editable field; Ctrl/Cmd+K works anywhere. The sidebar's own Ctrl/Cmd+B (shadcn default) is unchanged.
- **Copy link** needs the clipboard; if it is unavailable the action does nothing (a toast confirming it arrives with G6).
- `shadcn add command dialog -o` again overwrote `button.tsx` and `input.tsx`; restored from git. (Use `-o` only with a `git checkout` of those two afterwards, or without `-o` and answer the prompts.) It also added `input-group` and `textarea`, which the command input uses.

### F.3 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 29 files, 289 tests pass (new: `command-palette.test.tsx`, 8 tests: open/close, `/` rule, Search button, navigation, run views, actions, empty state) |
| `tsc`, `eslint` | clean |
| `next build` | passes |
| Playwright e2e | 21 pass (new: `palette.spec.ts`: Ctrl+K opens a named dialog with the search box focused, axe clean on the dialog, filter and Enter navigate, `/` and Escape, Search button plus an action, phone fit); fallback e2e 1 passes |
| Visual | Opened in the browser pane: frosted dialog, search box focused |

## Appendix G. G6: polished states

### G.1 What changed

| Part | Behaviour |
|---|---|
| **Loading** (`components/ui/loading-state.tsx`) | One `LoadingState` replaces every "Loading…" line (the six run pages' Suspense fallbacks, the run, timeline, evidence, comparison, Time Machine baseline, shifted run, local sky and site catalog). The words say what is loading and are announced as a status; soft `Skeleton` blocks (decorative, `aria-hidden`) show the shape of the coming page. Wording is unchanged, so existing tests still find it. Small inline notes (the status pill, the reference definition, the 3D view overlay) stay as text |
| **Skeleton motion** | A slow breathing pulse (2.6 s, down to 55 % opacity) instead of shadcn's faster `animate-pulse`; defined only under `prefers-reduced-motion: no-preference`, so it is still under reduced motion |
| **Not found** (`app/not-found.tsx`) | Served with a real 404, inside the shell, one `h1` ("This page is not here"), plain wording, two ways out (Home, New analysis). Built on shadcn `Empty` |
| **Error** (`app/error.tsx`) | A last-resort screen for an unexpected failure: says what happened and that nothing was changed, shows **no** technical detail, offers Try again and Home. The service being unreachable is not this: it stays the inline banner and alerts |
| **Run not found** | The same calm `Empty` card with the same words and link as before ("Run not found", "Start a new analysis") |
| **Toasts** (shadcn `Sonner`, mounted once in the layout) | Short confirmations only, bottom centre, 3.5 s: "Link copied" (or a plain error if the browser refuses), "Technical view on" / "Guided view on", "Recent runs cleared". **Critical states stay inline alerts**, never toasts |
| **Page settle** (`app/template.tsx`, `.page-in`) | A new page rises 6 px over 0.2 s. None under reduced motion |

### G.2 Decisions and findings

- **A fade would have broken axe.** The plan said "a short fade between pages". An opacity animation made axe measure text mid-fade and report `color-contrast` on three pages (the checks run right after navigation). The settle is a transform instead, so text is never less than its full contrast, and the colour tests are unaffected.
- **A toast steals the keyboard.** The first version also toasted "Analysis started" after starting a run. The toast list is focusable and Sonner returns focus to the last element, so Tab alternated between the footer's Pause button and the toast and the keyboard flow could never reach the page (the core-flow e2e caught it). Those toasts are removed (the run page already shows "Queued", "Running"), and the palette toasts were checked for the same loop: after the dialog closes, Tab walks the page in order from the top.
- **`next-themes` removed.** The generated Sonner imports it for a theme switch the app does not have (it follows the system, like the rest); the dependency was uninstalled and the toaster uses `theme="system"`.
- **Empty headings.** shadcn's `EmptyTitle` is a `div`; the screens use a real `h1` so each page still has exactly one.
- **Not done:** `Spinner` was added but is not used (the skeletons and status text cover every wait); there is no `global-error.tsx` (it replaces the whole document and the root layout's shell rarely fails); skeletons for the 3D sky canvas keep their text-only overlay.

### G.3 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 30 files, 292 tests pass (new: `states.test.tsx`: loading status, not-found, error without detail and with retry) |
| `tsc`, `eslint` | clean |
| `next build` | passes (`/_not-found` prerendered) |
| Playwright e2e | 25 pass (new: `states.spec.ts`: real 404 inside the shell and axe clean, missing run, a palette toast, skeleton motion with and without reduced motion); fallback e2e 1 passes |
| Visual | The 404 page reviewed in the browser |

## Appendix H. G7: onboarding

### H.1 What changed

| Part | Behaviour |
|---|---|
| **Glossary** (`lib/glossary.ts`) | One file with six terms: terrain-aware, flat horizon, availability range, unresolved, unknown, excluded. The sentences come from the user guide, so the product says the same thing everywhere. Used by the term popovers and the explainer's new **Key terms** section |
| **Terms** (`components/ui/term.tsx`, shadcn `Popover`) | A real button with a dotted underline; Enter, Space, tap or click open the meaning, Escape closes it. A popover rather than a hover tooltip, because a tooltip cannot be opened by touch and is awkward by keyboard. One quiet line under the results ("Terms used here: ...", `TermsHint`) carries all five |
| **Page tour** (`components/tour/RunTour.tsx`) | On a finished run: five steps (the verdict; one card per site; the views of the analysis; detail that stays folded; the data label). Each step **outlines** the part of the page it explains (an outline, so layout and text contrast never change), scrolls it into view (no smooth scrolling under reduced motion) and moves focus to the step heading. Back, Next, End tour, Done, Escape. A step whose target is not on the page is skipped |
| **Offer, not ambush** | The tour is **offered once**, as a quiet line above the results ("New here? ... Take the tour / No thanks"). It never opens by itself and never reopens by itself: after the first answer (started or declined) it is remembered in `localStorage` and the offer is gone. It stays available from the command palette ("Take the page tour", on a run's main page) |
| **Palette** | New entries: **Key terms** (the explainer's glossary) and, on a run page, **Take the page tour** |

### H.2 Decisions and findings

- **Wording had to change.** The explainer page has a guard against sounding like a certification (a test that forbids "certified" and its forms). The guide's phrases "certified visible time" and "cannot be certified" tripped it, so the glossary says "the time confirmed visible" and "cannot be confirmed either way". The meaning is the same; the guide itself is unchanged.
- **Terms are in one place, not woven into existing labels.** Wrapping words inside labels such as "Flat horizon (comparison)" would split the text node and break the tests (and screen-reader reading) that treat the label as one phrase. The single terms line adds five tab stops instead of one per label.
- **The tour floats only when asked for.** An always-on floating tour would sit on top of controls in every test and for every first-time visitor; an in-flow offer does not. Once started, the step card is fixed at the bottom of the window and does not trap focus.
- **A test mock was wrong, and the new render timing exposed it.** Two RunView tests answered the evidence `validation` request with a run object, so the evidence link read `v.groups` of the wrong shape and crashed the tree whenever the response arrived early. The mocks now refuse `validation` as they already refused `provenance`. (No product code changed for this.)
- **Not done:** a tour for pages other than a finished run; tooltips inside the Time Machine and Timeline pages (the terms line and the glossary cover the same words); translating or splitting the tour by Guided/Technical.

### H.3 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 31 files, 298 tests pass (new: `onboarding.test.tsx`: glossary, term popover, tour offer, steps, Escape, restart, a missing target) |
| `tsc`, `eslint` | clean |
| `next build` | passes |
| Playwright e2e | 27 pass (new: `onboarding.spec.ts`: a term opens with Enter and closes with Escape, axe clean with the popover open and during the tour, the five-step tour, never re-offered after a reload, restarted from the palette; the explainer's Key terms); fallback e2e 1 passes |
| Visual | Not reviewed on screen this phase: the tour needs a finished run (the science service); it was checked by the browser tests above (focus, outline, axe) |

## Appendix I. G8: calm hero

### I.1 What changed

| Part | Behaviour |
|---|---|
| **Optimised picture** | `app/images/hero-2400.jpg`: the supplied image resized to 2400 x 1345 (JPEG quality 74, progressive), **268 KB** instead of 22.7 MB. Imported statically into `components/HeroStage.tsx`, so `next/image` serves AVIF or WebP at the right width and generates the blur placeholder. `next.config.ts` lists `image/avif` and `image/webp`. The original (`hero-bg.jpg`) is **not imported anywhere**; a test fails if any hero file refers to it |
| **Stage** (`HeroStage`) | The whole Home introduction (text, reference-mission card, sketch) sits on the picture inside a rounded, bordered stage. The picture is decoration (`alt=""`, `priority` because it is the largest content, never inside a result frame), with no motion |
| **Scrim** (`.hero-scrim`) | A dark blue gradient (90 % on the left, 86 % in the middle, 72 % on the right) plus a soft vignette. Computed against the real pixels: the **brightest pixel under the left 60 % still gives the muted text 5.5:1** (foreground 9.9:1), and under the right 40 % 4.5:1; the caption under the sketch uses the brighter foreground colour for extra margin |
| **Night scope** (`.theme-night`) | The stage always uses the night palette, so the text is light-on-dark in the light theme too (the page around it stays light). It repeats the dark tokens; a test keeps the two copies identical |
| **Honesty label** | A visible chip on the stage: "Background: illustration only. Not NASA imagery, not data." |

### I.2 Decisions and findings

- **The 3D galaxy layer was not built.** The plan allowed "an optional gentle 3D layer". With the photograph as the backdrop, a rotating point cloud on top would add three.js weight and GPU work to the first screen and compete with the one focal point the calm principles ask for. So there is nothing to pause, no WebGL fallback to maintain, and the reduced-motion, paused and low-power cases are all satisfied by the still picture. It can be revisited as its own phase if the team wants it.
- **Calm over spectacle.** With the scrim sized for guaranteed legibility the photograph reads as a faint glow and the Earth's limb at the bottom, not as a bright scene. That is the intended "mood, not spectacle"; the knob is the scrim alpha in `.hero-scrim` (lower it only after re-running the contrast numbers above).
- **No reduced-data switch.** CSS cannot stop an `<img>` from downloading, and `prefers-reduced-data` is barely supported, so the 268 KB picture is always fetched (served as AVIF or WebP it is smaller still; the e2e test caps every served variant at 450 KB).
- **Open items (yours):** the picture's **source and licence are still unrecorded** (`docs/submission/LICENCES-AND-CITATIONS.md` now says so plainly instead of "No images are used"; `DISCLOSURES.md` may want an entry); and whether to keep the 22.7 MB `hero-bg.jpg` in the repository (a smaller committed copy is what the page now uses; Git LFS or deleting the original are the options).

### I.3 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 32 files, 301 tests pass (new: `hero-stage.test.tsx`: decoration and label, the size budget and the original never imported, the night scope equals the dark tokens) |
| `tsc`, `eslint` | clean |
| `next build` | passes |
| Playwright e2e | 30 pass (new: `hero.spec.ts`: axe clean on Home in dark and in light, every served image variant under 450 KB and AVIF, WebP or JPEG, no sideways scroll at 320, 768 and 1440) |
| Visual | Home reviewed in the browser in dark and light: calm, text legible, label visible |

## Appendix J. G9: re-skin of the routes

### J.1 Audit first

Every route was captured in dark and light at 1440 px on a real finished synthetic run (home, new analysis, explainer, run matrix, timeline, sky in all three views, compare, Time Machine, evidence) and reviewed. Because G1 to G7 moved every component onto the semantic tokens, most routes needed no change: the status chips, cards, tables, charts, disclosures and forms already follow the calm palette in both themes. A search for hard-coded colours in `components/`, `app/` and `lib/` (outside the token definitions and the generated shadcn files) found exactly one place: the 3D sky.

### J.2 What changed

| Part | Behaviour |
|---|---|
| **3D sky on the tokens** (`lib/sky-palette.ts`, `components/Sky3D.tsx`) | Every colour in the scene is read from the design tokens when the scene is built: background, ground (`--card`), terrain wall (`--accent`), ridge line and compass letters (`--foreground`), the flat-horizon ring (`--muted-foreground`), the other elevation rings (`--border`), the north marker and the Sun (`--sun`), Earth (`--earth`). The Sun and Earth hues now match the rest of the interface (the 3D view used `#f5a524` and `#5aa9ff`, which differed from the tokens). The scene is rebuilt when the system theme changes, so it is the night scene in dark and a pale lunar-day scene in light. A test fails if a hex colour appears in `Sky3D.tsx` again |
| **Recent runs** | The status badge in the sidebar no longer truncates ("Synthetic demc"): it wraps onto its own line |
| **Page rhythm** | The vertical padding of the content area is a little tighter (2rem, 3rem on larger screens), so run pages start higher |

### J.3 Decisions and findings

- **Re-skin by system, not by route.** Rewriting each page's markup would have added risk (every route has e2e, axe and layout tests) for little visible gain once the tokens, primitives, shell and states were in place. The audit found no route that still looked like the old interface.
- **Not changed, noted for later:** the polar sky plot's labels crowd where the Sun's marker, the "S" and "0° flat horizon" meet at a low Sun (an existing layout choice in `SkyPlots`, not a theme issue), and the analysis form's sticky "Run analysis" bar is translucent, so content scrolling under it shows faintly. Neither affects meaning or contrast.
- **Dark-versus-light axe on every route** is the first job of G10 (today the Playwright suite checks axe in the default theme, plus Home in both).

### J.4 Verification (production build)

| Check | Result |
|---|---|
| `vitest` | 33 files, 304 tests pass (new: `sky-palette.test.tsx`: tokens are read, the night fallback, no hard-coded colour in the scene) |
| `tsc`, `eslint` | clean |
| `next build` | passes |
| Playwright e2e | 30 pass (the 3D view's draw, time-follow, axe, keyboard and phone-fit tests all unchanged and green); fallback e2e 1 passes |
| Visual | 18 route captures plus the 3D view in both themes reviewed; the 3D scene follows each theme |

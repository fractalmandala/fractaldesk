---
title: Untw Tech Spec
description: Implementation plan for the untw surface, its offline decode engine, and verification.
created: 2026-09-11
updated: 2026-09-11
type: spec
---

## Context

FractalDesk is a Tauri plus SvelteKit app served as one static bundle (`src/routes/+layout.js` sets `ssr = false`; adapter-static emits `dist/`). Surfaces are registered in `src/lib/states.js` (`id`, `label`, `full`), rendered from `src/routes/+page.svelte` shell branches, and driven by header conditionals; the Sassy surface (`src/lib/ConvertSurface.svelte` plus `src/lib/sass/state.svelte.ts`) is the pattern to mirror. Styling is SASS-only against `src/app.sass` tokens per DESIGN.md. There is no tailwindcss, postcss, or Node runtime inside the shipped app, and end-user machines cannot be assumed to have Node, so the Tailwind compiler cannot run at decode time.

A proven decode pipeline already exists and was validated to 70/70 tokens on a real shadcn file: extract class strings, split variants, compile candidates with Tailwind v4 plus project theme plus plugins, match emitted selectors back to tokens (including `:is()`-wrapped `*`/`**` selectors), prefer nested `@supports` color-mix overrides over plain-var fallbacks, group into buckets, and suggest fractalstyler equivalents. The key architectural fact enabling an offline port: Tailwind v4 declarations are variant-independent, so a core-utility resolution map plus variant-as-condition-annotation reproduces compiler output without running the compiler.

Relevant files: `src/lib/states.js` (registry), `src/routes/+page.svelte` (header conditional plus shell branch), `src/lib/ConvertSurface.svelte` plus `src/lib/sass/*` (pattern), `src/app.sass` (tokens), `docs/worklog/untw-tailwind-deconstruct.md` (task log).

## Proposed changes

1. New `src/lib/untw/` engine, plain TypeScript with zero dependencies:
   - `extract.ts`: port of the proven extractor (class/className/:class/Svelte class:/cn()/clsx() strings, per-block tokenize, unique tokens, dynamic `${}` flagged unresolvable).
   - `variants.ts`: bracket-aware variant-chain splitter (split on `:` outside `[...]`), plus condition labels (`hover:` → on hover, `dark:` → in dark mode, `data-[k=v]:` → when data-k=v, `[&…]:` → for matching descendants, `*:`/`**:` → direct children/all descendants).
   - `resolution-map.json`: generated artifact mapping core utility → merged declarations. Generated once by `tools/untw/generate-map.mjs` running the real Tailwind v4 compiler (plus tw-animate-css and the dark custom variant) over programmatically enumerated candidates: numeric scales 0–96, the default color palette across color utilities, named utilities, and side/compound forms. Entries store the `@supports`-merged declarations with the plain-var fallback retained.
   - `resolve.ts`: map lookup; arithmetic synthesis for off-map numeric scales (`p-<n>` → `calc(var(--spacing) * <n>)`, `≈ <n*4>px`); `@theme` synthesis for custom `--color-*`/`--radius-*`/`--animate-*` names (`bg-{n}` → `background-color: var(--color-{n})`, radius names, animate names); bare `group`/`group/{name}` reported as anchors with cross-references to `group-*/{name}` rules in the same decode; everything else → unknowns with cause hints.
   - `theme.ts`: client-side parser for the optional `@theme` block (name extraction) and for `:root`/`.dark` value tables used to display light/dark concrete values for known shadcn-style names.
   - `categories.ts`, `fractal.ts`: ports of the proven bucketing and nearest-neighbour fractal suggestions.
   - `state.svelte.ts`: `untw` rune state (input, themeCss, result, error, busy, copied) mirroring `src/lib/sass/state.svelte.ts`.
2. New `src/lib/UntwSurface.svelte`: input editors plus results views, styled in `<style lang="sass">` with app.sass tokens only, following ConvertSurface pane/gutter conventions where they fit.
3. Wiring: `{ id: 'untw', label: 'Untw', full: true }` in `src/lib/states.js`; header conditional with Convert plus Copy summary plus Copy JSON; shell `{:else if app.view === 'untw'}` branch. No changes to other surfaces.
4. Tradeoff recorded: project-specific `@utility` rules and third-party plugins beyond tw-animate-css cannot resolve offline and surface as unknowns with cause hints; adding a new curated plugin means re-running the generator, not changing the engine.

## Testing and validation

- `pnpm check` (svelte-check) reports no new errors; `pnpm build` succeeds — covers product invariants 1–3 and 14 structurally.
- Golden decode: `npx --yes tsx tools/untw/verify.ts` replays the dropdown-menu token set (captured from the real compiler into `tools/untw/golden-dropdown.json`) against the offline engine; all 78 tokens must resolve byte-identically — covers invariants 4–8 and 10–11.
- Manual pass in the app: example converts on load path, empty input keeps Convert disabled, unknown-heavy paste shows cause hints, pasted `@theme` flips the header to pasted-theme mode, Clear resets — covers invariants 3, 8, 9, 12, 13.
- Offline check: no fetch, no invoke, no dynamic import outside the bundle in the new modules — covers invariant 15.

## Parallelization

Single agent, sequential. The engine modules have internal order (map before resolve, resolve before surface) and the surface is one coherent Svelte component; splitting across agents would add merge cost with no wall-clock gain.

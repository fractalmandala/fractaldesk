---
title: Surface Architecture Implementation
description: Implementation of surface contract, registry-driven shell, and argv/themes/schemes/sassy/untw migrations (Gates 0–5).
created: 2026-09-11
updated: 2026-09-11
type: worklog
status: open
---

## Instruction

Orchestrate tasks and their completion till the first gate, per the surface architecture specs (product.md + tech.md). Gate 0 establishes the typed contract, registry, shell-only store, bus, and registry-driven shell. Gate 1 migrates argv to surfaces/argv/ and fixes P24.

Task agent: Qoder default (Efficient auto model)
Auditor agent: Kimi-2.7-Code

## Log

- **2026-09-11** — Orchestration initiated. Tasks written to WORK-TRACKER.md for Gate 0 and Gate 1. Worklog created.
- **2026-09-11** — Gate 0 implemented, pending evaluation.
  - Created `src/lib/surface.ts` — typed Surface contract (ShellState + Surface interfaces).
  - Created `src/lib/bus.ts` — minimal typed pub/sub (on/emit, Map-backed).
  - Created `src/lib/store.svelte.ts` — shell-only state (view, busy, msg, kind, say). Replaces `store.svelte.js`.
  - Created `src/lib/themes-state.svelte.ts` — temporary adapter for Themes-specific state (doc, schema, cur, file, dirty, dir, vsix, theme, eff, recents, remember).
  - Created `src/lib/schemes-state.svelte.ts` — temporary adapter for Schemes list.
  - Created `src/lib/argv/state.svelte.ts` — extracted Argv shared state (argv object, dirty/usage/diags/errors as functions, reset/saveSpec/loadSpec).
  - Created `src/lib/surfaces/registry.ts` — typed REGISTRY array with all 5 surfaces, toolbars, and Themes load hook.
  - Created `src/lib/states.ts` — backward-compat re-export of REGISTRY as STATES.
  - Created toolbar components: `ThemesToolbar`, `ArgvToolbar`, `SassyToolbar`, `UntwToolbar` (Schemes has none).
  - Rewrote `src/routes/+page.svelte` — fully registry-driven shell, no surface-specific imports or dispatch chains.
  - Updated `ArgvBench.svelte` to use `argv/state.svelte.js` shared state.
  - Updated `ThemesSurface.svelte`, `Sidebar.svelte`, `RoleTable.svelte`, `WorkbenchTable.svelte`, `Mock.svelte`, `ColorCell.svelte`, `ColorPicker.svelte`, `SchemeBrowser.svelte` to import from new state modules.
  - Deleted old `store.svelte.js` and `states.js`.
  - Fixed pre-existing SASS corruption in `app.sass` (duplicate garbled .btn block at lines 241–262).
  - `pnpm check`: 0 errors, 0 warnings.
  - `pnpm build`: succeeds.
  - Validation greps pass (no dispatch chains in +page.svelte, no forbidden fields in store.svelte.ts, no surface-specific imports in +page.svelte).

- **2026-09-11** — Gate 0 audit fix iteration (Issues §1 CRITICAL, §2 MAJOR).
  - **CRITICAL fix (§1):** `+page.svelte` now imports `themes` from `$lib/themes-state.svelte.js` and checks `themes.doc` directly for the loading/error placeholder guard and the `wide` derivation. The old `!current?.toolbar` check was structurally dead because `current.toolbar` is always a truthy component reference. Now `wide` correctly resolves to `!themes.doc` for Themes (full-width while loading, sidebar once loaded), and the placeholder (`Loading…` / `Couldn't open…` + Retry) is reachable on startup before the async load completes.
  - **MAJOR fix (§2):** Added `<script lang="ts">` to all 4 toolbar components: `ThemesToolbar.svelte`, `ArgvToolbar.svelte`, `SassyToolbar.svelte`, `UntwToolbar.svelte`. Added explicit type annotations in `ThemesToolbar.svelte`: `KeyboardEvent` for the keydown handler, `invoke<string>()` generic for all Tauri invoke calls returning strings.
  - **MINOR (§3):** Bus unit test skipped — no test runner (vitest/jest) configured in the project.
  - `pnpm check`: 0 errors, 0 warnings.
  - `pnpm build`: succeeds.

- **2026-09-11** — Gate 1 implemented, pending evaluation.
  - Created `src/lib/surfaces/argv/` folder with full surface contract structure.
  - Converted all `.js` helpers to typed `.ts`: `spec.ts` (with `Spec`, `Pkg`, `Command`, `Arg`, `Opt` interfaces), `help.ts`, `diagnostics.ts`, `parse.ts` (with `ParseResult` interface), `generate.ts`.
  - Moved `state.svelte.ts` into `surfaces/argv/` — the single shared state module for both Toolbar and Surface body.
  - Created `Surface.svelte` (from `ArgvBench.svelte`), `Toolbar.svelte` (from `toolbars/ArgvToolbar.svelte`), `ArgvTree.svelte`, `ArgvEditor.svelte`, `ArgvOutput.svelte` — all with `<script lang="ts">` and type annotations.
  - Created `surfaces/argv/index.ts` exporting `argvSurface` conforming to the `Surface` contract, with `load: loadSpec` hook.
  - Updated `surfaces/registry.ts` to import `argvSurface` from `./argv` instead of old `ArgvBench` + `ArgvToolbar` locations.
  - P24 fix verified: `saveSpec()` calls `invoke('argv_save')` (not Themes' `invoke('save')`); `reset()` is defined in the shared state and wired to the Toolbar's Reset button.
  - The Toolbar and Surface both import from `./state.svelte.js` — one shared reactive module.
  - Deleted old files: `ArgvBench.svelte`, `ArgvTree.svelte`, `ArgvEditor.svelte`, `ArgvOutput.svelte`, `toolbars/ArgvToolbar.svelte`, and the entire `argv/` folder.
  - `pnpm check`: 0 errors, 0 warnings.
  - `pnpm build`: succeeds.
  - Grep confirms no imports from old `argv/` paths or deleted component names remain anywhere in the project.

- **2026-09-11** — Gate 0 auditor verdict: **completed**. Gate 1 auditor verdict: **completed**. Orchestration through the first gate (Gate 0 + Gate 1) is done. Sprint report created at `docs/sprints/surface-architecture-impl.md`. Gates 2-5 remain pending.

- **2026-09-11** — Gate 2 implemented, pending evaluation.
  - Created `src/lib/surfaces/themes/` following the argv pattern: `index.ts` (exports `themesSurface: Surface`), `Surface.svelte` (from `ThemesSurface.svelte`), `Toolbar.svelte` (from `toolbars/ThemesToolbar.svelte`), `state.svelte.ts` (from `themes-state.svelte.ts` plus all persistence actions), and moved `Sidebar.svelte`, `RoleTable.svelte`, `WorkbenchTable.svelte` (imports repointed to `./state.svelte.js`).
  - `surfaces/themes/state.svelte.ts` is now the single Themes state module: the `themes` reactive object (doc, schema, cur, file, dirty, dir, vsix), `theme()`, `eff()`, and the actions `load()` (the former registry `loadThemes`; still seeds the schemes collection via `invoke('schemes')` → `schemesStore` exactly as before — known cross-surface touch, revisited in Gate 3), `save()`, `build()`, `packageVsix()`, `reveal()`. `$state.snapshot` kept for all invoke payloads; Rust command names unchanged (load, save, build, package, reveal, schemes).
  - `recents` + `remember` moved out of the Themes adapter into a shared `src/lib/recents.svelte.ts` (the picker is reached from Schemes too, via ColorCell); ColorPicker/ColorCell imports repointed; nothing recents-related remains in the Themes surface module.
  - `surfaces/themes/Surface.svelte` now owns its loading/error placeholder internally: when `!themes.doc` it shows `Loading…` while `app.busy`, else `Couldn't open the theme data.` + Retry (wired to the surface's own `load`); the `.blank` styles moved into this component and were removed from the shell. The shell body no longer has any surface-specific branch — it always renders `<Body />` for a known surface.
  - Surface contract extended minimally: optional `fullWhileLoading?: () => boolean` on `Surface` — when it returns true, the shell renders the surface full-width even though `full` is false (the loading/error placeholder needs the width to centre in). Chosen mechanism: `themesSurface.fullWhileLoading = () => !themes.doc`; the shell's generic `wide` derived calls it inside the `$derived` expression, so Svelte tracks the `themes.doc` read through the call and re-widens once the document loads (same tracking mechanism the pre-Gate-2 shell used when it read `themes.doc` directly in `$derived`). No other contract changes.
  - `surfaces/registry.ts`: imports `themesSurface` from `./themes` (field-by-field, matching the argv entry style); `loadThemes` deleted; the registry no longer imports `invoke`, the store, or any adapter state — only surface modules remain.
  - `+page.svelte`: removed the `themes` import entirely — the shell holds zero surface-specific imports; `wide` is now generic (`current.fullWhileLoading?.() ?? false || current.full`, picker fallback full-width).
  - Shared importers repointed: `SchemeBrowser.svelte` → `$lib/surfaces/themes/state.svelte.js` (temporary direct cross-surface dependency: its import action writes Themes' doc/cur/dirty and sets `app.view`; behaviour preserved, noted in a comment, to be rerouted through the event bus in Gate 3); `Mock.svelte` → Themes state from the new location; `ColorCell.svelte`/`ColorPicker.svelte` → `$lib/recents.svelte.js`. Mock/ColorCell/ColorPicker stay in `$lib` (shared, non-surface).
  - Deleted: `ThemesSurface.svelte`, `Sidebar.svelte`, `RoleTable.svelte`, `WorkbenchTable.svelte`, `themes-state.svelte.ts`, `toolbars/ThemesToolbar.svelte`. Moved files were normalized to single-tab indentation per AGENTS.md while moving (no content/behaviour changes beyond the documented ones).
  - Validation: `pnpm check` 0 errors / 0 warnings; `pnpm build` succeeds. Greps: `themes-state` 0 matches in src/; old paths (`ThemesSurface`, `toolbars/ThemesToolbar`, `'./Sidebar'`, `'./RoleTable'`, `'./WorkbenchTable'`) 0 matches outside `surfaces/themes/`; `+page.svelte` 0 `themes` matches (case-insensitive); `registry.ts` 0 `invoke` matches; `store.svelte.ts` still shell-only (view/busy/msg/kind + say).

- **2026-09-11** — Gate 3 implemented, pending evaluation.
  - Created `src/lib/surfaces/schemes/` following the argv/themes pattern: `index.ts` (exports `schemesSurface: Surface` — `full: true`, component + load, NO toolbar — Schemes contributes nothing to the header), `Surface.svelte` (from `SchemeBrowser.svelte`), `state.svelte.ts` (schemes collection state + load action), `mapping.ts` (from `schemes.js`, converted to typed TS with a `Scheme` interface for the record shape the helpers consume).
  - `surfaces/schemes/state.svelte.ts` is the surface's own state: `schemes = $state({ list: [] as any[] })` (object-wrapper pattern preserved; `any[]` kept until the scheme record shape is typed on the Rust side — same status as Themes' `doc: any`) and `load()` — `invoke('schemes')` with the read-failure fallback to an empty list preserved exactly (P23). The collection now loads when Schemes first becomes active via the shell's load-on-first-activation hook (same as argv's loadSpec); Themes' `load()` no longer seeds it.
  - KEY CHANGE — import-to-Themes rerouted through the event bus (P13, P18–P20). `saveAsNew()` in `surfaces/schemes/Surface.svelte` computes everything from its own data (proposed name, family, tag `` `${system} import` ``, thesis `Imported from X and Y.`, light/dark palette copies, `toSemantic` pair) and `emit('themes:import-pair', payload)`. Zero themes-state writes remain in the Schemes surface (grep-verified).
  - Bus event contract: `themes:import-pair` payload = `{ name: string` (proposed; deduped by the consumer), `family: string` (may be `''` — Themes resolves the first-family fallback), `tag: string`, `thesis: string`, `light: Record<string,string>`, `dark: Record<string,string>`, `semantic: { light, dark }` }`. The consumer (`importPair` in `surfaces/themes/state.svelte.ts`, exported alongside the `ImportPairPayload` interface) performs exactly the old themes-side work: name dedup (`"name 2"`, `"name 3"`…), family fallback `family || Object.keys(themes.doc.families)[0]`, push in the exact canonical field order (name, family, tag, thesis, light, dark, semantic), `themes.cur = themes.doc.themes.length - 1`, `themes.dirty = true`, `app.view = 'themes'`.
  - Toast placement nuance (deviation from the dispatch text, flagged for the auditor): the `added "…" — save to write it to palettes.json` say lives in `importPair`, not in the Schemes producer, because the message must carry the final deduped name and dedup happens consumer-side — a producer-side toast would change the message text whenever a name collision occurred, violating the P23 exact-message invariant. Observable behaviour is identical to the pre-bus flow in every case.
  - Subscription placement: `bus.on('themes:import-pair', importPair)` is registered ONCE at module scope of `surfaces/themes/state.svelte.ts`. Rationale (P19 nuance): the Themes surface COMPONENT is unmounted while Schemes is active, so a mounted-component subscription would miss the event; the state module is an app-lifetime singleton, so the subscription can neither leak nor double-fire. The P19 unsubscribe rule applies to mounted components — this is the documented, sanctioned exception. The handler is thin: the subscription delegates straight to `importPair`.
  - Null-doc guard: if `themes.doc` is null when the event arrives (unreachable today — Themes loads at startup, before Schemes can fill its pair form), `importPair` no-ops safely with a 'bad' status message instead of crashing. Chosen: message + no-op over a silent no-op, so the user action is never silently lost.
  - Remaining read-only dependency (flagged for the auditor): the Schemes pair form still reads Themes state directly for data it needs BEFORE any emit — family options (`themes.doc.families`), the light/dark prefixes (`themes.doc.meta.lightPrefix/darkPrefix`), and the role list (`themes.doc.roles`) — plus the family-default `$effect`. The bus is a command channel, not a state store, so these form reads keep a single read-only `themes` import, marked with a comment in `surfaces/schemes/Surface.svelte`; a future shared schema module or payload snapshot can replace it. The WRITE path is fully bussed — that is the hard requirement of this gate.
  - Pre-task cleanups (Gate 2 audit): (a) `Mock.svelte` now carries a comment on its themes-state import marking it a shared presentational component reading Themes state (no behavior change); (b) `theme()` was grep-confirmed unused (0 matches in src/) and removed from `surfaces/themes/state.svelte.ts`.
  - Rust command names unchanged (`schemes`, `load`, `save`, `build`, `package`, `reveal`, `argv_save`, `argv_load`); `invoke('schemes')` moved from themes' load into schemes' own load. `color.js` stays in `$lib` (shared by the themes surface components, ColorPicker, ColorCell, and the Schemes surface). `schemes.js` helpers were grep-confirmed SchemeBrowser-only, so the file moved (no re-export shim needed).
  - Validation: `pnpm check` 0 errors / 0 warnings; `pnpm build` succeeds. Greps: `schemes-state|SchemeBrowser|'./schemes.js'|'$lib/schemes.js'` 0 matches in src/; `themes.doc.themes.push|themes.cur =|themes.dirty =` 0 matches in surfaces/schemes/ (write path bus-only); `SchemeBrowser|schemesStore` 0 matches in registry; `invoke('schemes')` 0 matches in themes state; `store.svelte.ts` still shell-only (view/busy/msg/kind + say). Registry `schemes` entry field-copies like themes/argv (audit rec #3 spread remains open).

- **2026-09-11** — Gate 4 implemented, pending evaluation.
  - Pre-task cleanups (Gate 3 audit findings):
    - **Shared read-only domain-meta module:** created `src/lib/palette-meta.ts` exporting plain functions `families()`, `prefixes()`, `roles()` that read the themes document internally — reactivity flows through the call sites (same pattern as argv's `usage()`). Each is guarded for a null `themes.doc` with an empty fallback of the same shape (`{}`, `{ light: '', dark: '' }`, `[]`); the null case never occurs at runtime (Themes loads at startup). `surfaces/schemes/Surface.svelte` now imports from `$lib/palette-meta.js` — the Schemes surface ends with ZERO themes imports (grep-verified: 0 matches for `themes` in `surfaces/schemes/`). Comment added in `surfaces/themes/state.svelte.ts` noting the shared projection lives in `palette-meta.ts`.
    - **Bus event contract:** created `src/lib/events.ts` declaring `IMPORT_PAIR = 'themes:import-pair'` and the `ImportPairPayload` interface (moved verbatim — doc comment intact — from `surfaces/themes/state.svelte.ts`). The producer emits `emit<ImportPairPayload>(IMPORT_PAIR, …)` so the payload literal is compile-checked against the contract; the consumer's `importPair(payload: ImportPairPayload)` signature uses the same imported type. No string-literal duplication — grep confirms the literal exists only in `events.ts`.
    - **Producer script language note:** carrying `emit<ImportPairPayload>(…)` and `import type` in the producer required `<script lang="ts">` on `surfaces/schemes/Surface.svelte` (previously plain JS per the Gate 2/3 "loose components stay JS" status). The conversion needed only local annotations — a `Slot` type, parameter types, non-null assertions on the truthiness-guarded `slots[kind]`/`slots[editing]` reads, and `Object.entries<string>` — because the loosely-typed `schemes.list` remains `any[]` (Rust-side typing still deferred, same as before). No behavior change; runtime output identical.
    - **HMR guard:** the module-scope subscription is now captured (`const unsubImportPair = on<ImportPairPayload>(IMPORT_PAIR, importPair)`) with `if (import.meta.hot) import.meta.hot.dispose(() => unsubImportPair())` — prevents double registration when Vite hot-reloads the themes state module in dev (Gate 3 audit Issue 2; production unaffected).
    - **Registry spread:** the themes/schemes/argv entries now spread their surface exports (`{ ...themesSurface }` style) instead of field-copying (Gate 3 audit recurring Issue 5); the sassy entry ships as a spread with this migration; untw stays an inline literal until Gate 5.
    - **states.ts shim:** grep found zero importers of `$lib/states` / `./states` (the shell imports REGISTRY directly) — deleted `src/lib/states.ts`.
  - Main migration — sassy → `src/lib/surfaces/sassy/` (flattened, matching the argv/themes shape):
    - `index.ts` — exports `sassySurface: Surface` (id `sassy`, label `Sassy`, `full: true`, component + toolbar; NO load hook — no persistence declared, per product spec P15/P16: `runOnDisk` stays a user-triggered toolbar action, not a load hook).
    - `Surface.svelte` — from `src/lib/ConvertSurface.svelte` (panes, line-number gutters, error/report views preserved).
    - `Toolbar.svelte` — from `src/lib/toolbars/SassyToolbar.svelte` (direction chips, Convert, Copy with copied feedback, On disk…; imports `./state.svelte.js`, `./paste.js`, `./disk.js`); disabled states identical.
    - `state.svelte.ts`, `convert.ts`, `cssToSass.ts`, `disk.ts`, `paste.ts`, `types.ts`, `util.ts` — from `src/lib/sass/*`; internal relative imports fixed for the flatten (`../../store.svelte.js`, `./convert.js`, `./util.js`, `./types.js`, `./cssToSass.js`) and `.js` extensions normalized per repo convention.
    - `converttabs.sass` — orphan fixture moved as-is (grep-verified zero importers before and after; NOT deleted — it belongs to the surface's toolset and Gate 5/untw tooling may reference it).
    - Moved files were normalized to single-tab indentation while moving (Gate 2 precedent; no content changes beyond imports/comments). `util.ts`'s ANSI regex carried a raw ESC control byte; rewritten as the equivalent visible escape `\x1b` (identical regex semantics).
    - Rust command names unchanged and verified against `src-tauri/src/lib.rs`: `pick_paths`, `convert_scan`, `convert_write`, `read_text` — frontend-only move (P25 constraint).
    - Registry: imports `sassySurface` from `./sassy`; the `ConvertSurface` and `SassyToolbar` imports are removed. The registry now imports only surface modules (argv, themes, schemes, sassy) plus the not-yet-migrated untw component + UntwToolbar (Gate 5).
    - Deleted: `src/lib/ConvertSurface.svelte`, `src/lib/toolbars/SassyToolbar.svelte`, the entire `src/lib/sass/` folder, `src/lib/states.ts`.
  - Validation:
    - `pnpm check`: 0 errors, 0 warnings. `pnpm build`: succeeds.
    - Greps: old sassy paths (`ConvertSurface|toolbars/SassyToolbar|from './sass(/|')|from '../sass(/|')|$lib/sass|lib/sass`) 0 matches in src/ (note: the task's literal grep pattern `from './sass` also matches the new `from './sassy'` registry import — a word-boundary version was used for the real check); `themes` in `surfaces/schemes/` 0 matches; states-shim importers 0; `themes:import-pair` literal only in `events.ts`; registry entries are all spreads except the untw inline literal; `store.svelte.ts` still shell-only (view/busy/msg/kind + say).
  - Status: implemented, pending evaluation.

- **2026-09-11** — Gate 5 implemented, pending evaluation.
  - Pre-task cleanups (Gate 4 audit):
    - **Fixture restore (Issue 1 / Rec 1):** the trailing `.btn` block dropped from `surfaces/sassy/converttabs.sass` in the Gate 4 move is restored from `git show HEAD:src/lib/sass/converttabs.sass` (original lines 54–58: blank line, `flex: 1`, `padding: 6px 4px`, `font-size: var(--text-xs)`, `letter-spacing: .04em`), normalized to single-tab — the moved fixture now matches the complete original content. Still zero importers before and after.
    - **Declaration of the Gate 4 leftover (Issue 3 / Rec 3):** `untw/state.svelte.ts` (then at `src/lib/untw/state.svelte.ts`) received a comment-only fix updating the stale `src/lib/sass/state.svelte.ts` cross-reference to `surfaces/sassy/state.svelte.ts`; it was not logged at the time — declared here.
    - **Further stale-comment sweep, all comment-only and declared:** `surfaces/untw/state.svelte.ts` header updated (controls live in `surfaces/untw/Toolbar.svelte`, panes in `Surface.svelte` — the old text said `+page.svelte` / `UntwSurface.svelte`); `tools/untw/generate-map.mjs` header run-command path fixed (`src/lib/untw/tools/generate-map.mjs` → `tools/untw/generate-map.mjs`).
  - Main migration — untw → `src/lib/surfaces/untw/` (flattened, matching the other surfaces):
    - `index.ts` — exports `untwSurface: Surface` (id `untw`, label `Untw`, `full: true`, component + toolbar).
    - **LOAD HOOK DECISION (P16): NO `load` hook declared.** Inspected `state.svelte.ts` and `Surface.svelte` for mount-time/startup loading: zero `$effect` calls, zero Tauri `invoke`s anywhere in the folder (grep-verified), no persistence of any kind. The only startup work is UI init — `state.svelte.ts` seeds `untw.input = SAMPLE` at module init — which is not a persistence load. A surface without persistence declares none (P16); the choice is documented in a comment in `index.ts`.
    - `Surface.svelte` — from `src/lib/UntwSurface.svelte`; markup, handlers, styles, and behavior byte-identical, only the three import paths changed (`./untw/state.svelte.js` → `./state.svelte.js`, `./untw/decode.js` → `./decode.js`, `./store.svelte.js` → `../../store.svelte.js`).
    - `Toolbar.svelte` — from `src/lib/toolbars/UntwToolbar.svelte` (Convert, Copy summary, Copy JSON; disabled states identical); same import-path fixes.
    - `state.svelte.ts`, `decode.ts`, `extract.ts`, `variants.ts`, `resolve.ts`, `theme.ts`, `categories.ts`, `fractal.ts` + `resolution-map.json` — moved as-is. The folder was already fully self-contained (every relative import is intra-folder), so no internal imports needed repointing; the existing extensionless intra-folder style was preserved exactly. `resolution-map.json` moved with `resolve.ts`, which imports it.
    - No Tauri command changes — untw invokes nothing (grep: zero `invoke` in `surfaces/untw/`; the only external imports are `../../store.svelte.js` for `say` and the `Surface` type) (P26; Rust untouched).
    - Registry: imports `untwSurface` from `./untw`; the `UntwSurface` and `UntwToolbar` imports removed. The registry now ends with ONLY surface-module imports — five entries, all spreads (`{ ...themesSurface }` … `{ ...untwSurface }`).
    - Deleted: `src/lib/UntwSurface.svelte`, `src/lib/toolbars/UntwToolbar.svelte`, the entire `src/lib/untw/` folder, and the now-empty `src/lib/toolbars/` directory.
  - Golden replay — CRITICAL:
    - `tools/untw/verify.ts` imports repointed: `../../src/lib/untw/resolve` → `../../src/lib/surfaces/untw/resolve`, `../../src/lib/untw/theme` → `../../src/lib/surfaces/untw/theme`. Grep confirms nothing else in `tools/untw/` imports src (`generate-map.mjs` mentions src only in a comment, fixed above).
    - Command (from the `verify.ts` header and the original untw worklog): `npx --yes tsx tools/untw/verify.ts` — **exact result: `golden: 78/78 match`, exit code 0 — byte-exact, bar met.**
  - Final conversions (tech spec follow-up: convert remaining non-surface `$lib/*.js` once every surface has migrated):
    - `src/lib/color.js` → `src/lib/color.ts` — typed (parameter/return annotations on `lum`, `ratio`, `isHex`, `grade`, `clamp`, `toRgb`, `fromRgb`, `hexToHsv`, `hsvToHex`, `hexToOklch`, `oklchToRgb`, `inGamut`, `oklchToHex`, `stepLightness`); function bodies and comments byte-identical. Importer list grepped first (full): `surfaces/schemes/Surface.svelte`, `surfaces/themes/Surface.svelte`, `surfaces/themes/RoleTable.svelte` (`'$lib/color.js'`), `ColorPicker.svelte`, `ColorCell.svelte` (`'./color.js'`). Importer statements intentionally left untouched: under the repo's established `.js`-extension import convention they resolve to `color.ts` exactly as `'./state.svelte.js'` resolves to `state.svelte.ts` (moduleResolution `bundler`; `pnpm check` 0/0 proves every one resolves). No stale or broken references.
    - `src/lib/samples.js` → `src/lib/samples.ts` — typed (`Sample` interface `{ active: number; lines: string[] }`, `SAMPLES: Record<string, Sample>`, `FILES: string[]`); sample data byte-identical. Sole importer `Mock.svelte` (same convention, untouched).
    - After this, `src/lib` root has ZERO `.js` files (`ls src/lib/*.js` → no matches).
  - AGENTS.md rewrite (P29): `## New Surface/Tab` rewritten to the registry+folder contract — adding a surface is exactly two steps: (a) create `src/lib/surfaces/<id>/` implementing the contract (`index.ts` exporting a `Surface` entry per `src/lib/surface.ts`, `Surface.svelte` body, optional `Toolbar.svelte`, `state.svelte.ts` for its `$state` + actions); (b) add `{ ...<id>Surface }` to `src/lib/surfaces/registry.ts`. States explicitly: **no edits to `+page.svelte` — ever**; the shell renders body + toolbar from the registry; persistence is the optional `load` hook invoked on first activation (a surface without persistence declares none); a `full: false` surface needing full width while loading implements `fullWhileLoading`; cross-surface needs go through the event bus (`src/lib/bus.ts` + contracts in `src/lib/events.ts`) — never by importing another surface's state module, never by widening the shell store; shared components/helpers live in `$lib`. The section notes it supersedes the old import-and-{:else if} workflow. Also fixed the stale example directly above the section (structure item 2 still named the deleted `themes-state.svelte.ts` / `schemes-state.svelte.ts` adapters — now points to `surfaces/<id>/state.svelte.ts`). README layout map updated accordingly (`toolbars/`, `UntwSurface.svelte`, `untw/` rows → `surfaces/untw/`; `samples.js`/`color.js` → `.ts`).
  - Validation:
    - `pnpm check`: 0 errors, 0 warnings. `pnpm build`: succeeds (SSR + client bundles, dist written).
    - Golden replay: `npx --yes tsx tools/untw/verify.ts` → `golden: 78/78 match` (exit 0).
    - Greps: old untw paths (`UntwSurface|toolbars/UntwToolbar|lib/untw/|'./untw/`) — 0 matches in `src/` + `tools/` outside `src/lib/surfaces/untw/` and `tools/untw/`; `src/lib/*.js` — 0 files; `color.js'|samples.js'` — exactly the 6 live importer statements, all resolving (see above); registry — 5 entries, only surface-module imports, all spreads; `store.svelte.ts` still shell-only (view/busy/msg/kind + say); `invoke` — 0 code matches in `surfaces/untw/`.
    - `+page.svelte` untouched by this gate: file hash identical before and after (`565ff931a7d45fb699d1683c61b8a22c6f498adc`). Note: `git diff HEAD -- src/routes/+page.svelte` is non-empty because the Gate 0 shell rewrite is still uncommitted (see status note below); the hash check isolates this gate's contribution as zero.
  - Status: implemented, pending evaluation. ALL FIVE GATES are now implemented but uncommitted — HEAD remains `ee2feae` and the whole refactor rides one working tree (Gate 4 audit Rec 2: committing approved gates individually, now spanning all five).

- **2026-09-11** — Gates 2–5 orchestration complete. Auditor verdicts: Gate 2 **completed** (clean pass), Gate 3 **completed** (2 judgment calls ratified; read-only meta follow-up closed in Gate 4 via palette-meta.ts), Gate 4 **completed** (cleanups verified), Gate 5 **completed** (golden replay 78/78 byte-exact re-run by auditor; AGENTS.md rewrite accurate). Full rollout Gates 0–5 auditor-approved. Sprint report updated at `docs/sprints/surface-architecture-impl.md`; audits gate2–gate5 in `docs/audits/`. Standing audit recommendation: commit the five gates as five commits — awaiting human instruction.

## Files

- [WORK-TRACKER.md](../../WORK-TRACKER.md) — task definitions
- [docs/specs/surface-architecture/product.md](../specs/surface-architecture/product.md) — product spec
- [docs/specs/surface-architecture/tech.md](../specs/surface-architecture/tech.md) — tech spec
- [docs/audits/surface-architecture-gate0.md](../audits/surface-architecture-gate0.md) — Gate 0 audit report
- [docs/audits/surface-architecture-gate1.md](../audits/surface-architecture-gate1.md) — Gate 1 audit report
- [docs/sprints/surface-architecture-impl.md](../sprints/surface-architecture-impl.md) — Sprint report
- [src/lib/surfaces/argv/](../../src/lib/surfaces/argv/) — migrated Argv surface folder (Gate 1)
- [src/lib/surfaces/themes/](../../src/lib/surfaces/themes/) — migrated Themes surface folder (Gate 2)
- [src/lib/surfaces/schemes/](../../src/lib/surfaces/schemes/) — migrated Schemes surface folder (Gate 3): `index.ts`, `Surface.svelte`, `state.svelte.ts`, `mapping.ts`
- [src/lib/surfaces/sassy/](../../src/lib/surfaces/sassy/) — migrated Sassy surface folder (Gate 4): `index.ts`, `Surface.svelte`, `Toolbar.svelte`, `state.svelte.ts`, `convert.ts`, `cssToSass.ts`, `disk.ts`, `paste.ts`, `types.ts`, `util.ts`, `converttabs.sass` (orphan fixture, moved not deleted)
- [src/lib/surfaces/untw/](../../src/lib/surfaces/untw/) — migrated Untw surface folder (Gate 5): `index.ts`, `Surface.svelte`, `Toolbar.svelte`, `state.svelte.ts`, `decode.ts`, `extract.ts`, `variants.ts`, `resolve.ts`, `theme.ts`, `categories.ts`, `fractal.ts`, `resolution-map.json` (no load hook — fully offline, no persistence, P16)
- [src/lib/color.ts](../../src/lib/color.ts) — shared WCAG/HSV/OKLCH colour maths, converted from `color.js` (Gate 5)
- [src/lib/samples.ts](../../src/lib/samples.ts) — shared editor preview samples, converted from `samples.js` (Gate 5)
- [src/lib/palette-meta.ts](../../src/lib/palette-meta.ts) — shared read-only projection of the palette document's domain metadata (families/prefixes/roles) (Gate 4)
- [src/lib/events.ts](../../src/lib/events.ts) — shared bus event contract: `IMPORT_PAIR` name + `ImportPairPayload` (Gate 4)
- [src/lib/recents.svelte.ts](../../src/lib/recents.svelte.ts) — shared recent-colours module used by ColorPicker via ColorCell (Gate 2)

## Deps and Installations

None yet.

## Learnings

- ES module `let` exports are read-only bindings — `$state` variables exported with `let` cannot be reassigned from importing modules. Solution: wrap state in `const` objects (`const themes = $state({...})`) so properties remain assignable.
- `import * as T` namespace imports also create read-only properties — use named imports or object imports instead.
- Svelte 5 prohibits exporting `$derived` values from `.svelte.ts` modules (`derived_invalid_export`). Solution: convert to plain functions that read `$state` — reactivity is preserved because Svelte re-runs render effects when state changes.
- `<svelte:component this={X}>` is deprecated in Svelte 5 runes mode — use `{@const C = X}<C />` instead.
- Svelte scoped CSS does not cross component boundaries — toolbar-specific styles (`.count`, `.dot`, `.chips`, `.chip`) must live in toolbar components, not the shell.
- Components previously in plain JS (no `lang="ts"`) should stay that way when their dependencies are loosely typed — adding `lang="ts"` cascades strict type errors.
- Vite/SvelteKit requires `.js` extensions on imports even for `.ts` and `.svelte.ts` source files (NodeNext module resolution). All cross-module imports in `surfaces/argv/` use `.js` extensions consistently.
- TypeScript narrows `number || ''` as `string | number` — explicit `String()` wrapping needed when a union with `string` is required.
- svelte-check enforces `noImplicitAny` inside `.svelte.ts` state modules even when the receiver is `any` — callback parameters like `(t) => t.name` need an explicit `(t: any)` annotation there, while plain-JS `<script>` components are not checked this way.

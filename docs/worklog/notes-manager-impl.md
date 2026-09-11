---
title: Notes Manager Implementation
description: Build the notes manager surface from approved product, design, and tech specs.
created: 2026-09-11
updated: 2026-09-11
type: worklog
status: completed
truth: Human approval in chat on 2026-09-11 — after the view-persistence fix landed green, user wrote: mark task "completed". Context: closing the notes-manager implementation task; remaining follow-ups (color presets, 3-way dialog, manual acceptance remainder, UI polish) live in the specs and stay open as future work.
---

## Instruction

User-approved specs at `docs/specs/notes-manager/` (product.md, tech.md); "Go" to
implementation given in chat on 2026-09-11 after tech approval. Build the Notes surface
per the spec set: multi-root folders, tree plus list plus raw/rich editor plus info
sidebar, spec-authoritative `file://` convention. Search specced but deferred from v1.

## Log

- Opened worklog; cloning survey repos (Typedown, Milkdown-Crepe reference) to temp for lane-b mount patterns.
- Survey complete. Three mount recipes extracted: (1) CodeMirror 6 direct-mount
  (`EditorState.create` + `new EditorView({state, parent})`, Typedown) — chosen over the
  `svelte-codemirror-editor` wrapper: fewer moving parts, full control of update/dirty/
  selection hooks, matches house library-free preference; (2) Milkdown Crepe wrapper
  pattern (`new Crepe({root, defaultValue})`, `editor.config`, `crepe.create()`,
  `markdownUpdated`, theme swap via raw-CSS `<style>` element, `:global` re-skin);
  (3) plain textarea fallback. Deviation from tech.md (wrapper-primary) recorded here.
- Lane a DONE: 13 confined commands (`notes_roots_list/add/remove`, `notes_scan`,
  `notes_read/write`, `notes_mkdir/rename/delete/new`, `notes_grep`,
  `notes_import_files`, `notes_watch_start` over a `notify` thread emitting
  `notes-changed`), hidden-sibling-tmp atomic writes, pure helpers
  (`notes_resolve_in`, `notes_merge_roots`, `notes_walk_capped`,
  `notes_unique_target`) with 8 cargo tests — full suite 32/32, fmt-clean in new
  code, diff purely additive (reverted `cargo fmt` churn in old sections).
  Design deltas from tech.md: server-side `notes_grep` (backlinks without N file
  reads; doubles as deferred-search foundation) and `notes_import_files` (context
  menu import/paste with ` - 2` collision suffix) added; watcher re-sends roots on
  every start call so the frontend refreshes it after root mutations.
- Contracts written and green: `src/lib/surfaces/notes/{links,stats,frontmatter}.ts`
  plus co-located vitest suites — 18/18 pass, `pnpm check` 0 errors. Fixed one real bug
  found by test (frontmatter split dropped the post-delimiter newline; split is now
  exactly invertible). Added `"test": "vitest run"` script.
- Pre-existing `pnpm check` warning in `surfaces/schemes/Surface.svelte` (unused CSS
  `main`) left untouched — out of scope.
- Lane b spike ACCEPTED: `RawEditor.svelte` (CodeMirror 6 direct mount: history,
  markdown mode, search-match highlight, tab/undo keymaps, house-token theme,
  external-value sync with echo guard, exported `gotoRange` line API and
  `insertSyntax`) and `CrepeEditor.svelte` (Crepe mount on `root`, config-time
  readonly, `markdownUpdated` round-trip with echo guard, capture-phase `file://`
  link intercept, frontmatter strip/reattach, leading-H1 suppression with raw-side
  edit path). `pnpm check` 0 errors, `pnpm build` succeeds (SSR-safe: editors mount
  in `onMount` only). Theme: common plus frame CSS with token-mapped `:global`
  overrides; dark re-skin rides the future `data-mode` toggle. No `?raw` imports
  (avoids vite/client type declarations); no Latex/math/mermaid deps (out of spec).
- Lane a extension: `notes_import_dir` (recursive copy, hidden-skip, collision
  suffix) plus `notes_copy_dir` helper with test; scan entries gained server-side
  `title`/`excerpt` (first heading plus two text lines, frontmatter-aware — a test
  caught frontmatter keys leaking into excerpts) so the note list renders with zero
  extra invokes. Suite now 34/34, fmt-clean.
- Lane c DONE: `types.ts`, `tree.ts` (nested model plus test), `state.svelte.ts`
  (roots/index/open-note/layout/sidebar state; explicit save plus 2s idle autosave;
  watcher listener with 400ms debounce; tree clipboard copy/cut-paste),
  `index.ts` plus registry entry, `Toolbar.svelte` (raw/rich toggle, save/revert),
  `FolderTree.svelte` (full invariant-15 context menu), `NoteList.svelte` (server
  titles/excerpts, mtime sort, dirty dots), `EditorPane.svelte` (view switch,
  structural formatting toolbar, frontmatter-or-H1 title), `InfoSidebar.svelte`
  (stats, outline, mentions, backlinks, metadata), `Surface.svelte` (canonical
  `.sidebar-left`/`.main-section`/`.sidebar-right` with scoped adaptations).
  `pnpm check` 0 errors, vitest 21/21, `pnpm build` succeeds.
- Hardening pass (self-review, all fixed): rename null-deref after menu close;
  awaited save-before-switch (was fire-and-forget under a re-read race); mid-flight
  keystroke save race (snapshot body, compare at completion, re-arm autosave);
  revert/refresh remounts via `rev` counter (rich view has no external sync);
  stale-text refresh on external change when clean (content-identity guard so own
  saves never remount); dirty-buffer protection on root removal; folder-scoped
  delete clearing; cut-paste-in-place no-op; non-markdown link notice; mentions
  refresh on every edit; Escape closes menus; `+ Note` header action.
- Deliberate canonical adaptations: `.main-section` becomes a flex row of two
  independently scrolling panes (canonical is a scrolling doc column);
  `.sidebar-left/right` forced visible when rendered with inline drag widths
  (canonical hides below lg/xl breakpoints); collapse is conditional render.
- Correction (same day, per review): the adaptations above are superseded. The
  surface composes `src/lib/components/AppMain.svelte` (snippets plus open/width
  props); instance styling composes registry vocabulary in markup
  (`surface`/`border-*`, `box`/`row`, `text-*`, `badge`/`pill`/`input`/`link`,
  `clamp-*`, `w-*`, `scroll-y`) with new `<style>` only for what has no
  vocabulary; instance classes ride parallel, never as wrappers. UI remainder
  handed to human.
- Column pass (same day, per directive): note list resizable (own drag lane,
  persisted `listW`) and collapsible; all three columns collapse out of layout
  with every toggle (Folders/List/Details pills) in the header toolbar via a
  shared `setCollapsed` action; in-surface collapse and restore-rail buttons
  removed; AppMain rail snippets unused (shell cleanup left to human).
- Open items for the user: rich-text color preset values (toolbar omits the two
  color groups pending presets); 3-way save/discard/cancel dialog (confirm() only
  offers save/stay; Revert covers discard); manual acceptance pass in the running
  app (empty states, picker, both editors, watcher, 1MB file, broken link).
- Shell fix (same day, reported): active surface never persisted — `store.svelte.ts`
  hardcoded `view: 'themes'`. Now restores from `fractaldesk:app:view` and saves on
  `beforeunload`; unknown values fall through to the shell picker, so no registry
  import (and its cycle) was needed. No `+page.svelte` change.
- Crepe dark-text fix (same day, reported): theme vars were mapped on the host
  scope while Crepe declares them on its own `.milkdown` root — closer scope won.
  Mapping moved onto `.milkdown` scope with specificity to spare, light plus
  OS-dark mirror. Removed the create-note success announcement on request
  (failures still report).
- Specs delivery 2026-09-11: tech.md brought to as-built (direct-mount CM decision,
  capture-phase link intercept, `notes_grep`/`notes_import_files`/`notes_import_dir`,
  server-side scan titles/excerpts, dialog-plugin picking, no `watch.ts`, no
  poll-on-focus, expanded state fields, corrected invariant refs); risks retired
  (Crepe) or kept (watcher floods); ssr:false runtime-proof lesson recorded
  permanent; follow-ups extended (color presets, 3-way dialog, findBacklinks
  cleanup). Product design rules gained the compose-first convention
  (registry vocabulary in markup; instance classes parallel, never wrappers) plus
  the explicit AppMain composition requirement with snippet contract.

## Files

- `docs/specs/notes-manager/product.md` (approved input)
- `docs/specs/notes-manager/tech.md` (approved input)
- `src/lib/surfaces/notes/links.ts`, `links.test.ts`
- `src/lib/surfaces/notes/stats.ts`, `stats.test.ts`
- `src/lib/surfaces/notes/frontmatter.ts`, `frontmatter.test.ts`
- `src/lib/surfaces/notes/RawEditor.svelte`
- `src/lib/surfaces/notes/CrepeEditor.svelte`
- `src/lib/surfaces/notes/types.ts`, `tree.ts`, `tree.test.ts`
- `src/lib/surfaces/notes/state.svelte.ts`, `index.ts`, `Surface.svelte`
- `src/lib/surfaces/notes/Toolbar.svelte`, `FolderTree.svelte`, `NoteList.svelte`
- `src/lib/surfaces/notes/EditorPane.svelte`, `InfoSidebar.svelte`
- `src/lib/surfaces/registry.ts` (notes entry), `README.md` (surface inventory)

## Deps and Installations

- `pnpm add @codemirror/{state,view,commands,language,lang-markdown,search}`
  `@lezer/highlight` `@milkdown/crepe@7.22.1` `@milkdown/kit@7.22.1`; `pnpm add -D vitest`
  (5.0.0); Cargo `notify = "8"` for the watcher.

## Learnings

- Estimate from the ecosystem and the author's own recipes first (paneforge,
  coredocs drag recipe); first-principles sizing skewed 5–10x on this stack.
- Registry vocabulary composes; `<style>` is the last resort. Specificity traps to
  re-check on sight: border-resetting bases (`.button.ghost`, `button.blank`)
  outrank edge utilities; `.button` color outranks `.text-*`; `ta-l` does nothing
  inside flex buttons (anonymous flex items) — compose `row xleft` instead.
- Study the defined classes before writing any declaration: `surface` beats
  `background: var(--bg-surface)`, `border-right` beats a hand-written partition,
  `relative`/`absolute`/`scroll-y`/`pill`/`badge`/`input`/`link`/`clamp-2`/`w-*`
  already exist. Trust them; layouts fall into place. When a need has no
  vocabulary (single-edge button borders, absolute offsets, pointer affordances,
  third-party internals), write the minimum and say why where it lives.
- `ssr: false` means build green proves nothing about runtime; screenshots against
  the real backend are part of delivery. The Tauri debug binary serves `devUrl`,
  so proof runs through `pnpm app`, never the raw binary.
- CSS custom properties resolve at the CLOSEST scope, not the loudest: Crepe
  declares its `--crepe-*` theme vars on its own `.milkdown` root, so mapping
  them from an ancestor host silently loses. Override third-party vars on the
  same scope the library declares them (with specificity to spare), never from
  above and never by fighting its selectors.

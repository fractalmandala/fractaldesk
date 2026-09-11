---
title: Notes Manager Tech Spec
description: Implementation plan for the notes manager surface, engines, and Rust folder commands.
created: 2026-09-11
updated: 2026-09-11
type: spec
---

## Context

The product spec (`product.md`) defines a Notes surface (state id `notes`): multi-root
folder tree, note list, raw plus rich-text editor, info sidebar, and a spec-authoritative
`file://` link convention. The design gate pins the shell to canonical markups
(`.sidebar-left`, `.main-section`, `.sidebar-right` in `src/lib/styles/_05_shells.sass`)
and tokens from `src/lib/styles/_00_tokens.sass`. This doc plans the build.

Current system, as inspected. Surfaces follow `src/lib/surface.ts`: `index.ts` entry
(id, label, `full`, component, toolbar, load) plus `Surface.svelte`, `Toolbar.svelte`,
and `state.svelte.ts` — see `src/lib/surfaces/argv/index.ts` for the minimal shape and
`src/lib/surfaces/sassy/disk.ts` for the Rust-invoke pattern with `say()` status
reporting. Shell-only state stays in `src/lib/store.svelte.ts`. The Rust backend
(`src-tauri/src/lib.rs`) exposes confined commands — `convert_scan`/`convert_write`
derive destinations from trusted scan output, writes go tmp-file plus rename, and
`pick_paths` wraps AppKit `NSOpenPanel` for files-and-folders selection; `read_text`
reads one arbitrary path. Capabilities (`src-tauri/capabilities/default.json`) grant
`core:default` plus `dialog:allow-open`. Dependencies (`package.json`) have no editor,
no markdown renderer, and no fs plugin today.

Recipe survey (Tauri plus SvelteKit markdown apps, ecosystem September 2026). Raw
editing: CodeMirror 6 through `svelte-codemirror-editor` (Svelte 5 native, `$state`
value binding, ~36k weekly downloads) — the same pairing ships in Typedown,
pal815/md-editor, and whatfontisthis/markdown-editor, all Tauri 2 plus SvelteKit plus
CodeMirror with files straight on disk, tabs, and session restore. Rich WYSIWYG:
Milkdown Crepe over ProseMirror — ethemdemirkaya/markdown-editor proves Tauri 2 plus
Svelte 5 plus Crepe with a raw toggle, outline panel, and ~5 MB bundle; Toril proves
Tauri plus Rust plus Milkdown with plain files shareable with any editor, atomic
tmp-plus-fsync-plus-rename saves, a file watcher, and session memory. Render-only
display: marked plus DOMPurify, as used by ethemdemirkaya for export rendering.
Svelte mounting for Crepe is hand-wired (`onMount` plus `use:action`, Milkdown
discussion #2247, `svelte-commonmark` example) — no first-party wrapper. Closest
structural cousin to this surface is Marko (Tauri plus Svelte, CodeMirror WYSIWYG,
sidebar dir tree, wiki links, tabs). Toril's roadmap order is adopted here as policy:
trustworthy (atomic saves, watcher coexistence) before clever (search, backlinks UI).

## Proposed changes

### New modules (frontend, `src/lib/surfaces/notes/`)

- `index.ts` — `{ id: 'notes', label: 'Notes', full: true, component, toolbar, load }`,
  following the argv entry shape. Registry entry appended in `surfaces/registry.ts`.
- `state.svelte.ts` — object-wrapped `$state`: roots (id, path, tree), notes index
  (path, title, excerpt, mtime, dirty), open note (path, text, view, selection),
  layout (collapse plus widths, persisted), sidebar data (stats, outline, mentions,
  backlinks), plus actions. Both body and toolbar import this module, never the shell store.
- `Surface.svelte` — composes the shared `src/lib/components/AppMain.svelte` shell
  (`sidebarLeft` / `children` / `sidebarRight` snippets for tree, note list plus
  editor, and info sidebar; `leftRail` / `rightRail` restore snippets; rail open
  state and drag widths through AppMain's `leftOpen` / `rightOpen` / `leftWidth` /
  `rightWidth` props) with notes-only scoped styling.
- `Toolbar.svelte` — pill view toggle, save state with dirty dot, revert; no search
  entry in v1 (the `SEARCH_ENABLED` flag stays exported for later).
- `tree.ts` — tree model over scan output: expand/collapse, greyed non-markdown rows,
  inline folder-error rows with remove/re-locate.
- `links.ts` — the `file://` resolver: workspace-root-relative resolution (root is the
  added folder containing the linking file), absolute `file:///` against the filesystem
  root, `#L10`/`#L10-L17` range parsing, broken-link detection. Pure functions, no I/O.
- `stats.ts` — word/character counts, reading time, task counts, outline extraction,
  outgoing mentions; plus a `findBacklinks` helper (tested; the state module resolves
  backlinks through `notes_grep` instead — single cleanup candidate, no behavior gap).
- `frontmatter.ts` — non-destructive split: raw bytes stay canonical for byte-identical
  save; rich view receives body-only plus frontmatter title with leading-H1 suppression.
- Watcher application, open-note freshness refresh, and tree clipboard live in
  `state.svelte.ts` (no separate `watch.ts`); the surface `load` hook owns first
  activation.

### Editor engines (decision, surveyed — as built)

- Raw view: CodeMirror 6 **direct-mounted** (`EditorState.create` plus
  `new EditorView`, Typedown recipe), not the wrapper named in the plan: fewer
  moving parts, full control of dirty/autosave/selection hooks. Exports `gotoRange`
  for `#L` jumps plus `insertSyntax`/`wrapSelection` for the toolbar.
- Rich view: Milkdown Crepe mounted hand-wired in a wrapper component. `file://`
  link interception is a capture-phase click handler, not a Crepe plugin; the
  toolbar writes markdown syntax through ProseMirror transactions (typed syntax
  converts via input rules). Frontmatter strip/reattach plus leading-H1
  suppression live in the wrapper; the suppressed H1 is immutable in rich view
  (raw edits it). The marked-plus-DOMPurify fallback was not taken.
- Spike accepted 2026-09-11 with the deviations above; screenshots in the worklog.

### New modules (backend, `src-tauri/src/lib.rs`)

Following the confined-command posture (destinations derived server-side, tmp-plus-rename
writes, per the `convert_write` precedent):

- `notes_roots_list` / `notes_roots_add(paths)` / `notes_roots_remove(path)` —
  registry JSON in the app data dir; add validates directories and dedupes.
- `notes_scan` — recursive tree per root: relative paths, sizes, mtimes, markdown
  detection by extension, **server-side title plus two-line excerpt** (frontmatter-aware);
  skips hidden names and `node_modules`; caps depth and entry counts with a truncation
  flag rather than failing. Missing roots report per-root errors, never fatal.
- `notes_read(path)` / `notes_write(path, body)` — both enforce containment inside an
  added root and reject everything else; write is hidden-sibling-tmp plus rename and
  reports bytes written for the dirty-marker lifecycle.
- `notes_mkdir`, `notes_rename`, `notes_delete`, `notes_new(path)` — same containment;
  delete is permanent and requires frontend confirmation (no trash dependency in v1);
  rename refuses occupied destinations; new refuses overwrites.
- `notes_grep(needle, markdown_only)` — server-side substring search with per-line
  excerpts, oversized-file skip, and hit caps; backlinks are one grep on the filename
  plus exact per-line resolve. Doubles as the deferred-search foundation.
- `notes_import_files(sources, dest_dir)` — copy with ` - 2` collision suffixes for
  context-menu import and clipboard paste (cut is copy plus delete-after-success).
- `notes_import_dir(source, dest_dir)` — recursive folder copy with hidden-skip.
- `notes_watch_start` / events — `notify` crate (new dependency), debounced in the
  watch thread, emitting created/deleted/renamed/modified; watcher lives while the
  app is open per invariant 8; every start call re-sends roots. Rescan-on-launch plus
  quiet clean-buffer refresh cover gaps; **no poll-on-focus** (plan-only, not built).
- No new capability entries: custom invoke commands need none; folder and file picking
  use the JS dialog plugin directly (the native `pick_paths` panel stays available).

### Data flow and ownership

Disk is canonical. Load hook restores roots plus layout, scans, and opens the last note.
Edits live in surface state (`selectedDir`, `openMtime`, `rev`, `pendingRange`, tree
clipboard alongside the planned fields); explicit save and 2s-idle autosave both call
`notes_write`; external changes arrive via watcher and never overwrite dirty buffers
(dirty wins, with a notice); clean buffers refresh from disk on mtime change with a
content-identity guard so own saves never remount editors. Backlinks resolve through
`notes_grep`; mentions compute locally; no sidecar database, honoring the Toril-derived
policy. Cross-surface needs, if any, go through `bus.ts`, never direct state imports.

### Tradeoffs

- Crepe plus ProseMirror weight (~200 KB+) versus a hand-rolled display: accepted for
  real WYSIWYG with markdown serialization; the fallback was not taken.
- `notify` watcher versus poll-only: watcher for live tree with rescan-on-launch and
  quiet clean-buffer refresh as backstops; watcher gaps remain a known failure mode,
  covered by tests plus manual steps.
- Containment-scoped writes versus plugin-fs: keeps the repo's confined-writes posture;
  every new command gets the same tmp-plus-rename and traversal-rejection treatment.

## Testing and validation

- Vitest suite (repo's first; `vitest` plus `test` script, 21 passing): `links.ts`
  resolver (invariants 24–26, 28 — relative, absolute, ranges, broken),
  `frontmatter.ts` non-destructiveness (16, 20), `stats.ts` counts plus outline plus
  task tallies (32), `tree.ts` nesting plus sorting.
- `cargo test` (34 passing): containment rejection including sibling-prefix and
  dot-dot escapes, tmp-plus-rename atomicity with no litter, scan skips plus
  truncation, registry dedupe, grep shape, import suffixing, directory copy,
  frontmatter-aware scan heads.
- Spike accepted 2026-09-11 with deviations above; runtime screenshots (raw editor,
  rich editor, tree, list, sidebar with stats plus mentions plus backlinks) in the
  worklog. **Lesson, kept permanent: `ssr: false` means `pnpm build` never executes
  app code — green build plus green tests do not prove the app runs; runtime proof
  (dev-mode screenshots against the real backend) is part of delivery.**
- Manual pass against product invariants, status 2026-09-11: empty states (5),
  missing-folder rows drill (9, code path — not clicked through), dirty-marker plus
  navigate-away prompt (21, code path), 1 MB read-only (22, code path), broken-link
  notice (26, code path), offline with only surveyed editor deps added (36);
  `pnpm check` zero errors, `pnpm build` succeeds, per repo gate custom. The
  click-through remainder (context menu, save flow, watcher live, large file, broken
  link) is the open acceptance list.
- Search invariants (29–30) validate when search ships; invariant 31 keeps it out of v1
  delivery and out of v1 testing.

## Parallelization

Contracts first, then fan out. One agent defines `links.ts` plus `stats.ts` plus
`frontmatter.ts` pure-function signatures (no dependents can start without these).
Then three parallel lanes: (a) Rust commands plus tests (owns `lib.rs` notes section,
`notify` wiring); (b) editor spike plus wrapper (owns engine deps, Crepe plugin,
CodeMirror binding); (c) shell chrome — tree, list, sidebars, toolbar (owns surface
folder UI, canonical markups only, mocked state). Merge point: state module wiring plus
save/watch lifecycle, then the manual validation pass. The deeper repo-level survey
(cloning Typedown and ethemdemirkaya/markdown-editor for mount patterns) belongs to
lane (b) at implementation time, not to this spec.

## Risks and mitigations

- Crepe mounting risk retired 2026-09-11 (mounts and round-trips in the webview);
  the marked-plus-DOMPurify fallback stays documented but unbuilt.
- Watcher event floods on large folders (user's own history shows folder-scale research):
  debounce plus scan caps; tree virtualizes if row counts exceed tested bounds.
- `file://` links colliding with OS handler expectations: links never leave the app;
  unknown schemes render inert, per the unsafe-protocol posture in existing surfaces.
- Scope creep toward Pinned/Collections/Connections/Quick Note: deferred by product
  invariants; the state module reserves no shapes for them.

## Follow-ups

- Search delivery (invariants 29–30) on top of `notes_grep`.
- Rich-text color preset values (toolbar omits both color groups pending presets).
- Three-way save/discard/cancel dialog (`confirm()` only offers save/stay; Revert
  covers discard for v1).
- `stats.findBacklinks` versus server-side resolve: pick one, remove the other.
- Pinned, Collections, Connections, Quick Note surfaces-through-time, per product Goals.
- Trash-safe delete, image paste-beside-document (both Toril-proven), global hotkey.

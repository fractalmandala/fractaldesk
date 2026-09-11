---
title: Notes Manager Product Spec
description: Product behavior for the multi-folder markdown notes manager surface in FractalDesk.
created: 2026-09-11
updated: 2026-09-11
type: spec
---

## Summary

Notes Manager is a new Fractaldesk surface (state id `notes`) that edits markdown notes
living in ordinary folders on disk. Folders are added by selection with no single-root requirement;
a folder tree, a note list, a raw/rich-text editor, and an info sidebar share one window.
Files on disk are the source of truth: the app reads and writes them in place and never
takes ownership of their contents.

## Goals

1. One installed surface replaces hopping between editors to tend working notes across many project folders.
2. The `file://` reference convention (inline links, line ranges, citations, section sources) is defined here, once, as the authority.
3. The v1 delivery cut is tree plus list plus editor plus info sidebar; search is specified below for the record but deferred from v1 delivery.

## Behavior

### Surface and layout

1. A surface named Notes appears in the header surface switcher alongside existing surfaces; selecting it shows the notes workspace.
2. The workspace has four regions: left folder/file tree, second note list, main editor, right info sidebar.
3. Every sidebar and the note list are collapsible and width-resizable by drag with pointer capture; collapse and widths persist across restarts and restore on launch. Collapsed columns leave the layout entirely (0-width end state); every column toggle lives in the header toolbar.
4. The surface uses only existing tokens and classes in the styles folder `src/lib/styles` with SASS single-tab indenting; no new font sizes, no DESIGN.md violations. The `app.sass` is incorrect and is gradually being replaced.

### Folders

5. With no folders added, the tree region shows an empty state with an add-folders action; there is no other content.
6. An add-folders action opens the native folder picker and adds each chosen folder as a separate tree root; the same folder cannot be added twice.
7. The added-folder list persists across restarts; on launch the surface restores the list and reads current contents from disk.
8. While the app is open, created, deleted, renamed, and modified files under added folders appear in the tree without relaunch; the open note refreshes its list row on external modification.
9. A folder that is missing or unreadable shows an inline error row with remove and re-locate actions; it never blocks the remaining roots.
10. Non-markdown files appear in the tree greyed and are not openable as notes in v1.

### Tree and note list

11. Each root expands to folders and `.md` files; expanding, collapsing, and row selection are keyboard-reachable.
12. A New Note action creates an empty `.md` file in the selected folder (or the first root when nothing is selected) and opens it for editing.
13. The note list shows one row per markdown note across all roots with title (first heading, else filename), a two-line content excerpt, relative path, and modified date; selecting a row opens the note.
14. A list filter narrows rows by title and content substring; clearing it restores the full list; no match shows an empty state.

### Context Menu

15. Right click context menu is maintained in the sidebars - copy, delete, paste, cut, rename, add file, add folder, import files here, import folder here, show in finder, copy relative path, copy absolute path. See image 'context-menu.png' - `docs/specs/notes-manager/context-menu.png`.

### Editor

16. The editor opens in raw markdown view: plain-text editing of the exact file bytes with no reformatting on open.
17. A view toggle switches the same note between raw markdown and rich-text display.
	- in rich text display, the YAML frontmatter of files is not displayed. The title from frontmatter is displayed. If these files have a beginning `#` H1 header also, do not display that since title is coming from YAML frontmatter.
	- in raw markdown view, YAML frontmatter is displayed as is.
18. The rich-text view renders headings, emphasis, lists, code, links, and citations; its formatting toolbar (bold, italic, lists, link, citation) inserts markdown syntax into the underlying text.
19. Formatting toolbar - bold, italic, underline, cutoff, color (preset values) for text, color (preset values text background),  link, h1, h2, h3, list bullet, list number, checklist, blockquote, code snippet. See image `rich-text-toolbar.png` -  `docs/specs/notes-manager/rich-text-toolbar.png`.
20. Unmodified files save byte-for-byte identical; saving writes only the current text.
21. Explicit Save (`Ctrl/⌘+S`) writes the file; unsaved edits show a dirty marker on the note row and tab; navigating away with unsaved edits asks to save, discard, or cancel.
22. Files larger than 1 MB open read-only with a notice instead of refusing to open.
23. Autosave after a short idle delay, and user can explicit save anytime also.

### `file://` reference convention

24. `[label](file://relative/path.md)` is a note link; relative paths resolve against the workspace root, which is the added-folder root containing the linking file; absolute `file:///…` paths resolve against the filesystem root.
25. `[label](file://path.md#L10-L17)` additionally selects lines 10–17 after opening; a single `#L10` selects one line; out-of-range lines open the note without selection.
26. Activating a note link opens the target note in the editor; a link whose target does not resolve renders with a broken style and activates to an inline notice, never a blank surface.
27. `<cite>…</cite>` blocks render as citations in the rich-text view and pass through untouched in raw view.
28. A `**Section sources**` list contains only `file://` links with line ranges; each entry jumps to its range on activation.

### Search

29. A workspace search matches note titles and file contents across all added folders and lists matches grouped by note with one excerpt line each; activating a match opens the note.
30. Search is case-insensitive substring match in v1; an empty query shows the recents-first note list, not an error.
31. It is very good to include this in specs right now, for record. But search is not part of v1 delivery expectation.

### Info sidebar

32. The info sidebar shows, for the open note: word count, character count, estimated reading time, task counts (`0 of 0 done` style from `- [ ]` / `- [x]` items), a clickable outline of headings, outgoing `file://` links (linked mentions), and backlinks computed across all added folders.
33. Sidebar sections collapse individually; an empty section (no tasks, no links, no backlinks) shows a one-line empty note, never a blank panel.
34. File metadata (created, modified, size) appears in a footer block.

### Failure and offline behavior

35. Unreadable files, removed folders, and failed writes surface inline messages naming the path; the surface never shows a blank screen for a filesystem error.
36. Everything runs fully offline with no network and no model; adding the surface adds no runtime dependency to the app.

## Design Specs

Product intent ends above; this section is the design gate between product and tech.
It records the shell wireframe, the design rules, and the token/variable definitions
the implementation must follow. Anything here that contradicts Behavior loses to Behavior.

### Shell wireframe

The surface body is a flex row of four regions (see `notes-manager-1.png`,
`notes-manager-2.png`, `notes-manager-3.png` at the repo root):

1. The app has a global header set to `var(--header-height)` (see `.app-header` in `_05_shells.sass`) and any surface must be set to height `calc(100vh - var(--header-height))`. Sidebars are also of this height, and must have scroll on overflow-y.
2. Left tree (default 280px): root-per-added-folder file tree, empty-state add action, inline folder error rows. This must use the `.sidebar-left` class from shells.sass file.
3. Note list (second column): filter input plus rows of title, two-line excerpt, relative path, modified date.
4. Editor (flex-1, `min-width: 0`, reading measure capped): raw mono textarea or rich-text display, view toggle and formatting toolbar above, dirty marker on the active row.
5. The note list and editor combined must be inside the class `.main-section` from shells.sass file.
6. Right info (280px): collapsible stat, outline, links, backlinks sections plus metadata footer. This must user the `.sidebar-right` class from shells.sass file.

**Canonical Markup**

```svelte
<aside class="sidebar-left">
</aside>
<section class="main-section">
	<div class="note-list box"></div>
	<div class="editor box"></div>
</section>
<aside class="sidebar-right">
</aside>
```

Shell composition MUST use `src/lib/components/AppMain.svelte`: the surface body
renders `<AppMain>` with `sidebarLeft` / `children` (note list plus editor) /
`sidebarRight` snippets. Rail open state and drag widths ride AppMain's `leftOpen` /
`rightOpen` / `leftWidth` / `rightWidth` props; collapsed rails render the surface's
`leftRail` / `rightRail` restore snippets. Surfaces must not re-author the
`app-main` / rail / `main-section` markup — instance styling only.

Header toolbar slot holds the view toggle, save state, column toggles (Folders, List, Details), and search entry; the shell chrome
itself (surface switcher, status line) is untouched. Context menu and rich-text toolbar
order follow `docs/specs/notes-manager/context-menu.png` and
`docs/specs/notes-manager/rich-text-toolbar.png`.

### Design rules

- Single-tab indented SASS; only `src/lib/styles` tokens and registry classes; no hardcoded font sizes, colors, or spacing; no new globals without a registry entry.
- Compose vocabulary in markup first (`box`/`row`, `text-*`, `badge`/`pill`/`input`/`link`, `clamp-*`, `w-*`, `scroll-y`, `surface`, `border-*`, `relative`/`absolute`): new `<style>` declarations only for what has no vocabulary (single-edge button borders, absolute offsets, pointer affordances, third-party internals), each justified where it lives.
- Instance classes on canonical elements ride parallel (beside `app-main`, never as wrappers above or below it), with the why recorded.
- Drag-resize: pointer capture on the handle, measurement against the container rect, clamped widths, inline width style while dragging with transitions disabled; persist on release.
- Collapse: conditional render plus x-axis slide transitions; collapse and width state lives in the surface state module and restores through the surface load hook.
- Type: `--font-sans` for both raw editor and richtext. Code snippets and text in backticks to use `--font-mono`; `--text-xs`/`--text-sm` for rows and meta.
- Overlays: context menu as popover at `--z-modal`; toasts at `--z-toast`; dialogs per the registry modal pattern.
- Modes: light default with `data-mode` dark support; rich-text view (code spans, citations, broken-link style) must stay legible in both.

### Tokens and variables (from `src/lib/styles/_00_tokens.sass`)

- Surfaces: `--bg` for editor, `--bg-surface` for left and right sidebars, `--bg-panel` for noteslist, `--bg-input`, `--bg-popover`.
- Text: `--text-primary`, `--text-secondary`, `--text-muted`, `--text-richtext`.
- States: `--state-hover`, `--state-hover-subtle`, `--state-selected`; accent `--theme-color`.
- Borders: `--border`, `--border-subtle`, `--border-strong`.
- Type scale: `--text-xs`, `--text-sm`, `--text-bs`; reading measure `--measure: 65ch`.
- Space: `--space-xs` through `--space-3xl` steps plus numeric literals; radius channels `--radius-sm`/`--radius-md` plus literals.
- Controls: `--control-h-sm`/`--control-h-md`; motion `--speed-1`/`--speed-2`/`--speed-3` with `--transout-*` easings.
- Layout defaults: `--sidebar-width: 280px`, `--toc-width: 280px`.
- Open: rich-text color preset swatch values; dirty-marker and broken-link treatments.

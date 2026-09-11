# FractalDesk

A macOS app for editing the Daylight & Lamplight palettes and cutting a `.vsix`.
Svelte 5 front end in a Tauri 2 shell — a 4.4 MB `.app`, no Electron, no browser tab.

```bash
pnpm install
pnpm app          # dev, with live reload
pnpm app:build    # -> src-tauri/target/release/bundle/
```

`pnpm app:build` produces `FractalDesk.app` and a `.dmg` beside it. Drag the app to
/Applications; it is unsigned, so the first launch needs right-click ▸ Open.

## How it fits together

The app **is** the theme project. It ships `palettes.json` and the scheme collection as
bundled resources and generates every theme file itself — the old `build.py` logic is ported
into Rust, so there is no Python at runtime and no folder to point it at:

```
FractalDesk.app
  ├─ resources/          palettes.json + schemes-spec-0.11 (read-only, in the bundle)
  ├─ app data dir/       palettes.json (seeded once, then edited + saved here)
  │                      themes/, package.json, nimbalyst/, dist/*.vsix (generated)
  ├─ generate            themes/*.json + package.json          (native Rust)
  └─ shells out to       vsce                                  -> dist/*.vsix
```

On first launch it seeds an editable copy of `palettes.json` into its own data directory
(`~/Library/Application Support/dev.fractalmandala.fractaldesk/`) and reads it back. Every
edit saves there, and Build writes the generated `themes/`, `package.json` and Nimbalyst
manifests alongside it. Nothing is read from or written to an external project folder.

The one external tool is `vsce`, invoked only by **Package .vsix**. It runs through
`/bin/zsh -lc` so the bundled app inherits the same `PATH` a terminal has — without that a GUI
app gets `/usr/bin:/bin:/usr/sbin:/sbin` and `npx` (and therefore `vsce`) is not found. So the
app needs `node`/`npx` present only when packaging, never for editing or building.

## The window

Sidebar lists every pair grouped by family, each with its light ground, dark ground and
accent. Selecting one shows both cousins as live editor mockups, the palette table with
per-role contrast, the workbench overrides, and the family's diagnostic colours.

- **Save** (`⌘S`) validates and writes `palettes.json`
- **Build** regenerates `themes/`, `package.json` and the Nimbalyst manifests (native Rust)
- **Package .vsix** builds, runs `vsce`, and offers **Reveal** to show the file in Finder
- The explorer file names swap the preview between TypeScript, JSON, CSS and Markdown

Save and Build are validated in Rust before anything touches disk: every colour must be
`#RRGGBB`, theme names must be unique, families must exist, and workbench overrides are
checked too. A bad edit is refused with a message rather than producing broken theme files.

The Rust generator is a faithful port: a `cargo test` fidelity check regenerates every theme
from the bundled `palettes.json` and asserts each file is byte-for-byte identical to what
`build.py` produced.

## Layout

```
src/
  app.html                SvelteKit document shell
  app.sass                global tokens and shared control styles
  app.d.ts                SvelteKit app types
  routes/
    +layout.svelte        imports app.sass, renders the page
    +layout.js            prerendered, no SSR (Tauri serves one static bundle)
    +page.svelte          registry-driven shell — chrome only, no surface imports
  lib/
    surface.ts            typed Surface contract (id, layout, component, toolbar, load)
    store.svelte.ts       shell-only $state: view, busy, msg, kind, say()
    bus.ts                cross-surface pub/sub; event contracts typed in events.ts
    events.ts             typed bus event contract (IMPORT_PAIR, ImportPairPayload)
    palette-meta.ts       shared read-only projection of the themes document meta
    surfaces/registry.ts  typed surface registry (themes, schemes, argv, sassy, untw, notes)
    surfaces/themes/      the Themes surface — state, editor, toolbar, tables
    surfaces/schemes/     the Schemes surface — state, browser, scheme mapping
    surfaces/argv/        the Argv surface — state, tree editor, toolbar, spec parser
    surfaces/sassy/       the Sassy surface — state, converter, paste, disk, toolbar
    Mock.svelte           the editor preview (shared presentational component)
    ColorCell.svelte      picker + hex field + inherit/pin state
    samples.ts            the four language samples
    color.ts              WCAG luminance and contrast
    surfaces/untw/        the Untw surface — offline decode engine (extract,
                          variants, resolve, map), toolbar, golden-replay tooling in tools/untw/
    surfaces/notes/       the Notes surface — multi-root markdown tree, list, raw (CodeMirror 6)
                          plus rich (Milkdown Crepe) editor, info sidebar, file:// links
src-tauri/src/lib.rs      commands: load, save, build, package, reveal, schemes, argv_*, notes_*
src-tauri/resources/      palettes.json + schemes-spec-0.11, bundled into the .app
```

`cargo test` covers the validator, the ported colour maths, the theme generator (including a
byte-for-byte fidelity check against the old `build.py` output), the scheme parser, the
shell quoting, and the notes containment/scan/write helpers — the places a bug would corrupt `palettes.json`, drift from the reference
themes, break on a path with an apostrophe in it, or escape the added-folders roots.

This app is its own pnpm root (`pnpm-workspace.yaml`) so it does not inherit the fractutils
workspace; plain `pnpm install` works from this folder.

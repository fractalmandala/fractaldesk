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
  App.svelte              window chrome, actions, layout
  app.sass                global tokens and shared control styles
  lib/
    store.svelte.js       $state store; `eff()` resolves override -> derived
    Mock.svelte           the editor preview
    RoleTable.svelte      the 15 core roles
    WorkbenchTable.svelte the 37 overridable surfaces
    ColorCell.svelte      picker + hex field + inherit/pin state
    Sidebar.svelte        theme list
    samples.js            the four language samples
    color.js              WCAG luminance and contrast
src-tauri/src/lib.rs      commands: load, save, build, package, reveal, schemes, argv_*
src-tauri/resources/      palettes.json + schemes-spec-0.11, bundled into the .app
```

`cargo test` covers the validator, the ported colour maths, the theme generator (including a
byte-for-byte fidelity check against the old `build.py` output), the scheme parser, and the
shell quoting — the places a bug would corrupt `palettes.json`, drift from the reference
themes, or break on a path with an apostrophe in it.

This app is its own pnpm root (`pnpm-workspace.yaml`) so it does not inherit the fractutils
workspace; plain `pnpm install` works from this folder.

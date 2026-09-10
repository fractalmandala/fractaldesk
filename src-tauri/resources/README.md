# Daylight & Lamplight

Thirty-four themes for VS Code: seventeen light (**Daylight**) and a dark cousin for each
(**Lamplight**). Every light ground is a true neutral white or stone and every dark ground a
neutral graphite — no sepia, no tinted greys, no hue on the surface. Four families, ordered
by how much colour they admit.

Cousins are not inversions. Each dark theme was built from its family's *rule* — hue budget,
role hierarchy, chrome-value axis — with grounds, accents and ink strengths re-picked for a
dark page. Bone's `#86B300` string would be sludge on graphite; its cousin uses `#AAD94C`.

Visual contact sheet: https://claude.ai/code/artifact/4d5f07ec-9fbc-479c-93e2-84dc614b9225

## The families

**Bone** — ground fixed at `#FCFCFC`, Ayu-derived hues. Variants move the *chrome value*
(how far the sidebar sits below the page) and the syntax temperature.

| theme | chrome | note |
|---|---|---|
| Bone | `#F3F4F5` | reference |
| Bone Contour | `#FCFCFC` | no chrome; hairline separation only |
| Bone Recessed | `#EAEBEC` | editor reads as a sheet on a desk |
| Bone Graphite | `#E4E6E8` | darkened until body text clears 7:1 — daylight |
| Bone Signal | `#F0F1F2` | orange keywords, all literals one blue |

**Newsprint** — ink at four strengths carries structure; hue goes to keywords *and* literals.
Variants change the accent: ink red, indigo, verdigris, olive (on a stone ground), and a
duotone that splits keywords from literals.

**Monoline** — ink at five strengths carries everything; the accent is spent **only on
strings and numbers**. Tags and functions sit darkest, keywords recede to mid grey,
punctuation goes pale. Variants: vermilion, cobalt, moss, plum, and ink (zero hue anywhere).

**Cold Front** — cool syntax against one warm keyword, on neutral stone chrome and a
colourless selection.

## Install locally

Either install the packaged extension —

```bash
code --install-extension dist/daylight-lamplight-2.0.0.vsix
```

— or symlink the folder so it follows your edits:

```bash
ln -s "$PWD" ~/.vscode/extensions/daylight-lamplight
```

Do one or the other, not both, or every theme appears twice. Reload, then pick from
**Preferences: Color Theme** (`⌘K ⌘T`). They appear as `Daylight <name>` and
`Lamplight <name>`, interleaved so each pair sits together in the list.

## The pipeline

`palettes.json` is the only source of truth. Everything else is generated:

```
palettes.json  ──build.py──▶  themes/*.json + package.json  ──vsce──▶  dist/*.vsix
```

```bash
python3 build.py                  # regenerate themes/ and package.json
python3 build.py --package        # ...then cut a .vsix into dist/
python3 build.py --bump minor     # 2.0.0 -> 2.1.0 first
```

Every theme shares one workbench mapping, so a change to a surface rule applies to all
thirty-four at once. Hand edits to `themes/*.json` are overwritten on the next build — edit
the palette instead. Deleting a theme from `palettes.json` removes its two files. The build
warns about any theme whose body text falls under WCAG AA on its own ground.

## Theme Studio

Two front ends, one pipeline. The macOS app is the main one; the Python server is the
dependency-free fallback.

```bash
open "studio-app/src-tauri/target/release/bundle/macos/Daylight Studio.app"
python3 studio.py --open      # fallback: same UI in a browser tab
```

`studio-app/` is a Svelte 5 + Tauri 2 app — see `studio-app/README.md`.
It reads and writes `palettes.json` directly and drives `build.py` for everything else, so
both front ends and the CLI produce identical output.

### The browser fallback

A local editor for the palettes, with live editor mockups, contrast readouts and one-click
packaging. No npm dependencies — Python standard library only, bound to loopback.

```bash
python3 studio.py --open
```

Pick a theme in the sidebar; both cousins preview side by side and repaint as you type.
**Save** writes `palettes.json`, **Build** regenerates `themes/`, **Package .vsix** does both
and runs `vsce`, optionally bumping the version first. `⌘S` saves; leaving with unsaved
changes warns.

The file names in the preview's explorer are live — click one to swap the sample between
TypeScript, JSON, CSS and Markdown, which exercise token rules the TypeScript sample never
touches (JSON keys, CSS selectors and units, Markdown headings and links). Both panes switch
together so the cousins stay comparable.

### Schemes

The **Schemes** tab browses the tinted-theming collection in `schemes-spec-0.11/`
(538 schemes — 338 base16, 196 base24, 4 tinted8) and turns any of them into a
Daylight pair. Search and filter by system or variant, click one to see its raw
slots and a live mockup of the mapped palette, then send it to the Daylight or
Lamplight slot. **Pair with …** fills both at once when the collection has an
obvious counterpart (`ayu-light` ↔ `ayu-dark`, `catppuccin-latte` ↔ `…-mocha`).

Mapped roles are editable before saving, with the source slot shown beside each
one, so `key ← base0E` and `str ← base0B` are visible rather than implied.
**Save as new pair** appends the theme to `palettes.json` and switches to the
editor, where it behaves like any other — build and package include it.

base16 numbers its slots by meaning, so most of the mapping is a rename; `border`
is the one blend (halfway between `base01` and `base02`, since base16 has no
hairline slot). tinted8 is an ANSI-8 terminal palette with no background /
foreground pair, so its ground comes from the variant and the mapping is an
interpretation rather than a rename.

Imported themes carry their own diagnostics: base16 defines error, warning,
success and info hues directly (`base08`/`base0A`/`base0B`/`base0D`), so a
`semantic` block on the theme overrides its family's set. Any theme can carry
one; absent, the family's is used as before.

### Workbench surfaces

The 15 core roles drive the syntax *and* the chrome: `sideBar.background` derives from `alt`,
`sideBar.foreground` from `fg`, borders from `border`, and so on. That keeps a palette small,
but the derivation is not always what the chrome wants — a sidebar often needs to sit apart
from the tab strip, or a border needs to be lighter than the one under the tabs.

The **Workbench** table exposes 37 of those surfaces individually. Each shows the value it
currently inherits, in muted italic; type a colour to pin it, and `×` restores inheritance.
Overrides live under a `ui` object inside the mode:

```json
"light": {
  "bg": "#FCFCFC",
  "alt": "#F3F4F5",
  "ui": { "sidebar.bg": "#EDEFF1", "tab.activeTop": "#111111" }
}
```

Absent keys inherit, so a theme with no `ui` object behaves exactly as it did before. The
list of overridable keys and what each derives from is `UI_KEYS` in `build.py`; the studio
reads it from `/api/schema`, so adding a surface there makes it appear in the UI with no
other change.

The diagnostics section at the bottom of each theme edits the *family's* error / warning /
git colours — shared by every theme in that family, so changing them there changes all of them.

## Nimbalyst

Nimbalyst is an Electron app, not a VS Code fork — no extension gallery, so a `.vsix` has
nothing to install into. It loads user themes as folders holding a `theme.json` manifest:

```
~/Library/Application Support/@nimbalyst/electron/themes/<id>/theme.json
```

```bash
python3 build.py --nimbalyst          # write them to ./nimbalyst for inspection
python3 build.py --install-nimbalyst  # write them straight into Nimbalyst
```

Its manifest is a 20-key semantic UI palette — surfaces, text ranks, states — with no
TextMate scopes at all, so this is a translation rather than an export. Surfaces come from
`bg`/`alt`/`sel`; the text ranks are `fg` blended toward the ground in steps; `accent` drives
primary, links and focus; and success / warning / error / info map straight across from the
family's diagnostic set. Steps are blended toward `fg`, which is the opposite pole in either
mode, so the same ratios give darker surfaces on a light theme and lighter ones on a dark one.

Restart Nimbalyst after installing — themes are discovered at startup.

## What's covered

Editor, gutter and minimap; sidebar, activity bar, tabs and breadcrumbs; status bar and
title bar; terminal (full ANSI set); diff editor and git decorations; peek view, hover,
suggest and quick-input widgets; bracket-pair colours; diagnostics and notifications.
Semantic highlighting is on, with `semanticTokenColors` mapped to the same palette as the
TextMate scopes.

Diagnostic colours (error / warning / info / git status) are deliberately *not* drawn from
the syntax palette — even in the monochrome families they stay hued, because a red squiggle
that reads as ink is a red squiggle you miss. Each family has its own diagnostic set per
mode, so Bone's errors are warmer than Newsprint's.

Overlay strengths (line highlight, scrollbar slider, list hover) are stepped up in the dark
set; the same alpha that reads as a gentle lift on white disappears on graphite.

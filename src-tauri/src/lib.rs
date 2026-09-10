#![recursion_limit = "1024"] // the theme's ~200-key json! expands deeply
//! Backend for FractalDesk.
//!
//! The app *is* the theme project: it ships `palettes.json` and the scheme
//! collection as bundled resources, seeds an editable copy of `palettes.json`
//! into its own data directory on first launch, and generates every theme file
//! itself. The theme generator is a direct port of the old `build.py` — no
//! Python at runtime. The one external tool is `vsce`, shelled out to only when
//! the user packages a `.vsix`.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Manager};

#[derive(Serialize)]
pub struct Loaded {
    palettes: Value,
    schema: Value,
    /// The writable data directory the app treats as the project root.
    dir: String,
}

#[derive(Deserialize)]
pub struct SaveArgs {
    doc: Value,
}

// ------------------------------------------------------------- data / bundle --

/// The app's own writable project root — read/write `palettes.json` and write
/// generated theme files here.
fn data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let d = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&d).map_err(|e| e.to_string())?;
    Ok(d)
}

/// A file shipped inside the app bundle (see `bundle.resources`).
fn resource(app: &AppHandle, rel: &str) -> Result<PathBuf, String> {
    app.path()
        .resolve(rel, BaseDirectory::Resource)
        .map_err(|e| e.to_string())
}

/// The editable `palettes.json`, seeded from the bundled copy the first time.
fn palettes_path(app: &AppHandle) -> Result<PathBuf, String> {
    let p = data_dir(app)?.join("palettes.json");
    if !p.exists() {
        let seed = resource(app, "resources/palettes.json")?;
        std::fs::copy(&seed, &p).map_err(|e| format!("could not seed palettes.json: {e}"))?;
    }
    Ok(p)
}

// --------------------------------------------------------------------- shell --

/// Single-quote a path for `zsh -lc`.
fn quote(s: &str) -> String {
    format!("'{}'", s.replace('\'', r"'\''"))
}

/// Run a command in a directory through a login shell, so a bundled .app gets
/// the same PATH a terminal has — without it `npx` (and so `vsce`) is missing.
fn shell(dir: &str, script: &str) -> Result<String, String> {
    let full = format!("cd {} && {}", quote(dir), script);
    let out = Command::new("/bin/zsh")
        .args(["-lc", &full])
        .output()
        .map_err(|e| format!("could not start a shell: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).to_string();
    let stderr = String::from_utf8_lossy(&out.stderr).to_string();
    if out.status.success() {
        Ok(format!("{stdout}{stderr}").trim().to_string())
    } else {
        Err(format!("{stdout}{stderr}").trim().to_string())
    }
}

// -------------------------------------------------------------------- colour --
// Ports of build.py's colour helpers. All maths, no dependencies.

fn hex_byte(h: &str, i: usize) -> f64 {
    u8::from_str_radix(h.get(i..i + 2).unwrap_or("00"), 16).unwrap_or(0) as f64
}

fn lum(h: &str) -> f64 {
    let mut v = [0f64; 3];
    for (n, i) in [1usize, 3, 5].into_iter().enumerate() {
        let c = hex_byte(h, i) / 255.0;
        v[n] = if c <= 0.03928 {
            c / 12.92
        } else {
            ((c + 0.055) / 1.055).powf(2.4)
        };
    }
    0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]
}

fn ratio(x: &str, y: &str) -> f64 {
    let (a, b) = (lum(x), lum(y));
    let (hi, lo) = if a >= b { (a, b) } else { (b, a) };
    (hi + 0.05) / (lo + 0.05)
}

/// Readable foreground for a filled control in this colour.
fn on(h: &str) -> &'static str {
    if lum(h) < 0.45 {
        "#FFFFFF"
    } else {
        "#1A1A1A"
    }
}

/// Append an alpha channel to a `#RRGGBB`.
fn al(h: &str, alpha: &str) -> String {
    format!("{h}{alpha}")
}

/// Blend hex `a` toward hex `b` by `t` (0..1).
fn mix(a: &str, b: &str, t: f64) -> String {
    let mut out = String::from("#");
    for i in [1usize, 3, 5] {
        let (ca, cb) = (hex_byte(a, i), hex_byte(b, i));
        let val = (ca + (cb - ca) * t).round().clamp(0.0, 255.0) as u32;
        out.push_str(&format!("{val:02X}"));
    }
    out
}

fn slug(n: &str) -> String {
    let mut s = String::new();
    let mut dash = false;
    for ch in n.chars() {
        let lc = ch.to_ascii_lowercase();
        if lc.is_ascii_alphanumeric() {
            s.push(lc);
            dash = false;
        } else if !dash {
            s.push('-');
            dash = true;
        }
    }
    s.trim_matches('-').to_string()
}

/// A string field from a JSON object, or "" when absent.
fn gs<'a>(v: &'a Value, k: &str) -> &'a str {
    v.get(k).and_then(|x| x.as_str()).unwrap_or("")
}

/// A per-theme workbench override (`ui.<key>`) with a derived fallback.
fn ov(p: &Value, k: &str, fallback: &str) -> String {
    p.get("ui")
        .and_then(|u| u.get(k))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| fallback.to_string())
}

// -------------------------------------------------------------------- schema --
// The overridable workbench surfaces: (key, group, label, derived-from). This
// was build.py's UI_KEYS / --schema output; the studio reads it to lay out the
// workbench table and resolve each surface's inherited value.
const UI_KEYS: &[(&str, &str, &str, &str)] = &[
    ("sidebar.bg", "Sidebar", "background", "alt"),
    ("sidebar.fg", "Sidebar", "foreground", "fg"),
    ("sidebar.border", "Sidebar", "border", "border"),
    ("sidebar.title", "Sidebar", "section header", "punct"),
    ("sidebar.headerBg", "Sidebar", "header background", "alt"),
    ("list.activeBg", "Sidebar", "selected row", "sel"),
    ("list.activeFg", "Sidebar", "selected text", "fg"),
    ("activityBar.bg", "Activity bar", "background", "alt"),
    ("activityBar.fg", "Activity bar", "active icon", "fg"),
    ("activityBar.inactiveFg", "Activity bar", "inactive icon", "punct"),
    ("activityBar.border", "Activity bar", "border", "border"),
    ("activityBar.activeBorder", "Activity bar", "active indicator", "accent"),
    ("tab.stripBg", "Tabs", "strip background", "alt"),
    ("tab.activeBg", "Tabs", "active background", "bg"),
    ("tab.activeFg", "Tabs", "active text", "fg"),
    ("tab.inactiveBg", "Tabs", "inactive background", "alt"),
    ("tab.inactiveFg", "Tabs", "inactive text", "punct"),
    ("tab.border", "Tabs", "border", "border"),
    ("tab.activeTop", "Tabs", "active top rule", "accent"),
    ("titleBar.bg", "Title bar", "background", "alt"),
    ("titleBar.fg", "Title bar", "foreground", "fg"),
    ("titleBar.border", "Title bar", "border", "border"),
    ("statusBar.bg", "Status bar", "background", "alt"),
    ("statusBar.fg", "Status bar", "foreground", "op"),
    ("statusBar.border", "Status bar", "border", "border"),
    ("gutter.fg", "Editor chrome", "line numbers", "punct"),
    ("gutter.activeFg", "Editor chrome", "active line number", "accent"),
    ("editor.lineHighlight", "Editor chrome", "current line", "bg"),
    ("editor.border", "Editor chrome", "split border", "border"),
    ("panel.bg", "Panel", "background", "bg"),
    ("panel.border", "Panel", "border", "border"),
    ("terminal.bg", "Panel", "terminal background", "bg"),
    ("terminal.fg", "Panel", "terminal text", "fg"),
    ("widget.bg", "Widgets", "background", "bg"),
    ("widget.border", "Widgets", "border", "border"),
    ("input.bg", "Widgets", "input background", "bg"),
    ("input.border", "Widgets", "input border", "border"),
];

fn schema_value() -> Value {
    let ui: Vec<Value> = UI_KEYS
        .iter()
        .map(|(k, g, l, d)| json!({ "key": k, "group": g, "label": l, "from": d }))
        .collect();
    json!({ "ui": ui })
}

// --------------------------------------------------------- theme generation --
// A faithful port of build.py's build(): one VS Code color-theme document from
// a palette `p` and a family/scheme semantic set `s`. serde_json is compiled
// with `preserve_order`, so the emitted key order matches the old output.

fn build_theme(p: &Value, s: &Value, kind: &str, label: &str) -> Value {
    let dark = kind == "dark";
    let ov_hi = if dark { "26" } else { "14" }; // line / range highlight
    let sld = if dark { "44" } else { "33" }; // scrollbar slider
    let hov = if dark { "26" } else { "1A" }; // list hover

    let bg = gs(p, "bg");
    let alt = gs(p, "alt");
    let bd = gs(p, "border");
    let fg = gs(p, "fg");
    let acc = gs(p, "accent");
    let sel = gs(p, "sel");
    let pun = gs(p, "punct");
    let cm = gs(p, "comment");
    // syntax roles
    let str_ = gs(p, "str");
    let typ = gs(p, "type");
    let fun = gs(p, "fn");
    let num = gs(p, "num");
    let op = gs(p, "op");
    let key = gs(p, "key");
    let prop = gs(p, "prop");
    // diagnostics
    let err = gs(s, "err");
    let warn = gs(s, "warn");
    let info = gs(s, "info");
    let okc = gs(s, "ok");
    let addc = gs(s, "add");
    let modc = gs(s, "mod");
    let delc = gs(s, "delete");

    let colors = json!({
        "focusBorder": acc, "foreground": fg, "descriptionForeground": pun,
        "errorForeground": err, "selection.background": al(acc, "40"),
        "widget.border": bd, "widget.shadow": al(pun, "22"),

        "textLink.foreground": acc, "textLink.activeForeground": acc,
        "textPreformat.foreground": str_, "textBlockQuote.background": alt,
        "textBlockQuote.border": bd, "textCodeBlock.background": alt,

        "button.background": acc, "button.foreground": on(acc),
        "button.hoverBackground": al(acc, "DD"),
        "button.secondaryBackground": alt, "button.secondaryForeground": fg,
        "checkbox.background": bg, "checkbox.border": bd,
        "dropdown.background": bg, "dropdown.border": bd, "dropdown.foreground": fg,
        "input.background": ov(p, "input.bg", bg), "input.border": ov(p, "input.border", bd), "input.foreground": fg,
        "input.placeholderForeground": pun,
        "inputOption.activeBorder": acc, "inputOption.activeForeground": acc,
        "inputValidation.errorBackground": bg, "inputValidation.errorBorder": err,
        "inputValidation.warningBackground": bg, "inputValidation.warningBorder": warn,
        "inputValidation.infoBackground": bg, "inputValidation.infoBorder": info,
        "badge.background": acc, "badge.foreground": on(acc),
        "progressBar.background": acc,

        "scrollbar.shadow": al(pun, "22"),
        "scrollbarSlider.background": al(pun, sld),
        "scrollbarSlider.hoverBackground": al(pun, "55"),
        "scrollbarSlider.activeBackground": al(pun, "77"),

        "editor.background": bg, "editor.foreground": fg,
        "editorLineNumber.foreground": ov(p, "gutter.fg", &al(pun, "AA")),
        "editorLineNumber.activeForeground": ov(p, "gutter.activeFg", acc),
        "editorCursor.foreground": acc,
        "editor.selectionBackground": sel,
        "editor.inactiveSelectionBackground": al(sel, "99"),
        "editor.selectionHighlightBackground": al(acc, "22"),
        "editor.wordHighlightBackground": al(acc, "1F"),
        "editor.wordHighlightStrongBackground": al(acc, "33"),
        "editor.findMatchBackground": al(acc, "55"),
        "editor.findMatchHighlightBackground": al(acc, "2A"),
        "editor.findRangeHighlightBackground": al(pun, ov_hi),
        "editor.hoverHighlightBackground": al(acc, "1A"),
        "editor.lineHighlightBackground": ov(p, "editor.lineHighlight", &al(pun, ov_hi)),
        "editor.rangeHighlightBackground": al(pun, ov_hi),
        "editorLink.activeForeground": acc,
        "editorWhitespace.foreground": al(pun, "66"),
        "editorIndentGuide.background1": al(bd, "CC"),
        "editorIndentGuide.activeBackground1": al(pun, "99"),
        "editorRuler.foreground": bd,
        "editorCodeLens.foreground": cm,
        "editorBracketMatch.background": al(acc, "26"),
        "editorBracketMatch.border": al(acc, "77"),
        "editorBracketHighlight.foreground1": typ,
        "editorBracketHighlight.foreground2": fun,
        "editorBracketHighlight.foreground3": num,
        "editorBracketHighlight.foreground4": op,
        "editorBracketHighlight.foreground5": typ,
        "editorBracketHighlight.foreground6": fun,
        "editorBracketHighlight.unexpectedBracket.foreground": err,

        "editorError.foreground": err, "editorWarning.foreground": warn,
        "editorInfo.foreground": info, "editorHint.foreground": pun,
        "editorGutter.background": bg,
        "editorGutter.modifiedBackground": modc,
        "editorGutter.addedBackground": addc,
        "editorGutter.deletedBackground": delc,
        "editorOverviewRuler.border": bd,
        "editorOverviewRuler.errorForeground": err,
        "editorOverviewRuler.warningForeground": warn,
        "editorOverviewRuler.modifiedForeground": al(modc, "99"),
        "editorOverviewRuler.addedForeground": al(addc, "99"),
        "editorOverviewRuler.deletedForeground": al(delc, "99"),
        "editorOverviewRuler.findMatchForeground": al(acc, "99"),

        "diffEditor.insertedTextBackground": al(addc, "1A"),
        "diffEditor.removedTextBackground": al(delc, "1A"),
        "diffEditor.insertedLineBackground": al(addc, "14"),
        "diffEditor.removedLineBackground": al(delc, "14"),
        "diffEditor.border": bd,

        "editorWidget.background": ov(p, "widget.bg", bg), "editorWidget.border": ov(p, "widget.border", bd),
        "editorHoverWidget.background": bg, "editorHoverWidget.border": bd,
        "editorSuggestWidget.background": bg, "editorSuggestWidget.border": bd,
        "editorSuggestWidget.foreground": fg,
        "editorSuggestWidget.highlightForeground": acc,
        "editorSuggestWidget.selectedBackground": sel,
        "editorMarkerNavigation.background": alt,
        "editorMarkerNavigationError.background": err,
        "editorMarkerNavigationWarning.background": warn,
        "peekView.border": acc,
        "peekViewEditor.background": alt,
        "peekViewEditor.matchHighlightBackground": al(acc, "40"),
        "peekViewResult.background": alt,
        "peekViewResult.selectionBackground": sel,
        "peekViewResult.lineForeground": fg,
        "peekViewResult.fileForeground": fg,
        "peekViewResult.matchHighlightBackground": al(acc, "40"),
        "peekViewTitle.background": alt,
        "peekViewTitleLabel.foreground": fg,
        "peekViewTitleDescription.foreground": pun,

        "titleBar.activeBackground": ov(p, "titleBar.bg", alt), "titleBar.activeForeground": ov(p, "titleBar.fg", fg),
        "titleBar.inactiveBackground": ov(p, "titleBar.bg", alt), "titleBar.inactiveForeground": pun,
        "titleBar.border": ov(p, "titleBar.border", bd),
        "menu.background": bg, "menu.foreground": fg,
        "menu.selectionBackground": sel, "menu.selectionForeground": fg,
        "menu.separatorBackground": bd, "menu.border": bd,
        "menubar.selectionBackground": sel, "menubar.selectionForeground": fg,

        "activityBar.background": ov(p, "activityBar.bg", alt), "activityBar.foreground": ov(p, "activityBar.fg", fg),
        "activityBar.inactiveForeground": ov(p, "activityBar.inactiveFg", pun), "activityBar.border": ov(p, "activityBar.border", bd),
        "activityBarBadge.background": acc, "activityBarBadge.foreground": on(acc),
        "activityBar.activeBorder": ov(p, "activityBar.activeBorder", acc),

        "sideBar.background": ov(p, "sidebar.bg", alt), "sideBar.foreground": ov(p, "sidebar.fg", fg),
        "sideBar.border": ov(p, "sidebar.border", bd),
        "sideBarTitle.foreground": ov(p, "sidebar.title", pun),
        "sideBarSectionHeader.background": ov(p, "sidebar.headerBg", &ov(p, "sidebar.bg", alt)),
        "sideBarSectionHeader.foreground": ov(p, "sidebar.title", pun),
        "sideBarSectionHeader.border": ov(p, "sidebar.border", bd),

        "list.activeSelectionBackground": ov(p, "list.activeBg", sel), "list.activeSelectionForeground": ov(p, "list.activeFg", fg),
        "list.inactiveSelectionBackground": al(sel, "99"),
        "list.inactiveSelectionForeground": fg,
        "list.hoverBackground": al(pun, hov), "list.hoverForeground": fg,
        "list.focusBackground": sel, "list.focusForeground": fg,
        "list.highlightForeground": acc,
        "list.errorForeground": err, "list.warningForeground": warn,
        "listFilterWidget.background": bg, "listFilterWidget.outline": acc,
        "tree.indentGuidesStroke": al(pun, "66"),

        "editorGroup.border": ov(p, "editor.border", bd),
        "editorGroupHeader.tabsBackground": ov(p, "tab.stripBg", alt),
        "editorGroupHeader.tabsBorder": ov(p, "tab.border", bd),
        "editorGroupHeader.noTabsBackground": ov(p, "tab.stripBg", alt),
        "tab.activeBackground": ov(p, "tab.activeBg", bg), "tab.activeForeground": ov(p, "tab.activeFg", fg),
        "tab.inactiveBackground": ov(p, "tab.inactiveBg", alt), "tab.inactiveForeground": ov(p, "tab.inactiveFg", pun),
        "tab.border": ov(p, "tab.border", bd), "tab.activeBorderTop": ov(p, "tab.activeTop", acc),
        "tab.hoverBackground": ov(p, "tab.activeBg", bg), "tab.unfocusedActiveBorderTop": al(acc, "66"),
        "breadcrumb.background": bg, "breadcrumb.foreground": pun,
        "breadcrumb.focusForeground": fg, "breadcrumb.activeSelectionForeground": acc,
        "breadcrumbPicker.background": bg,

        "panel.background": ov(p, "panel.bg", bg), "panel.border": ov(p, "panel.border", bd),
        "panelTitle.activeForeground": fg, "panelTitle.activeBorder": acc,
        "panelTitle.inactiveForeground": pun,

        "statusBar.background": ov(p, "statusBar.bg", alt), "statusBar.foreground": ov(p, "statusBar.fg", gs(p, "op")),
        "statusBar.border": ov(p, "statusBar.border", bd),
        "statusBar.noFolderBackground": alt,
        "statusBar.debuggingBackground": acc,
        "statusBar.debuggingForeground": on(acc),
        "statusBarItem.remoteBackground": acc,
        "statusBarItem.remoteForeground": on(acc),
        "statusBarItem.hoverBackground": al(pun, "22"),
        "statusBarItem.errorBackground": err,
        "statusBarItem.errorForeground": "#FFFFFF",

        "terminal.background": ov(p, "terminal.bg", bg), "terminal.foreground": ov(p, "terminal.fg", fg),
        "terminal.ansiBlack": if dark { bd } else { pun }, "terminal.ansiBrightBlack": cm,
        "terminal.ansiRed": err, "terminal.ansiBrightRed": err,
        "terminal.ansiGreen": okc, "terminal.ansiBrightGreen": okc,
        "terminal.ansiYellow": warn, "terminal.ansiBrightYellow": warn,
        "terminal.ansiBlue": info, "terminal.ansiBrightBlue": info,
        "terminal.ansiMagenta": num, "terminal.ansiBrightMagenta": num,
        "terminal.ansiCyan": typ, "terminal.ansiBrightCyan": typ,
        "terminal.ansiWhite": fg, "terminal.ansiBrightWhite": fg,
        "terminalCursor.foreground": acc,
        "terminal.selectionBackground": sel,

        "gitDecoration.addedResourceForeground": addc,
        "gitDecoration.modifiedResourceForeground": modc,
        "gitDecoration.deletedResourceForeground": delc,
        "gitDecoration.untrackedResourceForeground": okc,
        "gitDecoration.ignoredResourceForeground": pun,
        "gitDecoration.conflictingResourceForeground": err,
        "gitDecoration.stageModifiedResourceForeground": modc,

        "notificationCenterHeader.background": alt,
        "notifications.background": bg, "notifications.border": bd,
        "notificationLink.foreground": acc,
        "notificationsErrorIcon.foreground": err,
        "notificationsWarningIcon.foreground": warn,
        "notificationsInfoIcon.foreground": info,

        "quickInput.background": bg, "quickInput.foreground": fg,
        "quickInputList.focusBackground": sel,
        "pickerGroup.border": bd, "pickerGroup.foreground": pun,

        "settings.headerForeground": fg,
        "settings.modifiedItemIndicator": acc,
        "keybindingLabel.background": alt, "keybindingLabel.foreground": fg,
        "keybindingLabel.border": bd, "keybindingLabel.bottomBorder": bd,

        "minimap.findMatchHighlight": al(acc, "99"),
        "minimap.selectionHighlight": sel,
        "minimap.errorHighlight": err,
        "minimapSlider.background": al(pun, "22"),
        "minimapSlider.hoverBackground": al(pun, "33"),
        "minimapSlider.activeBackground": al(pun, "44"),

        "debugToolBar.background": bg,
        "debugIcon.breakpointForeground": err,
        "editorStickyScroll.background": alt,
        "editorStickyScrollHover.background": sel,
        "charts.red": err, "charts.green": okc,
        "charts.yellow": warn, "charts.blue": info,
        "charts.foreground": fg, "charts.lines": bd,
    });

    let tc = json!([
        {"name":"Comment","scope":["comment","punctuation.definition.comment","string.comment"],
         "settings":{"foreground":cm,"fontStyle":"italic"}},
        {"name":"Keyword","scope":["keyword","keyword.control","keyword.other","storage","storage.type",
         "storage.modifier","variable.language","keyword.operator.new","keyword.operator.expression",
         "keyword.operator.logical","constant.language.boolean"],
         "settings":{"foreground":key}},
        {"name":"Operator","scope":["keyword.operator","punctuation.separator.key-value",
         "punctuation.accessor","meta.arrow"],"settings":{"foreground":op}},
        {"name":"String","scope":["string","string.quoted","string.template","string.regexp",
         "punctuation.definition.string","meta.embedded.assembly"],
         "settings":{"foreground":str_}},
        {"name":"String interpolation punctuation","scope":["punctuation.definition.template-expression",
         "punctuation.section.embedded"],"settings":{"foreground":op}},
        {"name":"Number / constant","scope":["constant.numeric","constant.language","constant.character",
         "constant.other","variable.other.constant","support.constant"],
         "settings":{"foreground":num}},
        {"name":"Function","scope":["entity.name.function","support.function","meta.function-call.generic",
         "variable.function","entity.name.function.member"],
         "settings":{"foreground":fun}},
        {"name":"Type / class","scope":["entity.name.type","entity.name.class","entity.name.namespace",
         "entity.name.scope-resolution","support.type","support.class","entity.other.inherited-class",
         "entity.name.type.parameter","meta.type.annotation entity.name.type"],
         "settings":{"foreground":typ}},
        {"name":"Variable / parameter / property","scope":["variable","variable.other",
         "variable.other.readwrite","variable.parameter","meta.object-literal.key",
         "support.variable","variable.other.property","variable.other.object.property"],
         "settings":{"foreground":prop}},
        {"name":"Punctuation","scope":["punctuation","meta.brace","punctuation.definition.parameters",
         "punctuation.definition.array","punctuation.terminator","punctuation.separator"],
         "settings":{"foreground":pun}},
        {"name":"Decorator / attribute","scope":["meta.decorator","entity.name.function.decorator",
         "storage.type.annotation","entity.other.attribute-name"],
         "settings":{"foreground":fun}},
        {"name":"Tag","scope":["entity.name.tag","entity.name.tag.html","entity.name.tag.svelte"],
         "settings":{"foreground":typ}},
        {"name":"Tag punctuation","scope":["punctuation.definition.tag"],
         "settings":{"foreground":pun}},
        {"name":"CSS property","scope":["support.type.property-name.css","support.type.property-name.scss"],
         "settings":{"foreground":prop}},
        {"name":"CSS selector","scope":["entity.name.tag.css","entity.other.attribute-name.class.css",
         "entity.other.attribute-name.id.css"],"settings":{"foreground":typ}},
        {"name":"CSS unit","scope":["keyword.other.unit","constant.numeric.css"],
         "settings":{"foreground":num}},
        {"name":"Markdown heading","scope":["markup.heading","entity.name.section"],
         "settings":{"foreground":typ,"fontStyle":"bold"}},
        {"name":"Markdown emphasis","scope":["markup.italic"],"settings":{"fontStyle":"italic"}},
        {"name":"Markdown strong","scope":["markup.bold"],"settings":{"fontStyle":"bold"}},
        {"name":"Markdown link","scope":["markup.underline.link","string.other.link"],
         "settings":{"foreground":acc}},
        {"name":"Markdown code","scope":["markup.inline.raw","markup.fenced_code.block"],
         "settings":{"foreground":str_}},
        {"name":"Markdown quote","scope":["markup.quote"],
         "settings":{"foreground":cm,"fontStyle":"italic"}},
        {"name":"Diff inserted","scope":["markup.inserted"],"settings":{"foreground":addc}},
        {"name":"Diff deleted","scope":["markup.deleted"],"settings":{"foreground":delc}},
        {"name":"Diff changed","scope":["markup.changed"],"settings":{"foreground":modc}},
        {"name":"Invalid","scope":["invalid","invalid.illegal"],"settings":{"foreground":err}},
        {"name":"Deprecated","scope":["invalid.deprecated"],
         "settings":{"foreground":cm,"fontStyle":"strikethrough"}},
        {"name":"JSON key","scope":["support.type.property-name.json"],
         "settings":{"foreground":prop}},
        {"name":"YAML key","scope":["entity.name.tag.yaml"],"settings":{"foreground":prop}},
        {"name":"Shell / regex escape","scope":["constant.character.escape","string.regexp keyword"],
         "settings":{"foreground":op}},
    ]);

    let stc = json!({
        "type": typ, "class": typ, "interface": typ,
        "enum": typ, "typeParameter": typ, "struct": typ,
        "namespace": typ,
        "function": fun, "method": fun, "decorator": fun,
        "variable": prop, "parameter": prop, "property": prop,
        "enumMember": num,
        "variable.readonly": num,
        "keyword": key, "operator": op, "string": str_,
        "number": num, "comment": {"foreground": cm, "fontStyle": "italic"},
        "*.deprecated": {"strikethrough": true},
    });

    json!({
        "$schema": "vscode://schemas/color-theme",
        "name": label,
        "type": kind,
        "semanticHighlighting": true,
        "colors": colors,
        "semanticTokenColors": stc,
        "tokenColors": tc,
    })
}

/// The semantic set for a theme in a given mode: an imported scheme's own
/// diagnostics win over the family's; an empty set falls back to the family.
fn semantic_for<'a>(t: &'a Value, fam: &'a Value, kind: &str) -> &'a Value {
    match t.get("semantic").and_then(|s| s.get(kind)) {
        Some(v) if v.as_object().map(|o| !o.is_empty()).unwrap_or(false) => v,
        _ => &fam["semantic"][kind],
    }
}

/// Port of build.py's generate(): write themes/*.json + package.json.
/// Returns (theme file count, pair count, WCAG audit warnings).
fn generate(doc: &Value, dir: &Path) -> Result<(usize, usize, Vec<String>), String> {
    let out = dir.join("themes");
    std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
    let m = &doc["meta"];
    let themes = doc["themes"].as_array().ok_or("missing 'themes'")?;

    let mut keep: std::collections::HashSet<String> = std::collections::HashSet::new();
    let mut contrib: Vec<Value> = Vec::new();

    for t in themes {
        let fam = &doc["families"][gs(t, "family")];
        for (kind, prefix, ui) in [
            ("light", gs(m, "lightPrefix"), "vs"),
            ("dark", gs(m, "darkPrefix"), "vs-dark"),
        ] {
            if t.get(kind).is_none() {
                continue;
            }
            let sem = semantic_for(t, fam, kind);
            let name = gs(t, "name");
            let label = format!("{prefix} {name}");
            let fname = format!("{}-{}-color-theme.json", slug(prefix), slug(name));
            let theme = build_theme(&t[kind], sem, kind, &label);
            let body = serde_json::to_string_pretty(&theme).map_err(|e| e.to_string())? + "\n";
            std::fs::write(out.join(&fname), body).map_err(|e| format!("could not write {fname}: {e}"))?;
            keep.insert(fname.clone());
            contrib.push(json!({ "label": label, "uiTheme": ui, "path": format!("./themes/{fname}") }));
        }
    }

    // Drop theme files left over from renamed or deleted pairs.
    if let Ok(entries) = std::fs::read_dir(&out) {
        let mut stale: Vec<String> = entries
            .flatten()
            .filter_map(|e| e.file_name().into_string().ok())
            .filter(|n| n.ends_with("-color-theme.json") && !keep.contains(n))
            .collect();
        stale.sort();
        for n in stale {
            let _ = std::fs::remove_file(out.join(&n));
        }
    }

    let pkg = json!({
        "name": gs(m, "name"), "displayName": gs(m, "displayName"),
        "description": gs(m, "description"), "version": gs(m, "version"),
        "publisher": gs(m, "publisher"), "license": "MIT",
        "engines": { "vscode": "^1.74.0" }, "categories": ["Themes"],
        "keywords": ["light theme", "dark theme", "ayu", "jetbrains", "minimal", "monochrome"],
        "contributes": { "themes": contrib },
    });
    let pkg_body = serde_json::to_string_pretty(&pkg).map_err(|e| e.to_string())? + "\n";
    std::fs::write(dir.join("package.json"), pkg_body).map_err(|e| format!("could not write package.json: {e}"))?;

    let mut warnings = Vec::new();
    for t in themes {
        for kind in ["light", "dark"] {
            if t.get(kind).is_none() {
                continue;
            }
            let p = &t[kind];
            let r = ratio(gs(p, "bg"), gs(p, "fg"));
            if r < 4.5 {
                warnings.push(format!("{} ({}) body text {:.2}:1 — under AA", gs(t, "name"), kind, r));
            }
        }
    }

    Ok((contrib.len(), themes.len(), warnings))
}

/// Port of build.py's nimbalyst(): one 20-key semantic manifest per theme,
/// written to <dir>/nimbalyst/<id>/theme.json. Returns the count written.
fn nimbalyst(doc: &Value, dir: &Path) -> Result<usize, String> {
    let out = dir.join("nimbalyst");
    std::fs::create_dir_all(&out).map_err(|e| e.to_string())?;
    let m = &doc["meta"];
    let version = gs(m, "version");
    let publisher = gs(m, "publisher");
    let mut made = 0;

    for t in doc["themes"].as_array().ok_or("missing 'themes'")? {
        let fam = &doc["families"][gs(t, "family")];
        for kind in ["light", "dark"] {
            if t.get(kind).is_none() {
                continue;
            }
            let sem = semantic_for(t, fam, kind);
            let man = nimbalyst_theme(t, kind, &t[kind], sem, version, publisher);
            let id = man["id"].as_str().unwrap_or("theme").to_string();
            let folder = out.join(&id);
            std::fs::create_dir_all(&folder).map_err(|e| e.to_string())?;
            let body = serde_json::to_string_pretty(&man).map_err(|e| e.to_string())? + "\n";
            std::fs::write(folder.join("theme.json"), body).map_err(|e| e.to_string())?;
            made += 1;
        }
    }
    Ok(made)
}

fn nimbalyst_theme(t: &Value, kind: &str, p: &Value, sem: &Value, version: &str, publisher: &str) -> Value {
    let fg = gs(p, "fg");
    let bg = gs(p, "bg");
    let acc = gs(p, "accent");
    let name = gs(t, "name");
    let light = kind == "light";
    json!({
        "id": format!("{}{}", if light { "daylight-" } else { "lamplight-" }, slug(name)),
        "name": format!("{}{}", if light { "Daylight " } else { "Lamplight " }, name),
        "version": version,
        "author": publisher,
        "description": t.get("thesis").and_then(|v| v.as_str()).unwrap_or(""),
        "isDark": kind == "dark",
        "tags": [gs(t, "family"), kind],
        "colors": {
            "bg": bg,
            "bg-secondary": gs(p, "alt"),
            "bg-tertiary": mix(gs(p, "alt"), fg, 0.06),
            "bg-hover": mix(bg, fg, 0.05),
            "bg-selected": gs(p, "sel"),
            "bg-active": mix(bg, acc, 0.14),
            "text": fg,
            "text-muted": mix(fg, bg, 0.30),
            "text-faint": gs(p, "comment"),
            "text-disabled": mix(gs(p, "comment"), bg, 0.35),
            "border": gs(p, "border"),
            "border-focus": acc,
            "primary": acc,
            "primary-hover": mix(acc, fg, 0.18),
            "link": acc,
            "link-hover": mix(acc, fg, 0.18),
            "success": gs(sem, "ok"),
            "warning": gs(sem, "warn"),
            "error": gs(sem, "err"),
            "info": gs(sem, "info"),
        },
    })
}

// ------------------------------------------------------------------ validate --

fn is_hex(v: &Value) -> bool {
    match v.as_str() {
        Some(s) => s.len() == 7 && s.starts_with('#') && s[1..].chars().all(|c| c.is_ascii_hexdigit()),
        None => false,
    }
}

/// Reject anything that would generate a broken theme file. Cheap enough to run
/// on every save and before every build.
fn validate(doc: &Value) -> Result<(), String> {
    let roles: Vec<&str> = doc["roles"]
        .as_array()
        .ok_or("missing 'roles'")?
        .iter()
        .filter_map(|r| r.as_str())
        .collect();
    let families = doc["families"].as_object().ok_or("missing 'families'")?;
    let themes = doc["themes"].as_array().ok_or("missing 'themes'")?;

    let mut seen = std::collections::HashSet::new();
    for t in themes {
        let name = t["name"].as_str().unwrap_or("").trim().to_string();
        if name.is_empty() {
            return Err("a theme has no name".into());
        }
        if !seen.insert(name.clone()) {
            return Err(format!("duplicate theme name: {name}"));
        }
        let fam = t["family"].as_str().unwrap_or("");
        if !families.contains_key(fam) {
            return Err(format!("{name}: unknown family '{fam}'"));
        }
        for kind in ["light", "dark"] {
            let Some(mode) = t.get(kind) else { continue };
            for r in &roles {
                if !is_hex(&mode[*r]) {
                    return Err(format!("{name} / {kind} / {r} is not a #RRGGBB colour"));
                }
            }
            if let Some(ui) = mode.get("ui").and_then(|u| u.as_object()) {
                for (k, v) in ui {
                    if !is_hex(v) {
                        return Err(format!("{name} / {kind} / {k} is not a #RRGGBB colour"));
                    }
                }
            }
            if let Some(sem) = t.get("semantic").and_then(|s| s.get(kind)).and_then(|s| s.as_object()) {
                for (k, v) in sem {
                    if !is_hex(v) {
                        return Err(format!("{name} / {kind} / semantic {k} is not a #RRGGBB colour"));
                    }
                }
            }
        }
    }
    for (fid, fam) in families {
        for kind in ["light", "dark"] {
            let set = fam["semantic"][kind]
                .as_object()
                .ok_or(format!("family {fid} has no {kind} diagnostics"))?;
            for (k, v) in set {
                if !is_hex(v) {
                    return Err(format!("family {fid} / {kind} / {k} is not a #RRGGBB colour"));
                }
            }
        }
    }
    Ok(())
}

// ------------------------------------------------------------------ commands --

#[tauri::command]
fn load(app: AppHandle) -> Result<Loaded, String> {
    let path = palettes_path(&app)?;
    let dir = data_dir(&app)?.to_string_lossy().to_string();
    let raw = std::fs::read_to_string(&path).map_err(|e| format!("could not read palettes.json: {e}"))?;
    let palettes: Value =
        serde_json::from_str(&raw).map_err(|e| format!("palettes.json is not valid JSON: {e}"))?;
    Ok(Loaded { palettes, schema: schema_value(), dir })
}

#[tauri::command]
fn save(app: AppHandle, args: SaveArgs) -> Result<String, String> {
    validate(&args.doc)?;
    let dir = data_dir(&app)?;
    let target = dir.join("palettes.json");
    let tmp = dir.join("palettes.json.tmp");
    let body = serde_json::to_string_pretty(&args.doc).map_err(|e| e.to_string())? + "\n";
    std::fs::write(&tmp, &body).map_err(|e| format!("could not write: {e}"))?;
    std::fs::rename(&tmp, &target).map_err(|e| format!("could not replace palettes.json: {e}"))?;
    Ok("palettes.json saved".into())
}

/// Regenerate every theme file and package.json from the current document.
#[tauri::command]
fn build(app: AppHandle, doc: Value) -> Result<String, String> {
    validate(&doc)?;
    let dir = data_dir(&app)?;
    let (files, pairs, warnings) = generate(&doc, &dir)?;
    let made = nimbalyst(&doc, &dir)?;
    let mut msg = format!("built {files} theme files across {pairs} pairs · {made} Nimbalyst");
    if !warnings.is_empty() {
        msg.push_str(&format!(" · {} under AA", warnings.len()));
    }
    Ok(msg)
}

/// Regenerate, then run vsce to drop a .vsix in dist/. Returns the .vsix path.
#[tauri::command]
fn package(app: AppHandle, doc: Value) -> Result<String, String> {
    validate(&doc)?;
    let dir = data_dir(&app)?;
    generate(&doc, &dir)?;
    // vsce refuses to package without these; seed them from the bundle.
    for name in ["README.md", "LICENSE"] {
        let dst = dir.join(name);
        if !dst.exists() {
            if let Ok(src) = resource(&app, &format!("resources/{name}")) {
                let _ = std::fs::copy(&src, &dst);
            }
        }
    }
    let version = gs(&doc["meta"], "version").to_string();
    let dist = dir.join("dist");
    std::fs::create_dir_all(&dist).map_err(|e| e.to_string())?;
    let vsix = dist.join(format!("daylight-lamplight-{version}.vsix"));
    let script = format!(
        "npx --yes @vscode/vsce package --no-dependencies --allow-missing-repository -o {}",
        quote(&vsix.to_string_lossy())
    );
    shell(&dir.to_string_lossy(), &script)?;
    Ok(vsix.to_string_lossy().to_string())
}

/// Show a produced file or folder in Finder.
#[tauri::command]
fn reveal(path: String) -> Result<(), String> {
    Command::new("/usr/bin/open")
        .args(["-R", &path])
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("could not open Finder: {e}"))
}

// ------------------------------------------------------------------ schemes --
// The tinted-theming collection ships flat YAML: `key: "value"` at the root and
// a two-space `palette:` block. tinted8 nests its metadata one level under
// `scheme:` and names its colours instead of numbering them. Rather than pull in
// a YAML crate for files this regular, parse them directly.

#[derive(Serialize, Clone)]
pub struct Scheme {
    uid: String,
    id: String,
    name: String,
    author: String,
    system: String,
    variant: String,
    palette: std::collections::BTreeMap<String, String>,
}

/// Strip quotes and any trailing ` # comment` from a scalar.
fn scalar(raw: &str) -> String {
    let v = raw.trim();
    if let Some(rest) = v.strip_prefix('"') {
        return rest.split('"').next().unwrap_or("").to_string();
    }
    match v.split_once(" #") {
        Some((head, _)) => head.trim().to_string(),
        None => v.to_string(),
    }
}

fn parse_scheme(id: &str, text: &str) -> Option<Scheme> {
    let mut top: std::collections::HashMap<String, String> = Default::default();
    let mut palette: std::collections::BTreeMap<String, String> = Default::default();
    let mut section = String::new();

    for line in text.lines() {
        let trimmed = line.trim();
        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }
        let indent = line.len() - line.trim_start().len();
        let (key, value) = match trimmed.split_once(':') {
            Some((k, v)) => (k.trim().to_string(), v.trim()),
            None => continue,
        };

        if indent == 0 {
            if value.is_empty() {
                section = key;
            } else {
                section.clear();
                top.insert(key, scalar(value));
            }
            continue;
        }
        if indent == 2 && !value.is_empty() {
            match section.as_str() {
                "palette" => {
                    palette.insert(key, scalar(value));
                }
                "scheme" => {
                    top.insert(key, scalar(value));
                }
                _ => {}
            }
        }
    }

    if palette.is_empty() {
        return None;
    }
    let name = top.get("name").cloned().unwrap_or_else(|| {
        match (top.get("family"), top.get("style")) {
            (Some(f), Some(s)) => format!("{f} {s}"),
            (Some(f), None) => f.clone(),
            _ => id.to_string(),
        }
    });
    Some(Scheme {
        uid: id.to_string(),
        id: id.to_string(),
        name,
        author: top.get("author").cloned().unwrap_or_default(),
        system: top.get("system").cloned().unwrap_or_else(|| "base16".into()),
        variant: top.get("variant").cloned().unwrap_or_else(|| "dark".into()),
        palette,
    })
}

/// Every scheme in the bundled `schemes-spec-0.11` collection.
#[tauri::command]
fn schemes(app: AppHandle) -> Result<Vec<Scheme>, String> {
    let root = resource(&app, "resources/schemes-spec-0.11")?;
    let mut out = Vec::new();
    for system in ["base16", "base24", "tinted8"] {
        let dir = root.join(system);
        let Ok(entries) = std::fs::read_dir(&dir) else { continue };
        for entry in entries.flatten() {
            let path = entry.path();
            let ext = path.extension().and_then(|e| e.to_str()).unwrap_or("");
            if ext != "yaml" && ext != "yml" {
                continue;
            }
            let id = path.file_stem().and_then(|s| s.to_str()).unwrap_or("").to_string();
            let Ok(text) = std::fs::read_to_string(&path) else { continue };
            if let Some(mut s) = parse_scheme(&id, &text) {
                s.system = system.to_string();
                s.uid = format!("{system}/{}", s.id);
                out.push(s);
            }
        }
    }
    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

// -------------------------------------------------------------------- argv ----
// The CLI spec is the user's own work, kept in the app's data directory.

#[derive(Deserialize)]
pub struct FileOut {
    name: String,
    body: String,
}

/// Refuse anything that would escape the folder the user picked.
fn safe_relative(name: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(name);
    if p.is_absolute() || name.contains("..") {
        return Err(format!("refusing to write outside the chosen folder: {name}"));
    }
    Ok(p)
}

fn spec_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    std::fs::create_dir_all(&dir).map_err(|e| e.to_string())?;
    Ok(dir.join("argv-spec.json"))
}

#[tauri::command]
fn argv_load(app: AppHandle) -> Result<Option<Value>, String> {
    let path = spec_path(&app)?;
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map(Some)
            .map_err(|e| format!("argv-spec.json is not valid JSON: {e}")),
        Err(_) => Ok(None),
    }
}

#[tauri::command]
fn argv_save(app: AppHandle, spec: Value) -> Result<String, String> {
    let path = spec_path(&app)?;
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(&spec).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, body + "\n").map_err(|e| format!("could not write: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("could not replace: {e}"))?;
    Ok(format!("spec saved to {}", path.display()))
}

/// Write a generated package into a folder the user chose in the picker.
#[tauri::command]
fn argv_export(dir: String, files: Vec<FileOut>) -> Result<String, String> {
    let root = PathBuf::from(&dir);
    if !root.is_dir() {
        return Err(format!("{dir} is not a folder"));
    }
    let mut written = 0;
    for f in &files {
        let target = root.join(safe_relative(&f.name)?);
        if let Some(parent) = target.parent() {
            std::fs::create_dir_all(parent).map_err(|e| format!("could not create {}: {e}", parent.display()))?;
        }
        std::fs::write(&target, &f.body).map_err(|e| format!("could not write {}: {e}", target.display()))?;
        written += 1;
    }
    Ok(format!("wrote {written} files to {dir}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            load, save, build, package, reveal, schemes, argv_load, argv_save, argv_export
        ])
        .run(tauri::generate_context!())
        .expect("error while running FractalDesk");
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn doc() -> Value {
        json!({
            "roles": ["bg", "fg"],
            "families": {
                "bone": { "semantic": {
                    "light": { "err": "#E65050" },
                    "dark":  { "err": "#F26D6D" }
                }}
            },
            "themes": [{
                "name": "Bone",
                "family": "bone",
                "light": { "bg": "#FCFCFC", "fg": "#5C6166" },
                "dark":  { "bg": "#16181A", "fg": "#C2C6C9" }
            }]
        })
    }

    #[test]
    fn accepts_a_well_formed_document() {
        assert!(validate(&doc()).is_ok());
    }

    #[test]
    fn rejects_a_bad_colour() {
        let mut d = doc();
        d["themes"][0]["light"]["fg"] = json!("5C6166");
        assert!(validate(&d).unwrap_err().contains("not a #RRGGBB"));
    }

    #[test]
    fn rejects_a_missing_role() {
        let mut d = doc();
        d["themes"][0]["dark"].as_object_mut().unwrap().remove("fg");
        assert!(validate(&d).is_err());
    }

    #[test]
    fn rejects_duplicate_names() {
        let mut d = doc();
        let dup = d["themes"][0].clone();
        d["themes"].as_array_mut().unwrap().push(dup);
        assert!(validate(&d).unwrap_err().contains("duplicate"));
    }

    #[test]
    fn rejects_an_unknown_family() {
        let mut d = doc();
        d["themes"][0]["family"] = json!("nope");
        assert!(validate(&d).unwrap_err().contains("unknown family"));
    }

    #[test]
    fn rejects_a_bad_workbench_override() {
        let mut d = doc();
        d["themes"][0]["light"]["ui"] = json!({ "sidebar.bg": "red" });
        assert!(validate(&d).unwrap_err().contains("sidebar.bg"));
    }

    #[test]
    fn accepts_a_good_workbench_override() {
        let mut d = doc();
        d["themes"][0]["light"]["ui"] = json!({ "sidebar.bg": "#EDEFF1" });
        assert!(validate(&d).is_ok());
    }

    #[test]
    fn checks_theme_level_diagnostics() {
        let mut d = doc();
        d["themes"][0]["semantic"] = json!({ "light": { "err": "#E65050" } });
        assert!(validate(&d).is_ok());
        d["themes"][0]["semantic"] = json!({ "light": { "err": "nope" } });
        assert!(validate(&d).unwrap_err().contains("semantic err"));
    }

    #[test]
    fn refuses_paths_that_escape_the_export_folder() {
        assert!(safe_relative("src/cli.ts").is_ok());
        assert!(safe_relative("../outside.ts").is_err());
        assert!(safe_relative("/etc/passwd").is_err());
        assert!(safe_relative("src/../../up.ts").is_err());
    }

    #[test]
    fn quotes_paths_with_apostrophes() {
        assert_eq!(quote("/tmp/amrit's themes"), r"'/tmp/amrit'\''s themes'");
    }

    // ---- colour maths, ported from build.py --------------------------------

    #[test]
    fn slugifies_names() {
        assert_eq!(slug("Daylight Cold Front"), "daylight-cold-front");
        assert_eq!(slug("  Bone / graphite  "), "bone-graphite");
    }

    #[test]
    fn on_picks_a_readable_ink() {
        assert_eq!(on("#000000"), "#FFFFFF");
        assert_eq!(on("#FFFFFF"), "#1A1A1A");
    }

    #[test]
    fn mixes_toward_the_far_pole() {
        assert_eq!(mix("#000000", "#FFFFFF", 0.0), "#000000");
        assert_eq!(mix("#000000", "#FFFFFF", 1.0), "#FFFFFF");
        assert_eq!(mix("#000000", "#FFFFFF", 0.5), "#808080");
    }

    #[test]
    fn appends_alpha() {
        assert_eq!(al("#FF9940", "40"), "#FF994040");
    }

    // ---- schema and theme generation ---------------------------------------

    #[test]
    fn schema_lists_every_workbench_key() {
        let s = schema_value();
        let ui = s["ui"].as_array().unwrap();
        assert_eq!(ui.len(), UI_KEYS.len());
        assert_eq!(ui[0]["key"], "sidebar.bg");
        assert_eq!(ui[0]["from"], "alt");
    }

    #[test]
    fn builds_a_theme_document() {
        let p = json!({
            "bg": "#FCFCFC", "alt": "#F3F4F5", "border": "#E7E8EA", "sel": "#E8ECEF",
            "fg": "#5C6166", "comment": "#A0A6AC", "punct": "#A0A6AC", "op": "#ED9366",
            "key": "#FA8D3E", "str": "#86B300", "num": "#A37ACC", "fn": "#F2AE49",
            "type": "#399EE6", "prop": "#5C6166", "accent": "#FF9940"
        });
        let s = json!({
            "err": "#E65050", "warn": "#F2AE49", "info": "#399EE6", "ok": "#86B300",
            "add": "#86B300", "mod": "#399EE6", "delete": "#E65050"
        });
        let t = build_theme(&p, &s, "light", "Daylight Bone");
        assert_eq!(t["name"], "Daylight Bone");
        assert_eq!(t["type"], "light");
        assert_eq!(t["colors"]["editor.background"], "#FCFCFC");
        assert_eq!(t["colors"]["button.background"], "#FF9940");
        // white ink on the mid accent
        assert_eq!(t["colors"]["button.foreground"], "#FFFFFF");
        // alpha-appended role
        assert_eq!(t["colors"]["selection.background"], "#FF994040");
        // first key emitted matches build.py's order
        let first = t["colors"].as_object().unwrap().keys().next().unwrap();
        assert_eq!(first, "focusBorder");
    }

    #[test]
    fn generate_writes_and_prunes_theme_files() {
        let dir = std::env::temp_dir().join(format!("daylight-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let themes = dir.join("themes");
        std::fs::create_dir_all(&themes).unwrap();
        // a stale file that must be pruned
        std::fs::write(themes.join("old-color-theme.json"), "{}").unwrap();

        let d = json!({
            "roles": ["bg", "fg"],
            "meta": { "name": "x", "displayName": "X", "description": "d", "version": "1.0.0",
                      "publisher": "amrit", "lightPrefix": "Daylight", "darkPrefix": "Lamplight" },
            "families": { "bone": { "semantic": {
                "light": { "err": "#E65050", "warn": "#F2AE49", "info": "#399EE6", "ok": "#86B300",
                           "add": "#86B300", "mod": "#399EE6", "delete": "#E65050" },
                "dark":  { "err": "#E65050", "warn": "#F2AE49", "info": "#399EE6", "ok": "#86B300",
                           "add": "#86B300", "mod": "#399EE6", "delete": "#E65050" } } } },
            "themes": [{
                "name": "Bone", "family": "bone",
                "light": { "bg": "#FCFCFC", "alt": "#F3F4F5", "border": "#E7E8EA", "sel": "#E8ECEF",
                           "fg": "#5C6166", "comment": "#A0A6AC", "punct": "#A0A6AC", "op": "#ED9366",
                           "key": "#FA8D3E", "str": "#86B300", "num": "#A37ACC", "fn": "#F2AE49",
                           "type": "#399EE6", "prop": "#5C6166", "accent": "#FF9940" },
                "dark":  { "bg": "#16181A", "alt": "#1B1E20", "border": "#242829", "sel": "#2D3135",
                           "fg": "#C2C6C9", "comment": "#5C6166", "punct": "#5C6166", "op": "#F29668",
                           "key": "#FF8F40", "str": "#AAD94C", "num": "#D2A6FF", "fn": "#FFB454",
                           "type": "#59C2FF", "prop": "#C2C6C9", "accent": "#FFB454" }
            }]
        });

        let (files, pairs, _warns) = generate(&d, &dir).unwrap();
        assert_eq!(files, 2);
        assert_eq!(pairs, 1);
        assert!(themes.join("daylight-bone-color-theme.json").is_file());
        assert!(themes.join("lamplight-bone-color-theme.json").is_file());
        assert!(!themes.join("old-color-theme.json").exists(), "stale file not pruned");
        assert!(dir.join("package.json").is_file());
        let _ = std::fs::remove_dir_all(&dir);
    }

    /// Byte-for-byte fidelity: regenerate from the bundled palettes.json and
    /// compare each theme file to the Python-built `themes/` in the repo. Skips
    /// when the reference tree isn't beside the app (e.g. a shipped build).
    #[test]
    fn matches_python_theme_output() {
        let manifest = env!("CARGO_MANIFEST_DIR");
        let palettes = PathBuf::from(manifest).join("resources/palettes.json");
        let reference = PathBuf::from(manifest).join("../../themes");
        if !palettes.is_file() || !reference.is_dir() {
            eprintln!("no reference themes tree; skipping fidelity check");
            return;
        }
        let doc: Value = serde_json::from_str(&std::fs::read_to_string(&palettes).unwrap()).unwrap();
        let dir = std::env::temp_dir().join(format!("daylight-fidelity-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        generate(&doc, &dir).unwrap();

        let mut checked = 0;
        for entry in std::fs::read_dir(dir.join("themes")).unwrap().flatten() {
            let name = entry.file_name().into_string().unwrap();
            let ours = std::fs::read_to_string(entry.path()).unwrap();
            let theirs = std::fs::read_to_string(reference.join(&name))
                .unwrap_or_else(|_| panic!("python never produced {name}"));
            assert_eq!(ours, theirs, "{name} differs from the python build");
            checked += 1;
        }
        assert!(checked >= 30, "only checked {checked} files");
        eprintln!("fidelity: {checked} theme files identical to python");
        let _ = std::fs::remove_dir_all(&dir);
    }

    // ---- scheme parser -----------------------------------------------------

    const BASE16: &str = r##"
system: "base16"
name: "Ayu Light"
author: "Tinted Theming"
variant: "light"
palette:
  base00: "#f8f9fa"
  base05: "#5c6166"
  base0D: "#399ee6"
"##;

    const TINTED8: &str = r##"
scheme:
  system: "tinted8"
  supports:
    styling-spec: "0.2.0"
  author: "https://github.com/catppuccin"
  family: "Catppuccin"
  style: "Latte"
variant: "light"
palette:
  black: "#4c4f69" # crust
  white: "#dce0e8" # text
syntax:
  keyword.operator: "#179299"
"##;

    #[test]
    fn parses_a_base16_scheme() {
        let s = parse_scheme("ayu-light", BASE16).unwrap();
        assert_eq!(s.name, "Ayu Light");
        assert_eq!(s.variant, "light");
        assert_eq!(s.palette["base00"], "#f8f9fa");
        assert_eq!(s.palette.len(), 3);
    }

    #[test]
    fn parses_an_unquoted_scalar() {
        let s = parse_scheme("linux-vt", "name: Linux VT\nvariant: dark\npalette:\n  base00: \"#000000\"\n").unwrap();
        assert_eq!(s.name, "Linux VT");
        assert_eq!(s.variant, "dark");
    }

    #[test]
    fn strips_inline_comments_but_keeps_the_hex() {
        let s = parse_scheme("catppuccin-latte", TINTED8).unwrap();
        assert_eq!(s.palette["black"], "#4c4f69");
        assert_eq!(s.palette["white"], "#dce0e8");
    }

    #[test]
    fn names_a_tinted8_scheme_from_family_and_style() {
        let s = parse_scheme("catppuccin-latte", TINTED8).unwrap();
        assert_eq!(s.name, "Catppuccin Latte");
        assert_eq!(s.variant, "light");
    }

    #[test]
    fn ignores_the_syntax_block() {
        let s = parse_scheme("catppuccin-latte", TINTED8).unwrap();
        assert!(!s.palette.contains_key("keyword.operator"));
    }

    #[test]
    fn rejects_a_file_with_no_palette() {
        assert!(parse_scheme("x", "name: \"Nope\"\n").is_none());
    }
}

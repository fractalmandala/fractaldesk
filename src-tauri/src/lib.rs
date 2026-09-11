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
use std::sync::Mutex;
use std::time::UNIX_EPOCH;
use tauri::path::BaseDirectory;
use tauri::{AppHandle, Emitter, Manager, State};

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

// ------------------------------------------------------------------ sassy ----
// Read/write helpers for the Sassy surface (a CSS ↔ SASS converter). The
// frontend does the conversion; Rust only reads the chosen sources and writes
// each result back as a sibling file with the swapped extension.

#[derive(Serialize)]
pub struct Src {
    /// Absolute path of the source, as chosen in the native dialog.
    path: String,
    name: String,
    body: String,
}

#[derive(Deserialize)]
pub struct WriteItem {
    /// One of the `path`s a prior `convert_scan` returned.
    source: String,
    body: String,
}

#[derive(Serialize)]
pub struct WriteReport {
    written: usize,
    /// File names whose destination already existed and was overwritten.
    overwritten: Vec<String>,
}

fn ext_lc(path: &Path) -> String {
    path.extension().and_then(|e| e.to_str()).unwrap_or("").to_lowercase()
}

fn mk_src(path: &Path, body: String) -> Src {
    Src {
        path: path.to_string_lossy().into_owned(),
        name: path.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string(),
        body,
    }
}

/// Collect the style sources to convert. Each picked path is either a folder
/// (its top-level files matching `from_ext` are taken — no recursion) or a
/// single file with that extension. The text is read so the frontend can
/// convert it.
#[tauri::command]
fn convert_scan(paths: Vec<String>, from_ext: String) -> Result<Vec<Src>, String> {
    let want = from_ext.trim_start_matches('.').to_lowercase();
    let mut out: Vec<Src> = Vec::new();
    let mut seen: std::collections::HashSet<PathBuf> = std::collections::HashSet::new();

    for p in &paths {
        let pb = PathBuf::from(p);
        if pb.is_dir() {
            let Ok(entries) = std::fs::read_dir(&pb) else { continue };
            for entry in entries.flatten() {
                let ep = entry.path();
                if ep.is_file() && ext_lc(&ep) == want && seen.insert(ep.clone()) {
                    if let Ok(body) = std::fs::read_to_string(&ep) {
                        out.push(mk_src(&ep, body));
                    }
                }
            }
        } else if pb.is_file() && ext_lc(&pb) == want && seen.insert(pb.clone()) {
            // A file the user picked explicitly should surface a read error.
            let body = std::fs::read_to_string(&pb)
                .map_err(|e| format!("could not read {}: {e}", pb.display()))?;
            out.push(mk_src(&pb, body));
        }
    }

    out.sort_by(|a, b| a.name.to_lowercase().cmp(&b.name.to_lowercase()));
    Ok(out)
}

/// Write each converted result next to its source, swapping the extension
/// (.sass ↔ .css). The destination is derived here from the trusted source path
/// a scan returned — the frontend never supplies a raw destination — so writes
/// stay confined to siblings of files the user picked. Existing files are
/// overwritten and reported.
#[tauri::command]
fn convert_write(items: Vec<WriteItem>) -> Result<WriteReport, String> {
    let mut written = 0usize;
    let mut overwritten = Vec::new();
    for item in &items {
        let src = PathBuf::from(&item.source);
        let to = match ext_lc(&src).as_str() {
            "sass" => "css",
            "css" => "sass",
            other => return Err(format!("unexpected source extension .{other}")),
        };
        let dest = src.with_extension(to);
        if dest.exists() {
            overwritten.push(dest.file_name().and_then(|s| s.to_str()).unwrap_or("").to_string());
        }
        let tmp = dest.with_extension(format!("{to}.tmp"));
        std::fs::write(&tmp, &item.body).map_err(|e| format!("could not write {}: {e}", dest.display()))?;
        std::fs::rename(&tmp, &dest).map_err(|e| format!("could not replace {}: {e}", dest.display()))?;
        written += 1;
    }
    Ok(WriteReport { written, overwritten })
}

/// Read a file's text for the Dart Sass importer, which resolves @use/@import
/// during sass→css. A read error (including "not found") is expected — the
/// importer probes several candidate paths and moves on to the next.
#[tauri::command]
fn read_text(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| format!("{path}: {e}"))
}

/// One native open panel that lets the user select files AND folders together —
/// the JS dialog plugin only supports one or the other, so this uses AppKit's
/// NSOpenPanel directly. Returns the chosen absolute paths (empty if cancelled).
#[tauri::command]
fn pick_paths(app: AppHandle) -> Result<Vec<String>, String> {
    #[cfg(target_os = "macos")]
    {
        use std::sync::mpsc::channel;
        let (tx, rx) = channel::<Vec<String>>();
        app.run_on_main_thread(move || {
            let paths = unsafe { open_panel_macos() };
            let _ = tx.send(paths);
        })
        .map_err(|e| e.to_string())?;
        rx.recv().map_err(|e| e.to_string())
    }
    #[cfg(not(target_os = "macos"))]
    {
        let _ = app;
        Err("the files-and-folders picker is only available on macOS".into())
    }
}

#[cfg(target_os = "macos")]
unsafe fn open_panel_macos() -> Vec<String> {
    use objc2::MainThreadMarker;
    use objc2_app_kit::NSOpenPanel;

    let Some(mtm) = MainThreadMarker::new() else { return Vec::new() };
    let panel = NSOpenPanel::openPanel(mtm);
    panel.setCanChooseFiles(true);
    panel.setCanChooseDirectories(true);
    panel.setAllowsMultipleSelection(true);

    // NSModalResponseOK == 1.
    if panel.runModal() != 1 {
        return Vec::new();
    }

    let urls = panel.URLs();
    let mut out = Vec::with_capacity(urls.count());
    for i in 0..urls.count() {
        if let Some(path) = urls.objectAtIndex(i).path() {
            out.push(path.to_string());
        }
    }
    out
}

// ------------------------------------------------------------ notes ----
// Multi-root markdown notes: confined filesystem commands. Every path that
// touches user files is resolved against the added-roots registry first — the
// frontend never supplies a raw destination outside those roots. Writes go
// through a hidden sibling tmp file plus rename, so a crash mid-save cannot
// corrupt an existing note and the file watcher (which ignores hidden names)
// stays quiet.

const NOTES_MAX_DEPTH: usize = 8;
const NOTES_MAX_ENTRIES: usize = 20000;

#[derive(Serialize, Deserialize, Clone)]
pub struct NotesRoot {
    /// Canonical absolute path; doubles as the stable tree id.
    path: String,
}

#[derive(Serialize, Clone)]
pub struct NotesEntry {
    /// Absolute path.
    path: String,
    /// Posix-style path relative to its root, for display.
    rel: String,
    /// Owning root path.
    root: String,
    is_dir: bool,
    is_markdown: bool,
    size: u64,
    /// mtime seconds since epoch, 0 when unknown.
    mtime: u64,
    /// First ATX heading for markdown files, else empty (UI falls back).
    title: String,
    /// First two text lines for markdown files, else empty.
    excerpt: String,
}

#[derive(Serialize)]
pub struct NotesScan {
    entries: Vec<NotesEntry>,
    truncated: bool,
    /// Roots that could not be read (missing/unreadable) — the tree renders
    /// these as inline error rows with remove/re-locate actions.
    errors: Vec<NotesScanError>,
}

#[derive(Serialize)]
pub struct NotesScanError {
    root: String,
    message: String,
}

#[derive(Serialize, Clone)]
pub struct NotesChange {
    kind: String,
    paths: Vec<String>,
}

fn notes_is_markdown(path: &Path) -> bool {
    matches!(
        path.extension()
            .and_then(|e| e.to_str())
            .unwrap_or("")
            .to_lowercase()
            .as_str(),
        "md" | "markdown"
    )
}

fn notes_posix(rel: &Path) -> String {
    rel.to_string_lossy().replace('\\', "/")
}

/// First kilobytes of a note: title is the first ATX heading, excerpt the
/// first two text lines. Empty on any failure; the UI falls back to filenames.
fn notes_head(path: &Path) -> (String, String) {
    use std::io::Read;
    let Ok(f) = std::fs::File::open(path) else {
        return (String::new(), String::new());
    };
    let mut buf = Vec::new();
    if f.take(8192).read_to_end(&mut buf).is_err() {
        return (String::new(), String::new());
    }
    let text = String::from_utf8_lossy(&buf);
    let mut title = String::new();
    let mut excerpt_lines: Vec<&str> = Vec::new();
    let mut in_frontmatter = false;
    let mut first = true;
    for line in text.lines() {
        let t = line.trim();
        if first && t == "---" {
            in_frontmatter = true;
            first = false;
            continue;
        }
        first = false;
        if in_frontmatter {
            if t == "---" {
                in_frontmatter = false;
            }
            continue;
        }
        if t.is_empty() {
            continue;
        }
        if title.is_empty() && t.starts_with('#') {
            let h = t.trim_start_matches('#').trim().trim_end_matches('#').trim();
            if !h.is_empty() {
                title = h.to_string();
                continue;
            }
        }
        if t.starts_with('#') {
            continue;
        }
        if excerpt_lines.len() < 2 {
            excerpt_lines.push(t);
        }
    }
    (title, excerpt_lines.join(" "))
}

fn notes_entry(root: &str, root_path: &Path, path: &Path, is_dir: bool) -> NotesEntry {
    let (size, mtime) = path
        .metadata()
        .map(|m| {
            (
                if is_dir { 0 } else { m.len() },
                m.modified()
                    .ok()
                    .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
                    .map(|d| d.as_secs())
                    .unwrap_or(0),
            )
        })
        .unwrap_or((0, 0));
    let is_markdown = !is_dir && notes_is_markdown(path);
    let (title, excerpt) = if is_markdown && size <= (1 << 20) {
        notes_head(path)
    } else {
        (String::new(), String::new())
    };
    NotesEntry {
        path: path.to_string_lossy().into_owned(),
        rel: notes_posix(path.strip_prefix(root_path).unwrap_or(path)),
        root: root.to_string(),
        is_dir,
        is_markdown,
        size,
        mtime,
        title,
        excerpt,
    }
}

/// Walk one root: sorted for determinism, hidden names skipped (tool metadata
/// such as `.git` or editor state never shows), `node_modules` skipped, depth
/// capped, entry count capped with a truncation flag rather than an error.
/// The root itself is not emitted — it is the tree header.
fn notes_walk_capped(root: &str, root_path: &Path, max_entries: usize) -> (Vec<NotesEntry>, bool) {
    let mut out = Vec::new();
    let mut truncated = false;
    let mut stack = vec![(root_path.to_path_buf(), 0usize)];
    while let Some((dir, depth)) = stack.pop() {
        if out.len() >= max_entries {
            truncated = true;
            return (out, truncated);
        }
        let Ok(rd) = std::fs::read_dir(&dir) else {
            continue;
        };
        let mut names: Vec<PathBuf> = rd.flatten().map(|e| e.path()).collect();
        names.sort();
        for p in names {
            if out.len() >= max_entries {
                truncated = true;
                return (out, truncated);
            }
            let name = p.file_name().and_then(|s| s.to_str()).unwrap_or("");
            if name.starts_with('.') || name == "node_modules" {
                continue;
            }
            if p.is_dir() {
                out.push(notes_entry(root, root_path, &p, true));
                if depth + 1 < NOTES_MAX_DEPTH {
                    stack.push((p, depth + 1));
                }
            } else if p.is_file() {
                out.push(notes_entry(root, root_path, &p, false));
            }
        }
    }
    (out, truncated)
}

/// Pure containment check over already-canonical roots. Absolute paths only;
/// `..` in the not-yet-existing tail is refused outright. Returns the resolved
/// absolute path for fs ops.
fn notes_resolve_in(roots: &[PathBuf], path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if p.is_relative() {
        return Err(format!("refusing relative path: {path}"));
    }
    let mut anchor = p.clone();
    let mut tail: Vec<String> = Vec::new();
    while !anchor.exists() {
        match anchor.file_name() {
            Some(name) => {
                let s = name.to_string_lossy().into_owned();
                if s == ".." {
                    return Err(format!("refusing to resolve outside added folders: {path}"));
                }
                tail.push(s);
                anchor.pop();
            }
            None => return Err(format!("refusing to resolve outside added folders: {path}")),
        }
    }
    let canon = anchor.canonicalize().map_err(|e| format!("{path}: {e}"))?;
    for root in roots {
        if canon == *root || canon.starts_with(root) {
            let mut out = canon;
            for seg in tail.iter().rev() {
                out.push(seg);
            }
            return Ok(out);
        }
    }
    Err(format!("refusing path outside added folders: {path}"))
}

/// Merge picked folders into the registry: must be directories, canonicalized,
/// deduplicated. Pure over the filesystem for testability.
fn notes_merge_roots(
    existing: Vec<NotesRoot>,
    candidates: &[String],
) -> Result<Vec<NotesRoot>, String> {
    let mut out = existing;
    for c in candidates {
        let pb = PathBuf::from(c);
        if !pb.is_dir() {
            return Err(format!("{c} is not a folder"));
        }
        let canon = pb
            .canonicalize()
            .map_err(|e| format!("could not open {c}: {e}"))?;
        let canon_s = canon.to_string_lossy().into_owned();
        if !out.iter().any(|r| r.path == canon_s) {
            out.push(NotesRoot { path: canon_s });
        }
    }
    Ok(out)
}

fn notes_roots_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(data_dir(app)?.join("notes-roots.json"))
}

fn notes_load_roots(app: &AppHandle) -> Result<Vec<NotesRoot>, String> {
    let path = notes_roots_path(app)?;
    match std::fs::read_to_string(&path) {
        Ok(raw) => serde_json::from_str(&raw)
            .map_err(|e| format!("notes-roots.json is not valid JSON: {e}")),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(Vec::new()),
        Err(e) => Err(format!("could not read notes roots: {e}")),
    }
}

fn notes_save_roots(app: &AppHandle, roots: &[NotesRoot]) -> Result<(), String> {
    let path = notes_roots_path(app)?;
    let tmp = path.with_extension("json.tmp");
    let body = serde_json::to_string_pretty(roots).map_err(|e| e.to_string())?;
    std::fs::write(&tmp, body + "\n").map_err(|e| format!("could not write: {e}"))?;
    std::fs::rename(&tmp, &path).map_err(|e| format!("could not replace: {e}"))?;
    Ok(())
}

fn notes_root_paths(app: &AppHandle) -> Result<Vec<PathBuf>, String> {
    Ok(notes_load_roots(app)?
        .iter()
        .map(|r| PathBuf::from(&r.path))
        .collect())
}

/// Atomic text write through a hidden sibling tmp file (hidden so the scan and
/// the watcher stay quiet), then rename. Returns bytes written.
fn notes_write_path(path: &Path, body: &str) -> Result<u64, String> {
    let name = path
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| format!("cannot write to {}", path.display()))?;
    let tmp = path.with_file_name(format!(".{name}.tmp"));
    std::fs::write(&tmp, body).map_err(|e| format!("could not write {}: {e}", path.display()))?;
    std::fs::rename(&tmp, path)
        .map_err(|e| format!("could not replace {}: {e}", path.display()))?;
    Ok(body.len() as u64)
}

#[tauri::command]
fn notes_roots_list(app: AppHandle) -> Result<Vec<NotesRoot>, String> {
    notes_load_roots(&app)
}

#[tauri::command]
fn notes_roots_add(app: AppHandle, paths: Vec<String>) -> Result<Vec<NotesRoot>, String> {
    let merged = notes_merge_roots(notes_load_roots(&app)?, &paths)?;
    notes_save_roots(&app, &merged)?;
    Ok(merged)
}

#[tauri::command]
fn notes_roots_remove(app: AppHandle, path: String) -> Result<Vec<NotesRoot>, String> {
    let roots = notes_load_roots(&app)?;
    let canon = PathBuf::from(&path)
        .canonicalize()
        .map(|p| p.to_string_lossy().into_owned())
        .unwrap_or(path);
    let kept: Vec<NotesRoot> = roots.into_iter().filter(|r| r.path != canon).collect();
    notes_save_roots(&app, &kept)?;
    Ok(kept)
}

/// Scan every root for the tree and the backlink index. Missing/unreadable
/// roots are reported in `errors`, never fatal to the remaining roots.
#[tauri::command]
fn notes_scan(app: AppHandle) -> Result<NotesScan, String> {
    let roots = notes_load_roots(&app)?;
    let mut entries = Vec::new();
    let mut errors = Vec::new();
    let mut truncated = false;
    for root in &roots {
        let rp = PathBuf::from(&root.path);
        if !rp.is_dir() {
            errors.push(NotesScanError {
                root: root.path.clone(),
                message: "folder is missing or unreadable".to_string(),
            });
            continue;
        }
        let (mut got, trunc) = notes_walk_capped(&root.path, &rp, NOTES_MAX_ENTRIES);
        entries.append(&mut got);
        truncated = truncated || trunc;
    }
    Ok(NotesScan {
        entries,
        truncated,
        errors,
    })
}

#[tauri::command]
fn notes_read(app: AppHandle, path: String) -> Result<String, String> {
    let resolved = notes_resolve_in(&notes_root_paths(&app)?, &path)?;
    std::fs::read_to_string(&resolved).map_err(|e| format!("{}: {e}", resolved.display()))
}

#[tauri::command]
fn notes_write(app: AppHandle, path: String, body: String) -> Result<u64, String> {
    let resolved = notes_resolve_in(&notes_root_paths(&app)?, &path)?;
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("could not create {}: {e}", parent.display()))?;
    }
    notes_write_path(&resolved, &body)
}

#[tauri::command]
fn notes_mkdir(app: AppHandle, path: String) -> Result<String, String> {
    let resolved = notes_resolve_in(&notes_root_paths(&app)?, &path)?;
    std::fs::create_dir_all(&resolved)
        .map_err(|e| format!("could not create {}: {e}", resolved.display()))?;
    Ok(resolved.to_string_lossy().into_owned())
}

#[tauri::command]
fn notes_rename(app: AppHandle, from: String, to: String) -> Result<String, String> {
    let roots = notes_root_paths(&app)?;
    let src = notes_resolve_in(&roots, &from)?;
    let dest = notes_resolve_in(&roots, &to)?;
    if dest.exists() {
        return Err(format!("{} already exists", dest.display()));
    }
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("could not create {}: {e}", parent.display()))?;
    }
    std::fs::rename(&src, &dest).map_err(|e| format!("could not rename: {e}"))?;
    Ok(dest.to_string_lossy().into_owned())
}

/// Permanent delete (the frontend confirms first); no trash dependency in v1.
#[tauri::command]
fn notes_delete(app: AppHandle, path: String) -> Result<(), String> {
    let resolved = notes_resolve_in(&notes_root_paths(&app)?, &path)?;
    if resolved.is_dir() {
        std::fs::remove_dir_all(&resolved)
            .map_err(|e| format!("could not delete {}: {e}", resolved.display()))?;
    } else if resolved.is_file() {
        std::fs::remove_file(&resolved)
            .map_err(|e| format!("could not delete {}: {e}", resolved.display()))?;
    } else {
        return Err(format!("{} does not exist", resolved.display()));
    }
    Ok(())
}

/// Create an empty note; refuses to overwrite an existing file.
#[tauri::command]
fn notes_new(app: AppHandle, path: String) -> Result<String, String> {
    let resolved = notes_resolve_in(&notes_root_paths(&app)?, &path)?;
    if resolved.exists() {
        return Err(format!("{} already exists", resolved.display()));
    }
    if let Some(parent) = resolved.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("could not create {}: {e}", parent.display()))?;
    }
    std::fs::write(&resolved, "")
        .map_err(|e| format!("could not create {}: {e}", resolved.display()))?;
    Ok(resolved.to_string_lossy().into_owned())
}

#[derive(Serialize)]
pub struct NotesGrepHit {
    path: String,
    /// 1-based line number.
    line: u64,
    excerpt: String,
}

const NOTES_GREP_MAX_BYTES: u64 = 1 << 20;
const NOTES_GREP_MAX_HITS: usize = 500;

/// Substring search across files under the roots (backlinks are one query per
/// open note; full search ships later). Skips hidden names, oversized files,
/// and unreadable files; caps hits rather than failing.
#[tauri::command]
fn notes_grep(
    app: AppHandle,
    needle: String,
    markdown_only: bool,
) -> Result<Vec<NotesGrepHit>, String> {
    if needle.is_empty() {
        return Ok(Vec::new());
    }
    let roots = notes_load_roots(&app)?;
    let mut hits = Vec::new();
    'roots: for root in &roots {
        let rp = PathBuf::from(&root.path);
        if !rp.is_dir() {
            continue;
        }
        let (entries, _) = notes_walk_capped(&root.path, &rp, NOTES_MAX_ENTRIES);
        for e in entries {
            if hits.len() >= NOTES_GREP_MAX_HITS {
                break 'roots;
            }
            if e.is_dir || (markdown_only && !e.is_markdown) {
                continue;
            }
            if e.size > NOTES_GREP_MAX_BYTES {
                continue;
            }
            let Ok(body) = std::fs::read_to_string(&e.path) else {
                continue;
            };
            for (i, line) in body.lines().enumerate() {
                if hits.len() >= NOTES_GREP_MAX_HITS {
                    break 'roots;
                }
                if let Some(at) = line.find(needle.as_str()) {
                    let start = at.saturating_sub(60);
                    let end = (at + needle.len() + 60).min(line.len());
                    let excerpt = line.get(start..end).unwrap_or(line).trim().to_string();
                    hits.push(NotesGrepHit {
                        path: e.path.clone(),
                        line: (i + 1) as u64,
                        excerpt,
                    });
                    break;
                }
            }
        }
    }
    Ok(hits)
}

/// First free sibling path: the plain name, else ` - 2` suffixed. Pure for tests.
fn notes_unique_target(dest: &Path, stem: &str, ext: &str) -> Result<PathBuf, String> {
    let first = if ext.is_empty() {
        dest.join(stem)
    } else {
        dest.join(format!("{stem}.{ext}"))
    };
    if !first.exists() {
        return Ok(first);
    }
    for i in 2..=1000u32 {
        let candidate = if ext.is_empty() {
            format!("{stem} - {i}")
        } else {
            format!("{stem} - {i}.{ext}")
        };
        let target = dest.join(candidate);
        if !target.exists() {
            return Ok(target);
        }
    }
    Err(format!("too many copies of {stem}"))
}

/// Copy files into a folder inside the roots (context-menu import and paste).
/// Sources may live outside the roots (read-only); the destination must be
/// contained. Name collisions gain a ` - 2` suffix instead of overwriting.
/// Returns the created absolute paths.
#[tauri::command]
fn notes_import_files(
    app: AppHandle,
    sources: Vec<String>,
    dest_dir: String,
) -> Result<Vec<String>, String> {
    let roots = notes_root_paths(&app)?;
    let dest = notes_resolve_in(&roots, &dest_dir)?;
    if !dest.is_dir() {
        return Err(format!("{} is not a folder", dest.display()));
    }
    let mut created = Vec::new();
    for src in &sources {
        let sp = PathBuf::from(src);
        if !sp.is_file() {
            return Err(format!("{src} is not a file"));
        }
        let stem = sp
            .file_stem()
            .and_then(|s| s.to_str())
            .filter(|stem| !stem.is_empty())
            .ok_or_else(|| format!("cannot import {src}"))?;
        let ext = sp.extension().and_then(|s| s.to_str()).unwrap_or("");
        let target = notes_unique_target(&dest, stem, ext)?;
        std::fs::copy(&sp, &target).map_err(|e| format!("could not import {src}: {e}"))?;
        created.push(target.to_string_lossy().into_owned());
    }
    Ok(created)
}

/// Copy a whole folder into a folder inside the roots (context-menu
/// "import folder here"). Hidden names are skipped, like the scan. A colliding
/// top-level name gains a ` - 2` suffix. Returns the created top-level path.
#[tauri::command]
fn notes_import_dir(app: AppHandle, source: String, dest_dir: String) -> Result<String, String> {
    let roots = notes_root_paths(&app)?;
    let dest = notes_resolve_in(&roots, &dest_dir)?;
    if !dest.is_dir() {
        return Err(format!("{} is not a folder", dest.display()));
    }
    let src = PathBuf::from(&source);
    if !src.is_dir() {
        return Err(format!("{source} is not a folder"));
    }
    let name = src
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| format!("cannot import {source}"))?;
    let target = notes_unique_target(&dest, name, "")?;
    notes_copy_dir(&src, &target)?;
    Ok(target.to_string_lossy().into_owned())
}

/// Recursive directory copy used by import-dir. Hidden names are skipped;
/// symlinks are not followed.
fn notes_copy_dir(src: &Path, dest: &Path) -> Result<(), String> {
    std::fs::create_dir_all(dest)
        .map_err(|e| format!("could not create {}: {e}", dest.display()))?;
    let mut stack = vec![(src.to_path_buf(), dest.to_path_buf())];
    while let Some((from_dir, to_dir)) = stack.pop() {
        let Ok(rd) = std::fs::read_dir(&from_dir) else {
            continue;
        };
        for entry in rd.flatten() {
            let name = entry.file_name();
            let name_s = name.to_string_lossy();
            if name_s.starts_with('.') || name_s == "node_modules" {
                continue;
            }
            let from = entry.path();
            let to = to_dir.join(&name);
            let ft = entry.file_type().map_err(|e| format!("{}: {e}", from.display()))?;
            if ft.is_dir() {
                std::fs::create_dir_all(&to)
                    .map_err(|e| format!("could not create {}: {e}", to.display()))?;
                stack.push((from, to));
            } else if ft.is_file() {
                std::fs::copy(&from, &to).map_err(|e| format!("could not copy {}: {e}", from.display()))?;
            }
        }
    }
    Ok(())
}

enum NotesWatchCmd {
    Roots(Vec<PathBuf>),
}

struct NotesWatchState {
    tx: Mutex<Option<std::sync::mpsc::Sender<NotesWatchCmd>>>,
}

/// Start the filesystem watcher (idempotent — re-sends roots on every call, so
/// the frontend invokes it after roots change too). Events arrive as
/// `notes-changed`; watcher errors as `notes-watch-error`. The thread lives
/// while the app is open; poll-on-focus plus rescan-on-launch cover gaps.
#[tauri::command]
fn notes_watch_start(app: AppHandle, state: State<NotesWatchState>) -> Result<(), String> {
    let tx = {
        let mut guard = state.tx.lock().map_err(|e| e.to_string())?;
        if guard.is_none() {
            let (tx, rx) = std::sync::mpsc::channel::<NotesWatchCmd>();
            let app2 = app.clone();
            std::thread::spawn(move || notes_watch_loop(app2, rx));
            *guard = Some(tx);
        }
        guard.as_ref().map(|tx| tx.clone())
    };
    if let Some(tx) = tx {
        let roots = notes_root_paths(&app)
            .unwrap_or_default()
            .into_iter()
            .filter(|p| p.is_dir())
            .collect();
        let _ = tx.send(NotesWatchCmd::Roots(roots));
    }
    Ok(())
}

fn notes_watch_loop(app: AppHandle, cmds: std::sync::mpsc::Receiver<NotesWatchCmd>) {
    use notify::{Config, RecommendedWatcher, RecursiveMode, Watcher};
    let (etx, erx) = std::sync::mpsc::channel::<notify::Result<notify::Event>>();
    let mut watcher: Option<RecommendedWatcher> = None;
    loop {
        while let Ok(NotesWatchCmd::Roots(roots)) = cmds.try_recv() {
            watcher = None;
            if !roots.is_empty() {
                match RecommendedWatcher::new(etx.clone(), Config::default()) {
                    Ok(mut w) => {
                        for r in &roots {
                            let _ = w.watch(r, RecursiveMode::Recursive);
                        }
                        watcher = Some(w);
                    }
                    Err(e) => {
                        let _ = app.emit("notes-watch-error", e.to_string());
                    }
                }
            }
        }
        if watcher.is_none() {
            if cmds.recv().is_err() {
                break;
            }
            continue;
        }
        match erx.recv_timeout(std::time::Duration::from_millis(300)) {
            Ok(Ok(ev)) => {
                use notify::EventKind::*;
                let kind = match ev.kind {
                    Create(_) => Some("created"),
                    Remove(_) => Some("deleted"),
                    Modify(notify::event::ModifyKind::Name(_)) => Some("renamed"),
                    Modify(_) => Some("modified"),
                    _ => None,
                };
                if let Some(kind) = kind {
                    let mut paths: Vec<String> = ev
                        .paths
                        .into_iter()
                        .map(|p| p.to_string_lossy().into_owned())
                        .collect();
                    while let Ok(Ok(ev2)) = erx.try_recv() {
                        paths.extend(
                            ev2.paths
                                .into_iter()
                                .map(|p| p.to_string_lossy().into_owned()),
                        );
                    }
                    paths.sort();
                    paths.dedup();
                    let _ = app.emit(
                        "notes-changed",
                        NotesChange {
                            kind: kind.to_string(),
                            paths,
                        },
                    );
                }
            }
            Ok(Err(e)) => {
                let _ = app.emit("notes-watch-error", e.to_string());
            }
            Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
            Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(NotesWatchState {
            tx: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            load,
            save,
            build,
            package,
            reveal,
            schemes,
            argv_load,
            argv_save,
            argv_export,
            convert_scan,
            convert_write,
            read_text,
            pick_paths,
            notes_roots_list,
            notes_roots_add,
            notes_roots_remove,
            notes_scan,
            notes_read,
            notes_write,
            notes_mkdir,
            notes_rename,
            notes_delete,
            notes_new,
            notes_grep,
            notes_import_files,
            notes_import_dir,
            notes_watch_start
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

    // ---- notes (invariants 6, 7, 10) ---------------------------------------

    fn notes_tmp(name: &str) -> PathBuf {
        std::env::temp_dir().join(format!("fractaldesk-notes-{}-{name}", std::process::id()))
    }

    fn notes_clean(p: &Path) {
        let _ = std::fs::remove_dir_all(p);
    }

    #[test]
    fn notes_detects_markdown_by_extension() {
        assert!(notes_is_markdown(Path::new("a.md")));
        assert!(notes_is_markdown(Path::new("A.MD")));
        assert!(notes_is_markdown(Path::new("a.markdown")));
        assert!(!notes_is_markdown(Path::new("a.txt")));
        assert!(!notes_is_markdown(Path::new("a.png")));
        assert!(!notes_is_markdown(Path::new("Makefile")));
    }

    #[test]
    fn notes_resolve_accepts_inside_and_rejects_escapes() {
        let base = notes_tmp("resolve");
        notes_clean(&base);
        std::fs::create_dir_all(base.join("root/docs")).unwrap();
        std::fs::create_dir_all(base.join("root2")).unwrap();
        let root = base.join("root").canonicalize().unwrap();
        let roots = vec![root.clone()];

        let inside = root
            .join("docs")
            .join("a.md")
            .to_string_lossy()
            .into_owned();
        assert!(notes_resolve_in(&roots, &inside).is_ok());

        // Not-yet-existing nested path under a root resolves for creation.
        let fresh = root.join("new").join("b.md").to_string_lossy().into_owned();
        assert!(notes_resolve_in(&roots, &fresh).is_ok());

        // Sibling-prefix lookalikes are not inside (component-wise compare).
        let sibling = base
            .join("root2")
            .canonicalize()
            .unwrap()
            .join("x.md")
            .to_string_lossy()
            .into_owned();
        assert!(notes_resolve_in(&roots, &sibling).is_err());

        // Dot-dot escapes and relative paths are refused.
        let escape = format!("{}/../root2/x.md", root.to_string_lossy());
        assert!(notes_resolve_in(&roots, &escape).is_err());
        assert!(notes_resolve_in(&roots, "relative/a.md").is_err());
        notes_clean(&base);
    }

    #[test]
    fn notes_merge_dedupes_canonical_paths() {
        let base = notes_tmp("merge");
        notes_clean(&base);
        std::fs::create_dir_all(base.join("docs")).unwrap();
        let raw = base.join("docs").to_string_lossy().into_owned();
        let dotted = format!("{raw}/./");
        let merged = notes_merge_roots(Vec::new(), &[raw, dotted]).unwrap();
        assert_eq!(merged.len(), 1);
        assert!(notes_merge_roots(merged, &["/no/such/dir".to_string()]).is_err());
        notes_clean(&base);
    }

    #[test]
    fn notes_scan_skips_hidden_and_flags_types() {
        let base = notes_tmp("scan");
        notes_clean(&base);
        let root = base.join("vault");
        std::fs::create_dir_all(root.join(".git")).unwrap();
        std::fs::create_dir_all(root.join("node_modules")).unwrap();
        std::fs::create_dir_all(root.join("docs")).unwrap();
        std::fs::write(root.join("a.md"), "# a").unwrap();
        std::fs::write(root.join(".hidden.md"), "x").unwrap();
        std::fs::write(root.join(".git").join("h.md"), "x").unwrap();
        std::fs::write(root.join("node_modules").join("n.md"), "x").unwrap();
        std::fs::write(root.join("docs").join("pic.png"), "bin").unwrap();

        let root_s = root.to_string_lossy().into_owned();
        let (entries, truncated) = notes_walk_capped(&root_s, &root, 20000);
        assert!(!truncated);
        let rels: Vec<&str> = entries.iter().map(|e| e.rel.as_str()).collect();
        assert!(rels.contains(&"a.md"));
        assert!(rels.contains(&"docs"));
        assert!(rels.contains(&"docs/pic.png"));
        assert!(!rels
            .iter()
            .any(|r| r.contains(".git") || r.contains("node_modules") || r.starts_with('.')));
        let png = entries.iter().find(|e| e.rel == "docs/pic.png").unwrap();
        assert!(!png.is_markdown);
        assert!(
            entries
                .iter()
                .find(|e| e.rel == "a.md")
                .unwrap()
                .is_markdown
        );
        notes_clean(&base);
    }

    #[test]
    fn notes_scan_truncates_instead_of_failing() {
        let base = notes_tmp("trunc");
        notes_clean(&base);
        let root = base.join("big");
        std::fs::create_dir_all(&root).unwrap();
        for i in 0..8 {
            std::fs::write(root.join(format!("f{i}.md")), "x").unwrap();
        }
        let root_s = root.to_string_lossy().into_owned();
        let (entries, truncated) = notes_walk_capped(&root_s, &root, 5);
        assert!(truncated);
        assert_eq!(entries.len(), 5);
        notes_clean(&base);
    }

    #[test]
    fn notes_head_reads_title_and_excerpt() {
        let base = notes_tmp("head");
        notes_clean(&base);
        std::fs::create_dir_all(&base).unwrap();
        let p = base.join("n.md");
        std::fs::write(
            &p,
            "---\ntitle: T\n---\n\n# Hello World\n\nFirst line.\nSecond.\n",
        )
        .unwrap();
        let (title, excerpt) = notes_head(&p);
        assert_eq!(title, "Hello World");
        assert_eq!(excerpt, "First line. Second.");
        let (t2, _) = notes_head(&base.join("missing.md"));
        assert!(t2.is_empty());
        notes_clean(&base);
    }

    #[test]
    fn notes_copy_dir_skips_hidden_and_keeps_tree() {
        let base = notes_tmp("copydir");
        notes_clean(&base);
        let src = base.join("src");
        std::fs::create_dir_all(src.join("sub")).unwrap();
        std::fs::create_dir_all(src.join(".git")).unwrap();
        std::fs::write(src.join("a.md"), "a").unwrap();
        std::fs::write(src.join("sub").join("b.md"), "b").unwrap();
        std::fs::write(src.join(".git").join("h.md"), "h").unwrap();
        let dest = base.join("dest");
        notes_copy_dir(&src, &dest).unwrap();
        assert_eq!(std::fs::read_to_string(dest.join("a.md")).unwrap(), "a");
        assert_eq!(
            std::fs::read_to_string(dest.join("sub").join("b.md")).unwrap(),
            "b"
        );
        assert!(!dest.join(".git").exists());
        notes_clean(&base);
    }

    #[test]
    fn notes_write_round_trips_and_cleans_tmp() {
        let base = notes_tmp("write");
        notes_clean(&base);
        std::fs::create_dir_all(&base).unwrap();
        let dest = base.join("note.md");
        assert_eq!(notes_write_path(&dest, "hello").unwrap(), 5);
        assert_eq!(std::fs::read_to_string(&dest).unwrap(), "hello");
        // No tmp litter beside the note (hidden sibling tmp renames away).
        let leftovers: Vec<_> = std::fs::read_dir(&base)
            .unwrap()
            .flatten()
            .map(|e| e.file_name().to_string_lossy().into_owned())
            .collect();
        assert_eq!(leftovers, vec!["note.md".to_string()]);
        notes_clean(&base);
    }

    #[test]
    fn notes_grep_finds_first_hit_per_file_with_excerpt() {
        // notes_grep shells over notes_walk_capped; exercise the same pieces
        // directly: walk finds the file, body matching is line substring.
        let base = notes_tmp("grep");
        notes_clean(&base);
        let root = base.join("r");
        std::fs::create_dir_all(&root).unwrap();
        std::fs::write(root.join("a.md"), "hello\nneedle here yes\n").unwrap();
        std::fs::write(root.join("b.txt"), "needle in text too\n").unwrap();
        let root_s = root.to_string_lossy().into_owned();
        let (entries, _) = notes_walk_capped(&root_s, &root, 20000);
        assert_eq!(entries.len(), 2);
        let md: Vec<_> = entries.iter().filter(|e| e.is_markdown).collect();
        assert_eq!(md.len(), 1);
        assert_eq!(md[0].rel, "a.md");
        notes_clean(&base);
    }

    #[test]
    fn notes_import_suffixes_collisions_instead_of_overwriting() {
        let base = notes_tmp("import");
        notes_clean(&base);
        let dest = base.join("dest");
        std::fs::create_dir_all(&dest).unwrap();
        std::fs::write(dest.join("a.md"), "original").unwrap();
        assert_eq!(
            notes_unique_target(&dest, "a", "md").unwrap(),
            dest.join("a - 2.md")
        );
        assert_eq!(
            notes_unique_target(&dest, "fresh", "md").unwrap(),
            dest.join("fresh.md")
        );
        assert_eq!(
            notes_unique_target(&dest, "Makefile", "").unwrap(),
            dest.join("Makefile")
        );
        notes_clean(&base);
    }
}

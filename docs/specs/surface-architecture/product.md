---
title: Surface Architecture Product Spec
description: Behavior of the uniform surface contract, registry-driven shell, state separation, persistence hook, and bus.
created: 2026-09-11
updated: 2026-09-11
type: spec
---

## Summary

FractalDesk hosts several unrelated activity types ("surfaces") in one Tauri window. Today the
shell — `src/routes/+page.svelte` — imports every surface, holds each surface's toolbar and
handlers, dispatches with an `{#if}/{:else if}` chain, and mixes surface-specific data into the
global `app` rune. This spec defines a uniform **surface contract** so each surface is a
self-contained module, the shell only dispatches to it from the `STATES` registry, surface state
lives with its surface, persistence is declared per surface, and surfaces communicate through a
small event bus instead of by widening `app`. The whole change is internal architecture: **no
end-user-visible behavior of any existing surface may change.**

## Problem

The "user" of this spec is the **developer** adding or maintaining a surface. Two failures of the
current structure motivate it:

- **God-component growth.** Every new surface lengthens `+page.svelte` and edits shared markup,
  so surfaces are coupled through the shell.
- **A live collision.** `+page.svelte:148-149` (the Argv toolbar) calls `reset` — undefined in
  the shell — and `save()`, which at `+page.svelte:52` is *Themes'* save (it snapshots
  `app.doc`). Two surfaces' logic already collided in the shared shell. The contract must make
  this class of bug structurally impossible.

## Goals

- A single, uniform definition of what a "surface" is, used by all surfaces (today only `sass/`
  and `untw/` have a state module; `argv/` is loose `.js`; Themes/Schemes have none).
- The shell (`+page.svelte`) reduced to app chrome plus registry-driven dispatch, with no
  surface-specific handlers or state.
- Global `app` limited to shell state; every surface owns its own state.
- Persistence (load/save/build/package/on-disk) declared by the surface, not the shell.
- A defined channel for future cross-surface actions that never widens `app`.

## Behavior

### The surface contract

1. A surface is a folder `src/lib/surfaces/<id>/` where `<id>` equals the surface's `STATES.id`.
   Every surface — including Themes, Schemes, Argv — follows the same folder shape; there are no
   longer three different conventions.
2. Each surface folder exposes a uniform contract: a root component to render, its reactive state
   module (the `$state` pattern already used by `src/lib/sass/state.svelte.ts` and
   `src/lib/untw/state.svelte.ts`), an optional header-toolbar, and optional persistence hooks
   (below). A surface that needs no toolbar or no persistence simply omits those parts, and the
   shell renders correctly without them.
3. The `STATES` registry (`src/lib/states.js`) remains the single source of truth for which
   surfaces exist, their `id`, `label`, `full` layout flag, and optional `badge`. Each entry
   additionally references its surface module so the shell can render it without importing every
   surface by hand.
4. Adding a surface requires exactly: (a) one new `STATES` entry, and (b) one new
   `surfaces/<id>/` folder implementing the contract. It requires **no** edits to `+page.svelte`.
   Removing a surface requires deleting its entry and folder, with no other shell edits.

### Registry-driven rendering

5. The shell renders the active surface's component by looking it up from the registry via
   `app.view`. There is no `{#if app.view === …}/{:else if …}` chain enumerating surfaces in the
   shell body.
6. The active surface's toolbar (if it declares one) renders in the header's `.conditional` zone,
   also resolved from the registry — not from a per-surface `{#if}` chain in the header. A surface
   with no toolbar contributes nothing to the header and leaves layout unchanged.
7. The `full` vs. sidebar (`250px`) layout is still driven by the registry `full` flag, and the
   Themes exception is preserved: Themes uses the full width while its document is not yet loaded
   (loading/error placeholder centered), and the sidebar layout once loaded.
8. When `app.view` matches no registered surface, the shell shows the existing fallback picker
   listing every registered surface; choosing one sets `app.view`. The picker is generated from
   the registry (as it is today).
9. The app-wide chrome is unchanged and stays in the shell: the title, the surface switcher built
   from `STATES`, the shared status message (`app.msg`/`app.kind`), and the Tauri drag regions.

### State ownership

10. Global `app` holds **only** shell/nav state: `view`, `busy`, `msg`, `kind` (plus the `say()`
    helper and any strictly app-wide UI state). It does not hold data owned by one surface.
11. Themes-owned fields currently in `app` — `doc`, `schema`, `cur`, `file`, `dirty`, `dir`,
    `vsix` — move into the Themes surface's own state module. The `schemes` array moves into the
    Schemes surface's state. Argv's `spec`/`sel`/`saving` live in the Argv surface's state, not
    as `let` bindings in the shell.
12. `app.busy` and `app.msg`/`app.kind` remain shared: any surface may set a busy flag and post a
    status message to the header, since status is an app-wide affordance. Surfaces set these
    through the existing `say()` helper and a shared busy flag rather than through private copies.
13. No surface reads or writes another surface's state module directly. Cross-surface needs go
    through the event bus (below), never by adding fields to `app`.

### Persistence hook

14. A surface that persists data declares its persistence on the contract as `load` and/or `save`
    operations owned by the surface, not by the shell. The shell no longer contains
    surface-specific persistence functions.
15. Themes' persistence — the Tauri `invoke('load')`, `invoke('save')`, `invoke('build')`,
    `invoke('package')`, `invoke('reveal')` calls presently in `+page.svelte` — belongs to the
    Themes surface. Sassy's on-disk action (`runOnDisk`) belongs to the Sassy surface. Argv's
    spec save belongs to the Argv surface.
16. A surface that declares `load` has it invoked when the app first needs that surface's data
    (preserving Themes' current behavior of loading its document on startup). A surface without
    persistence declares none and the shell does nothing extra for it.
17. The Themes save keyboard shortcut (Cmd/Ctrl-S) still saves the Themes document when Themes is
    active and its doc is loaded and the app is not busy. The shortcut invokes Themes' own save,
    and does **not** fire a different surface's save when another surface is active. (This closes
    the current class of collision described in Problem.)

### Cross-surface communication (event bus)

18. A small pub/sub bus module (e.g. `src/lib/bus`) lets a surface publish a named event with a
    payload and lets any surface subscribe to it. It is the only sanctioned channel for one
    surface to trigger behavior in another.
19. Subscribing returns an unsubscribe handle; a surface that subscribes while mounted removes its
    subscription when unmounted, so there are no leaked handlers or double-fires after a surface is
    switched away and back.
20. Publishing an event with no subscribers is a no-op and never errors. The bus carries no
    persistent state; it is not a store, and it is never used as a substitute for a surface's own
    state module or for global `app`.
21. There are no cross-surface producers/consumers wired in this change beyond the bus mechanism
    itself; it exists so future cross-surface actions (e.g. "send this palette from Themes into
    Sassy") do not widen `app`. (The audit ranked this as a "pattern for later"; it is being
    built now per human instruction but starts with no live event wiring.)

### No-regression invariants (must all hold after each surface migrates)

22. **Themes:** loads its document on startup; shows the pair/theme/version count; the unsaved
    dot reflects `dirty`; Build, Package .vsix, Reveal (when a vsix exists), and Save behave as
    today; Cmd/Ctrl-S saves; sidebar layout appears once the doc loads; loading and error
    placeholders behave as today (including Retry).
23. **Schemes:** browsing behaves as today; the schemes collection still loads (its read-failure
    fallback to an empty list is preserved); full-width layout.
24. **Argv:** the spec editor, the usage line in the header, Reset, and Save spec all work and act
    **on Argv's own state** — Save spec saves the Argv spec, never the Themes document; Reset is a
    defined Argv action. (Both are currently broken/undefined in the shell.)
25. **Sassy:** SASS→CSS / CSS→SASS direction chips, Convert, Copy, and On disk behave as today.
26. **Untw:** decode of pasted classes, the optional `@theme` box, Convert, Copy summary, Copy
    JSON, and the unknowns/loading/error behavior all match the untw spec
    ([docs/specs/untw/product.md](../untw/product.md)) exactly.
27. Every migrated surface renders under the correct layout (`full` or sidebar), posts status to
    the shared header, and shows its toolbar in the header's `.conditional` zone as before.

### Styling and docs

28. No visual or styling change to any surface or to the shell chrome. Styling stays SASS-only
    against existing `src/app.sass` tokens with single-tab indenting per DESIGN.md; no new font
    sizes or global variables are introduced by this refactor.
29. This change **supersedes the `## New Surface/Tab` workflow documented in `AGENTS.md`**
    (steps that instruct importing the component into `+page.svelte` and adding `{:else if}`
    clauses). Updating that AGENTS.md section to the registry+folder contract is in scope and must
    ship with the implementation.

## Resolved decisions

- **Registry ↔ module coupling / TypeScript (resolved 2026-09-11):** the state layer moves fully
  to TypeScript. `src/lib/states.js` becomes `states.ts` and `src/lib/store.svelte.js` becomes
  `store.svelte.ts`, both type-proper: a typed `Surface` contract describes each registry entry
  (id, label, full, optional badge, component, optional toolbar, optional persistence), and a
  typed shell-state shape replaces the untyped `app` object. Surface state modules are TypeScript
  (as `sass/` and `untw/` already are). The typed registry is the wiring point; the product
  invariant holds unchanged — adding a surface must not require editing `+page.svelte`. The tech
  spec details this migration and how it composes with the per-surface gated rollout.

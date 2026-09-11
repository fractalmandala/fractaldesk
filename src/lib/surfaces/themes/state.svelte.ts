// Themes surface state. The palette document, the current selection, and every
// persistence action live here so the Toolbar and the Surface body share one
// reactive module — the surface owns its own data; the shell store keeps only
// app-wide chrome.
//
// Document metadata that other surfaces render (the family table, the
// light/dark prefixes, the role list) is exposed read-only through the shared
// projection in src/lib/palette-meta.ts — no surface imports this module to
// read it.
//
// Cross-surface channel (P18–P20): this module is the sole consumer of the
// IMPORT_PAIR bus event (the name and its payload type are declared once in
// the shared event contract src/lib/events.ts), which the Schemes surface
// emits when the user saves an imported pair (see surfaces/schemes/
// Surface.svelte). It is the only wired bus event.
//
// Wrapped in a single reactive object so properties can be reassigned from
// other modules (ES module `let` exports are read-only bindings).

import { invoke } from '@tauri-apps/api/core'
import { app, say } from '../../store.svelte.js'
import { on } from '../../bus.js'
import { IMPORT_PAIR } from '../../events.js'
import type { ImportPairPayload } from '../../events.js'

export const themes = $state({
	doc: null as any,
	schema: { ui: [] } as any,
	cur: 0,
	file: 'palette.ts',
	dirty: false,
	dir: '',
	vsix: ''
})

/// Effective chrome colour: an explicit `ui` override, else the core role it derives from.
export const eff = (mode: any, key: string, from: string) => mode.ui?.[key] ?? mode[from]

/** Load the palette document — this surface's load hook, called once at startup. */
export async function load(): Promise<void> {
	app.busy = true
	try {
		const res = await invoke('load') as any
		themes.doc = res.palettes
		themes.schema = res.schema
		themes.dir = res.dir
		themes.cur = 0
		themes.dirty = false
	} catch (e) {
		say(String(e), 'bad')
	} finally {
		app.busy = false
	}
}

export async function save(): Promise<void> {
	app.busy = true
	try {
		const msg = await invoke<string>('save', { args: { doc: $state.snapshot(themes.doc) } })
		themes.dirty = false
		say(msg, 'ok')
	} catch (e) {
		say(String(e), 'bad')
	} finally {
		app.busy = false
	}
}

export async function build(): Promise<void> {
	app.busy = true
	say('building…', 'busy')
	try {
		say(await invoke<string>('build', { doc: $state.snapshot(themes.doc) }), 'ok')
	} catch (e) {
		say(String(e), 'bad')
	} finally {
		app.busy = false
	}
}

export async function packageVsix(): Promise<void> {
	app.busy = true
	say('packaging…', 'busy')
	try {
		const v = await invoke<string>('package', { doc: $state.snapshot(themes.doc) })
		themes.vsix = v
		say(`packaged ${v.split('/').pop()}`, 'ok')
	} catch (e) {
		say(String(e), 'bad')
	} finally {
		app.busy = false
	}
}

export function reveal(): void {
	invoke('reveal', { path: themes.vsix })
}

/**
 * Append a pair imported from the Schemes surface — the consumer side of
 * IMPORT_PAIR. Performs exactly what Schemes' old saveAsNew did on
 * the themes side: dedup the name ("name 2", "name 3"…), resolve the family
 * fallback, push the pair in the canonical field order, select it, mark the
 * document dirty, switch the view, and post the toast. The toast lives here
 * (not in the sender) so it can carry the final deduped name — the observable
 * message is identical to the pre-bus flow in every case.
 */
export function importPair(payload: ImportPairPayload): void {
	if (!themes.doc) {
		// Unreachable today (Themes loads at startup, before Schemes can fill
		// its pair form) — guarded anyway so a stray emit can never crash.
		say('Themes are not loaded — the pair was not imported.', 'bad')
		return
	}
	const taken = new Set(themes.doc.themes.map((t: any) => t.name))
	let final = payload.name.trim()
	if (taken.has(final)) {
		let n = 2
		while (taken.has(`${final} ${n}`)) n++
		final = `${final} ${n}`
	}
	themes.doc.themes.push({
		name: final,
		family: payload.family || Object.keys(themes.doc.families)[0],
		tag: payload.tag,
		thesis: payload.thesis,
		light: payload.light,
		dark: payload.dark,
		semantic: payload.semantic
	})
	themes.cur = themes.doc.themes.length - 1
	themes.dirty = true
	app.view = 'themes'
	say(`added "${final}" — save to write it to palettes.json`, 'ok')
}

// Registered once at module scope — deliberately NOT from a mounted component.
// The Themes surface component is unmounted while Schemes is active, so a
// component-lifetime subscription (the P19 pattern) would miss the event. This
// state module is an app-lifetime singleton: the subscription can neither leak
// nor double-fire, and the P19 unsubscribe rule is about mounted components.
// This is the documented, sanctioned exception.
const unsubImportPair = on<ImportPairPayload>(IMPORT_PAIR, importPair)

// Vite HMR: re-evaluating this module registers a fresh handler while the
// stale one from the previous module instance stays in the bus Set (the two
// closures are different function objects, so the Set does not dedupe them),
// and a dev-session emit would fire both. Dispose the old subscription when
// the module is hot-reloaded; production builds are unaffected.
if (import.meta.hot) import.meta.hot.dispose(() => unsubImportPair())

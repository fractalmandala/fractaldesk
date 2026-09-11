// Argv surface state. The spec, selection, and persistence actions live here
// so the Toolbar and Surface body share one reactive module — closing the P24
// collision where the toolbar was wired to the wrong save/reset.

import { invoke } from '@tauri-apps/api/core'
import { DEFAULT_SPEC } from './spec.js'
import type { Spec } from './spec'
import { usageParts } from './help.js'
import { diagnose } from './diagnostics.js'
import { say } from '../../store.svelte.js'

// Object wrapper so the toolbar and Surface both get reactive, assignable state.
export const argv = $state({
	spec: DEFAULT_SPEC(),
	sel: 'root',
	loaded: false,
	saving: false,
	baseline: ''
})

export function dirty(): boolean { return argv.loaded && JSON.stringify(argv.spec) !== argv.baseline }
export function usage() { return usageParts(argv.spec, argv.sel) }
export function diags() { return diagnose(argv.spec) }
export function errors(): number { return diags().filter((d) => d.s === 'err').length }

export function reset(): void {
	if (!confirm('Discard this spec and start from the example?')) return
	argv.spec = DEFAULT_SPEC()
	argv.sel = 'root'
}

export async function saveSpec(): Promise<void> {
	argv.saving = true
	try {
		const snapshot = $state.snapshot(argv.spec)
		say(await invoke('argv_save', { spec: snapshot }), 'ok')
		argv.baseline = JSON.stringify(snapshot)
	} catch (e) {
		say(String(e), 'bad')
	} finally {
		argv.saving = false
	}
}

/** Load the spec from disk — called once when the Argv surface first activates. */
export function loadSpec(): void {
	invoke('argv_load')
		.then((found: any) => { if (found?.pkg && found?.commands) argv.spec = found as Spec })
		.catch(() => {})
		.finally(() => {
			argv.baseline = JSON.stringify($state.snapshot(argv.spec))
			argv.loaded = true
		})
}

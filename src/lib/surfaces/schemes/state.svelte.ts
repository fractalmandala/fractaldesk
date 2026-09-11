// Schemes surface state: the scheme collection and its load action. The
// collection ships with the app (schemes-spec-0.11 beside palettes.json) and
// loads once, when the Schemes surface first becomes active (the shell's
// load-on-first-activation hook — same pattern as argv's loadSpec). A failed
// read falls back to an empty list rather than an error surface.
//
// Wrapped in an object so the list can be reassigned from other modules
// (ES module `let` exports are read-only bindings). The records keep the
// loose `any[]` typing for now — typing the scheme shape is deferred until
// it is defined on the Rust side (same status as Themes' `doc: any`).

import { invoke } from '@tauri-apps/api/core'

export const schemes = $state({ list: [] as any[] })

/** Load the scheme collection — this surface's load hook. */
export function load(): void {
	invoke('schemes')
		.then((found) => { schemes.list = found as any[] })
		.catch(() => { schemes.list = [] })
}

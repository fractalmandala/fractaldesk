// Shared read-only projection of the palette document's domain metadata — the
// family table, the light/dark prefixes, and the role list. Surfaces that
// render this metadata (currently the Schemes pair form) call these functions
// instead of importing the Themes state module, keeping the P13 rule intact:
// reactivity flows through the call sites because each function reads the
// themes state internally (same pattern as argv's usage()).
//
// Read-only by construction — nothing here can reassign or mutate the
// document. Each function guards for a null document (unreachable today:
// Themes loads at startup) and returns an empty fallback of the same shape.

import { themes } from './surfaces/themes/state.svelte.js'

/** Family table of the loaded palette document: family id → { label }. */
export function families(): Record<string, { label: string }> {
	return themes.doc?.families ?? {}
}

/** The light/dark slot labels from the document meta. */
export function prefixes(): { light: string; dark: string } {
	return {
		light: themes.doc?.meta?.lightPrefix ?? '',
		dark: themes.doc?.meta?.darkPrefix ?? ''
	}
}

/** The core role list of the loaded palette document. */
export function roles(): string[] {
	return themes.doc?.roles ?? []
}

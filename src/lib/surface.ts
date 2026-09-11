// Typed contract for a surface registry entry. Every surface — Themes, Schemes,
// Argv, Sassy, Untw — conforms to this shape so the shell can render it without
// surface-specific imports or conditional chains.

import type { Component } from 'svelte'

export interface ShellState {
	view: string
	busy: boolean
	msg: string
	kind: string
}

export interface Surface {
	id: string
	label: string
	full: boolean
	badge?: (shell: ShellState) => string | number | null
	component: Component
	toolbar?: Component
	load?: () => void | Promise<void>
	// When it returns true, the surface renders full-width even though `full`
	// is false (Themes' loading/error placeholder needs full width to centre
	// in while its document is not yet loaded).
	fullWhileLoading?: () => boolean
}

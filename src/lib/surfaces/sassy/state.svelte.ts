// Shared Sassy state. The controls (direction + Convert + Copy + On disk) live
// in the header toolbar (Toolbar.svelte); the panes in Surface.svelte bind to
// this so a header button can drive the paste conversion. `busy`/`report`
// belong to the On disk action but are shown in the surface.

import type { Direction } from './types.js'

export const sassy = $state<{
	direction: Direction
	input: string
	output: string
	error: string
	copied: boolean
	busy: boolean
	report: string
}>({
	direction: 'css2sass',
	input: '',
	output: '',
	error: '',
	copied: false,
	busy: false,
	report: ''
})

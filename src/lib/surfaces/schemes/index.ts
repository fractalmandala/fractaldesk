import type { Surface } from '../../surface'
import SurfaceComponent from './Surface.svelte'
import { load } from './state.svelte.js'

export const schemesSurface: Surface = {
	id: 'schemes',
	label: 'Schemes',
	full: true,
	component: SurfaceComponent,
	load
}

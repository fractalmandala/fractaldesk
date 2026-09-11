import type { Surface } from '../../surface'
import SurfaceComponent from './Surface.svelte'
import ToolbarComponent from './Toolbar.svelte'
import { loadSpec } from './state.svelte.js'

export const argvSurface: Surface = {
	id: 'argv',
	label: 'Argv',
	full: true,
	component: SurfaceComponent,
	toolbar: ToolbarComponent,
	load: loadSpec
}

import type { Surface } from '../../surface'
import SurfaceComponent from './Surface.svelte'
import ToolbarComponent from './Toolbar.svelte'
import { loadNotes } from './state.svelte.js'

export const notesSurface: Surface = {
	id: 'notes',
	label: 'Notes',
	full: true,
	component: SurfaceComponent,
	toolbar: ToolbarComponent,
	load: loadNotes
}

import type { Surface } from '../../surface'
import SurfaceComponent from './Surface.svelte'
import ToolbarComponent from './Toolbar.svelte'

export const sassySurface: Surface = {
	id: 'sassy',
	label: 'Sassy',
	full: true,
	component: SurfaceComponent,
	toolbar: ToolbarComponent
}

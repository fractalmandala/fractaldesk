import type { Surface } from '../../surface'
import SurfaceComponent from './Surface.svelte'
import ToolbarComponent from './Toolbar.svelte'
import { load, themes } from './state.svelte.js'

export const themesSurface: Surface = {
	id: 'themes',
	label: 'Themes',
	full: false,
	component: SurfaceComponent,
	toolbar: ToolbarComponent,
	load,
	fullWhileLoading: () => !themes.doc
}

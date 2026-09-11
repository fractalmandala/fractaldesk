import type { Surface } from '../../surface'
import SurfaceComponent from './Surface.svelte'
import ToolbarComponent from './Toolbar.svelte'

// No `load` hook: untw is fully offline with no persistence — no Tauri invokes,
// no mount-time fetching anywhere in this folder. The only startup work is UI
// init (seeding the input with SAMPLE in state.svelte.ts), which is not a
// persistence load. A surface without persistence declares none (P16).
export const untwSurface: Surface = {
	id: 'untw',
	label: 'Untw',
	full: true,
	component: SurfaceComponent,
	toolbar: ToolbarComponent
}

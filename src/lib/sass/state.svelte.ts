// Shared Sassy state. The controls (direction + Convert + On disk) live in the
// app header (+page.svelte); the panes in ConvertSurface.svelte bind to this so a
// header button can drive the paste conversion. `busy`/`report` belong to the
// On disk action but are shown in the surface.

import type { Direction } from './types'

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
  report: '',
})

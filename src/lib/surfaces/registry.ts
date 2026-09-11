// Typed surface registry — the single source of truth for which surfaces exist,
// their layout, component, toolbar, and load hook. The shell renders from this
// array; adding a surface means adding one entry here plus a surfaces/<id>/
// folder, with no edits to +page.svelte.

import type { Surface } from '../surface'

import { argvSurface } from './argv'
import { themesSurface } from './themes'
import { schemesSurface } from './schemes'
import { sassySurface } from './sassy'
import { untwSurface } from './untw'

// Entries spread their surface exports so future Surface contract additions
// propagate automatically.
export const REGISTRY: Surface[] = [
	{ ...themesSurface },
	{ ...schemesSurface },
	{ ...argvSurface },
	{ ...sassySurface },
	{ ...untwSurface }
]

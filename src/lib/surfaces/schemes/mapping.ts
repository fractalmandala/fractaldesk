// Translating a tinted-theming scheme into a Daylight palette.
//
// base16 numbers its slots by meaning (base00 background … base0E keywords), so
// the mapping is mostly a rename. base24 is base16 plus eight bright ANSI slots,
// which our 15 roles have no use for, so it maps identically. tinted8 is an
// ANSI-8 terminal palette with named colours and no background/foreground pair,
// so its mapping is an interpretation rather than a rename — the ground comes
// from the variant.

// One record of the scheme collection as the mapping helpers consume it. The
// collection itself is still loosely typed (`any[]` in state.svelte.ts) until
// the scheme shape is typed on the Rust side.
export interface Scheme {
	uid: string
	id: string
	name: string
	system: string
	variant: string
	author: string
	palette: Record<string, string>
}

/** Blend hex a toward hex b by t (0..1). */
export function mix(a: string, b: string, t: number): string {
	let out = '#'
	for (let i = 1; i < 7; i += 2) {
		const ca = parseInt(a.slice(i, i + 2), 16)
		const cb = parseInt(b.slice(i, i + 2), 16)
		out += Math.round(ca + (cb - ca) * t).toString(16).padStart(2, '0')
	}
	return out.toUpperCase()
}

const up = (v: string): string => (v || '').toUpperCase()

// What each role takes, and why — shown in the UI so the mapping is inspectable.
export const BASE16_SOURCE: Record<string, [string, string]> = {
	bg: ['base00', 'default background'],
	alt: ['base01', 'lighter background — sidebar, tabs'],
	border: ['base01+base02', 'blended hairline'],
	sel: ['base02', 'selection background'],
	fg: ['base05', 'default foreground'],
	comment: ['base03', 'comments, invisibles'],
	punct: ['base04', 'dark foreground — line numbers'],
	op: ['base05', 'operators, delimiters'],
	key: ['base0E', 'keywords, storage'],
	str: ['base0B', 'strings'],
	num: ['base09', 'integers, constants'],
	fn: ['base0D', 'functions, methods'],
	type: ['base0A', 'classes, types'],
	prop: ['base08', 'variables'],
	accent: ['base0D', 'cursor, active tab, badges']
}

export const TINTED8_SOURCE: Record<string, [string, string]> = {
	bg: ['white / black', 'by variant'],
	alt: ['blend', '5% toward text'],
	border: ['blend', '12% toward text'],
	sel: ['blend', '10% toward text'],
	fg: ['black / white', 'by variant'],
	comment: ['gray', ''],
	punct: ['gray', ''],
	op: ['cyan', ''],
	key: ['magenta', ''],
	str: ['green', ''],
	num: ['orange', ''],
	fn: ['blue', ''],
	type: ['yellow', ''],
	prop: ['red', ''],
	accent: ['blue', '']
}

export const sourceFor = (scheme: Scheme): Record<string, [string, string]> =>
	scheme.system === 'tinted8' ? TINTED8_SOURCE : BASE16_SOURCE

/** A scheme as a Daylight palette: the 15 core roles, no `ui` overrides. */
export function toPalette(scheme: Scheme): Record<string, string> {
	const p = scheme.palette
	if (scheme.system === 'tinted8') {
		const light = scheme.variant === 'light'
		const bg = up(light ? p.white : p.black)
		const fg = up(light ? p.black : p.white)
		const g = p.gray || p['black-bright'] || mix(bg, fg, 0.5)
		return {
			bg,
			alt: mix(bg, fg, 0.05),
			border: mix(bg, fg, 0.12),
			sel: mix(bg, fg, 0.1),
			fg,
			comment: up(g),
			punct: up(g),
			op: up(p.cyan),
			key: up(p.magenta),
			str: up(p.green),
			num: up(p.orange || p.yellow),
			fn: up(p.blue),
			type: up(p.yellow),
			prop: up(p.red),
			accent: up(p.blue)
		}
	}
	const b = (k: string) => up(p[k])
	return {
		bg: b('base00'),
		alt: b('base01'),
		border: mix(b('base01'), b('base02'), 0.5),
		sel: b('base02'),
		fg: b('base05'),
		comment: b('base03'),
		punct: b('base04'),
		op: b('base05'),
		key: b('base0E'),
		str: b('base0B'),
		num: b('base09'),
		fn: b('base0D'),
		type: b('base0A'),
		prop: b('base08'),
		accent: b('base0D')
	}
}

/** base16 hands us real diagnostic hues; use them rather than the family's. */
export function toSemantic(scheme: Scheme): Record<string, string> {
	const p = scheme.palette
	if (scheme.system === 'tinted8') {
		return {
			err: up(p.red), warn: up(p.yellow), ok: up(p.green), info: up(p.blue),
			add: up(p.green), mod: up(p.yellow), delete: up(p.red)
		}
	}
	const e = up(p.base08), w = up(p.base0A), o = up(p.base0B), i = up(p.base0D)
	return { err: e, warn: w, ok: o, info: i, add: o, mod: w, delete: e }
}

// Naming conventions the collection actually uses for light/dark counterparts.
const PAIRS: [string, string][] = [
	['light', 'dark'], ['latte', 'mocha'], ['latte', 'frappe'],
	['dawn', 'moon'], ['dawn', 'night'], ['day', 'night'],
	['white', 'black'], ['sun', 'moon']
]

/** The obvious opposite-variant partner for a scheme, if the collection has one. */
export function partnerFor(scheme: Scheme, all: Scheme[]): Scheme | null {
	const want = scheme.variant === 'light' ? 'dark' : 'light'
	const pool = all.filter((s) => s.variant === want && s.system === scheme.system)

	for (const [a, b] of PAIRS) {
		for (const [from, to] of [[a, b], [b, a]]) {
			if (!scheme.id.includes(from)) continue
			const guess = scheme.id.replaceAll(from, to)
			const hit = pool.find((s) => s.id === guess)
			if (hit) return hit
		}
	}
	// Fall back to the closest sibling by shared prefix — "gruvbox-…" finds its kin.
	let best: Scheme | null = null
	let bestLen = 4
	for (const s of pool) {
		let n = 0
		while (n < s.id.length && n < scheme.id.length && s.id[n] === scheme.id[n]) n++
		if (n > bestLen) { bestLen = n; best = s }
	}
	return best
}

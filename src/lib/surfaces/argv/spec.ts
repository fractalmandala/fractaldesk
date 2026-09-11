// The CLI being designed. One flat command list with parent ids, so a tree of any
// depth is easy to walk and easy to persist.

export interface Pkg {
	name: string
	bin: string
	version: string
	language: string
	description: string
}

export interface Opt {
	id: string
	short: string
	long: string
	type: string
	value: string
	def: string
	choices: string
	desc: string
}

export interface Arg {
	id: string
	name: string
	arity: string
	def: string
	desc: string
}

export interface Command {
	id: string
	parent: string | null
	name: string
	alias: string
	desc: string
	args: Arg[]
	opts: Opt[]
}

export interface Spec {
	pkg: Pkg
	globals: Opt[]
	commands: Command[]
}

export const DEFAULT_SPEC = (): Spec => ({
	pkg: {
		name: 'my-cli',
		bin: 'mycli',
		version: '0.1.0',
		language: 'ts',
		description: 'What this tool does, in one line.'
	},
	globals: [
		{ id: 'g1', short: 'c', long: 'config', type: 'string', value: 'path', def: '', choices: '', desc: 'Path to the config file.' }
	],
	commands: [
		{
			id: 'c1', parent: null, name: 'build', alias: 'b',
			desc: 'Compile the project.',
			args: [{ id: 'a1', name: 'entry', arity: 'required', def: '', desc: 'Files to compile.' }],
			opts: [{ id: 'o1', short: 'w', long: 'watch', type: 'boolean', value: '', def: '', choices: '', desc: 'Rebuild on change.' }]
		}
	]
})

export const uid = (p: string): string => p + Math.random().toString(36).slice(2, 8)
export const kebab = (s: string): string => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const camel = (s: string): string => kebab(s).replace(/-(.)/g, (_, c: string) => c.toUpperCase())
export const pascal = (s: string): string => camel(s).replace(/^./, (m: string) => m.toUpperCase())
export const isKebab = (s: string): boolean => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s || '')
export const q = (s: string): string => JSON.stringify(String(s ?? ''))

export const kids = (spec: Spec, id: string): Command[] => spec.commands.filter((c) => c.parent === (id === 'root' ? null : id))
export const byId = (spec: Spec, id: string): Command | null => (id === 'root' ? null : spec.commands.find((c) => c.id === id) ?? null)
export function chain(spec: Spec, id: string): Command[] {
	const out: Command[] = []
	let n = byId(spec, id)
	while (n) {
		out.unshift(n)
		n = n.parent ? byId(spec, n.parent) : null
	}
	return out
}
export const isLeaf = (spec: Spec, c: Command): boolean => kids(spec, c.id).length === 0
export const leaves = (spec: Spec): Command[] => spec.commands.filter((c) => isLeaf(spec, c))
export const pathOf = (spec: Spec, id: string): string => chain(spec, id).map((c) => c.name).join(' ')

/** `<entry>` / `[outdir]` / `[files...]` — the token as help prints it. */
export function argToken(a: Arg): string {
	const n = a.name || 'arg'
	if (a.arity === 'variadic') return `[${n}...]`
	if (a.arity === 'optional') return `[${n}]`
	return `<${n}>`
}

/** `-w, --watch` or `-p, --port <n>`. */
export function optFlags(o: Opt): string {
	const head = (o.short ? `-${o.short}, ` : '') + '--' + (o.long || 'option')
	return o.type === 'boolean' ? head : `${head} <${o.value || 'value'}>`
}

/** The option name commander stores: --no-color becomes `color`. */
export function optKey(o: Opt): string {
	const long = o.long || ''
	return long.startsWith('no-') ? camel(long.slice(3)) : camel(long)
}

/** Options in scope for a command: its own plus every ancestor's, plus globals. */
export function scopeOpts(spec: Spec, id: string): Opt[] {
	const inherited = chain(spec, id).slice(0, -1).flatMap((c) => c.opts)
	const own = byId(spec, id)?.opts ?? []
	return [...(spec.globals ?? []), ...inherited, ...own]
}

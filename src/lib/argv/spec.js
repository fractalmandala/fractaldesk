// The CLI being designed. One flat command list with parent ids, so a tree of any
// depth is easy to walk and easy to persist.

export const DEFAULT_SPEC = () => ({
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

export const uid = (p) => p + Math.random().toString(36).slice(2, 8)
export const kebab = (s) => String(s || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
export const camel = (s) => kebab(s).replace(/-(.)/g, (_, c) => c.toUpperCase())
export const pascal = (s) => camel(s).replace(/^./, (m) => m.toUpperCase())
export const isKebab = (s) => /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/.test(s || '')
export const q = (s) => JSON.stringify(String(s ?? ''))

export const kids = (spec, id) => spec.commands.filter((c) => c.parent === (id === 'root' ? null : id))
export const byId = (spec, id) => (id === 'root' ? null : spec.commands.find((c) => c.id === id) ?? null)
export function chain(spec, id) {
  const out = []
  let n = byId(spec, id)
  while (n) {
    out.unshift(n)
    n = n.parent ? byId(spec, n.parent) : null
  }
  return out
}
export const isLeaf = (spec, c) => kids(spec, c.id).length === 0
export const leaves = (spec) => spec.commands.filter((c) => isLeaf(spec, c))
export const pathOf = (spec, id) => chain(spec, id).map((c) => c.name).join(' ')

/** `<entry>` / `[outdir]` / `[files...]` — the token as help prints it. */
export function argToken(a) {
  const n = a.name || 'arg'
  if (a.arity === 'variadic') return `[${n}...]`
  if (a.arity === 'optional') return `[${n}]`
  return `<${n}>`
}

/** `-w, --watch` or `-p, --port <n>`. */
export function optFlags(o) {
  const head = (o.short ? `-${o.short}, ` : '') + '--' + (o.long || 'option')
  return o.type === 'boolean' ? head : `${head} <${o.value || 'value'}>`
}

/** The option name commander stores: --no-color becomes `color`. */
export function optKey(o) {
  const long = o.long || ''
  return long.startsWith('no-') ? camel(long.slice(3)) : camel(long)
}

/** Options in scope for a command: its own plus every ancestor's, plus globals. */
export function scopeOpts(spec, id) {
  const inherited = chain(spec, id).slice(0, -1).flatMap((c) => c.opts)
  const own = byId(spec, id)?.opts ?? []
  return [...(spec.globals ?? []), ...inherited, ...own]
}

// Parse an invocation against the spec the way commander would, and report what
// binds where. This is the "try it" step: no install, no codegen, no running —
// type `mycli build src --watch` and see what the CLI you have designed does
// with it, including the errors it would raise.

import { byId, camel, chain, kids, optKey, scopeOpts } from './spec.js'

/** Split a command line, honouring single and double quotes. */
export function tokenize(line) {
  const out = []
  let cur = ''
  let quote = ''
  let has = false
  for (const ch of String(line)) {
    if (quote) {
      if (ch === quote) quote = ''
      else cur += ch
      continue
    }
    if (ch === '"' || ch === "'") { quote = ch; has = true; continue }
    if (/\s/.test(ch)) {
      if (cur || has) out.push(cur)
      cur = ''
      has = false
      continue
    }
    cur += ch
  }
  if (cur || has) out.push(cur)
  return out
}

const matches = (c, tok) => c.name === tok || (c.alias && c.alias === tok)

function coerce(o, raw) {
  if (o.type === 'number') {
    const n = Number(raw)
    return Number.isFinite(n)
      ? { value: n }
      : { error: `option '--${o.long}' expects a number, got ${JSON.stringify(raw)}` }
  }
  if (o.type === 'enum' && o.choices) {
    const allowed = String(o.choices).split(',').map((s) => s.trim()).filter(Boolean)
    if (allowed.length && !allowed.includes(raw)) {
      return { error: `option '--${o.long}' must be one of ${allowed.join(', ')} — got ${JSON.stringify(raw)}` }
    }
  }
  return { value: raw }
}

function defaultFor(o) {
  if (o.type === 'boolean') return (o.long || '').startsWith('no-') ? true : false
  if (o.def === '' || o.def == null) return undefined
  return o.type === 'number' ? Number(o.def) : o.def
}

/**
 * @returns {{path: string[], nodeId: string, args: object[], opts: object[],
 *            errors: string[], help: boolean, version: boolean, extra: string[]}}
 */
export function parseInvocation(spec, line) {
  const tokens = tokenize(line)
  const errors = []
  const bin = spec.pkg.bin || 'cli'

  if (tokens.length && tokens[0] !== bin) {
    errors.push(`this line starts with ${JSON.stringify(tokens[0])}; the binary is ${JSON.stringify(bin)}`)
  }
  const rest = tokens.slice(tokens[0] === bin ? 1 : 0)

  // Walk the command tree as far as the leading words go.
  let nodeId = 'root'
  let i = 0
  const path = []
  for (; i < rest.length; i++) {
    const tok = rest[i]
    if (tok.startsWith('-')) break
    const hit = kids(spec, nodeId).find((c) => matches(c, tok))
    if (!hit) break
    nodeId = hit.id
    path.push(hit.name)
  }

  const node = byId(spec, nodeId)
  const subs = kids(spec, nodeId)
  const inScope = scopeOpts(spec, nodeId)
  const byLong = new Map()
  const byShort = new Map()
  for (const o of inScope) {
    byLong.set(o.long, o)
    if (o.long?.startsWith('no-')) byLong.set(o.long.slice(3), o)
    if (o.short) byShort.set(o.short, o)
  }

  const given = new Map()
  const positionals = []
  let help = false
  let version = false

  const take = (o, valueFromEq, idx, list) => {
    if (o.type === 'boolean') {
      given.set(optKey(o), { value: !(o.long || '').startsWith('no-'), o })
      return idx
    }
    let raw = valueFromEq
    if (raw === undefined) {
      raw = list[idx + 1]
      if (raw === undefined || raw.startsWith('-')) {
        errors.push(`option '--${o.long}' needs a value`)
        return idx
      }
      idx += 1
    }
    const c = coerce(o, raw)
    if (c.error) errors.push(c.error)
    else given.set(optKey(o), { value: c.value, o })
    return idx
  }

  for (let j = i; j < rest.length; j++) {
    const tok = rest[j]
    if (tok === '--') { positionals.push(...rest.slice(j + 1)); break }

    if (tok.startsWith('--')) {
      const [name, eq] = tok.slice(2).split(/=(.*)/s)
      if (name === 'help') { help = true; continue }
      if (name === 'version' && nodeId === 'root') { version = true; continue }
      const o = byLong.get(name)
      if (!o) { errors.push(`unknown option '--${name}'`); continue }
      j = take(o, eq, j, rest)
      continue
    }

    if (tok.startsWith('-') && tok.length > 1) {
      const letters = tok.slice(1)
      for (let k = 0; k < letters.length; k++) {
        const ch = letters[k]
        if (ch === 'h') { help = true; continue }
        if (ch === 'V' && nodeId === 'root') { version = true; continue }
        const o = byShort.get(ch)
        if (!o) { errors.push(`unknown option '-${ch}'`); continue }
        if (o.type !== 'boolean') {
          const inline = letters.slice(k + 1)
          j = take(o, inline || undefined, j, rest)
          break
        }
        given.set(optKey(o), { value: true, o })
      }
      continue
    }
    positionals.push(tok)
  }

  // Bind positionals to the command's declared arguments.
  const declared = subs.length ? [] : node?.args ?? []
  const args = []
  const pool = positionals.slice()
  declared.forEach((a) => {
    if (a.arity === 'variadic') {
      args.push({ name: a.name, value: pool.splice(0), source: pool.length ? 'given' : 'given' })
      return
    }
    const v = pool.shift()
    if (v === undefined) {
      if (a.arity === 'required') errors.push(`missing required argument '${a.name}'`)
      args.push({ name: a.name, value: a.def || undefined, source: a.def ? 'default' : 'missing' })
    } else {
      args.push({ name: a.name, value: v, source: 'given' })
    }
  })
  if (pool.length) {
    if (subs.length) errors.push(`unknown command '${pool[0]}'`)
    else errors.push(`too many arguments — ${pool.map((p) => JSON.stringify(p)).join(', ')} has nowhere to go`)
  }
  if (subs.length && !help && !version && positionals.length === 0 && path.length) {
    errors.push(`'${[bin, ...path].join(' ')}' needs a subcommand`)
  }

  const opts = inScope.map((o) => {
    const hit = given.get(optKey(o))
    const def = defaultFor(o)
    return {
      key: optKey(o),
      flag: o.long,
      value: hit ? hit.value : def,
      source: hit ? 'given' : def === undefined ? 'unset' : 'default',
      type: o.type
    }
  })

  return { path, nodeId, args, opts, errors, help, version, extra: pool }
}

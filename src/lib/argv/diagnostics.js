// Spec-level lint: things that would compile but bite you later.
import { argToken, byId, chain, isKebab, kids, optKey, pathOf, scopeOpts } from './spec.js'

const RESERVED_LONG = new Set(['help', 'version'])
const RESERVED_SHORT = new Set(['h', 'V'])

export function diagnose(spec) {
  const out = []
  const push = (s, m, c) => out.push({ s, m, c })

  if (!isKebab(spec.pkg.bin || '')) push('err', 'Binary name must be kebab-case', spec.pkg.bin || '(empty)')
  if (!/^\d+\.\d+\.\d+/.test(spec.pkg.version || '')) push('warn', 'Version is not semver', spec.pkg.version || '(empty)')

  for (const c of spec.commands) {
    const path = pathOf(spec, c.id)
    if (!isKebab(c.name || '')) push('err', 'Command name must be kebab-case', c.name || '(empty)')
    if (kids(spec, c.parent ?? 'root').some((s) => s.id !== c.id && s.name === c.name)) {
      push('err', 'Duplicate sibling command', path)
    }
    if (kids(spec, c.id).length && c.args.length) {
      push('warn', 'Positionals are ignored on a command with subcommands', path)
    }
    let seenOptional = false
    let seenVariadic = false
    for (const a of c.args) {
      if (seenVariadic) push('err', 'A variadic argument must come last', `${path} ${argToken(a)}`)
      if (a.arity === 'variadic') seenVariadic = true
      else if (a.arity === 'optional') seenOptional = true
      else if (seenOptional) push('err', 'Required argument follows an optional one', `${path} <${a.name}>`)
    }
    // Collisions are only real within one command's visible scope.
    const seenLong = new Map()
    const seenShort = new Map()
    for (const o of scopeOpts(spec, c.id)) {
      if (!isKebab(o.long || '')) push('err', 'Flag name must be kebab-case', `--${o.long || '?'} in ${path}`)
      if (RESERVED_LONG.has(o.long)) push('warn', 'Flag is reserved by commander', `--${o.long} in ${path}`)
      const key = optKey(o)
      if (seenLong.has(key)) push('err', 'Two flags land on the same property', `${key} in ${path}`)
      seenLong.set(key, o)
      if (o.short) {
        if (!/^[A-Za-z]$/.test(o.short)) push('err', 'Short flag must be a single letter', `-${o.short} in ${path}`)
        if (RESERVED_SHORT.has(o.short)) push('warn', 'Short flag is reserved by commander', `-${o.short} in ${path}`)
        if (seenShort.has(o.short)) push('err', 'Duplicate short flag in scope', `-${o.short} in ${path}`)
        seenShort.set(o.short, o)
      }
      if (o.type === 'enum' && !String(o.choices || '').trim()) {
        push('warn', 'Choice flag lists no choices', `--${o.long} in ${path}`)
      }
      if (o.type === 'number' && o.def && !Number.isFinite(Number(o.def))) {
        push('err', 'Numeric default is not a number', `--${o.long} in ${path}`)
      }
    }
    if (!c.desc) push('warn', 'Command has no summary — it will print blank in help', path)
  }
  if (!out.length) push('ok', 'Grammar is well formed', '')
  return out
}

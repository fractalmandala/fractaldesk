// Emit a runnable commander package. Kept deliberately close to what the CLI
// actually needs: an entry that wires the tree, one module per leaf command,
// a manifest, and a README carrying the real help output.

import {
  argToken, camel, chain, isLeaf, kebab, kids, leaves, optFlags, optKey, pascal, pathOf, q
} from './spec.js'
import { helpText } from './help.js'

const handlerName = (spec, c) => camel(chain(spec, c.id).map((n) => n.name).join('-'))
const modPath = (spec, c) => 'commands/' + chain(spec, c.id).map((n) => kebab(n.name)).join('-')
const optsType = (spec, c) => pascal(chain(spec, c.id).map((n) => n.name).join('-')) + 'Options'

function tsType(o) {
  if (o.type === 'boolean') return 'boolean'
  if (o.type === 'number') return 'number'
  if (o.type === 'enum' && o.choices) {
    return String(o.choices).split(',').map((s) => q(s.trim())).join(' | ')
  }
  return 'string'
}

function optDecl(o) {
  const flags = optFlags(o)
  if (o.type === 'enum' && o.choices) {
    const ch = String(o.choices).split(',').map((s) => q(s.trim())).join(', ')
    return `.addOption(new Option(${q(flags)}, ${q(o.desc || '')}).choices([${ch}])` +
      (o.def ? `.default(${q(o.def)})` : '') + ')'
  }
  if (o.type === 'number') {
    // commander hands every value over as a string; coerce at the boundary.
    return `.option(${q(flags)}, ${q(o.desc || '')}, (v) => Number(v)` +
      (o.def ? `, ${Number(o.def)}` : '') + ')'
  }
  const parts = [q(flags), q(o.desc || '')]
  if (o.def) parts.push(q(o.def))
  return `.option(${parts.join(', ')})`
}

export function generateEntry(spec) {
  const ts = spec.pkg.language === 'ts'
  const all = [...(spec.globals ?? []), ...spec.commands.flatMap((c) => c.opts)]
  const needsOption = all.some((o) => o.type === 'enum' && o.choices)
  const L = ['#!/usr/bin/env node']
  L.push(`import { Command${needsOption ? ', Option' : ''} } from "commander";`)
  for (const c of leaves(spec)) L.push(`import { ${handlerName(spec, c)} } from "./${modPath(spec, c)}.js";`)
  // The options interfaces live beside each handler; the entry needs them for the
  // optsWithGlobals type argument.
  if (ts) {
    for (const c of leaves(spec)) {
      L.push(`import type { ${optsType(spec, c)} } from "./${modPath(spec, c)}.js";`)
    }
  }
  L.push('', 'const program = new Command();', '', 'program')
  L.push(`  .name(${q(spec.pkg.bin || 'cli')})`)
  L.push(`  .description(${q(spec.pkg.description || '')})`)
  L.push(`  .version(${q(spec.pkg.version || '0.0.0')})`)
  for (const o of spec.globals ?? []) L.push('  ' + optDecl(o))
  L[L.length - 1] += ';'
  L.push('')

  const emit = (parentId, varName) => {
    for (const c of kids(spec, parentId)) {
      const v = 'cmd' + pascal(chain(spec, c.id).map((n) => n.name).join('-'))
      L.push(`const ${v} = ${varName}`)
      L.push(`  .command(${q(c.name)})`)
      if (c.alias) L.push(`  .alias(${q(c.alias)})`)
      L.push(`  .description(${q(c.desc || '')})`)
      const leaf = isLeaf(spec, c)
      if (leaf) {
        for (const a of c.args) {
          const p = [q(argToken(a)), q(a.desc || '')]
          if (a.def) p.push(q(a.def))
          L.push(`  .argument(${p.join(', ')})`)
        }
      }
      for (const o of c.opts) L.push('  ' + optDecl(o))
      if (leaf) {
        const names = c.args.map((a) => camel(a.name))
        // Program-level options are not passed to a subcommand action, so the
        // handler reads them with optsWithGlobals instead of the action argument.
        const sig = ts
          ? [...c.args.map((a) => `${camel(a.name)}: string${a.arity === 'variadic' ? '[]' : ''}`), '_options: unknown', 'command: Command']
          : [...names, '_options', 'command']
        L.push(`  .action(async (${sig.join(', ')}) => {`)
        L.push(`    await ${handlerName(spec, c)}(${[...names, `command.optsWithGlobals${ts ? `<${optsType(spec, c)}>` : ''}()`].join(', ')});`)
        L.push('  });')
      } else {
        L[L.length - 1] += ';'
      }
      L.push('')
      emit(c.id, v)
    }
  }
  emit('root', 'program')

  L.push('program.parseAsync(process.argv).catch((error) => {')
  L.push('  console.error(error instanceof Error ? error.message : error);')
  L.push('  process.exitCode = 1;')
  L.push('});')
  return L.join('\n') + '\n'
}

export function generateHandler(spec, c) {
  const ts = spec.pkg.language === 'ts'
  const path = pathOf(spec, c.id)
  const visible = [...(spec.globals ?? []), ...chain(spec, c.id).flatMap((n) => n.opts)]
  const L = []
  if (ts) {
    L.push(`export interface ${optsType(spec, c)} {`)
    for (const o of visible) {
      L.push(`  /** ${o.desc || optFlags(o)} */`)
      L.push(`  ${optKey(o)}${o.def || o.type === 'boolean' ? '' : '?'}: ${tsType(o)};`)
    }
    L.push('}', '')
  }
  const params = [
    ...c.args.map((a) => (ts ? `${camel(a.name)}: string${a.arity === 'variadic' ? '[]' : ''}` : camel(a.name))),
    ts ? `options: ${optsType(spec, c)}` : 'options'
  ]
  L.push(`/** \`${spec.pkg.bin || 'cli'} ${path}\` — ${c.desc || ''} */`)
  L.push(`export async function ${handlerName(spec, c)}(${params.join(', ')})${ts ? ': Promise<void>' : ''} {`)
  L.push(`  // TODO: implement \`${path}\`.`)
  for (const a of c.args) L.push(`  void ${camel(a.name)};`)
  L.push('  void options;')
  L.push(`  throw new Error(${q(path + ' is not implemented yet.')});`)
  L.push('}')
  return L.join('\n') + '\n'
}

function generateManifest(spec) {
  const ts = spec.pkg.language === 'ts'
  const bin = {}
  bin[spec.pkg.bin || 'cli'] = ts ? 'dist/cli.js' : 'src/cli.js'
  const o = {
    name: spec.pkg.name || 'my-cli',
    version: spec.pkg.version || '0.0.0',
    description: spec.pkg.description || '',
    type: 'module',
    bin,
    files: [ts ? 'dist' : 'src'],
    engines: { node: '>=18' },
    scripts: ts
      ? { build: 'tsc -p tsconfig.json', dev: 'tsc -w -p tsconfig.json', prepublishOnly: 'npm run build' }
      : { start: 'node src/cli.js' },
    dependencies: { commander: '^12.1.0' }
  }
  if (ts) o.devDependencies = { typescript: '^5.6.0', '@types/node': '^22.7.0' }
  return JSON.stringify(o, null, 2) + '\n'
}

const TSCONFIG = JSON.stringify({
  compilerOptions: {
    target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext',
    outDir: 'dist', rootDir: 'src', strict: true, declaration: true,
    esModuleInterop: true, skipLibCheck: true
  },
  include: ['src']
}, null, 2) + '\n'

function generateReadme(spec) {
  const bin = spec.pkg.bin || 'cli'
  const L = [`# ${spec.pkg.name || bin}`, '']
  if (spec.pkg.description) L.push(spec.pkg.description, '')
  L.push('```bash', `npm install -g ${spec.pkg.name || bin}`, '```', '', '## Commands', '')
  for (const c of spec.commands) {
    L.push(`### \`${bin} ${pathOf(spec, c.id)}\``, '')
    if (c.desc) L.push(c.desc, '')
    L.push('```', helpText(spec, c.id).replace(/\s+$/, ''), '```', '')
  }
  L.push('## Exit codes', '', '| Code | Meaning |', '| --- | --- |',
    '| `0` | Completed successfully |', '| `1` | Runtime failure |',
    '| `2` | Usage error (bad flags or arguments) |')
  return L.join('\n') + '\n'
}

export function generatePackage(spec) {
  const ts = spec.pkg.language === 'ts'
  const ext = ts ? '.ts' : '.js'
  const out = [{ name: ts ? 'src/cli.ts' : 'src/cli.js', body: generateEntry(spec) }]
  for (const c of leaves(spec)) out.push({ name: `src/${modPath(spec, c)}${ext}`, body: generateHandler(spec, c) })
  out.push({ name: 'package.json', body: generateManifest(spec) })
  if (ts) out.push({ name: 'tsconfig.json', body: TSCONFIG })
  out.push({ name: 'README.md', body: generateReadme(spec) })
  return out
}

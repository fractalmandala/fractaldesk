// commander's help layout, matched against the real binary's output.
//
// The details that are easy to get wrong, all verified against a compiled
// package rather than assumed:
//   • -V sorts before the program's own options; -h sorts last
//   • a subcommand's help does NOT list program-level options
//   • the Arguments column prints bare names, not <brackets>
//   • a subcommand's own usage line carries its alias: `build|b`
//   • the Commands list repeats each command's usage suffix, and ends with `help`
//   • one description column width is shared across all three sections

import type { Spec, Opt, Command } from './spec'
import { argToken, byId, chain, kids, optFlags, q } from './spec.js'

interface UsagePart { t: string; v: string }
interface HelpLine { c: string; t: string }

const HELP_OPT: Opt = { id: '', short: 'h', long: 'help', type: 'boolean', value: '', def: '', choices: '', desc: 'display help for command' }
const VERSION_OPT: Opt = { id: '', short: 'V', long: 'version', type: 'boolean', value: '', def: '', choices: '', desc: 'output the version number' }

/** Options a command's help actually lists: its own, plus -h (and -V at root). */
function listedOpts(spec: Spec, id: string): Opt[] {
	const node = byId(spec, id)
	return node
		? [...node.opts, HELP_OPT]
		: [VERSION_OPT, ...(spec.globals ?? []), HELP_OPT]
}

/** `build|b` — the alias rides along in the command's own usage and listing. */
const titleOf = (c: Command): string => c.name + (c.alias ? '|' + c.alias : '')

/** The tail of a command's own Usage line: always `[options]`, then either
    `[command]` or its positionals. */
function usageTail(spec: Spec, id: string): string[] {
	const node = byId(spec, id)
	const subs = kids(spec, id)
	const tail = ['[options]']
	if (subs.length) tail.push('[command]')
	else for (const a of node?.args ?? []) tail.push(argToken(a))
	return tail
}

/** The shorter tail used when a command is listed inside its parent's Commands
    section: `[options]` only if it declares any of its own, its positionals if
    it is a leaf, and never `[command]`. Verified against the real binary —
    `preset` lists bare, `add [files...]` has no `[options]`. */
function listingTail(spec: Spec, c: Command): string[] {
	const tail: string[] = []
	if (c.opts.length) tail.push('[options]')
	if (!kids(spec, c.id).length) for (const a of c.args) tail.push(argToken(a))
	return tail
}

export function usageParts(spec: Spec, id: string): UsagePart[] {
	const parts: UsagePart[] = [{ t: 'bin', v: spec.pkg.bin || 'cli' }]
	const path = chain(spec, id)
	path.forEach((c, i) => parts.push({ t: 'cmd', v: i === path.length - 1 ? titleOf(c) : c.name }))
	for (const v of usageTail(spec, id)) {
		parts.push({ t: v === '[options]' ? 'opt' : v === '[command]' ? 'sub' : v.startsWith('<') ? 'req' : 'optarg', v })
	}
	return parts
}

export const usageLine = (spec: Spec, id: string): string => usageParts(spec, id).map((p) => p.v).join(' ')

const pad = (s: string, n: number): string => String(s) + ' '.repeat(Math.max(0, n - String(s).length))

function optTail(o: Opt): string {
	let tail = o.desc || ''
	const bits: string[] = []
	if (o.type === 'enum' && o.choices) {
		bits.push('choices: ' + String(o.choices).split(',').map((s) => q(s.trim())).join(', '))
	}
	if (o.def) bits.push('default: ' + (o.type === 'number' ? o.def : q(o.def)))
	return bits.length ? `${tail}${tail ? ' ' : ''}(${bits.join(', ')})` : tail
}

export function helpLines(spec: Spec, id: string): HelpLine[] {
	const node = byId(spec, id)
	const subs = kids(spec, id)
	const args = subs.length ? [] : node?.args ?? []
	const opts = listedOpts(spec, id)
	const cmdTitles = subs.map((s) => [titleOf(s), ...listingTail(spec, s)].join(' '))
	if (subs.length) cmdTitles.push('help [command]')

	const width = Math.max(
		...args.map((a) => (a.name || 'arg').length),
		...opts.map((o) => optFlags(o).length),
		...cmdTitles.map((t) => t.length),
		0
	) + 2

	const out: HelpLine[] = [{ c: '', t: 'Usage: ' + usageLine(spec, id) }, { c: '', t: '' }]
	const desc = node ? node.desc : spec.pkg.description
	if (desc) out.push({ c: '', t: desc }, { c: '', t: '' })

	if (args.length) {
		out.push({ c: '', t: 'Arguments:' })
		for (const a of args) {
			const tail = (a.desc || '') + (a.def ? ` (default: ${q(a.def)})` : '')
			out.push({ c: 'a', t: '  ' + (tail ? pad(a.name || 'arg', width) + tail : (a.name || 'arg')) })
		}
		out.push({ c: '', t: '' })
	}

	out.push({ c: '', t: 'Options:' })
	for (const o of opts) {
		const tail = optTail(o)
		out.push({ c: 'k', t: '  ' + (tail ? pad(optFlags(o), width) + tail : optFlags(o)) })
	}

	if (subs.length) {
		out.push({ c: '', t: '' }, { c: '', t: 'Commands:' })
		subs.forEach((s, i) => {
			const tail = s.desc || ''
			out.push({ c: 'k', t: '  ' + (tail ? pad(cmdTitles[i], width) + tail : cmdTitles[i]) })
		})
		const last = cmdTitles[cmdTitles.length - 1]
		out.push({ c: 'k', t: '  ' + pad(last, width) + 'display help for command' })
	}
	return out
}

export const helpText = (spec: Spec, id: string): string => helpLines(spec, id).map((l) => l.t).join('\n')

// Map generator for the untw offline engine. NOT part of the app build — run it
// manually in an environment that has tailwindcss, tw-animate-css and postcss
// installed (for example: NODE_PATH=/tmp/twdecode-probe/node_modules node
// src/lib/untw/tools/generate-map.mjs <out-resolution-map.json>).
//
// It compiles a programmatically enumerated candidate set with the REAL
// Tailwind v4 compiler (plus tw-animate-css and the shadcn-style dark custom
// variant) and records each candidate's emitted declarations, with nested
// @supports color-mix overrides merged over plain-var fallbacks. The app then
// resolves core utilities from this map with zero runtime dependencies.

import { compile } from 'tailwindcss'
import fs from 'node:fs'
import path from 'node:path'
import postcss from 'postcss'

const HUES = [
  'slate', 'gray', 'zinc', 'neutral', 'stone',
  'red', 'orange', 'amber', 'yellow', 'lime',
  'green', 'emerald', 'teal', 'cyan', 'sky',
  'blue', 'indigo', 'violet', 'purple', 'fuchsia',
  'pink', 'rose'
]
const STEPS = ['50', '100', '200', '300', '400', '500', '600', '700', '800', '900', '950']
const COLOR_UTILS = [
  'bg', 'text', 'border', 'border-x', 'border-t', 'ring', 'divide',
  'decoration', 'accent', 'caret', 'outline', 'fill', 'stroke', 'from', 'via', 'to'
]
const COLOR_BASE = ['black', 'white', 'transparent', 'current', 'inherit']
const NUMS = Array.from({ length: 97 }, (_, i) => String(i))
const HALVES = ['0.5', '1.5', '2.5', '3.5']
const FRACTS = ['1/2', '1/3', '2/3', '1/4', '2/4', '3/4', '1/5', '2/5', '3/5', '4/5', '1/6', '5/6', '1/12', '5/12', '7/12', '11/12']

function buildCandidates() {
  const c = new Set()
  const add = (...toks) => toks.forEach((t) => c.add(t))

  // numeric spacing scales (v4: strictly n * --spacing)
  const spacing = ['p', 'px', 'py', 'pt', 'pr', 'pb', 'pl', 'ps', 'pe', 'm', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me', 'gap', 'gap-x', 'gap-y', 'space-x', 'space-y', 'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end', 'size', 'w', 'h', 'min-w', 'max-w', 'min-h', 'max-h', 'basis']
  for (const pre of spacing) for (const n of NUMS) add(`${pre}-${n}`)
  for (const pre of spacing) for (const f of HALVES) add(`${pre}-${f}`)
  add('p-px', 'm-px', 'gap-px', 'size-px', 'w-px', 'h-px')
  // negatives (margins, offsets, space-between)
  const neg = ['m', 'mx', 'my', 'mt', 'mr', 'mb', 'ml', 'ms', 'me', 'space-x', 'space-y', 'inset', 'inset-x', 'inset-y', 'top', 'right', 'bottom', 'left', 'start', 'end']
  for (const pre of neg) for (const n of NUMS) add(`-${pre}-${n}`)
  for (const pre of neg) for (const f of HALVES) add(`-${pre}-${f}`)
  add('m-auto', 'mx-auto', 'my-auto', 'mt-auto', 'mr-auto', 'mb-auto', 'ml-auto', 'ms-auto', 'me-auto', 'inset-auto')
  add('w-full', 'h-full', 'size-full', 'w-screen', 'h-screen', 'w-svw', 'w-svh', 'h-svw', 'h-svh', 'w-dvw', 'w-dvh', 'h-dvw', 'h-dvh', 'w-min', 'w-max', 'w-fit', 'h-min', 'h-max', 'h-fit', 'size-min', 'size-max', 'size-fit', 'size-auto')
  for (const f of FRACTS) { add(`w-${f}`, `h-${f}`, `size-${f}`, `basis-${f}`) }
  add('basis-auto', 'basis-full')
  add('min-w-full', 'min-w-min', 'min-w-max', 'min-w-fit', 'max-w-none', 'max-w-full', 'max-w-min', 'max-w-max', 'max-w-fit', 'max-w-prose')
  for (const s of ['xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl']) add(`max-w-${s}`)
  for (const s of ['sm', 'md', 'lg', 'xl', '2xl']) add(`max-w-screen-${s}`)
  add('min-h-full', 'min-h-screen', 'min-h-svh', 'min-h-dvh', 'min-h-min', 'min-h-max', 'min-h-fit', 'max-h-full', 'max-h-screen', 'max-h-svh', 'max-h-dvh', 'max-h-min', 'max-h-max', 'max-h-fit')

  // colors across utilities
  for (const h of HUES) for (const s of STEPS) for (const u of COLOR_UTILS) add(`${u}-${h}-${s}`)
  for (const b of COLOR_BASE) for (const u of COLOR_UTILS) add(`${u}-${b}`)
  // a few opacity-modified proofs (runtime synthesizes the rest arithmetically)
  for (const h of ['red', 'slate', 'blue']) for (const s of ['500']) for (const u of ['bg', 'text', 'border']) for (const o of ['10', '20', '50']) add(`${u}-${h}-${s}/${o}`)

  // radius
  const rsizes = ['', '-none', '-sm', '-md', '-lg', '-xl', '-2xl', '-3xl', '-full']
  const rsides = ['', '-t', '-r', '-b', '-l', '-s', '-e', '-tl', '-tr', '-br', '-bl', '-ss', '-se', '-es', '-ee']
  for (const a of rsizes) for (const b of rsides) add(`rounded${b}${a}`)

  // typography
  for (const s of ['xs', 'sm', 'base', 'lg', 'xl', '2xl', '3xl', '4xl', '5xl', '6xl', '7xl', '8xl', '9xl']) add(`text-${s}`)
  for (const w of ['thin', 'extralight', 'light', 'normal', 'medium', 'semibold', 'bold', 'extrabold', 'black']) add(`font-${w}`)
  add('font-sans', 'font-serif', 'font-mono')
  for (const t of ['tighter', 'tight', 'normal', 'wide', 'wider', 'widest']) add(`tracking-${t}`)
  for (const l of ['none', 'tight', 'snug', 'normal', 'relaxed', 'loose', '3', '4', '5', '6', '7', '8', '9', '10']) add(`leading-${l}`)
  add('text-left', 'text-center', 'text-right', 'text-justify', 'text-start', 'text-end')
  add('uppercase', 'lowercase', 'capitalize', 'normal-case', 'italic', 'not-italic')
  add('underline', 'overline', 'line-through', 'no-underline')
  add('decoration-solid', 'decoration-dashed', 'decoration-dotted', 'decoration-double', 'decoration-wavy')
  for (const n of ['auto', '0', '1', '2', '4', '8']) add(`underline-offset-${n}`)
  for (const n of ['auto', 'from-font', '0', '1', '2', '4', '8']) add(`decoration-${n}`)
  add('truncate', 'text-ellipsis', 'text-clip', 'text-wrap', 'text-nowrap', 'text-balance', 'text-pretty')
  add('whitespace-normal', 'whitespace-nowrap', 'whitespace-pre', 'whitespace-pre-line', 'whitespace-pre-wrap', 'whitespace-break-spaces')
  add('break-normal', 'break-words', 'break-all', 'break-keep')
  add('align-baseline', 'align-top', 'align-middle', 'align-bottom', 'align-text-top', 'align-text-bottom', 'align-sub', 'align-super')
  add('antialiased', 'subpixel-antialiased')

  // layout
  add('block', 'inline-block', 'inline', 'flex', 'inline-flex', 'table', 'inline-table', 'table-caption', 'table-cell', 'table-row', 'grid', 'inline-grid', 'contents', 'list-item', 'hidden')
  add('static', 'fixed', 'absolute', 'relative', 'sticky')
  add('float-start', 'float-end', 'float-right', 'float-left', 'float-none', 'clear-start', 'clear-end', 'clear-right', 'clear-left', 'clear-both', 'clear-none')
  add('object-contain', 'object-cover', 'object-fill', 'object-none', 'object-scale-down')
  for (const o of ['auto', 'hidden', 'clip', 'visible', 'scroll']) { add(`overflow-${o}`, `overflow-x-${o}`, `overflow-y-${o}`) }
  add('overscroll-auto', 'overscroll-contain', 'overscroll-none', 'overscroll-x-auto', 'overscroll-y-auto')
  for (const z of ['0', '10', '20', '30', '40', '50', 'auto']) add(`z-${z}`)
  add('visible', 'invisible', 'collapse', 'isolate', 'isolation-auto')

  // flex / grid
  add('flex-1', 'flex-auto', 'flex-initial', 'flex-none')
  add('flex-row', 'flex-row-reverse', 'flex-col', 'flex-col-reverse')
  add('flex-wrap', 'flex-wrap-reverse', 'flex-nowrap')
  for (const p of ['place-content-center', 'place-content-start', 'place-content-end', 'place-content-between', 'place-content-around', 'place-content-evenly', 'place-content-baseline', 'place-content-stretch']) add(p)
  for (const p of ['place-items-start', 'place-items-end', 'place-items-center', 'place-items-baseline', 'place-items-stretch']) add(p)
  for (const p of ['content-normal', 'content-center', 'content-start', 'content-end', 'content-between', 'content-around', 'content-evenly', 'content-baseline', 'content-stretch']) add(p)
  for (const p of ['items-start', 'items-end', 'items-center', 'items-baseline', 'items-stretch']) add(p)
  for (const p of ['justify-normal', 'justify-start', 'justify-end', 'justify-center', 'justify-between', 'justify-around', 'justify-evenly', 'justify-stretch']) add(p)
  for (const p of ['justify-items-start', 'justify-items-end', 'justify-items-center', 'justify-items-stretch']) add(p)
  for (const p of ['self-auto', 'self-start', 'self-end', 'self-center', 'self-stretch', 'self-baseline']) add(p)
  add('grow', 'grow-0', 'shrink', 'shrink-0')
  for (let i = 1; i <= 12; i++) add(`order-${i}`)
  add('order-first', 'order-last', 'order-none')
  for (let i = 1; i <= 12; i++) add(`grid-cols-${i}`)
  add('grid-cols-none', 'grid-cols-subgrid')
  for (let i = 1; i <= 12; i++) add(`col-span-${i}`)
  add('col-span-full', 'col-auto')
  for (let i = 1; i <= 13; i++) { add(`col-start-${i}`, `col-end-${i}`, `row-start-${i}`, `row-end-${i}`) }
  add('col-start-auto', 'col-end-auto', 'row-start-auto', 'row-end-auto')
  for (let i = 1; i <= 6; i++) add(`grid-rows-${i}`)
  add('grid-rows-none', 'grid-rows-subgrid')
  for (let i = 1; i <= 12; i++) add(`row-span-${i}`)
  add('row-span-full', 'row-auto')
  add('grid-flow-row', 'grid-flow-col', 'grid-flow-dense', 'grid-flow-row-dense', 'grid-flow-col-dense')
  add('auto-cols-auto', 'auto-cols-min', 'auto-cols-max', 'auto-cols-fr', 'auto-rows-auto', 'auto-rows-min', 'auto-rows-max', 'auto-rows-fr')

  // borders extra
  add('border', 'border-x', 'border-y', 'border-t', 'border-r', 'border-b', 'border-l', 'border-s', 'border-e')
  for (const n of ['0', '2', '4', '8']) {
    add(`border-${n}`)
    for (const s of ['x', 'y', 't', 'r', 'b', 'l', 's', 'e']) add(`border-${s}-${n}`)
  }
  add('divide-x', 'divide-y', 'divide-x-0', 'divide-y-0', 'divide-x-2', 'divide-y-2', 'divide-x-4', 'divide-y-4', 'divide-solid', 'divide-dashed', 'divide-dotted', 'divide-none')
  add('outline-solid', 'outline-dashed', 'outline-dotted', 'outline-double', 'outline-hidden', 'outline-none')
  for (const n of ['0', '1', '2', '4', '8']) add(`outline-${n}`)
  for (const n of ['0', '1', '2', '4', '8']) add(`outline-offset-${n}`)
  add('ring', 'ring-inset')
  for (const n of ['0', '1', '2', '4', '8']) add(`ring-${n}`)
  for (const n of ['0', '1', '2', '4', '8']) add(`ring-offset-${n}`)
  add('outline')
  // backgrounds: image, position, size, repeat, attachment
  add('bg-none', 'bg-auto', 'bg-cover', 'bg-contain')
  for (const p of ['bottom', 'center', 'left', 'left-bottom', 'left-top', 'right', 'right-bottom', 'right-top', 'top']) add(`bg-${p}`)
  add('bg-repeat', 'bg-no-repeat', 'bg-repeat-x', 'bg-repeat-y', 'bg-repeat-round', 'bg-repeat-space')
  add('bg-fixed', 'bg-local', 'bg-scroll')
  add('bg-clip-border', 'bg-clip-padding', 'bg-clip-content', 'bg-clip-text')
  add('bg-origin-border', 'bg-origin-padding', 'bg-origin-content')
  for (const d of ['t', 'tr', 'r', 'br', 'b', 'bl', 'l', 'tl']) add(`bg-linear-to-${d}`)
  add('bg-radial', 'bg-conic')
  // object position
  for (const p of ['bottom', 'center', 'left', 'left-bottom', 'left-top', 'right', 'right-bottom', 'right-top', 'top']) add(`object-${p}`)
  // aspect and sizing autos
  add('aspect-auto', 'aspect-square', 'aspect-video', 'w-auto', 'h-auto')
  // svg stroke widths
  add('stroke-0', 'stroke-1', 'stroke-2')
  add('fill-none')
  add('border-collapse', 'border-separate', 'table-auto', 'table-fixed', 'caption-top', 'caption-bottom')

  // effects
  for (const s of ['2xs', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', 'inner', 'none']) add(`shadow-${s}`)
  add('shadow')
  for (let o = 0; o <= 100; o += 5) add(`opacity-${o}`)
  for (const b of ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity', 'plus-darker', 'plus-lighter']) add(`mix-blend-${b}`)
  for (const b of ['normal', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'color-dodge', 'color-burn', 'hard-light', 'soft-light', 'difference', 'exclusion', 'hue', 'saturation', 'color', 'luminosity']) add(`bg-blend-${b}`)
  for (const s of ['none', 'xs', 'sm', 'md', 'lg', 'xl', '2xl', '3xl']) { add(`blur-${s}`, `backdrop-blur-${s}`) }
  add('blur', 'backdrop-blur')
  for (const v of ['0', '50', '75', '90', '95', '100', '105', '110', '125', '150', '200']) { add(`brightness-${v}`, `contrast-${v}`, `saturate-${v}`) }
  add('grayscale', 'grayscale-0', 'invert', 'invert-0', 'sepia', 'sepia-0')
  for (const h of ['0', '15', '30', '60', '90', '180']) add(`hue-rotate-${h}`)
  add('-hue-rotate-15', '-hue-rotate-30', '-hue-rotate-60', '-hue-rotate-90', '-hue-rotate-180')
  add('filter', 'filter-none', 'backdrop-filter', 'backdrop-filter-none')
  for (const c of ['auto', 'default', 'pointer', 'wait', 'text', 'move', 'help', 'not-allowed', 'none', 'context-menu', 'progress', 'cell', 'crosshair', 'vertical-text', 'alias', 'copy', 'no-drop', 'grab', 'grabbing', 'all-scroll', 'col-resize', 'row-resize', 'n-resize', 'e-resize', 's-resize', 'w-resize', 'zoom-in', 'zoom-out']) add(`cursor-${c}`)
  add('pointer-events-none', 'pointer-events-auto', 'resize-none', 'resize-x', 'resize-y', 'resize')
  add('select-none', 'select-text', 'select-all', 'select-auto')
  add('scroll-auto', 'scroll-smooth')
  for (const t of ['auto', 'none', 'pan-x', 'pan-y', 'pan-left', 'pan-right', 'pan-up', 'pan-down', 'pinch-zoom', 'manipulation']) add(`touch-${t}`)
  add('will-change-auto', 'will-change-scroll', 'will-change-contents', 'will-change-transform')
  add('transform', 'transform-none', 'transform-gpu', 'transform-cpu')
  for (const n of ['0', '50', '75', '90', '95', '100', '105', '110', '125', '150']) { add(`scale-${n}`, `scale-x-${n}`, `scale-y-${n}`) }
  for (const n of ['0', '1', '2', '3', '6', '12', '45', '90', '180']) { add(`rotate-${n}`, `-rotate-${n}`) }
  add('skew-x-0', 'skew-x-1', 'skew-x-2', 'skew-x-3', 'skew-x-6', 'skew-x-12', 'skew-y-0', 'skew-y-1', 'skew-y-2', 'skew-y-3', 'skew-y-6', 'skew-y-12')

  // transitions and animation
  add('transition', 'transition-none', 'transition-all', 'transition-colors', 'transition-opacity', 'transition-shadow', 'transition-transform')
  for (const d of ['0', '75', '100', '150', '200', '300', '500', '700', '1000']) add(`duration-${d}`)
  add('ease-linear', 'ease-in', 'ease-out', 'ease-in-out')
  for (const d of ['0', '75', '100', '150', '200', '300', '500', '700', '1000']) add(`delay-${d}`)
  add('animate-none', 'animate-spin', 'animate-ping', 'animate-pulse', 'animate-bounce')
  // tw-animate-css enter/exit vocabulary
  add('animate-in', 'animate-out')
  for (const f of ['0', '25', '50', '75', '100']) { add(`fade-in-${f}`, `fade-out-${f}`) }
  for (const z of ['0', '50', '75', '90', '95', '100', '105', '110', '125', '150']) { add(`zoom-in-${z}`, `zoom-out-${z}`, `spin-in-${z}`, `spin-out-${z}`) }
  for (const s of ['top', 'right', 'bottom', 'left']) for (const n of ['0', '1', '2', '3', '4', '6', '8', '12', '16', 'full']) { add(`slide-in-from-${s}-${n}`, `slide-out-to-${s}-${n}`) }

  // misc
  add('sr-only', 'not-sr-only', 'visible')
  add('appearance-none', 'appearance-auto')
  add('forced-color-adjust-auto', 'forced-color-adjust-none')
  add('truncate')

  return [...c]
}

// dot-anchored selector match (same rule as the app runtime matcher)
function matches(selector, token) {
  for (const part of selector.split(',')) {
    const s = part.trim().replace(/\\/g, '')
    const needle = '.' + token
    let i = -1
    while ((i = s.indexOf(needle, i + 1)) !== -1) {
      const next = s[i + needle.length] ?? ''
      if ([':', ' ', '[', '.', '>', '+', '~', ')', ',', ''].includes(next)) return true
    }
  }
  return false
}

const declText = (nodes) =>
  ((nodes ?? []).filter((n) => n.type === 'decl').map((n) => `${n.prop}: ${n.value}`).join('; '))
function mergeDecls(base, over) {
  const map = new Map()
  for (const d of base.split('; ').filter(Boolean)) {
    const i = d.indexOf(': ')
    if (i > 0) map.set(d.slice(0, i), d.slice(i + 2))
  }
  for (const d of over.split('; ').filter(Boolean)) {
    const i = d.indexOf(': ')
    if (i > 0) map.set(d.slice(0, i), d.slice(i + 2))
  }
  return [...map.entries()].map(([k, v]) => `${k}: ${v}`).join('; ')
}

const outPath = process.argv[2]
if (!outPath) {
  console.error('usage: node generate-map.mjs <out-resolution-map.json>')
  process.exit(1)
}

const input = `@import "tailwindcss";
@import "tw-animate-css";
@custom-variant dark (&:is(.dark *));`

const { build } = await compile(input, {
  base: process.cwd(),
  loadStylesheet: async (id, base) => {
    const table = { tailwindcss: 'tailwindcss/index.css', 'tw-animate-css': 'tw-animate-css/dist/tw-animate.css' }
    const p = table[id] ? path.join(process.cwd(), 'node_modules', table[id]) : path.resolve(base, id)
    return { path: p, base: path.dirname(p), content: fs.readFileSync(p, 'utf8') }
  },
  loadModule: async (id, base) => ({ path: id, base, module: {} })
})

const candidates = buildCandidates()
console.error(`candidates: ${candidates.length}`)
const css = build(candidates)
const rules = []
postcss.parse(css).walkRules((r) => {
  if (!r.selector) return
  const base = declText((r.nodes ?? []).filter((n) => n.type !== 'atrule'))
  let over = ''
  for (const n of r.nodes ?? []) if (n.type === 'atrule' && n.name === 'supports') over = declText(n.nodes)
  if (!base && !over) return
  rules.push({ selector: r.selector, decls: over ? mergeDecls(base, over) : base, fallback: over && over !== base ? base || null : null })
})

const map = {}
let missed = []
for (const tok of candidates) {
  const hit = rules.find((r) => matches(r.selector, tok))
  if (hit) map[tok] = hit.fallback ? [hit.decls, hit.fallback] : [hit.decls]
  else missed.push(tok)
}
fs.writeFileSync(outPath, JSON.stringify(map))
console.error(`mapped: ${Object.keys(map).length}/${candidates.length}`)
console.error(`missed sample: ${JSON.stringify(missed.slice(0, 20))}`)

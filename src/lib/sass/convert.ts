// The conversion engine, shared by both methods of the Sassy surface.
//
//   sass → css : full compile via Dart Sass (the `sass` package). Resolves
//                variables, nesting, mixins and @use, so the output is real,
//                valid CSS.
//   css → sass : syntactic reformat (see cssToSass.ts). No compiler exists for
//                this direction.
//
// Dart Sass is ~3 MB, so it is loaded lazily with a dynamic import — only the
// first time a sass→css conversion actually runs. Opening the surface, editing
// its layout, toggling around, or doing css→sass never pulls it in.

import type * as Sass from 'sass'
import { invoke } from '@tauri-apps/api/core'
import { cssToSass } from './cssToSass'

export { cssToSass }

// Memoised so the ~3 MB chunk loads at most once per session.
let sassPromise: Promise<typeof Sass> | null = null
function loadSass(): Promise<typeof Sass> {
  return (sassPromise ??= import('sass'))
}

/**
 * Paste mode: compile a self-contained indented-SASS snippet. There is no file
 * on disk, so `@use`/`@import` of other files cannot resolve — that surfaces as
 * a Sass error, which is the honest result for a lone snippet.
 */
export async function sassToCss(source: string): Promise<string> {
  const sass = await loadSass()
  return sass.compileString(source, { syntax: 'indented', style: 'expanded' }).css
}

/**
 * File mode: compile a file whose `@use`/`@import` may reference sibling files
 * on disk. Those are read back through the Rust `read_text` command via a custom
 * importer, resolved relative to `filePath`.
 */
export async function sassToCssFile(source: string, filePath: string): Promise<string> {
  const sass = await loadSass()
  const res = await sass.compileStringAsync(source, {
    syntax: 'indented',
    style: 'expanded',
    url: pathToFileURL(filePath),
    importers: [rustImporter()],
  })
  return res.css
}

// ---------------------------------------------------------------- importer ----
// Dart Sass runs inside the webview, which has no filesystem access, so its
// loader can't read imported partials itself. This importer resolves each
// `@use`/`@import` target to a real path (trying Sass's partial/extension/index
// candidates) and reads it through the backend.

function rustImporter(): Sass.Importer<'async'> {
  const cache = new Map<string, { contents: string; syntax: Sass.Syntax }>()
  return {
    async canonicalize(url, ctx) {
      let resolved: URL
      try {
        resolved = new URL(url, ctx.containingUrl ?? new URL('file:///'))
      } catch {
        return null
      }
      if (resolved.protocol !== 'file:') return null
      for (const cand of candidates(fileURLToPath(resolved))) {
        try {
          const contents = await invoke<string>('read_text', { path: cand })
          const canon = pathToFileURL(cand)
          cache.set(canon.href, { contents, syntax: syntaxFor(cand) })
          return canon
        } catch {
          // not this candidate — try the next
        }
      }
      return null
    },
    async load(canonicalUrl) {
      const hit = cache.get(canonicalUrl.href)
      if (hit) return hit
      const p = fileURLToPath(canonicalUrl)
      const contents = await invoke<string>('read_text', { path: p })
      return { contents, syntax: syntaxFor(p) }
    },
  }
}

// The paths Sass would try for a bare import like `@use 'vars'`, in precedence
// order: partial first, then plain, across .sass/.scss/.css, then an index dir.
function candidates(p: string): string[] {
  if (/\.(sass|scss|css)$/i.test(p)) return [p]
  const slash = p.lastIndexOf('/')
  const dir = p.slice(0, slash + 1)
  const name = p.slice(slash + 1)
  const exts = ['.sass', '.scss', '.css']
  const list: string[] = []
  for (const ext of exts) list.push(`${dir}_${name}${ext}`, `${dir}${name}${ext}`)
  for (const ext of exts) list.push(`${p}/_index${ext}`, `${p}/index${ext}`)
  return list
}

function syntaxFor(p: string): Sass.Syntax {
  if (p.endsWith('.sass')) return 'indented'
  if (p.endsWith('.css')) return 'css'
  return 'scss'
}

// POSIX path <-> file: URL. This app is macOS-only (Tauri traffic-light chrome),
// so paths are absolute POSIX; encode per-segment to survive spaces and the like.
function pathToFileURL(p: string): URL {
  return new URL('file://' + p.split('/').map(encodeURIComponent).join('/'))
}

function fileURLToPath(u: URL): string {
  return decodeURIComponent(u.pathname)
}

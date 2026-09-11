// Class-string extraction. Pure TypeScript, zero dependencies.
// Ports the proven fractalstyler extractor: point at component code, get blocks.

export interface ClassBlock {
  /** ordinal of the class attribute in the pasted source */
  index: number
  /** which syntax caught it: class / className / svelte:class / cn() … */
  attr: string
  /** raw string inside the quotes */
  raw: string
  /** individual tokens, in order, deduped per block */
  tokens: string[]
}

const ATTR_RE =
  /(?:class|className|:class|class:class)\s*=\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`|\{["'`]([^"'`]+)["'`]\})/g

const CN_RE = /(?:cn|clsx|twMerge|cva)\(\s*([^)]+)\)/g
const STR_RE = /["'`]([^"'`]+)["'`]/g
const DYNAMIC_RE = /\$\{/

/** True when a token can never resolve statically (template interpolation). */
export function isDynamic(token: string): boolean {
  return DYNAMIC_RE.test(token)
}

/** Extract every class="..." / className="..." / cn("...") block from pasted code. */
export function extractBlocks(code: string): ClassBlock[] {
  const blocks: ClassBlock[] = []
  let m: RegExpExecArray | null
  ATTR_RE.lastIndex = 0
  while ((m = ATTR_RE.exec(code)) !== null) {
    const raw = m.slice(1).find(Boolean) ?? ''
    const attr = m[0].split('=')[0].trim()
    const tokens = tokenize(raw)
    if (tokens.length > 0) blocks.push({ index: blocks.length, attr, raw, tokens })
  }
  CN_RE.lastIndex = 0
  while ((m = CN_RE.exec(code)) !== null) {
    const inner = m[1]
    let s: RegExpExecArray | null
    STR_RE.lastIndex = 0
    while ((s = STR_RE.exec(inner)) !== null) {
      const raw = s[1]
      if (!/[a-z]/i.test(raw) || raw.includes('${')) continue
      if (!looksLikeClasses(raw)) continue
      const tokens = tokenize(raw)
      if (tokens.length > 0) blocks.push({ index: blocks.length, attr: 'cn()', raw, tokens })
    }
  }
  return blocks
}

/** Split a class string into tokens, keeping variants, negatives, arbitrary values. */
export function tokenize(raw: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(/\s+/)) {
    const t = part.trim()
    if (!t || seen.has(t)) continue
    seen.add(t)
    out.push(t)
  }
  return out
}

/** All unique tokens across blocks, first-seen order. Dynamic tokens included. */
export function uniqueTokens(blocks: ClassBlock[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const b of blocks)
    for (const t of b.tokens)
      if (!seen.has(t)) {
        seen.add(t)
        out.push(t)
      }
  return out
}

function looksLikeClasses(raw: string): boolean {
  return raw
    .split(/\s+/)
    .some(
      (t) =>
        t.includes('-') ||
        t.includes(':') ||
        /^(flex|grid|block|hidden|relative|absolute|truncate|transition|border|shadow|ring|outline)$/.test(t)
    )
}

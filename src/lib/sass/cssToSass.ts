// CSS → indented SASS.
//
// There is no compiler for this direction — it is a syntactic reformat: strip
// braces and semicolons, and turn brace-nesting depth into single-tab
// indentation. The result is "pure" SASS (indented, no braces, not SCSS).
//
// The scanner walks the source character by character tracking brace depth,
// while deliberately ignoring structural characters ({ } ;) that live inside
// strings, url(...)/function parens, and /* */ or // comments — so a semicolon
// in a data: URI or a brace in a comment never confuses the nesting.
//
// Known limits (best-effort, not a full CSS parser): unusual comment placement
// or malformed input may reformat imperfectly. It never emits silently-wrong
// output for a hard parse failure — it just reformats what it sees.

export function cssToSass(css: string): string {
  const out: string[] = []
  let depth = 0
  let buf = '' // text accumulated since the last structural char
  let paren = 0 // > 0 while inside (...), e.g. url(...) or a function call
  let i = 0
  const n = css.length

  const pad = (d: number) => '\t'.repeat(Math.max(0, d))

  // A selector or at-rule header (the text before a `{`).
  const emitHeader = () => {
    const s = buf.trim()
    buf = ''
    if (!s) return
    // A blank line between top-level blocks keeps the output readable.
    if (depth === 0 && out.length && out[out.length - 1] !== '') out.push('')
    out.push(pad(depth) + s)
  }

  // A declaration (the text before a `;` or the final `}` of a block).
  const emitDecl = () => {
    const s = buf.trim()
    buf = ''
    if (s) out.push(pad(depth) + s)
  }

  // A standalone comment gets its own line(s), indented at the current depth.
  const emitComment = (text: string) => {
    const lines = text.split('\n')
    for (const ln of lines) out.push(pad(depth) + ln.replace(/[ \t]+$/, ''))
  }

  while (i < n) {
    const c = css[i]

    // Block comment.
    if (c === '/' && css[i + 1] === '*') {
      let j = i + 2
      while (j < n && !(css[j] === '*' && css[j + 1] === '/')) j++
      const text = css.slice(i, Math.min(j + 2, n))
      i = Math.min(j + 2, n)
      if (paren === 0 && buf.trim() === '') {
        buf = ''
        emitComment(text)
      } else {
        buf += text
      }
      continue
    }

    // Line comment (not valid CSS, but tolerate it in SASS-flavoured input).
    if (c === '/' && css[i + 1] === '/') {
      let j = i + 2
      while (j < n && css[j] !== '\n') j++
      const text = css.slice(i, j)
      i = j
      if (paren === 0 && buf.trim() === '') {
        buf = ''
        out.push(pad(depth) + text.replace(/[ \t]+$/, ''))
      } else {
        buf += text
      }
      continue
    }

    // String literal — copy verbatim, honouring escapes.
    if (c === '"' || c === "'") {
      const q = c
      buf += c
      let j = i + 1
      while (j < n) {
        buf += css[j]
        if (css[j] === '\\') {
          buf += css[j + 1] ?? ''
          j += 2
          continue
        }
        if (css[j] === q) {
          j++
          break
        }
        j++
      }
      i = j
      continue
    }

    if (c === '(') {
      paren++
      buf += c
      i++
      continue
    }
    if (c === ')') {
      if (paren > 0) paren--
      buf += c
      i++
      continue
    }

    if (paren === 0 && c === '{') {
      emitHeader()
      depth++
      i++
      continue
    }
    if (paren === 0 && c === '}') {
      emitDecl() // flush a final declaration with no trailing semicolon
      depth = Math.max(0, depth - 1)
      i++
      continue
    }
    if (paren === 0 && c === ';') {
      emitDecl()
      i++
      continue
    }

    // Newlines inside a pending selector/declaration collapse to a space so
    // comma-separated selectors and wrapped values end up on one line.
    if (c === '\n' || c === '\r') {
      if (buf && !/\s$/.test(buf)) buf += ' '
      i++
      continue
    }

    buf += c
    i++
  }

  emitDecl() // anything trailing after the last block

  return (
    out
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .replace(/[ \t]+$/gm, '')
      .trim() + '\n'
  )
}

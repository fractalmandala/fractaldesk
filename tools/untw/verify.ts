// Golden replay: every token captured from the real Tailwind v4 compiler
// (golden-dropdown.json) must resolve identically through the offline engine.
// Run: npx --yes tsx tools/untw/verify.ts
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { resolveToken } from '../../src/lib/untw/resolve'
import { parseTheme } from '../../src/lib/untw/theme'

const dir = dirname(fileURLToPath(import.meta.url))
const golden = JSON.parse(readFileSync(join(dir, 'golden-dropdown.json'), 'utf8')) as Record<string, string[]>
const theme = parseTheme(readFileSync(join(dir, 'fixture-theme.css'), 'utf8'))

let pass = 0
let fail = 0
for (const [token, decls] of Object.entries(golden)) {
  const r = resolveToken(token, theme)
  if (token === 'group/dropdown-menu-item') {
    if (r.marker) pass++
    else {
      fail++
      console.log(`FAIL(marker) ${token}`)
    }
    continue
  }
  const wantFallback: string | null = decls[1] ?? null
  if (r.css === decls[0] && (r.fallback ?? null) === wantFallback) pass++
  else {
    fail++
    console.log(`FAIL ${token}\n  want: ${decls[0]}\n  got:  ${r.css}\n  wantFb: ${wantFallback}\n  gotFb:  ${r.fallback}`)
  }
}
console.log(`\ngolden: ${pass}/${pass + fail} match`)
if (fail > 0) process.exit(1)

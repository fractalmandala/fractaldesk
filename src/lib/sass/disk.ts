// The "On disk" action, driven from the app header. One native panel selects
// files and/or folders together; each matching source is converted and written
// back next to itself with the swapped extension. The result is reported into
// the shared `sassy.report` (shown in the surface) and the header status line.

import { invoke } from '@tauri-apps/api/core'
import { say } from '../store.svelte.js'
import { sassToCssFile, cssToSass } from './convert'
import { errMsg } from './util'
import { sassy } from './state.svelte.js'
import type { Src, WriteItem, WriteReport } from './types'

export async function runOnDisk(): Promise<void> {
  if (sassy.busy) return
  const fromExt = sassy.direction === 'sass2css' ? 'sass' : 'css'

  let paths: string[]
  try {
    paths = await invoke<string[]>('pick_paths')
  } catch (e) {
    say(errMsg(e), 'bad')
    return
  }
  if (!paths.length) return // cancelled

  sassy.busy = true
  sassy.report = ''
  say('converting…', 'busy')
  try {
    const srcs = await invoke<Src[]>('convert_scan', { paths, fromExt })
    if (!srcs.length) {
      say(`no .${fromExt} files in that selection`, 'bad')
      return
    }

    const items: WriteItem[] = []
    const failures: string[] = []
    for (const s of srcs) {
      try {
        const body =
          sassy.direction === 'sass2css' ? await sassToCssFile(s.body, s.path) : cssToSass(s.body)
        items.push({ source: s.path, body })
      } catch (e) {
        failures.push(`${s.name}: ${errMsg(e)}`)
      }
    }

    let summary = ''
    if (items.length) {
      const rep = await invoke<WriteReport>('convert_write', { items })
      summary = `wrote ${rep.written} file${rep.written === 1 ? '' : 's'}`
      if (rep.overwritten.length) summary += ` (overwrote: ${rep.overwritten.join(', ')})`
    }

    const lines: string[] = []
    if (summary) lines.push(summary)
    if (failures.length) {
      lines.push(`${failures.length} failed:`)
      lines.push(...failures.map((f) => '  ' + f))
    }
    sassy.report = lines.join('\n')
    say(
      items.length ? summary : `all ${failures.length} failed`,
      failures.length && !items.length ? 'bad' : 'ok'
    )
  } catch (e) {
    say(errMsg(e), 'bad')
  } finally {
    sassy.busy = false
  }
}

// The paste "Convert" action, driven from the app header. Reads the input pane,
// writes the output/error panes — all through shared state so the button can
// live in the header away from the panes.

import { say } from '../store.svelte.js'
import { sassToCss, cssToSass } from './convert'
import { errMsg } from './util'
import { sassy } from './state.svelte'

// The paste box has no folder context, so Dart Sass can't resolve `@use`/@import`
// of other files. Point the user at the On disk button, which loads siblings.
function friendly(msg: string): string {
  if (/custom importers are required/i.test(msg)) {
    return (
      msg +
      "\n\n— This snippet @use/@imports other files, which the paste box can't " +
      'resolve (there is no folder to look in). Use the “On disk” button in the ' +
      'header and pick this file (or its folder) so its imports load from disk.'
    )
  }
  return msg
}

export async function runPaste(): Promise<void> {
  sassy.error = ''
  try {
    sassy.output =
      sassy.direction === 'sass2css' ? await sassToCss(sassy.input) : cssToSass(sassy.input)
    say('converted', 'ok')
  } catch (e) {
    sassy.output = ''
    sassy.error = friendly(errMsg(e))
    say('conversion failed — see output', 'bad')
  }
}

export async function copyOutput(): Promise<void> {
  if (!sassy.output) return
  try {
    await navigator.clipboard.writeText(sassy.output)
    sassy.copied = true
    setTimeout(() => (sassy.copied = false), 1400)
  } catch {
    say('clipboard unavailable', 'bad')
  }
}

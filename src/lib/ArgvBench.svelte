<script>
  import { invoke } from '@tauri-apps/api/core'
  import ArgvTree from './ArgvTree.svelte'
  import ArgvEditor from './ArgvEditor.svelte'
  import ArgvOutput from './ArgvOutput.svelte'
  import { DEFAULT_SPEC } from './argv/spec.js'
  import { usageParts } from './argv/help.js'
  import { diagnose } from './argv/diagnostics.js'
  import { say } from './store.svelte.js'

  let spec = $state(DEFAULT_SPEC())
  let sel = $state('root')
  let loaded = $state(false)
  let saving = $state(false)
  // Compare against what is on disk rather than tracking edits with a flag: a
  // flag flips the moment the stored spec loads, which reads as "unsaved" before
  // you have touched anything.
  let baseline = $state('')

  const dirty = $derived(loaded && JSON.stringify(spec) !== baseline)

  const usage = $derived(usageParts(spec, sel))
  const diags = $derived(diagnose(spec))
  const errors = $derived(diags.filter((d) => d.s === 'err').length)

  // The spec lives in the app's data folder — it is your work, not this project's.
  $effect(() => {
    invoke('argv_load')
      .then((found) => { if (found?.pkg && found?.commands) spec = found })
      .catch(() => {})
      .finally(() => {
        baseline = JSON.stringify($state.snapshot(spec))
        loaded = true
      })
  })

  async function save() {
    saving = true
    try {
      const snapshot = $state.snapshot(spec)
      say(await invoke('argv_save', { spec: snapshot }), 'ok')
      baseline = JSON.stringify(snapshot)
    } catch (e) {
      say(String(e), 'bad')
    } finally {
      saving = false
    }
  }

  function reset() {
    if (!confirm('Discard this spec and start from the example?')) return
    spec = DEFAULT_SPEC()
    sel = 'root'
  }
</script>

<div class="bench">
  <div class="synopsis">
    <div class="line">
      <span class="eyebrow">Synopsis</span>
      <span class="spacer"></span>
      {#if dirty}<span class="dirty">unsaved</span>{/if}
      <button class="btn" onclick={reset}>Reset</button>
      <button class="btn primary" disabled={saving} onclick={save}>{saving ? 'Saving…' : 'Save spec'}</button>
    </div>
    <div class="usage">
      {#each usage as p}<span class={p.t}>{p.v}</span>{' '}{/each}
    </div>
    <div class="diags">
      {#each diags as d}
        <span class="diag {d.s}">{d.m}{#if d.c}<code>{d.c}</code>{/if}</span>
      {/each}
    </div>
  </div>

  <div class="cols">
    <div class="col tree"><ArgvTree {spec} bind:sel /></div>
    <div class="col mid"><ArgvEditor {spec} {sel} /></div>
    <div class="col out"><ArgvOutput {spec} {sel} /></div>
  </div>
</div>

<style lang="sass">
.bench
  display: flex
  flex-direction: column
  height: 100%
  min-height: 0

.synopsis
  padding: 14px 20px 12px
  border-bottom: 1px solid var(--rule)

.line
  display: flex
  align-items: center
  gap: 8px
  .spacer
    flex: 1

.eyebrow
  font-size: 10px
  letter-spacing: .13em
  text-transform: uppercase
  color: var(--muted)
  font-weight: 600

.dirty
  font-family: var(--mono)
  font-size: 10.5px
  color: var(--signal)

.usage
  font-family: var(--mono)
  font-size: 16px
  margin-top: 8px
  overflow-x: auto
  white-space: nowrap
  padding-bottom: 4px
  :global(.bin)
    color: var(--signal)
    font-weight: 600
  :global(.cmd)
    color: var(--ink)
    font-weight: 600
  :global(.opt), :global(.sub)
    color: var(--muted)
  :global(.req)
    color: var(--ok)
  :global(.optarg)
    color: var(--ink-2)

.diags
  display: flex
  flex-wrap: wrap
  gap: 5px
  margin-top: 9px
  min-height: 20px

.diag
  font-size: 11px
  border-radius: 999px
  padding: 2px 9px
  display: inline-flex
  gap: 6px
  align-items: center
  code
    font-family: var(--mono)
    font-size: 10.5px
    opacity: .8
  &.err
    background: #e2685f1f
    color: var(--bad)
  &.warn
    background: #e4703a1f
    color: var(--signal)
  &.ok
    background: #6fbf731f
    color: var(--ok)

.cols
  display: grid
  grid-template-columns: 210px minmax(0, 1fr) minmax(0, 460px)
  flex: 1
  min-height: 0
  @media (max-width: 1240px)
    grid-template-columns: 190px minmax(0, 1fr)

.col
  display: flex
  flex-direction: column
  min-width: 0
  min-height: 0
  & + &
    border-left: 1px solid var(--rule)

.col.tree
  background: var(--sunk)

.col.out
  @media (max-width: 1240px)
    display: none
</style>

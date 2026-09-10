<script>
  import { invoke } from '@tauri-apps/api/core'
  import ArgvTree from './ArgvTree.svelte'
  import ArgvEditor from './ArgvEditor.svelte'
  import ArgvOutput from './ArgvOutput.svelte'
  import { DEFAULT_SPEC } from '$lib/argv/spec.js'
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

  function reset() {
    if (!confirm('Discard this spec and start from the example?')) return
    spec = DEFAULT_SPEC()
    sel = 'root'
  }

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
</script>

<div class="bench">

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
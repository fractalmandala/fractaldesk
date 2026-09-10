<script>
  import { invoke } from '@tauri-apps/api/core'
  import ThemesSurface from '$lib/ThemesSurface.svelte'
  import SchemeBrowser from '$lib/SchemeBrowser.svelte'
  import ArgvBench from '$lib/ArgvBench.svelte'
  import ConvertSurface from '$lib/ConvertSurface.svelte'
  import UntwSurface from '$lib/UntwSurface.svelte'
  import { app, say } from '$lib/store.svelte.js'
  import { sassy } from '$lib/sass/state.svelte.js'
  import { runPaste, copyOutput } from '$lib/sass/paste'
  import { runOnDisk } from '$lib/sass/disk'
  import { untw, runConvert, copyText as copyUntw } from '$lib/untw/state.svelte.js'
  import { summaryText } from '$lib/untw/decode.js'
  import { STATES } from '$lib/states.js'
  import { DEFAULT_SPEC } from '$lib/argv/spec.js'
import { usageParts } from '$lib/argv/help.js'

  // The active surface's config from the states registry (undefined = no known
  // surface selected, which falls through to the picker).
  const current = $derived(STATES.find((s) => s.id === app.view))
  // Full-width layout for every surface except the Themes editor, which keeps
  // its 250px sidebar — but only once its document is loaded; the Themes
  // loading/error placeholder wants the full width to centre in.
  const wide = $derived(app.view === 'themes' ? !app.doc : (current ? current.full : true))
  let spec = $state(DEFAULT_SPEC())
  const usage = $derived(usageParts(spec, sel))
  let sel = $state('root')
  let saving = $state(false)

  // The app is its own project: `load` seeds palettes.json into the app data
  // directory on first run and reads it back — there is no folder to pick.
  async function loadProject() {
    app.busy = true
    try {
      const res = await invoke('load')
      app.doc = res.palettes
      app.schema = res.schema
      app.dir = res.dir
      app.cur = 0
      app.dirty = false
      // The scheme collection ships with the app; treat a read failure as empty.
      invoke('schemes')
        .then((found) => { app.schemes = found })
        .catch(() => { app.schemes = [] })
    } catch (e) {
      say(String(e), 'bad')
    } finally {
      app.busy = false
    }
  }

  async function save() {
    app.busy = true
    try {
      const msg = await invoke('save', { args: { doc: $state.snapshot(app.doc) } })
      app.dirty = false
      say(msg, 'ok')
      return true
    } catch (e) {
      say(String(e), 'bad')
      return false
    } finally {
      app.busy = false
    }
  }

  // Regenerate themes/ + package.json (+ Nimbalyst) natively — no Python.
  async function buildThemes() {
    app.busy = true
    say('building…', 'busy')
    try {
      say(await invoke('build', { doc: $state.snapshot(app.doc) }), 'ok')
    } catch (e) {
      say(String(e), 'bad')
    } finally {
      app.busy = false
    }
  }

  // Build, then run vsce for the .vsix. The one step that needs node/npx.
  async function packageVsix() {
    app.busy = true
    say('packaging…', 'busy')
    try {
      const vsix = await invoke('package', { doc: $state.snapshot(app.doc) })
      app.vsix = vsix
      say(`packaged ${vsix.split('/').pop()}`, 'ok')
    } catch (e) {
      say(String(e), 'bad')
    } finally {
      app.busy = false
    }
  }

  function keydown(e) {
    if ((e.metaKey || e.ctrlKey) && e.key === 's') {
      e.preventDefault()
      if (!app.busy && app.doc) save()
    }
  }

  $effect(() => {
    loadProject()
  })
</script>

<svelte:window on:keydown={keydown} />

<header data-tauri-drag-region>
  <!-- GLOBAL: chrome that belongs to the whole app — the title, the surface
       switcher, and app-wide controls (a mode toggle will live here later). -->
  <div class="global">
    <h1 data-tauri-drag-region>FractalDesk</h1>
    <div class="views" role="group" aria-label="Surface">
      {#each STATES as s}
        {@const badge = s.badge?.(app)}
        <button class:on={app.view === s.id} onclick={() => (app.view = s.id)}>
          {s.label}{badge ? ` · ${badge}` : ''}
        </button>
      {/each}
    </div>
  </div>

  <span class="grow" data-tauri-drag-region></span>

  <!-- Status is app-wide: any surface can post a message here. -->
  <span class="msg {app.kind}">{app.msg}</span>

  <!-- CONDITIONAL: controls/info for the active surface only. Mirror the body's
       {#if app.view} clauses — add a branch here when a surface needs a toolbar. -->
  <div class="conditional">
    {#if app.view === 'themes'}
      {#if app.doc}
        <span class="count">{app.doc.themes.length} pairs · {app.doc.themes.length * 2} themes · v{app.doc.meta.version}</span>
        <span class="dot" class:on={app.dirty} title="unsaved changes"></span>
        <button class="btn" onclick={buildThemes} disabled={app.busy}>Build</button>
        <button class="btn" onclick={packageVsix} disabled={app.busy}>Package .vsix</button>
        {#if app.vsix}
          <button class="btn" onclick={() => invoke('reveal', { path: app.vsix })} disabled={app.busy}>Reveal</button>
        {/if}
        <button class="btn primary" onclick={save} disabled={app.busy}>Save</button>
      {/if}
    {/if}
    {#if app.view === 'argv'}
    <div class="usage">
      {#each usage as p}<span class={p.t}>{p.v}</span>{' '}{/each}
    </div>
      <button class="btn" onclick={reset}>Reset</button>
      <button class="btn primary" disabled={saving} onclick={() => save()}>{saving ? 'Saving…' : 'Save spec'}</button>
    {/if}
    {#if app.view === 'sassy'}
      <div class="chips" role="group" aria-label="Direction">
        <button class="chip" class:on={sassy.direction === 'sass2css'} onclick={() => (sassy.direction = 'sass2css')}>SASS → CSS</button>
        <button class="chip" class:on={sassy.direction === 'css2sass'} onclick={() => (sassy.direction = 'css2sass')}>CSS → SASS</button>
      </div>
      <button class="btn primary" onclick={runPaste} disabled={sassy.busy || !sassy.input.trim()}>Convert →</button>
      <button class="btn" onclick={copyOutput} disabled={!sassy.output}>{sassy.copied ? 'Copied' : 'Copy'}</button>
      <button class="btn" onclick={runOnDisk} disabled={sassy.busy}>On disk…</button>
    {/if}
    {#if app.view === 'untw'}
      <button class="btn primary" onclick={runConvert} disabled={untw.busy || !untw.input.trim()}>{untw.busy ? 'Working…' : 'Convert →'}</button>
      <button class="btn" onclick={() => untw.result && copyUntw(summaryText(untw.result), 'summary', say)} disabled={!untw.result}>{untw.copied === 'summary' ? 'Copied' : 'Copy summary'}</button>
      <button class="btn" onclick={() => untw.result && copyUntw(JSON.stringify(untw.result.tokens, null, 2), 'json', say)} disabled={!untw.result}>{untw.copied === 'json' ? 'Copied' : 'Copy JSON'}</button>
    {/if}
  </div>
</header>

<div class="shell" class:full={wide}>
  {#if app.view === 'themes'}
    {#if app.doc}
      <ThemesSurface />
    {:else if app.busy}
      <div class="blank"><p>Loading…</p></div>
    {:else}
      <div class="blank">
        <p>Couldn't open the theme data.</p>
        <button class="btn primary" onclick={loadProject}>Retry</button>
      </div>
    {/if}
  {:else if app.view === 'schemes'}
    <SchemeBrowser />
  {:else if app.view === 'argv'}
    <ArgvBench />
  {:else if app.view === 'sassy'}
    <ConvertSurface />
  {:else if app.view === 'untw'}
    <UntwSurface />
  {:else}
    <!-- No known surface selected: offer the full set to choose from. -->
    <div class="picker">
      <p>Pick a surface</p>
      <div class="views big">
        {#each STATES as s}
          <button onclick={() => (app.view = s.id)}>{s.label}</button>
        {/each}
      </div>
    </div>
  {/if}
</div>

<style lang="sass">

header
	display: flex
	align-items: center
	gap: 12px
	padding: 10px 16px 10px 92px // clear the traffic lights
	background: var(--sunk)
	border-bottom: 1px solid var(--rule)
	height: 56px

// The two header zones: .global (title + nav + app-wide controls) on the
// left, .conditional (per-surface controls) on the right.
.global, .conditional
	display: flex
	align-items: center
	gap: 12px

h1
	font-size: var(--text-md)
	margin: 0
	font-weight: 600
	letter-spacing: .02em
	white-space: nowrap

.count
	font-family: var(--mono)
	font-size: var(--text-xs)
	color: var(--muted)
	white-space: nowrap

.grow
	flex: 1
	align-self: stretch

.dot
	width: 7px
	height: 7px
	border-radius: 50%
	background: var(--signal)
	opacity: 0
	&.on
		opacity: 1

.msg
	font-family: var(--mono)
	font-size: var(--text-sm)
	color: var(--muted)
	white-space: nowrap
	overflow: hidden
	text-overflow: ellipsis
	max-width: 44ch
	&.ok
		color: var(--ok)
	&.bad
		color: var(--bad)
	&.busy
		color: var(--signal)

.blank
	height: 100%
	display: flex
	flex-direction: column
	align-items: center
	justify-content: center
	gap: 18px
	color: var(--ink-2)

.views
	display: flex
	border: 1px solid var(--rule)
	border-radius: 3px
	overflow: hidden
	button
		appearance: none
		border: 0
		background: transparent
		color: var(--muted)
		cursor: pointer
		font-family: var(--mono)
		font-size: var(--text-sm)
		letter-spacing: .06em
		text-transform: uppercase
		padding: 7px 12px
		white-space: nowrap
		&:hover
			color: var(--ink)
		&.on
			background: var(--signal)
			color: #fff

// Per-surface controls that live in the header's .conditional zone (Sassy).
.chips
	display: flex
	gap: 4px
	.chip
		appearance: none
		background: transparent
		border: 1px solid var(--rule)
		border-radius: 2px
		color: var(--muted)
		cursor: pointer
		font-family: var(--mono)
		font-size: var(--text-xs)
		letter-spacing: .05em
		text-transform: uppercase
		padding: 4px 8px
		white-space: nowrap
		&:hover
			color: var(--ink)
		&.on
			background: var(--signal)
			border-color: var(--signal)
			color: #fff

// The fallback surface picker: a larger, standalone version of the header nav.
.picker
	height: 100%
	display: flex
	flex-direction: column
	align-items: center
	justify-content: center
	gap: 18px
	p
		font-family: var(--mono)
		font-size: var(--text-sm)
		letter-spacing: .1em
		text-transform: uppercase
		color: var(--muted)
	.views.big button
		font-size: var(--text-md)
		padding: 12px 22px

.shell
	display: grid
	grid-template-columns: 250px 1fr
	height: calc(100% - 56px)
	min-height: 0
	&.full
		grid-template-columns: 1fr

</style>

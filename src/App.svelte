<script>
  import { invoke } from '@tauri-apps/api/core'
  import ThemesSurface from './lib/ThemesSurface.svelte'
  import SchemeBrowser from './lib/SchemeBrowser.svelte'
  import ArgvBench from './lib/ArgvBench.svelte'
  import { app, say } from './lib/store.svelte.js'
  import { STATES } from './lib/states.js'

  // Build stamp, injected by Vite from package.json — the header shows it so a
  // stale install is obvious without comparing binaries.
  const APP_VERSION = __APP_VERSION__

  // The active surface's config from the states registry (undefined = no known
  // surface selected, which falls through to the picker).
  const current = $derived(STATES.find((s) => s.id === app.view))
  // Full-width layout for every surface except the Themes editor, which keeps
  // its 250px sidebar — but only once its document is loaded; the Themes
  // loading/error placeholder wants the full width to centre in.
  const wide = $derived(app.view === 'themes' ? !app.doc : (current ? current.full : true))

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
      say(`${app.doc.themes.length} pairs loaded`, 'ok')
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
    <h1 data-tauri-drag-region>FractalDesk <em>{APP_VERSION}</em></h1>
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
    font-size: 14px
    margin: 0
    font-weight: 600
    letter-spacing: .02em
    white-space: nowrap
    em
      font-style: normal
      font-weight: 400
      font-family: var(--mono)
      font-size: 10.5px
      color: var(--muted)
      margin-left: 5px
  .count
    font-family: var(--mono)
    font-size: 10.5px
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
    font-size: 11.5px
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
    font-size: 11px
    letter-spacing: .06em
    text-transform: uppercase
    padding: 7px 12px
    white-space: nowrap
    &:hover
      color: var(--ink)
    &.on
      background: var(--signal)
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
    font-size: 11px
    letter-spacing: .1em
    text-transform: uppercase
    color: var(--muted)
  .views.big button
    font-size: 13px
    padding: 12px 22px

.shell
  display: grid
  grid-template-columns: 250px 1fr
  height: calc(100% - 56px)
  min-height: 0
  &.full
    grid-template-columns: 1fr

</style>

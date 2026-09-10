<script>
  import { SAMPLES, FILES } from './samples.js'
  import { app, eff } from './store.svelte.js'

  let { mode, name } = $props()

  const chrome = $derived({
    bg: mode.bg, fg: mode.fg, comment: mode.comment, key: mode.key, str: mode.str,
    fn: mode.fn, num: mode.num, type: mode.type, op: mode.op, prop: mode.prop,
    punct: mode.punct, accent: mode.accent, sel: mode.sel,
    'side-bg': eff(mode, 'sidebar.bg', 'alt'),
    'side-fg': eff(mode, 'sidebar.fg', 'fg'),
    'side-border': eff(mode, 'sidebar.border', 'border'),
    'side-title': eff(mode, 'sidebar.title', 'punct'),
    'row-bg': eff(mode, 'list.activeBg', 'sel'),
    'row-fg': eff(mode, 'list.activeFg', 'fg'),
    'tab-strip': eff(mode, 'tab.stripBg', 'alt'),
    'tab-abg': eff(mode, 'tab.activeBg', 'bg'),
    'tab-afg': eff(mode, 'tab.activeFg', 'fg'),
    'tab-ibg': eff(mode, 'tab.inactiveBg', 'alt'),
    'tab-ifg': eff(mode, 'tab.inactiveFg', 'punct'),
    'tab-border': eff(mode, 'tab.border', 'border'),
    'tab-top': eff(mode, 'tab.activeTop', 'accent'),
    'status-bg': eff(mode, 'statusBar.bg', 'alt'),
    'status-fg': eff(mode, 'statusBar.fg', 'op'),
    gutter: eff(mode, 'gutter.fg', 'punct'),
    'gutter-on': eff(mode, 'gutter.activeFg', 'accent')
  })

  const vars = $derived(
    Object.entries(chrome).map(([k, v]) => `--m-${k}:${v}`).join(';')
  )
  const sample = $derived(SAMPLES[app.file])
  const lang = $derived(app.file.split('.').pop().toUpperCase())
</script>

<div class="mock" style={vars}>
  <div class="rail">
    <div class="ttl">Explorer</div>
    {#each FILES as f}
      <button class:on={f === app.file} onclick={() => (app.file = f)}>{f}</button>
    {/each}
  </div>
  <div class="main">
    <div class="tabs">
      {#each FILES.slice(0, 2) as f}
        <button class:on={f === app.file} onclick={() => (app.file = f)}>{f}</button>
      {/each}
    </div>
    <div class="code">
      <div class="gut">{#each sample.lines as _, i}<span
            class:on={i + 1 === sample.active}>{i + 1}</span>{'\n'}{/each}</div>
      <div class="src">{@html sample.lines.join('\n')}</div>
    </div>
    <div class="status">
      <span class="nm">{name}</span>
      <span>Ln {sample.active} · {lang}</span>
    </div>
  </div>
</div>

<style lang="sass">
.mock
  font-family: var(--mono)
  font-size: 11.6px
  line-height: 1.7
  display: flex
  border: 1px solid var(--rule)
  border-radius: 4px
  overflow: hidden

.rail
  width: 100px
  flex: 0 0 100px
  background: var(--m-side-bg)
  border-right: 1px solid var(--m-side-border)
  padding: 8px 0
  .ttl
    font-size: 9px
    letter-spacing: .12em
    text-transform: uppercase
    color: var(--m-side-title)
    padding: 2px 10px 7px
  button
    display: block
    width: 100%
    text-align: left
    background: none
    border: 0
    padding: 3px 10px
    color: var(--m-side-fg)
    opacity: .78
    font-family: var(--mono)
    font-size: 10.5px
    cursor: pointer
    &:hover
      opacity: 1
    &.on
      background: var(--m-row-bg)
      color: var(--m-row-fg)
      opacity: 1

.main
  flex: 1
  min-width: 0
  background: var(--m-bg)
  display: flex
  flex-direction: column

.tabs
  display: flex
  background: var(--m-tab-strip)
  border-bottom: 1px solid var(--m-tab-border)
  button
    padding: 6px 12px
    font-family: var(--mono)
    font-size: 10.5px
    border: 0
    cursor: pointer
    background: var(--m-tab-ibg)
    color: var(--m-tab-ifg)
    border-right: 1px solid var(--m-tab-border)
    &.on
      background: var(--m-tab-abg)
      color: var(--m-tab-afg)
      box-shadow: inset 0 2px 0 var(--m-tab-top)

.code
  display: flex
  overflow-x: auto
  padding: 9px 0

.gut
  flex: 0 0 auto
  white-space: pre
  padding: 0 11px 0 13px
  text-align: right
  color: var(--m-gutter)
  user-select: none
  font-variant-numeric: tabular-nums
  span.on
    color: var(--m-gutter-on)

.src
  flex: 1
  padding-right: 14px
  white-space: pre
  color: var(--m-fg)
  min-width: 0

.status
  display: flex
  justify-content: space-between
  padding: 4px 12px
  background: var(--m-status-bg)
  border-top: 1px solid var(--m-tab-border)
  font-size: 10px
  color: var(--m-status-fg)
  .nm
    color: var(--m-accent)
    font-weight: 500

// syntax roles, applied to the {@html} sample
.src :global(.c)
  color: var(--m-comment)
  font-style: italic
.src :global(.k)
  color: var(--m-key)
.src :global(.s)
  color: var(--m-str)
.src :global(.n)
  color: var(--m-num)
.src :global(.f)
  color: var(--m-fn)
.src :global(.t)
  color: var(--m-type)
.src :global(.p)
  color: var(--m-prop)
.src :global(.o)
  color: var(--m-op)
.src :global(.x)
  color: var(--m-punct)
.src :global(.a)
  color: var(--m-accent)
.src :global(.sel)
  background: var(--m-sel)
.src :global(.cur)
  border-left: 1.5px solid var(--m-accent)
  margin-left: -1.5px
</style>

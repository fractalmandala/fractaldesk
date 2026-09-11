<script>
  import { isHex } from './color.js'
  import { remember } from '$lib/recents.svelte.js'
  import ColorPicker from './ColorPicker.svelte'

  // `value` is what to display; `inherited` marks it as a derived default rather
  // than a pinned colour. `against` and `palette` feed the picker's live contrast
  // readout and its swatch row.
  let {
    value, inherited = false, contrast = '', against = null, palette = null,
    onset, onclear = null
  } = $props()

  let bad = $state(false)
  let open = $state(false)
  let trigger = $state(null)

  function commit(raw) {
    let v = raw.trim()
    if (!v.startsWith('#')) v = '#' + v
    if (!isHex(v)) { bad = true; return }
    bad = false
    onset(v.toUpperCase())
  }
</script>

<div class="cc">
  <button
    class="sw"
    bind:this={trigger}
    style="background:{value}"
    aria-label="Pick colour"
    aria-expanded={open}
    onclick={() => (open = !open)}></button>

  <input
    type="text"
    value={value}
    class:inherit={inherited}
    class:bad
    spellcheck="false"
    title={inherited ? 'inherited — type to pin it' : 'pinned'}
    oninput={(e) => commit(e.currentTarget.value)} />

  {#if contrast}<span class="ctr">{contrast}</span>{/if}

  {#if onclear}
    <button class="rst" class:on={!inherited} title="restore inheritance" onclick={onclear}>×</button>
  {/if}
</div>

{#if open}
  <ColorPicker
    {value}
    {against}
    {palette}
    anchor={trigger}
    onchange={(v) => commit(v)}
    onclose={() => { open = false; remember(value) }} />
{/if}

<style lang="sass">
.cc
  display: flex
  align-items: center
  gap: 8px

.sw
  width: 34px
  height: 26px
  padding: 0
  border: 1px solid var(--rule)
  border-radius: 3px
  cursor: pointer
  flex: 0 0 auto
  &:hover
    border-color: var(--muted)
  &[aria-expanded='true']
    border-color: var(--signal)
    box-shadow: 0 0 0 1px var(--signal)

input[type=text]
  width: 96px
  background: var(--sunk)
  border: 1px solid var(--rule)
  border-radius: 3px
  padding: 5px 7px
  font-family: var(--mono)
  font-size: var(--text-sm)
  text-transform: uppercase
  &:focus
    outline: none
    border-color: var(--signal)
  &.inherit
    color: var(--muted)
    font-style: italic
    opacity: .75
  &.bad
    border-color: var(--bad)

.ctr
  font-family: var(--mono)
  font-size: var(--text-xs)
  color: var(--muted)
  font-variant-numeric: tabular-nums
  min-width: 52px

.rst
  appearance: none
  background: none
  border: 0
  color: var(--muted)
  cursor: pointer
  font-size: var(--text-md)
  line-height: 1
  padding: 0 4px
  visibility: hidden
  &:hover
    color: var(--signal)
  &.on
    visibility: visible
</style>

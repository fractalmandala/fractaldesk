<script>
  import { untrack } from 'svelte'
  import {
    hexToHsv, hsvToHex, hexToOklch, stepLightness, ratio, grade, isHex, clamp
  } from './color.js'
  import { recents } from './store.svelte.js'

  // `anchor` is the trigger element; the panel is fixed-positioned off its rect so
  // it escapes the scroll container's clipping.
  let { value, anchor, against = null, palette = null, onchange, onclose } = $props()

  // Seed the editing state from the initial `value` once; the picker owns it from
  // then on and commits back through onchange. untrack makes that intent explicit.
  let hsv = $state(untrack(() => hexToHsv(value)))
  let hex = $state(untrack(() => value))
  let dragging = $state('')
  let panel = $state(null)

  const lch = $derived(hexToOklch(hex))
  const contrast = $derived(against ? ratio(against, hex) : null)

  // Placed after mount from the panel's measured size — guessing its height put
  // it off-screen near the bottom of a long table.
  let pos = $state({ left: -9999, top: -9999 })

  function place() {
    if (!anchor || !panel) return
    const a = anchor.getBoundingClientRect()
    const h = panel.offsetHeight
    const w = panel.offsetWidth
    const vw = window.innerWidth
    const vh = window.innerHeight
    const below = a.bottom + 8
    const above = a.top - h - 8
    const top = below + h + 8 <= vh ? below : above >= 8 ? above : Math.max(8, vh - h - 8)
    pos = {
      left: Math.round(Math.min(Math.max(8, a.left), Math.max(8, vw - w - 8))),
      top: Math.round(top)
    }
  }

  $effect(() => {
    place()
    const ro = new ResizeObserver(place)
    if (panel) ro.observe(panel)
    return () => ro.disconnect()
  })

  function commit(next, { fromHsv = false } = {}) {
    hex = next
    if (!fromHsv) hsv = hexToHsv(next)
    onchange(next)
  }

  function area(e) {
    const r = e.currentTarget.getBoundingClientRect()
    hsv.s = clamp((e.clientX - r.left) / r.width)
    hsv.v = 1 - clamp((e.clientY - r.top) / r.height)
    commit(hsvToHex(hsv.h, hsv.s, hsv.v), { fromHsv: true })
  }

  function hue(e) {
    const r = e.currentTarget.getBoundingClientRect()
    hsv.h = clamp((e.clientX - r.left) / r.width) * 360
    commit(hsvToHex(hsv.h, hsv.s, hsv.v), { fromHsv: true })
  }

  function start(kind, e) {
    dragging = kind
    e.currentTarget.setPointerCapture(e.pointerId)
    kind === 'area' ? area(e) : hue(e)
  }

  function move(kind, e) {
    if (dragging !== kind) return
    kind === 'area' ? area(e) : hue(e)
  }

  function typed(e) {
    let v = e.currentTarget.value.trim()
    if (!v.startsWith('#')) v = '#' + v
    if (isHex(v)) commit(v.toUpperCase())
  }

  function keydown(e) {
    if (e.key === 'Escape') { e.stopPropagation(); onclose() }
  }

  // Colours already in play beat inventing a new one, so offer them first.
  const themeSwatches = $derived(
    palette ? [...new Set(Object.values(palette).filter(isHex))] : []
  )
</script>

<svelte:window
  onkeydown={keydown}
  onpointerdown={(e) => { if (panel && !panel.contains(e.target) && e.target !== anchor && !anchor?.contains(e.target)) onclose() }}
  onresize={onclose} />

<div class="pick" bind:this={panel} style="left:{pos.left}px;top:{pos.top}px" role="dialog" aria-label="Colour picker">
  <!-- svelte-ignore a11y_no_static_element_interactions (pointer-driven 2D saturation/value canvas) -->
  <div
    class="area"
    style="--h:{hsv.h}"
    onpointerdown={(e) => start('area', e)}
    onpointermove={(e) => move('area', e)}
    onpointerup={() => (dragging = '')}>
    <span class="dot" style="left:{hsv.s * 100}%;top:{(1 - hsv.v) * 100}%;--c:{hex}"></span>
  </div>

  <!-- svelte-ignore a11y_no_static_element_interactions (pointer-driven hue strip) -->
  <div
    class="hue"
    onpointerdown={(e) => start('hue', e)}
    onpointermove={(e) => move('hue', e)}
    onpointerup={() => (dragging = '')}>
    <span class="knob" style="left:{(hsv.h / 360) * 100}%"></span>
  </div>

  <div class="row">
    <span class="chip" style="background:{hex}"></span>
    <input class="hex" value={hex} oninput={typed} spellcheck="false" aria-label="Hex" />
    <button class="step" title="darker (OKLCH −0.04 L)" onclick={() => commit(stepLightness(hex, -0.04))}>−</button>
    <button class="step" title="lighter (OKLCH +0.04 L)" onclick={() => commit(stepLightness(hex, 0.04))}>+</button>
  </div>

  <div class="meta">
    <span>oklch {lch.l.toFixed(3)} {lch.c.toFixed(3)} {Math.round(lch.h)}</span>
    {#if contrast !== null}
      <span class="cr" class:no={contrast < 4.5}>
        {contrast.toFixed(2)}:1 {grade(contrast)}
      </span>
    {/if}
  </div>

  {#if themeSwatches.length}
    <div class="label">In this theme</div>
    <div class="swatches">
      {#each themeSwatches as c}
        <button style="background:{c}" title={c} onclick={() => commit(c)} aria-label={c}></button>
      {/each}
    </div>
  {/if}

  {#if recents.list.length}
    <div class="label">Recent</div>
    <div class="swatches">
      {#each recents.list as c}
        <button style="background:{c}" title={c} onclick={() => commit(c)} aria-label={c}></button>
      {/each}
    </div>
  {/if}
</div>

<style lang="sass">
.pick
  position: fixed
  z-index: 60
  width: 268px
  background: var(--surface)
  border: 1px solid var(--rule)
  border-radius: 8px
  padding: 10px
  box-shadow: 0 18px 48px -12px #000000cc
  display: flex
  flex-direction: column
  gap: 9px

.area
  position: relative
  height: 150px
  border-radius: 5px
  cursor: crosshair
  touch-action: none
  background: linear-gradient(to top, #000, transparent), linear-gradient(to right, #fff, transparent), hsl(var(--h) 100% 50%)

.dot
  position: absolute
  width: 13px
  height: 13px
  border-radius: 50%
  border: 2px solid #fff
  box-shadow: 0 0 0 1px #0006
  transform: translate(-50%, -50%)
  background: var(--c)
  pointer-events: none

.hue
  position: relative
  height: 13px
  border-radius: 7px
  cursor: ew-resize
  touch-action: none
  background: linear-gradient(to right, #f00, #ff0, #0f0, #0ff, #00f, #f0f, #f00)

.knob
  position: absolute
  top: 50%
  width: 15px
  height: 15px
  border-radius: 50%
  border: 2px solid #fff
  box-shadow: 0 0 0 1px #0006
  transform: translate(-50%, -50%)
  pointer-events: none

.row
  display: flex
  align-items: center
  gap: 6px

.chip
  width: 26px
  height: 26px
  border-radius: 4px
  border: 1px solid #ffffff26
  flex: 0 0 auto

.hex
  flex: 1
  min-width: 0
  background: var(--sunk)
  border: 1px solid var(--rule)
  border-radius: 4px
  padding: 5px 7px
  font-family: var(--mono)
  font-size: 12px
  text-transform: uppercase
  &:focus
    outline: none
    border-color: var(--signal)

.step
  width: 26px
  height: 26px
  border: 1px solid var(--rule)
  border-radius: 4px
  background: var(--sunk)
  color: var(--ink-2)
  cursor: pointer
  font-size: 14px
  line-height: 1
  &:hover
    color: var(--ink)
    border-color: var(--muted)

.meta
  display: flex
  justify-content: space-between
  gap: 8px
  font-family: var(--mono)
  font-size: 10px
  color: var(--muted)
  font-variant-numeric: tabular-nums
  .cr
    color: var(--ok)
    &.no
      color: var(--bad)

.label
  font-family: var(--mono)
  font-size: 9px
  letter-spacing: .12em
  text-transform: uppercase
  color: var(--muted)
  margin-top: 1px

.swatches
  display: grid
  grid-template-columns: repeat(12, 1fr)
  gap: 3px
  button
    aspect-ratio: 1
    border: 1px solid #ffffff1f
    border-radius: 3px
    cursor: pointer
    padding: 0
    &:hover
      border-color: var(--ink)
</style>

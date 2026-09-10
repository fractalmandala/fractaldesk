<script>
  import { app } from './store.svelte.js'

  let { onnew, onduplicate, ondelete } = $props()

  const grouped = $derived(
    Object.entries(app.doc.families)
      .map(([id, fam]) => ({
        id,
        label: fam.label,
        items: app.doc.themes
          .map((t, i) => ({ t, i }))
          .filter(({ t }) => t.family === id)
      }))
      .filter((g) => g.items.length)
  )
</script>

<aside>
  {#each grouped as g}
    <div class="fam">{g.label} · {g.items.length}</div>
    {#each g.items as { t, i }}
      <button class="item" class:on={i === app.cur} onclick={() => (app.cur = i)}>
        <span class="pair">
          <i style="background:{t.light.bg}"></i>
          <i style="background:{t.dark.bg}"></i>
          <i style="background:{t.light.accent}"></i>
        </span>
        <span class="nm">{t.name}</span>
      </button>
    {/each}
  {/each}
  <div class="acts">
    <button class="btn" onclick={onnew}>New</button>
    <button class="btn" onclick={onduplicate}>Dupe</button>
    <button class="btn" onclick={ondelete}>Delete</button>
  </div>
</aside>

<style lang="sass">
aside
  background: var(--sunk)
  border-right: 1px solid var(--rule)
  overflow-y: auto
  padding-bottom: 12px

.fam
  padding: 14px 14px 4px
  font-family: var(--mono)
  font-size: var(--text-xs)
  letter-spacing: .14em
  text-transform: uppercase
  color: var(--signal)

.item
  display: flex
  align-items: center
  gap: 9px
  padding: 7px 14px
  cursor: pointer
  border: 0
  border-left: 2px solid transparent
  background: none
  width: 100%
  text-align: left
  &:hover
    background: #00000030
  &.on
    background: var(--surface)
    border-left-color: var(--signal)

.pair
  display: flex
  gap: 2px
  i
    width: 11px
    height: 11px
    border-radius: 2px
    border: 1px solid #ffffff22
    display: block

.nm
  flex: 1
  font-size: var(--text-md)
  white-space: nowrap
  overflow: hidden
  text-overflow: ellipsis

.acts
  display: flex
  gap: 6px
  padding: 12px 14px
  border-top: 1px solid var(--rule)
  margin-top: 10px
  .btn
    flex: 1
    padding: 6px 4px
    font-size: var(--text-xs)
    letter-spacing: .04em
</style>

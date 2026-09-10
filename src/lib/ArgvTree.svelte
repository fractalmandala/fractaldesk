<script>
  import { kids, uid } from './argv/spec.js'

  let { spec, sel = $bindable() } = $props()

  function rows() {
    const out = [{ id: 'root', name: spec.pkg.bin || 'cli', depth: 0, subs: kids(spec, 'root').length, glyph: '◆' }]
    const walk = (pid, depth) => {
      for (const c of kids(spec, pid)) {
        const n = kids(spec, c.id).length
        out.push({ id: c.id, name: c.name || '?', depth, subs: n, glyph: n ? '▸' : '·',
                   count: n ? `${n}▸` : (c.args.length + c.opts.length) || '' })
        walk(c.id, depth + 1)
      }
    }
    walk('root', 1)
    return out
  }
  const list = $derived(rows())

  function addCommand(parent) {
    const c = { id: uid('c'), parent, name: 'command', alias: '', desc: '', args: [], opts: [] }
    spec.commands.push(c)
    sel = c.id
  }

  function remove() {
    if (sel === 'root') return
    const doomed = new Set([sel])
    let changed = true
    while (changed) {
      changed = false
      for (const c of spec.commands) {
        if (c.parent && doomed.has(c.parent) && !doomed.has(c.id)) { doomed.add(c.id); changed = true }
      }
    }
    spec.commands = spec.commands.filter((c) => !doomed.has(c.id))
    sel = 'root'
  }
</script>

<div class="tree">
  {#each list as r (r.id)}
    <button class="node" style="padding-left:{8 + r.depth * 14}px"
            aria-current={sel === r.id} onclick={() => (sel = r.id)}>
      <span class="glyph">{r.glyph}</span>
      <span class="nm">{r.name}</span>
      <span class="count">{r.id === 'root' ? r.subs : r.count}</span>
    </button>
  {/each}
</div>

<div class="acts">
  <button class="btn" onclick={() => addCommand(null)}>+ Command</button>
  <button class="btn" onclick={() => addCommand(sel === 'root' ? null : sel)}>+ Sub</button>
  <button class="btn" disabled={sel === 'root'} onclick={remove}>Delete</button>
</div>

<style lang="sass">
.tree
  display: flex
  flex-direction: column
  gap: 1px
  overflow-y: auto
  flex: 1
  min-height: 0
  padding: 8px

.node
  display: flex
  align-items: center
  gap: 7px
  width: 100%
  text-align: left
  background: none
  border: 0
  border-radius: 3px
  padding: 5px 8px
  cursor: pointer
  font-family: var(--mono)
  font-size: 12px
  color: var(--ink-2)
  &:hover
    background: #ffffff0d
  &[aria-current='true']
    background: var(--surface)
    color: var(--signal)
    font-weight: 600
  .glyph
    color: var(--muted)
    font-size: 10px
    width: 9px
    flex: none
  .nm
    overflow: hidden
    text-overflow: ellipsis
    white-space: nowrap
  .count
    margin-left: auto
    font-size: 10px
    color: var(--muted)
    font-variant-numeric: tabular-nums

.acts
  display: flex
  gap: 6px
  padding: 10px
  border-top: 1px solid var(--rule)
  .btn
    flex: 1
    padding: 6px 4px
    font-size: 10px
    letter-spacing: .04em
</style>

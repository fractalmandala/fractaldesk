<script>
  import { argToken, byId, chain, isLeaf, kids, optFlags, uid } from './argv/spec.js'

  let { spec, sel } = $props()

  const node = $derived(byId(spec, sel))
  const leaf = $derived(node ? isLeaf(spec, node) : false)
  const title = $derived(node ? chain(spec, sel).map((c) => c.name).join(' ') : 'Program')

  const TYPES = [['boolean', 'flag'], ['string', 'string'], ['number', 'number'], ['enum', 'choice']]
  const ARITY = ['required', 'optional', 'variadic']

  const newOpt = () => ({ id: uid('o'), short: '', long: 'new-flag', type: 'boolean', value: '', def: '', choices: '', desc: '' })
  const newArg = () => ({ id: uid('a'), name: 'input', arity: 'required', def: '', desc: '' })
</script>

<div class="head">
  <span class="eyebrow">{title}</span>
</div>

<div class="body">
  {#if !node}
    <div class="fields">
      <label class="f"><span>Package name</span><input class="mono" bind:value={spec.pkg.name} /></label>
      <label class="f"><span>Binary</span><input class="mono" bind:value={spec.pkg.bin} /></label>
      <label class="f"><span>Version</span><input class="mono" bind:value={spec.pkg.version} /></label>
      <label class="f"><span>Language</span>
        <select bind:value={spec.pkg.language}>
          <option value="ts">TypeScript</option>
          <option value="js">JavaScript</option>
        </select>
      </label>
      <label class="f wide"><span>Summary</span><textarea bind:value={spec.pkg.description}></textarea></label>
    </div>

    <div class="sect">
      <div class="secthead">
        <span class="eyebrow">Global options</span>
        <button class="btn" onclick={() => spec.globals.push(newOpt())}>+ Option</button>
      </div>
      {#if !spec.globals.length}
        <p class="hint">None. Globals are visible to every command.</p>
      {/if}
      {#each spec.globals as o (o.id)}
        {@render optRow(spec.globals, o)}
      {/each}
    </div>
  {:else}
    <div class="fields">
      <label class="f"><span>Name</span><input class="mono" bind:value={node.name} /></label>
      <label class="f"><span>Alias</span><input class="mono" bind:value={node.alias} placeholder="b" /></label>
      <label class="f wide"><span>Summary</span><textarea bind:value={node.desc}></textarea></label>
    </div>

    <div class="sect">
      <div class="secthead">
        <span class="eyebrow">Arguments</span>
        <button class="btn" disabled={!leaf} onclick={() => node.args.push(newArg())}>+ Argument</button>
      </div>
      {#if !leaf}
        <p class="hint">This command dispatches to subcommands, so it takes no positionals of its own.</p>
      {:else if !node.args.length}
        <p class="hint">No positional arguments.</p>
      {/if}
      {#if leaf}
        {#each node.args as a (a.id)}
          <div class="row">
            <div class="line">
              <span class="tag" class:req={a.arity === 'required'}>{argToken(a)}</span>
              <input class="grow mono" bind:value={a.name} placeholder="name" />
              <select bind:value={a.arity}>
                {#each ARITY as k}<option value={k}>{k}</option>{/each}
              </select>
              <input class="w-m mono" bind:value={a.def} placeholder="default" />
              <button class="kill" onclick={() => node.args.splice(node.args.indexOf(a), 1)}>✕</button>
            </div>
            <input class="desc" bind:value={a.desc} placeholder="What this argument is for" />
          </div>
        {/each}
      {/if}
    </div>

    <div class="sect">
      <div class="secthead">
        <span class="eyebrow">Options</span>
        <button class="btn" onclick={() => node.opts.push(newOpt())}>+ Option</button>
      </div>
      {#if !node.opts.length}<p class="hint">No options of its own.</p>{/if}
      {#each node.opts as o (o.id)}
        {@render optRow(node.opts, o)}
      {/each}
    </div>
  {/if}
</div>

{#snippet optRow(list, o)}
  <div class="row">
    <div class="line">
      <input class="w-xs mono" bind:value={o.short} placeholder="-x" maxlength="1" />
      <input class="grow mono" bind:value={o.long} placeholder="long-name" />
      <select bind:value={o.type}>
        {#each TYPES as [v, label]}<option value={v}>{label}</option>{/each}
      </select>
      {#if o.type !== 'boolean'}
        <input class="w-s mono" bind:value={o.value} placeholder="value" />
      {/if}
      <input class="w-s mono" bind:value={o.def} placeholder="default" />
      <button class="kill" onclick={() => list.splice(list.indexOf(o), 1)}>✕</button>
    </div>
    {#if o.type === 'enum'}
      <input class="desc mono" bind:value={o.choices} placeholder="Choices, comma separated" />
    {/if}
    <input class="desc" bind:value={o.desc} placeholder="What this flag does" />
    <span class="preview">{optFlags(o)}</span>
  </div>
{/snippet}

<style lang="sass">
.head
  padding: 9px 14px
  border-bottom: 1px solid var(--rule)
  background: var(--sunk)

.eyebrow
  font-size: 10px
  letter-spacing: .13em
  text-transform: uppercase
  color: var(--muted)
  font-weight: 600
  flex: 1

.body
  padding: 14px
  overflow-y: auto
  flex: 1
  min-height: 0

.fields
  display: grid
  grid-template-columns: repeat(2, minmax(0, 1fr))
  gap: 12px

.f
  display: flex
  flex-direction: column
  gap: 4px
  min-width: 0
  &.wide
    grid-column: 1 / -1
  span
    font-size: 10px
    letter-spacing: .11em
    text-transform: uppercase
    color: var(--muted)
    font-weight: 600
  input, select, textarea
    background: var(--sunk)
    border: 1px solid var(--rule)
    border-radius: 3px
    padding: 5px 8px
    font-size: 13px
    width: 100%
    &:focus
      outline: none
      border-color: var(--signal)
  textarea
    resize: vertical
    min-height: 46px
    font: 13px/1.45 var(--sans)

.sect
  margin-top: 24px

.secthead
  display: flex
  align-items: center
  gap: 10px
  padding-bottom: 7px
  border-bottom: 1px solid var(--rule)
  .btn
    padding: 4px 9px
    font-size: 10px

.hint
  font-size: 12px
  color: var(--muted)
  margin: 9px 0 0
  font-style: italic

.row
  padding: 10px 0
  border-bottom: 1px solid #ffffff0d
  display: flex
  flex-direction: column
  gap: 6px
  position: relative
  &:last-child
    border-bottom: 0

.line
  display: flex
  gap: 7px
  align-items: center
  flex-wrap: wrap
  input, select
    background: var(--sunk)
    border: 1px solid var(--rule)
    border-radius: 3px
    padding: 4px 7px
    font-size: 12px
    &:focus
      outline: none
      border-color: var(--signal)

.mono
  font-family: var(--mono)

.grow
  flex: 1 1 90px
  min-width: 64px

.w-xs
  width: 46px
.w-s
  width: 72px
.w-m
  width: 104px

.desc
  width: 100%
  background: var(--sunk)
  border: 1px solid var(--rule)
  border-radius: 3px
  padding: 4px 7px
  font-size: 12px
  color: var(--ink-2)
  &:focus
    outline: none
    border-color: var(--signal)

.preview
  font-family: var(--mono)
  font-size: 10px
  color: var(--muted)

.tag
  font-family: var(--mono)
  font-size: 11px
  padding: 1px 6px
  border-radius: 999px
  background: #ffffff12
  color: var(--muted)
  &.req
    background: #e4703a26
    color: var(--signal)

.kill
  background: none
  border: 0
  margin-left: auto
  color: var(--muted)
  cursor: pointer
  padding: 2px 5px
  font-size: 14px
  border-radius: 3px
  &:hover
    color: var(--bad)
</style>

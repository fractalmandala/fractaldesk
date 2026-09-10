<script>
  import Sidebar from './Sidebar.svelte'
  import Mock from './Mock.svelte'
  import RoleTable from './RoleTable.svelte'
  import WorkbenchTable from './WorkbenchTable.svelte'
  import ColorCell from './ColorCell.svelte'
  import { app } from './store.svelte.js'
  import { ratio, grade } from './color.js'

  // This surface owns everything that reads or writes the palette document.
  // It only ever renders when `app.doc` is loaded (+page.svelte guards that), so
  // `entry` and `family` are always present here.
  const entry = $derived(app.doc.themes[app.cur])
  const family = $derived(app.doc.families[entry.family])

  function uniqueName(base) {
    const taken = new Set(app.doc.themes.map((t) => t.name))
    if (!taken.has(base)) return base
    let n = 2
    while (taken.has(`${base} ${n}`)) n++
    return `${base} ${n}`
  }

  function duplicate() {
    const copy = structuredClone($state.snapshot(entry))
    copy.name = uniqueName(`${copy.name} copy`)
    app.doc.themes.splice(app.cur + 1, 0, copy)
    app.cur++
    app.dirty = true
  }

  function newPair() {
    const copy = structuredClone($state.snapshot(entry))
    copy.name = uniqueName('Untitled')
    copy.tag = 'draft'
    copy.thesis = ''
    app.doc.themes.splice(app.cur + 1, 0, copy)
    app.cur++
    app.dirty = true
  }

  function remove() {
    if (!confirm(`Delete "${entry.name}"? Its two theme files go on the next build.`)) return
    app.doc.themes.splice(app.cur, 1)
    app.cur = Math.max(0, app.cur - 1)
    app.dirty = true
  }

  function cr(mode) {
    const f = ratio(mode.bg, mode.fg)
    return {
      fg: f.toFixed(2),
      grade: grade(f),
      pass: f >= 4.5,
      comment: ratio(mode.bg, mode.comment).toFixed(2),
      str: ratio(mode.bg, mode.str).toFixed(2)
    }
  }
</script>

<Sidebar onnew={newPair} onduplicate={duplicate} ondelete={remove} />
<main>
  <div class="head">
    <label class="field">
      <span>Name</span>
      <input class="name" bind:value={entry.name} oninput={() => (app.dirty = true)} />
    </label>
    <label class="field">
      <span>Family</span>
      <select bind:value={entry.family} onchange={() => (app.dirty = true)}>
        {#each Object.entries(app.doc.families) as [id, f]}
          <option value={id}>{f.label}</option>
        {/each}
      </select>
    </label>
    <label class="field">
      <span>Tag</span>
      <input bind:value={entry.tag} oninput={() => (app.dirty = true)} />
    </label>
    <label class="field grow">
      <span>Thesis</span>
      <textarea bind:value={entry.thesis} oninput={() => (app.dirty = true)}></textarea>
    </label>
  </div>

  <div class="panes">
    {#each [['light', app.doc.meta.lightPrefix], ['dark', app.doc.meta.darkPrefix]] as [kind, prefix]}
      {@const c = cr(entry[kind])}
      <div>
        <div class="pane-lbl">
          <span class="t">{prefix}</span>
          <span class="cr">
            fg <b>{c.fg}</b>
            <em class:no={!c.pass}>{c.grade}</em>
            · comment <b>{c.comment}</b> · string <b>{c.str}</b>
          </span>
        </div>
        <Mock mode={entry[kind]} name={`${prefix} ${entry.name}`} />
      </div>
    {/each}
  </div>

  <h2 class="sec">Palette — contrast against each mode's own background</h2>
  <RoleTable {entry} />

  <h2 class="sec">Workbench — inherited from the palette unless overridden</h2>
  <p class="hint">
    Each surface shows the value it derives from the core palette. Type a colour to pin it;
    × restores inheritance so it keeps tracking the palette.
  </p>
  <WorkbenchTable {entry} />

  <details>
    <summary>Diagnostics for the {family.label} family — shared by every theme in it</summary>
    <div class="body">
      <p class="hint">
        Errors, warnings and git status stay hued even in the monochrome families: a red
        squiggle that reads as ink is one you miss. Editing these changes every
        {family.label} theme.
      </p>
      <table class="roles">
        <thead>
          <tr><th>role</th><th>{app.doc.meta.lightPrefix}</th><th>{app.doc.meta.darkPrefix}</th></tr>
        </thead>
        <tbody>
          {#each Object.keys(family.semantic.light) as k}
            <tr>
              <td class="rl">{k}</td>
              {#each ['light', 'dark'] as kind}
                <td>
                  <ColorCell
                    value={family.semantic[kind][k]}
                    against={entry[kind].bg}
                    palette={entry[kind]}
                    onset={(v) => {
                      family.semantic[kind][k] = v
                      app.dirty = true
                    }} />
                </td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>
    </div>
  </details>
</main>

<style lang="sass">
main
  overflow-y: auto
  padding: 22px 26px 60px

.head
  display: flex
  gap: 16px
  flex-wrap: wrap
  align-items: flex-start
  margin-bottom: 20px

.field
  display: flex
  flex-direction: column
  gap: 5px
  &.grow
    flex: 1
    min-width: 320px
  span
    font-family: var(--mono)
    font-size: var(--text-xs)
    letter-spacing: .1em
    text-transform: uppercase
    color: var(--muted)
  input, select, textarea
    background: var(--sunk)
    border: 1px solid var(--rule)
    border-radius: 3px
    padding: 7px 9px
    font-size: var(--text-md)
    &:focus
      outline: none
      border-color: var(--signal)
  input.name
    width: 210px
    font-weight: 600
  textarea
    resize: vertical
    min-height: 62px
    font: var(--text-md)/1.45 var(--sans)

.panes
  display: grid
  grid-template-columns: 1fr 1fr
  gap: 18px
  @media (max-width: 1180px)
    grid-template-columns: 1fr

.pane-lbl
  display: flex
  justify-content: space-between
  align-items: baseline
  gap: 10px
  margin-bottom: 7px
  .t
    font-family: var(--mono)
    font-size: var(--text-sm)
    letter-spacing: .1em
    text-transform: uppercase
    color: var(--ink-2)

.cr
  font-family: var(--mono)
  font-size: var(--text-xs)
  color: var(--muted)
  font-variant-numeric: tabular-nums
  b
    color: var(--ink)
    font-weight: 500
  em
    font-style: normal
    color: var(--ok)
    &.no
      color: var(--bad)

details
  margin-top: 26px
  border: 1px solid var(--rule)
  border-radius: 3px
  background: var(--sunk)
  summary
    cursor: pointer
    padding: 11px 14px
    font-family: var(--mono)
    font-size: var(--text-xs)
    letter-spacing: .1em
    text-transform: uppercase
    color: var(--ink-2)
  .body
    padding: 4px 14px 16px
</style>

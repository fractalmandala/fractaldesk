<script>
  import ColorCell from './ColorCell.svelte'
  import { ratio } from './color.js'
  import { app } from './store.svelte.js'

  let { entry } = $props()

  const NOTE = {
    bg: 'editor.background', alt: 'sidebar, tabs, status bar', border: 'hairlines between surfaces',
    sel: 'selection + active row', fg: 'body text', comment: 'comments (italic)',
    punct: 'brackets, line numbers', op: 'operators', key: 'keywords, storage',
    str: 'strings', num: 'numbers, constants', fn: 'function names',
    type: 'types, classes, tags', prop: 'variables, properties', accent: 'cursor, active tab, badges'
  }

  const modes = $derived([
    ['light', app.doc.meta.lightPrefix],
    ['dark', app.doc.meta.darkPrefix]
  ])

  function set(kind, role, v) {
    entry[kind][role] = v
    app.dirty = true
  }
</script>

<table class="roles">
  <thead>
    <tr><th>role</th>{#each modes as [, label]}<th>{label}</th>{/each}</tr>
  </thead>
  <tbody>
    {#each app.doc.roles as role}
      <tr>
        <td class="rl">{role}<small>{NOTE[role] ?? ''}</small></td>
        {#each modes as [kind]}
          <td>
            <ColorCell
              value={entry[kind][role]}
              contrast={role === 'bg' ? '' : ratio(entry[kind].bg, entry[kind][role]).toFixed(2) + ':1'}
              against={role === 'bg' ? null : entry[kind].bg}
              palette={entry[kind]}
              onset={(v) => set(kind, role, v)} />
          </td>
        {/each}
      </tr>
    {/each}
  </tbody>
</table>

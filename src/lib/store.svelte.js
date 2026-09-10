// Single reactive source of truth for the window. `doc` mirrors palettes.json;
// everything else is view state.
export const app = $state({
  dir: '',          // the app's own data directory (the project root)
  vsix: '',         // last packaged .vsix, for Reveal
  view: 'themes',   // 'themes' | 'schemes' | 'argv' | 'sassy' | 'untw'
  doc: null,
  schemes: [],
  schema: { ui: [] },
  cur: 0,
  file: 'palette.ts',
  dirty: false,
  busy: false,
  msg: '',
  kind: ''
})

export function say(msg, kind = '') {
  app.msg = msg
  app.kind = kind
}

export const theme = () => app.doc?.themes[app.cur]

/// Effective chrome colour: an explicit `ui` override, else the core role it derives from.
export const eff = (mode, key, from) => mode.ui?.[key] ?? mode[from]

/** Colours picked this session, newest first — offered in the picker. */
export const recents = $state({ list: [] })

export function remember(hex) {
  const l = recents.list.filter((c) => c !== hex)
  l.unshift(hex)
  recents.list = l.slice(0, 12)
}

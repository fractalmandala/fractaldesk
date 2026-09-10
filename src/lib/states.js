// The app's surfaces — its "states". This is the single source of truth for
// the header nav ("appnav"): every entry becomes a switch button, and its `id`
// is the value `app.view` takes when that surface is active.
//
// To add a new surface:
//   1. Add an entry here — `id` is what `app.view` becomes, `label` is the
//      button text. A button for it appears in the header automatically.
//   2. Add a matching `{:else if app.view === '<id>'}` clause in
//      src/routes/+page.svelte that renders whatever the surface should show
//      (usually one component).
//
// Fields:
//   id     unique key stored in `app.view`
//   label  text shown on the nav button
//   full   true  → full-width layout (like Schemes / Argv)
//          false → keep the 250px sidebar grid (the Themes editor)
//   badge  optional (app) => value; a truthy return is shown as "· value" on
//          the button. Falsy (0, null, '') means no badge.
export const STATES = [
  { id: 'themes', label: 'Themes', full: false },
  { id: 'schemes', label: 'Schemes', full: true },
  { id: 'argv', label: 'Argv', full: true },
  { id: 'sassy', label: 'Sassy', full: true },
]

// Colours picked this session, newest first — offered in the colour picker's
// Recent row. Shared module: the picker is reached from both Themes and Schemes
// through ColorCell, so this lives outside any single surface.
//
// Wrapped in an object so the list can be reassigned from other modules
// (ES module `let` exports are read-only bindings).

export const recents = $state<{ list: string[] }>({ list: [] })

export function remember(hex: string): void {
	const l = recents.list.filter((c) => c !== hex)
	l.unshift(hex)
	recents.list = l.slice(0, 12)
}

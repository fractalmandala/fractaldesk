// Shell-only reactive state. Holds only app-wide chrome: the active view, a busy
// flag, and the status message. Surface-specific data lives in each surface's own
// state module (src/lib/surfaces/<id>/state.svelte.ts).

export const app = $state({
	view: 'themes',
	busy: false,
	msg: '',
	kind: '' as string
})

export function say(msg: string, kind: string = ''): void {
	app.msg = msg
	app.kind = kind
}

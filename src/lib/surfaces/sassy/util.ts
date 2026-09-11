// Dart Sass colours its error messages with ANSI terminal codes; strip them so
// the UI shows clean text. Sass exceptions aren't `Error` instances, so read
// `.message` when it's present.
const ANSI = /\x1b\[[0-9;]*m/g
export const stripAnsi = (s: string) => s.replace(ANSI, '')

export function errMsg(e: unknown): string {
	const raw =
		e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e)
	return stripAnsi(raw)
}

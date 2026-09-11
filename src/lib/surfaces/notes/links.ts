// file:// link convention (product invariants 24-28). Pure functions, no I/O.
// Relative targets resolve against the workspace root: the added-folder root
// containing the linking file. Absolute file:/// targets resolve against the
// filesystem root. Anything escaping its root does not resolve.

export interface LineRange {
	/** 1-based inclusive first line. */
	start: number
	/** 1-based inclusive last line. */
	end: number
}

export function isFileUrl(target: string): boolean {
	return target.startsWith('file://')
}

/** Parse `L10` or `L10-L17` (with or without a leading `#`). */
export function parseRange(hash: string): LineRange | null {
	const bare = hash.startsWith('#') ? hash.slice(1) : hash
	const m = /^L(\d+)(?:-L(\d+))?$/.exec(bare)
	if (!m) return null
	const start = Number(m[1])
	const end = m[2] === undefined ? start : Number(m[2])
	if (start < 1 || end < start) return null
	return { start, end }
}

export function splitTarget(target: string): { path: string; range: LineRange | null } {
	const hash = target.indexOf('#')
	if (hash < 0) return { path: target, range: null }
	return { path: target.slice(0, hash), range: parseRange(target.slice(hash + 1)) }
}

function splitPosix(path: string): string[] {
	return path.split('/').filter((seg) => seg.length > 0 && seg !== '.')
}

/** Lexical posix normalize without node:path (runs in the webview). */
function normalizePosix(path: string): string {
	const out: string[] = []
	for (const seg of splitPosix(path)) {
		if (seg === '..') out.pop()
		else out.push(seg)
	}
	return '/' + out.join('/')
}

function underRoot(abs: string, root: string): boolean {
	const r = root.endsWith('/') && root.length > 1 ? root.slice(0, -1) : root
	return abs === r || abs.startsWith(r + '/')
}

/**
 * Resolve a link target to an absolute posix path, or null when it is not a
 * file:// link or escapes its root. `fromFile` and `root` are absolute posix paths.
 */
export function resolveLink(target: string, fromFile: string, root: string): string | null {
	if (!isFileUrl(target)) return null
	const { path } = splitTarget(target.slice('file://'.length))
	if (!underRoot(fromFile, root)) return null
	let abs: string
	if (path.startsWith('/')) {
		abs = normalizePosix(path)
	} else {
		const fromDir = fromFile.slice(0, fromFile.lastIndexOf('/'))
		const rel = fromDir === root ? '' : fromDir.slice(root.length + 1)
		abs = normalizePosix(root + '/' + (rel ? rel + '/' : '') + path)
	}
	if (!underRoot(abs, root) && !path.startsWith('/')) return null
	return abs
}

const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g

/** Raw link targets in reading order; image `![…](…)` targets excluded. */
export function extractLinkTargets(markdown: string): string[] {
	const out: string[] = []
	LINK_RE.lastIndex = 0
	let m: RegExpExecArray | null
	while ((m = LINK_RE.exec(markdown)) !== null) out.push(m[1])
	return out
}

/** Outgoing file:// note links (linked mentions). */
export function extractMentions(markdown: string): string[] {
	return extractLinkTargets(markdown).filter(isFileUrl)
}

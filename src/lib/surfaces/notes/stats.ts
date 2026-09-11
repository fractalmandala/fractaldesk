// Note statistics, outline, tasks, and backlink search (product invariant 32).
// Pure functions over text; the caller supplies file identity.

export function countWords(text: string): number {
	const words = text.trim().split(/\s+/).filter((w) => w.length > 0)
	return text.trim().length === 0 ? 0 : words.length
}

export function countChars(text: string): number {
	return [...text].length
}

/** Whole seconds at 200 wpm, matching the `6m 32s` style readout. */
export function readingSeconds(text: string): number {
	return Math.round((countWords(text) / 200) * 60)
}

export function formatReadingTime(text: string): string {
	const total = readingSeconds(text)
	const m = Math.floor(total / 60)
	const s = total % 60
	return m > 0 ? `${m}m ${s}s` : `${s}s`
}

export interface TaskCounts {
	done: number
	total: number
}

export function countTasks(text: string): TaskCounts {
	let done = 0
	let total = 0
	for (const line of text.split('\n')) {
		const m = /^\s*[-*]\s+\[([ xX])\]/.exec(line)
		if (m) {
			total += 1
			if (m[1] !== ' ') done += 1
		}
	}
	return { done, total }
}

export interface OutlineEntry {
	level: number
	text: string
	/** 1-based line number. */
	line: number
}

/** ATX headings outside fenced code blocks, in document order. */
export function extractOutline(text: string): OutlineEntry[] {
	const out: OutlineEntry[] = []
	let fenced = false
	text.split('\n').forEach((line, i) => {
		if (/^\s*```/.test(line)) {
			fenced = !fenced
			return
		}
		if (fenced) return
		const m = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line)
		if (m) out.push({ level: m[1].length, text: m[2], line: i + 1 })
	})
	return out
}

export interface Backlink {
	/** Absolute path of the linking file. */
	path: string
	/** 1-based line number of the link. */
	line: number
}

export interface IndexedFile {
	/** Absolute posix path. */
	path: string
	/** Added-folder root containing it. */
	root: string
	text: string
}

// Local import keeps this module dependency-light; links.ts owns resolution.
import { resolveLink } from './links.js'

/**
 * Every file:// link across `files` whose target resolves to `self`.
 * Unresolvable targets are skipped, never reported.
 */
export function findBacklinks(files: IndexedFile[], self: string): Backlink[] {
	const out: Backlink[] = []
	const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g
	for (const file of files) {
		if (file.path === self) continue
		LINK_RE.lastIndex = 0
		let m: RegExpExecArray | null
		while ((m = LINK_RE.exec(file.text)) !== null) {
			const target = m[1]
			if (!target.startsWith('file://')) continue
			const resolved = resolveLink(target, file.path, file.root)
			if (resolved === self) {
				const line = file.text.slice(0, m.index).split('\n').length
				out.push({ path: file.path, line })
			}
		}
	}
	return out
}

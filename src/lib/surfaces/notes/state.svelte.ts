// Notes surface state. Disk is canonical: edits live here, saves go through
// the confined notes_* commands, external changes arrive via the watcher and
// never overwrite dirty buffers. Surface body and toolbar share this module.

import { invoke } from '@tauri-apps/api/core'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { say } from '../../store.svelte.js'
import { extractMentions, parseRange, resolveLink, splitTarget } from './links.js'
import type { LineRange } from './links.js'
import type {
	NotesChangedPayload,
	NotesEntryDTO,
	NotesGrepHitDTO,
	NotesScanDTO,
	NotesScanErrorDTO
} from './types.js'

const LAYOUT_KEY = 'fractaldesk:notes:layout'
const AUTOSAVE_IDLE_MS = 2000
const READONLY_BYTES = 1 << 20
const BACKLINK_FILE_CAP = 50
const SEARCH_ENABLED = false

interface LayoutState {
	leftCollapsed: boolean
	rightCollapsed: boolean
	listCollapsed: boolean
	leftW: number
	rightW: number
	listW: number
	activePath: string | null
	view: 'raw' | 'rich'
}

export interface Backlink {
	path: string
	line: number
}

export interface Mention {
	target: string
	resolved: string | null
	range: LineRange | null
}

// Object wrapper so body and toolbar share reactive, assignable state.
export const notes = $state({
	roots: [] as string[],
	rootErrors: [] as NotesScanErrorDTO[],
	entries: [] as NotesEntryDTO[],
	expanded: {} as Record<string, boolean>,
	selectedDir: null as string | null,
	filter: '',
	activePath: null as string | null,
	text: '',
	baseline: '',
	openMtime: 0,
	rev: 0,
	pendingRange: null as LineRange | null,
	view: 'raw' as 'raw' | 'rich',
	readonly: false,
	dirty: false,
	saving: false,
	loaded: false,
	truncated: false,
	layout: {
		leftCollapsed: false,
		rightCollapsed: false,
		listCollapsed: false,
		leftW: 280,
		rightW: 280,
		listW: 256
	},
	backlinks: [] as Backlink[],
	mentions: [] as Mention[],
	notice: ''
})

let unlisten: UnlistenFn | null = null
let rescanTimer: ReturnType<typeof setTimeout> | null = null
let autosaveTimer: ReturnType<typeof setTimeout> | null = null

function loadLayout(): Partial<LayoutState> {
	if (typeof localStorage === 'undefined') return {}
	try {
		const raw = localStorage.getItem(LAYOUT_KEY)
		return raw ? (JSON.parse(raw) as Partial<LayoutState>) : {}
	} catch {
		return {}
	}
}

export function persistLayout(): void {
	if (typeof localStorage === 'undefined') return
	try {
		const snapshot: LayoutState = {
			leftCollapsed: notes.layout.leftCollapsed,
			rightCollapsed: notes.layout.rightCollapsed,
			listCollapsed: notes.layout.listCollapsed,
			leftW: notes.layout.leftW,
			rightW: notes.layout.rightW,
			listW: notes.layout.listW,
			activePath: notes.activePath,
			view: notes.view
		}
		localStorage.setItem(LAYOUT_KEY, JSON.stringify(snapshot))
	} catch {
		// Ignore storage failures.
	}
}

export type RailId = 'left' | 'right' | 'list'

/** All column toggles live in the header toolbar and funnel through here. */
export function setCollapsed(which: RailId, collapsed: boolean): void {
	if (which === 'left') notes.layout.leftCollapsed = collapsed
	else if (which === 'right') notes.layout.rightCollapsed = collapsed
	else notes.layout.listCollapsed = collapsed
	persistLayout()
}

function errMsg(e: unknown): string {
	return e instanceof Error ? e.message : String(e)
}

export function entryFor(path: string): NotesEntryDTO | undefined {
	return notes.entries.find((e) => e.path === path)
}

function rootFor(path: string): string | null {
	const entry = entryFor(path)
	if (entry) return entry.root
	return notes.roots.find((r) => path === r || path.startsWith(r + '/')) ?? null
}

export async function rescan(quiet = false): Promise<void> {
	try {
		const scan = await invoke<NotesScanDTO>('notes_scan')
		notes.entries = scan.entries
		notes.rootErrors = scan.errors
		notes.truncated = scan.truncated
		if (!quiet && scan.errors.length) {
			say(`${scan.errors.length} folder${scan.errors.length === 1 ? '' : 's'} unreadable`, 'bad')
		}
		await refreshOpenIfStale()
	} catch (e) {
		if (!quiet) say(errMsg(e), 'bad')
	}
}

/** Re-read the open note when it changed on disk and has no unsaved edits. */
async function refreshOpenIfStale(): Promise<void> {
	if (!notes.activePath || notes.dirty) return
	const entry = entryFor(notes.activePath)
	if (!entry || entry.is_dir || entry.mtime === notes.openMtime) return
	try {
		const body = await invoke<string>('notes_read', { path: notes.activePath })
		if (body === notes.text) {
			// Our own save (or a touch): no content change, no remount.
			notes.openMtime = entry.mtime
			return
		}
		notes.text = body
		notes.baseline = body
		notes.openMtime = entry.mtime
		notes.readonly = entry.size > READONLY_BYTES
		notes.rev += 1
		void refreshMentions()
	} catch {
		// Keep showing the last known text; the error row explains.
	}
}

/** Load hook: roots plus layout restore, scan, watcher, last note. */
export async function loadNotes(): Promise<void> {
	if (notes.loaded) return
	const saved = loadLayout()
	notes.layout.leftCollapsed = saved.leftCollapsed ?? false
	notes.layout.rightCollapsed = saved.rightCollapsed ?? false
	notes.layout.listCollapsed = saved.listCollapsed ?? false
	if (typeof saved.leftW === 'number') notes.layout.leftW = saved.leftW
	if (typeof saved.rightW === 'number') notes.layout.rightW = saved.rightW
	if (typeof saved.listW === 'number') notes.layout.listW = saved.listW
	notes.view = saved.view ?? 'raw'
	try {
		notes.roots = (await invoke<{ path: string }[]>('notes_roots_list')).map((r) => r.path)
	} catch (e) {
		say(errMsg(e), 'bad')
	}
	await rescan(true)
	try {
		await invoke('notes_watch_start')
		unlisten = await listen<NotesChangedPayload>('notes-changed', () => {
			if (rescanTimer) clearTimeout(rescanTimer)
			rescanTimer = setTimeout(() => void rescan(true), 400)
		})
	} catch (e) {
		say(`watcher unavailable: ${errMsg(e)}`, 'bad')
	}
	notes.loaded = true
	if (saved.activePath && entryFor(saved.activePath)?.is_markdown !== false) {
		await openNote(saved.activePath)
	}
}

export async function addFolders(): Promise<void> {
	const picked = await openDialog({ directory: true, multiple: true })
	if (!picked) return
	const paths = (Array.isArray(picked) ? picked : [picked]).filter((p): p is string => !!p)
	if (!paths.length) return
	try {
		notes.roots = (await invoke<{ path: string }[]>('notes_roots_add', { paths })).map(
			(r) => r.path
		)
		await invoke('notes_watch_start')
		await rescan()
		say('folders added', 'ok')
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function removeRoot(path: string): Promise<void> {
	try {
		notes.roots = (await invoke<{ path: string }[]>('notes_roots_remove', { path })).map(
			(r) => r.path
		)
		await invoke('notes_watch_start')
		await rescan()
		if (notes.activePath && !entryFor(notes.activePath)) {
			if (notes.dirty) {
				notes.notice = 'Its folder was removed; copy your text out or re-add the folder.'
			} else {
				notes.activePath = null
				notes.text = ''
				notes.baseline = ''
			}
		}
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function openNote(path: string, range: LineRange | null = null): Promise<void> {
	const entry = entryFor(path)
	if (entry && !entry.is_markdown) {
		notes.notice = 'Only markdown notes open in the editor in v1.'
		return
	}
	if (autosaveTimer) clearTimeout(autosaveTimer)
	if (path !== notes.activePath) {
		if (notes.dirty && notes.activePath) {
			const name = notes.activePath.split('/').pop() ?? notes.activePath
			if (!confirm(`Save changes to ${name} before switching?`)) return
			await saveNote()
		}
	} else {
		// Same file (e.g. a range link into the open note): keep the buffer,
		// including unsaved edits, and just move the selection.
		notes.pendingRange = range
		if (range) notes.view = 'raw'
		return
	}
	try {
		const body = await invoke<string>('notes_read', { path })
		notes.activePath = path
		notes.text = body
		notes.baseline = body
		notes.dirty = false
		notes.rev += 1
		notes.readonly = (entry?.size ?? body.length) > READONLY_BYTES
		notes.openMtime = entry?.mtime ?? 0
		notes.notice = notes.readonly ? 'File over 1 MB — opened read-only.' : ''
		notes.pendingRange = range
		persistLayout()
		void refreshMentions()
		void refreshBacklinks()
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

// A line-range link targets raw lines, so it switches the view to raw.
export function consumePendingRange(): LineRange | null {
	const range = notes.pendingRange
	notes.pendingRange = null
	if (range) notes.view = 'raw'
	return range
}

export function markEdited(next: string): void {
	if (notes.readonly || next === notes.text) return
	notes.text = next
	notes.dirty = next !== notes.baseline
	void refreshMentions()
	scheduleAutosave()
}

function scheduleAutosave(): void {
	if (autosaveTimer) clearTimeout(autosaveTimer)
	autosaveTimer = setTimeout(() => void saveNote(true), AUTOSAVE_IDLE_MS)
}

export async function saveNote(auto = false): Promise<void> {
	if (!notes.activePath || !notes.dirty || notes.readonly || notes.saving) return
	notes.saving = true
	const path = notes.activePath
	const body = notes.text
	try {
		await invoke('notes_write', { path, body })
		if (notes.activePath === path && notes.text === body) {
			notes.baseline = body
			notes.dirty = false
		} else {
			// More edits landed mid-flight; save again on the next idle tick.
			scheduleAutosave()
		}
		await rescan(true)
		notes.openMtime = entryFor(path)?.mtime ?? notes.openMtime
		if (!auto) say('saved', 'ok')
	} catch (e) {
		say(errMsg(e), 'bad')
	} finally {
		notes.saving = false
	}
}

export function revertNote(): void {
	notes.text = notes.baseline
	notes.dirty = false
	notes.rev += 1
	notes.notice = ''
}

export async function createNote(dir: string): Promise<void> {
	let candidate = `${dir}/untitled.md`
	for (let i = 2; ; i++) {
		if (!entryFor(candidate)) break
		candidate = `${dir}/untitled-${i}.md`
	}
	try {
		const created = await invoke<string>('notes_new', { path: candidate })
		await rescan(true)
		await openNote(created)
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function createFolder(dir: string): Promise<void> {
	try {
		await invoke('notes_mkdir', { path: `${dir}/untitled-folder` })
		notes.expanded[dir] = true
		await rescan(true)
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function renameEntry(path: string, name: string): Promise<void> {
	const dir = path.slice(0, path.lastIndexOf('/'))
	const to = `${dir}/${name}`
	if (to === path) return
	try {
		await invoke('notes_rename', { from: path, to })
		if (notes.activePath === path) notes.activePath = to
		await rescan(true)
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function deleteEntry(path: string): Promise<void> {
	const name = path.split('/').pop() ?? path
	if (!confirm(`Permanently delete ${name}? This cannot be undone.`)) return
	try {
		await invoke('notes_delete', { path })
		if (notes.activePath === path || notes.activePath?.startsWith(path + '/')) {
			notes.activePath = null
			notes.text = ''
			notes.baseline = ''
			notes.dirty = false
		}
		await rescan(true)
		say('deleted', 'ok')
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function importFilesHere(dir: string): Promise<void> {
	const picked = await openDialog({ multiple: true })
	if (!picked) return
	const sources = (Array.isArray(picked) ? picked : [picked]).filter((p): p is string => !!p)
	if (!sources.length) return
	try {
		const created = await invoke<string[]>('notes_import_files', {
			sources,
			destDir: dir
		})
		await rescan(true)
		say(`imported ${created.length} file${created.length === 1 ? '' : 's'}`, 'ok')
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function importFolderHere(dir: string): Promise<void> {
	const picked = await openDialog({ directory: true })
	if (!picked || Array.isArray(picked)) return
	try {
		await invoke('notes_import_dir', { source: picked, destDir: dir })
		await rescan(true)
		say('folder imported', 'ok')
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

// Clipboard for tree cut/copy/paste: copy duplicates (also across roots),
// cut copies then deletes sources only after a successful copy.
let treeClipboard: { mode: 'copy' | 'cut'; paths: string[] } | null = null

export function copyEntries(paths: string[], mode: 'copy' | 'cut'): void {
	treeClipboard = { mode, paths: [...paths] }
	say(`${mode === 'copy' ? 'Copied' : 'Cut'} ${paths.length} item${paths.length === 1 ? '' : 's'}`, '')
}

export function canPaste(): boolean {
	return treeClipboard !== null && treeClipboard.paths.length > 0
}

export async function pasteInto(dir: string): Promise<void> {
	if (!treeClipboard) return
	const { mode, paths } = treeClipboard
	if (mode === 'cut' && paths.every((p) => p.slice(0, p.lastIndexOf('/')) === dir)) {
		treeClipboard = null
		say('already here', '')
		return
	}
	try {
		await invoke('notes_import_files', { sources: paths, destDir: dir })
		if (mode === 'cut') {
			for (const p of paths) {
				try {
					await invoke('notes_delete', { path: p })
				} catch (e) {
					say(`pasted but could not remove ${p.split('/').pop()}: ${errMsg(e)}`, 'bad')
				}
			}
			treeClipboard = null
		}
		await rescan(true)
		say('pasted', 'ok')
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function revealInFinder(path: string): Promise<void> {
	try {
		await invoke('reveal', { path })
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

export async function copyPath(path: string, relative: boolean): Promise<void> {
	const entry = entryFor(path)
	const value = relative && entry ? entry.rel : path
	try {
		await navigator.clipboard.writeText(value)
		say('path copied', 'ok')
	} catch (e) {
		say(errMsg(e), 'bad')
	}
}

/** Follow a file:// link from the open note. Line ranges switch to raw view. */
export async function openLinkTarget(href: string): Promise<void> {
	if (!notes.activePath) return
	const root = rootFor(notes.activePath)
	if (!root) {
		notes.notice = 'The containing folder is no longer added.'
		return
	}
	const { path, range } = splitTarget(href.slice('file://'.length))
	void path
	const resolved = resolveLink(href, notes.activePath, root)
	if (!resolved) {
		notes.notice = `Broken link: ${href}`
		return
	}
	if (!/\.(md|markdown)$/i.test(resolved)) {
		notes.notice = 'Linked file is not a markdown note.'
		return
	}
	if (range) notes.view = 'raw'
	await openNote(resolved, range)
}

export async function refreshMentions(): Promise<void> {
	if (!notes.activePath) {
		notes.mentions = []
		return
	}
	const root = rootFor(notes.activePath)
	notes.mentions = extractMentions(notes.text).map((target) => {
		const { path, range } = splitTarget(target.slice('file://'.length))
		void path
		return { target, resolved: root ? resolveLink(target, notes.activePath!, root) : null, range }
	})
}

/** Backlinks via one server grep on the filename, then exact per-line resolve. */
export async function refreshBacklinks(): Promise<void> {
	notes.backlinks = []
	if (!notes.activePath) return
	const self = notes.activePath
	const stem = self.slice(self.lastIndexOf('/') + 1)
	let hits: NotesGrepHitDTO[]
	try {
		hits = await invoke<NotesGrepHitDTO[]>('notes_grep', { needle: stem, markdownOnly: true })
	} catch (e) {
		say(errMsg(e), 'bad')
		return
	}
	const files = [...new Set(hits.map((h) => h.path))].filter((p) => p !== self).slice(0, BACKLINK_FILE_CAP)
	const out: Backlink[] = []
	const LINK_RE = /(?<!!)\[[^\]]*\]\(([^)\s]+)\)/g
	for (const path of files) {
		const root = rootFor(path)
		if (!root) continue
		let body: string
		try {
			body = await invoke<string>('notes_read', { path })
		} catch {
			continue
		}
		LINK_RE.lastIndex = 0
		let m: RegExpExecArray | null
		while ((m = LINK_RE.exec(body)) !== null) {
			const target = m[1]
			if (!target.startsWith('file://')) continue
			if (resolveLink(target, path, root) === self) {
				out.push({ path, line: body.slice(0, m.index).split('\n').length })
			}
		}
	}
	notes.backlinks = out
}

export { SEARCH_ENABLED, parseRange }
export type { LineRange }

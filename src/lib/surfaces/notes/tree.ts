// Tree model over flat scan entries: group by root, nest by rel segments.
// Pure functions; the component renders rows from these nodes.

import type { NotesEntryDTO } from './types.js'

export interface TreeNode {
	/** Display name (single segment). */
	name: string
	/** Absolute path. */
	path: string
	/** Owning root path. */
	root: string
	is_dir: boolean
	is_markdown: boolean
	size: number
	mtime: number
	children: TreeNode[]
}

export function buildTree(root: string, entries: NotesEntryDTO[]): TreeNode[] {
	const top: TreeNode[] = []
	const dirs = new Map<string, TreeNode>()
	const byPath = new Map<string, TreeNode>()
	for (const e of entries) {
		if (e.root !== root) continue
		const segs = e.rel.split('/').filter((s) => s.length > 0)
		if (segs.length === 0) continue
		let parentPath = root
		let siblings = top
		for (let i = 0; i < segs.length; i++) {
			const last = i === segs.length - 1
			const childPath = parentPath + '/' + segs.slice(0, i + 1).join('/')
			let node = byPath.get(childPath)
			if (!node) {
				node = {
					name: segs[i],
					path: last ? e.path : childPath,
					root,
					is_dir: last ? e.is_dir : true,
					is_markdown: last ? e.is_markdown : false,
					size: last ? e.size : 0,
					mtime: last ? e.mtime : 0,
					children: []
				}
				byPath.set(childPath, node)
				siblings.push(node)
				if (node.is_dir) dirs.set(childPath, node)
			}
			if (node.is_dir) {
				parentPath = childPath
				siblings = node.children
			}
		}
	}
	const rank = (n: TreeNode) => (n.is_dir ? 0 : n.is_markdown ? 1 : 2)
	const sortAll = (nodes: TreeNode[]) => {
		nodes.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
		for (const n of nodes) sortAll(n.children)
	}
	sortAll(top)
	return top
}

/** Basename without extension, for grep-needle backlink search. */
export function fileStem(path: string): string {
	const base = path.slice(path.lastIndexOf('/') + 1)
	const dot = base.lastIndexOf('.')
	return dot > 0 ? base.slice(0, dot) : base
}

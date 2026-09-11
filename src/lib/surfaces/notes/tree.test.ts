import { describe, expect, it } from 'vitest'
import { buildTree, fileStem } from './tree.js'
import type { NotesEntryDTO } from './types.js'

const e = (rel: string, is_dir = false, is_markdown = false): NotesEntryDTO => ({
	path: '/r/' + rel,
	rel,
	root: '/r',
	is_dir,
	is_markdown,
	size: 0,
	mtime: 0,
	title: '',
	excerpt: ''
})

describe('buildTree', () => {
	it('nests segments and sorts dirs before markdown before other', () => {
		const tree = buildTree('/r', [
			e('z.png'),
			e('b.md', false, true),
			e('docs', true),
			e('docs/a.md', false, true),
			e('other-root.md', false, true)
		])
		// other-root.md belongs to /r here (rel based); mixed-root filtering:		expect(tree.map((n) => n.name)).toEqual(['docs', 'b.md', 'other-root.md', 'z.png'])
		const docs = tree[0]
		expect(docs.is_dir).toBe(true)
		expect(docs.children.map((n) => n.name)).toEqual(['a.md'])
	})
	it('ignores entries from other roots', () => {
		const foreign: NotesEntryDTO = { ...e('x.md', false, true), root: '/q' }
		expect(buildTree('/r', [foreign])).toEqual([])
	})
})

describe('fileStem', () => {
	it('strips directories and the last extension', () => {
		expect(fileStem('/r/docs/todo.md')).toBe('todo')
		expect(fileStem('/r/Makefile')).toBe('Makefile')
	})
})

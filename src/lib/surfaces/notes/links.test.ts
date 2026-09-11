import { describe, expect, it } from 'vitest'
import {
	extractLinkTargets,
	extractMentions,
	isFileUrl,
	parseRange,
	resolveLink,
	splitTarget
} from './links.js'

describe('parseRange', () => {
	it('parses single and ranged selections', () => {
		expect(parseRange('L10')).toEqual({ start: 10, end: 10 })
		expect(parseRange('#L10-L17')).toEqual({ start: 10, end: 17 })
	})
	it('rejects empties, zero, and inverted ranges', () => {
		expect(parseRange('')).toBeNull()
		expect(parseRange('L0')).toBeNull()
		expect(parseRange('L17-L10')).toBeNull()
		expect(parseRange('10-17')).toBeNull()
	})
})

describe('splitTarget', () => {
	it('splits path from range', () => {
		expect(splitTarget('a/b.md#L1-L2')).toEqual({ path: 'a/b.md', range: { start: 1, end: 2 } })
		expect(splitTarget('a/b.md')).toEqual({ path: 'a/b.md', range: null })
	})
})

describe('isFileUrl', () => {
	it('matches only the file scheme', () => {
		expect(isFileUrl('file://a.md')).toBe(true)
		expect(isFileUrl('https://a.md')).toBe(false)
	})
})

describe('resolveLink', () => {
	const root = '/notes/work'
	const from = '/notes/work/docs/plan.md'
	it('resolves relatives against the containing root', () => {
		expect(resolveLink('file://tasks/todo.md', from, root)).toBe('/notes/work/docs/tasks/todo.md')
		expect(resolveLink('file://../other.md', from, root)).toBe('/notes/work/other.md')
	})
	it('resolves absolute file:/// against the filesystem root', () => {
		expect(resolveLink('file:///etc/hosts', from, root)).toBe('/etc/hosts')
	})
	it('rejects escapes above the root and non-file targets', () => {
		expect(resolveLink('file://../../etc/hosts', from, root)).toBeNull()
		expect(resolveLink('https://x.md', from, root)).toBeNull()
	})
})

describe('extraction', () => {
	const md = 'See [a](file://a.md) and ![img](file://i.png) plus [web](https://x.y).'
	it('extracts all link targets except images', () => {
		expect(extractLinkTargets(md)).toEqual(['file://a.md', 'https://x.y'])
	})
	it('mentions are file:// links only', () => {
		expect(extractMentions(md)).toEqual(['file://a.md'])
	})
})

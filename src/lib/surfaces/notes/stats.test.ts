import { describe, expect, it } from 'vitest'
import {
	countChars,
	countTasks,
	countWords,
	extractOutline,
	findBacklinks,
	formatReadingTime
} from './stats.js'

describe('counts', () => {
	it('handles empty and basic text', () => {
		expect(countWords('')).toBe(0)
		expect(countWords('  ')).toBe(0)
		expect(countWords('hello brave new world')).toBe(4)
		expect(countChars('héllo')).toBe(5)
	})
	it('formats reading time like the mockup', () => {
		expect(formatReadingTime('')).toBe('0s')
		expect(formatReadingTime('word '.repeat(200))).toBe('1m 0s')
	})
})

describe('tasks', () => {
	it('tallies open and closed boxes', () => {
		expect(countTasks('- [ ] a\n- [x] b\n- [X] c\nnot a task [ ]\n')).toEqual({ done: 2, total: 3 })
	})
})

describe('outline', () => {
	it('extracts ATX headings with line numbers, skipping fences', () => {
		const md = '# Title\n\n```\n# not a heading\n```\n\n## Sub deep\n'
		expect(extractOutline(md)).toEqual([
			{ level: 1, text: 'Title', line: 1 },
			{ level: 2, text: 'Sub deep', line: 7 }
		])
	})
})

describe('backlinks', () => {
	const root = '/n'
	const files = [
		{ path: '/n/a.md', root, text: 'see [b](file://b.md#L2) here' },
		{ path: '/n/b.md', root, text: 'nothing linking out' },
		{ path: '/n/c.md', root, text: 'broken [x](file://missing.md) plus [a](file://a.md)' }
	]
	it('finds inbound links with line numbers, skipping self and broken', () => {
		expect(findBacklinks(files, '/n/b.md')).toEqual([{ path: '/n/a.md', line: 1 }])
		expect(findBacklinks(files, '/n/a.md')).toEqual([{ path: '/n/c.md', line: 1 }])
	})
})

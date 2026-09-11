import { describe, expect, it } from 'vitest'
import { leadingH1, splitFrontmatter } from './frontmatter.js'

describe('splitFrontmatter', () => {
	it('splits block, body, and title without touching bytes', () => {
		const text = '---\ntitle: "My Note"\ntags: [a]\n---\n\n# Body\n'
		const split = splitFrontmatter(text)
		expect(split.title).toBe('My Note')
		expect(split.body).toBe('\n# Body\n')
		expect(split.frontmatter! + split.body).toBe(text)
	})
	it('reads bare and single-quoted titles', () => {
		expect(splitFrontmatter('---\ntitle: Plain\n---\nx').title).toBe('Plain')
		expect(splitFrontmatter("---\ntitle: 'Q'\n---\nx").title).toBe('Q')
	})
	it('passes through files without (or with unclosed) frontmatter', () => {
		expect(splitFrontmatter('# Just a note\n').frontmatter).toBeNull()
		const unclosed = splitFrontmatter('---\ntitle: x\nno end\n')
		expect(unclosed.frontmatter).toBeNull()
		expect(unclosed.body).toBe('---\ntitle: x\nno end\n')
	})
})

describe('leadingH1', () => {
	it('detects a first-line H1 past blanks, else null', () => {
		expect(leadingH1('\n# Hello\n\ntext')).toBe('Hello')
		expect(leadingH1('text\n# Later\n')).toBeNull()
		expect(leadingH1('')).toBeNull()
	})
})

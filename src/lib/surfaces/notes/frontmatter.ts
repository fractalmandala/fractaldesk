// Non-destructive frontmatter split (product invariant 17). The raw file bytes
// stay canonical for byte-identical save; the rich view receives body plus title.

export interface SplitDoc {
	/** Exact original frontmatter block including delimiters, or null when absent. */
	frontmatter: string | null
	/** Everything after the closing delimiter (or the whole file). */
	body: string
	/** The `title:` value, or null. */
	title: string | null
}

const DELIM = /^---[ \t]*$/

export function splitFrontmatter(text: string): SplitDoc {
	const lines = text.split('\n')
	if (!DELIM.test(lines[0]?.replace(/\r$/, '') ?? '')) {
		return { frontmatter: null, body: text, title: null }
	}
	let close = -1
	for (let i = 1; i < lines.length; i++) {
		if (DELIM.test(lines[i].replace(/\r$/, ''))) {
			close = i
			break
		}
	}
	if (close < 0) return { frontmatter: null, body: text, title: null }
	const head = lines.slice(0, close + 1).join('\n')
	// Keep the join newline inside frontmatter so frontmatter + body === text exactly.
	const frontmatter = close + 1 < lines.length ? head + '\n' : head
	return { frontmatter, body: lines.slice(close + 1).join('\n'), title: readTitle(head) }
}

function readTitle(frontmatter: string): string | null {
	const m = /^title:[ \t]*(?:"([^"]*)"|'([^']*)'|(.+?))[ \t]*\r?$/m.exec(frontmatter)
	if (!m) return null
	return (m[1] ?? m[2] ?? m[3] ?? '').trim() || null
}

/**
 * The leading `# …` heading when the body's first non-blank line is one, else
 * null. Used to suppress a duplicate H1 when the title comes from frontmatter.
 */
export function leadingH1(body: string): string | null {
	for (const line of body.split('\n')) {
		if (line.trim().length === 0) continue
		const m = /^\s{0,3}#\s+(.+?)\s*#*\s*$/.exec(line)
		return m ? m[1] : null
	}
	return null
}

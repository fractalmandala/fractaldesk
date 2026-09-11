<script lang="ts">
	import { onMount } from 'svelte'
	import { Crepe } from '@milkdown/crepe'
	import '@milkdown/crepe/theme/common/style.css'
	import '@milkdown/crepe/theme/frame.css'
	import { editorViewCtx, editorViewOptionsCtx } from '@milkdown/kit/core'
	import { TextSelection } from '@milkdown/kit/prose/state'
	import { leadingH1, splitFrontmatter } from './frontmatter.js'

	interface Props {
		/** Full file text including frontmatter; the wrapper strips and reattaches. */
		value: string
		readonly?: boolean
		onChange?: (next: string) => void
		onLinkOpen?: (target: string) => void
	}

	let { value, readonly = false, onChange, onLinkOpen }: Props = $props()

	let host: HTMLDivElement
	let crepe: Crepe | null = null
	// Session envelope: frontmatter block (with trailing newline) plus the head
	// prefix (leading blank lines + suppressed H1 line) when the title comes from
	// frontmatter. Rich edits touch the display body only; both reattach on emit.
	// Limitation: the suppressed H1 is immutable in the rich view (raw edits it).
	let frontmatter = $state('')
	let head = $state('')
	let lastEmitted = ''

	function toDisplay(full: string): string {
		const split = splitFrontmatter(full)
		frontmatter = split.frontmatter ?? ''
		head = ''
		let body = split.body
		if (split.title) {
			const h1 = leadingH1(body)
			if (h1 !== null) {
				const lines = body.split('\n')
				for (let i = 0; i < lines.length; i++) {
					if (lines[i].trim() === '') continue
					head = lines.slice(0, i + 1).join('\n') + '\n'
					body = lines.slice(i + 1).join('\n')
					break
				}
			}
		}
		return body
	}

	function fromDisplay(markdown: string): string {
		return frontmatter + head + markdown
	}

	function onHostClick(event: MouseEvent): void {
		const anchor = (event.target as HTMLElement).closest?.('a[href]')
		if (!anchor) return
		const href = anchor.getAttribute('href') ?? ''
		if (!href.startsWith('file://')) return
		event.preventDefault()
		event.stopPropagation()
		onLinkOpen?.(href)
	}

	onMount(() => {
		host.addEventListener('click', onHostClick, true)
		lastEmitted = value

		crepe = new Crepe({ root: host, defaultValue: toDisplay(value) })
		crepe.editor.config((ctx) => {
			ctx.update(editorViewOptionsCtx, (prev) => ({
				...prev,
				attributes: { ...(prev.attributes ?? {}), spellcheck: 'false' },
				editable: () => !readonly
			}))
		})

		void crepe.create().then(() => {
			crepe?.on((listener) => {
				listener.markdownUpdated((_ctx, markdown) => {
					const full = fromDisplay(markdown)
					if (full === lastEmitted) return
					lastEmitted = full
					onChange?.(full)
				})
			})
		})

		return () => {
			host.removeEventListener('click', onHostClick, true)
			void crepe?.destroy()
			crepe = null
		}
	})

	/** Insert a markdown snippet at the cursor (toolbar writes syntax to text). */
	export function insertSyntax(snippet: string, cursorOffset?: number): void {
		if (!crepe) return
		crepe.editor.action((ctx) => {
			const view = ctx.get(editorViewCtx)
			const pos = view.state.selection.from
			let tr = view.state.tr.insertText(snippet, pos)
			if (typeof cursorOffset === 'number') {
				tr = tr.setSelection(TextSelection.create(tr.doc, pos + cursorOffset))
			}
			view.dispatch(tr)
			view.focus()
		})
	}
</script>

<div bind:this={host} class="rich-host scroll-y grow min0"></div>

<style lang="sass">
// Crepe themes through --crepe-* vars declared on its own .milkdown root, so
// the mapping must sit on that same scope (closer scope wins over inheritance).
// Structural globals below are third-party internals with no vocabulary.
.rich-host :global(.milkdown)
	--crepe-color-background: var(--bg)
	--crepe-color-on-background: var(--text-primary)
	--crepe-color-surface: var(--bg-surface)
	--crepe-color-surface-low: var(--bg-panel)
	--crepe-color-on-surface: var(--text-primary)
	--crepe-color-on-surface-variant: var(--text-secondary)
	--crepe-color-outline: var(--border)
	--crepe-color-primary: var(--theme-color)
	--crepe-color-secondary: var(--state-selected)
	--crepe-color-on-secondary: var(--text-primary)
	--crepe-color-inverse: var(--bg-raised)
	--crepe-color-on-inverse: var(--text-primary)
	--crepe-color-inline-code: #ba1a1a
	--crepe-color-error: #ba1a1a
	--crepe-color-hover: var(--state-hover)
	--crepe-color-selected: var(--state-selected)
	--crepe-color-inline-area: var(--state-hover-subtle)
	--crepe-font-default: var(--font-sans)
	--crepe-font-code: var(--font-mono)
	--crepe-font-title: var(--font-sans)

@media (prefers-color-scheme: dark)
	.rich-host :global(.milkdown)
		--crepe-color-inline-code: var(--feedback-error)
		--crepe-color-error: var(--feedback-error)

.rich-host :global(.milkdown)
	width: 100%
	background: transparent

.rich-host :global(.ProseMirror)
	max-width: var(--measure)
	margin: 0 auto
	padding: var(--space-lg)
	outline: none
	background: transparent

.rich-host :global(.ProseMirror a)
	color: var(--info)
</style>

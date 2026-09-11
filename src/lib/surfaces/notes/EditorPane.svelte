<script lang="ts">
	import CrepeEditor from './CrepeEditor.svelte'
	import RawEditor from './RawEditor.svelte'
	import { leadingH1, splitFrontmatter } from './frontmatter.js'
	import {
		consumePendingRange,
		entryFor,
		markEdited,
		notes,
		openLinkTarget
	} from './state.svelte.js'

	let rawRef = $state<RawEditor>()
	let richRef = $state<CrepeEditor>()

	const entry = $derived(notes.activePath ? entryFor(notes.activePath) : undefined)

	const displayTitle = $derived.by(() => {
		if (!notes.activePath) return ''
		const split = splitFrontmatter(notes.text)
		if (split.title) return split.title
		const h1 = leadingH1(split.body)
		if (h1) return h1
		return notes.activePath.split('/').pop()?.replace(/\.md$/i, '') ?? notes.activePath
	})

	// A pending #L range (link or outline jump) targets raw lines. The effect
	// subscribes to pendingRange so same-file jumps apply without a remount.
	$effect(() => {
		void notes.pendingRange
		if (rawRef && notes.activePath && notes.view === 'raw') {
			const range = consumePendingRange()
			if (range) rawRef.gotoRange(range.start, range.end)
		}
	})

	interface FormatAction {
		label: string
		title: string
		run: () => void
	}

	function rawAct(fn: (ref: RawEditor) => void): () => void {
		return () => {
			if (rawRef) fn(rawRef)
		}
	}

	function richAct(snippet: string, cursorOffset?: number): () => void {
		return () => {
			richRef?.insertSyntax(snippet, cursorOffset)
		}
	}

	const actions = $derived.by((): FormatAction[] => {
		const rich = notes.view === 'rich'
		const wrap = (before: string, after: string, label: string, title: string): FormatAction =>
			rich
				? { label, title, run: richAct(before + after, before.length) }
				: {
						label,
						title,
						run: rawAct((r) => r.wrapSelection(before, after))
					}
		const insert = (snippet: string, label: string, title: string): FormatAction => ({
			label,
			title,
			run: rich ? richAct(snippet) : rawAct((r) => r.insertSyntax(snippet))
		})
		return [
			wrap('**', '**', 'B', 'Bold'),
			wrap('*', '*', 'I', 'Italic'),
			wrap('~~', '~~', 'S', 'Strikethrough'),
			wrap('`', '`', '<>', 'Inline code'),
			insert('# ', 'H1', 'Heading 1'),
			insert('## ', 'H2', 'Heading 2'),
			insert('### ', 'H3', 'Heading 3'),
			insert('- ', '•', 'Bullet list'),
			insert('1. ', '1.', 'Numbered list'),
			insert('- [ ] ', '☐', 'Checklist'),
			insert('> ', '❝', 'Blockquote'),
			insert('[label](file://path.md)', '🔗', 'Note link'),
			insert('<cite>citation</cite>', '❝❞', 'Citation')
		]
	})
</script>

{#if !notes.activePath}
	<div class="empty">
		<p>Select a note to start editing.</p>
	</div>
{:else}
	<div class="editor-head">
		<span class="doc-title">{displayTitle}{#if notes.dirty} •{/if}</span>
		{#if notes.readonly}<span class="ro">read-only</span>{/if}
	</div>
	{#if notes.notice}<p class="notice">{notes.notice}</p>{/if}
	{#if !notes.readonly}
		<div class="formatbar" role="toolbar" aria-label="Formatting">
			{#each actions as a (a.label + a.title)}
				<button class="fmt" title={a.title} onclick={a.run}>{a.label}</button>
			{/each}
		</div>
	{/if}
	<div class="editor-body">
		{#key `${notes.activePath}:${notes.rev}`}
			{#if notes.view === 'raw'}
				<RawEditor
					bind:this={rawRef}
					value={notes.text}
					readonly={notes.readonly}
					onChange={markEdited}
				/>
			{:else}
				<CrepeEditor
					bind:this={richRef}
					value={notes.text}
					readonly={notes.readonly}
					onChange={markEdited}
					onLinkOpen={(href) => void openLinkTarget(href)}
				/>
			{/if}
		{/key}
	</div>
{/if}

<style lang="sass">
.empty
	flex: 1
	display: flex
	align-items: center
	justify-content: center
	color: var(--text-muted)
	font-size: var(--text-sm)

.editor-head
	display: flex
	align-items: center
	gap: 8px
	padding: var(--space-sm) var(--space-bs) var(--space-xs)

.doc-title
	font-size: var(--text-bs)
	color: var(--text-primary)
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap

.ro
	font-size: var(--text-xs)
	color: var(--warning)
	border: 1px solid var(--warning)
	border-radius: var(--radius-4)
	padding: 1px 6px

.notice
	margin: 0
	padding: 0 var(--space-bs) var(--space-xs)
	font-size: var(--text-xs)
	color: var(--text-secondary)

.formatbar
	display: flex
	flex-wrap: wrap
	gap: 2px
	padding: 0 var(--space-bs) var(--space-xs)

.fmt
	background: none
	border: 1px solid transparent
	border-radius: var(--radius-4)
	color: var(--text-secondary)
	font-size: var(--text-xs)
	min-width: var(--control-h-sm)
	height: var(--control-h-sm)
	padding: 0 6px
	cursor: pointer
	&:hover:not(:disabled)
		background: var(--state-hover)
		color: var(--text-primary)

.editor-body
	flex: 1
	min-height: 0
	display: flex
</style>

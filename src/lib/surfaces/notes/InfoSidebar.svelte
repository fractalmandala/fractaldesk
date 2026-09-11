<script lang="ts">
	import { splitTarget } from './links.js'
	import {
		countChars,
		countTasks,
		countWords,
		extractOutline,
		formatReadingTime
	} from './stats.js'
	import { entryFor, notes, openLinkTarget, openNote } from './state.svelte.js'

	const sections = $state({ stats: true, outline: true, links: true, backlinks: true, meta: true })

	const entry = $derived(notes.activePath ? entryFor(notes.activePath) : undefined)
	const tasks = $derived(countTasks(notes.text))
	const outline = $derived(extractOutline(notes.text))

	function fmtSize(bytes: number): string {
		if (bytes < 1024) return `${bytes} B`
		if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
		return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
	}

	function fmtDate(mtime: number): string {
		if (!mtime) return '—'
		return new Date(mtime * 1000).toLocaleString()
	}

	function toggle(name: keyof typeof sections): void {
		sections[name] = !sections[name]
	}
</script>

{#if !notes.activePath}
	<p class="empty">Open a note for details.</p>
{:else}
	<div class="sections">
		<section>
			<button class="sec-head" onclick={() => toggle('stats')}>
				<span>{sections.stats ? '▾' : '▸'} Stats</span>
			</button>
			{#if sections.stats}
				<dl class="stats">
					<div><dt>Words</dt><dd>{countWords(notes.text)}</dd></div>
					<div><dt>Characters</dt><dd>{countChars(notes.text)}</dd></div>
					<div><dt>Reading time</dt><dd>{formatReadingTime(notes.text)}</dd></div>
					<div><dt>Tasks</dt><dd>{tasks.done} of {tasks.total} done</dd></div>
				</dl>
			{/if}
		</section>

		<section>
			<button class="sec-head" onclick={() => toggle('outline')}>
				<span>{sections.outline ? '▾' : '▸'} Outline</span>
			</button>
			{#if sections.outline}
				{#if !outline.length}
					<p class="one-line">No headings.</p>
				{:else}
					{#each outline as h (h.line)}
						<button
							class="link-row"
							style="padding-left: {8 + (h.level - 1) * 12}px"
							onclick={() => openNote(notes.activePath!, { start: h.line, end: h.line })}
						>
							{h.text}
						</button>
					{/each}
				{/if}
			{/if}
		</section>

		<section>
			<button class="sec-head" onclick={() => toggle('links')}>
				<span>{sections.links ? '▾' : '▸'} Linked mentions ({notes.mentions.length})</span>
			</button>
			{#if sections.links}
				{#if !notes.mentions.length}
					<p class="one-line">No outgoing links.</p>
				{:else}
					{#each notes.mentions as m, i (m.target + i)}
						<button
							class="link-row"
							class:broken={!m.resolved}
							title={m.resolved ?? 'Broken link'}
							onclick={() => openLinkTarget(m.target)}
						>
							{splitTarget(m.target.slice('file://'.length)).path}
						</button>
					{/each}
				{/if}
			{/if}
		</section>

		<section>
			<button class="sec-head" onclick={() => toggle('backlinks')}>
				<span>{sections.backlinks ? '▾' : '▸'} Backlinks ({notes.backlinks.length})</span>
			</button>
			{#if sections.backlinks}
				{#if !notes.backlinks.length}
					<p class="one-line">Nothing links here.</p>
				{:else}
					{#each notes.backlinks as b (`${b.path}:${b.line}`)}
						<button
							class="link-row"
							onclick={() => openNote(b.path, { start: b.line, end: b.line })}
						>
							{b.path.split('/').pop()}:{b.line}
						</button>
					{/each}
				{/if}
			{/if}
		</section>

		<section>
			<button class="sec-head" onclick={() => toggle('meta')}>
				<span>{sections.meta ? '▾' : '▸'} File</span>
			</button>
			{#if sections.meta}
				<dl class="stats">
					<div><dt>Modified</dt><dd>{fmtDate(entry?.mtime ?? 0)}</dd></div>
					<div><dt>Size</dt><dd>{fmtSize(entry?.size ?? notes.text.length)}</dd></div>
				</dl>
			{/if}
		</section>
	</div>
{/if}

<style lang="sass">
.empty, .one-line
	padding: var(--space-sm)
	color: var(--text-muted)
	font-size: var(--text-xs)

.sections
	display: flex
	flex-direction: column

.sec-head
	width: 100%
	background: none
	border: 0
	border-bottom: 1px solid var(--border-subtle)
	color: var(--text-secondary)
	font-size: var(--text-xs)
	padding: var(--space-sm)
	cursor: pointer
	text-align: left
	&:hover
		background: var(--state-hover-subtle)

.stats
	margin: 0
	padding: var(--space-xs) var(--space-sm) var(--space-sm)
	display: flex
	flex-direction: column
	gap: 4px

.stats div
	display: flex
	justify-content: space-between
	font-size: var(--text-xs)

.stats dt
	color: var(--text-muted)

.stats dd
	margin: 0
	color: var(--text-primary)
	font-family: var(--font-mono)

.link-row
	width: 100%
	background: none
	border: 0
	text-align: left
	font-size: var(--text-xs)
	font-family: var(--font-mono)
	color: var(--info)
	padding: 4px 8px
	cursor: pointer
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap
	&:hover
		background: var(--state-hover)
	&.broken
		color: var(--danger)
</style>

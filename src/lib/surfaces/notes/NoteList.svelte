<script lang="ts">
	import { notes, openNote } from './state.svelte.js'
	import type { NotesEntryDTO } from './types.js'

	function fmtDate(mtime: number): string {
		if (!mtime) return ''
		return new Date(mtime * 1000).toLocaleDateString(undefined, {
			month: 'short',
			day: 'numeric'
		})
	}

	function displayTitle(e: NotesEntryDTO): string {
		if (e.title) return e.title
		return e.path.split('/').pop()?.replace(/\.md$/i, '') ?? e.rel
	}

	const rows = $derived(
		notes.entries
			.filter((e) => !e.is_dir && e.is_markdown)
			.filter((e) => {
				const q = notes.filter.trim().toLowerCase()
				if (!q) return true
				return (
					displayTitle(e).toLowerCase().includes(q) ||
					e.excerpt.toLowerCase().includes(q) ||
					e.rel.toLowerCase().includes(q)
				)
			})
			.sort((a, b) => b.mtime - a.mtime)
	)
</script>

<div class="list-filter">
	<input
		type="search"
		placeholder="Filter notes…"
		aria-label="Filter notes"
		bind:value={notes.filter}
	/>
	{#if notes.truncated}<span class="trunc" title="Folder caps reached — list may be incomplete">capped</span
		>{/if}
</div>

<div class="rows">
	{#if !rows.length}
		<p class="empty">{notes.filter ? 'No matching notes.' : 'No notes yet.'}</p>
	{:else}
		{#each rows as row (row.path)}
			<button class="note-row" class:sel={row.path === notes.activePath} onclick={() => openNote(row.path)}>
				<span class="title">{displayTitle(row)}{#if row.path === notes.activePath && notes.dirty} •{/if}</span
				>
				{#if row.excerpt}<span class="excerpt">{row.excerpt}</span>{/if}
				<span class="meta">{row.rel} · {fmtDate(row.mtime)}</span>
			</button>
		{/each}
	{/if}
</div>

<style lang="sass">
.list-filter
	display: flex
	align-items: center
	gap: 6px
	padding: var(--space-sm)

.list-filter input
	flex: 1
	min-width: 0
	height: var(--control-h-sm)
	background: var(--bg-input)
	border: 1px solid var(--border)
	border-radius: var(--radius-4)
	padding: 0 8px
	font-size: var(--text-sm)
	color: var(--text-primary)

.trunc
	font-size: var(--text-xs)
	color: var(--warning)

.rows
	flex: 1
	min-height: 0
	overflow-y: auto
	display: flex
	flex-direction: column

.empty
	padding: var(--space-lg) var(--space-sm)
	color: var(--text-muted)
	font-size: var(--text-sm)

.note-row
	display: flex
	flex-direction: column
	align-items: stretch
	gap: 2px
	background: none
	border: 0
	border-bottom: 1px solid var(--border-subtle)
	padding: var(--space-sm)
	cursor: pointer
	text-align: left
	&:hover
		background: var(--state-hover)
	&.sel
		background: var(--state-selected)

.title
	font-size: var(--text-sm)
	color: var(--text-primary)
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap

.excerpt
	font-size: var(--text-xs)
	color: var(--text-secondary)
	display: -webkit-box
	-webkit-line-clamp: 2
	-webkit-box-orient: vertical
	overflow: hidden

.meta
	font-size: var(--text-xs)
	font-family: var(--font-mono)
	color: var(--text-muted)
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap
</style>

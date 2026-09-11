<script lang="ts">
	import { notes, revertNote, saveNote, setCollapsed } from './state.svelte.js'
</script>

<div class="row ycenter gap-sm">
	<div class="row gap-xs" role="group" aria-label="Editor view">
		<button
			class="pill"
			class:active={notes.view === 'raw'}
			onclick={() => (notes.view = 'raw')}>Raw</button
		>
		<button
			class="pill"
			class:active={notes.view === 'rich'}
			onclick={() => (notes.view = 'rich')}>Rich</button
		>
	</div>
	{#if notes.dirty}<span class="text-warning text-bs" title="Unsaved changes">•</span>{/if}
	<button
		class="button small"
		disabled={!notes.dirty || notes.readonly || notes.saving}
		onclick={() => saveNote()}>{notes.saving ? 'Saving…' : 'Save'}</button
	>
	{#if notes.dirty && !notes.readonly}<button class="button ghost small" onclick={revertNote}
			>Revert</button
		>{/if}
	<div class="row gap-xs" role="group" aria-label="Columns">
		<button
			class="pill"
			class:active={!notes.layout.leftCollapsed}
			aria-pressed={!notes.layout.leftCollapsed}
			title="Toggle folders"
			onclick={() => setCollapsed('left', !notes.layout.leftCollapsed)}>Folders</button
		>
		<button
			class="pill"
			class:active={!notes.layout.listCollapsed}
			aria-pressed={!notes.layout.listCollapsed}
			title="Toggle note list"
			onclick={() => setCollapsed('list', !notes.layout.listCollapsed)}>List</button
		>
		<button
			class="pill"
			class:active={!notes.layout.rightCollapsed}
			aria-pressed={!notes.layout.rightCollapsed}
			title="Toggle details"
			onclick={() => setCollapsed('right', !notes.layout.rightCollapsed)}>Details</button
		>
	</div>
</div>

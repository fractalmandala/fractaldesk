<script lang="ts">
	import { app } from '../../store.svelte.js'
	import { themes, save, build, packageVsix, reveal } from './state.svelte.js'

	// Only mounted while this surface is active, so Cmd-S saves this surface's
	// document only when it is active, loaded, and the app is not busy.
	function keydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key === 's') {
			e.preventDefault()
			if (!app.busy && themes.doc) save()
		}
	}
</script>

<svelte:window onkeydown={keydown} />

{#if themes.doc}
	<span class="count">{themes.doc.themes.length} pairs · {themes.doc.themes.length * 2} themes · v{themes.doc.meta.version}</span>
	<span class="dot" class:on={themes.dirty} title="unsaved changes"></span>
	<button class="btn" onclick={build} disabled={app.busy}>Build</button>
	<button class="btn" onclick={packageVsix} disabled={app.busy}>Package .vsix</button>
	{#if themes.vsix}
		<button class="btn" onclick={reveal} disabled={app.busy}>Reveal</button>
	{/if}
	<button class="btn primary" onclick={save} disabled={app.busy}>Save</button>
{/if}

<style lang="sass">
.count
	font-family: var(--mono)
	font-size: var(--text-xs)
	color: var(--muted)
	white-space: nowrap

.dot
	width: 7px
	height: 7px
	border-radius: 50%
	background: var(--signal)
	opacity: 0
	&.on
		opacity: 1
</style>

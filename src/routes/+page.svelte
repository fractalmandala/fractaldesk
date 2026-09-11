<script lang="ts">
	import { app } from '$lib/store.svelte.js'
	import { REGISTRY } from '$lib/surfaces/registry'

	// The active surface from the registry (undefined = picker fallback).
	const current = $derived(REGISTRY.find((s) => s.id === app.view))

	// Full-width layout when the surface declares it, or while the surface's
	// fullWhileLoading() reports that its loading/error placeholder needs the
	// width (a full=false surface is widened until its data is present so the
	// placeholder can centre). Unmatched view: the picker takes the full width.
	// The fullWhileLoading call reads surface state inside this $derived, so
	// Svelte tracks it and re-widens as that state changes.
	const wide = $derived(
		current ? (current.fullWhileLoading?.() ?? false) || current.full : true
	)

	// Track which surfaces have been loaded so we don't re-load on every switch.
	let loaded = $state<Record<string, boolean>>({})

	// Call the active surface's load hook the first time it becomes active.
	$effect(() => {
		if (current?.load && !loaded[current.id]) {
			loaded[current.id] = true
			current.load()
		}
	})
</script>

<header class="app-header" data-tauri-drag-region>
	<!-- GLOBAL: chrome that belongs to the whole app — the title, the surface
			 switcher, and app-wide controls (a mode toggle will live here later). -->
	<div class="global">
		<p data-tauri-drag-region>fractaldesk</p>
		<div class="views" role="group" aria-label="Surface">
			{#each REGISTRY as s}
				{@const badge = s.badge?.(app)}
				<button class="primary" class:active={app.view === s.id} onclick={() => (app.view = s.id)}>
					{s.label}{badge ? ` · ${badge}` : ''}
				</button>
			{/each}
		</div>
	</div>

	<span class="grow" data-tauri-drag-region></span>

	<!-- Status is app-wide: any surface can post a message here. -->
	<span class="msg {app.kind}">{app.msg}</span>

	<!-- CONDITIONAL: the active surface's toolbar, resolved from the registry.
			 A surface with no toolbar contributes nothing to the header. -->
	<div class="conditional">
		{#if current?.toolbar}
			{@const Toolbar = current.toolbar}
			<Toolbar />
		{/if}
	</div>
</header>

<div class="shell" class:full={wide}>
	{#if current}
		{@const Body = current.component}
		<Body />
	{:else}
		<!-- No known surface selected: offer the full set to choose from. -->
		<div class="picker">
			<p>Pick a surface</p>
			<div class="views big">
				{#each REGISTRY as s}
					<button onclick={() => (app.view = s.id)}>{s.label}</button>
				{/each}
			</div>
		</div>
	{/if}
</div>

<style lang="sass">

header
	display: flex
	align-items: center
	gap: 12px
	padding: 10px 16px 10px 92px // clear the traffic lights
	background: var(--sunk)
	border-bottom: 1px solid var(--rule)
	height: 56px

// The two header zones: .global (title + nav + app-wide controls) on the
// left, .conditional (per-surface controls) on the right.
.global, .conditional
	display: flex
	align-items: center
	gap: 12px

.grow
	flex: 1
	align-self: stretch

.msg
	font-family: var(--mono)
	font-size: var(--text-sm)
	color: var(--muted)
	white-space: nowrap
	overflow: hidden
	text-overflow: ellipsis
	max-width: 44ch
	&.ok
		color: var(--ok)
	&.bad
		color: var(--bad)
	&.busy
		color: var(--signal)

.views
	display: flex
	border: 1px solid var(--rule)
	border-radius: 3px
	overflow: hidden
	button
		appearance: none
		border: 0
		background: transparent
		color: var(--muted)
		cursor: pointer
		font-family: var(--mono)
		font-size: var(--text-sm)
		letter-spacing: .06em
		text-transform: uppercase
		padding: 7px 12px
		white-space: nowrap
		&:hover
			color: var(--ink)

// The fallback surface picker: a larger, standalone version of the header nav.
.picker
	height: 100%
	display: flex
	flex-direction: column
	align-items: center
	justify-content: center
	gap: 18px
	p
		font-family: var(--mono)
		font-size: var(--text-sm)
		letter-spacing: .1em
		text-transform: uppercase
		color: var(--muted)
	.views.big button
		font-size: var(--text-md)
		padding: 12px 22px

.shell
	display: grid
	grid-template-columns: 250px 1fr
	height: calc(100% - 56px)
	min-height: 0
	&.full
		grid-template-columns: 1fr

</style>

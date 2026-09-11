<script lang="ts">
	import { app } from '$lib/store.svelte.js';
	import { REGISTRY } from '$lib/surfaces/registry';

	// The active surface from the registry (undefined = picker fallback).
	const current = $derived(REGISTRY.find((s) => s.id === app.view));

	// Full-width layout when the surface declares it, or while the surface's
	// fullWhileLoading() reports that its loading/error placeholder needs the
	// width (a full=false surface is widened until its data is present so the
	// placeholder can centre). Unmatched view: the picker takes the full width.
	// The fullWhileLoading call reads surface state inside this $derived, so
	// Svelte tracks it and re-widens as that state changes.
	const wide = $derived(current ? (current.fullWhileLoading?.() ?? false) || current.full : true);

	// Track which surfaces have been loaded so we don't re-load on every switch.
	let loaded = $state<Record<string, boolean>>({});

	// Call the active surface's load hook the first time it becomes active.
	$effect(() => {
		if (current?.load && !loaded[current.id]) {
			loaded[current.id] = true;
			current.load();
		}
	});
</script>

<div class="app-shell">
	<header class="app-header" data-tauri-drag-region>
		<!-- GLOBAL: chrome that belongs to the whole app — the title, the surface
			 switcher, and app-wide controls (a mode toggle will live here later). -->
		<div class="row ycenter gap-sm" role="group" aria-label="Surface">
			{#each REGISTRY as s}
				{@const badge = s.badge?.(app)}
				<button
					class="button primary"
					class:active={app.view === s.id}
					onclick={() => (app.view = s.id)}
				>
					{s.label}{badge ? ` · ${badge}` : ''}
				</button>
			{/each}
		</div>
		<div class="grow wfull hfull" data-tauri-drag-region>
			<!-- Status is app-wide: any surface can post a message here. -->
			<span class="msg text-sm {app.kind}">{app.msg}</span>
		</div>
		<!-- CONDITIONAL: the active surface's toolbar, resolved from the registry.
			 A surface with no toolbar contributes nothing to the header. -->
		<div class="row ycenter gap-sm">
			{#if current?.toolbar}
				{@const Toolbar = current.toolbar}
				<Toolbar />
			{/if}
		</div>
	</header>
	<main class="app-main wfull">
		{#if current}
			{@const Body = current.component}
			<Body />
		{:else}
			<!-- No known surface selected: offer the full set to choose from. -->
			<div class="box wfull hfull ycenter xcenter">
				<p>Pick a surface</p>
				<div class="views big">
					{#each REGISTRY as s}
						<button onclick={() => (app.view = s.id)}>{s.label}</button>
					{/each}
				</div>
			</div>
		{/if}
	</main>
</div>

<style lang="sass">

.msg
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

</style>

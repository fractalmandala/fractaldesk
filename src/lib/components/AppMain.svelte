<script lang="ts">

	import type { Snippet } from 'svelte';
	import { slide } from 'svelte/transition';

	interface Props {
		sidebarLeft?: Snippet;
		sidebarRight?: Snippet;
		children: Snippet;
		/** Slim restore control shown when the matching rail is collapsed. */
		leftRail?: Snippet;
		rightRail?: Snippet;
		/** False omits the rail entirely (surface-owned collapse). Defaults true. */
		leftOpen?: boolean;
		rightOpen?: boolean;
		/** Inline pixel width for drag-resized rails. Null keeps stylesheet width. */
		leftWidth?: number | null;
		rightWidth?: number | null;
		/** Extra classes composed beside the canonical region classes
		 * (skin and row behavior a surface opts into from the registry). */
		leftClass?: string;
		rightClass?: string;
		mainClass?: string;
	}

	let {
		sidebarLeft,
		sidebarRight,
		children,
		leftRail,
		rightRail,
		leftOpen = true,
		rightOpen = true,
		leftWidth = null,
		rightWidth = null,
		leftClass = '',
		rightClass = '',
		mainClass = ''
	}: Props = $props()

</script>

<main class="app-main">
	{#if leftOpen}
		<aside
			class="sidebar-left {leftClass}"
			style={leftWidth ? `width: ${leftWidth}px` : undefined}
			transition:slide={{ axis: 'x', duration: 200 }}
		>
			{@render sidebarLeft?.()}
		</aside>
	{:else}
		{@render leftRail?.()}
	{/if}
	<section class="main-section {mainClass}">
		{@render children()}
	</section>
	{#if rightOpen}
		<aside
			class="sidebar-right {rightClass}"
			style={rightWidth ? `width: ${rightWidth}px` : undefined}
			transition:slide={{ axis: 'x', duration: 200 }}
		>
			{@render sidebarRight?.()}
		</aside>
	{:else}
		{@render rightRail?.()}
	{/if}
</main>

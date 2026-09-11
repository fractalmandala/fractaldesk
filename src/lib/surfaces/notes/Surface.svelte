<script lang="ts">
	import { slide } from 'svelte/transition';
	import AppMain from '$lib/components/AppMain.svelte';
	import EditorPane from './EditorPane.svelte';
	import FolderTree from './FolderTree.svelte';
	import InfoSidebar from './InfoSidebar.svelte';
	import NoteList from './NoteList.svelte';
	import { notes, persistLayout } from './state.svelte.js';

	let resizing = $state<'left' | 'right' | 'list' | null>(null)

	const LIMITS = { min: 200, max: 480 }

	function startResize(which: 'left' | 'right' | 'list', event: PointerEvent): void {
		event.preventDefault()
		resizing = which
		const handle = event.currentTarget as HTMLElement
		handle.setPointerCapture(event.pointerId)
		document.documentElement.style.cursor = 'col-resize'
		document.documentElement.style.userSelect = 'none'
	}

	function onMove(event: PointerEvent): void {
		if (!resizing) return
		const box = (event.currentTarget as HTMLElement).parentElement
		if (!box) return
		const rect = box.getBoundingClientRect()
		const w =
			resizing === 'right'
				? rect.right - event.clientX
				: event.clientX - rect.left
		const clamped = Math.min(LIMITS.max, Math.max(LIMITS.min, w))
		if (resizing === 'left') notes.layout.leftW = clamped
		else if (resizing === 'right') notes.layout.rightW = clamped
		else notes.layout.listW = clamped
	}

	function endResize(event: PointerEvent): void {
		resizing = null
		document.documentElement.style.cursor = ''
		document.documentElement.style.userSelect = ''
		try {
			const handle = event.currentTarget as HTMLElement
			handle.releasePointerCapture(event.pointerId)
		} catch {
			// Capture already released.
		}
		persistLayout()
	}
</script>

<AppMain
	leftOpen={!notes.layout.leftCollapsed}
	rightOpen={!notes.layout.rightCollapsed}
	leftWidth={notes.layout.leftW}
	rightWidth={notes.layout.rightW}
	leftClass="surface border-right relative"
	rightClass="surface border-left relative"
	mainClass="row grow min0 gap-sm pad-sm bg"
>
	{#snippet sidebarLeft()}
		<FolderTree />
		<div
			class="resize-handle right absolute hfull w-4"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize folders"
			onpointerdown={(e) => startResize('left', e)}
			onpointermove={onMove}
			onpointerup={endResize}
			onpointercancel={endResize}
		></div>
	{/snippet}
	{#if !notes.layout.listCollapsed}
		<div
			class="box shrink-0 min0 relative"
			style="width: {notes.layout.listW}px"
			transition:slide={{ axis: 'x', duration: 200 }}
		>
			<NoteList />
			<div
				class="resize-handle right absolute hfull w-4"
				role="separator"
				aria-orientation="vertical"
				aria-label="Resize note list"
				onpointerdown={(e) => startResize('list', e)}
				onpointermove={onMove}
				onpointerup={endResize}
				onpointercancel={endResize}
			></div>
		</div>
	{/if}
	<div class="box grow min0">
		<EditorPane />
	</div>
	{#snippet sidebarRight()}
		<div
			class="resize-handle left absolute hfull w-4"
			role="separator"
			aria-orientation="vertical"
			aria-label="Resize details"
			onpointerdown={(e) => startResize('right', e)}
			onpointermove={onMove}
			onpointerup={endResize}
			onpointercancel={endResize}
		></div>
		<InfoSidebar />
	{/snippet}
</AppMain>

<style lang="sass">
// Only what the registry cannot say: absolute offsets and pointer affordances
// for the drag handles. Everything else rides composed classes.
.resize-handle
	top: 0
	cursor: col-resize
	touch-action: none
	z-index: 5

.resize-handle.right
	right: 0

.resize-handle.left
	left: 0
</style>

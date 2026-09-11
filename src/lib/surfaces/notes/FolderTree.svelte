<script lang="ts">
	import {
		addFolders,
		canPaste,
		copyEntries,
		copyPath,
		createFolder,
		createNote,
		deleteEntry,
		importFilesHere,
		importFolderHere,
		notes,
		openNote,
		pasteInto,
		removeRoot,
		renameEntry,
		revealInFinder
	} from './state.svelte.js'
	import { buildTree, type TreeNode } from './tree.js'

	interface Row {
		node: TreeNode
		depth: number
	}

	const trees = $derived(new Map(notes.roots.map((r) => [r, buildTree(r, notes.entries)])))

	function flatten(nodes: TreeNode[], depth: number, out: Row[]): Row[] {
		for (const node of nodes) {
			out.push({ node, depth })
			if (node.is_dir && notes.expanded[node.path]) flatten(node.children, depth + 1, out)
		}
		return out
	}

	function shortRoot(path: string): string {
		return path.split('/').pop() ?? path
	}

	function toggleDir(node: TreeNode): void {
		notes.expanded[node.path] = !notes.expanded[node.path]
		notes.selectedDir = node.path
	}

	function activate(node: TreeNode): void {
		if (node.is_dir) {
			toggleDir(node)
			return
		}
		if (!node.is_markdown) return
		notes.selectedDir = node.path.slice(0, node.path.lastIndexOf('/'))
		void openNote(node.path)
	}

	function onRowKey(node: TreeNode, event: KeyboardEvent): void {
		if (!node.is_dir) return
		if (event.key === 'ArrowRight') notes.expanded[node.path] = true
		if (event.key === 'ArrowLeft') notes.expanded[node.path] = false
	}

	function newNoteHere(): void {
		const dir =
			notes.selectedDir && notes.entries.some((e) => e.path === notes.selectedDir && e.is_dir)
				? notes.selectedDir
				: (notes.roots[0] ?? '')
		if (dir) void createNote(dir)
	}

	// Context menu (product invariant 15).
	let menu = $state<{ x: number; y: number; path: string; isDir: boolean; root: string } | null>(
		null
	)

	function openMenu(event: MouseEvent, node: TreeNode): void {
		event.preventDefault()
		menu = { x: event.clientX, y: event.clientY, path: node.path, isDir: node.is_dir, root: node.root }
	}

	function closeMenu(): void {
		menu = null
	}

	async function doRename(): Promise<void> {
		const target = menu
		if (!target) return
		const current = target.path.split('/').pop() ?? ''
		const name = prompt('Rename to:', current)
		closeMenu()
		if (!name || name === current || name.includes('/')) return
		await renameEntry(target.path, name)
	}

	function menuDir(): string {
		if (!menu) return ''
		return menu.isDir ? menu.path : menu.path.slice(0, menu.path.lastIndexOf('/'))
	}
</script>

<svelte:window onclick={closeMenu} onkeydown={(e) => e.key === 'Escape' && closeMenu()} />

<div class="tree-head">
	<span>Folders</span>
	<div class="head-actions">
		<button class="btn" disabled={!notes.roots.length} onclick={newNoteHere}>+ Note</button>
		<button class="btn" onclick={addFolders}>+ Add</button>
	</div>
</div>

{#if !notes.roots.length}
	<div class="empty">
		<p>No folders yet.</p>
		<button class="btn primary" onclick={addFolders}>Add folders</button>
	</div>
{:else}
	{#each notes.roots as root (root)}
		<div class="root">
			<div class="root-row">
				<button
					class="root-toggle"
					aria-expanded={notes.expanded[root] ?? true}
					onclick={() => (notes.expanded[root] = !(notes.expanded[root] ?? true))}
					oncontextmenu={(e) => {
						e.preventDefault()
						menu = { x: e.clientX, y: e.clientY, path: root, isDir: true, root }
					}}
				>
					<span class="caret">{(notes.expanded[root] ?? true) ? '▾' : '▸'}</span>
					<span class="root-name">{shortRoot(root)}</span>
				</button>
				<button
					class="mini"
					title="Remove this folder from the list (files stay on disk)"
					onclick={() => removeRoot(root)}>×</button
				>
			</div>
			{#if notes.expanded[root] ?? true}
				{@const rows = flatten(trees.get(root) ?? [], 0, [])}
				{#each rows as { node, depth } (node.path)}
					<button
						class="row"
						class:sel={node.path === notes.activePath || node.path === notes.selectedDir}
						class:grey={!node.is_dir && !node.is_markdown}
						style="padding-left: {8 + depth * 14}px"
						onclick={() => activate(node)}
						onkeydown={(e) => onRowKey(node, e)}
						oncontextmenu={(e) => openMenu(e, node)}
					>
						<span class="glyph">{node.is_dir ? (notes.expanded[node.path] ? '▾' : '▸') : '○'}</span>
						<span class="name">{node.name}</span>
					</button>
				{/each}
			{/if}
		</div>
	{/each}
	{#each notes.rootErrors as err (err.root)}
		<div class="root-error">
			<span>{shortRoot(err.root)} — {err.message}</span>
			<div>
				<button class="mini" onclick={() => removeRoot(err.root)}>Remove</button>
			</div>
		</div>
	{/each}
{/if}

{#if menu}
	{@const dir = menuDir()}
	<div class="menu" style="left: {menu.x}px; top: {menu.y}px" role="menu">
		<button onclick={() => (copyEntries([menu!.path], 'copy'), closeMenu())}>Copy</button>
		<button onclick={() => (copyEntries([menu!.path], 'cut'), closeMenu())}>Cut</button>
		<button disabled={!canPaste()} onclick={() => (pasteInto(dir), closeMenu())}>Paste</button>
		<button onclick={() => void doRename()}>Rename</button>
		<button onclick={() => (deleteEntry(menu!.path), closeMenu())}>Delete</button>
		<button onclick={() => (createNote(dir), closeMenu())}>Add file</button>
		<button onclick={() => (createFolder(dir), closeMenu())}>Add folder</button>
		<button onclick={() => (importFilesHere(dir), closeMenu())}>Import files here</button>
		<button onclick={() => (importFolderHere(dir), closeMenu())}>Import folder here</button>
		<button onclick={() => (revealInFinder(menu!.path), closeMenu())}>Show in finder</button>
		<button onclick={() => (copyPath(menu!.path, true), closeMenu())}>Copy relative path</button>
		<button onclick={() => (copyPath(menu!.path, false), closeMenu())}>Copy absolute path</button>
	</div>
{/if}

<style lang="sass">
.tree-head
	display: flex
	align-items: center
	justify-content: space-between
	padding: var(--space-sm) var(--space-sm) var(--space-xs)
	font-size: var(--text-sm)
	color: var(--text-secondary)

.empty
	padding: var(--space-lg) var(--space-sm)
	display: flex
	flex-direction: column
	gap: var(--space-sm)
	color: var(--text-secondary)
	font-size: var(--text-sm)

.root-row
	display: flex
	align-items: center

.root-toggle
	flex: 1
	min-width: 0
	display: flex
	align-items: center
	gap: 6px
	background: none
	border: 0
	color: var(--text-primary)
	font-size: var(--text-sm)
	padding: var(--space-xs) var(--space-sm)
	cursor: pointer
	text-align: left

.root-name
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap
	font-weight: 600

.caret, .glyph
	color: var(--text-muted)
	font-size: var(--text-xs)
	flex: none

.mini
	background: none
	border: 0
	color: var(--text-muted)
	cursor: pointer
	padding: 2px 8px
	font-size: var(--text-sm)
	&:hover
		color: var(--danger)

.row
	width: 100%
	display: flex
	align-items: center
	gap: 6px
	background: none
	border: 0
	color: var(--text-primary)
	font-size: var(--text-sm)
	font-family: var(--font-mono)
	padding-top: 3px
	padding-bottom: 3px
	padding-right: var(--space-sm)
	cursor: pointer
	text-align: left
	&:hover
		background: var(--state-hover)
	&.sel
		background: var(--state-selected)
	&.grey
		color: var(--text-muted)

.name
	overflow: hidden
	text-overflow: ellipsis
	white-space: nowrap

.root-error
	margin: var(--space-sm)
	padding: var(--space-sm)
	border: 1px solid var(--danger)
	border-radius: var(--radius-4)
	font-size: var(--text-xs)
	color: var(--text-secondary)
	display: flex
	flex-direction: column
	gap: var(--space-xs)

.menu
	position: fixed
	z-index: var(--z-modal)
	min-width: 190px
	background: var(--bg-popover)
	border: 1px solid var(--border-strong)
	border-radius: var(--radius-6)
	padding: 4px
	box-shadow: var(--shadow-md)
	display: flex
	flex-direction: column

.menu button
	background: none
	border: 0
	text-align: left
	padding: 6px 10px
	font-size: var(--text-sm)
	color: var(--text-primary)
	border-radius: var(--radius-4)
	cursor: pointer
	&:hover:not(:disabled)
		background: var(--state-hover)
	&:disabled
		color: var(--text-muted)
		cursor: default
</style>

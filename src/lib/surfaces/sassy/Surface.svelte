<script lang="ts">
	import { sassy } from './state.svelte.js'

	// Direction + input/output live in shared state; the header drives conversion.
	const direction = $derived(sassy.direction)
	const fromLabel = $derived(direction === 'sass2css' ? 'SASS' : 'CSS')
	const toLabel = $derived(direction === 'sass2css' ? 'CSS' : 'SASS')

	// Line-number gutters, scroll-synced to their textareas (white-space:pre keeps
	// the 1:1 line mapping).
	let inputEl = $state<HTMLTextAreaElement>()
	let inputGut = $state<HTMLDivElement>()
	let outputEl = $state<HTMLTextAreaElement>()
	let outputGut = $state<HTMLDivElement>()
	const inputNos = $derived(rows(sassy.input))
	const outputNos = $derived(rows(sassy.output))
	function rows(text: string): number[] {
		const n = Math.max(1, text.split('\n').length)
		return Array.from({ length: n }, (_, i) => i + 1)
	}
	function syncScroll(gut: HTMLElement | undefined, el: HTMLElement) {
		if (gut) gut.scrollTop = el.scrollTop
	}

	// Changing direction invalidates the current output.
	$effect(() => {
		void sassy.direction
		sassy.output = ''
		sassy.error = ''
	})
</script>

<div class="convert">
	<div class="panes">
		<div class="pane">
			<div class="phd"><span>{fromLabel} input</span></div>
			<div class="editor">
				<div class="gutter" bind:this={inputGut}>{inputNos.join('\n')}</div>
				<textarea
					bind:this={inputEl}
					bind:value={sassy.input}
					onscroll={() => syncScroll(inputGut, inputEl!)}
					spellcheck="false"
					placeholder={direction === 'sass2css'
						? '.card\n\tcolor: $ink\n\t&:hover\n\t\tcolor: red'
						: '.card {\n  color: #222;\n}'}
				></textarea>
			</div>
		</div>

		<div class="pane">
			<div class="phd"><span>{toLabel} output</span></div>
			{#if sassy.error}
				<pre class="err">{sassy.error}</pre>
			{:else}
				<div class="editor">
					<div class="gutter" bind:this={outputGut}>{outputNos.join('\n')}</div>
					<textarea
						bind:this={outputEl}
						readonly
						value={sassy.output}
						onscroll={() => syncScroll(outputGut, outputEl!)}
						spellcheck="false"
						placeholder="output appears here"
					></textarea>
				</div>
			{/if}
		</div>
	</div>

	{#if sassy.report}
		<div class="report">
			<pre>{sassy.report}</pre>
			<button class="x" title="dismiss" onclick={() => (sassy.report = '')}>×</button>
		</div>
	{/if}
</div>

<style lang="sass">
.convert
	display: flex
	flex-direction: column
	height: 100%
	min-height: 0

.panes
	flex: 1
	min-height: 0
	display: grid
	grid-template-columns: 1fr 1fr
	gap: 14px
	padding: 14px

.pane
	display: flex
	flex-direction: column
	min-height: 0
	min-width: 0

.phd
	display: flex
	align-items: center
	justify-content: space-between
	gap: 10px
	margin-bottom: 7px
	min-height: 26px
	span
		font-family: var(--mono)
		font-size: var(--text-xs)
		letter-spacing: .12em
		text-transform: uppercase
		color: var(--muted)

// A code area is a line-number gutter + a textarea sharing one bordered box.
// Both use the same font metrics and vertical padding so rows line up, and the
// gutter's scrollTop is synced to the textarea (white-space:pre → no wrap → 1:1).
.editor
	flex: 1
	min-height: 0
	display: flex
	background: var(--sunk)
	border: 1px solid var(--rule)
	border-radius: 4px
	overflow: hidden
	&:focus-within
		border-color: var(--signal)

.gutter
	flex: 0 0 auto
	overflow: hidden
	padding: 12px 8px 12px 12px
	border-right: 1px solid var(--rule)
	font-family: var(--mono)
	font-size: var(--text-sm)
	color: var(--muted)
	text-align: right
	white-space: pre
	user-select: none

textarea
	flex: 1
	min-width: 0
	min-height: 0
	resize: none
	background: transparent
	border: 0
	padding: 12px 14px
	font-family: var(--mono)
	font-size: var(--text-sm)
	color: var(--ink-2)
	tab-size: 2
	white-space: pre
	overflow: auto
	&:focus
		outline: none
	&[readonly]
		color: var(--ink)

// On a failed paste conversion the full compiler error shows here instead of the
// truncated header toast.
.err
	flex: 1
	min-height: 0
	margin: 0
	background: #e2685f14
	border: 1px solid var(--bad)
	border-radius: 4px
	padding: 12px 14px
	font-family: var(--mono)
	font-size: var(--text-sm)
	color: var(--bad)
	white-space: pre-wrap
	overflow: auto

// The "On disk" result summary — a slim dismissable strip under the panes.
.report
	display: flex
	align-items: flex-start
	gap: 10px
	padding: 8px 14px 12px
	border-top: 1px solid var(--rule)
	pre
		flex: 1
		margin: 0
		font-family: var(--mono)
		font-size: var(--text-sm)
		color: var(--ink-2)
		white-space: pre-wrap
		max-height: 22vh
		overflow: auto
	.x
		background: none
		border: 0
		color: var(--muted)
		cursor: pointer
		font-size: var(--text-bs)
		padding: 2px 4px
		&:hover
			color: var(--signal)
</style>

<script lang="ts">
	import { sassy } from './state.svelte.js'
	import { runPaste, copyOutput } from './paste.js'
	import { runOnDisk } from './disk.js'
</script>

<div class="chips" role="group" aria-label="Direction">
	<button class="chip" class:on={sassy.direction === 'sass2css'} onclick={() => (sassy.direction = 'sass2css')}>SASS → CSS</button>
	<button class="chip" class:on={sassy.direction === 'css2sass'} onclick={() => (sassy.direction = 'css2sass')}>CSS → SASS</button>
</div>
<button class="btn primary" onclick={runPaste} disabled={sassy.busy || !sassy.input.trim()}>Convert →</button>
<button class="btn" onclick={copyOutput} disabled={!sassy.output}>{sassy.copied ? 'Copied' : 'Copy'}</button>
<button class="btn" onclick={runOnDisk} disabled={sassy.busy}>On disk…</button>

<style lang="sass">
.chips
	display: flex
	gap: 4px
	.chip
		appearance: none
		background: transparent
		border: 1px solid var(--rule)
		border-radius: 2px
		color: var(--muted)
		cursor: pointer
		font-family: var(--mono)
		font-size: var(--text-xs)
		letter-spacing: .05em
		text-transform: uppercase
		padding: 4px 8px
		white-space: nowrap
		&:hover
			color: var(--ink)
		&.on
			background: var(--signal)
			border-color: var(--signal)
			color: #fff
</style>

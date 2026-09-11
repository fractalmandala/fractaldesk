<script lang="ts">
	import ArgvTree from './ArgvTree.svelte'
	import ArgvEditor from './ArgvEditor.svelte'
	import ArgvOutput from './ArgvOutput.svelte'
	import { argv, loadSpec } from './state.svelte'

	// The spec lives in the app's data folder — it is your work, not this project's.
	$effect(() => {
		loadSpec()
	})
</script>

<div class="bench">

	<div class="cols">
		<div class="col tree"><ArgvTree spec={argv.spec} bind:sel={argv.sel} /></div>
		<div class="col mid"><ArgvEditor spec={argv.spec} sel={argv.sel} /></div>
		<div class="col out"><ArgvOutput spec={argv.spec} sel={argv.sel} /></div>
	</div>
</div>

<style lang="sass">
.bench
	display: flex
	flex-direction: column
	height: 100%
	min-height: 0

.cols
	display: grid
	grid-template-columns: 210px minmax(0, 1fr) minmax(0, 460px)
	flex: 1
	min-height: 0
	@media (max-width: 1240px)
		grid-template-columns: 190px minmax(0, 1fr)

.col
	display: flex
	flex-direction: column
	min-width: 0
	min-height: 0
	& + &
		border-left: 1px solid var(--rule)

.col.tree
	background: var(--sunk)

.col.out
	@media (max-width: 1240px)
		display: none
</style>

<script lang="ts">
	import { argv, usage, reset, saveSpec } from './state.svelte'
</script>

<div class="usage">
	{#each usage() as p}<span class={p.t}>{p.v}</span>{' '}{/each}
</div>
<button class="btn" onclick={reset}>Reset</button>
<button class="btn primary" disabled={argv.saving} onclick={saveSpec}>{argv.saving ? 'Saving…' : 'Save spec'}</button>

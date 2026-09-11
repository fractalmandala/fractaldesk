<script lang="ts">
	import { untw, runConvert, copyText } from './state.svelte.js'
	import { summaryText } from './decode.js'
	import { say } from '../../store.svelte.js'
</script>

<button class="btn primary" onclick={runConvert} disabled={untw.busy || !untw.input.trim()}>{untw.busy ? 'Working…' : 'Convert →'}</button>
<button class="btn" onclick={() => untw.result && copyText(summaryText(untw.result), 'summary', say)} disabled={!untw.result}>{untw.copied === 'summary' ? 'Copied' : 'Copy summary'}</button>
<button class="btn" onclick={() => untw.result && copyText(JSON.stringify(untw.result.tokens, null, 2), 'json', say)} disabled={!untw.result}>{untw.copied === 'json' ? 'Copied' : 'Copy JSON'}</button>

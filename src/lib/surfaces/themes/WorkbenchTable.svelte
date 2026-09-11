<script>
	import ColorCell from '$lib/ColorCell.svelte'
	import { themes, eff } from './state.svelte.js'

	let { entry } = $props()

	const modes = $derived([
		['light', themes.doc.meta.lightPrefix],
		['dark', themes.doc.meta.darkPrefix]
	])

	function pin(kind, key, v) {
		entry[kind].ui ??= {}
		entry[kind].ui[key] = v
		themes.dirty = true
	}

	function clear(kind, key) {
		const ui = entry[kind].ui
		if (!ui) return
		delete ui[key]
		if (!Object.keys(ui).length) delete entry[kind].ui
		themes.dirty = true
	}
</script>

<table class="roles">
	<thead>
		<tr><th>surface</th>{#each modes as [, label]}<th>{label}</th>{/each}</tr>
	</thead>
	<tbody>
		{#each themes.schema.ui as u, i}
			{#if i === 0 || themes.schema.ui[i - 1].group !== u.group}
				<tr><td colspan="3" class="wbgrp">{u.group}</td></tr>
			{/if}
			<tr>
				<td class="rl">{u.label}<code>{u.key}</code></td>
				{#each modes as [kind]}
					<td>
						<ColorCell
							value={eff(entry[kind], u.key, u.from)}
							inherited={entry[kind].ui?.[u.key] === undefined}
							against={entry[kind].bg}
							palette={entry[kind]}
							onset={(v) => pin(kind, u.key, v)}
							onclear={() => clear(kind, u.key)} />
					</td>
				{/each}
			</tr>
		{/each}
	</tbody>
</table>

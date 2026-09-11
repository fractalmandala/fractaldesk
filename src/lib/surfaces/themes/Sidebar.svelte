<script>
	import { themes } from './state.svelte.js';

	let { onnew, onduplicate, ondelete } = $props();

	const grouped = $derived(
		Object.entries(themes.doc.families)
			.map(([id, fam]) => ({
				id,
				label: fam.label,
				items: themes.doc.themes
					.map((t, i) => ({ t, i }))
					.filter(({ t }) => t.family === id)
			}))
			.filter((g) => g.items.length)
	);
</script>

<div class="box gap-bs pad-sm border-right hfull">
	{#each grouped as g}
		<div class="box gap-sm">
		<div class="text-theme tt-u text-sm">{g.label} | {g.items.length}</div>
		{#each g.items as { t, i }}
			<div class="box gap-sm">
				<button
					class="row button ghost ta-l gap-sm xleft"
					class:on={i === themes.cur}
					onclick={() => (themes.cur = i)}
				>
					<span class="pair row ta-l">
						<i style="background:{t.light.bg}"></i>
						<i style="background:{t.dark.bg}"></i>
					</span>
					<span style="color: {t.light.accent}">{t.name}</span>
				</button>
			</div>
		{/each}
		</div>
	{/each}
	<div class="acts">
		<button class="btn" onclick={onnew}>New</button>
		<button class="btn" onclick={onduplicate}>Dupe</button>
		<button class="btn" onclick={ondelete}>Delete</button>
	</div>
</div>

<style lang="sass">

.pair
	i
		width: 16px
		height: 16px
		border-radius: 2px
		border: 1px solid #ffffff22
		display: block

</style>

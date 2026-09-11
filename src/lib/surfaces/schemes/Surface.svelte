<script lang="ts">
	import Mock from '$lib/Mock.svelte'
	import ColorCell from '$lib/ColorCell.svelte'
	// The pair form renders the palette document's shared domain metadata — the
	// family options, the light/dark prefixes, and the role list — through the
	// read-only projection in $lib/palette-meta.js, so this surface imports no
	// other surface's state module. The WRITE path is fully bussed — see
	// saveAsNew(); the event name and payload shape come from the shared
	// contract in events.js and are compile-checked on both sides.
	import { families, prefixes, roles } from '$lib/palette-meta.js'
	import { schemes } from './state.svelte.js'
	import { toPalette, toSemantic, partnerFor, sourceFor } from './mapping.js'
	import type { Scheme } from './mapping.js'
	import { ratio, grade } from '$lib/color.js'
	import { emit } from '../../bus.js'
	import { IMPORT_PAIR } from '../../events.js'
	import type { ImportPairPayload } from '../../events.js'

	let query = $state('')
	let system = $state('all')
	let variant = $state('all')
	let selectedId = $state('')
	let editing = $state('light') // which slot the role table edits
	let name = $state('')
	let family = $state('')

	// A slot holds the chosen scheme plus a working copy of its mapped palette,
	// so edits here never touch the scheme on disk. Keyed by string because the
	// markup addresses slots dynamically (the editing tab, the kind loop).
	type Slot = { scheme: Scheme; palette: Record<string, string> }
	let slots = $state<Record<string, Slot | null>>({ light: null, dark: null })

	const list = $derived(
		schemes.list.filter((s) => {
			if (system !== 'all' && s.system !== system) return false
			if (variant !== 'all' && s.variant !== variant) return false
			if (!query.trim()) return true
			const q = query.trim().toLowerCase()
			return s.name.toLowerCase().includes(q) || s.id.includes(q) || s.author.toLowerCase().includes(q)
		})
	)
	const selected = $derived(schemes.list.find((s) => s.uid === selectedId) ?? null)
	const partner = $derived(selected ? partnerFor(selected, schemes.list) : null)
	const ready = $derived(!!slots.light && !!slots.dark && name.trim().length > 0)

	function strip(s: Scheme) {
		const p = s.palette
		return s.system === 'tinted8'
			? [p.black, p.red, p.green, p.yellow, p.blue, p.magenta, p.cyan, p.white]
			: ['base00', 'base05', 'base08', 'base09', 'base0A', 'base0B', 'base0D', 'base0E'].map((k) => p[k])
	}

	function assign(kind: 'light' | 'dark', scheme: Scheme) {
		if (!scheme) return
		slots[kind] = { scheme, palette: toPalette(scheme) }
		if (!name.trim()) name = scheme.name.replace(/\s+(light|dark)$/i, '')
		editing = kind
	}

	function pairUp() {
		if (!selected) return
		const light = selected.variant === 'light' ? selected : partner
		const dark = selected.variant === 'light' ? partner : selected
		assign('light', light)
		assign('dark', dark)
	}

	function saveAsNew() {
		// Cross-surface command (P13, P18–P20): everything this surface can
		// compute from its own data goes into the payload; the Themes state
		// module owns the document write — name dedup, family fallback, push,
		// selection, dirty flag, view switch, and the toast. No state of that
		// surface is written here. The generic parameter compile-checks the
		// payload against the shared ImportPairPayload contract (events.js).
		emit<ImportPairPayload>(IMPORT_PAIR, {
			name,
			family,
			tag: `${slots.light!.scheme.system} import`,
			thesis: `Imported from ${slots.light!.scheme.name} and ${slots.dark!.scheme.name}.`,
			light: { ...slots.light!.palette },
			dark: { ...slots.dark!.palette },
			semantic: {
				light: toSemantic(slots.light!.scheme),
				dark: toSemantic(slots.dark!.scheme)
			}
		})
	}

	function cr(p: Record<string, string>) {
		const f = ratio(p.bg, p.fg)
		return { v: f.toFixed(2), g: grade(f), pass: f >= 4.5 }
	}

	// Default the family select to the first family once the document loads.
	$effect(() => {
		const first = Object.keys(families())[0]
		if (!family && first) family = first
	})
</script>

<div class="browser">
	<aside>
		<div class="filters">
			<input class="q" placeholder="Search {schemes.list.length} schemes…" bind:value={query} spellcheck="false" />
			<div class="chips">
				{#each ['all', 'base16', 'base24', 'tinted8'] as s}
					<button class="chip" class:on={system === s} onclick={() => (system = s)}>{s}</button>
				{/each}
			</div>
			<div class="chips">
				{#each ['all', 'light', 'dark'] as v}
					<button class="chip" class:on={variant === v} onclick={() => (variant = v)}>{v}</button>
				{/each}
			</div>
			<span class="tally">{list.length} shown</span>
		</div>
		<div class="rows">
			{#each list as s (s.uid)}
				<button class="row" class:on={s.uid === selectedId} onclick={() => (selectedId = s.uid)}>
					<span class="sw">{#each strip(s) as c}<i style="background:{c}"></i>{/each}</span>
					<span class="nm">{s.name}</span>
					<span class="vr">{s.variant[0]}</span>
				</button>
			{/each}
			{#if !list.length}<p class="none">Nothing matches.</p>{/if}
		</div>
	</aside>

	<main>
		{#if !schemes.list.length}
			<p class="none big">
				No scheme collection found. Put <code>schemes-spec-0.11</code> beside
				<code>palettes.json</code> and reopen the project.
			</p>
		{:else if !selected}
			<p class="none big">Pick a scheme to sample it.</p>
		{:else}
			<div class="head">
				<div>
					<h2>{selected.name}</h2>
					<p class="by">{selected.system} · {selected.variant}{selected.author ? ` · ${selected.author}` : ''}</p>
				</div>
				<div class="acts">
					<button class="btn" onclick={() => assign('light', selected)}>→ Daylight slot</button>
					<button class="btn" onclick={() => assign('dark', selected)}>→ Lamplight slot</button>
					{#if partner}
						<button class="btn primary" onclick={pairUp}>Pair with {partner.name}</button>
					{/if}
				</div>
			</div>

			<div class="swatches">
				{#each Object.entries<string>(selected.palette) as [k, v]}
					<div class="sq"><i style="background:{v}"></i><b>{k}</b><span>{v.toUpperCase()}</span></div>
				{/each}
			</div>
		{/if}

		<h3 class="sec">The pair — both slots must be filled to save</h3>
		<div class="slots">
			{#each [['light', prefixes().light], ['dark', prefixes().dark]] as [kind, label]}
				<div class="slot" class:empty={!slots[kind]}>
					<div class="slot-hd">
						<span class="t">{label}</span>
						{#if slots[kind]}
							{@const c = cr(slots[kind]!.palette)}
							<span class="cr">{slots[kind]!.scheme.name} · fg <b>{c.v}</b>
								<em class:no={!c.pass}>{c.g}</em></span>
							<button class="x" title="clear slot" onclick={() => (slots[kind] = null)}>×</button>
						{:else}
							<span class="cr">empty</span>
						{/if}
					</div>
					{#if slots[kind]}
						<Mock mode={slots[kind]!.palette} name={`${label} ${name || '…'}`} />
					{:else}
						<div class="drop">Send a scheme here with the buttons above.</div>
					{/if}
				</div>
			{/each}
		</div>

		{#if slots.light || slots.dark}
			<h3 class="sec">Mapped roles — edit before saving</h3>
			<div class="tabs">
				{#each [['light', prefixes().light], ['dark', prefixes().dark]] as [kind, label]}
					<button class="chip" class:on={editing === kind} disabled={!slots[kind]}
							onclick={() => (editing = kind)}>{label}</button>
				{/each}
			</div>
			{#if slots[editing]}
				{@const src = sourceFor(slots[editing]!.scheme)}
				<table class="roles">
					<thead><tr><th>role</th><th>from</th><th>colour</th></tr></thead>
					<tbody>
						{#each roles() as role}
							<tr>
								<td class="rl">{role}<small>{src[role]?.[1] ?? ''}</small></td>
								<td class="from">{src[role]?.[0] ?? '—'}</td>
								<td>
									<ColorCell
										value={slots[editing]!.palette[role]}
										contrast={role === 'bg' ? '' : ratio(slots[editing]!.palette.bg, slots[editing]!.palette[role]).toFixed(2) + ':1'}
										against={role === 'bg' ? null : slots[editing]!.palette.bg}
										palette={{ ...slots[editing]!.palette, ...slots[editing]!.scheme.palette }}
										onset={(v: string) => (slots[editing]!.palette[role] = v)} />
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}

			<div class="save">
				<label class="field">
					<span>Save as</span>
					<input bind:value={name} placeholder="new theme name" />
				</label>
				<label class="field">
					<span>Family</span>
					<select bind:value={family}>
						{#each Object.entries(families()) as [id, f]}
							<option value={id}>{f.label}</option>
						{/each}
					</select>
				</label>
				<button class="btn primary" disabled={!ready} onclick={saveAsNew}>Save as new pair</button>
			</div>
		{/if}
	</main>
</div>

<style lang="sass">
.browser
	display: grid
	grid-template-columns: 300px 1fr
	height: 100%
	min-height: 0

aside
	background: var(--sunk)
	border-right: 1px solid var(--rule)
	display: flex
	flex-direction: column
	min-height: 0

.filters
	padding: 14px
	border-bottom: 1px solid var(--rule)
	display: flex
	flex-direction: column
	gap: 8px
	.q
		background: var(--ground)
		border: 1px solid var(--rule)
		border-radius: 3px
		padding: 7px 9px
		font-size: var(--text-md)
		&:focus
			outline: none
			border-color: var(--signal)
	.tally
		font-family: var(--mono)
		font-size: var(--text-xs)
		color: var(--muted)

.chips
	display: flex
	gap: 4px
	flex-wrap: wrap

.chip
	appearance: none
	background: transparent
	border: 1px solid var(--rule)
	border-radius: 2px
	color: var(--muted)
	cursor: pointer
	font-family: var(--mono)
	font-size: var(--text-xs)
	letter-spacing: .06em
	text-transform: uppercase
	padding: 4px 8px
	&:hover:not(:disabled)
		color: var(--ink)
	&.on
		background: var(--signal)
		border-color: var(--signal)
		color: #fff
	&:disabled
		opacity: .35
		cursor: default

.rows
	overflow-y: auto
	flex: 1
	min-height: 0

.row
	display: flex
	align-items: center
	gap: 9px
	width: 100%
	padding: 6px 14px
	background: none
	border: 0
	border-left: 2px solid transparent
	cursor: pointer
	text-align: left
	&:hover
		background: #00000030
	&.on
		background: var(--surface)
		border-left-color: var(--signal)
	.nm
		flex: 1
		font-size: var(--text-sm)
		white-space: nowrap
		overflow: hidden
		text-overflow: ellipsis
	.vr
		font-family: var(--mono)
		font-size: var(--text-xs)
		color: var(--muted)
		text-transform: uppercase

.sw
	display: flex
	border-radius: 2px
	overflow: hidden
	border: 1px solid #ffffff1a
	i
		width: 7px
		height: 14px
		display: block

main
	overflow-y: auto
	padding: 22px 26px 60px
	min-height: 0

.head
	display: flex
	justify-content: space-between
	align-items: flex-start
	gap: 20px
	flex-wrap: wrap
	h2
		margin: 0
		font-size: var(--text-lg)
	.by
		margin: 4px 0 0
		font-size: var(--text-sm)
		color: var(--muted)
		font-family: var(--mono)
		max-width: 70ch
		overflow: hidden
		text-overflow: ellipsis
		white-space: nowrap

.acts
	display: flex
	gap: 8px
	flex-wrap: wrap

.swatches
	display: grid
	grid-template-columns: repeat(auto-fill, minmax(104px, 1fr))
	gap: 8px
	margin: 18px 0 6px
	.sq
		display: flex
		flex-direction: column
		gap: 4px
		i
			height: 26px
			border-radius: 2px
			border: 1px solid #ffffff1a
		b
			font-family: var(--mono)
			font-size: var(--text-xs)
			color: var(--ink-2)
			font-weight: 400
		span
			font-family: var(--mono)
			font-size: var(--text-xs)
			color: var(--muted)

.sec
	font-size: var(--text-sm)
	font-family: var(--mono)
	letter-spacing: .14em
	text-transform: uppercase
	color: var(--muted)
	margin: 30px 0 12px
	padding-bottom: 8px
	border-bottom: 1px solid var(--rule)
	font-weight: 400

.slots
	display: grid
	grid-template-columns: 1fr 1fr
	gap: 18px
	@media (max-width: 1180px)
		grid-template-columns: 1fr

.slot
	&.empty
		opacity: .8

.slot-hd
	display: flex
	align-items: baseline
	gap: 10px
	margin-bottom: 7px
	.t
		font-family: var(--mono)
		font-size: var(--text-sm)
		letter-spacing: .1em
		text-transform: uppercase
		color: var(--ink-2)
	.cr
		flex: 1
		font-family: var(--mono)
		font-size: var(--text-xs)
		color: var(--muted)
		white-space: nowrap
		overflow: hidden
		text-overflow: ellipsis
		b
			color: var(--ink)
		em
			font-style: normal
			color: var(--ok)
			&.no
				color: var(--bad)
	.x
		background: none
		border: 0
		color: var(--muted)
		cursor: pointer
		font-size: var(--text-md)
		&:hover
			color: var(--signal)

.drop
	border: 1px dashed var(--rule)
	border-radius: 4px
	padding: 40px 20px
	text-align: center
	color: var(--muted)
	font-size: var(--text-sm)

.tabs
	display: flex
	gap: 6px
	margin-bottom: 12px

td.from
	font-family: var(--mono)
	font-size: var(--text-xs)
	color: var(--muted)
	width: 130px

.save
	display: flex
	align-items: flex-end
	gap: 14px
	margin-top: 24px
	padding-top: 18px
	border-top: 1px solid var(--rule)
	flex-wrap: wrap

.field
	display: flex
	flex-direction: column
	gap: 5px
	span
		font-family: var(--mono)
		font-size: var(--text-xs)
		letter-spacing: .1em
		text-transform: uppercase
		color: var(--muted)
	input, select
		background: var(--sunk)
		border: 1px solid var(--rule)
		border-radius: 3px
		padding: 7px 9px
		font-size: var(--text-md)
		min-width: 220px
		&:focus
			outline: none
			border-color: var(--signal)

.none
	color: var(--muted)
	font-size: var(--text-sm)
	padding: 14px
	&.big
		padding: 60px 0
		text-align: center
		font-size: var(--text-md)
	code
		font-family: var(--mono)
		color: var(--ink-2)
</style>

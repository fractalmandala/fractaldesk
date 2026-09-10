<script>
  import { invoke } from '@tauri-apps/api/core'
  import { open } from '@tauri-apps/plugin-dialog'
  import { helpLines, helpText } from './argv/help.js'
  import { generatePackage } from './argv/generate.js'
  import { parseInvocation } from './argv/parse.js'
  import { byId, chain, pathOf } from './argv/spec.js'
  import { say } from './store.svelte.js'

  let { spec, sel } = $props()

  let tab = $state('help')
  let activeFile = $state(0)
  let line = $state('')
  let copied = $state('')
  let exported = $state('')

  const files = $derived(generatePackage(spec))
  const current = $derived(files[Math.min(activeFile, files.length - 1)])
  const help = $derived(helpLines(spec, sel))
  const invocation = $derived(
    [spec.pkg.bin || 'cli', ...chain(spec, sel).map((c) => c.name), '--help'].join(' ')
  )
  const result = $derived(line.trim() ? parseInvocation(spec, line) : null)
  const resolved = $derived(result ? byId(spec, result.nodeId) : null)

  // Seed the try box with a plausible call for whatever is selected.
  $effect(() => {
    const path = chain(spec, sel).map((c) => c.name)
    const node = byId(spec, sel)
    const args = (node?.args ?? []).filter((a) => a.arity === 'required').map((a) => a.name)
    line = [spec.pkg.bin || 'cli', ...path, ...args].join(' ')
  })

  async function copy(text, key) {
    try {
      await navigator.clipboard.writeText(text)
      copied = key
      setTimeout(() => (copied = ''), 1400)
    } catch {
      say('clipboard unavailable', 'bad')
    }
  }

  async function exportPackage() {
    const dir = await open({ directory: true, title: 'Write the package into…' })
    if (!dir) return
    try {
      const msg = await invoke('argv_export', { dir, files: $state.snapshot(files) })
      exported = dir
      say(msg, 'ok')
    } catch (e) {
      say(String(e), 'bad')
    }
  }
</script>

<div class="head">
  <div class="tabs" role="tablist">
    {#each [['help', '--help'], ['try', 'Try'], ['package', 'Package']] as [id, label]}
      <button class="tab" role="tab" aria-selected={tab === id} onclick={() => (tab = id)}>{label}</button>
    {/each}
  </div>
</div>

<div class="body">
  {#if tab === 'help'}
    <div class="screen">
      <div class="ln"><span class="prompt">$</span> {invocation}</div>
      <div class="ln">&nbsp;</div>
      {#each help as l}
        <div class="ln {l.c}">{l.t || '\u00a0'}</div>
      {/each}
    </div>
    <div class="acts">
      <button class="btn" onclick={() => copy(helpText(spec, sel), 'help')}>
        {copied === 'help' ? 'Copied' : 'Copy'}
      </button>
      <span class="note">Byte-identical to what compiled commander prints.</span>
    </div>

  {:else if tab === 'try'}
    <label class="tryline">
      <span class="prompt">$</span>
      <input bind:value={line} spellcheck="false" placeholder="{spec.pkg.bin || 'cli'} build src --watch" />
    </label>

    {#if !result}
      <p class="note pad">Type an invocation to see how the CLI you have designed reads it.</p>
    {:else}
      {#if result.errors.length}
        <div class="errs">
          {#each result.errors as e}<div class="err">error: {e}</div>{/each}
        </div>
      {:else if result.help}
        <div class="ok">prints help for <code>{[spec.pkg.bin, ...result.path].join(' ')}</code> and exits 0</div>
      {:else if result.version}
        <div class="ok">prints <code>{spec.pkg.version}</code> and exits 0</div>
      {:else}
        <div class="ok">runs <code>{result.path.length ? result.path.join(' ') : '(root)'}</code> — exit 0 on success</div>
      {/if}

      <div class="grid">
        <div>
          <div class="eyebrow">Resolves to</div>
          <p class="res">
            {#if result.path.length}
              <code>{[spec.pkg.bin, ...result.path].join(' ')}</code>
              {#if resolved?.desc}<span class="note"> — {resolved.desc}</span>{/if}
            {:else}
              <code>{spec.pkg.bin}</code> <span class="note">— the program itself</span>
            {/if}
          </p>
        </div>

        {#if result.args.length}
          <div>
            <div class="eyebrow">Arguments</div>
            <table>
              <tbody>
                {#each result.args as a}
                  <tr>
                    <td class="k">{a.name}</td>
                    <td class="v" class:missing={a.source === 'missing'}>
                      {a.value === undefined ? '—' : Array.isArray(a.value) ? JSON.stringify(a.value) : String(a.value)}
                    </td>
                    <td class="src">{a.source}</td>
                  </tr>
                {/each}
              </tbody>
            </table>
          </div>
        {/if}

        <div>
          <div class="eyebrow">Options in scope</div>
          <table>
            <tbody>
              {#each result.opts as o}
                <tr class:dim={o.source === 'unset'}>
                  <td class="k">--{o.flag}</td>
                  <td class="v">{o.value === undefined ? '—' : String(o.value)}</td>
                  <td class="src">{o.source}</td>
                </tr>
              {/each}
            </tbody>
          </table>
        </div>
      </div>
    {/if}

  {:else}
    <div class="filebar">
      {#each files as f, i}
        <button class="fchip" aria-pressed={i === activeFile} onclick={() => (activeFile = i)}>{f.name}</button>
      {/each}
    </div>
    <pre class="code">{current.body}</pre>
    <div class="acts">
      <button class="btn" onclick={() => copy(current.body, 'file')}>
        {copied === 'file' ? 'Copied' : 'Copy file'}
      </button>
      <button class="btn primary" onclick={exportPackage}>Write package…</button>
      {#if exported}
        <button class="btn" onclick={() => invoke('reveal', { path: exported })}>Reveal</button>
      {/if}
      <span class="note">{current.body.split('\n').length} lines · {files.length} files</span>
    </div>
  {/if}
</div>

<style lang="sass">
.head
	padding: 6px 10px
	border-bottom: 1px solid var(--rule)
	background: var(--sunk)

.tabs
	display: flex
	gap: 2px

.tab
	background: none
	border: 0
	border-bottom: 2px solid transparent
	padding: 5px 10px 6px
	cursor: pointer
	font-size: var(--text-sm)
	color: var(--muted)
	font-weight: 500
	&[aria-selected='true']
		color: var(--ink)
		border-bottom-color: var(--signal)

.body
	padding: 14px
	overflow-y: auto
	flex: 1
	min-height: 0

.screen
	background: var(--sunk)
	border: 1px solid var(--rule)
	border-radius: 4px
	font-family: var(--mono)
	font-size: var(--text-sm)
	padding: 13px 14px
	overflow-x: auto
	color: var(--ink-2)
	.ln
		white-space: pre
		&.k
			color: var(--ink)
		&.a
			color: var(--signal)
	.prompt
		color: var(--signal)

.tryline
	display: flex
	align-items: center
	gap: 8px
	background: var(--sunk)
	border: 1px solid var(--signal)
	border-radius: 4px
	padding: 9px 12px
	.prompt
		color: var(--signal)
		font-family: var(--mono)
	input
		flex: 1
		background: none
		border: 0
		font-family: var(--mono)
		font-size: var(--text-md)
		&:focus
			outline: none

.errs
	margin-top: 12px
	display: flex
	flex-direction: column
	gap: 4px

.err
	font-family: var(--mono)
	font-size: var(--text-sm)
	color: var(--bad)
	background: #e2685f14
	border-left: 2px solid var(--bad)
	padding: 6px 10px

.ok
	margin-top: 12px
	font-size: var(--text-sm)
	color: var(--ok)
	code
		font-family: var(--mono)
		color: var(--ink)

.grid
	display: flex
	flex-direction: column
	gap: 18px
	margin-top: 18px

.eyebrow
	font-size: var(--text-xs)
	letter-spacing: .13em
	text-transform: uppercase
	color: var(--muted)
	font-weight: 600
	margin-bottom: 6px

.res
	margin: 0
	font-size: var(--text-sm)
	code
		font-family: var(--mono)
		color: var(--ink)

table
	width: 100%
	border-collapse: collapse
	tr.dim
		opacity: .45
	td
		padding: 3px 8px 3px 0
		border-top: 1px solid #ffffff0d
		font-size: var(--text-sm)
	.k
		font-family: var(--mono)
		color: var(--ink-2)
		width: 40%
	.v
		font-family: var(--mono)
		color: var(--ink)
		&.missing
			color: var(--bad)
	.src
		font-size: var(--text-xs)
		color: var(--muted)
		text-align: right
		font-family: var(--mono)

.filebar
	display: flex
	flex-wrap: wrap
	gap: 5px
	margin-bottom: 11px

.fchip
	font-family: var(--mono)
	font-size: var(--text-sm)
	padding: 3px 8px
	border-radius: 999px
	cursor: pointer
	border: 1px solid var(--rule)
	background: none
	color: var(--muted)
	&[aria-pressed='true']
		border-color: var(--signal)
		color: var(--signal)

.code
	background: var(--sunk)
	border: 1px solid var(--rule)
	border-radius: 4px
	font-family: var(--mono)
	font-size: var(--text-sm)
	line-height: 1.1
	padding: 12px 14px
	overflow: auto
	white-space: pre
	max-height: 60vh
	color: var(--ink-2)
	margin: 0

.acts
	display: flex
	gap: 8px
	align-items: center
	margin-top: 10px

.note
	font-size: var(--text-sm)
	color: var(--muted)
	&.pad
		display: block
		margin-top: 14px
</style>
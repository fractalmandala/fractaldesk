<script lang="ts">
	import { onMount } from 'svelte'
	import { Compartment, EditorState } from '@codemirror/state'
	import {
		EditorView,
		drawSelection,
		highlightSpecialChars,
		keymap,
		lineNumbers
	} from '@codemirror/view'
	import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
	import { markdown } from '@codemirror/lang-markdown'
	import { defaultHighlightStyle, syntaxHighlighting } from '@codemirror/language'
	import { highlightSelectionMatches } from '@codemirror/search'

	interface Props {
		value: string
		readonly?: boolean
		onChange?: (next: string) => void
	}

	let { value, readonly = false, onChange }: Props = $props()

	let host: HTMLDivElement
	let view: EditorView | null = null
	const editableCompartment = new Compartment()

	const houseTheme = EditorView.theme(
		{
			'&': {
				backgroundColor: 'var(--bg)',
				color: 'var(--text-primary)',
				fontFamily: 'var(--font-mono)',
				fontSize: 'var(--text-sm)',
				height: '100%'
			},
			'.cm-content': { caretColor: 'var(--theme-color)' },
			'.cm-cursor': { borderLeftColor: 'var(--theme-color)' },
			'&.cm-focused': { outline: 'none' },
			'.cm-selectionBackground, ::selection': { backgroundColor: 'var(--state-selected)' },
			'.cm-gutters': {
				backgroundColor: 'transparent',
				color: 'var(--text-muted)',
				border: 'none'
			}
		},
		{ dark: false }
	)

	function mount(): void {
		const state = EditorState.create({
			doc: value,
			extensions: [
				history(),
				drawSelection(),
				highlightSpecialChars(),
				lineNumbers(),
				EditorView.lineWrapping,
				markdown(),
				syntaxHighlighting(defaultHighlightStyle),
				highlightSelectionMatches(),
				keymap.of([indentWithTab, ...defaultKeymap, ...historyKeymap]),
				editableCompartment.of(EditorView.editable.of(!readonly)),
				houseTheme,
				EditorView.updateListener.of((update) => {
					if (update.docChanged) onChange?.(update.state.doc.toString())
				})
			]
		})
		view = new EditorView({ state, parent: host })
	}

	onMount(() => {
		mount()
		return () => {
			view?.destroy()
			view = null
		}
	})

	// External value (file switch, watcher refresh): replace whole doc.
	// Typing echo is a no-op because the strings compare equal.
	$effect(() => {
		const next = value
		if (view && next !== view.state.doc.toString()) {
			view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: next } })
		}
	})

	$effect(() => {
		view?.dispatch({
			effects: editableCompartment.reconfigure(EditorView.editable.of(!readonly))
		})
	})

	/** Select 1-based lines (from file:// #L10-L17) and scroll them into view. */
	export function gotoRange(start: number, end: number): void {
		if (!view) return
		const last = view.state.doc.lines
		const s = Math.min(Math.max(1, start), last)
		const e = Math.min(Math.max(s, end), last)
		const from = view.state.doc.line(s).from
		const to = view.state.doc.line(e).to
		view.dispatch({ selection: { anchor: from, head: to }, scrollIntoView: true })
		view.focus()
	}

	/** Insert snippet at cursor (rich-toolbar parity for the raw view). */
	export function insertSyntax(snippet: string): void {
		if (!view) return
		const { from, to } = view.state.selection.main
		view.dispatch({ changes: { from, to, insert: snippet }, scrollIntoView: true })
		view.focus()
	}

	/** Wrap the selection (or cursor point) in before/after markers. */
	export function wrapSelection(before: string, after: string): void {
		if (!view) return
		const { from, to } = view.state.selection.main
		const selected = view.state.sliceDoc(from, to)
		view.dispatch({
			changes: { from, to, insert: before + selected + after },
			selection: { anchor: from + before.length, head: to + before.length },
			scrollIntoView: true
		})
		view.focus()
	}
</script>

<div bind:this={host} class="raw-host"></div>

<style lang="sass">
.raw-host
	display: flex
	flex: 1
	min-width: 0
	min-height: 0
	overflow: hidden
	background: var(--bg)

.raw-host :global(.cm-editor)
	flex: 1
	min-width: 0
	overflow: hidden

.raw-host :global(.cm-scroller)
	overflow: auto
</style>

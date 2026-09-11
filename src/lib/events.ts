// Shared event contract for the cross-surface bus (P18–P20). The event name
// and its payload are declared exactly once here so the producer and the
// consumer are compile-checked against each other — a rename or field drift
// fails at build time instead of silently at runtime. The bus mechanics
// (on/emit) live in bus.ts and know nothing about specific events.

/**
 * Emitted by the Schemes surface when the user saves an imported pair;
 * consumed by the Themes state module (surfaces/themes/state.svelte.ts),
 * which owns the document write. The only wired bus event.
 */
export const IMPORT_PAIR = 'themes:import-pair'

/**
 * Payload of IMPORT_PAIR — everything the sender can compute from its own
 * data; the consumer (Themes) owns the document write.
 */
export interface ImportPairPayload {
	name: string // proposed name — deduped by the consumer against the existing themes
	family: string // may be '' — the consumer falls back to the first family
	tag: string
	thesis: string
	light: Record<string, string>
	dark: Record<string, string>
	semantic: { light: Record<string, string>; dark: Record<string, string> }
}

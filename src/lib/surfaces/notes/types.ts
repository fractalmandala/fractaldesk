// Invoke payload shapes for the notes_* Rust commands. Field names mirror the
// serde structs in src-tauri/src/lib.rs exactly.

export interface NotesRootDTO {
	path: string
}

export interface NotesEntryDTO {
	path: string
	rel: string
	root: string
	is_dir: boolean
	is_markdown: boolean
	size: number
	mtime: number
	/** First ATX heading, else empty (UI falls back to filename). */
	title: string
	/** First two text lines, else empty. */
	excerpt: string
}

export interface NotesScanErrorDTO {
	root: string
	message: string
}

export interface NotesScanDTO {
	entries: NotesEntryDTO[]
	truncated: boolean
	errors: NotesScanErrorDTO[]
}

export interface NotesGrepHitDTO {
	path: string
	line: number
	excerpt: string
}

export interface NotesChangedPayload {
	kind: string
	paths: string[]
}

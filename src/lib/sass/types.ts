// Shared types for the Sassy surface. The `Src`/`WriteItem`/`WriteReport`
// shapes mirror the Rust structs in src-tauri/src/lib.rs, so the JSON that
// crosses the `invoke` boundary lines up on both sides.

/** Which way the converter runs. `sass2css` is the default. */
export type Direction = 'sass2css' | 'css2sass'

/** A source file the backend scanned and read for us. */
export type Src = { path: string; name: string; body: string }

/** One converted file to write back. The backend derives the destination
 *  from `source` by swapping the extension — we never send a raw dest path. */
export type WriteItem = { source: string; body: string }

/** What `convert_write` reports back. */
export type WriteReport = { written: number; overwritten: string[] }

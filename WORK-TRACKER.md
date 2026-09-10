# Work Tracker

## Next
- TASK - **build the tailwind classes deconstruction utility as a new state in this app. call the state "untw"**
- use the write-spec -> implement-spec -report flow for this.
- per your own assessment:

```
Fully deterministic — no LLM needed, ever
piece	how
Extract classes from any file	regex/AST over class/cn/cva — already written (extract.ts), pure TS, zero deps
Resolve every token to real CSS	your project's own Tailwind compiler + theme + plugins — already running in /twdemo
Selector matching, @supports merge, px hints, categories	done, tested to 70/70 on your file
Light/dark values	parse :root / .dark blocks, join against @theme inline refs
cva variant matrices	parse cva({ variants: … }) with a TS parser (ts-morph/oxc) — it's just object literals
Group/data-slot linkages, usage search, dead-code + token census	cross-file static analysis, grep with structure
Radix "when does this apply" notes	a curated data file, not intelligence — e.g. dropdown-menu.content.attrs: { data-state, data-side, data-align… } authored once, shipped with the tool
cn() merge semantics	tailwind-merge is itself a deterministic library — call it
Dynamic classes (`p-${n}`) don't need an LLM either — they need an honest unresolvable: [...] section plus safelist support, same as Tailwind's own content scanner.

Deps would be tailwindcss (their v4, peer), postcss, a TS parser, and two curated tables (radix attrs, fractal map). The core server is the engine; then there is arg parsing + file walking + modules repackaged. A VS Code extension later is just a UI shell over that same core.

I can start with a decode-file (single component → markdown report, repo-aware via --project) and leaving decode-repo (census + dead code) as the second command?
```


## Reports
- [Fix SvelteKit Tauri TypeScript Setup](docs/worklog/fix-sveltekit-tauri.md) — repaired the SvelteKit + Tauri + TypeScript configuration; `pnpm build` succeeds, `pnpm check` reports 0 errors and 0 warnings, dev server answers HTTP 200 with no errors.
- [Untw Tailwind Deconstruction Surface](docs/worklog/untw-tailwind-deconstruct.md) — new `untw` state decoding pasted Tailwind classes to resolved CSS offline (specs at `docs/specs/untw/`); `pnpm check` 0 errors, `pnpm build` succeeds, golden replay 78/78 byte-exact.

---
title: Fix Sveltekit Tauri Typescript Setup
description: Repair the broken SvelteKit plus Tauri plus TypeScript configuration so the app builds and runs.
created: 2026-09-11
updated: 2026-09-11
type: worklog
status: completed
truth: Approved in chat on 2026-09-11 at 01:31 IST — human reply: "perfect you can mark the task complette" (approval for the SvelteKit + Tauri + TypeScript repair task from WORK-TRACKER.md ## Next).
---

## Instruction
- the app is currently in a "broken" state.
- it must use Sveltekit (not just Svelte). But Sveltekit is not correctly set up. This is the svelte.config and vite.config files. Some error notes in console
- TASK - please fix! App should be using Sveltekit with Tauri, and typescript.

## Log
- Read AGENTS.md and WORK-TRACKER.md; reproduced the failure chain from the console log.
- Diagnosed root causes: missing sass preprocess in svelte.config.js, invalid options passed to sveltekit() in vite.config.js, plain-vite npm scripts, legacy SPA leftovers (index.html, src/main.js, src/App.svelte), missing SvelteKit layout shell, $state rune used in plain argv/utils.js, extensionless state.svelte imports.
- Fixed svelte.config.js: added `preprocess: vitePreprocess()` (was imported but never used — the cause of every `<style lang="sass">` failure), configured adapter-static to emit to `dist/` with `index.html` fallback for Tauri, dropped the custom `$lib` alias (SvelteKit default already maps `$lib` to `src/lib`).
- Fixed vite.config.js: reduced to just the `sveltekit()` plugin. Passing `adapter`/`preprocess`/`compilerOptions` through it was the cause of the "svelte.config.js is ignored" warning. Kept the Tauri dev-server port (5273) and build options.
- Fixed package.json scripts: `dev` is now `vite dev`, `build` is `vite build` (SvelteKit CLIs — plain `vite` bypassed SvelteKit entirely and served the stale SPA entry), added `preview` and `check`.
- Deleted legacy SPA entry: root `index.html`, `src/main.js`, `src/App.svelte` (a stale duplicate of `src/routes/+page.svelte`). SvelteKit uses `src/app.html` plus the routes directory.
- Added the missing SvelteKit shell: `src/routes/+layout.svelte` (imports `app.sass` globally, replacing the deleted `main.js` import), `src/routes/+layout.js` (`prerender = true`, `ssr = false` — Tauri serves one static bundle, so Tauri/browser APIs stay client-only), and `src/app.d.ts`.
- Fixed the `$state is not defined` SSR crash: deleted `src/lib/argv/utils.js` (a plain `.js` file using the `$state` rune, which only compiles in `.svelte.js`/`.svelte.ts` files; it also referenced `saving`/`baseline`/`say`/`invoke` that did not exist there). Moved working `reset`/`save` implementations into `ArgvBench.svelte`, where the state they operate on lives.
- Fixed `state.svelte` imports to `state.svelte.js` in `+page.svelte`, `ConvertSurface.svelte`, `paste.ts`, `disk.ts` (required specifier form for a `state.svelte.ts` rune module).
- Updated stale `App.svelte` references in README.md layout map, AGENTS.md, and three code comments to the SvelteKit structure.
- Verified: `pnpm build` succeeds, `pnpm check` (svelte-check) reports 0 errors and 0 warnings, dev server answers HTTP 200 on `/` with no 500s and no config warnings.
- Note: the working tree also contains pre-existing uncommitted human changes (design-token restyle, ArgvBench rework) that pre-date this task — left untouched.

## Files
- Edited: svelte.config.js, vite.config.js, package.json, pnpm-lock.yaml, tsconfig.json, src/routes/+page.svelte, src/lib/ArgvBench.svelte, src/lib/ConvertSurface.svelte, src/lib/sass/paste.ts, src/lib/sass/disk.ts, src/lib/states.js, src/lib/ThemesSurface.svelte, src/lib/sass/state.svelte.ts, README.md, AGENTS.md
- Added: src/routes/+layout.svelte, src/routes/+layout.js, src/app.d.ts, docs/worklog/fix-sveltekit-tauri.md (this report)
- Deleted: index.html (root SPA entry), src/main.js, src/App.svelte (stale duplicate of +page.svelte), src/lib/argv/utils.js (broken $state-in-.js stub)

## Deps and Installations
- Added devDependencies `svelte-check@^4` and `typescript@^5` (enables `pnpm check`); installed via `pnpm install`.
- Saved previously-unsaved deps `@sveltejs/kit` and `@sveltejs/adapter-static` into package.json dependencies.

## Learnings
- With SvelteKit, vite.config.js must contain only the `sveltekit()` plugin — any kit options passed there silently disable svelte.config.js.
- `$state` and friends only compile in `.svelte`, `.svelte.js`, or `.svelte.ts` files; a plain `.js` module using them crashes SSR with `$state is not defined`.
- A `.svelte.ts` rune module must be imported with the `.svelte.js` suffix.
- For Tauri static serving: adapter-static with `fallback: index.html` plus a `+layout.js` exporting `prerender = true` and `ssr = false`.

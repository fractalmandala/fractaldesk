# Work Tracker

## Next

### Gate 0 — DONE (auditor approved)
Typed contract, registry, shell-only store, bus, registry-driven shell. Completed and approved.

### Gate 1 — DONE (auditor approved)
argv → surfaces/argv/ + .ts helpers, P24 collision fixed. Completed and approved.

### Gate 2 — DONE (auditor approved)
themes → surfaces/themes/, state out of the shell. All Themes persistence surface-owned; loading/error placeholder moved into the surface; `fullWhileLoading` added to the contract.

### Gate 3 — DONE (auditor approved)
schemes → surfaces/schemes/. Import-to-Themes rerouted through the event bus (`themes:import-pair`); schemes lazy-load via its own hook; read-failure fallback preserved.

### Gate 4 — DONE (auditor approved)
sassy → surfaces/sassy/ + Gate 3 audit cleanups (palette-meta.ts shared domain-meta, events.ts contracts, HMR guard, registry spreads, states.ts deletion).

### Gate 5 — DONE (auditor approved)
untw → surfaces/untw/ (no load hook — fully offline). AGENTS.md New Surface/Tab rewritten to the registry+folder contract. Golden replay 78/78 byte-exact. color.js/samples.js → .ts; $lib root has zero .js files.

The full rollout (Gates 0–5) is implemented and auditor-approved, pending user evaluation. Gates 0–5 remain UNCOMMITTED (HEAD ee2feae) — committing awaits explicit human instruction.


## Reports
- [Fix SvelteKit Tauri TypeScript Setup](docs/worklog/fix-sveltekit-tauri.md) — repaired the SvelteKit + Tauri + TypeScript configuration; `pnpm build` succeeds, `pnpm check` reports 0 errors and 0 warnings, dev server answers HTTP 200 with no errors.
- [Untw Tailwind Deconstruction Surface](docs/worklog/untw-tailwind-deconstruct.md) — new `untw` state decoding pasted Tailwind classes to resolved CSS offline (specs at `docs/specs/untw/`); `pnpm check` 0 errors, `pnpm build` succeeds, golden replay 78/78 byte-exact.
- [Surface Architecture Refactor](docs/worklog/surface-architecture.md) — specs (all 5 audit recommendations) for a uniform surface contract + registry-driven shell; product spec written, tech spec pending approval (specs at `docs/specs/surface-architecture/`).
- [Surface Architecture Implementation](docs/worklog/surface-architecture-impl.md) — Gate 0 + Gate 1 + Gate 2 + Gate 3 + Gate 4 + Gate 5 implemented: typed Surface contract, shell-only store, event bus, typed registry, registry-driven shell; argv migrated to `surfaces/argv/` (P24 fix); themes migrated to `surfaces/themes/` with all persistence owned by the surface and a `fullWhileLoading` contract extension; schemes migrated to `surfaces/schemes/` with the import-to-Themes action rerouted through the `themes:import-pair` bus event (first wired bus channel); sassy migrated to `surfaces/sassy/` with the Gate 3 audit cleanups (shared `palette-meta.ts` read-only projection, typed `events.ts` bus contract, HMR dispose guard for the bus subscription, registry spreads, `states.ts` deleted); untw migrated to `surfaces/untw/` with the Gate 4 cleanups (`converttabs.sass` fixture restored, undeclared comment fix declared), no load hook (fully offline, P16), golden replay 78/78 byte-exact, `color.js`/`samples.js` converted to `.ts` (zero `.js` left in `$lib` root), AGENTS.md `## New Surface/Tab` rewritten to the registry+folder contract. All five gates implemented but uncommitted (HEAD still ee2feae). `pnpm check` 0 errors/0 warnings, `pnpm build` succeeds.
- [Surface Architecture Sprint Report](docs/sprints/surface-architecture-impl.md) — orchestration report for the FULL rollout (Gates 0–5): 6 task dispatches, 7 audit iterations, 1 fix iteration, all gates auditor-approved. Audits at docs/audits/surface-architecture-gate0..5.md. Gates uncommitted — committing awaits human instruction.

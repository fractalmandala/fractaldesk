---
title: Surface Architecture Sprint Report
created: 2026-09-11
updated: 2026-09-11
type: report
source: surface-architecture-impl.md
---

## Description

Orchestrated the complete Surface Architecture refactor (Gates 0–5): typed surface contract, registry-driven shell, shell-only store, event bus, and the migration of all five surfaces (argv, themes, schemes, sassy, untw) into `src/lib/surfaces/<id>/` folders — including the P24 collision fix and the bus rerouting of the Schemes→Themes import flow. All gates auditor-approved. Implemented, pending user evaluation.

## Technicals

**Agents orchestrated:**
- Task agent: Qoder default ("Efficient" auto model) — implementation
- Auditor agent: Kimi-2.7-Code — code audit and validation

**Sessions:**
- Session 1 (Gates 0–1): 2 task dispatches, 3 audit iterations, 1 fix iteration
- Session 2 (Gates 2–5): 4 task dispatches, 4 audit iterations, 0 fix iterations

**Phase timings (session 2):**
- Gate 2 (themes): implement → audit iteration 1 → verdict completed (clean pass)
- Gate 3 (schemes + bus reroute): implement → audit → verdict completed (2 judgment calls ratified: consumer-side toast; read-only meta import accepted with follow-up)
- Gate 4 (sassy + cleanups): implement → audit → verdict completed (cleanups: palette-meta.ts, events.ts, HMR guard, registry spreads, states.ts deletion)
- Gate 5 (untw + AGENTS.md): implement → audit → verdict completed (golden replay 78/78 byte-exact)

## Runs

| Gate | Task dispatches | Audit iterations | Fix iterations | Verdict |
|------|----------------|-----------------|----------------|---------|
| Gate 0 | 1 | 2 | 1 | completed |
| Gate 1 | 1 | 1 | 0 | completed |
| Gate 2 | 1 | 1 | 0 | completed |
| Gate 3 | 1 | 1 | 0 | completed |
| Gate 4 | 1 | 1 | 0 | completed |
| Gate 5 | 1 | 1 | 0 | completed |
| **Total** | **6** | **7** | **1** | **completed** |

## Key deliverables

**Foundation (Gate 0):**
- `src/lib/surface.ts` — typed `Surface` + `ShellState` contract (later extended with `fullWhileLoading`)
- `src/lib/bus.ts` — minimal typed pub/sub; `src/lib/events.ts` — event contracts (`IMPORT_PAIR` / `ImportPairPayload`)
- `src/lib/store.svelte.ts` — shell-only state (view/busy/msg/kind + say)
- `src/lib/surfaces/registry.ts` — typed registry, five spread entries, only surface-module imports
- `src/routes/+page.svelte` — registry-driven shell, zero surface-specific imports

**Surface migrations (Gates 1–5):** `surfaces/argv/`, `surfaces/themes/`, `surfaces/schemes/`, `surfaces/sassy/`, `surfaces/untw/` — each with index.ts / Surface.svelte / Toolbar.svelte / state.svelte.ts (+ helpers, all typed)

**Behavioral fixes & wiring:**
- P24: Argv Save spec calls `argv_save` (was Themes' save); Reset defined (was undefined)
- Schemes→Themes import rerouted through the bus (`themes:import-pair`), module-scope subscription with HMR guard
- Themes persistence fully surface-owned (load/save/build/package/reveal/Cmd-S); schemes lazy-load via its own hook
- Shared read-only domain-meta module (`palette-meta.ts`) closes the flagged Schemes read dependency

**Docs:** AGENTS.md `## New Surface/Tab` rewritten to the registry+folder contract (P29); audit reports gate0–gate5 in `docs/audits/`; README layout updated.

## Validation state

`pnpm check` 0 errors / 0 warnings; `pnpm build` succeeds; untw golden replay 78/78 byte-exact. All six audit reports in `docs/audits/`.

## Known follow-ups (non-blocking, from audits)

- **Gates 0–5 are UNCOMMITTED** (HEAD `ee2feae`) — flagged by four consecutive audits; committing awaits explicit user instruction. Recommended: five gate commits before further tree edits.
- Minor: empty `src/lib/untw/` dir on disk (git-invisible); worklog hash nit (§Gate 5); `color.ts` `fromRgb` body rewrite (semantically identical).
- OBSERVATION (Gate 5 audit): untracked `src/lib/styles/own.sass` + `+layout.svelte` import appear in no worklog — likely human-authored; visually inert unless `--theme-color` is defined.

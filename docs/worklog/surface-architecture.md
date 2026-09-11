---
title: Surface Architecture Refactor
description: Spec the uniform surface contract and registry-driven shell from the HippoxOS structure audit.
created: 2026-09-11
updated: 2026-09-11
type: worklog
status: open
---

## Instruction

Given in chat on 2026-09-11 (not via `WORK-TRACKER.md ## Next`). Human, verbatim:

> "please initiate a spec writing plan, see @AGENTS.md for the instructions, and write me the specs to make the fixes and suggestions in your audit report."

Scope clarified in chat via AskUserQuestion on 2026-09-11: cover **all 5** audit recommendations,
and roll out with **user- or auditor-approval gates between each surface**. Source audit:
[hippoxos-structure-comparison.md](../audits/hippoxos-structure-comparison.md).

## Log

- 2026-09-11 — Ran the HippoxOS structure audit ([docs/audits/hippoxos-structure-comparison.md](../audits/hippoxos-structure-comparison.md)); 5 ranked recommendations produced.
- 2026-09-11 — Plan approved (spec-only, no code). Plan file: `~/.claude/plans/whimsical-coalescing-pumpkin.md`.
- 2026-09-11 — Wrote product spec at [docs/specs/surface-architecture/product.md](../specs/surface-architecture/product.md). Human approved in chat 2026-09-11.
- 2026-09-11 — Human resolved the open question: move fully to TypeScript with type-proper `states.ts`/`store.svelte.ts`. Recorded in product spec "Resolved decisions".
- 2026-09-11 — Found the collision is in the header toolbar: `ArgvBench.svelte` owns working `spec/reset/save`, but the shell's Argv toolbar duplicates them and calls Themes' `save`. Reconnecting toolbar↔state module fixes it.
- 2026-09-11 — Wrote tech spec at [docs/specs/surface-architecture/tech.md](../specs/surface-architecture/tech.md) (typed contract, registry-driven shell, state split, `$lib/bus`, 6-gate sequential rollout). **Hard stop:** awaiting human approval before any implementation.

## Files

- [docs/specs/surface-architecture/product.md](../specs/surface-architecture/product.md) — product spec (behavior/invariants), approved.
- [docs/specs/surface-architecture/tech.md](../specs/surface-architecture/tech.md) — tech spec (implementation plan + gated rollout).
- This report.

## Deps and Installations

None. Spec-only task; no dependencies added.

## Learnings

- The `argv` toolbar in `src/routes/+page.svelte:148-149` calls an undefined `reset` and a `save()` that is actually Themes' save — a live god-component collision that motivates the refactor.
- Only `sass/` and `untw/` currently follow the target contract (a per-feature `state.svelte.ts`); `argv/` is loose `.js`, Themes/Schemes have no module. This unevenness is the thing being standardized.

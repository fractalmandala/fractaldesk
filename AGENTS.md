# AGENTS

This app is an on-going personal build of a workbench to organize all sorts of dev projects, tools, and utilities. It is a Tauri build with a Sveltekit frontend. The Sveltekit uses Svelte 5 with Runes and `$state`, and everything is written in typed typescript.

> Unless you are here commencing work on an explicit task/instruction given by human, the current active task in this report can be seen at `WORK-TRACKER.md` under `## Next` section.
> Follow `DESIGN.md` when styling and/or designing.
> If working on a new feature/product, use the spec -> implement -> report flow through the skills in `skills` folder `write-specs` and `implement-specs`

> If you are given an auditing task, then you are an Auditor. After reading these instructions, read `AUDITOR.md`
> If you are told to orchestrate then you are an Orchestrator. Orchestrator runs when user asks for it, for example "orchestrate the next task", or "orchestrate the 4 steps in file", or "I want this done autonomously. After reading these instructions, read `ORCHESTRATOR.md`
> Unless you are given audit or orchestration, you are a task agent.
> After every task, always evaluate if README.md, or any docs, need to be update, and maintain them in up-to-date state.

Since it is an ongoing build, things about this repo keep changing. But this structure is maintained:

1. Surfaces are registered in `src/lib/surfaces/registry.ts` — a typed array of `Surface` entries (see `src/lib/surface.ts` for the contract). The shell (`+page.svelte`) renders the active surface from this registry with no surface-specific imports or conditional chains.
2. The shell-only global state lives in `src/lib/store.svelte.ts` (view, busy, msg, kind, say). Surface-specific state lives in each surface's own `surfaces/<id>/state.svelte.ts`.
3. Each surface has a component, an optional toolbar component, and an optional load hook — all declared in its registry entry.
4. After every task, always evaluate if README.md, or any docs, need to be update, and maintain them in up-to-date state.

These are the essential contents of this document:
**Styling** - Essential styling rules.
**New Surface/Tab** - Do this when adding a new view/tab/surface into this app.
**Essential Documentation, Log, Reports** - Follow these always.
**Specs, Product** - Follow these when creating a new feature, state, view etc.

## Styling

Only SASS is permitted for styling. SASS is not SCSS - it does not use curly braces or semi colons. Strictly single-tab to be used for indenting.
Use only the existing tokens in `app.sass`
Do not create or new arbitrary new font-sizes.

✅ **Correct Indenting** - The below correctly uses single-tab indenting.

```sass
.tree
	display: flex
	flex-direction: column
	gap: 1px
	overflow-y: auto
	flex: 1
	min-height: 0
	padding: 8px
```

❌ **Wrong Indenting** - The below incorrectly uses double-space indenting.

```sass
.convert
  display: flex
  flex-direction: column
  height: 100%
  min-height: 0
```

## New Surface/Tab

If you are creating a new tab or surface in the app, follow these steps:
> **make sure you first write a spec doc for what you are about to do, and add it to `docs/specs`

Adding a surface is exactly two steps — this supersedes the old import-and-{:else if} workflow:

1. Create `src/lib/surfaces/<id>/` implementing the surface contract (see `src/lib/surface.ts`):
	- `index.ts` — exports the `Surface` entry: id, label, `full`, component, optional toolbar, optional load hook.
	- `Surface.svelte` — the surface body.
	- `Toolbar.svelte` (optional) — header controls; imports the surface's own `state.svelte.ts`.
	- `state.svelte.ts` — the surface's `$state` object (object-wrapped) plus its action functions, imported by both body and toolbar.
2. Add the entry to `src/lib/surfaces/registry.ts` — `{ ...<id>Surface }`.

**No edits to `+page.svelte` — ever.** The shell renders the active surface's body and toolbar from the registry.

- Persistence is the optional `load` hook, invoked the first time the surface activates. A surface without persistence declares none.
- A `full: false` surface that needs full width while loading implements `fullWhileLoading`.
- Cross-surface needs go through the event bus (`src/lib/bus.ts`, event contracts in `src/lib/events.ts`) — never by importing another surface's state module, never by widening the shell store (`store.svelte.ts` is shell-only).
- Shared components/helpers live in `$lib`.

### Rust, Backend, Tauri

Rust builds can get very large. At more complex app levels, a single run of `pnpm tauri build` can create a huge GB dump inside `/src-tauri/target`. Always watch how large is it getting, and clean it before a new build if it is more than 8-10GB at any given time.

Ensure all scripts, builds, servers, daemons etc that need to shut down when app is closed, shut down correctly.
Ensure you lazy load everything that should be lazy load.

## Essential Documentation, Log, Reports

Every file inside `docs` MUST include YAML frontmatter. This excludes `INDEX.md` or `AGENTS.md` or `SKILLS.md` files.
Ignore always the files in `docs/raw`. They are scratch notes and must not contanimate your work or thinking.

```YAML
---
title: Title in Title Case
description: Exactly one sentence summary (max 120 characters).
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: doc | worklog | report | audit | spec
---
```

- All internal references must use markdown standard relative path linking - `[link text](link)` and NOT `[[Title Case]]` syntax.
- When creating or removing pages, respective `index.md` must be updated with the exact one-line description.
- Section headers in files, like `##` and `###` should not be separated by `---` lines. Avoid using `---` lines. Use double line break instead. `---` are used exclusively to separate the YAML frontmatter.
- For all files with YAML frontmatter, do not start those files with `#` header and title. Title is captured in the frontmatter, so start with the content.

### Work Tracking
The file `WORK-TRACKER.md` is the file for all work progress, current stage, further instructions. The human admin will add tasks there, and you must update status and take instructions from it. It has the following sections, and this structure must be maintained:
1. `## Next` - human's instructions for next steps by agent. Maintained by human, agent should not edit.
2. `## Reports` - index of agent's report against task given by human. Maintained by agent.

### Work Log
Agent must maintain a work log in the `docs/worklog` folder. Each task should have its own report file in `task-name.md` file. These files need the following mandatory YAML frontmatter:

```YAML
---
title: Title in Title Case
description: Exactly one sentence summary (max 120 characters).
created: YYYY-MM-DD
updated: YYYY-MM-DD
type: worklog
status: open | closed | completed
truth: //only if type is "completed" or "closed"
state: //if applies to a specific state only
---
```

1. Agent can only mark `type` as "complete" or "closed" on approval by human. 
2. On marking completed or dropped, it must add link to the file where human approval is given. 
3. If approval was given in a chat session, it must quote the exact date, time, and chat context where this was done.
4. Every report must be a set of notes by agent containing these sections:

```
## Instruction
// exact copy-paste of the task instruction that was added by human in the \`## Next\` section of \`WORK-TRACKER.md\`

## Log
// list of actions taken so far. keep this up to date to maintain context and handoff in this repo.

## Files
// linked list of all created files and folders

## Deps and Installations
// list of any dependencies or other installations/downloads done for these tasks

## Learnings
// list of any learnings, memory about human preferences, guidelines picked up during this task
```

1. An up to date index of all reports must be maintained in the `## Reports` section of the `WORK-TRACKER.md`.
2. Begin each task by creating its report file. If you are asked to continue a task, refer to the report file to understand its current status.

## Specs, Product

Always capture the specs of what you are creating, whether a feature, a ui component, a tool, or a full view/tab new addition.
Use the `write-product-spec` and `write-tech-spec` skills in the `skills` folder.
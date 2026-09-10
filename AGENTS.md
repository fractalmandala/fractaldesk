# AGENTS

This app is an on-going personal build of a workbench to organize all sorts of dev projects, tools, and utilities. It is a Tauri build with a Sveltekit frontend. The Sveltekit uses Svelte 5 with Runes and `$state`, and everything is written in typed typescript.

> Unless you are here commencing work on an explicit task/instruction given by human, the current active task in this report can be seen at `WORK-TRACKER.md` under `## Next` section.
> Follow `DESIGN.md` when styling and/or designing.
> If working on a new feature/product, use the spec -> implement -> report flow through the skills in `skills` folder `write-specs` and `implement-specs`

> If you are given an auditing task, then you are an Auditor. After reading these instructions, read `AUDITOR.md`

Since it is an ongoing build, things about this repo keep changing. But this structure is maintained:

1. At `src/lib/states.js` we maintain a global states store for the app. The number of states are the number of surfaces or tabs we use in `src/routes/+page.svelte`.
2. The `src/lib/store.svelte.js` extends this for the App to use.
3. Each state owns its own complete component. The `+page.svelte` layout uses a global header, and displays a different component depending on state. Tabs in the header allow user to toggle between states.
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

1. Create new state in `src/lib/states.js`
2. Create a new component in `src/lib` as the surface for that state. For example, `ThemesSurface.svelte` is the surface for state.id = "themes".  Build the state's UI here.
3. In `src/routes/+page.svelte`, import that component.
4. The div class="conditional" is to be used for displaying the surface's own controls in the header. It is a conditional display, each state has its own. The conditionals begin from `{#if app.view === 'themes'}` and the final is a default `{:else}`. If this new state has conditionals, add a `{:else if app.view === .....newsurfacestate}` clause in this.
5. Similarly, in the class="shell", add a `{:else if app.view === ....newsurfacestate }` and place the importet surface component there.

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
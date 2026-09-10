---
title: Untw Tailwind Deconstruction Surface
description: Add an untw state to FractalDesk that deconstructs pasted Tailwind classes into resolved CSS.
created: 2026-09-11
updated: 2026-09-11
type: worklog
status: completed
truth: Audit verdict completed at docs/audits/untw-tailwind-deconstruct.md ("Remaining: None."). Approved in chat on 2026-09-11 at 02:06 IST — human reply: "this /Users/amrit/fractalmandala/fractaldesk/docs/audits/untw-tailwind-deconstruct.md is updated and the audit has now passed your work. you may mark it "complete" as per record of this audit file."
---

## Instruction

- TASK - **build the tailwind classes deconstruction utility as a new state in this app. call the state "untw"**
- use the write-spec -> implement-spec -report flow for this.
- per your own assessment: [deterministic decode pipeline — extract, real-compiler resolution, selector matching, categories, variant matrices, curated radix/fractal tables; CLI sketch with decode-file then decode-repo]
- Human follow-up after audit verdict no: "the audit of your task delivery has given verdict "no" for whether completed or not - /Users/amrit/fractalmandala/fractaldesk/docs/audits/untw-tailwind-deconstruct.md please review, and initiate completion task."

## Log

- Read AGENTS.md, WORK-TRACKER.md, DESIGN.md, both skills, states/store/page structure, sassy surface pattern, docs layout. Created this report file first per repo rules.
- Engine decision (documented in tech spec): no Node/tailwind runtime inside the Tauri bundle. Ship a prebuilt compiler-output resolution map plus numeric-scale synthesis plus client-side @theme parsing. Fully offline, zero new runtime deps. Map generator script checked in alongside the engine for reproducibility.
- Wrote product spec and tech spec at docs/specs/untw/.
- Generated resolution-map.json (11,263/11,263 candidates from the real Tailwind v4 compiler plus tw-animate-css) in a scratch env; fixed three generator bugs found along the way (rounded side/size order, decoration-none/touch-manipulate renames, missing bare border widths).
- Golden replay caught and fixed three engine bugs before UI work: @theme-inline value-vs-var synthesis (rounded-lg, ring-foreground/10), last-wins theme cascade, greedy utility-prefix matching on multi-dash color names. Final: 78/78 byte-exact.
- Implemented: src/lib/untw/ engine (extract, variants, resolve, theme, decode, categories, fractal, state), UntwSurface.svelte, states.js entry, +page.svelte header conditional plus shell branch.
- Dev-tool scripts live in top-level tools/untw/ (outside tsconfig include) so pnpm check stays clean without @types/node.
- Verified: pnpm check 0 errors 0 warnings, pnpm build succeeds, dev server answers HTTP 200 with no errors, golden replay 78/78.
- Updated WORK-TRACKER.md Reports and README layout map.
- Audit completion pass (audit: docs/audits/untw-tailwind-deconstruct.md, verdict no): rendered the missing per-element blocks view (Behavior 5), added Copy JSON to the header conditional (Behavior 6), fixed default group-anchor usedBy matching so unnamed `group` claims `group-*` variants without a /name suffix (verified: `group` → `group-hover:underline`, `group/foo` → `group-focus/foo:text-sm`), replaced the hardcoded `#e2685f14` error background with `color-mix(in srgb, var(--bad) 8%, transparent)`. Item 5 (curated Radix table plus cva matrix) is audit-marked optional/future stage and stays deferred. Re-verified: golden 78/78, check 0/0, build succeeds.
- Audit completion detail, per Remaining item in docs/audits/untw-tailwind-deconstruct.md:
  1. Blocks view: added a "Per element" section to src/lib/UntwSurface.svelte rendering each entry of r.blocks as `#n · attr`, the raw class string, and its tokens, placed ahead of the design summary per Behavior 5 ordering. Added a `.raw` style rule because the existing `.dim` class is scoped under `.meta` and does not apply outside it.
  2. Copy JSON header: added a Copy JSON button to the `app.view === 'untw'` header conditional in src/routes/+page.svelte, copying `JSON.stringify(untw.result.tokens, null, 2)` with the same disabled-when-no-result and copied-confirmation pattern as Copy summary.
  3. Group-anchor linkage: replaced the `v === group-${name}` equality in src/lib/untw/decode.ts (which evaluated to `v === "group-"` for unnamed groups and never matched) with a readsAnchor predicate — unnamed `group` claims `group-*` variants containing no `/`, named `group/foo` claims variants ending in `/foo`. Live-tested via tsx against the shipped decode module: `group` claimed only `group-hover:underline`, `group/foo` claimed only `group-focus/foo:text-sm`, no cross-claims either way.
  4. Error background token: `.err` background in src/lib/UntwSurface.svelte changed from `#e2685f14` to `color-mix(in srgb, var(--bad) 8%, transparent)`. The identical literal in src/lib/ConvertSurface.svelte predates this task and was left untouched as out of scope.
  5. Deferred per the audit's own marking: curated Radix attribute table plus cva variant-matrix expansion stays a future stage; `cva()` strings continue to receive token extraction only.

## Files

- docs/worklog/untw-tailwind-deconstruct.md (this report; doubles as the implement-specs implementation log)
- docs/specs/untw/product.md (product spec, type spec)
- docs/specs/untw/tech.md (tech spec, type spec)
- src/lib/untw/extract.ts (class extraction plus tokenizing)
- src/lib/untw/variants.ts (bracket-aware variant-chain splitting plus condition labels)
- src/lib/untw/resolution-map.json (prebuilt compiler-output map: 11,263 utilities, generated artifact)
- src/lib/untw/resolve.ts (map lookup, numeric-scale synthesis, @theme synthesis, @supports merge)
- src/lib/untw/categories.ts (design buckets)
- src/lib/untw/fractal.ts (fractalstyler suggestions)
- src/lib/untw/theme.ts (client-side @theme plus :root/.dark parsing)
- src/lib/untw/decode.ts (orchestrator: blocks, tokens, summary, unknowns, markers)
- src/lib/untw/state.svelte.ts (untw shared state plus Convert/Copy actions)
- src/lib/UntwSurface.svelte (the surface)
- tools/untw/generate-map.mjs (map generator; runs in an env with tailwindcss, not in the app build)
- tools/untw/verify.ts plus golden-dropdown.json plus fixture-theme.css (golden replay: 78/78)
- Edited: src/lib/states.js, src/lib/store.svelte.js (view comment), src/routes/+page.svelte, WORK-TRACKER.md, README.md
- Completion-pass edits, no new files: src/lib/untw/decode.ts (readsAnchor matcher for group anchors), src/lib/UntwSurface.svelte (Per-element blocks section, `.raw` rule, tokenized `.err` background), src/routes/+page.svelte (Copy JSON header button).

## Deps and Installations

- None added to this app. tailwindcss plus tw-animate-css plus postcss were used only inside /tmp to run the map generator; nothing new in package.json.

## Learnings

- Single canonical log lives here in docs/worklog per AGENTS.md; it doubles as the implement-specs implementation log (skill asks for docs/reports, repo rule wins).
- Tailwind v4 declarations are variant-independent, so the map stores core utilities once and variants become condition annotations. Verified against real compiler output including :is()-wrapped */** selectors and nested @supports color-mix overrides.
- Pre-existing issue noticed out of scope: src/routes/+page.svelte references reset and save() in the argv header conditional, but neither is defined in that component's script (worklog fix-sveltekit-tauri.md says they were moved into ArgvBench.svelte). Untouched.

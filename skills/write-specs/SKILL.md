---
name: write-specs
description: Write product or feature specifications for the user-facing features in product, focused on detailed behavior and validation. Use when the user asks for a product spec, desired behavior, a new feature or tool, wants to define feature behavior before implementation, or whenever adding something new to the app - written spec always mproves implementation.
---

# write-specs

The objective of writing specs is that the desired behaviour is captured unambiguously enough for an agent to implement it correctly. Describe features from the user perspective - what a user sees, does, and experiences, and the invariants that must hold for them. The `user` is of 4 types:

- For UI / UX features: the human using the product.
- For a data model: the code that reads and writes that model.
- For an API, protocol, or library: the callers of that API — other services, client code, plugins, or agents.
- For a CLI tool or developer-facing surface: the developer invoking it.

Conduct this in two phases - `## Product` and `## Technicals`. 

## Product

A product spec describes behavior from consumer's perspective: the shape of the surface, the operations they can perform, what they see back, invariants they can rely on, and edge cases they must handle — without prescribing how the surface is implemented underneath (which is the next phase).

Write the document at `docs/specs` and follow the frontmatter rules given in `AGENTS.md`, with type = spec. 

Before writing, gather the context you need: feature names, feature summaries, key behaviors, edge cases, and how the features will be validated. Ask questions for missing contexts - don't guess and don't assume.

### Structure

Required sections for each feature:

1. **Summary** — 1–3 sentences describing the feature and desired outcome.
2. **Behavior** — The meat of the spec. An exhaustive English description of how the feature works, written as numbered, testable invariants. See "The Behavior section" below — this is where the spec earns its length, and everything else should stay thin to avoid duplicating it.

Optional sections — include only when they add signal beyond the core. Omit the heading entirely if empty; do not write "None" as a placeholder.

- **Problem** — Include only when the motivation isn't obvious from Summary.
- **Goals** — Include when scope is ambiguous or has been contested. Never write "non-goals" - always define by specificity of what is to be achieved. 
- **Open questions** — Prefer inline `**Open question:** …` next to the relevant behavior. Include a dedicated section only if there are multiple unresolved questions worth collecting.

Write Behavior as numbered invariants that are testable on their own - the tech spec can reference them directly.

### The Behavior Section

The goal of Behavior is a complete English description of how the feature works, detailed enough that a tech spec can be written directly from it without the author having to guess or re-derive product intent. If a reader finishes Behavior with questions about what the feature does in some situation, the section is not done.

Describe, at minimum:

- Default behavior and the happy-path user flow.
- Every user-visible state and the transitions between them.
- All inputs the user can provide and how the feature responds.
- Empty states, error states, loading / pending states, and cancellation.
- Edge cases a reasonable implementer would not think to ask about — permission denied, offline, timeouts, races between state changes, multiple concurrent instances, stale or missing data, focus loss mid-interaction, interactions with adjacent features.
- Keyboard, accessibility, and focus expectations where relevant.
- Invariants that must hold at all times and behaviors that must not regress.
- UI, layout, design expectations. Call out if there are expectations requiring violations of `DESIGN.md`

### Length Heuristic

Behavior should be as long as the feature requires — do not truncate edge cases to hit a line target. The heuristic below applies to everything around Behavior (Summary, optional sections): keep that framing thin so the spec's total length reflects the feature's actual complexity, not structural overhead.

- Trivial fix or narrow UI tweak: no spec.
- Small feature (single module, few edge cases): framing plus Behavior typically ~30–60 lines total.
- Medium feature (cross-module, multiple states): typically ~80–150 lines total.
- Large or behaviorally rich feature: longer is fine, and most of the length should live in Behavior.

If you find yourself writing the same idea in Summary, Problem, Goals, and Behavior, collapse the framing — not the Behavior content.

### Writing guidance

- Prefer concrete, observable behavior over aspirational wording.
- Write Behavior as a list of invariants rather than prose when possible.
- Capture invariants that must not regress and edge cases that are easy to miss.
- Avoid implementation details unless unavoidable for the UX.
- Each section should earn its place — if a section would repeat another or contain only boilerplate, omit it.
- As implementation evolves, update the spec and/or product documents. After finishing any task, always evaluate if there are docs to update.

When the spec document is approved by user, move to the next phase:

## Tech

The tech spec should translate product intent into an implementation plan that fits the existing codebase, documents architectural choices, and makes the work easier for agents to execute and reviewers to evaluate.

Before drafting, read the product spec (if any), inspect the relevant code, and identify the main files, types, data flow, and ownership boundaries. Do not guess about current architecture when the code can be inspected directly.
When referencing relevant code chunks in the spec, prefer commit-pinned references so future readers can inspect the exact code you researched. When possible, make file references to the corresponding docs. 

### Structure

Required sections:

1. **Context** — What's being built, how the current system works in the area being changed, and the most relevant files with line references. Combine the "problem," "current state," and "relevant code" into one grounded section.
2. **Proposed changes** — The implementation plan: which modules change, new types/APIs/state being introduced, data flow, ownership boundaries, and how the design follows existing patterns. Call out tradeoffs when there is more than one reasonable path.
3. **Testing and validation** — How the implementation will be verified against the product behavior. Owns everything about proving the feature works: unit tests, integration tests, manual steps, screenshots, videos, and any other verification. Reference the numbered Behavior invariants from product/feature specs directly rather than restating them; each important invariant should map to a concrete test or verification step. This section is where validation lives.
4. **Parallelization** — Actively evaluate whether parallel sub-agents (launched via `run_agents`) would meaningfully reduce wall-clock time or isolate work. When the spec proposes using sub-agents, include for each proposed agent:
   - A short name/role and the subtask it owns.
   - Coordination boundaries: which files/services each agent owns and how it syncs with sibling agents (messaging, merge points, validation ownership).
   - Distinguish which steps can run in parallel and which must run sequentially. When the dependency graph is non-trivial, consider a short Mermaid diagram (`graph TD` or `flowchart LR`) so the reader can see fan-out and merge points at a glance.

Optional sections — include only when they add signal. Omit the heading entirely if empty; do not write "None" as a placeholder.

- **End-to-end flow** — Include only when tracing the path through the system tells you something the Proposed changes list doesn't.
- **Diagram** — Include a Mermaid diagram only when a visual will explain the design faster than prose (data flow, state transitions, sequence across layers). Prefer one or two focused diagrams over decorative ones.
- **Risks and mitigations** — Include when there are real failure modes, regressions, migration concerns, or rollout hazards worth calling out.
- **Follow-ups** — Include when there is deferred cleanup or future work worth naming.

When the tech specs are also approve, and you have a complete and approve product/feature specification along with the tech specs for it. You are ready to implement. Ask your user if want implementation next.
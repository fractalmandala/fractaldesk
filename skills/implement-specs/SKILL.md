---
name: implement-specs
description: Implement an approved product/feature, keeping specs and code aligned as implementation evolves. Use after the product and tech specs are approved and the next step is building the feature.
---

# implement-specs

Implement an approved feature or product.

## Overview

Use this skill after the product and tech specs are approved. The goal is to build the feature described by the specs while keeping the checked-in specs and the implementation aligned as the work evolves.

Approved specs should live directly under a ticket-named directory in `docs/specs`.

## Prerequisites

Before using this skill:

- confirm that a spec `.md` doc exists.
- that it has both product/feature specs and the tech specs.
- Make sure you understand the expected behavior, constraints, risks, and validation plan before writing code.

## Workflow

Create a logging report before implementation begins, at `docs/reports`. Give it the same name as the spec you are implementing, and follow YAML frontmatter rules given in `AGENTS.md`

Break the work into concrete implementation steps, then implement the feature against the approved specs.

During implementation:

- keep behavior aligned with specs doc.
- keep architecture and sequencing aligned with specs doc.
- add or update tests and verification artifacts as the work lands

Update specs as the implementation evolves
If implementation reveals that the intended behavior or design should change, update the checked-in specs rather than letting them go stale.

In particular:

- update specs when user-facing behavior, UX, edge cases, or success criteria change
- or when architecture, sequencing, module boundaries, or validation strategy change

> **Before considering the work complete, verify that the code matches the current specs.**
- unit tests and regression coverage that follow the repository's local testing conventions
- integration or end-to-end tests for important user flows

## Best Practices

- Keep specs and code synchronized throughout implementation.
- Prefer updating the spec immediately when decisions change rather than batching spec cleanup until the end.
- Use optional tracking documents only when they add real value for a complex feature.
- Keep the same PR coherent: spec updates, code changes, tests, and optional tracking docs should all support the same feature narrative.

## After Implementation

Report your implementation in the log you added to `docs/reports`. List:
- what files did you add/change
- what did you add/change
- for each change - what spec item was it addressing (can be multiple)
- what your expected outcome of the change is
- Your evaluation of how well you have delivered to spec
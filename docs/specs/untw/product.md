---
title: Untw Product Spec
description: Product behavior for the untw Tailwind deconstruction surface in FractalDesk.
created: 2026-09-11
updated: 2026-09-11
type: spec
---

## Summary

Untw is a new FractalDesk surface (state id `untw`) that takes pasted component code containing Tailwind classes and shows what each class means: the real CSS declaration, the design bucket it belongs to (layout, spacing, border, type, surface, effect), a pixel hint where arithmetic applies, and a suggested fractalstyler equivalent. An optional project-theme box resolves custom colors and animations. Everything runs offline inside the app with no model and no build step.

## Behavior

1. A surface named Untw appears in the header surface switcher alongside Themes, Schemes, Argv, Sassy, and selecting it shows the Untw surface full-width.
2. The surface shows a code input prefilled with a short Tailwind example, an optional theme input, and Convert plus Copy controls in the header conditional zone following the Sassy pattern.
3. Pressing Convert with empty code does nothing except keep Convert disabled; whitespace-only input is treated as empty.
4. On Convert, every `class`, `className`, `:class`, Svelte `class:`, and `cn()/clsx()` string in the pasted code is extracted in source order, split into tokens, and deduplicated per block.
5. Results show three views: per-element blocks (attribute plus raw string plus tokens), a design summary grouped by bucket, and a token table mapping each token to its resolved CSS, pixel hint, and fractal suggestion.
6. Each token row that resolved offers a per-row Copy; the header offers Copy summary and Copy JSON of the whole decode.
7. Tokens carrying variants (`hover:`, `focus:`, `dark:`, `data-[…]:`, `[...]`) resolve to the same declarations as their core utility and display the variant as a condition annotation (for example `hover:shadow-md` shows the shadow declarations plus "on hover").
8. Tokens that emit no CSS under the built-in map (custom theme colors, custom animations, plugin utilities, typos, fully dynamic values like `` `p-${n}` ``) appear in an unknowns section that names the most likely cause instead of failing the decode.
9. Pasting an `@theme { … }` block and converting again resolves custom `--color-*`, `--radius-*`, and `--animate-*` names used by the pasted code; the result header states whether the default theme or the pasted theme was used.
10. Pixel hints appear only for numeric spacing scales (for example `pl-7` notes ≈28px) and never for colors, animations, or custom properties whose values are unknown at decode time.
11. Fractal suggestions are labelled as nearest-neighbour approximations, and tokens with no sensible equivalent state that explicitly.
12. Loading state disables Convert and shows a busy status; conversion errors surface in the app status line and in the surface, never as a blank screen.
13. Clearing the input clears results, errors, and copy confirmations.
14. The surface uses only existing app.sass tokens and SASS single-tab indenting; no new font sizes, no new global variables, no DESIGN.md violations.
15. The decode works fully offline with no network, no subprocess, and no model; adding the surface adds no runtime dependency to the app.

# Design

Flat `--ground` background with minimal `--surface` background for surfaces. Consistent accent of `#20b03f` which is also `--signal` and `$signal`. 

The fonts `Atkinson Hyperlegible Next` and `Atkinson Hyperlegible Mono` are set as `--sans` and `--mono` respectively. Use the variables. Use compact line-height of 1 for buttons, icons, and color preview chips. 1.1 for code and the global `.code` class. For the rest, 1.3 is the global default. 
Default text color is `--ink`. Secondary is `--ink-2` and muted is `--muted`.

** Typography **
The following variables are defined at root level. Use these, do not hard code font sizes, do not create your own variables or sizes

```sass
:root
	--text-xs: 0.625rem
	--text-sm: 0.75rem
	--text-md: 0.875rem
	--text-bs: 1rem
	--text-lg: 1.2rem
	--text-xl: 1.4rem
```

### Spacing System
- **Base unit**: 8px (with 2 / 4 / 12 sub-tokens for fine work).

Variables:
```sass
:root
	--space1: 1px
	--space2: 2px
	--space3: 3px
	--space4: 4px
	--space5: 8px
	--space6: 16px
	--space7: 32px
	--space8: 64px
```

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
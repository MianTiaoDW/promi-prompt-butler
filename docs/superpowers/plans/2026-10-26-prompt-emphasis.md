# Prompt emphasis implementation plan

**Goal:** Add persistent background/text emphasis with readable theme-aware presets and a lightweight HSV picker to prompt text surfaces, preserving plain-text copy and AI requests.
**Architecture:** Store typed start/end annotations separately from text. Shared editable/readable text component and lazily mounted picker; no editor dependencies. Existing storage and backups carry optional fields.
**Tech stack:** React, TypeScript, existing CSS and Chrome storage.
**Spec:** User-approved chat design, 2026-10-26: background and foreground modes; HSV/HEX, background opacity, readable presets, theme-specific colors, preview and contrast warning/fix; preserve annotations during edits, export/import, and theme switching.

- [x] Pure annotation operations: validate, apply/clear one layer, retain other layer, remap after text edits, split render spans. Unit regression coverage including duplicate text, overlaps and Unicode.
- [x] Color utilities: HSV conversion, preset pairs for light/dark, opacity composite, WCAG contrast, explicit readability correction. Unit contrast tests.
- [x] Shared text UI: textarea mirror for existing editing behavior; selectable reader; contextual toolbar, presets, HSV square/hue and numeric inputs, theme preview, removal and recent colors. Preserve plain-text copy and selection in shadow roots/dialogs.
- [x] Integrate groups, new prompt steps, detail variants, creation input/results and image prompt. Optional annotation fields travel with storage/backups and across supported workflow handoffs.
- [x] Verify true browser interactions in light/dark/narrow viewports, persistence, plain text, import/export and error handling. Compare build size and browser memory metrics against baseline; report measurements with limits.
- [x] Update docs/tutorial as needed, commit and push main under user's standing authorization. Do not change release tags or packages unless requested.

Ruling: Work in existing clean main checkout because the user's installed browser extension loads its dist path. Do not change the browser's actual personal data. Isolated test profiles only.

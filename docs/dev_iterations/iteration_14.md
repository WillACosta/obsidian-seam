# Development Log — Iteration 14

- **Iteration ID:** `iteration_14`
- **Date:** `2026-10-26`
- **Specs Directory:** [`docs/specs/iteration_14`](../specs/iteration_14/)
  - `global_stats.md`
  - `global_stats_refinements.md`

## Summary of Changes

### Added

- **Palette descriptions**: Control command and special-query descriptions from Universal Palette settings, and add an optional description to each custom search query.
- **Global Statistics**: Open a writing dashboard inside the Universal Palette through “Show global statistics,” grouped with note reports. Show current Markdown note/word totals, recorded active days, and a current writing streak. Use four overview cards in a row or a responsive 2×2 layout.
- **Writing activity**: Explore 52 weekly columns or three months of daily contributions, with month/weekday labels and five themed intensity levels. Switch between gross words written, distinct notes edited, and writing sessions. Hover for details or select a day to see its notes and word contributions; open a note directly. Include mouse, keyboard, and touch support, horizontal heatmap scrolling, English/PT-BR text, and meaningful empty/untracked states.
- **Writing over time**: Show six vertical monthly bars with a shared linear scale, axis ticks/grid lines, month labels and values, including the current month, for recorded words written or observed Markdown note creations. Do not invent history for existing notes.
- **Local activity history**: Persist counts, timestamps, and stable note references in `statistics.json`, with a small local write-ahead journal for recovery. Track local dates at edit time, preserve dates through timezone changes, follow file/folder renames, and retain historical contributions when a note is deleted.

### Changed

- **Dashboard controls**: Replace dropdowns with themed pill chips. Keep Year / 3 months at the dashboard’s top right, Words / Notes / Activity beside the activity heading, and Words / Notes above the monthly chart. Support roving radio-group keyboard focus and touch.
- **Background totals**: Index current notes after layout readiness with bounded concurrent reads. Maintain totals from subsequent file/editor events rather than rescanning when a dashboard opens. Include current unsaved editor text and keep imports/sync/automated updates separate from writing activity.
- **Activity definitions**: Count direct editor transactions with user input, deletion, or movement origins. Preserve word credit while typing/composing, count new replacement words, and exclude undo/redo from new contributions. Group sessions per note/day with a five-minute inactivity gap. A streak may end yesterday while today is still in progress. Notes Created records actual post-enable Markdown create events as vault growth, including imports, without treating creation alone as writing activity.
- **Report navigation**: Reuse Palette report framing, dismissal, and Backspace navigation. Chip radio groups and date-cell keys avoid the hidden suggestion chooser. Dispose dashboard subscriptions/timers when returning, dismissing, or unloading.

### Fixed

- **Overlapping activity tooltips**:
  - **Root Cause**: Day cells provided the same text as both a native `title` and an Obsidian `aria-label` tooltip.
  - **Fix**: Use Obsidian’s tooltip API and accessible labels without native title attributes, including monthly bars and note details.
  - **Verified Scenarios**: A real pointer hover produced one Obsidian tooltip; no native titles remained in the dashboard.
- **Statistics loading and reload races**:
  - **Root Cause**: An editor can temporarily expose empty content during initial file loading, asynchronous reads can lag unsaved edits, and reloads can overlap unfinished initialization or storage writes.
  - **Fix**: Maintain editor-observed word counts and per-file read versions. Serialize initialization/writes across reloads, validate and replay sequenced recovery events once, and preserve buffered user input until history is available.
  - **Verified Scenarios**: Initial editor loading, stale reads, same-note sessions across reloads, duplicate transaction/recovery events, failed saves/recovery, early input during initialization, and a reload while the previous writer is blocked.

### Tests

- All 305 unit tests passed, including zero-based linear monthly chart proportions and empty/sparse scale handling. New coverage includes gross versus net replacements, word growth, repeated/large retained passages, multi-range changes, IME composition/replacement, direct movement, undo/redo/remote/programmatic exclusions, empty vaults, background indexing without fabricated history, cache updates, local midnight/DST/timezone boundaries, future-date exclusion, 52-week/three-month periods, six-month aggregates across New Year, sessions, rename/delete references, malformed history/recovery logs, and startup/reload/save races.
- Typecheck, lint, and production build passed. Obsidian/CodeMirror APIs were checked against installed definitions and the official CodeMirror transaction documentation. CodeMirror dependencies are development-only and remain external in the production bundle; `isDesktopOnly` remains false.
- Live validation in `seam_test_vault` used real CDP typing, undo/redo, replacement, selector arrows, date-cell arrows/Enter, mouse clicks, and touch-emulated date selection. New imports/programmatic modifications updated current totals without writing contributions. Incremental typing credited one word, undo/redo preserved the credit, same-size replacement added gross words without changing the current word count, and replacing a passage with itself plus a word credited only the new word. CDP composition updates credited one word; physical IME/device acceptance was not performed.
- Live dashboard checks covered all contribution metrics, both periods (52 versus 14 week columns for the test date), monthly metric switching, associated note contributions, renamed-note navigation, native and Palette command entry, Backspace, Escape, and subscriber cleanup. Actual recorded contributions persisted across reloads without duplication.
- At 390 px, overview columns were 131 px each and report client/scroll widths were both 310 px; only the heatmap scrolled horizontally. The footer remained visible. English/dark and PT-BR/light renders were inspected with temporary runtime locale/appearance overrides, which were restored; PT-BR touch-emulated selection exposed the correct note contribution. No physical-device acceptance was performed.

- Final smoke checks confirmed initial file opening adds the full stored word count, focused programmatic Vault/editor changes do not create writing contributions, and unsaved editor additions appear in current totals. Keyboard Enter on the report close button dismissed it and removed subscribers; the existing calendar still opened normally.
- Test fixtures were moved to local trash and the original workspace layout restored. Seam settings and appearance files stayed unchanged byte-for-byte; the original statistics history was restored byte-for-byte. The final dashboard returned to 50 notes, 774 words, zero recorded days, and the expected missing-history message. Runtime and console error buffers were empty. Release consistency and whitespace checks passed; changes remain uncommitted.

- UI refinement follow-up used an isolated render-only snapshot with six monthly values (8,500 / 11,000 / 7,000 / 14,500 / 17,000 / 13,000); no synthetic history was persisted. SVG heights matched a shared 20,000-word axis, and switching to Notes displayed the corresponding creation counts. Real chip arrow keys retained focus while selecting metrics/periods; quarter mode displayed 14 weekly columns. Touch-emulated chip selection worked.
- Hovering the last day produced exactly one Obsidian tooltip and zero native `title` attributes. At 390 px the report client/scroll widths were both 310 px and the monthly chart client/scroll widths were both 278 px. English/dark and PT-BR/light views were visually inspected. The original snapshot, locale, appearance and workspace layout were restored; settings, appearance and statistics files stayed byte-for-byte unchanged. Runtime and console error buffers were empty.

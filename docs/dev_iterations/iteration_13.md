# Development Log — Iteration 13

- **Iteration ID:** `iteration_13`
- **Date:** `2026-10-26`
- **Specs Directory:** [`docs/specs/iteration_13`](../specs/iteration_13/)
  - `palette_pins_completion_and_groups.md`
  - `periodic_creation_confirmation.md`
  - `remove_history_cycling.md`

## Summary of Changes

### Added

- **Palette note pins**: Pin or unpin the current Markdown note and keep it first in the empty-input Universal Palette, even with default commands hidden. Persist references across reloads, follow file/folder moves, and remove deleted references. Palette note pins are independent of calendar pins and special-query pins.
- **Note completion**: Offer “Show current note's percentage completion” only for notes containing tasks. Display a theme-colored progress bar and counts of unfinished, partially done (`[/]`), completed, and total items inside the Palette. Include unsaved editor content and respect reduced motion. Press Backspace from completion or Note statistics to return to Palette search, with a matching footer hint.
- **Periodic-note confirmation**: Ask before Seam creates a daily, weekly, or yearly note, including calendar actions, rolling weekly pins, date queries, and daily-task transfer. Show the target path and allow cancellation without creation. Add a default-on Calendar and periodic notes setting; existing notes open directly.
- **Palette group names**: Separate related commands with dimmed names such as Note Statistics and Move Notes, and distinguish built-in/custom special queries without adding selectable rows. Add a default-on Interface toggle.

### Changed

- **Calendar pin feedback**: Highlight calendar pinned-note buttons with the theme hover background on hover and visible keyboard focus.
- **Query-pin count**: Show `Pinned • N/5` aligned to the right of the Search Queries title, with the subtitle beneath, counting all built-in/custom pins independently of the settings filter.
- **Completion consistency**: Partially done tasks no longer count as fully completed in the existing `@todo` result percentage. Keep special-query pin priority and configured ordering when showing group labels.

### Fixed

- **Partial-task completion percentages**:
  - **Root Cause**: The existing result percentage counted every nonempty checkbox status, including `[/]`, as completed.
  - **Fix**: Share the same task summary for the completion report and result percentages, with partial tasks counted separately.
  - **Verified Scenarios**: Mixed unfinished, partial, and completed tasks; all-partial notes; unsaved editor text; and a live 50% report for two fully completed tasks out of four.

### Removed

- **Query-history cycling**: Remove session query storage and Up/Down query recall from the Universal Palette. Arrow keys use normal suggestion/calendar/Base navigation.

### Tests

- All 268 unit tests passed, including Backspace regressions for both note reports, including completion parsing, partial-task percentages, unsaved text, nested/quoted tasks, code/frontmatter/comment exclusions, pin persistence/concurrency/save rollback/move/delete handling, nonselectable group metadata, ordering preservation, periodic confirmation cancellation/acceptance/opt-out/existing-note bypass, split routing after confirmation, and cancelled daily-task transfer.
- Typecheck, lint, and production build passed. Runtime validation used only `seam_test_vault` with Obsidian CLI and real CDP keyboard/mouse events. Verified command selection, grouped navigation and filtering, note pinning with commands hidden, persistence after reload, rename tracking and unpinning, and absence of completion commands on a note without tasks.
- Live completion report showed 50%, one unfinished, one partial, two completed, and four total items. A 390 px viewport had equal report client/scroll widths (310 px), no horizontal overflow, and a fully visible report/footer in the active theme. Physical-device acceptance was not performed.
- Live periodic-note tests covered cancelling and accepting daily/weekly/yearly creation, direct opening afterward, opt-out creation, calendar daily/weekly prompts, rolling weekly-pin cancellation, and daily-task transfer cancellation with unchanged source content and no destination file. Settings showed both new toggles and `Pinned • 5/5`, including while filtering out all query rows.
- Original Seam, Daily Notes, and Periodic Notes configuration files and the workspace layout were restored after validation; temporary note fixtures were moved to local trash. Final runtime/console checks were empty.

- History-removal follow-up: real CDP typing of `> note`, dismissal/reopening, and Down/Up verified that the empty input stays empty while suggestion selection moves normally. Typecheck, lint, build, release consistency, and whitespace checks passed; runtime and console error buffers were empty. No query-history code references remain in `src/` or `tests/`.

- Completion Backspace follow-up: real CDP Backspace returned from the completion report to the same Palette with 14 command rows, an enabled/focused empty input, working subsequent typing, and no leftover report dismiss button. Verified both Palette selection and the native Obsidian completion command. The footer showed `⌫ back`; typecheck, lint, production build, release consistency, and whitespace checks passed. Test fixture was trashed and the original layout restored; runtime and console error buffers were empty.

- Statistics/hover follow-up: real CDP Backspace returned from Note statistics to a focused, enabled Palette input with 15 command rows, both from a Palette selection and the native command. The footer showed `⌫ back`. A real pointer hover changed the calendar pinned-note background from transparent to `rgba(68, 66, 86, 0.5)`, matching the active theme hover variable. Typecheck, lint, build, and all 268 tests passed. Test settings were restored byte-for-byte, layout restored, fixture trashed, and final runtime/console checks were empty.

- Query-pin indicator placement: live settings bounding rectangles confirmed that `Pinned • 5/5` shares the Search Queries title row, aligns to its right edge, and leaves the subtitle underneath. All 268 tests, typecheck, lint, build, and whitespace checks passed; runtime/console buffers were empty.

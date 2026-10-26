# Development Log — Iteration 12

- **Iteration ID:** `iteration_12`
- **Date:** `2026-10-25`
- **Specs Directory:** [`docs/specs/iteration_12`](../specs/iteration_12/)
  - `calendar_weekly_notes_and_pins.md`
  - `current_period_queries.md`
  - `palette_controls_and_pins.md`

## Summary of Changes

### Added
- **Current-period queries**: Open or explicitly create the current week’s note with `@thisWeek` and the current year’s note with `@thisYear`. Reuse the date-query tab/split shortcuts, compose with tags/text/folders, and avoid offering creation when filters hide an existing note. Add yearly folder, calendar-year format, template, and Periodic Notes settings support.
- **Weekly notes**: Open or create the selected week's note from `@calendar`, with an explicit date range, templates, and consistent locale/ISO week boundaries. Read enabled Periodic Notes settings or use Seam's weekly folder, format, and template settings.
- **Calendar pins**: Keep up to three notes visible above the calendar, with a searchable note picker, contextual pin/unpin commands, persistence, rename/move tracking, and deletion cleanup.
- **Rolling weekly pin**: Keep the real current week's note pinned while browsing other dates. Offer explicit creation when the new week has no note, keep annual goals fixed, and avoid duplicate weekly actions.

### Changed
- **Special-query pins**: Raise the shared built-in/custom query limit to five, including custom-query creation/editing. Refresh an open query listing when settings change. Calendar note pins keep their separate three-note limit.
- **Calendar keyboard and layout**: Keep pins outside the scrolling date/picker area; describe the focused action in the footer and preserve keyboard access with the existing two-stage Escape.

### Fixed
- **Palette dismissal and pin priority**:
  - **Root Cause**: The native X cleared the input instead of dismissing the Palette. Grouping date queries after sorting pins could pull unpinned queries ahead of pinned ones.
  - **Fix**: Use an explicit accessible dismiss button with focused keyboard handling. Group date queries separately within pinned and unpinned sections.
  - **Verified Scenarios**: Native mouse dismissal with empty, special-query, calendar, and directory inputs; focused Enter/Space dismissal; five mixed query pins; rejection of sixth built-in/custom pins; live reorder after pinning/unpinning.
- **Pin save and note creation races**:
  - **Root Cause**: Concurrent actions could otherwise exceed the slot limit or target the same missing weekly note.
  - **Fix**: Serialize pin mutations with save rollback and deduplicate same-path weekly creation. Recheck existing files and never overwrite conflicts.
  - **Verified Scenarios**: Automated coverage for concurrent pinning, failed saves/retries, same-week creation, existing notes, and folder conflicts.

### Tests
- Palette controls follow-up: all 219 unit tests passed, including four ordering regressions for mixed pins, date grouping, configured/unknown order, and input immutability. Typecheck, lint, and production build passed. Live tests in `seam_test_vault` exercised the dismiss button using CDP mouse/key events and settings pin controls, including five-pin enforcement and open-list refresh.
- All 199 unit tests passed, including 18 new cases for locale/ISO New Year and leap-day boundaries, calendar alignment, legacy/modern Periodic Notes settings, invalid formats, nested creation and weekday templates, same-week creation concurrency, conflicts, pin migration/deduplication, the three-slot limit under concurrency, save rollback, moves/deletes, contextual rolling unpin, rollover without creation, and reconciliation during a rename.
- Typecheck, lint, and production build passed. Live validation in `seam_test_vault` verified contextual commands, native note-picker keyboard selection, persisted pins across reloads, limit enforcement, file and folder moves, fixed and rolling deletion cleanup, opening a renamed weekly note, and absence of duplicate weekly actions.
- Real CDP Tab/Enter/Escape events verified shelf access, focused footer labels, weekly creation from the selected historical week, and two-stage Escape. A view-local clock simulation verified next-week resolution, explicit creation only, and an unchanged annual goal pin. Both legacy and active modern Periodic Notes configurations were exercised, including the Monday grid and ISO template dates; Seam settings and invalid-format retry were inspected in the native app.
- At 390 px, all three pins remained visible while the calendar body scrolled, the year picker kept its shelf, there was no horizontal overflow, and the footer stayed within the viewport. Original Daily Notes, Periodic Notes, and Seam settings files were restored byte-for-byte, the layout restored, viewport overrides cleared, and temporary note fixtures moved to local trash. Final runtime/console checks were empty. Physical-device acceptance was not performed.

- Current-period follow-up: all 215 tests passed, including eight extra native-routing unit cases for the two queries and all four Enter shortcuts, yearly settings/providers/templates, calendar-year versus ISO week-year at New Year, same-year creation concurrency, folder/template errors, filter composition, anchored activation dates, and a recoverable invalid-configuration row. Typecheck, lint, and production build passed. Real CDP events in `seam_test_vault` verified all four creation destinations for both queries, subsequent existing-note results and open labels, filtered-out notes without creation, both yearly Periodic Notes formats, and yearly settings in the native UI. Menu discovery and mouse selection, invalid-format error selection without dismissal or creation, and recovery after repair also passed. Original Seam and Periodic Notes settings files were restored byte-for-byte, the original layout restored, and temporary notes moved to local trash. Runtime/console checks were empty; release consistency and whitespace checks passed. Physical-device acceptance was not performed.

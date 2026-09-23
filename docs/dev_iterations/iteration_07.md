# Development Log — Iteration 07

- **Iteration ID:** `iteration_07`
- **Date:** `2026-09-22`
- **Specs Directory:** [`docs/specs/iteration_07`](../specs/iteration_07/)
  - `advanced_search.md`

## Summary of Changes

### Added
- **Exact Phrase Search**: Double-quoted search terms are matched as exact contiguous phrases, with a Universal Palette helper hint.
- **Special Search**: Added selectable `@untagged`, `@docs`, `@images`, `@task`, `@todo`, `@done`, and `@code` filters with localized descriptions and helper text; OCR attachment search remains deferred.

### Changed
- **Search Service**: Uses Obsidian metadata for tags, attachments, tasks, and code blocks.
- **Universal Palette**: Typing `@` opens the special-search choices, and selecting one applies the filter in the existing result view.

### Fixed
- **Quoted Search Matching**:
  - **Root Cause**: Search inputs were passed to content matching with their quote delimiters intact.
  - **Fix**: Normalize surrounding double quotes before title, content, and snippet matching.
  - **Verified Scenarios**: Exact phrase search and special-search text filtering are covered by automated tests.

### Tests
- Added parser, metadata predicate, and exact content search tests.
- Ran typecheck, lint, 87 automated tests, production build, and `git diff --check`.
- Reloaded Seam in `seam_test_vault`; Obsidian reported no captured runtime errors. Console capture was unavailable because the debugger was not attached.

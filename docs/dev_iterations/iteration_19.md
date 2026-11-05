# Development Log — Iteration 19

- **Iteration ID:** `iteration_19`
- **Date:** `2026-11-05`
- **Specs Directory:** [`docs/specs/iteration_19`](../specs/iteration_19/)
  - `image_layout.md`

## Summary of Changes

### Added

- **Image Layout**: Configure Utility Grid, Flex, and Masonry galleries inside the Universal Palette, with a compact image strip, expandable picker, live preview, and fixed action footer. Layouts are stored as Markdown code blocks and expose edit actions.

### Changed

- **Utility view lifecycle**: Release view-specific presentation when navigating back, replacing a panel, or dismissing the Palette. Image Layout replaces the separate grid/flex insertion commands.

### Fixed

### Tests

- Seam typecheck, lint, 413 tests, and build passed. Utility typecheck, lint, 17 tests, and build passed.
- Installed all plugins into the shared test vault. Verified all three renderers, local paths with spaces, alias/Markdown captions, missing-image fallbacks, drag-and-drop ordering, per-image caption/crop edits, insertion with no images, edits of duplicate blocks without modifying their neighbor, and direct source selection. Desktop and narrow viewport checks cover modal geometry; physical mobile devices remain untested.

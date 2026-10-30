# Development Log — Iteration 16

- **Iteration ID:** `iteration_16`
- **Date:** `2026-10-30`
- **Specs Directory:** [`docs/specs/iteration_16`](../specs/iteration_16/)
  - `request.md`

## Summary of Changes

### Added

- **Attachment deletion**: Continue using Obsidian’s native note-deletion flow, which presents its attachment selection dialog.
- **Pinned commands**: Select up to three Seam commands in the Commands settings group, reorder or remove them, and show available pins in the Universal Palette.
- **Command mode shortcut**: Register a command to open the Universal Palette with the command prefix.

### Changed

- **Pinned shortcuts**: Display pin indicators and assigned hotkeys on pinned notes and commands. Register stable note commands that follow file and folder renames, so their hotkeys can be assigned in Obsidian.
- **Shortcut hints**: Show keyboard hints on desktop and tablets, while retaining keyboard behavior on phones.
- **Command availability**: Keep Initialize Seam in settings only and exclude Palette-opening commands from the pinned command picker.
- **Automatic processing**: Retain its enabled default while preserving previously saved choices.

- **Statistics identity**: Reuse the latest matching legacy device identity and stable resource paths. Existing snapshots remain available for aggregation.

### Fixed

- **Excess statistics files**:
  - **Root Cause**: Cache-busting resource URLs changed local storage keys across reloads.
  - **Fix**: Remove the session-specific URL authority and query when identifying the local device and journal.
  - **Verified Scenarios**: Automated coverage checks legacy identity selection and changing resource URLs.

### Tests

- Type checking, lint, unit tests, and shared test-vault validation. Verified command selection, reordering, removal, and persistence in Settings. Confirmed that deleting a test note through Seam opens Obsidian’s native attachment selection dialog.

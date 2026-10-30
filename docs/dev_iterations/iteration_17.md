# Development Log — Iteration 17

- **Iteration ID:** `iteration_17`
- **Date:** `2026-10-30`
- **Specs Directory:** [`docs/specs/iteration_17`](../specs/iteration_17/)
  - `request.md`

## Summary of Changes

### Added

- **Outline folding**: Toggle a heading's nested entries with Cmd+Enter / Ctrl+Enter or its disclosure control, with a footer hint and search-aware folding.

- **Setup status**: Show a check beside Preview setup when the same read-only verification used by the setup preview confirms all recommendations are already present.

- **Settings filter**: Search group names, setting names, and descriptions from the Seam settings view, with an empty-results message and accent-insensitive matching.
- **Settings group disclosure**: Expand or collapse each settings group using a mouse, touch, or keyboard. Matching groups expand during filtering and return to their previous state when the filter is cleared.

### Changed

- **Palette result metadata**: Configure file extensions and match counts separately, preserving the old combined setting for existing vaults.

- **Command icons**: Use action-specific Lucide icons consistently for Palette results, pinned commands, and their settings list, with a terminal fallback for unknown commands.

- **Command mode**: Show available pinned commands first under the same Pinned Commands group used by the empty Palette, with filtering and duplicate actions handled consistently.

- **Pinned commands**: Increase the limit to five and show the current pin count using the Search Queries style.
- **Settings layout**: Match the settings filter to the query filter, allow group headings to toggle disclosure, and show Initialize Seam as a standalone item.
- **Quick Capture settings**: Keep the draft persistence setting in the Quick Capture group so its disclosure control and filter apply to the full section.

### Fixed

- **Settings navigation**:
  - **Root Cause**: A long settings view required scrolling through unrelated groups to find an option.
  - **Fix**: Filter individual settings and let users collapse groups while retaining their section state during the current settings session.
  - **Verified Scenarios**: Live settings filtering, empty results, keyboard disclosure controls, clearing the filter, and preserving the query through a settings update.

### Tests

- Type checking, lint, unit tests, changelog validation, and shared test-vault Obsidian CLI validation.

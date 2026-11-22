# Development Log — Iteration 18

- **Iteration ID:** `iteration_18`
- **Date:** `2026-11-04`
- **Specs Directory:** [`docs/specs/iteration_18`](../specs/iteration_18/)
  - `back_navigation.md`

## Summary of Changes

### Added

### Changed

- **Back navigation**: Use Cmd+[ on macOS or Ctrl+[ on other platforms to return from Palette subviews, including when a filter contains text. Footer hints display the platform shortcut. Backspace continues to edit text and selected query/tag tokens.

### Fixed

- **Consistent Utility navigation**:
  - **Root Cause**: Empty-input Backspace still navigated while nonempty Backspace edited text.
  - **Fix**: Remove Backspace navigation and use the dedicated platform Back shortcut in both standalone and embedded Utility views.
  - **Verified Scenarios**: Outlines with a nonempty filter; note statistics, completion, global statistics; calendar grid; standalone Utility image selection and caption editing.

### Tests

- Seam: typecheck, lint, and 413 tests passed. Utility: formatting, lint, typecheck, and 6 tests passed.
- Workspace build/install passed via `mise run install:all`. Live test-vault checks confirmed in-place Back transitions and no Backspace navigation with empty or nonempty inputs. Runtime and error-console checks were clean. Non-macOS modifier behavior is covered by automated tests; physical Windows/Linux input was not tested.

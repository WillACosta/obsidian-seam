# Development Log — Iteration 21

- **Iteration ID:** `iteration_21`
- **Date:** `2026-11-06`
- **Specs Directory:** [`docs/specs/iteration_21`](../specs/iteration_21/)
  - `editor_media.md`

## Summary of Changes

### Added

- **Editor & media**: Seam now includes URL previews, image captions, Image Layout, current-group folding, completed-task styling, and optional automatic sorting of newly completed tasks. Each feature has its own setting; URL previews and automatic sorting are off by default.

### Changed

- **One installation**: These capabilities are part of Seam, with native command IDs and an Editor & media group in the Universal Palette. The standalone Utility plugin is no longer needed. Existing `seam-layout` and `seam-embed` blocks retain their syntax.
- **Feature lifecycle**: Seam owns an internal registration component using public Plugin lifecycle APIs. Disabled features register no renderer, editor extension, observer, or automation listener. Changing feature settings unloads the previous component, releases image Blob URLs, closes its views, and registers only enabled features. No second plugin is registered with Obsidian.
- **Workspace builds**: Default build/install tasks now install Seam and Seam Sketch. The standalone Utility repository remains a committed reference at `8827334`; no settings migration or compatibility bridge is included for unreleased installations.
- **Language and privacy**: Settings, command titles, Palette groups, modal controls, and keyboard hints follow Seam's English/PT-BR language selection. Documentation explains opt-in metadata requests and explicitly selected remote image downloads.

### Fixed

- **Test discovery after adding nested tests**:
  - **Root Cause**: The shell expanded the unquoted test glob to only the new nested directory, skipping the existing root test files.
  - **Fix**: Quote the recursive glob so the runner discovers the full suite.
  - **Verified Scenarios**: All existing and migrated tests run together.

### Tests

- Formatting, lint, typecheck, and all 455 tests passed. Tests retain the existing 423 regressions and add the 26 transferred Utility tests plus six settings, lifecycle, and localization checks.
- `mise run install:all` built and copied the integrated plugins to `seam_test_vault`. Standalone Utility was disabled there; no personal vault was used.
- Live checks verified all three layout renderers, vault image resolution, existing layout editing, empty-layout insertion, native commands, Palette subview replacement, and Cmd+[ returning to the Palette with its keyboard scope removed.
- A local HTTP fixture confirmed zero metadata/image requests with URL previews off; three preview styles shared one metadata request after enabling previews. Card and compact rendered images; minimal retained the link icon. Explicit metadata overrides and insertion through the Palette's check action passed.
- Disabling all features removed rendered layouts, previews, captions, task styling, and editor/media Palette entries. Changing settings closed a tracked caption picker and removed its modal scope.
- Caption selection and check-action submission passed. Editing the alias afterward updated the visible caption in the same live editor without a mode change. Automatically checking a task moved it after older completed tasks without introducing a blank line.
- Remote caption thumbnails rendered through Seam's disk cache and still loaded after the HTTP server stopped and the feature component restarted. Labels used decoded filenames without paths or signed query strings.
- At a 390px emulated viewport, caption and layout views had no horizontal overflow; the layout check action was 44px and visible. A dispatched touch on Save caption saved the alias and retained the signed image destination. Physical mobile hardware was not tested.
- Temporary HTTP fixtures and cache entries were removed, viewport/touch emulation and test preferences were restored, and test edits were excluded from writing-activity recording. Final runtime and console-error checks were clean.

# Development Log — Iteration 08

- **Iteration ID:** `iteration_08`
- **Date:** `2026-09-25`
- **Specs Directory:** [`docs/specs/iteration_08`](../specs/iteration_08/)
  - `Seam - Version 3.0.0.md`
  - `bases_rendering_wireframe.png`
  - `pipeline_wireframe.png`

## Summary of Changes

### Added
- **Custom Special Searches**: Added configurable `@` queries with explicit Bases or Seam-tags filtering modes, `.base` and Base-view suggestions, reusable tag completion, visibility controls, ordering, duplication, and up to three pinned queries.
- **Base Rendering**: Added in-palette rendering for configured Obsidian `.base` views using native Markdown embeds.
- **Query Pipelines**: Added an experimental setting for selecting custom and built-in queries as chips, arranging them on a mobile-safe canvas, and defining directional connections between stages.

### Changed
- **Universal Palette special-search suggestions**: Custom searches and enabled pipelines are listed alongside Seam's built-in searches, with distinct custom-query styling, note results for tag filters, Base embeds, and graph-connected pipeline stages.
- **Settings**: Added native settings controls and modal editors for custom searches and query pipelines, including the query action toolbar and canvas connection editor.

### Fixed
- **Custom query persistence**:
  - **Root Cause**: Iteration 08 had no persisted settings model or editor for custom searches and pipelines.
  - **Fix**: Added typed settings, defaults, save/load normalization, and settings UI editors.
  - **Verified Scenarios**: Reloaded the plugin in `seam_test_vault`, confirmed custom queries and pipelines appear in `@` suggestions, rendered a `.base` view, and ran a filter-only custom query.

### Tests
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test` — 90 tests passed.
- Obsidian CLI validation in `seam_test_vault`: plugin reload, settings search for “announce”, custom `@` suggestions, Base rendering, filter search, pipeline rendering, `dev:errors`, and captured console errors.

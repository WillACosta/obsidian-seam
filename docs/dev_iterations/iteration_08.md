# Development Log — Iteration 08

- **Iteration ID:** `iteration_08`
- **Date:** `2026-09-28`
- **Specs Directory:** [`docs/specs/iteration_08`](../specs/iteration_08/)
  - `Seam - Version 3.0.0.md`
  - `fixes.md`
  - `fixes_02.md`
  - `bases_rendering_wireframe.png`
  - `pipeline_wireframe.png`

## Summary of Changes

### Added
- **Custom Special Searches**: Added configurable `@` queries with explicit Bases or Seam-tags filtering modes, `.base` and Base-view suggestions, reusable tag completion, visibility controls, ordering, duplication, and up to three pinned queries.
- **Base Rendering**: Added in-palette rendering for configured Obsidian `.base` views using native Markdown embeds.
- **Query Pipelines**: Added an experimental setting for selecting custom and built-in queries as chips, arranging them on a mobile-safe canvas, and defining directional connections between stages.
- **Custom Search Icons**: Added an editable Lucide/Obsidian icon to each custom search, defaulting to `sparkles` and shown in the custom query listing and palette suggestions.
- **Built-in Special Search Controls**: Listed all eight built-in searches with pin, hide, and reorder actions, and added a configurable task completion percentage for `@todo` results.
- **Universal Palette Ribbon Setting**: Added options to show the command on desktop and mobile, mobile only, or hide it.

### Changed
- **Universal Palette special-search suggestions**: Custom searches and enabled pipelines are listed alongside Seam's built-in searches, with distinct custom-query styling, note results for tag filters, Base embeds, and graph-connected pipeline stages.
- **Settings**: Added native settings controls and modal editors for custom searches and query pipelines. Pipeline queries now appear as chips inside the selector, and JSON Canvas-compatible text nodes and arrow edges are arranged and connected directly in the canvas.
- **Universal Palette pipelines**: Pipeline contents now render only after selecting the pipeline suggestion. Connected query blocks and arrows follow the configured canvas layout.
- **Settings text**: Updated the Universal Palette icon setting subtitle and placed the New Pipeline action beside New query.
- **Special Search settings**: Renamed the section and list to “Special Search” and “Search Queries”, and made the no-matches state account for filtered query pipelines.
- **Special Search row order and ribbon controls**: Pinned entries now lead the combined list, hidden entries follow visible entries without a “Hidden” badge, and ribbon visibility changes update the icon display with a reload hint in settings.
- **Pinned built-in query ordering**: Persisted one order across custom searches, built-in searches, and pipelines so pinned built-ins can move relative to pinned custom queries in settings and palette suggestions.
- **`@todo` completion display**: Added a localized “completion •” cue before each task completion percentage in palette results.
- **Minimal query rows**: Removed Base paths from the Search Queries listing while retaining the query name, icon, and available actions.

### Fixed
- **Custom query persistence**:
  - **Root Cause**: Iteration 08 had no persisted settings model or editor for custom searches and pipelines.
  - **Fix**: Added typed settings, defaults, save/load normalization, and settings UI editors.
  - **Verified Scenarios**: Reloaded the plugin in `seam_test_vault`, confirmed custom queries and pipelines appear in `@` suggestions, rendered a `.base` view, and ran a filter-only custom query.
- **Pipeline connection editor**:
  - **Root Cause**: Connections required separate dropdowns and an Add Connection action, while canvas edges were only text labels detached from the query cards.
  - **Fix**: Replaced the separate controls with drag-to-connect ports and rendered directional SVG edges between movable cards. Edge removal is available by selecting a wire.
  - **Verified Scenarios**: Selected two saved custom queries through autocomplete, created a directed edge, and confirmed two pipeline stages and one arrow appear in the Universal Palette only after selecting the pipeline.
- **Pipeline filter empty state**:
  - **Root Cause**: The empty-state check counted custom searches before filtered pipeline rows were rendered.
  - **Fix**: Include matching enabled pipelines in the empty-state decision.
  - **Verified Scenarios**: Filtered the live settings list for “library”; the matching `@booksLibrary` pipeline appeared without a false no-matches message.

### Tests
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test` — 90 tests passed.
- Obsidian CLI validation in `seam_test_vault`: plugin reload, custom-query icon and pipeline editor screenshots, default `sparkles` preview, autocomplete chip selection, drag-created edge, and selection-gated pipeline rendering. `dev:console level=error` captured no messages. `dev:errors` showed two timestamped ResizeObserver notices during reload with a Base-backed palette open; no new runtime entries appeared after closing it and repeating the isolated editor and palette checks.
- Obsidian CLI live checks: settings screenshot confirmed all eight built-ins and the renamed headings; `@todo` displayed completion values, including 50% for a temporary note with one checked and one unchecked task (the note was moved to trash after the check). Plugin reload reported no errors.

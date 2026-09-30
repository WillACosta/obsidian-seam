# Development Log — Iteration 08

- **Iteration ID:** `iteration_08`
- **Date:** `2026-09-29`
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
- **Custom Search Icons**: Added an editable Lucide/Obsidian icon to each custom search, defaulting to `search` and shown in the custom query listing and palette suggestions.
- **Built-in Special Search Controls**: Listed built-in searches with pin, hide, and reorder actions, and added a task completion percentage for `@todo` results that is enabled by default.
- **Recent Note Queries**: Added `@recent` for the ten most recently modified notes and `@lastXdays` for notes modified within any positive number of days.
- **Daily Note Queries**: Added `@today` and `@yesterday`, resolved from the Obsidian Daily Notes folder and date format through the public vault adapter.
- **Base Result Navigation**: Made Seam-rendered Base results the default, with arrow-key navigation, Enter-to-open behavior, live text filtering, and clear keyboard guidance.
- **Universal Palette Ribbon Setting**: Added options to show the command on desktop and mobile, mobile only, or hide it.
- **Create Note Hotkey Command**: Registered “Seam: Create a new note” in Obsidian's command registry so users can assign a shortcut in Hotkeys settings.
- **Command Visibility Setting**: Show Seam commands by default or limit them to the `>` prefix.

### Changed
- **Universal Palette special-search suggestions**: Custom searches are listed alongside Seam's built-in searches, with note results for tag filters and Base-backed result layouts.
- **Settings**: Added native settings controls and modal editors for custom searches, including custom icons and Base views rendered through Seam's result navigation.
- **Settings text**: Updated the Universal Palette icon setting subtitle.
- **Special Search settings**: Renamed the section and list to “Special Search” and “Search Queries”, and kept the filtered empty state accurate across built-in and custom queries.
- **Special Search row order and ribbon controls**: Pinned entries now lead the combined list, hidden entries follow visible entries without a “Hidden” badge, and ribbon visibility changes update the icon display with a reload hint in settings.
- **Pinned built-in query ordering**: Persisted one order across custom and built-in searches so pinned built-ins can move relative to pinned custom queries in settings and palette suggestions.
- **`@todo` completion display**: Added a localized “completion •” cue before each task completion percentage in palette results.
- **Minimal query rows**: Removed Base paths from the Search Queries listing while retaining the query name, icon, and available actions.
- **Special-query interaction**: Query suggestions and filter text now use Obsidian's normal text color, only the active `@query` token uses the accent color, and Backspace clears an exact active query in one action.
- **Recent files access**: Replaced the separate “Show recent files” command and palette subview with the built-in `@recent` query.
- **Special search availability**: Removed `@ocr` temporarily.
- **Base query editor**: Removed the “Show Base menu bar” option; Base queries consistently hide the native toolbar inside the palette.
- **Custom query highlights**: Applied the existing search highlight treatment to custom Seam-tags results and matching text inside filtered Base cards and table rows.

### Fixed
- **Custom query persistence**:
  - **Root Cause**: Iteration 08 had no persisted settings model or editor for custom searches.
  - **Fix**: Added typed settings, defaults, save/load normalization, and settings UI editors.
  - **Verified Scenarios**: Reloaded the plugin in `seam_test_vault`, confirmed custom queries appear in `@` suggestions, rendered a `.base` view, and ran a filter-only custom query.
- **Seam-tags live filtering**:
  - **Root Cause**: The saved tag filter and live text were combined into one tag expression, whose plain-text tokens are intentionally ignored by tag matching.
  - **Fix**: Apply the saved tag expression first, then filter its candidate notes by title, path, and note content.
  - **Verified Scenarios**: `@electronics PCB` returned only “PCB Design” in the test vault.
- **Active query deletion**:
  - **Root Cause**: Backspace used the input's normal character deletion even when a complete special query was active.
  - **Fix**: Detect exact built-in, dynamic, and custom queries and clear the full identifier with one Backspace press.
  - **Verified Scenarios**: Dispatched Backspace with `@electronics` active and confirmed the input became empty.
- **Custom query result highlights**:
  - **Root Cause**: Highlight extraction understood built-in `@` queries but treated a custom query's entire input as the highlight phrase; Base filtering changed visibility without marking matching text.
  - **Fix**: Strip custom identifiers before rendering standard result highlights and add link-safe, idempotent text-node highlights to visible Base results.
  - **Verified Scenarios**: Confirmed `@electronics PCB` highlighted “PCB” and `@allBooks Tainted` highlighted “Tainted”; changing the Base filter to “Robert” replaced the mark and clearing it removed all marks.
- **Multi-row Base result layout**:
  - **Root Cause**: Base cards use absolute row and column coordinates, but Seam compacted filtered cards as one horizontal sequence and retained stale horizontal offsets for wrapped items.
  - **Fix**: Preserve native card coordinates for unfiltered views and calculate both row and column positions when compacting filtered results.
  - **Verified Scenarios**: Rendered a ten-item card view, confirmed wrapped native results remained aligned, and filtered it to six matching cards arranged as four items followed by two items at the left edge.
- **Base card navigation**:
  - **Root Cause**: Card rows were inferred from viewport coordinates that shift while scrolling, and navigation wrapped from the first/last row to the opposite edge.
  - **Fix**: Group cards by their stable Base layout coordinates, clamp movement at grid edges, and retain linear Up/Down navigation for Base lists.
  - **Verified Scenarios**: In `@bookShelf`, tested all four directions and confirmed Down at the last row stays there so Up moves to the preceding row without cycling.
- **Virtualized Base navigation and filtering**:
  - **Root Cause**: Seam restored stale positions on recycled native Base nodes and filtered only the rendered subset of results.
  - **Fix**: Delegate text filtering to the native Bases search input, preserve native layout coordinates, and navigate each result in reading order with Up/Down while materializing adjacent rows as needed. Left/Right remain available for editing the query.
  - **Verified Scenarios**: Traversed all 13 `@bookshelf` cards down and back up, including edge clamping; traversed all 39 Base table results; matched previously offscreen titles and author properties, including `Frank Dune`; cleared filters back to the full result set.
- **Contextual command ordering**:
  - **Root Cause**: Archive and Move to Permanent were appended after general palette commands.
  - **Fix**: Insert the contextual actions immediately after Create a new note whenever an active Markdown note makes them available.
  - **Verified Scenarios**: Inspected the live command order in the test vault.
- **Special-search input hover**:
  - **Root Cause**: The active query is drawn in a mirror while the real input text is transparent, allowing hover styles to obscure the visible query.
  - **Fix**: Keep the active input transparent and opaque, and keep the mirrored query text visible on hover.
  - **Verified Scenarios**: Inspected the live special-search input and mirror after plugin reload; confirmed no console errors.

### Tests
- `pnpm typecheck`
- `pnpm lint`
- `pnpm build`
- `pnpm test` — 92 tests passed.
- Obsidian CLI validation in `seam_test_vault`: plugin reload; screenshots of the special-search listing, active `@recent` results, Base query editor, and multi-row Base card layouts; live `@lastXdays` selection; exact-query Backspace; Seam-tags text filtering; and Base filtering across wrapped rows. `dev:console level=error` captured no messages. `dev:errors` retained timestamped native ResizeObserver notices from the Base layout exercise, with no new entries after closing the palette and reloading Seam.
- Obsidian CLI live checks: settings screenshot confirmed all eight built-ins and the renamed headings; `@todo` displayed completion values, including 50% for a temporary note with one checked and one unchecked task (the note was moved to trash after the check). Plugin reload reported no errors.
- Obsidian CLI live checks: confirmed `@ocr` is not suggested, validated four-direction navigation and edge clamping in the `@bookShelf` cards view, and confirmed Up/Down navigation remains available in a Base list view.

- Navigation regression validation: `pnpm typecheck`, `pnpm lint`, `pnpm test` (95 passing, including recycled-card, offscreen-filter, and asynchronous-selection regressions), and `pnpm build`. Live card and table navigation and text filtering exercised in `seam_test_vault`.
- Final live verification: command order is Create a new note, Archive, Move to Permanent, then general commands; filtered Enter opens Dune and closes the palette; no new runtime errors or error-console messages during the final navigation/filtering checks.

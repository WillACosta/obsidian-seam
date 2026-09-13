# Development Log — Iteration 02

- **Iteration ID:** `iteraction_02`
- **Date:** `2026-09-11`
- **Specs Directory:** [`docs/specs/iteraction_02`](../specs/iteraction_02/)
  - `create_note_if_none_find.md`
  - `intelissense_tags_props.md`
  - `new_commands.md`
  - `open_note_in_new_tab.md`
  - `remove_itens_permanent.md`
  - `search_in_text.md`

## Summary of Changes

### Added
- **In-Note Content Search**: Text queries now search inside note content (body text) in addition to title and path matching. Results display a contextual snippet with the matching text highlighted using Obsidian's `--text-highlight-bg` theme variable.
- **Create Note from Search**: When no results are found for a text query, the palette suggests a "Create new note: {query}" action that creates the note in the configured Fleeting folder and opens it immediately.
- **Open Note in New Tab**: Notes selected from the palette can be opened in a new tab using `Cmd+Enter` (Mac) or `Ctrl+Enter` (Win/Linux). Default Enter opens in the current active tab.
- **Archive Current Note Command**: New `archive-current-note` command (Obsidian command palette + Seam palette) that archives the currently open note. Only visible when a markdown note is active.
- **Move to Permanent Command**: New `move-to-permanent` command that moves the currently open note to the configured Permanent folder. Uses the dynamic folder name from settings.
- **Tag Intellisense Preservation**: Seam now maintains a hidden `.tag-registry.md` file inside the plugin directory that preserves Seam-managed tags (`#archive`, `#permanent`, `#archived`, `#todo`) and properties (`status`) in Obsidian's metadata cache, ensuring they continue to appear in tag auto-suggestions even after all occurrences are removed from notes.
- **Fleeting Folder Setting**: Added `fleetingFolder` setting (default: `Fleeting`) for configuring the default location of notes created from the palette.
- **Async Content Search**: `getSuggestions()` now returns `Promise<PaletteItem[]>` for text queries, leveraging Obsidian's native async support in `SuggestModal`. This enables content search without breaking arrow-key navigation.
- **Snippet Extraction**: Added `extractMatchSnippet()` utility that extracts contextual text around a search match with word-boundary snapping and ellipsis indicators.
- **Title & Tag Highlighting**: Note titles and tags in search results are highlighted with the matching query text, using the same `--text-highlight-bg` theme variable as content snippets.
- **`renderHighlightedText` Helper**: Reusable function that renders text into a DOM element with all matching query substrings highlighted.

### Changed
- **Settings Refactor: "Moving Notes Behavior"**: Renamed "Archive Behavior" cleanup section to "Moving Notes Behavior". The cleanup settings (`enableMoveCleanup`, `moveCleanupTags`, `moveCleanupProperties`) now apply to both archive and permanent move operations, not just archiving.
- **PermanentAction Cleanup**: `PermanentAction` now performs the same post-move tag and property cleanup as `ArchiveAction`, using the shared `updateNoteTagsAndProperties` pipeline.
- **Plugin ID**: Changed from `seam` to `obsidian-seam` to comply with Obsidian community plugin naming guidelines.
- **Settings Migration**: Added automatic migration logic for renamed settings (`enableArchiveCleanup` → `enableMoveCleanup`, `archiveCleanupTags` → `moveCleanupTags`, `archiveCleanupProperties` → `moveCleanupProperties`).
- **Contextual Palette Commands**: The "Archive current note" and "Move to Permanent" palette commands dynamically display the active note name and configured destination folder.

### Fixed
- **Palette Rendering for Actions**: The `renderSuggestion` method now correctly handles the new `'create'` palette item type with appropriate icon (`file-plus`).
- **Arrow Key Navigation During Content Search**: Fixed arrow keys not cycling between results during in-content text search. Root cause: manual `updateSuggestions()` calls from debounced async callbacks were resetting the cursor position. Fix: use Obsidian's native async `getSuggestions` support (`T[] | Promise<T[]>`) instead of manual async + `updateSuggestions()`.
- **Cmd+Enter / Ctrl+Enter Not Opening in New Tab**: Fixed modifier key detection for opening notes in a new tab from the palette. Root cause: `SuggestModal`'s internal Enter handler does not preserve modifier state when calling `onChooseSuggestion`, so `Keymap.isModEvent(evt)` always saw no modifier. Fix: register a custom `['Mod'], 'Enter'` handler on the modal's `scope` that intercepts the event before the default handler, reads the selected item from the internal `chooser`, and opens it via `workspace.getLeaf('tab').openFile(file)`.

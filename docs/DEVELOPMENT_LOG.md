# Seam — Development Log Registry

This document serves as the authoritative development log and evolution tracker for the Seam plugin. Each development iteration records its ID, date, associated specifications directory, and a detailed summary of changes in changelog format.

---

## [Iteration 02] - 2026-09-11

- **Iteration ID:** `iteraction_02`
- **Date:** `2026-09-11`
- **Specs Directory:** [`docs/specs/iteraction_02`](specs/iteraction_02/)
  - `create_note_if_none_find.md`
  - `intelissense_tags_props.md`
  - `new_commands.md`
  - `open_note_in_new_tab.md`
  - `remove_itens_permanent.md`
  - `search_in_text.md`

### Summary of Changes

#### Added
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

#### Changed
- **Settings Refactor: "Moving Notes Behavior"**: Renamed "Archive Behavior" cleanup section to "Moving Notes Behavior". The cleanup settings (`enableMoveCleanup`, `moveCleanupTags`, `moveCleanupProperties`) now apply to both archive and permanent move operations, not just archiving.
- **PermanentAction Cleanup**: `PermanentAction` now performs the same post-move tag and property cleanup as `ArchiveAction`, using the shared `updateNoteTagsAndProperties` pipeline.
- **Plugin ID**: Changed from `seam` to `obsidian-seam` to comply with Obsidian community plugin naming guidelines.
- **Settings Migration**: Added automatic migration logic for renamed settings (`enableArchiveCleanup` → `enableMoveCleanup`, `archiveCleanupTags` → `moveCleanupTags`, `archiveCleanupProperties` → `moveCleanupProperties`).
- **Contextual Palette Commands**: The "Archive current note" and "Move to Permanent" palette commands dynamically display the active note name and configured destination folder.

#### Fixed
- **Palette Rendering for Actions**: The `renderSuggestion` method now correctly handles the new `'create'` palette item type with appropriate icon (`file-plus`).
- **Arrow Key Navigation During Content Search**: Fixed arrow keys not cycling between results during in-content text search. Root cause: manual `updateSuggestions()` calls from debounced async callbacks were resetting the cursor position. Fix: use Obsidian's native async `getSuggestions` support (`T[] | Promise<T[]>`) instead of manual async + `updateSuggestions()`.
- **Cmd+Enter / Ctrl+Enter Not Opening in New Tab**: Fixed modifier key detection for opening notes in a new tab from the palette. Root cause: `SuggestModal`'s internal Enter handler does not preserve modifier state when calling `onChooseSuggestion`, so `Keymap.isModEvent(evt)` always saw no modifier. Fix: register a custom `['Mod'], 'Enter'` handler on the modal's `scope` that intercepts the event before the default handler, reads the selected item from the internal `chooser`, and opens it via `workspace.getLeaf('tab').openFile(file)`.

---

## [Iteration 01] - 2026-09-02

- **Iteration ID:** `iteraction_01`
- **Date:** `2026-09-02`
- **Specs Directory:** [`docs/specs/iteraction_01`](specs/iteraction_01/)
  - `improve-search.md`
  - `remove-items-after-archive.md`
  - `ui-improvements.md`

### Summary of Changes

#### Added
- **Tag Prefix & Live Filter Matching**: Added prefix matching for tag queries (e.g., `#ele` dynamically matches `#electronics`, `#electricity`, and nested sub-tags like `#electronics/components`).
- **`||` & `|` Universal OR Operators**: Added support for language-agnostic `||` and `|` operators in `QueryParser` and `SearchService` (supporting `#tag1 || #tag2` and `#tag1||#tag2`), maintaining backward compatibility with `OR`.
- **Post-Archive Cleanup**: Added automated removal of designated workflow tags (`#permanent`, `#todo`) and frontmatter properties (`status`) when notes are archived.
- **Archive Cleanup Settings**: Added settings toggle `Remove tags and properties after archiving a note` (`enableArchiveCleanup`), along with configurable tag (`archiveCleanupTags`) and property (`archiveCleanupProperties`) input fields.
- **Universal Palette Icons Setting**: Added `Show icons in Universal Palette` (`showIcons`) setting to enable or disable icons across search results and commands.
- **Folder Icons & Styling in Search**: Search results now display a styled folder container with Lucide folder icons to clearly distinguish containing folders from note titles.
- **Command Icons**: Commands in the Universal Palette now feature Lucide command/terminal icons.

#### Changed
- **Command Item Styling**: Removed the left accent border on `.seam-palette-command` in favor of cleaner icon-integrated command listings.
- **Atomic Metadata & Tag Updates**: Refactored `ArchiveAction` post-archive operations into an atomic frontmatter and inline text mutation pipeline (`updateNoteTagsAndProperties`).

#### Fixed
- Fixed trailing whitespace left behind on lines when removing inline tags.
- Fixed race conditions during post-archive metadata modification by eliminating redundant metadata cache lookups during file rename transactions.

---

## [Iteration 00] - 2026-08-26 (v0.1.0 Initial Foundation)

- **Iteration ID:** `iteraction_00`
- **Date:** `2026-08-26`
- **Specs Directory:** [`docs/specs/main`](specs/main/)
  - `product_v0.1.0.md`
  - `tech_v0.1.0.md`

### Summary of Changes

#### Added
- **Core Automation Engine**: Implemented `AutomationService` and `AutomationQueue` with 750ms debounce and serialization to prevent concurrent mutations.
- **Tag-Driven Routing**:
  - `#permanent` moves notes to `Permanent/` and strips the action tag.
  - `#archive` moves notes to `Archive/`, strips `#archive`, and adds `#archived` state tag.
- **Safety & Conflict Handling**:
  - Dual action tag conflicts (`#archive` + `#permanent`) are preserved untouched and flagged.
  - Destination filename collisions prevent overwrites and register non-destructive error states.
  - Action tags are only stripped after file move transactions succeed.
- **Startup & Periodic Reconciliation**: Implemented `Reconciler` to scan the vault using `MetadataCache` on workspace readiness and at a 15-minute periodic interval.
- **Universal Palette**: Floating `SuggestModal` providing unified note search, tag search, and command execution.
- **Query Parser**: Custom parser supporting positive tags (`#tag`), negative tags (`-#tag`), AND combinations, and plain text search.
- **Settings Tab**: `SeamSettingsTab` for configuring folders, automation toggle, durable state tags, and reconciliation frequency.
- **Commands**: Registered `Open Universal Palette`, `Archive all notes with #archive`, `Process pending automations`, and `Show automation status`.
- **Mobile First-Class**: Designed with zero Node.js/Electron dependencies (`isDesktopOnly: false`).
- **Test Suite**: Automated unit tests using Node.js test runner covering query parsing, tag logic, and regex stripping.

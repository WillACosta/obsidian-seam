# Changelog

All notable changes to Seam are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-09-13
<!-- iterations: iteration_00..iteration_05 -->

Initial public release of **Seam** — Frictionless note organization and Universal Palette for Obsidian.

### Added

- **Core Automation Engine**:
  - Event-driven background queue with 750ms debounce and serialization to prevent concurrent mutations.
  - Startup and periodic vault reconciliation (default 15 minutes) to ensure no action tags are missed.
  - 100% native Obsidian APIs with zero desktop-only dependencies (`isDesktopOnly: false`), fully compatible with macOS, Windows, Linux, iOS, iPadOS, and Android.
- **Tag-Driven Note Organization**:
  - `#permanent`: Moves notes to the designated `Permanent/` folder and strips the action tag.
  - `#archive`: Moves notes to the designated `Archive/` folder, strips `#archive`, and adds the durable `#archived` state tag.
  - Conflict prevention: Notes containing both `#archive` and `#permanent` are left untouched and flagged as a conflict.
  - Overwrite protection: Moving notes checks for destination filename collisions without overwriting existing files.
  - Safe ordering: Notes are relocated before tags or properties are modified, ensuring operations are recoverable if interrupted.
- **Post-Move Cleanup ("Moving Notes Behavior")**:
  - Automatically strips temporary scratch tags (e.g., `#todo`, `#permanent`) and frontmatter properties (e.g., `status`) when moving notes to `Permanent/` or `Archive/`.
  - Configurable tags list (`moveCleanupTags`) and frontmatter properties list (`moveCleanupProperties`) in plugin settings.
  - Cleanly strips the predefined `#archived` tag when notes are moved from `Archive/` back to `Permanent/` via command or `#permanent` tag.
- **Universal Palette (`Cmd + K` on Mac / `Ctrl + K` on Windows/Linux)**:
  - Unified search modal combining title matching, in-note body text search, tag filtering, and automation actions.
  - **Full-Text In-Note Search**: Searches inside note content with contextual snippets and term highlighting (`--text-highlight-bg`).
  - **Interactive Tag Suggestion & Narrowing**: Typing `#` lists vault tags; typing `#prefix` live-filters tags; selecting a tag displays interactive filter chips (`#tag×`) and narrows results in real-time using AND logic.
  - **Instant Note Creation**: Suggests "Create new note: {query}" when no results match, creating a new note in the `Fleeting/` folder.
  - **Fleeting Note Template**: Support for initializing new fleeting notes from a user-configured template (`fleetingNoteTemplate`).
  - **Open in New Tab**: Press `Cmd + Enter` (Mac) or `Ctrl + Enter` (Win/Linux) to open any suggestion in a new editor tab.
  - **Command Mode**: Type `>` or browse built-in actions directly from the palette.
- **Shortcut Customization & Badges**:
  - Default cross-platform hotkey `Cmd + K` / `Ctrl + K` (`Mod+K`).
  - Interactive key recorder in plugin settings to customize the Universal Palette hotkey, with native shortcut badges and a "Reset to default" button.
  - Direct button in settings to open Obsidian's native Hotkeys manager filtered to Seam.
- **Internationalization (i18n)**:
  - Automatic language detection using Obsidian's runtime locale.
  - Complete English (US) and Brazilian Portuguese (`pt-BR`) translations for all commands, palette actions, notice alerts, and settings.
  - Automatic fallback to English for unsupported languages.
  - Complete Brazilian Portuguese documentation in `README.pt-br.md`.
- **Plugin Commands**:
  - `Seam: Open Universal Palette` (`Cmd+K` / `Ctrl+K`)
  - `Seam: Archive current note` (contextual to active markdown note)
  - `Seam: Move to Permanent` (contextual to active markdown note)
  - `Seam: Archive all notes with #archive` (batch processing)
  - `Seam: Process pending automations`
  - `Seam: Show automation status`
- **Tag Intellisense Registry**:
  - Hidden registry note `.tag-registry.md` that keeps Seam-managed tags (`#archive`, `#permanent`, `#archived`, `#todo`) and properties (`status`) indexed in Obsidian's metadata cache even after notes are organized.
- **Visual Polish**:
  - Lucide icons for folders, commands, and tag suggestions.
  - Setting toggle `showIcons` to show or hide icons in search results and palette suggestions.

### Fixed

- Fixed archiving command false-positive "Conditions no longer met" notification when triggered from active editor.
- Fixed retention of predefined `#archived` tag when un-archiving or moving notes to `Permanent/`.
- Fixed arrow-key navigation in search results during asynchronous content queries.
- Fixed modifier key detection (`Cmd+Enter` / `Ctrl+Enter`) in `SuggestModal` for opening notes in a new tab.
- Fixed trailing whitespace left behind when stripping inline markdown tags.
- Fixed redundant text `#` symbol in tag suggestion listings.

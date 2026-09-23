# Changelog

All notable changes to Seam are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-09-23

### Fixed

- **Release note images**: Resolve repository-relative images from GitHub so screenshots display correctly inside Seam's update modal.

## [2.0.0] - 2026-09-23
<!-- iterations: iteration_06..iteration_07 -->

!["Seam v2 Showcase"](./docs/images/v2.0.0/seam_v2_showcase.gif)

### Added

- **Quick Add workflows**: Create notes from configurable choices with templates, folders, opening behavior, focus, icons, draft persistence, and collision handling.

!["Quick Add V2"](./docs/images/v2.0.0/quick_add_choices.png)

- **Advanced Universal Palette search**: Search exact phrases with double quotes and filter notes with `@untagged`, `@docs`, `@images`, `@task`, `@todo`, `@done`, and `@code`.

!["Special Search"](./docs/images/v2.0.0/special_search.png)

- **Negated tag search**: Prefix a tag with `!` to exclude matching notes, such as `#projects !#archived`.

!["Filtering Tags"](./docs/images/v2.0.0/filtering_tags.png)

- **Recent Files**: Browse the ten most recently modified Markdown notes from the Universal Palette.

!["Commands Listing"](./docs/images/v2.0.0/commands_listing.png)

- **Release updates**: Choose when Seam announces updates and read the release notes for the currently installed version from the Updates settings.

### Changed

- **Universal Palette**: Added contextual helper text, cleaner command navigation, tag filtering guidance, and Backspace navigation for secondary views.
- **Quick Add settings**: Added choice filtering, reordering, duplication, deletion, path suggestions, and native icon previews.

### Fixed

- **Quick Add creation**: Fixed template and path persistence, Enter submission, collision safety, numbered new-note titles, and palette dismissal after successful creation.

## [1.0.4] - 2026-09-15

### Changed

- Simplified the English and Brazilian Portuguese documentation for clearer onboarding, workflows, feature descriptions, settings, and commands.

### Fixed

- Removed a settings refresh call introduced after Seam's declared minimum Obsidian version while preserving automatic conditional-setting updates.
- Removed redundant TypeScript assertions reported by Obsidian's source analysis.

## [1.0.3] - 2026-09-14

### Added

- **Configurable Automation Delay**:
  - Added an **Automation Delay** setting allowing users to configure note organization timing:
    - **When switching notes** (default): Keeps notes undisturbed while writing or reading, and quietly moves them in the background as soon as you switch to another note or leaf.
    - **Timed delays** (1s, 2s, 5s): Debounced delays that also trigger immediately upon note switch for seamless transitions.
- **Universal Palette Hotkey Display**:
  - Added a shortcut badge in plugin settings displaying the current hotkey assigned to the Universal Palette (e.g. `⌘ K` on macOS, `Ctrl + K` on Windows/Linux) with a direct link to Obsidian's native Hotkeys manager to customize it without conflicts.
- **Showcase & Visual Walkthrough**:
  - Added an interactive visual preview in documentation showcasing note organization and Universal Palette capabilities.
- **Project Sponsorship**:
  - Added GitHub Sponsors and Buy Me a Coffee funding options (`FUNDING.yml`).

### Changed

- Updated project license to GNU General Public License v3.0 (GPL-3.0-or-later).

## [1.0.2] - 2026-09-13

### Changed

- Replaced HTML heading elements in settings tab with native `Setting.setHeading()` API.
- Migrated operating system detection to Obsidian's native `Platform.isMacOS` API.
- Replaced inline style assignments with CSS classes for palette tag chips.
- Removed default command hotkey to avoid conflicts with user hotkeys per Obsidian review guidelines.
- Replaced third-party `builtin-modules` package with native Node.js built-in module resolution.

### Fixed

- Added popout window compatibility using `window.setTimeout` and `window.clearTimeout`.
- Handled un-awaited promises and tightened TypeScript strictness across automation and UI services.
- Removed unused Notice import in `AutomationService`.

## [1.0.1] - 2026-09-13

### Changed

- Updated plugin manifest metadata per Obsidian review requirements.

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

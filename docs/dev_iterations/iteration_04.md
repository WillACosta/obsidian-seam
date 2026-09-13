# Development Log — Iteration 04

- **Iteration ID:** `iteration_04`
- **Date:** `2026-09-13`
- **Specs Directory:** [`docs/specs/iteration_04`](../specs/iteration_04/)
  - `archiving_process_failure.md`
  - `hide_tag_icons_on_search.md`
  - `i8n.md`

## Summary of Changes

### Added
- **Full Internationalization (i18n) Framework**:
  - Implemented language detection using Obsidian's official `getLanguage()` API (with fallbacks to `localStorage` and `moment.locale()`).
  - Added full localization dictionaries for **English (US)** (`en.ts`) and **Portuguese (Brazil)** (`pt-br.ts`).
  - Automatic graceful fallback to English when an unsupported language is selected in Obsidian.
  - Localized all plugin commands, Universal Palette placeholders, suggestions, action titles/descriptions, notice alerts, status reports, and the complete Settings tab interface.
  - Added unit tests for i18n key parity, locale detection, fallback behavior, parameterized string formatting, and test locale override (`setTestLocale`).
- **Brazilian Portuguese Documentation**:
  - Created `README.pt-br.md` providing a complete Brazilian Portuguese translation of the documentation.
  - Linked the Portuguese version from the main `README.md` and vice-versa.
  - Added an Internationalization section to the README explaining language detection, supported languages, fallback behavior, and contribution instructions.

### Fixed
- **Archiving Command False "Conditions no longer met" Failure**:
  - **Root Cause**: When "Archive current note" was triggered from a command or palette action, `AutomationService.archiveFile()` previously added the `#archive` tag via `addTag()` and immediately invoked `ArchiveAction.apply()`. Because Obsidian's `MetadataCache` re-indexing is asynchronous, `hasTag()` checked the stale cache before it finished updating, causing `canApply()` to fail and produce an erroneous notice `Archive failed: Conditions no longer met`, even though the file was subsequently archived when the background queue caught up.
  - **Fix**: Added an `options?: { force?: boolean }` parameter to `ArchiveAction.apply()` and `PermanentAction.apply()`. In `AutomationService.archiveFile()` and `AutomationService.moveFileToPermanent()`, Seam now directly applies the action with `{ force: true }`, moving the note to the destination folder and running post-move cleanup without requiring redundant intermediate tag writes or failing on asynchronous metadata cache delays.
- **Tag Icon Visibility in Search Results**:
  - Wrapped tag suggestion icon rendering in `UniversalPalette.renderSuggestion()` with `if (this.settings.showIcons)`.
  - When "Show icons in Universal Palette" is disabled in settings, tag icons (`#`) are now properly hidden from search results, matching the behavior of folder and command icons.
- **Default Shortcut & Custom Shortcut Configuration for Universal Palette**:
  - Registered `open-palette` command with a default hotkey of `[{ modifiers: ['Mod'], key: 'K' }]`, which maps natively to `Cmd + K` on macOS and `Ctrl + K` on Windows and Linux.
  - Added `paletteHotkey` to `SeamSettings` and persisted via plugin settings.
  - Built a custom shortcut recorder in `SettingsTab.ts` under the "Universal Palette" section with live keydown capturing, keyboard badge visualization, a "Reset to default" button, and direct integration with Obsidian's native Hotkey manager (`app.hotkeyManager.setHotkeys()` and `save()`).
  - Added hotkey helper utilities (`src/utils/hotkey.ts`) for parsing, formatting, and platform detection with 100% unit test coverage.

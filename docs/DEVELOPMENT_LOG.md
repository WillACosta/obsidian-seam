# Seam — Development Log Registry

This document serves as the authoritative development log and evolution tracker for the Seam plugin. Each development iteration records its ID, date, associated specifications directory, and a detailed summary of changes in changelog format.

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

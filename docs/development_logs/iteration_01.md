# Development Log — Iteration 01

- **Iteration ID:** `iteraction_01`
- **Date:** `2026-09-02`
- **Specs Directory:** [`docs/specs/iteraction_01`](../specs/iteraction_01/)
  - `improve-search.md`
  - `remove-items-after-archive.md`
  - `ui-improvements.md`

## Summary of Changes

### Added
- **Tag Prefix & Live Filter Matching**: Added prefix matching for tag queries (e.g., `#ele` dynamically matches `#electronics`, `#electricity`, and nested sub-tags like `#electronics/components`).
- **`||` & `|` Universal OR Operators**: Added support for language-agnostic `||` and `|` operators in `QueryParser` and `SearchService` (supporting `#tag1 || #tag2` and `#tag1||#tag2`), maintaining backward compatibility with `OR`.
- **Post-Archive Cleanup**: Added automated removal of designated workflow tags (`#permanent`, `#todo`) and frontmatter properties (`status`) when notes are archived.
- **Archive Cleanup Settings**: Added settings toggle `Remove tags and properties after archiving a note` (`enableArchiveCleanup`), along with configurable tag (`archiveCleanupTags`) and property (`archiveCleanupProperties`) input fields.
- **Universal Palette Icons Setting**: Added `Show icons in Universal Palette` (`showIcons`) setting to enable or disable icons across search results and commands.
- **Folder Icons & Styling in Search**: Search results now display a styled folder container with Lucide folder icons to clearly distinguish containing folders from note titles.
- **Command Icons**: Commands in the Universal Palette now feature Lucide command/terminal icons.

### Changed
- **Command Item Styling**: Removed the left accent border on `.seam-palette-command` in favor of cleaner icon-integrated command listings.
- **Atomic Metadata & Tag Updates**: Refactored `ArchiveAction` post-archive operations into an atomic frontmatter and inline text mutation pipeline (`updateNoteTagsAndProperties`).

### Fixed
- Fixed trailing whitespace left behind on lines when removing inline tags.
- Fixed race conditions during post-archive metadata modification by eliminating redundant metadata cache lookups during file rename transactions.

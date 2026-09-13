# Development Log — Iteration 03

- **Iteration ID:** `iteraction_03`
- **Date:** `2026-09-12`
- **Specs Directory:** [`docs/specs/iteraction_03`](../specs/iteraction_03/)
  - `fleeting_template.md`
  - `tag_results.md`

## Summary of Changes

### Added
- **Tag Suggestion Mode in Universal Palette**: Typing `#` in the palette now displays all available tags from the vault as selectable suggestions. Typing further (e.g., `#arch`) live-filters the tags. Selecting a tag inserts it into the query and, once all tags are resolved, shows matching notes. When refining a multi-tag query (e.g., `#electronics #`), already-selected tags are excluded from suggestions. Tags are rendered with accent-colored text and a `#` icon.
- **`getAllTags()` and `getTagsMatchingPrefix()` Methods**: New SearchService methods that collect all unique tags from the vault via MetadataCache and filter by prefix while excluding already-selected tags.
- **`searchBySelectedTags()` and `searchBySelectedTagsWithContent()` Methods**: SearchService methods to retrieve notes matching all chosen tag filters (AND logic) across the vault, with optional text query matching in title and content.
- **`noteHasTag()` Helper**: Exported function that accurately matches a file tag against a target filter tag (exact match or nested sub-tag descendants).
- **Fleeting Note Template Setting**: New `fleetingNoteTemplate` setting (default: empty) allows users to specify a vault path to a template note. When creating a new note from the palette's "Create new note" action, the template's content is used as the initial body.
- **`readTemplate()` Helper**: Private method in UniversalPalette that reads the configured template file from the vault, gracefully returning empty string if the file doesn't exist.
- **Tag Suggestion CSS**: Added `.seam-palette-tag-item` styling with accent-colored tag text via `--text-accent`.
- **Selected Tag Chips UI**: Added interactive chip component for selected tags in the palette input bar with `#tag` styling and an `x` remove button. Supports clicking `x` or pressing `Backspace` when the input is empty to remove the last chip.

### Fixed
- **Dynamic Tag Searching & Note Filtering**:
  - Intercepted `selectSuggestion` for `'tag'` items so selecting a tag does not close the modal, but instead appends the tag to active filter conditions.
  - Automatically clears the tag query from the text input upon selection and immediately performs a vault-wide note search displaying all notes with the chosen tag(s).
  - Typing `#` again dynamically swaps back to the tag suggestions listing, excluding tags already selected.
  - Multiple selected tags combine using AND logic, narrowing down matching notes as more tags are chosen.
  - All active tags in note results are individually highlighted in the tags metadata line.
- **Tag Listing UI Refactoring**: Removed the redundant text `#` symbol from tag names in suggestion results, displaying only the native `#` icon alongside the clean tag name for visual consistency with command and note results.

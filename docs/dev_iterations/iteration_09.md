# Development Log — Iteration 09

- **Iteration ID:** `iteration_09`
- **Date:** `2026-09-30`
- **Specs Directory:** [`docs/specs/iteration_09`](../specs/iteration_09/)
  - `search_ux.md`

## Summary of Changes

### Added
- **Note match navigation**: Opening a searched note selects and scrolls to its first content match; normal editor interaction clears the selection.
- **Result metadata**: Note results show their extension and content match count.
- **Directory filtering**: `dir:` works with tags in Palette and saved Seam-tag searches, with vault folder suggestions including paths with spaces.
- **All-file search**: Plain text and directory searches include attachments and other vault files by filename, path, and extension.
- **Split navigation**: Shift+Enter and Shift+Mod+Enter open a selected result in a vertical split.
- **Quick note command**: Create a UUID-named note from the configured Fleeting template in the configured folder, with root fallback, collision checks, and automatic opening.
- **Composable special searches**: Combine built-in and saved Seam-mode queries by intersection, then narrow their results with additional tag or directory filters. Base-mode searches remain standalone.

### Changed
- **Placeholder audit**: Shorten Palette and Quick Add prompts, correct the Seam search grammar, show the `>` command prefix, and align English and Portuguese wording. Settings placeholders with short path examples and filter labels remain concise.
- **Placeholder copy and visibility**: Shorten general, tag, and Base view placeholders; use the requested file-and-tag hint for Seam special searches with a visible gap after the query, and hide it for Base searches.
- **Search results**: Commands appear only for an empty Palette input or in `>` mode.
- **Palette guidance**: Active searches show quoted symbolic shortcuts for opening results, plus a `dir:` folder hint outside Base mode.
- **Directory and custom-query UI**: Selected folders use the accent color and one-step Backspace deletion; special queries insert a trailing space; the custom search mode reads “Seam search system” and folder suggestions have icon spacing.
- **Palette guidance and search filter labels**: Empty and active helper rows use their requested order, the active-search shortcut symbols have no quotes, `dir:` appears as a helper only when input is empty, and the placeholder documents all supported search prefixes. The custom search field is labeled “Seam filter.”
- **Composed-search tag chips**: Tags selected alongside special searches use the standard removable Seam chips, including excluded-tag styling. Chip removal preserves the special query and updates its filters.

### Fixed
- **Active filter placeholders**:
  - **Root Cause**: The selected special query occupied the input, hiding its native placeholder until a tag converted it to a separate prefix.
  - **Fix**: Display the tag guidance next to the mirrored special token and use consistent placeholder copy for special, tag, and directory filters.
  - **Verified Scenarios**: Live empty Palette, special-query selection from suggestions, composed tag selection, and ordinary tag selection.
- **Search footer and folder prompt**:
  - **Root Cause**: Special-search and tag-search footers omitted opening shortcuts, and the populated `dir:` input hid its native placeholder.
  - **Fix**: Show the requested ordered shortcuts, route Base Shift+Enter to a split, and display tag guidance beside the selected folder token.
  - **Verified Scenarios**: Live footer checks for Seam, Base, and tag queries; live `dir:Fleeting` placeholder inspection.
- **Caret after composed chips**:
  - **Root Cause**: The special query remained in the editable input before the trailing chips, placing the caret before selected tags.
  - **Fix**: Render the committed special query and tag chips before a separate editable input, while including the committed query in filtering.
  - **Verified Scenarios**: Live caret-position checks after one and two composed chips, excluded-tag selection, Backspace removal, and ordinary tag selection/removal.
- **Composed-filter order**:
  - **Root Cause**: All selected tags used the leading chip container, placing composed tags before the special query.
  - **Fix**: Place tags selected after a special query in a trailing chip container, preserving selection order and retaining the leading container for ordinary tag searches.
  - **Verified Scenarios**: Live position checks for `@fleetingNotes #ai` and ordinary `#books` selection, plus chip removal and default Backspace deletion.
- **Special-search tag completion**:
  - **Root Cause**: Special-search execution took priority over tag suggestions, and selecting a tag cleared the active special query.
  - **Fix**: Reuse Palette tag suggestions inside compatible special searches, retain selected tags inline, and remove completed tag tokens with one Backspace.
  - **Verified Scenarios**: Live completion, selection, and whole-token deletion for `@fleetingNotes #books`, excluded tags, and built-in `@todo` searches.
- **Mobile Base viewport**:
  - **Root Cause**: The Markdown embed paragraph and Base view expanded beyond the Palette's clipped mobile result area.
  - **Fix**: Size the embed wrapper and Base view to the available viewport and route keyboard navigation to the actual scrolling element.
  - **Verified Scenarios**: Mobile emulation of `@bookshelf` shows the viewport with the final row reachable by scrolling.

### Tests
- Parser, directory boundary, combined-filter, attachment filename/extension, and literal match-count regression tests; typecheck, lint, unit tests, build, and Obsidian CLI validation in `seam_test_vault`, including quick-note creation from a template and root-folder fallback.

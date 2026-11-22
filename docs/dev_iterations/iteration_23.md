# Development Log — Iteration 23

- **Iteration ID:** `iteration_23`
- **Date:** `2026-11-07`
- **Specs Directory:** [`docs/specs/iteration_23`](../specs/iteration_23/)
  - `move_images_into_layout.md`

## Summary of Changes

### Added

### Changed

- **Images move into new layouts**: Inserting a layout removes matching ordinary embeds from the source note, leaving the selected images in the new gallery. Unselected images, prose, other galleries, and Markdown examples remain intact.

### Fixed

- **Duplicate images after inserting Image Layout**:
  - **Root Cause**: The insert handler only inserted the generated block; it never removed existing note embeds for the selected images.
  - **Fix**: Resolve selected image identities relative to the source note and plan nonoverlapping changes against the opening snapshot. Apply matching-embed removals and block insertion through one public `Editor.transaction`, retaining the existing changed-note guard. Protected Markdown regions are excluded from removals.
  - **Verified Scenarios**: Wiki/Markdown embeds, captions and size aliases, vault path resolution, signed URLs, repeated images, inline prose and Unicode offsets, CRLF, insertion before/after/inside image ranges, unselected images, and protected frontmatter/code/comments/layouts.

### Tests

- All 473 tests, typecheck, formatting, lint, and production builds passed. Twelve new tests cover insertion plans, transaction integration, and concurrent-note protection.
- `mise run install:all` built and installed into the shared `seam_test_vault`; no personal-vault install or reload was run.
- Live validation selected two of three images through the Current note picker and submitted the layout. The note retained its heading, paragraph, and unselected image; each selected image appeared only once in the generated block. Live Preview rendered two loaded gallery images and the remaining unselected image.
- A single native Cmd+Z restored the original note exactly, including the original embeds; Redo restored the layout result exactly.
- Existing user edits to CHANGELOG.md were preserved. Temporary note/image fixtures and test globals were removed, the prior note was restored when available, and writing-history recording was restored after test activity.
- Runtime and console checks were clean. Physical mobile hardware was not tested; no modal styling changed.

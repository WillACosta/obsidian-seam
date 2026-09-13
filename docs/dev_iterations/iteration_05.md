# Development Log — Iteration 05

- **Iteration ID:** `iteration_05`
- **Date:** `2026-09-13`
- **Specs Directory:** [`docs/specs/iteration_05`](../specs/iteration_05/)
  - `fix_moving_to_permanent.md`

## Summary of Changes

### Fixed
- **Removal of Predefined `#archived` Tag and Temporary Items When Moving to Permanent**:
  - **Root Cause**: Previously, `PermanentAction.performPostMoveCleanup` only added `settings.permanentTag` and configured `moveCleanupTags` to the list of tags to strip. If a note was un-archived or moved from the `Archive/` folder to `Permanent/`, `settings.archivedTag` (`#archived`) and `settings.archiveTag` (`#archive`) were not included in the removal list, leaving the predefined `#archived` tag stuck on the note.
  - **Fix**:
    - Created dedicated pure cleanup resolution helpers in [`src/automation/TagCleanup.ts`](../../src/automation/TagCleanup.ts):
      - `getPermanentCleanupTags(settings)`: Resolves all tags that must be removed when moving to `Permanent/`, including `settings.permanentTag`, `settings.archiveTag`, `settings.archivedTag`, and any configured `moveCleanupTags` (even when disabled, action and state tags are safely stripped).
      - `getArchiveCleanupTags(settings)`: Resolves all tags that must be removed when archiving, including `settings.archiveTag`, `settings.permanentTag`, and configured cleanup tags.
      - `getMoveCleanupProperties(settings)`: Resolves all frontmatter properties configured for cleanup.
    - Updated `PermanentAction.ts` and `ArchiveAction.ts` to use these centralized helpers.
    - Deduplicated tags and properties in `updateNoteTagsAndProperties` using `Set` to prevent redundant regex passes and frontmatter modifications.
  - **Verified Scenarios**:
    - Scenario 1 (Universal Palette / Command): Moving an archived note to Permanent via "Move to Permanent" removes `#archived`, `#todo`, and configured frontmatter properties (`status`).
    - Scenario 2 (Adding `#permanent` tag): Adding `#permanent` to an archived note triggers automation, moving the note to `Permanent/` while stripping `#permanent`, `#archived`, `#todo`, and `status`.

### Tests
- Added 6 new unit tests in [`tests/TagLogic.test.ts`](../../tests/TagLogic.test.ts) covering:
  - Permanent cleanup tag resolution including `#permanent`, `#archive`, `#archived`, and cleanup tags.
  - `#archived` removal even when `enableMoveCleanup` is disabled.
  - Leading `#` stripping and tag deduplication.
  - Archive cleanup tag resolution.
  - Frontmatter property cleanup resolution.
  - Frontmatter tag filtering simulation for un-archiving notes.
- Verified in live Obsidian test vault (`seam_test_vault`) with Obsidian CLI across both tag and command execution workflows with 0 errors.

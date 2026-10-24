# Development Log — Iteration 11

- **Iteration ID:** `iteration_11`
- **Date:** `2026-10-23`
- **Specs Directory:** [`docs/specs/iteration_11`](../specs/iteration_11/)
  - `human_friendly_daily_note_name.md`
  - `new_built_in_special_queries.md`
  - `note_statistics.md`
  - `obsidian_workflows.md`
  - `unfinished_daily_note_data.md`
  - `universal_palette_history_cycling.md`

## Summary of Changes

### Added
- **Note statistics**: Show the current Markdown note's words, characters, paragraphs, estimated reading time, and localized modified/created dates in a block-based Universal Palette report. Offer the command in Obsidian and Seam only while a note is active. Count unsaved editor text without writing the note; show only dismiss in the footer and support Escape, close-button, and outside-click dismissal. Theme-aware cards and date rows adapt to narrow views; English and Brazilian Portuguese copy is included.
- **Special searches**: Find the ten most recently opened files with `@recentlyOpened`, or search the configured Fleeting and Permanent folders with `@fleeting` and `@permanent`. Include attachments, preserve recent-file order, and combine these searches with tags, text, folders, and other compatible special searches.
- **Daily task transfer**: From today's Daily Note, move unchecked and partially complete tasks to tomorrow or pull yesterday's pending tasks into today. Create missing destinations with the core Daily Notes folder, date format, and template. Preserve nested parent context and completed siblings; mark a retained task parent complete once its pending work has moved. Save active editor buffers, serialize transfers, and append successfully before changing the source. Roll back the append on source failure when the destination is unchanged; preserve both notes and request review if concurrent destination changes prevent rollback.
- **Missing Daily Notes**: Empty standalone `@today` and `@yesterday` searches offer to create and open the missing note with the core Daily Notes folder, format, and template. Existing or concurrently created notes are opened without overwriting them; filtered-out existing notes do not offer duplicate creation.
- **Palette history**: Press Up with an empty query to recall and cycle through previous queries, including composed filters, across Palette openings during the plugin session. Down moves toward an empty input; typing exits history navigation. History is deduplicated and kept in memory.

### Changed
- **Daily task command visibility**: Hide Move when today's note has no eligible pending tasks, and hide Pull when yesterday's note is missing or has no eligible pending tasks. Palette checks read the two source notes and any open editor buffers; synchronous Obsidian command checks use open editor content or public task metadata.
- **Daily Note results**: Display readable dates such as `2 Oct. 2026` and a calendar subtitle, using the configured Daily Notes format and location to identify notes. Filenames and links remain intact. English and Brazilian Portuguese labels and usage guides cover the additions.
- **Release metadata**: Prepare version `3.1.0`, retaining Obsidian `1.13.0` as the minimum version. These additive capabilities warrant a minor release.

### Fixed
- **Daily Note creation shortcuts**:
  - **Root Cause**: Missing Daily Notes were generic actions skipped by the tab/split handlers, and special-query instructions always used open labels before asynchronous results arrived.
  - **Fix**: Treat missing Daily Notes as creation suggestions, pass the requested tab/split destination through each suggestion's action, and refresh creation labels after the async search. Ordinary note creation shares the same destination-aware routing.
  - **Verified Scenarios**: Eight regression tests cover Enter, Mod+Enter, Shift+Enter, and Mod+Shift+Enter for both date queries, template-based creation at the correct date path, and returning to open labels once the note exists.
- **Palette history keyboard handling**:
  - **Root Cause**: The inherited suggestion navigation consumed Up before a later scope handler, and refreshing suggestions emitted an input event that reset the history cursor.
  - **Fix**: Handle history through the existing window capture listener and retain the cursor during programmatic query restoration, while allowing normal result navigation when typing a query.
  - **Verified Scenarios**: Real key events for recall after reopening, multiple Up presses, wrapping, Down to an empty input, composed query restoration, and typing before result navigation.

### Tests
- Note statistics follow-up: all 163 unit tests passed, with eight new cases for empty text, Unicode and Markdown word boundaries, code-point character counts, CRLF paragraphs, reading-time rounding, unsaved editor content, reading-mode fallback, and read errors. Typecheck, lint, and production build passed. Live test-vault checks verified contextual visibility for Markdown, empty views, and attachments, 203 words / 1,022 characters / 2 paragraphs / 2 min from current editor text, report selection through Seam commands, reading-mode content, the dismiss-only footer, Escape and close-button dismissal, and inert Enter/tab/split shortcuts. A 390 px viewport had no horizontal overflow; doubled report text scrolled while keeping the footer visible. Physical-device acceptance was not performed.
- Final statistics checks: desktop light and dark appearances were inspected, outside-click dismissal passed, and runtime/console error checks were empty after reloading the final build. Release consistency and whitespace checks passed. The original test-vault layout and appearance were restored, viewport emulation cleared, and temporary note/attachment fixtures moved to trash.
- Shortcut follow-up: all 155 unit tests passed, including eight Palette creation-routing regressions; typecheck, lint, production build, changelog validation, and whitespace checks passed. Real CDP key events in `seam_test_vault` verified all four shortcuts for both date queries, template content, current-tab reuse, new-tab counts, separate split groups, creation footer labels, and existing-note open labels. Runtime and console error checks were empty. Settings were restored byte-for-byte, the original layout restored, and temporary fixtures moved to trash.
- 147 passing unit tests, including 20 Iteration 11 cases covering nested task branches, completed and cancelled parents, ordered lists and continuations, YAML and code exclusion, template-based creation, repeated moves, pull direction, missing templates, destination/source write failures, concurrent edits, overlapping commands, custom date paths, attachment searches, folder boundaries, composition, recent ordering/limit, readable date recognition, and history deduplication. The shared Obsidian mock now uses the installed Moment implementation.
- Typecheck, lint, production build, release consistency validation, changelog validation, and whitespace checks passed.
- Live validation in the Git-ignored `seam_test_vault`: all three new searches, attachment inclusion, composed tag/text filtering, recent ordering, contextual command visibility, template-based daily-note creation, nested transfer and repeat handling, pulling yesterday, active unsaved editor content, real history keyboard events, and execution through the Palette. Existing `#permanent` and `#archive` moves and cleanup also passed.
- Desktop screenshot inspection and mobile emulation at a 390 px viewport confirmed the readable date and `calendar-days` subtitle. Mobile emulation is not physical-device acceptance.
- Runtime and captured console error checks returned no errors. Fixtures were removed, desktop mode restored, the core Daily Notes folder returned to `Resources/Daily`, and Seam folder settings returned to `Fleeting`, `Permanent`, and `Archive`. Mobile emulation reload cleared the temporary in-memory preference snapshot, so the test vault's automation flags were restored to their enabled defaults rather than verified original values.
- Added strict `obsidianmd/obsidian-workflows@v1` validation with the community scanner rules to PR checks, merged-version tagging, and release publication. Validation mode preserves the existing release publisher. The official action inputs and `v1` ref were checked; GitHub-hosted execution remains pending until the workflows run remotely.
- Daily Notes creation follows the Calendar project's template/folder approach through public vault APIs, without adding Calendar or depending on core plugin internals. Standard `date`, `time`, and `title` template tokens are supported; other plugins' template languages are outside this iteration.
- Follow-up validation: Five additional unit tests cover independent task availability, completed-only and missing sources, metadata parent handling, both missing daily-note creation targets, and a concurrently created note. Live Palette checks verified missing `@today` and `@yesterday` creation with Enter, template content, correct dates and paths, existing-note results, Pull-only then Move-only transitions and final hiding after transfer, and no creation action for an existing note excluded by text. Runtime and captured console checks were clean during the workflows. Fixture cleanup restored settings byte-for-byte from filesystem backups and reopened the original active note; Calendar emitted a temporary-folder warning during cleanup.

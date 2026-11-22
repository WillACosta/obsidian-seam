# Development Log — Iteration 22

- **Iteration ID:** `iteration_22`
- **Date:** `2026-11-06`
- **Specs Directory:** [`docs/specs/iteration_22`](../specs/iteration_22/)
  - `palette_reports_and_folding.md`

## Summary of Changes

### Added

- **Completion inside Note statistics**: One report now includes a collapsible task-completion section. Use Cmd+Enter on macOS, Ctrl+Enter elsewhere, or click/tap the heading to expand it. The section starts closed and includes feedback for notes without tasks.
- **Outline folds mirror the note**: Collapsing and expanding outline headings applies native CodeMirror folds in the matching note editors, preserves independently folded children, and initializes the outline from the current editor's folds. Note contents remain unchanged; a cursor inside a newly hidden range moves to its heading.

### Changed

- **One statistics command**: Remove the duplicate completion command and redirect saved completion-command pins to Note statistics. Keep configured Daily Notes display titles in the combined report without altering paths.
- **Back to commands**: Note statistics, Global Statistics, outline, and note-creation views return to their originating command query with Cmd/Ctrl+[. Reports opened from native commands return to `>`. Views opened from ordinary search retain ordinary Back behavior.
- **Workflow review guidance**: Workspace and Seam AGENTS.md now require agents to watch main-targeting PR checks, inspect the Obsidian action's reports rather than just its exit status, resolve all Errors/Warnings/Recommendations, and inspect the latest PR head after fixes. The supplied historical run succeeded despite scanner CSS warnings; there were no open main-targeting PRs during this session.

### Fixed

- **Palette shortcuts after an empty caption picker**:
  - **Root Cause**: View opening could yield while switching a note out of reading mode, so keyboard-scope setup and a no-image cancellation were separate operations. An incomplete or superseded subview could retain or interfere with input routing.
  - **Fix**: Await the view-opening result, push a child scope only for a mounted view, restore the Palette on empty/error outcomes, and bind Back/Close to the specific panel instance so late callbacks cannot close a newer view.
  - **Verified Scenarios**: No images in source and reading modes; the existing notice is shown, command-query input regains focus, and native ArrowDown navigation remains operational. Automated cases cover delayed cancellation, superseded views, and rejected openings.

### Tests

- All 461 tests, typecheck, formatting, lint, and the production build passed. Six new regressions cover native fold transactions, disclosure keyboard activation, and asynchronous Palette scope ownership; existing report/title/group tests were updated for the consolidated view.
- `mise run install:all` installed the changes into `seam_test_vault`; Seam was reloaded and runtime/console errors were checked.
- Live keyboard checks verified the combined 50% task report, Cmd+Enter expansion, a single statistics command, and command-mode Back from statistics, outline with a nonempty filter, Global Statistics, and note creation.
- Live outline folding verified child, parent, and parent-unfold transitions: editor fold sets changed from child-only to parent-and-child, then back to child-only. The cursor moved out of a newly folded body and the note text remained identical.
- At 390px, the combined report had no horizontal overflow and its native completion disclosure responded to a click. Physical mobile hardware was not tested.
- Temporary fixtures were removed, viewport emulation was restored, and test activity was excluded from writing-history recording. Final runtime and console checks were clean.

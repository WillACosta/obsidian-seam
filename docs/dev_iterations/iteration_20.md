# Development Log — Iteration 20

- **Iteration ID:** `iteration_20`
- **Date:** `2026-11-05`
- **Specs Directory:** [`docs/specs/iteration_20`](../specs/iteration_20/)
  - `global_statistics_accounting.md`

## Summary of Changes

### Added

- **Monthly writing summary**: Writing over time shows recorded words added this month, separately from the current vault word total, with English and PT-BR explanations of additions and deletions.

### Changed

- **Writing comparisons**: Compare matching calendar days in consecutive months, accounting for short months and leap years. Show an insufficient-history message when recording began during the comparison month, and a separate message for a genuinely zero baseline. Total words now describes current vault size.

### Fixed

- **Text moves inflating writing activity**:
  - **Root Cause**: Distant transaction changes were matched independently, and cut/paste transactions across editors had no shared move recognition.
  - **Fix**: Match retained tokens across all transaction windows and recognize a cut followed by the next matching paste within five minutes. Copy, undo/redo, unrelated writing, and mismatching pastes clear pending recognition. Existing history and its storage remain unchanged.
  - **Verified Scenarios**: Both directions of distant moves, cross-note cut/paste, subsequent copies, intervening edits, undo/redo, repeated notifications, and expiration.

### Tests

- Typecheck, lint, and all 423 tests passed. New regressions cover incomplete history, matching comparison days, zero baselines, declines, New Year, leap years, short months, and text moves.
- Changed-file formatting, release consistency, and `git diff --check` passed. The full `ci:quality` command stops on a pre-existing formatting issue in unchanged `src/main.ts`; that unrelated file was preserved.
- `mise run install:all` built and copied all implemented plugins into the shared test vault; Seam was reloaded there.
- The live dashboard keeps 1,710 current words separate from 980 words added this month and reports insufficient comparison history. Temporary in-memory snapshots verified a +50% comparison over the first five days, a zero baseline, and empty activity without modifying saved history.
- Live CodeMirror clipboard events verified cut/paste across notes, repeated paste, copy invalidation, deletion, and actual editor undo/redo. Temporary notes and their intercepted activity were cleaned up; saved writing history remained unchanged.
- English and PT-BR desktop/mobile-emulation checks verified the summary, help text, Words/Notes switching, and no horizontal overflow at 390 px. Mobile emulation and the language override were restored afterward. Physical mobile devices were not tested.
- Final runtime and console-error buffers were empty. No test notes remained; the vault still contained 57 notes and 1,710 words, with 980 recorded additions this month.

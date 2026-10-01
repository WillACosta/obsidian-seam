# Development Log — Iteration 10

- **Iteration ID:** `iteration_10`
- **Date:** `2026-10-01`
- **Specs Directory:** [`docs/specs/iteration_10`](../specs/iteration_10/)
  - `sources_ingestion_automation.md`

## Summary of Changes

### Added
- **Source notes**: Automatically create a `#source` note in the configured Fleeting folder for documents and images exported to `Sources/` or its subfolders, with a capture date and an embedded or linked original. Common formats include PDF, Word, OpenDocument, spreadsheets, presentations, text, CSV/TSV, EPUB, HTML, and Apple iWork files.
- **Source note settings**: Configure the source folder, independently enable or disable automatic note creation, and use a custom Markdown template with `{{attachment}}`, `{{attachment_path}}`, `{{title}}`, and `{{date}}` placeholders.
- **Create note from attachment**: Pick a document or image from the configured source folder to create and open its companion manually, even when automatic creation is disabled; open the existing companion when already registered.
- **Source review search**: Find `#source` companion notes with built-in `@sources`, including notes moved to Permanent or Archive, and combine it with other supported Palette filters.
- **Continuous PDF pages**: Generated PDF source notes include `cssclasses: [seam-source-pdf]` to remove viewer gaps, borders, and shadows between embedded pages while preserving custom template classes.

### Changed
- **Automation pipeline**: Source ingestion shares Seam's vault events, automation delay, startup scan, and periodic reconciliation while retaining its own enable setting and the existing tag-driven lifecycle.
- **Source templates**: Use a minimal default containing `tags: [source]`, `captured`, the PDF class when applicable, and an Original section with a blank line before the document. Preserve custom template tags and properties; embed PDFs and supported images, and link other document types. Existing links and embeds provide duplicate detection without generated `source_attachment` or `source_app` properties.

- **Source note wording and command order**: Label the settings group and search description “Source notes,” describe document creation in the subtitles, and keep Create note from attachment immediately after Create a new note in every Seam command listing.

### Fixed
- **Duplicate source registration**:
  - **Root Cause**: Concurrent import requests, companions moved outside Fleeting, and asynchronous attachment link updates during renames can make a previously registered export appear new.
  - **Fix**: Serialize automatic and manual registration, resolve existing links across the vault, track attachment rename paths, and disambiguate occupied note filenames without overwriting notes.
  - **Verified Scenarios**: Automated concurrency, stale rename metadata, filename conflicts, and existing companion tests; live Permanent/Archive moves and attachment renaming without additional companions.

### Tests
- 119 passing unit tests, including a queue regression for importing attachments without an active file or any navigation event, plus 17 source ingestion regressions covering folder boundaries, custom templates, registration races, lifecycle folders, filename conflicts, disabled automation, unload cancellation, invalid templates, deleted attachments, reconciliation, and composed `@sources` filters; expanded document format coverage, minimal default properties, original links, native link text, and PDF class merging without duplicates.
- Typecheck, lint, production build, release metadata validation, and whitespace checks.
- Obsidian CLI validation in the Git-ignored `seam_test_vault`: automatic image ingestion with tag automation disabled; manual PDF ingestion with source automation disabled; real YAML template rendering; picker filtering and selection; `#permanent` and `#archive` workflows; attachment renames; settings rendering; and `@sources` results in mobile emulation, with screenshot inspection. Refinement checks cover automatic Word document import, exact minimal PDF layout, embed-only duplicate detection, `@docs` document results, removal of Source app, and command ordering in empty and `>` modes with and without an active note.
- Runtime and console error checks returned no errors after workflow validation. Test settings and desktop mode were restored, and temporary fixtures were removed.
- PDF class validation: a copied handwritten PDF automatically generated a note with `seam-source-pdf`; all inter-page gaps measured zero in both Live Preview and Reading view, the final page rendered when scrolling to the end, and screenshots confirmed the scoped layout. Unit coverage checks class preservation and deduplication for custom templates and excludes the class from non-PDF source notes.
- No-open-file investigation: both a vault-created PDF and a PDF copied directly into the watched folder generated notes after the default two-second delay. The test vault's configured source folder was `Resources`, so its existing `Sources/` imports were correctly excluded; the configured preference was preserved.

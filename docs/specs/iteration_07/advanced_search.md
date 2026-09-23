# Advanced Search

1. Support exact phrase searches by removing the surrounding double quotes from a search term and matching the resulting string as a contiguous phrase.

2. Support special searches from the Universal Palette:

- `@untagged`: notes without tags.
- `@docs`: notes with document attachments such as PDF, Word, spreadsheet, or presentation files.
- `@images`: notes with image attachments.
- OCR attachment search is deferred while its cross-platform implementation is evaluated.
- `@task`: notes with at least one task.
- `@todo`: notes with at least one incomplete task.
- `@done`: notes with tasks where every task is complete.
- `@code`: notes with at least one code block.

Typing `@` lists the supported special searches. The Universal Palette displays concise helper text for both special-search mode and exact phrase syntax.

The deferred OCR design must use only cross-platform APIs and must account for binary formats and image OCR.

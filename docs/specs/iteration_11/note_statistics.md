# Statistics for the currently opened note

- Add **Show note statistics** to Obsidian's commands and Seam's Universal Palette commands. Show it only while a Markdown note is active; hide it for an empty view or attachment.
- Selecting it inside Seam replaces the search content with a report in the same Universal Palette. Invoking it from Obsidian opens the Palette directly to the report.
- Show the note title and vault-relative path, a two-column grid for Words, Characters, Paragraphs, and Read time, and full-width Modified and Created date blocks. Use the supplied reference images as the visual direction and Obsidian theme variables for appearance.
- The report is read-only and calculated when opened. Use current editor text in source/live-preview mode, including unsaved changes; otherwise read the note through the vault API. Do not save or mutate the note to calculate statistics.
- Count words as Unicode letter/number sequences, including combining marks, internal apostrophes, and hyphens. Count the full note text, including frontmatter and code; Markdown punctuation alone does not count as a word.
- Characters include spaces, line breaks, and Markdown syntax, counted as Unicode code points. Paragraphs are nonempty blocks separated by blank lines. Reading time is rounded up at 200 words per minute, with zero minutes for an empty note.
- Use filesystem creation/modification timestamps from `TFile.stat`, displayed as localized dates and times. Unsaved edits affect text counts; Modified reflects the last filesystem write.
- The footer contains only **esc dismiss**. Provide a close button and the usual outside-click dismissal. Enter and its tab/split variants must not trigger a previous search result. Hide search input and suggestions while showing the report.
- Support English and Brazilian Portuguese. At narrow widths and larger text sizes, allow scrolling and wrapping without horizontal overflow.

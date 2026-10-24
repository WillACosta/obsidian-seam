# Delete the currently opened note

- Add **Delete current note** to Obsidian commands and Seam's Universal Palette commands, visible only while a Markdown note is active.
- Use the native Obsidian deletion flow, respecting the configured deleted-file destination: system trash, the vault `.trash` folder, or permanent deletion.
- Respect the native delete-confirmation setting and dialog. Cancelling must leave the note intact; do not add a second custom prompt or perform deletion twice.
- This is an explicit user command, never normal automation. Do not delete an attachment or a stale Palette target after the user has switched notes.
- Prevent duplicate concurrent prompts for the same note, and show a localized notice if the native action fails.
- Support English and Brazilian Portuguese; keep public APIs and mobile compatibility.

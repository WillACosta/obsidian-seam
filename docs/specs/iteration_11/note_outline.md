# Outline for the currently opened note

- Add **Show note outline** to Obsidian commands and Seam's `>` commands, visible only while a Markdown note is active.
- Display all headings, including nested headings, inside the Universal Palette. Preserve document order and indicate heading levels with indentation.
- Use Obsidian's heading metadata, including ATX and Setext headings and excluding code blocks. Keep duplicate headings as separate entries with their own line destinations.
- Up and Down navigate; Enter or a click closes the Palette and jumps to the selected heading in the current note pane. Escape dismisses.
- Show **↑↓ navigate**, **↵ select**, and **esc dismiss** in the footer. When the text input is empty, also show **⌫ back**; Backspace returns to the main Palette search without closing the modal. With text present, Backspace deletes text normally. Do not offer tab/split shortcuts.
- Show a clear empty state when the note has no headings. Allow filtering by heading text without entering global note search.
- Follow the existing Obsidian theme and support English and Brazilian Portuguese. Do not mutate the note.

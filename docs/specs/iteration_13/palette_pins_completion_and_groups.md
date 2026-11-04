# Palette pins, completion, and grouping

Source: user request, 2026-10-26.

- Add contextual Pin/Unpin current note commands, separate from calendar pins. Persist note references and show them first whenever the Palette input is empty, even with default commands hidden. Follow file/folder moves and remove deleted references. Keep the existing five special-query pins and three calendar pins independent; no new limit was requested for Palette note pins.
- Offer `> Show current note's percentage completion` only for Markdown notes containing tasks. Report the current editor buffer when available, including unsaved text. Show a theme-colored percentage bar and small counts for unfinished (`[ ]`), partially done (`[/]`), completed, and total items. Partial tasks do not count as fully completed; keep the existing `@todo` percentage consistent. Other checkbox statuses retain the existing completed convention. Ignore frontmatter, comments, and code examples.
- Render completion inside the Universal Palette, reusing its report/dismiss behavior. Respect reduced motion, theme colors, and narrow windows.
- Add dimmed, nonselectable group labels for related commands, including Note Statistics and Move Notes. Separate built-in/custom special queries while preserving pin priority and configured ordering, repeating a label at a category boundary when needed.
- Add a default-on Interface setting to show group names.
- On the Search Queries title row, right-align a small, muted `Pinned • N/5` indicator with the subtitle underneath, counting all pinned built-in/custom queries, independently of filtering.

- In the completion and Note statistics reports, Backspace returns to normal Palette search and focuses its editable input; advertise `⌫ back` beside Escape in the footer. This also works when opening the report through the native Obsidian command.

- Calendar pinned-note buttons show a theme-colored background on hover and visible keyboard focus.

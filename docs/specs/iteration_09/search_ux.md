# Search UX and mobile Base fixes

- Opening a Markdown note from a Universal Palette text result selects the first matching passage in the note. This temporary selection clears through normal editor interaction.
- Note search results display the file extension and the number of literal, case-insensitive content matches when a search term is present.
- `dir:DIR_NAME` filters files within the named vault folder and its descendants, combines with positive/negative tag filters, and offers folder-path completion in the Palette and saved Seam search query editor. Quote paths containing spaces.
- Plain searches find any vault file by name, path, or extension. Markdown content remains searchable; other file types are matched by filename and path.
- A selected `dir:` token has the accent color. Backspace at the end of that token removes it as one unit; the footer explains `dir:` outside Base searches.
- Search results open with Enter, in a new tab with Mod+Enter, or in a vertical split with Shift+Enter or Shift+Mod+Enter. The active default-search footer shows symbolic shortcuts in quotes; the Base and empty-input footers omit them.
- Selecting a special search inserts a trailing space.
- The custom search mode reads “Seam search system,” and folder suggestions in its filter field space the folder icon from the path.
- Universal Palette footer hints use the requested order for empty input and active searches; active-search hints omit quotes and the directory hint. The placeholder describes `#tags`, `@special`, and `dir:` syntax.
- The custom search field is named “Seam filter” and describes the supported Seam tag, text, and directory filters.
- A “Create a quick note” command creates a randomly named Markdown note in the configured Fleeting folder (or vault root when blank), applies the configured template when readable, checks for filename collisions, and opens the note. It leads the Seam command lists immediately before “Create a new note.”
- Search results contain notes and tag/folder suggestions only. Commands appear with an empty input or the `>` prefix.
- Embedded Base results have a correctly sized, scrollable viewport in mobile Obsidian.
- Built-in special searches and saved “Seam search system” queries can be combined with one another; their result sets intersect. Additional positive/negative tags and directory filters further narrow the result set. Base-mode saved searches remain standalone and do not compose with other special queries or Seam filters.
- Active Seam, Base, and tag searches show navigation, new-tab, split-view, and Escape footer hints in that order. A selected `dir:` filter displays the tag-filter placeholder after the folder token.
- The empty Palette shows “Search files, #tags, @special, dir:, or run Seam commands...”. Active special and tag filters show “Search tags to filter (e.g., #tag)...”, including immediately after a special query is selected.
- Placeholder copy is concise: the empty Palette lists search prefixes and commands, active tag and directory filters prompt for a tag, and Seam special searches prompt for a file or tag. The Seam prompt has spacing after the query; Base special searches show no placeholder.
- Final placeholder wording uses `> commands` for the command prefix, “Add a #tag filter...” for tag and directory filters, and “Search files or add #tags...” for Seam searches. Quick Add prompts users to choose a note option. Other settings fields keep concise labels or path examples.

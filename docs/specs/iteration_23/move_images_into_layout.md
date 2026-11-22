# Move existing note images into a new layout

When inserting Image Layout, move the selected images already embedded in the current note into
the generated `seam-layout` block. Do not leave duplicate ordinary embeds in the note.

- Match vault images using their resolved path relative to the source note; retain aliases,
  captions, image options, filenames with spaces, Markdown destinations, and signed URL parameters.
- Remove only matching ordinary image embeds. Preserve surrounding prose, unselected images,
  existing galleries, frontmatter, comments, and code examples.
- Handle insertion before/after the original embeds or inside a selected image range without
  overlapping edits. Preserve existing text-selection replacement behavior and CRLF notes.
- Apply insertion and removals in a single editor transaction so one Undo restores the original.
- Retain the existing conflict guard if the note changes while the layout editor is open.

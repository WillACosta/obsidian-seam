# Utility Image Layout integration

Expose the Utility plugin's single Image Layout command in the Utility group and open its configuration inside the existing Universal Palette. Allow the embedded view to request a wider, scrollable editor, with fixed action/footer content. Dispose view-specific presentation when going back or dismissing, preserving the parent Palette's geometry and query.

The independent Utility plugin owns parsing, rendering, configuration, image selection/reordering, and edits of Markdown `seam-layout` blocks. Its syntax and controls are documented in `obsidian-seam-utility/docs/image-layouts.md`.

# Tab and layout previews

- Ctrl+Tab opens a floating row of previews for open main-workspace tabs, following workspace tab order. The first press highlights the next tab; subsequent Tab presses while Ctrl is held advance and wrap. Ctrl+Shift+Tab reverses and wraps.
- Keep the active tab unchanged until Ctrl is released or a preview is clicked. Escape, clicking outside, loss of window focus, and plugin unload dismiss without selecting. Keep the selected card visible in a horizontally scrollable row and truncate long titles with the full title accessible.
- Show note content, including unsaved editor text, in previews. Use inert snapshots or a title/icon fallback for other view types. Do not activate or create tabs to render previews.
- Add an accessible hover/focus expand action to rendered Image Layouts, with a matching context-menu action. Also provide expand beside Live Preview in the layout editor.
- Open a full-window viewer that keeps the original layout width and scales the whole composition, including gaps and captions. Provide zoom out, fit, zoom in, and native dismissal. Image clicks in this view must not open or zoom individual images.
- Preserve the note and the layout editor's pending edits. Disconnect observers, unload render components, and remove keyboard scopes when their owners close or unload. Support theme colors, keyboard access, and narrow windows.

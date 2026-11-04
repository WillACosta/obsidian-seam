# Universal Palette — Bases Keyboard Navigation

## Goal

Navigate embedded native Bases results with all four arrow keys, using the calendar's distinction between search input and result navigation.

## Interaction

- From the Palette search input, unmodified Up or Down enters result navigation without opening a note. Keep Left/Right, selections, modified arrows, and IME input available for normal search editing.
- Keep focus on a stable result host while native Bases virtualizes or recycles its rows/cards. Indicate the selected result visibly and through the active-descendant attribute.
- Do not add a focus border around the result container. Draw the selected-item border over the full card, including its cover image and properties, without changing native layout or intercepting clicks.
- In cards views, Left/Right selects the previous/next card in reading order, crossing row boundaries. Up/Down selects the nearest card in the adjacent row while retaining the preferred column through incomplete rows.
- Continue through virtualized rows by scrolling their native viewport and resolving the next selection after rendering. Do not alter native layout or restrict filtering to rendered cards.
- In table views, Up/Down selects rows and Left/Right scrolls horizontally to reveal columns while retaining the selected row.
- Enter opens the selected note. Preserve Mod+Enter for a new tab, Shift+Enter for a vertical split, and Mod+Shift+Enter for a split.
- Escape from result navigation returns focus to the search input and preserves the query/filter. A subsequent Escape from the input dismisses the Palette.
- Update footer hints to show all arrows and Escape returning to search while navigating. Native toolbar inputs retain their own editing behavior.
- Remove the navigation scope, focus handlers, and active-descendant references on dismissal, mode changes, and plugin unload. Preserve calendar navigation and mouse/touch activation.

## Validation

- Cover grid geometry, incomplete rows, virtualized transitions, filtering, empty results, scope cleanup, and modifier/IME handling with focused tests.
- Validate real keyboard events against native cards and table views in `seam_test_vault`, including Escape → continued typing → navigation, opening destinations, and dismissal.

# Weekly notes and persistent calendar pins

## Experience

- Keep `@calendar` as the entry point. Add a compact pinned shelf above the calendar's scroll area, visible in day, month, and year views. Support at most three slots, including an optional rolling weekly pin.
- Provide a note picker and contextual **Pin current note to calendar** / **Unpin current note from calendar** commands in Obsidian and Seam. Markdown notes only. Preserve pin order, do not automatically replace a pin at the limit, and persist references in Seam settings without modifying notes.
- Fixed pins follow file and folder renames/moves, are removed when the target is deleted, and otherwise remain fixed across calendar navigation, weeks, and years. Clean up stale fixed references when reopening the calendar.
- Show **Open weekly note** / **Create weekly note** below the selected day's action, with an explicit date range for the week containing that day. Do not add a week-number column.
- Offer **Keep this week pinned** for the current week. The rolling pin uses the real current week rather than the calendar selection. It uses one slot and suppresses the duplicate weekly action when the selected week is the same week.
- At rollover, resolve the new week's note. If missing, show **Create weekly note** in the rolling slot without creating automatically or opening last week's note. Keep the slot configured until unpinned; deleting its current resolved note removes it. Moving/renaming that resolved note keeps its reference for the remainder of the week, then follows normal weekly configuration at rollover.
- Converting a fixed current-week pin to a rolling pin retains its position and does not consume a duplicate slot. Do not add a duplicate fixed pin for the rolling pin's resolved file.

## Weekly configuration and creation

- Read enabled Periodic Notes weekly configuration when available, using public vault adapter APIs rather than another plugin's private runtime. Support legacy `weekly` configuration and the active modern calendar set's `week` configuration.
- Otherwise use a small Seam settings group for weekly folder, format, and template. Default to `Weekly/`, `gggg-[W]ww`, and no template; provide an explicit option to use Seam settings even when Periodic Notes is configured.
- Locale-week formats use locale week boundaries; ISO `GGGG`/`WW` formats use Monday-based ISO weeks. Align the calendar grid and week navigation with the same convention. Reject mixed week/year conventions and formats that cannot identify a week/date.
- Use week-year semantics around New Year. Support nested folders and date/title/time/weekday template tokens, with dates evaluated within the selected week.
- Open existing notes without changing their contents. Create only after a user action, serialize same-path creations, tolerate external creation races, and never overwrite a file or folder conflict.

## Keyboard, lifecycle, and validation

- Retain date arrows, period navigation, and two-stage Escape. Tab reaches pins and weekly actions; Enter/Space activates them. The footer describes the focused action (open, create, select, pin, or unpin).
- Preserve focus across rendering, with a safe fallback when a focused pin disappears or a button becomes disabled. Keep the shelf visible while the calendar scrolls in narrow windows.
- Dispose subscriptions, scopes, DOM, and the day-rollover timer when closing/unloading. Discard late settings reads. Serialize pin saves, roll back a failed save, and display errors without changing note contents.
- Support English and Brazilian Portuguese. Validate unit tests plus real interactions in the dedicated `seam_test_vault`, including persistence/reload, limits, renames/deletes, week rollover, templates, keyboard actions, and narrow-window layout.

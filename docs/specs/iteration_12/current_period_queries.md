# Current-week and current-year special queries

- Add `@thisWeek` and `@thisYear`, case-insensitive like the existing special queries. Keep them with `@today`, `@yesterday`, and `@calendar` in the special-query list; support existing visibility, pinning, and ordering settings.
- `@thisWeek` resolves the current week's configured weekly note, using the same locale/ISO week convention and Periodic Notes/Seam configuration as the calendar.
- `@thisYear` resolves the current calendar year's note. Read enabled Periodic Notes `yearly` or active calendar-set `year` settings; otherwise use Seam's yearly folder, format, and template. Defaults: `Yearly/`, `YYYY`, no template. Use January 1 as the template date anchor and reject week-year formats.
- An existing note is an ordinary selectable note result. A missing note offers an explicit creation suggestion only for a standalone unfiltered query and only if its path is unoccupied. Filtering out an existing note must not offer duplicate creation. Folder conflicts must not be overwritten.
- Match `@today` activation behavior: Enter uses the current tab, Mod+Enter uses a new tab, and Shift+Enter or Mod+Shift+Enter uses a vertical split. Show creation helper labels for missing notes and normal open labels after creation. Mouse selection also works.
- Capture the period and destination when offering creation. Do not switch to a different year/week if time advances before activation. Share safe folder/template creation and same-path concurrency protection across weekly and yearly notes.
- Support tags, text, and directory filters for existing notes. Discard stale async results. Invalid configuration shows a recoverable error row with dismiss-only instructions and does not create anything.
- Add English and Brazilian Portuguese labels and yearly settings. Keep existing pins and weekly/calendar behavior intact; yearly queries do not introduce a rolling yearly pin.

## Add a new option to transfer unfinished data from a daily note to the next

Imagine that a user defines some to-dos for the day:

```
- [x] Read Hyperion
- [/] Implement Seam Features
	- [x] Implement mobile UI
	- [ ] Write unit tests
- [ ] Buy a new espresso machine
```

So we need to provide a command so users can move the pending work to the next daily note with its parent list item (if nested).

1. If the next day's daily note doesn't exist, we create it and use the default "Daily Note Template" which is natively provided by Obsidian.
2. The command works in both ways: "To move pending items from today's note to the next daily note and vice versa",; here's an example:

When today's note is opened:

```
> Move todo items to tomorrow's daily note
> Pull todo items from yesterday's daily note
```

Note that when moving nested items, we only move when they're not yet finished, or when the parent item has an `/` symbol, which indicates that it's partially done.

Use if necessary this plugin: https://github.com/liamcain/obsidian-calendar-plugin, as a reference on how to use existing Obsidian APIs to create a daily note following the pre-defined user template and location (Daily Note Core plugin of Obsidian).

At this moment, we don't want to extract further implementations in the Calendar plugin, it's here just a reference that we can use the Obsidian APIs do create a daily note in the default user's folder and template.

## Command visibility and missing Daily Notes

- While today's Daily Note is open, show the move command only when today's note contains unfinished tasks eligible for transfer.
- Show the pull command only when yesterday's Daily Note exists and contains unfinished tasks eligible for transfer.
- Count unchecked (`[ ]`) and partially complete (`[/]`) tasks using the same nested-task rules as the transfer itself. Completed-only notes do not show these commands.
- When a standalone `@today` or `@yesterday` search has no Daily Note, offer to create and open it using the configured core Daily Notes folder, date format, and template.
- If a Daily Note already exists but is excluded by additional filters, do not offer to create it again.
- Missing-note creation supports Enter in the current tab, Mod+Enter in a new tab, and Shift+Enter or Mod+Shift+Enter in a vertical split. Show “create”, “create in a new tab”, and “create in split view” shortcut labels while offering creation; existing-note results retain “open” labels.

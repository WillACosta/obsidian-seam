# Global statistics accounting and comparisons

Source: user-approved statistics analysis, 2026-11-05.

- Keep Total words as the current token count of Markdown files, including unsaved editor text, properties, code, and link destinations. Label its context as current vault size.
- Present the gross words added this month in Writing over time, separately from the vault total. Explain that editor pastes and replacement words count, and deletions do not subtract historical effort.
- Compare the same first N calendar days of the current and preceding month, where N is the smaller of today's day number and the preceding month's length. State this window in the comparison label. The monthly additions total still includes all days through today.
- Require recorded history beginning by the preceding month's first day before showing a percentage. Show Insufficient history for comparison otherwise. A genuinely zero baseline gets a distinct message without a percentage.
- Preserve gross additions, deletion-only editing sessions, historical contributions of deleted notes, and existing storage. Do not infer historical vault growth, removals, or snapshots from addition-only data.
- Avoid new-writing credit for distant moves in one transaction and for a recognized cut followed by a matching paste across editors. Match only the next local edit within five minutes; clear on copy, undo/redo, unrelated editing, or a mismatching paste. This transient recognition does not survive a plugin reload.
- Keep English and PT-BR copy consistent and preserve the dashboard's keyboard, touch, and responsive behavior.
- Validate comparison boundaries, additions/deletions, transaction provenance and movement with tests, then reload the copied plugin in seam_test_vault and verify the dashboard and editing behavior. Do not use the personal vault.

True net-writing metrics and historical vault-size snapshots remain conditional future features, not part of this change.

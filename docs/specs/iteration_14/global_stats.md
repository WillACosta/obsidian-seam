# Seam — Global Statistics View

**Target:** `feat/3.1.0`
**Component:** Universal Palette
**Scope:** UI/UX and global vault statistics

## 1. Overview

Implement a new **Global Statistics** view command (Universal Palette), inspired by GitHub's contribution graph.
The interface should be minimal, visually consistent with Seam, and focused on writing activity, consistency, and vault growth.
Do not introduce a separate modal, sidebar, or workspace view.

## 2. Dashboard Layout

Organize the view into three sections, in this order.

### 2.1 Overview Cards

Display four compact statistics:

| Metric | Description |
|---|---|
| Total Notes | Total Markdown files in the vault |
| Total Words | Combined word count of all Markdown notes |
| Active Days | Days with recorded writing activity |
| Writing Streak | Current consecutive active days |

Use a responsive 2×2 grid on narrow layouts and a single row when space allows.

### 2.2 Writing Contributions

Implement a GitHub-style calendar heatmap.

- Display the previous 52 weeks by default.
- Each square represents one calendar day.
- Organize columns by week and rows by weekday.
- Use five intensity levels, including zero activity.
- Support three contribution metrics:
  - **Words Written** (default): Gross words added.
  - **Notes Edited:** Distinct notes edited per day.
  - **Writing Activity:** Number of recorded writing sessions.
- Provide a selector to switch between metrics.
- Provide a period selector: **Year / 3 Months**.
- Show month labels and a compact intensity legend.

**Interactions:**
- Hovering over a cell reveals its date and contribution details.
- Clicking/tapping a cell displays the notes edited that day, including individual word contributions.
- Clicking a note opens it in Obsidian.
- Future dates must not appear as recorded activity.

### 2.3 Writing Trends

Display a compact bar chart showing writing activity over the previous six months.

- Default metric: Words Written.
- Alternative metric: Notes Created.
- Display month labels and readable values.
- Reuse the heatmap's visual language.

## 3. UI/UX Requirements

- Follow Seam's existing design system, typography, spacing, and navigation patterns.
- Use Obsidian CSS variables for theme compatibility.
- Keep visual elements compact and avoid excessive borders or decoration.
- Ensure the heatmap works on both desktop and mobile, using horizontal scrolling when necessary.
- Support mouse, keyboard, and touch interactions.
- Provide meaningful empty states for new vaults or missing activity history.
- Use the plugin's existing localization system (English and PT-BR).
- Preserve the Universal Palette's existing functionality and keyboard navigation.

## 4. Important Technical Considerations

- Use Obsidian's Vault API for current global note and word totals.
- Record writing activity incrementally; do not rely on file modification timestamps as historical evidence.
- Avoid counting initial indexing, imports, sync operations, or programmatic updates as writing activity.
- Distinguish gross words added from net word-count changes.
- Prevent double-counting words during incremental typing, undo/redo, or repeated modification events.
- Aggregate contributions by local calendar date, accounting for timezone changes.
- Keep statistics persistent between plugin reloads.
- Avoid expensive full-vault calculations whenever the palette opens.
- Do not fabricate historical contributions. The heatmap should begin accumulating reliable activity after the feature is enabled.

## 5. Acceptance Criteria

- [ ] Global Statistics is accessible within the Universal Palette.
- [ ] Overview metrics accurately represent vault statistics.
- [ ] Contribution heatmap supports the three metrics and two periods.
- [ ] Daily contributions expose their associated notes.
- [ ] Note selection opens the corresponding Obsidian file.
- [ ] Writing trends display accurate monthly aggregates.
- [ ] Dashboard is responsive and compatible with desktop/mobile.
- [ ] UI supports light/dark themes and EN/PT-BR.
- [ ] Activity persists across plugin reloads without duplication.
- [ ] Existing Universal Palette behavior remains unchanged.

**Out of scope:** Writing goals, reminders, social features, cloud analytics, knowledge graph analytics.

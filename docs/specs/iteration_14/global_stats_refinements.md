# Global Statistics UI refinements

Source: user follow-up with three reference screenshots, 2026-10-26.

These refinements supersede the section names and selector/chart presentation in `global_stats.md`; activity accounting and persistence remain unchanged.

- Use a single Obsidian tooltip for day cells. Remove native `title` attributes so the browser tooltip cannot overlap Obsidian's tooltip. Keep accessible date and activity labels.
- Rename “Writing contributions” to “Writing activity,” including the accessible legend wording; avoid GitHub contribution terminology in the UI.
- Replace metric and period dropdowns with compact pill chips. Place Year / 3 months at the dashboard's top right. Place Words / Notes / Activity beside the Writing activity title, wrapping gracefully in narrow layouts. Keep clear selected states and radio-group semantics with arrow/Home/End/Enter/Space navigation.
- Rename “Writing trends” to “Writing over time.” Display six vertical monthly bars against one zero-based linear scale, readable axis ticks/grid lines, month labels, and values. Keep “Last 6 months” as a separate caption and retain Words / Notes chips, with Notes measuring observed note creations. This chart keeps its six-month range independently of the heatmap period.
- Follow Obsidian theme colors and existing English/PT-BR localization. Preserve the heatmap, note navigation, Backspace/Escape, and horizontal scrolling behavior.

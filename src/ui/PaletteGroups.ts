import { PaletteItem } from '../types'
import { t } from '../i18n'

function commandGroup(item: PaletteItem): string {
  if (['cmd-global-statistics', 'cmd-note-statistics', 'cmd-note-completion'].includes(item.id))
    return t().paletteGroupStatistics
  if (/^cmd-(archive|move-|daily-todos)/.test(item.id)) return t().paletteGroupMove
  if (/^cmd-(quick-|source-note)/.test(item.id)) return t().paletteGroupCreate
  if (['cmd-initialize-seam', 'cmd-show-status', 'cmd-process-pending'].includes(item.id))
    return t().paletteGroupSeam
  return t().paletteGroupNote
}

/** Labels decorate actual suggestions, never add keyboard stops or consume result slots. */
export function groupPaletteItems(
  items: PaletteItem[],
  enabled: boolean,
  special = false,
): PaletteItem[] {
  if (!enabled) return items
  if (special) {
    let previous = ''
    return items.map((item) => {
      const label = item.customSearchId
        ? t().paletteGroupCustomQueries
        : t().paletteGroupBuiltinQueries
      const groupLabel = label === previous ? undefined : label
      previous = label
      return { ...item, groupLabel }
    })
  }
  const groups = new Map<string, PaletteItem[]>()
  for (const item of items) {
    const label = item.type === 'note' ? t().paletteGroupPinnedNotes : commandGroup(item)
    const group = groups.get(label) ?? []
    group.push(item)
    groups.set(label, group)
  }
  return [...groups].flatMap(([label, group]) =>
    group.map((item, index) => ({ ...item, groupLabel: index === 0 ? label : undefined })),
  )
}

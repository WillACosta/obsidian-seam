import { PaletteItem } from '../types'

/** Registered pin/unpin commands share one contextual Palette action. */
const contextualAliases: Record<string, string> = {
  'registered:pin-note': 'cmd-palette-pin',
  'registered:unpin-note': 'cmd-palette-pin',
  'registered:pin-current-note-to-calendar': 'cmd-calendar-pin',
  'registered:unpin-current-note-from-calendar': 'cmd-calendar-pin',
}

/** Keep pins in their configured order, then show each remaining available command once. */
export function orderPaletteCommands(
  commands: PaletteItem[],
  availablePins: PaletteItem[],
  pinnedIds: string[],
  query = '',
  includeUnpinned = true,
): PaletteItem[] {
  const normalized = query.trim().toLowerCase()
  const matches = (item: PaletteItem): boolean =>
    !normalized ||
    item.title.toLowerCase().includes(normalized) ||
    item.description.toLowerCase().includes(normalized)
  const seen = new Set<string>()
  const suppressed = new Set<string>()
  const pinned = pinnedIds.flatMap((id) => {
    const alias = contextualAliases[id]
    if (seen.has(id) || suppressed.has(id) || (alias && seen.has(alias))) return []
    const ordinary = commands.find((item) => item.id === id)
    const command = availablePins.find((item) => item.id === id) ?? ordinary
    if (!command) return []
    seen.add(id)
    if (alias) suppressed.add(alias)
    return matches(command) || (ordinary && matches(ordinary))
      ? [{ ...command, pinnedCommand: true }]
      : []
  })
  if (!includeUnpinned) return pinned
  const remaining = commands.filter((item) => {
    if (seen.has(item.id) || suppressed.has(item.id)) return false
    seen.add(item.id)
    return matches(item)
  })
  return [...pinned, ...remaining]
}

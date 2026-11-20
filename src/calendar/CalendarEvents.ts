import type { ListItemCache } from 'obsidian'

export const CALENDAR_EVENT_STATUS = '<'

export function calendarEventItems(items: readonly ListItemCache[]): ListItemCache[] {
  return items.filter((item) => item.task === CALENDAR_EVENT_STATUS)
}

export function calendarEventTitles(content: string, items: ListItemCache[]): string[] {
  const lines = content.split(/\r?\n/)
  return items.map(({ position }) => {
    const { line, col } = position.start
    const source = lines[line]?.slice(col) ?? ''
    return /(?:^|\s)\[<\](?:[ \t]+(.*)|$)/.exec(source)?.[1]?.trim() ?? ''
  })
}

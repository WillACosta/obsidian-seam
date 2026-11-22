/** Move within the visible grid, including an incomplete final row. */
export function gridNeighbor(index: number, count: number, columns: number, key: string): number {
  if (!count) return -1
  const step =
    key === 'ArrowUp' ? -columns : key === 'ArrowDown' ? columns : key === 'ArrowLeft' ? -1 : 1
  return Math.max(0, Math.min(count - 1, index + step))
}

export function isBackShortcut(
  event: Pick<KeyboardEvent, 'key' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>,
  mac: boolean,
): boolean {
  return (
    event.key === '[' &&
    !event.altKey &&
    !event.shiftKey &&
    (mac ? event.metaKey && !event.ctrlKey : event.ctrlKey && !event.metaKey)
  )
}

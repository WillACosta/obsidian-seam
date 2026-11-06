export type FoldGroup = { start: number; end: number }

/** Find the innermost Markdown group that actually contains the cursor line. */
export function findFoldGroup(text: string, cursorLine: number): FoldGroup | null {
  const lines = text.split('\n')
  const active = lines.map(() => true)
  let fence: { marker: string; length: number } | null = null
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^\s*(`{3,}|~{3,})/)
    if (fence) {
      active[i] = false
      if (match && match[1][0] === fence.marker && match[1].length >= fence.length) fence = null
    } else if (match) {
      active[i] = false
      fence = { marker: match[1][0], length: match[1].length }
    }
  }
  const groups: FoldGroup[] = []
  const trimEnd = (start: number, end: number) => {
    while (end > start && !lines[end].trim()) end--
    return end
  }
  const indent = (value: string) => value.match(/^\s*/)?.[0].replace(/\t/g, '    ').length ?? 0
  const items: (FoldGroup & { indent: number })[] = []
  for (let start = 0; start < lines.length; start++) {
    if (!active[start]) continue
    const heading = lines[start].match(/^(#{1,6})\s+/)
    if (heading) {
      let end = start + 1
      while (end < lines.length) {
        const next = active[end] && lines[end].match(/^(#{1,6})\s+/)
        if (next && next[1].length <= heading[1].length) break
        end++
      }
      groups.push({ start, end: trimEnd(start, end - 1) })
    }
    if (!/^\s*(?:[-*+]|\d+[.)])\s+/.test(lines[start])) continue
    const depth = indent(lines[start])
    let end = start + 1
    while (end < lines.length && (!lines[end].trim() || indent(lines[end]) > depth)) end++
    const item = { start, end: trimEnd(start, end - 1), indent: depth }
    items.push(item)
    groups.push({ start: item.start, end: item.end })
  }
  // Native folding needs a range provider for sibling-only lists/checklists.
  const nextNonempty = (line: number) => {
    while (line < lines.length && !lines[line].trim()) line++
    return line
  }
  const byLine = new Map(items.map((item) => [item.start, item]))
  const hasPrevious = new Set<number>()
  for (const item of items) {
    const next = byLine.get(nextNonempty(item.end + 1))
    if (next?.indent === item.indent) hasPrevious.add(next.start)
  }
  for (const first of items) {
    if (hasPrevious.has(first.start)) continue
    let end = first.end
    let siblings = 1
    while (true) {
      let nextLine = end + 1
      while (nextLine < lines.length && !lines[nextLine].trim()) nextLine++
      const next = byLine.get(nextLine)
      if (!next || next.indent !== first.indent) break
      end = next.end
      siblings++
    }
    if (siblings > 1) groups.push({ start: first.start, end })
  }
  return (
    groups
      .filter(
        (group) => group.start <= cursorLine && cursorLine <= group.end && group.end > group.start,
      )
      .sort((a, b) => a.end - a.start - (b.end - b.start) || b.start - a.start)[0] ?? null
  )
}

import type { ListItemCache } from 'obsidian'

/** Public metadata supports synchronous Obsidian command visibility checks. */
export function hasPendingTasksInCache(items: ListItemCache[]): boolean {
  const byLine = new Map(items.map((item) => [item.position.start.line, item]))
  return items.some((item) => {
    if (item.task !== ' ' && item.task !== '/') return false
    let current = item
    const seen = new Set<number>()
    while (!seen.has(current.position.start.line)) {
      seen.add(current.position.start.line)
      const parent = byLine.get(current.parent)
      if (!parent || parent.position.start.col >= current.position.start.col) break
      if (parent.task !== undefined && parent.task !== ' ' && parent.task !== '/') return false
      current = parent
    }
    return true
  })
}

interface ListItem {
  start: number
  end: number
  indent: number
  status: string | undefined
  children: ListItem[]
}

/** Copy pending branches with their parent context and mark their source tasks. */
export function extractPendingTasks(content: string): {
  markedSource: string
  pending: string
  count: number
} {
  const newline = content.includes('\r\n') ? '\r\n' : '\n'
  const lines = content.split(newline)
  const roots: ListItem[] = []
  const stack: ListItem[] = []
  let fence: { marker: string; length: number } | null = null
  let frontmatter = lines[0] === '---'
  let comment = false
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    if (frontmatter) {
      if (i > 0 && /^(---|\.\.\.)\s*$/.test(line)) frontmatter = false
      continue
    }
    const fenceMatch = line.match(/^\s*(`{3,}|~{3,})/)
    if (fenceMatch) {
      const indent = (line.match(/^\s*/)?.[0] ?? '').replace(/\t/g, '    ').length
      if (!fence)
        while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop()!.end = i
      if (!fence) fence = { marker: fenceMatch[1][0], length: fenceMatch[1].length }
      else if (fenceMatch[1][0] === fence.marker && fenceMatch[1].length >= fence.length)
        fence = null
      continue
    }
    if (fence) continue
    if (comment || line.trimStart().startsWith('<!--')) {
      comment = !line.includes('-->')
      if (line.trimStart().startsWith('<!--')) while (stack.length) stack.pop()!.end = i
      continue
    }
    const match = line.match(/^(\s*)(?:[-+*]|\d+[.)])\s+(?:\[([^\]])\]\s*)?/)
    const indent = (match?.[1] ?? line.match(/^\s*/)?.[0] ?? '').replace(/\t/g, '    ').length
    if (match && !stack.length && indent >= 4) continue
    if (!match) {
      if (line.trim())
        while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop()!.end = i
      continue
    }
    while (stack.length && indent <= stack[stack.length - 1].indent) stack.pop()!.end = i
    const item: ListItem = { start: i, end: lines.length, indent, status: match[2], children: [] }
    ;(stack.length ? stack[stack.length - 1].children : roots).push(item)
    stack.push(item)
  }
  const replacements = new Map<number, string>()
  let count = 0
  function visit(item: ListItem): string[] {
    if (item.status !== undefined && item.status !== ' ' && item.status !== '/') return []
    const children = item.children.flatMap(visit)
    const ownPending = item.status !== undefined
    if (!ownPending && !children.length) return []

    const ownEnd = item.children[0]?.start ?? item.end
    let trimmedEnd = ownEnd
    while (trimmedEnd > item.start + 1 && !lines[trimmedEnd - 1].trim()) trimmedEnd--
    const pending = lines.slice(item.start, trimmedEnd)
    if (ownPending) {
      count++
      replacements.set(item.start, pending[0].replace(/\[[ /]\]/, '[>]'))
      pending[0] = pending[0].replace(/\[[ /]\]/, '[ ]')
    }
    return [...pending, ...children]
  }

  const pending = roots.flatMap(visit).join(newline)
  return {
    markedSource: lines.map((line, i) => replacements.get(i) ?? line).join(newline),
    pending,
    count,
  }
}

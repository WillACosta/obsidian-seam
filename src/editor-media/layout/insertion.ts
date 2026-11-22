import { images } from '../core'
import { LayoutImage, parseLayoutImage } from './model'

export type LayoutInsertionChange = { from: number; to: number; text: string }
type Range = { from: number; to: number }

/** Only move rendered embeds: code examples, frontmatter, comments, and other layouts stay intact. */
function imageRemovals(
  text: string,
  selected: Set<string>,
  identity: (path: string) => string,
): Range[] {
  if (!selected.size) return []
  const result: Range[] = []
  let offset = 0
  let fence: { marker: string; length: number } | null = null
  let frontmatter = /^\uFEFF?---\r?\n/.test(text)
  let comment: '-->' | '%%' | null = null
  let inlineUntil = 0
  const lines = text.split('\n')
  for (let index = 0; index < lines.length; index++) {
    const original = lines[index] + (index < lines.length - 1 ? '\n' : '')
    const line = original.replace(/\r?\n$/, '')
    const start = offset
    offset += original.length
    if (frontmatter) {
      if (start > 0 && /^(?:---|\.\.\.)\s*$/.test(line)) frontmatter = false
      continue
    }
    const marker = /^\s*(?:>\s*)*(`{3,}|~{3,})(.*)$/.exec(line)
    if (!comment && inlineUntil <= start && marker) {
      if (!fence) fence = { marker: marker[1][0], length: marker[1].length }
      else if (
        marker[1][0] === fence.marker &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = null
      continue
    }
    if (fence || (!comment && /^(?: {4}|\t)/.test(line))) continue
    // Mark protected positions without altering offsets into the original line.
    const visible = Array.from({ length: line.length }, () => true)
    const continued = Math.min(line.length, Math.max(0, inlineUntil - start))
    visible.fill(false, 0, continued)
    for (let i = continued; i < line.length;) {
      if (comment) {
        const end = line.indexOf(comment, i)
        const to = end < 0 ? line.length : end + comment.length
        visible.fill(false, i, to)
        i = to
        if (end >= 0) comment = null
      } else if (line.startsWith('<!--', i) || line.startsWith('%%', i)) {
        comment = line.startsWith('<!--', i) ? '-->' : '%%'
        const length = comment === '-->' ? 4 : 2
        visible.fill(false, i, i + length)
        i += length
      } else if (line[i] === '`') {
        let end = i + 1
        while (line[end] === '`') end++
        const ticks = line.slice(i, end)
        let close = text.indexOf(ticks, start + end)
        while (close >= 0 && (text[close - 1] === '`' || text[close + ticks.length] === '`'))
          close = text.indexOf(ticks, close + 1)
        if (close >= 0 && !/\r?\n[ \t]*\r?\n/.test(text.slice(start + end, close))) {
          inlineUntil = close + ticks.length
          const stop = Math.min(line.length, inlineUntil - start)
          visible.fill(false, i, stop)
          i = stop
        } else i = end
      } else i++
    }
    const matches = images(line).filter((match) => {
      if (!visible[match.start]) return false
      let escapes = 0
      for (let i = match.start - 1; i >= 0 && line[i] === '\\'; i--) escapes++
      if (escapes % 2) return false
      const image = parseLayoutImage(match.raw)
      return image && selected.has(identity(image.path))
    })
    if (!matches.length) continue
    let remaining = line
    for (const match of matches.slice().reverse())
      remaining = remaining.slice(0, match.start) + remaining.slice(match.end)
    if (!remaining.trim()) result.push({ from: start, to: offset })
    else
      for (const match of matches) result.push({ from: start + match.start, to: start + match.end })
  }
  return result
}

/** Changes use original-document offsets and never overlap, for one atomic Editor.transaction. */
export function planLayoutInsertion(
  text: string,
  selected: readonly Pick<LayoutImage, 'path'>[],
  from: number,
  to: number,
  block: string,
  identity: (path: string) => string = (path) => path,
): LayoutInsertionChange[] {
  const removals = imageRemovals(
    text,
    new Set(selected.map((image) => identity(image.path))),
    identity,
  )
  const separate: Range[] = []
  for (const removal of removals) {
    if (removal.to < from || removal.from > to) separate.push(removal)
    else {
      from = Math.min(from, removal.from)
      to = Math.max(to, removal.to)
    }
  }
  let before = text.slice(0, from)
  for (const removal of separate.filter((range) => range.to <= from).reverse())
    before = before.slice(0, removal.from) + before.slice(removal.to)
  const newline = text.includes('\r\n') ? '\r\n' : '\n'
  const prefix = before && !before.endsWith('\n') ? newline : ''
  const insertion = { from, to, text: prefix + block.replace(/\r?\n/g, newline) }
  return [...separate.map((range) => ({ ...range, text: '' })), insertion].sort(
    (a, b) => a.from - b.from,
  )
}
